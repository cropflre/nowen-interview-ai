/**
 * 服务端判分（M4）
 *  - gradeTyping：打字关，逐字比对（分母用目标长度，防止"只打一个字"骗分）
 *  - gradeCode  ：代码关，在**独立子进程**里跑「用户代码 + 测试」，超时即 0 分
 *
 * 安全说明：这会在服务器上执行用户提交的代码。
 * 本项目是**自托管单用户学习工具**，默认开启；
 * 若要关闭，设环境变量 ALLOW_SERVER_EXEC=0（关闭后回退为客户端判分 + 反刷规则）。
 */
import { execFile } from 'node:child_process'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const NODE_BIN = process.execPath
const TIMEOUT = Number(process.env.JUDGE_TIMEOUT_MS || 5000)
const MARKER = '__JB_RESULT__'
export const SERVER_EXEC_ENABLED = process.env.ALLOW_SERVER_EXEC !== '0'

/* ---------------- 打字关 ---------------- */
export function gradeTyping(target, typed) {
  const t = String(target || '')
  const s = String(typed || '')
  if (!t) return { score: 0, accuracy: 0, correct: 0, total: 0 }
  let ok = 0
  const n = Math.min(t.length, s.length)
  for (let i = 0; i < n; i++) if (t[i] === s[i]) ok++
  const accuracy = Math.round(ok / t.length * 100)
  return { score: accuracy, accuracy, correct: ok, total: t.length, mode: 'server-typing' }
}

/* ---------------- 代码关（子进程沙箱） ---------------- */
export function gradeCode(problem, code) {
  return new Promise((resolve) => {
    if (!problem || !problem.tests) {
      return resolve({ score: 0, error: '题目缺少测试用例', results: [], mode: 'server-code' })
    }
    let dir
    let file
    try {
      dir = mkdtempSync(join(tmpdir(), 'jbg-'))
      file = join(dir, 'submission.mjs')

      const harness = `
const results = [];
const T = {
  eq(a, b) { const x = JSON.stringify(a), y = JSON.stringify(b); if (x !== y) throw new Error('期望 ' + y + '，实际 ' + x); },
  log() {},
  async test(name, fn) {
    try { await fn(); results.push({ ok: true, name }); }
    catch (e) { results.push({ ok: false, name, msg: String((e && e.message) || e) }); }
  }
};
`
      const tail = `
;(async () => {
${problem.tests}
})()
  .then(() => { console.log('${MARKER}' + JSON.stringify(results)); })
  .catch(e => {
    results.push({ ok: false, name: '执行异常', msg: String((e && e.message) || e) });
    console.log('${MARKER}' + JSON.stringify(results));
  });
`
      writeFileSync(file, harness + '\n' + String(code || '') + '\n' + tail, 'utf8')
    } catch (e) {
      return resolve({ score: 0, error: '写入提交失败：' + e.message, results: [], mode: 'server-code' })
    }

    execFile(NODE_BIN, [file], { timeout: TIMEOUT, cwd: dir, maxBuffer: 1024 * 512 }, (err, stdout, stderr) => {
      // 解析结果：标记单独占一行，按行截取（避免测试名里的 [ ] 干扰 JSON 解析）
      let out = null
      const raw = String(stdout)
      const at = raw.indexOf(MARKER)
      if (at >= 0) {
        const line = raw.slice(at + MARKER.length).split('\n')[0].trim()
        try { out = JSON.parse(line) } catch (e) { out = null }
      }
      try { rmSync(dir, { recursive: true, force: true }) } catch (e) { /* ignore */ }

      if (!out) {
        const timedOut = !!(err && (err.killed || err.signal))
        const firstErr = String(stderr || '').split('\n').find(l => l.trim()) || ''
        const msg = timedOut
          ? `运行超时（超过 ${TIMEOUT}ms，已强制终止）`
          : (firstErr.slice(0, 180) || '代码无法执行（可能有语法错误）')
        return resolve({ score: 0, accuracy: 0, pass: 0, total: 0, error: msg, results: [], mode: 'server-code' })
      }
      const total = out.length || 1
      const pass = out.filter(r => r.ok).length
      resolve({
        score: Math.round(pass / total * 100),
        accuracy: Math.round(pass / total * 100),
        pass, total, results: out, mode: 'server-code'
      })
    })
  })
}

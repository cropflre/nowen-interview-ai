import { pathToFileURL } from 'node:url'

const B = 'http://localhost:5181'
const TOK = 'u_1'
const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + TOK }

const j = async (p, opt = {}) => {
  const res = await fetch(B + p, { ...opt, headers: { ...H, ...(opt.headers || {}) } })
  const json = await res.json()
  if (!json.ok) throw new Error(json.error)
  return json.data
}
const post = (p, body) => j(p, { method: 'POST', body: JSON.stringify(body) })

let pass = 0, fail = 0
const chk = (name, actual, expect) => {
  const ok = String(actual) === String(expect)
  console.log(`  ${ok ? '✅' : '❌'} ${name}（期望 ${expect}，实际 ${actual}）`)
  ok ? pass++ : fail++
}

const { PROBLEMS } = await import(pathToFileURL('C:/Program Files/Github开源项目/js-basics-vue/src/data/problems.js').href)

const map = await j('/api/map')
const ch11 = map.chapters.find(c => c.code === 'ch11')
const ch12 = map.chapters.find(c => c.code === 'ch12')

/* ---------- 打字关 ---------- */
const typingLvId = ch12.levels[0].id
const typingLv = await j('/api/levels/' + typingLvId)
const target = typingLv.config.text
console.log(`\n【打字关 #${typingLvId}】目标 ${target.length} 字`)

let r = await post(`/api/levels/${typingLvId}/attempts`, { typed: target, durationMs: 60000 })
chk('全对 → 100 分', r.score, 100)
chk('判分模式 = server-typing', r.detail.mode, 'server-typing')

r = await post(`/api/levels/${typingLvId}/attempts`, { typed: target.slice(0, 5), durationMs: 60000 })
chk('只打 5 字 → 分母仍是目标长度', r.detail.total, target.length)
chk('只打 5 字 → 分数 < 20', r.score < 20, true)

r = await post(`/api/levels/${typingLvId}/attempts`, { typed: '完全不相干的内容', durationMs: 60000 })
chk('乱打 → 低分', r.score < 10, true)

/* ---------- 代码关 ---------- */
const codeLvId = ch11.levels[0].id
const codeLv = await j('/api/levels/' + codeLvId)
const pi = codeLv.config.problemIndex
const refCode = String(PROBLEMS[pi].ref).split('\n').filter(l => !l.trim().startsWith('钩子')).join('\n').trim()
console.log(`\n【代码关 #${codeLvId}】题目索引 ${pi}（${PROBLEMS[pi].title}）`)

r = await post(`/api/levels/${codeLvId}/attempts`, { code: refCode, durationMs: 60000 })
chk('提交参考实现 → 100 分', r.score, 100)
chk('判分模式 = server-code', r.detail.mode, 'server-code')
chk('用例全部通过', r.detail.pass === r.detail.total, true)

r = await post(`/api/levels/${codeLvId}/attempts`, { code: '', durationMs: 60000 })
chk('空代码 → 0 分', r.score, 0)
chk('空代码 → 有用例失败', r.detail.pass === 0, true)

r = await post(`/api/levels/${codeLvId}/attempts`, { code: 'function flatten(){};', durationMs: 60000 })
chk('只声明空函数 → 0 分', r.score, 0)

console.log('\n【超时保护】提交死循环（约 5s 后应被强杀）')
const t0 = Date.now()
r = await post(`/api/levels/${codeLvId}/attempts`, { code: 'while(true){}', durationMs: 60000 })
const cost = ((Date.now() - t0) / 1000).toFixed(1)
chk('死循环 → 0 分', r.score, 0)
chk('返回超时错误', /超时|终止/.test(r.detail.error || ''), true)
console.log(`  ⏱ 实际耗时 ${cost}s（应 ≈ 5s ~ 8s）`)

console.log(`\n════ 判分回归：通过 ${pass} / 失败 ${fail} ════`)

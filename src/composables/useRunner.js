/**
 * 在浏览器里执行"用户代码 + 测试"，返回判分结果与 console 日志。
 * 做法：把用户代码和测试串成一个函数体，用 new Function 执行（free 模式只执行用户代码）。
 */
export async function runCode(problem, code) {
  const results = []
  const logs = []
  const T = {
    eq(a, b) {
      const x = JSON.stringify(a), y = JSON.stringify(b)
      if (x !== y) throw new Error('期望 ' + y + '，实际 ' + x)
    },
    log(...a) {
      logs.push(a.map(v => (typeof v === 'object' && v !== null) ? JSON.stringify(v) : String(v)).join(' '))
    },
    async test(name, fn) {
      try { await fn(); results.push({ ok: true, name }) }
      catch (e) { results.push({ ok: false, name, msg: e.message }) }
    }
  }

  const origLog = console.log
  console.log = (...a) => T.log(...a)
  try {
    if (problem.mode === 'free') {
      const fn = new Function(code)
      const r = fn()
      if (r && typeof r.then === 'function') await r
      await new Promise(r => setTimeout(r, 90)) // 收一下 setTimeout 里的日志
    } else {
      const body = code + '\n;return (async () => {\n' + problem.tests + '\n})();'
      const fn = new Function('T', body)
      await fn(T)
    }
  } catch (e) {
    results.push({ ok: false, name: '代码执行出错', msg: e.message })
  } finally {
    console.log = origLog
  }
  return { results, logs }
}

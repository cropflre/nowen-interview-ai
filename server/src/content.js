/**
 * 内容单一来源：直接复用前端的题库数据，避免两处维护。
 * 前端数据在 js-basics-vue/src/data/，这里相对引用。
 */
export { PROBLEMS } from '../../src/data/problems.js'
export { BAGUWEN } from '../../src/data/baguwen.js'
export { FLASHCARDS } from '../../src/data/flashcards.js'

/** 去掉标签后的纯文本（和前端 toPlain 保持一致的口径，用于生成选项/打字答案） */
export function plain(html) {
  let s = String(html || '')
  s = s.replace(/<li>/g, '\n• ').replace(/<\/li>/g, '')
  s = s.replace(/<\/p>/g, '\n').replace(/<br\s*\/?>/g, '\n')
  s = s.replace(/<[^>]+>/g, '')
  s = s
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
  return s.split('\n').map(l => l.replace(/[ \t]+/g, ' ').trim()).join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

/** 取首句（做选择题选项用），最长 max 字 */
export function firstClause(text, max = 46) {
  const t = String(text || '').replace(/\s+/g, ' ').trim()
  const cut = t.split(/[。；;.!?！？]/).filter(Boolean)[0] || t
  return cut.length > max ? cut.slice(0, max) + '…' : cut
}

/** 可复现的伪随机（seed 固定 → 每次 seed 结果一致） */
export function mulberry32(seed) {
  let a = seed >>> 0
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

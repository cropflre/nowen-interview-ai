/**
 * 无提示复现（白纸复现关）：把答案文本自动拆成「要点」，并对用户默写的文本判分。
 *
 * 设计取舍：
 *  - 不引入人工维护的要点库（110+ 题成本太高），改为从已有答案的纯文本里**自动抽要点**；
 *  - 匹配用「中文 2-gram 覆盖率」而不是精确字符串，容忍语序与措辞差异；
 *  - 口径与平台其它地方保持一致：**命中要点 ≠ 答得正确**，它只是一个可解释的近似信号。
 */

/** 参与比对时要忽略的标点/空白 */
const STRIP = /[\s，,。.、；;：:！!？?（）()【】\[\]「」『』《》<>"'`·—\-_~～/\\|+*]/g

function squish(s) {
  return String(s == null ? '' : s).replace(STRIP, '')
}

/** 字符级 2-gram 集合（中文判分的主力） */
function bigrams(s) {
  const t = squish(s)
  const out = new Set()
  for (let i = 0; i + 1 < t.length; i++) out.add(t.slice(i, i + 2))
  return out
}

/** 把一段话压成「要点短句」（尽量在停顿处截断） */
function shortPoint(s, max = 30) {
  let t = String(s || '')
    .replace(/^[•\-*·]\s*/, '')          // 项目符号
    .replace(/^\d{1,2}[.、)]\s+/, '')    // 列表序号（必须带分隔符，避免吃掉「8 种」这种开头的数字）
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[。；;]$/, '')
  if (t.length <= max) return t
  const cut = t.slice(0, max)
  const m = cut.match(/^[\s\S]*[，,、：:]/)
  const head = (m ? m[0] : cut).replace(/[，,、：:]$/, '')
  return (head || cut) + '…'
}

/**
 * 从纯文本答案里抽取要点（保持原文顺序，最多 max 条）。
 * @param {string} plainText 去标签后的答案纯文本
 * @param {number} max 最多几条要点
 */
export function derivePoints(plainText, max = 5) {
  const text = String(plainText || '').trim()
  if (!text) return []

  const raw = text
    .split(/\n+/)
    .flatMap(line => line.replace(/^[•\-*\s]+/, '').split(/(?<=[。；;!?！？])/))
    .map(s => s.trim())
    .filter(s => squish(s).length >= 6)

  const picked = []
  for (const s of raw) {
    const p = shortPoint(s)
    const key = squish(p)
    if (key.length < 4) continue
    // 与已选要点互相包含 → 视为重复，跳过
    const dup = picked.some(x => {
      const k = squish(x)
      return k.includes(key) || key.includes(k)
    })
    if (dup) continue
    picked.push(p)
    if (picked.length >= max) break
  }
  return picked
}

/**
 * 判分：逐要点算「用户文本覆盖了多少」，覆盖率 ≥ 阈值算命中。
 * @returns {{hits:number,total:number,score:number,typedLength:number,detail:Array}}
 */
export function scoreRecall(points, userText, coverageThreshold = 0.5) {
  const list = (Array.isArray(points) ? points : []).filter(Boolean)
  const u = bigrams(userText)

  const detail = list.map(p => {
    const b = bigrams(p)
    if (!b.size) return { text: p, hit: false, coverage: 0 }
    let hit = 0
    for (const g of b) if (u.has(g)) hit++
    const coverage = hit / b.size
    return { text: p, hit: coverage >= coverageThreshold, coverage: Math.round(coverage * 100) }
  })

  const hits = detail.filter(d => d.hit).length
  const total = list.length
  const score = total ? Math.round(hits / total * 100) : 0
  return { hits, total, score, typedLength: squish(userText).length, detail }
}

/** 复现及格线：达到即视为一次「有效的提取练习」，可推进记忆引擎档位 */
export const RECALL_PASS = 60

/** 用户默写上限（防止灌长文刷命中） */
export const RECALL_MAX_LEN = 1200

/* ================= 第三档：讲得清（费曼关） ================= */
/**
 * 「讲得清」考的不是能不能想起来，而是能不能**讲明白**。
 * 四维：
 *   1) 要点覆盖（60 分）—— 该讲的都讲到了
 *   2) 有没有打比方/举例子（20 分）—— 是真懂还是背台词的分水岭
 *   3) 篇幅够不够（20 分）—— 太短说明没展开
 *   4) 照抄检测 —— 与参考答案高度雷同 → 封顶 40 分（讲清楚 ≠ 抄一遍）
 */
export function scoreExplain({ points, userText, answerText, minLen = 60 }) {
  const text = String(userText || '')
  const list = (Array.isArray(points) ? points : []).filter(Boolean)
  const cov = scoreRecall(list, text)              // 复用同一套要点覆盖逻辑

  const u = bigrams(text)
  const ref = bigrams(answerText)
  let shared = 0
  for (const g of u) if (ref.has(g)) shared++
  const copyRate = u.size ? shared / u.size : 0    // 你写的话里有多少是原样来自参考答案

  const analogy = /比如|例如|好比|就像|好像|相当于|打个比方|类比|举个例子|类似/.test(text)
  const length = squish(text).length
  const longEnough = length >= minLen
  const copied = copyRate >= 0.75 && length >= minLen

  const coverScore = Math.round((cov.total ? cov.hits / cov.total : 0) * 60)
  let score = coverScore + (analogy ? 20 : 0) + (longEnough ? 20 : 0)
  if (copied) score = Math.min(score, 40)
  score = Math.max(0, Math.min(100, score))

  return {
    score,
    coverScore,
    coverage: cov.hits,
    total: cov.total,
    points: cov.detail,
    analogy,
    longEnough,
    length,
    copied,
    copyRate: Math.round(copyRate * 100),
    // 给前端的「还差什么」提示
    tips: [
      cov.total && cov.hits < cov.total ? `还有 ${cov.total - cov.hits} 个要点没讲到` : '',
      !analogy ? '试着打个比方或举个例子（真懂的人讲得出来）' : '',
      !longEnough ? `展开一点，至少 ${minLen} 字` : '',
      copied ? '太像照抄参考答案了——用自己的话重讲一遍' : ''
    ].filter(Boolean)
  }
}

/** 「讲得清」达标线（比复现更严：这是更高一档） */
export const TELL_PASS = 70

/** 讲清关的输入上限 */
export const EXPLAIN_MAX_LEN = 2000

/* ================= 第四档：用得上（场景题） ================= */
/**
 * 「用得上」考的是**选型与取舍**：给一个真实场景，你自己判断该用什么、为什么。
 * 判分：必答关键词命中 70 + 讲了理由 15 + 篇幅 15；
 *       若提到明确误区且关键词覆盖不足一半 → 封顶 45（选错了，理由再对也不算过）。
 */
export function scoreScene({ must, mustNot, userText, minLen = 60 }) {
  const raw = String(userText || '')
  const text = squish(raw)
  const list = (Array.isArray(must) ? must : []).filter(Boolean)

  const keywords = list.map(k => ({ key: k, hit: text.includes(squish(k)) }))
  const hits = keywords.filter(x => x.hit).length
  const total = keywords.length || 1
  const coverScore = Math.round(hits / total * 70)

  const reasoned = /因为|所以|原因|导致|避免|否则|这样一来|根本|从而|相比/.test(raw)
  const length = text.length
  const longEnough = length >= minLen

  const pitfalls = (Array.isArray(mustNot) ? mustNot : []).filter(k => text.includes(squish(k)))
  const capped = pitfalls.length > 0 && hits / total < 0.5

  let score = coverScore + (reasoned ? 15 : 0) + (longEnough ? 15 : 0)
  if (capped) score = Math.min(score, 45)
  score = Math.max(0, Math.min(100, score))

  return {
    score,
    coverScore,
    hits,
    total,
    keywords,
    reasoned,
    longEnough,
    length,
    pitfalls,
    capped,
    tips: [
      hits < total ? `还差 ${total - hits} 个关键点没提到` : '',
      !reasoned ? '补一句「为什么」——面试官最想听的是理由，不是名词堆砌' : '',
      !longEnough ? `展开一点，至少 ${minLen} 字` : '',
      capped ? `提到了「${pitfalls.join('、')}」，但这题主选不是它——取舍没说清` : ''
    ].filter(Boolean)
  }
}

/** 「用得上」达标线：比前两档更严——只堆名词不给理由（恰好 70）不算过 */
export const SCENE_PASS = 75

/** 场景关输入上限 */
export const SCENE_MAX_LEN = 2000

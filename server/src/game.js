/**
 * 游戏规则：星级 / XP / 等级 / 成就判定
 */

/** 分数 → 星级（60 过关，80 两星，95 三星） */
export function starsOf(score) {
  if (score >= 95) return 3
  if (score >= 80) return 2
  if (score >= 60) return 1
  return 0
}

/** 心魔试炼：错题本累计到多少题，自动召唤「心魔 BOSS」 */
export const NIGHTMARE_MIN = 5
/** 心魔通关奖励 XP */
export const NIGHTMARE_XP = 150

/**
 * XP = 基础 × 难度 × 星级系数 + 首通奖励
 * 挫败感控制：交卷即成长 —— 0 星也给「安慰 XP」（基础的 10%，至少 1 点）
 */
export function xpOf({ xpBase, difficulty, stars, firstClear }) {
  if (stars <= 0) return Math.max(1, Math.round(xpBase * 0.1))
  const base = xpBase * Math.max(1, difficulty) * (stars / 3)
  const bonus = firstClear ? Math.round(xpBase * 0.5) : 0
  return Math.round(base) + bonus
}

/** 等级：每级所需 XP 递增（1 级 0，2 级 100，3 级 250…） */
export function levelOf(xp) {
  let lv = 1
  let need = 100
  let acc = 0
  while (xp >= acc + need) {
    acc += need
    lv++
    need = Math.round(need * 1.6)
  }
  return { level: lv, current: xp - acc, need }
}

/** 预置成就（condition 供后续扩展判定） */
export const ACHIEVEMENTS = [
  { code: 'first_clear', title: '初出茅庐', desc: '首次通关任意关卡', xp_reward: 20, condition: { type: 'clears', gte: 1 } },
  { code: 'first_three', title: '完美主义', desc: '拿到第一个三星', xp_reward: 50, condition: { type: 'threeStars', gte: 1 } },
  { code: 'ten_three', title: '十全十美', desc: '拿到 10 个三星', xp_reward: 120, condition: { type: 'threeStars', gte: 10 } },
  { code: 'streak_3', title: '三连击', desc: '连续 3 天练习', xp_reward: 60, condition: { type: 'streakDays', gte: 3 } },
  { code: 'streak_7', title: '风雨无阻', desc: '连续 7 天练习', xp_reward: 200, condition: { type: 'streakDays', gte: 7 } },
  { code: 'wrong_clear_10', title: '知错能改', desc: '错题本清空 10 题', xp_reward: 80, condition: { type: 'wrongCleared', gte: 10 } },
  { code: 'nightmare_clear', title: '温故知新', desc: '完成一次「心魔试炼」', xp_reward: 150, condition: { type: 'nightmareClear', gte: 1 } },
  { code: 'nightmare_perfect', title: '斩心魔', desc: '心魔试炼全对', xp_reward: 200, condition: { type: 'nightmarePerfect', gte: 1 } }
]

/** 每日任务（跨日自动重置 —— 按 date 查，不删数据） */
export const DAILY_TASKS = [
  { code: 'daily_first', title: '每日首战', desc: '今天完成任意一关', xp: 10 },
  { code: 'daily_three', title: '每日三星', desc: '今天拿到一次 3★', xp: 20 },
  { code: 'daily_nightmare', title: '每日斩心魔', desc: '今天通过一次心魔试炼', xp: 50 }
]

/**
 * XP 权重衰减：单题耗时极短的关卡（闪卡/背诵）做系数衰减，
 * 避免高频刷这类关卡在周榜里异常套利。
 */
export const XP_WEIGHT = { flash: 0.35, recite: 0.5 }

/** 本周一（自然周：周一 00:00 起算），返回 YYYY-MM-DD */
export function mondayOf(d = new Date()) {
  const x = new Date(d)
  const day = (x.getDay() + 6) % 7          // 周一 = 0
  x.setDate(x.getDate() - day)
  const p = n => String(n).padStart(2, '0')
  return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())}`
}

/* ================= 记忆引擎（R1a） ================= */
/** 复习档位（天）：答对进档、答错回第 1 档。初始规则，后续可换 FSRS */
export const REVIEW_INTERVALS = [1, 3, 7, 14, 30]
/** 每天最多新学多少题（防止一次灌太多） */
export const DAILY_NEW_LIMIT = 8
/** 复习状态文案（与 state 整数对应） */
export const REVIEW_STATES = {
  1: '初步理解',
  2: '短期记住',
  3: '待巩固',
  4: '稳定掌握'
}

/** 由 interval_idx 推出掌握状态 */
export function reviewStateOf(idx) {
  if (idx >= REVIEW_INTERVALS.length - 1) return 4   // 到最后一档 → 稳定掌握
  if (idx >= 3) return 3                             // 7 天档 → 待巩固
  if (idx >= 1) return 2                             // 3 天档 → 短期记住
  return 1                                           // 1 天档 → 初步理解
}

/**
 * 计算下一次复习安排。
 * 规则：先看客观对错，再用自评微调（自评不能推翻客观错误）。
 *   forgot → 回第 1 档；hard → 退一档；good → 进一档；
 *   easy → 进两档，但**仅当答对且自评覆盖了关键点**，否则按 good 处理。
 */
export function nextSchedule({ correct, selfRating, covered, intervalIdx }) {
  const MAX = REVIEW_INTERVALS.length - 1
  const prev = Math.max(0, Math.min(MAX, intervalIdx | 0))
  if (!correct) {
    return { intervalIdx: 0, okStreak: 0, lapsed: true }
  }
  let idx
  switch (selfRating) {
    case 'forgot': idx = 0; break
    case 'hard': idx = Math.max(0, prev - 1); break
    case 'easy': idx = (covered ? prev + 2 : prev + 1); break
    default: idx = prev + 1            // good / 未填
  }
  idx = Math.max(0, Math.min(MAX, idx))
  return { intervalIdx: idx, okStreak: 1, lapsed: false }
}

/** 日期字符串平移 n 天（YYYY-MM-DD） */
export function shiftDate(dstr, days) {
  const d = new Date(dstr + 'T00:00:00')
  d.setDate(d.getDate() + days)
  const p = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** 反刷榜：手写/打字关满分但耗时过短，判定为异常 */
export function isTooFastToBeTrue(score, durationMs) {
  return score >= 100 && Number(durationMs || 0) < 2000
}

/** 今天（本地日期串） */
export function today() {
  const d = new Date()
  const p = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** 连续天数：昨天玩过 +1，今天已玩过不变，否则重置为 1 */
export function nextStreak(lastPlayDate, streakDays) {
  const t = today()
  if (lastPlayDate === t) return streakDays
  const y = new Date(Date.now() - 86400000)
  const p = n => String(n).padStart(2, '0')
  const ymd = `${y.getFullYear()}-${p(y.getMonth() + 1)}-${p(y.getDate())}`
  return lastPlayDate === ymd ? streakDays + 1 : 1
}

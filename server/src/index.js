/**
 * 《前端修炼·闯关》后端：Hono + node:sqlite
 * 启动：npm run dev   （默认 http://localhost:5181）
 */
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serve } from '@hono/node-server'
import { db, initSchema } from './db.js'
import {
  starsOf, xpOf, levelOf, today, nextStreak,
  NIGHTMARE_MIN, NIGHTMARE_XP, DAILY_TASKS, isTooFastToBeTrue, XP_WEIGHT, mondayOf, shiftDate,
  REVIEW_INTERVALS, DAILY_NEW_LIMIT, REVIEW_STATES, reviewStateOf, nextSchedule
} from './game.js'
import { gradeTyping, gradeCode, SERVER_EXEC_ENABLED } from './judge.js'
import { PROBLEMS, plain } from './content.js'
import { derivePoints, scoreRecall, RECALL_PASS, RECALL_MAX_LEN, scoreExplain, TELL_PASS, EXPLAIN_MAX_LEN, scoreScene, SCENE_PASS, SCENE_MAX_LEN } from './recall.js'
import { SCENES, SCENE_BY_CODE, FOLLOWUPS } from './scenes.js'

initSchema()

// 一次性回填：历史总 XP 记为今天所得，避免周榜首日空白
{
  const n = db.prepare('SELECT COUNT(*) n FROM xp_log').get().n
  if (n === 0) {
    const us = db.prepare('SELECT id, xp FROM users WHERE xp > 0').all()
    const ins = db.prepare('INSERT INTO xp_log (user_id,date,amount,source) VALUES (?,?,?,?)')
    for (const x of us) ins.run(x.id, today(), x.xp, 'migrate')
    if (us.length) console.log('[migrate] 回填历史 XP →', us.length, '个用户')
  }
}

// 一次性回填：老库的题目没生成过「复现要点」时，从答案文本补上（幂等，只补空着的）
{
  const rows = db.prepare('SELECT id, explain, points FROM questions').all()
  const upd = db.prepare('UPDATE questions SET points=? WHERE id=?')
  let filled = 0
  for (const r of rows) {
    let cur = []
    try { cur = JSON.parse(r.points || '[]') } catch (e) { cur = [] }
    if (Array.isArray(cur) && cur.length) continue
    const pts = derivePoints(plain(r.explain))
    if (!pts.length) continue
    upd.run(JSON.stringify(pts), r.id)
    filled++
  }
  if (filled) console.log('[migrate] 回填复现要点 →', filled, '题')
}

// 启动时先补一次上周结算（之后由请求按需触发）
settleWeeks()

const app = new Hono()
app.use('*', cors())

const ok = (data) => ({ ok: true, data })
const fail = (msg, code = 400) => ({ ok: false, error: msg, code })
const clampScore = v => Math.max(0, Math.min(100, Math.round(Number(v) || 0)))

/* ---------------- 工具 ---------------- */
function userById(id) {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(Number(id))
}
/** 简易鉴权：Authorization: Bearer u_<id> 或 ?userId=<id> */
function currentUser(c) {
  const auth = c.req.header('authorization') || ''
  const m = auth.match(/^Bearer\s+u_(\d+)$/)
  if (m) return userById(m[1])
  const q = c.req.query('userId')
  if (q) return userById(q)
  return undefined
}
function bestStars(userId, levelId) {
  const r = db.prepare('SELECT MAX(stars) AS s, MAX(score) AS sc FROM attempts WHERE user_id=? AND level_id=?')
    .get(userId, levelId)
  return { stars: r.s || 0, score: r.sc || 0 }
}

/**
 * 服务端判分（防作弊核心）：quiz/boss 按答案下标校验，recite 按自评（1=我会）
 * 返回 score(=正确率) / accuracy / 逐题明细
 */
function gradeLevel(level, answers) {
  const rows = db.prepare(
    `SELECT lq.question_id AS qid, q.answer AS ans
     FROM level_questions lq JOIN questions q ON q.id = lq.question_id
     WHERE lq.level_id = ?`
  ).all(level.id)
  const key = new Map(rows.map(r => [r.qid, r.ans]))
  const list = Array.isArray(answers) ? answers : []
  let correct = 0
  const detail = []
  for (const a of list) {
    const qid = Number(a && (a.qId ?? a.questionId))
    if (!key.has(qid)) continue
    const ok = level.type === 'recite'
      ? Number(a.choice) === 1                       // 自评：1=我会
      : Number(a.choice) === key.get(qid)
    if (ok) correct++
    detail.push({ questionId: qid, choice: Number(a.choice), correct: ok, answer: key.get(qid) })
  }
  const total = rows.length || 1
  const accuracy = Math.round(correct / total * 100)   // 按总题数算，漏答不得分
  return { total, correct, accuracy, score: accuracy, detail }
}

/** 统一发 XP：写账本 + 更新用户总经验（周榜靠账本按 date 聚合） */
function addXp(userId, amount, source = '') {
  if (!amount) return
  db.prepare('INSERT INTO xp_log (user_id,date,amount,source) VALUES (?,?,?,?)')
    .run(userId, today(), Math.round(amount), source)
  db.prepare('UPDATE users SET xp = xp + ? WHERE id = ?').run(Math.round(amount), userId)
}

/** 每日任务：当日一次性发奖（跨日按 date 自然重置） */
function awardDaily(userId, codes) {
  const d = today()
  const has = db.prepare('SELECT done FROM user_daily WHERE user_id=? AND date=? AND code=?')
  const ins = db.prepare(`INSERT INTO user_daily (user_id,date,code,done) VALUES (?,?,?,1)
    ON CONFLICT(user_id,date,code) DO UPDATE SET done=1, updated_at=datetime('now')`)
  const doneTasks = []
  let xp = 0
  for (const code of codes) {
    const t = DAILY_TASKS.find(x => x.code === code)
    if (!t) continue
    const cur = has.get(userId, d, code)
    if (cur && cur.done) continue
    ins.run(userId, d, code)
    xp += t.xp
    doneTasks.push({ code: t.code, title: t.title, xp: t.xp })
  }
  if (xp > 0) addXp(userId, xp, 'daily')
  return { done: doneTasks, xp }
}

/** 今日任务状态 */
function dailyStatus(userId) {
  const d = today()
  const rows = db.prepare('SELECT code, done FROM user_daily WHERE user_id=? AND date=?').all(userId, d)
  const map = new Map(rows.map(r => [r.code, r.done]))
  return { date: d, tasks: DAILY_TASKS.map(t => ({ ...t, done: !!map.get(t.code) })) }
}

/**
 * 周榜结算（按需触发，零依赖、不怕重启）：
 * 任何请求进来时检查「上周是否已结算」，没有就结算一次：
 *   ① 落快照到 week_settlements  ② 给参与者发站内通知（前三名单独恭喜）
 * 没有后台定时器，靠请求驱动 + 落库保证幂等。
 */
function settleWeeks() {
  const thisMonday = mondayOf()
  const prevMonday = shiftDate(thisMonday, -7)
  const done = db.prepare('SELECT 1 FROM week_settlements WHERE week_start = ?').get(prevMonday)
  if (done) return

  const rows = db.prepare(`
    SELECT u.id, u.name, COALESCE(SUM(l.amount), 0) AS score
    FROM users u
    LEFT JOIN xp_log l ON l.user_id = u.id AND l.date >= ? AND l.date < ?
    GROUP BY u.id
    HAVING score > 0
    ORDER BY score DESC, u.id ASC
    LIMIT 10`).all(prevMonday, thisMonday)

  const weekEnd = shiftDate(thisMonday, -1)
  const top = rows.slice(0, 3).map((r, i) => ({ rank: i + 1, id: r.id, name: r.name, score: r.score }))
  db.prepare('INSERT INTO week_settlements (week_start, week_end, top_json, players) VALUES (?,?,?,?)')
    .run(prevMonday, weekEnd, JSON.stringify(top), rows.length)
  if (!rows.length) return

  const ins = db.prepare('INSERT INTO notifications (user_id,type,title,body,payload) VALUES (?,?,?,?,?)')
  const champion = rows[0]
  rows.forEach((r, i) => {
    const rank = i + 1
    if (rank <= 3) {
      ins.run(r.id, 'weekly_top', `🏆 上周周榜第 ${rank} 名`,
        `你上周拿到 ${r.score} XP，位列第 ${rank} 名。新的一周已经开始，继续冲榜！`,
        JSON.stringify({ rank, score: r.score, week: prevMonday }))
    } else {
      ins.run(r.id, 'weekly_done', '📅 上周周榜已结算',
        `上周冠军是「${champion.name}」，拿下 ${champion.score} XP。新的一周已开始，冲榜吧！`,
        JSON.stringify({ champion: champion.name, score: champion.score, week: prevMonday }))
    }
  })
  console.log(`[weekly] 已结算 ${prevMonday} ~ ${weekEnd}，参与者 ${rows.length} 人`)
}

/* ================= 记忆引擎（R1a） ================= */

/** 关卡作答时「播种」复习条目：首次接触建立条目；答错则重置档位（关卡=首次学习，复习=提取练习） */
function ensureReviewItem(userId, questionId, correct) {
  const row = db.prepare('SELECT interval_idx FROM review_items WHERE user_id=? AND question_id=?').get(userId, questionId)
  const tomorrow = shiftDate(today(), 1)
  if (!row) {
    db.prepare(`INSERT INTO review_items (user_id,question_id,state,interval_idx,due_date,ok_streak,lapses,reviews)
      VALUES (?,?,?,0,?,0,0,0)`).run(userId, questionId, correct ? 2 : 1, tomorrow)
  } else if (!correct) {
    db.prepare(`UPDATE review_items SET state=1, interval_idx=0, ok_streak=0, lapses=lapses+1, due_date=?
      WHERE user_id=? AND question_id=?`).run(tomorrow, userId, questionId)
  }
}

/** 今日复习队列：到期的 + 新学的 */
app.get('/api/review/today', (c) => {
  const u = currentUser(c)
  if (!u) return c.json(fail('未登录', 401), 401)
  const d = today()
  const due = db.prepare(`
    SELECT q.id, q.stem, q.category, q.star, q.options,
           r.state, r.interval_idx, r.lapses, r.reviews, r.due_date, r.last_review_at
    FROM review_items r JOIN questions q ON q.id = r.question_id
    WHERE r.user_id = ? AND r.due_date <= ?
    ORDER BY r.due_date ASC, r.lapses DESC, q.id ASC
    LIMIT 30`).all(u.id, d)

  const fresh = db.prepare(`
    SELECT q.id, q.stem, q.category, q.star, q.options
    FROM questions q
    WHERE q.id NOT IN (SELECT question_id FROM review_items WHERE user_id = ?)
    ORDER BY q.id ASC LIMIT ?`).all(u.id, DAILY_NEW_LIMIT)

  const pack = (r, kind) => ({
    id: r.id, stem: r.stem, category: r.category, star: r.star,
    options: JSON.parse(r.options || '[]'), kind,
    state: r.state, stateText: REVIEW_STATES[r.state] || '', intervalIdx: r.interval_idx,
    lapses: r.lapses, reviews: r.reviews, dueDate: r.due_date
  })

  return c.json(ok({
    date: d,
    dueCount: due.length,
    newCount: fresh.length,
    items: [...due.map(r => pack(r, 'due')), ...fresh.map(r => pack(r, 'new'))]
  }))
})

/** 只判分、不改状态（供「先作答、后揭晓」第一步用） */
app.post('/api/review/:qid/grade', (c) => {
  const u = currentUser(c)
  if (!u) return c.json(fail('未登录', 401), 401)
  return c.req.json().catch(() => ({})).then(body => {
    const q = db.prepare('SELECT * FROM questions WHERE id = ?').get(Number(c.req.param('qid')))
    if (!q) return c.json(fail('题目不存在', 404), 404)
    return c.json(ok({
      correct: Number(body.choice) === q.answer,
      answer: q.answer,
      options: JSON.parse(q.options || '[]'),
      explain: q.explain
    }))
  })
})

/** 提交一次提取练习（主动回忆）：服务端判分 + 调度下一次 */
app.post('/api/review/:qid/answer', async (c) => {
  const u = currentUser(c)
  if (!u) return c.json(fail('未登录', 401), 401)
  const qid = Number(c.req.param('qid'))
  const q = db.prepare('SELECT * FROM questions WHERE id = ?').get(qid)
  if (!q) return c.json(fail('题目不存在', 404), 404)

  const body = await c.req.json().catch(() => ({}))
  const correct = Number(body.choice) === q.answer
  const selfRating = ['forgot', 'hard', 'good', 'easy'].includes(body.selfRating) ? body.selfRating : ''
  const covered = body.covered !== false

  const row = db.prepare('SELECT * FROM review_items WHERE user_id=? AND question_id=?').get(u.id, qid)
  const prevIdx = row ? row.interval_idx : 0
  const lastReview = row && row.last_review_at
  const delayed = !!lastReview && lastReview < today()      // 距上次提取 ≥1 天 → 计入延迟复测
  const sch = nextSchedule({ correct, selfRating, covered, intervalIdx: prevIdx })
  const days = REVIEW_INTERVALS[sch.intervalIdx]
  const dueDate = shiftDate(today(), days)
  const state = reviewStateOf(sch.intervalIdx)

  if (row) {
    db.prepare(`UPDATE review_items
      SET state=?, interval_idx=?, due_date=?, ok_streak=?, lapses=?, reviews=reviews+1, last_review_at=?
      WHERE user_id=? AND question_id=?`).run(
      state, sch.intervalIdx, dueDate,
      correct ? row.ok_streak + 1 : 0,
      correct ? row.lapses : row.lapses + 1,
      today(), u.id, qid)
  } else {
    db.prepare(`INSERT INTO review_items
      (user_id,question_id,state,interval_idx,due_date,ok_streak,lapses,reviews,last_review_at)
      VALUES (?,?,?,?,?,?,?,1,?)`).run(
      u.id, qid, state, sch.intervalIdx, dueDate, correct ? 1 : 0, correct ? 0 : 1, today())
  }

  db.prepare(`INSERT INTO review_logs (user_id,question_id,result,self_rating,covered,delayed,interval_days)
    VALUES (?,?,?,?,?,?,?)`).run(u.id, qid, correct ? 1 : 0, selfRating, covered ? 1 : 0, delayed ? 1 : 0, days)

  // 复习激励：答对 +2 XP（复习本身受到期日限制，天然防刷）
  if (correct) addXp(u.id, 2, 'review')

  const after = userById(u.id)
  const lv = levelOf(after.xp)
  db.prepare('UPDATE users SET level=? WHERE id=?').run(lv.level, u.id)

  return c.json(ok({
    correct, delayed, covered,
    answer: q.answer, options: JSON.parse(q.options || '[]'), explain: q.explain,
    next: { state, stateText: REVIEW_STATES[state], intervalIdx: sch.intervalIdx, intervalDays: days, dueDate },
    lapsed: sch.lapsed,
    gainedXp: correct ? 2 : 0,
    user: { xp: after.xp, level: lv.level }
  }))
})

/** 记忆看板 */
app.get('/api/review/stats', (c) => {
  const u = currentUser(c)
  if (!u) return c.json(fail('未登录', 401), 401)
  const d = today()

  const dist = db.prepare('SELECT state, COUNT(*) n FROM review_items WHERE user_id=? GROUP BY state').all(u.id)
  const total = dist.reduce((s, r) => s + r.n, 0)
  const stable = (dist.find(r => r.state === 4) || {}).n || 0
  const dueToday = db.prepare('SELECT COUNT(*) n FROM review_items WHERE user_id=? AND due_date<=?').get(u.id, d).n
  const overdue = db.prepare('SELECT COUNT(*) n FROM review_items WHERE user_id=? AND due_date<?').get(u.id, d).n

  // 延迟复测正确率（核心指标）：只统计「距上次提取 ≥1 天」的作答
  const dl = db.prepare('SELECT result, COUNT(*) n FROM review_logs WHERE user_id=? AND delayed=1 GROUP BY result').all(u.id)
  const dTotal = dl.reduce((s, r) => s + r.n, 0)
  const dCorrect = (dl.find(r => r.result === 1) || {}).n || 0

  const forgotten7d = db.prepare(`SELECT COUNT(*) n FROM review_logs WHERE user_id=? AND result=0 AND at >= datetime('now','-7 day')`).get(u.id).n
  const last14 = db.prepare(`SELECT substr(at,1,10) AS date, COUNT(*) AS value FROM review_logs WHERE user_id=?
    GROUP BY date ORDER BY date DESC LIMIT 14`).all(u.id)

  return c.json(ok({
    total,
    stable,
    dueToday,
    overdue,
    delayedRate: dTotal ? Math.round(dCorrect / dTotal * 100) : null,
    delayedSample: dTotal,
    forgotten7d,
    dist: [1, 2, 3, 4].map(s => ({
      state: s, text: REVIEW_STATES[s], n: (dist.find(r => r.state === s) || {}).n || 0
    })),
    trend: last14
  }))
})

/* ================= 无提示复现（白纸复现关） ================= */
/**
 * 掌握分档（P0 先落地前两档）：
 *   1 认得   —— 有过答对记录（看到选项能认出来）
 *   2 说得出 —— 无提示复现拿到及格分（什么都不给也能写出来）
 *   3 讲得清 / 4 用得上 —— 见方案，属后续迭代（费曼关 / 场景题）
 */
function masteryOf(userId) {
  const known = new Set(
    db.prepare('SELECT DISTINCT question_id qid FROM review_logs WHERE user_id=? AND result=1')
      .all(userId).map(r => r.qid)
  )
  const say = new Map(
    db.prepare("SELECT question_id qid, MAX(score) s FROM recall_attempts WHERE user_id=? AND mode='recall' GROUP BY question_id")
      .all(userId).map(r => [r.qid, r.s])
  )
  const tell = new Map(
    db.prepare("SELECT question_id qid, MAX(score) s FROM recall_attempts WHERE user_id=? AND mode='explain' GROUP BY question_id")
      .all(userId).map(r => [r.qid, r.s])
  )
  return { known, say, tell }
}

/** 今日复现队列：到期复习 → 错题 → 其余。**刻意不下发要点与答案** */
app.get('/api/recall/queue', (c) => {
  const u = currentUser(c)
  if (!u) return c.json(fail('未登录', 401), 401)
  const d = today()
  const LIMIT = 10

  const due = db.prepare(`
    SELECT q.id, q.stem, q.category, q.star, q.points, r.due_date, r.lapses, r.reviews
    FROM review_items r JOIN questions q ON q.id = r.question_id
    WHERE r.user_id = ? AND r.due_date <= ?
    ORDER BY r.due_date ASC, r.lapses DESC, q.id ASC
    LIMIT ?`).all(u.id, d, LIMIT)

  const wrong = db.prepare(`
    SELECT q.id, q.stem, q.category, q.star, q.points, w.wrong_count
    FROM wrong_book w JOIN questions q ON q.id = w.question_id
    WHERE w.user_id = ? AND q.id NOT IN (SELECT question_id FROM review_items WHERE user_id = ?)
    ORDER BY w.wrong_count DESC, w.last_wrong_at DESC
    LIMIT ?`).all(u.id, u.id, LIMIT)

  const fresh = db.prepare(`
    SELECT q.id, q.stem, q.category, q.star, q.points
    FROM questions q
    WHERE q.id NOT IN (SELECT question_id FROM recall_attempts WHERE user_id = ?)
    ORDER BY q.id ASC
    LIMIT ?`).all(u.id, LIMIT)

  const seen = new Set([...due, ...wrong].map(r => r.id))
  const pointCount = r => { try { return JSON.parse(r.points || '[]').length } catch (e) { return 0 } }
  const pack = (r, kind, extra = {}) => ({
    id: r.id, stem: r.stem, category: r.category, star: r.star, kind, pointCount: pointCount(r), ...extra
  })

  const items = [
    ...due.map(r => pack(r, 'due', { dueDate: r.due_date, lapses: r.lapses, reviews: r.reviews })),
    ...wrong.map(r => pack(r, 'wrong', { wrongCount: r.wrong_count })),
    ...fresh.filter(r => !seen.has(r.id)).map(r => pack(r, 'fresh'))
  ].slice(0, LIMIT)

  const { say } = masteryOf(u.id)
  return c.json(ok({
    date: d,
    dueCount: due.length,
    items,
    passedBefore: items.filter(i => (say.get(i.id) || 0) >= RECALL_PASS).length
  }))
})

/** 提交一次无提示复现：服务端算要点命中 → 揭晓答案 → 推进记忆引擎 */
app.post('/api/recall/:qid/submit', async (c) => {
  const u = currentUser(c)
  if (!u) return c.json(fail('未登录', 401), 401)
  const qid = Number(c.req.param('qid'))
  const q = db.prepare('SELECT * FROM questions WHERE id = ?').get(qid)
  if (!q) return c.json(fail('题目不存在', 404), 404)

  const body = await c.req.json().catch(() => ({}))
  const text = String(body.text || '').slice(0, RECALL_MAX_LEN)
  const durationMs = Math.max(0, Math.min(30 * 60 * 1000, Math.round(Number(body.durationMs) || 0)))

  // 要点：优先用库里缓存的；缺失则现算并回写
  let points = []
  try { points = JSON.parse(q.points || '[]') } catch (e) { points = [] }
  if (!Array.isArray(points) || !points.length) {
    points = derivePoints(plain(q.explain))
    if (points.length) db.prepare('UPDATE questions SET points=? WHERE id=?').run(JSON.stringify(points), qid)
  }

  const res = scoreRecall(points, text)
  const pass = res.score >= RECALL_PASS

  db.prepare(`INSERT INTO recall_attempts (user_id,question_id,score,hits,total,typed_len,duration_ms,detail)
    VALUES (?,?,?,?,?,?,?,?)`).run(
    u.id, qid, res.score, res.hits, res.total, res.typedLength, durationMs,
    JSON.stringify(res.detail.map(d => ({ t: d.text, h: d.hit ? 1 : 0 }))))

  // 接记忆引擎：复现及格 = 一次有效的提取练习 → 推进档位；不及格回第 1 档
  const row = db.prepare('SELECT * FROM review_items WHERE user_id=? AND question_id=?').get(u.id, qid)
  const prevIdx = row ? row.interval_idx : 0
  const selfRating = res.score >= 85 ? 'easy' : (pass ? 'good' : 'forgot')
  const sch = nextSchedule({ correct: pass, selfRating, covered: pass, intervalIdx: prevIdx })
  const days = REVIEW_INTERVALS[sch.intervalIdx]
  const dueDate = shiftDate(today(), days)
  const state = reviewStateOf(sch.intervalIdx)

  if (row) {
    db.prepare(`UPDATE review_items
      SET state=?, interval_idx=?, due_date=?, ok_streak=?, lapses=?, reviews=reviews+1, last_review_at=?
      WHERE user_id=? AND question_id=?`).run(
      state, sch.intervalIdx, dueDate,
      pass ? row.ok_streak + 1 : 0,
      pass ? row.lapses : row.lapses + 1,
      today(), u.id, qid)
  } else {
    db.prepare(`INSERT INTO review_items
      (user_id,question_id,state,interval_idx,due_date,ok_streak,lapses,reviews,last_review_at)
      VALUES (?,?,?,?,?,?,?,1,?)`).run(
      u.id, qid, state, sch.intervalIdx, dueDate, pass ? 1 : 0, pass ? 0 : 1, today())
  }

  const lastReview = row && row.last_review_at
  const delayed = !!lastReview && lastReview < today()
  db.prepare(`INSERT INTO review_logs (user_id,question_id,result,self_rating,covered,delayed,interval_days)
    VALUES (?,?,?,?,?,?,?)`).run(u.id, qid, pass ? 1 : 0, selfRating, pass ? 1 : 0, delayed ? 1 : 0, days)

  // 激励：按命中要点数给 XP（复现队列每天限量，天然防刷）
  const gained = Math.min(10, res.hits)
  if (gained) addXp(u.id, gained, 'recall')

  const after = userById(u.id)
  const lv = levelOf(after.xp)
  db.prepare('UPDATE users SET level=? WHERE id=?').run(lv.level, u.id)

  return c.json(ok({
    score: res.score,
    hits: res.hits,
    total: res.total,
    pass,
    passLine: RECALL_PASS,
    typedLength: res.typedLength,
    points: res.detail,               // 逐要点：{ text, hit, coverage }
    answerText: plain(q.explain),     // 参考答案（提交后才揭晓）
    answerHtml: q.explain,
    stem: q.stem,
    category: q.category,
    next: { state, stateText: REVIEW_STATES[state], intervalIdx: sch.intervalIdx, intervalDays: days, dueDate },
    delayed,
    gainedXp: gained,
    user: { xp: after.xp, level: lv.level }
  }))
})

/** 提取训练看板：无提示复现率 + 讲清达标率 + 四档分布 + 趋势 + 薄弱分类 */
app.get('/api/recall/stats', (c) => {
  const u = currentUser(c)
  if (!u) return c.json(fail('未登录', 401), 401)

  // ---- 第二档：白纸复现 ----
  const agg = db.prepare("SELECT COUNT(*) n, AVG(score) avg, MAX(score) best FROM recall_attempts WHERE user_id=? AND mode='recall'").get(u.id)
  const passRow = db.prepare("SELECT COUNT(*) n FROM recall_attempts WHERE user_id=? AND mode='recall' AND score>=?").get(u.id, RECALL_PASS)
  const serious = db.prepare("SELECT COUNT(*) n FROM recall_attempts WHERE user_id=? AND mode='recall' AND typed_len>=20").get(u.id).n

  // ---- 第三档：讲得清 ----
  const exAgg = db.prepare("SELECT COUNT(*) n, AVG(score) avg, MAX(score) best FROM recall_attempts WHERE user_id=? AND mode='explain'").get(u.id)
  const exPass = db.prepare("SELECT COUNT(*) n FROM recall_attempts WHERE user_id=? AND mode='explain' AND score>=?").get(u.id, TELL_PASS).n

  const { known, say, tell } = masteryOf(u.id)
  const sayCount = [...say.values()].filter(s => s >= RECALL_PASS).length
  const tellCount = [...tell.values()].filter(s => s >= TELL_PASS).length

  const last14 = db.prepare(`
    SELECT substr(at,1,10) AS date, COUNT(*) AS tries, ROUND(AVG(score)) AS avg
    FROM recall_attempts WHERE user_id=? AND mode='recall'
    GROUP BY date ORDER BY date DESC LIMIT 14`).all(u.id)

  const weak = db.prepare(`
    SELECT q.category AS category, COUNT(*) AS n, ROUND(AVG(a.score)) AS avg
    FROM recall_attempts a JOIN questions q ON q.id = a.question_id
    WHERE a.user_id=? AND a.mode='recall'
    GROUP BY q.category ORDER BY avg ASC LIMIT 6`).all(u.id)

  // ---- 第四档：用得上（场景题，含项目深挖）----
  const scAgg = db.prepare('SELECT COUNT(*) n, AVG(score) avg, MAX(score) best FROM scene_attempts WHERE user_id=?').get(u.id)
  const scPass = db.prepare('SELECT COUNT(*) n FROM scene_attempts WHERE user_id=? AND score>=?').get(u.id, SCENE_PASS).n
  const passedRows = db.prepare('SELECT scene_code code, MAX(score) s FROM scene_attempts WHERE user_id=? GROUP BY scene_code HAVING s>=?')
    .all(u.id, SCENE_PASS)
  const projectCodeSet = new Set(SCENES.filter(s => s.kind === 'project').map(s => s.code))
  const projectPassed = passedRows.filter(r => projectCodeSet.has(r.code)).length
  const sceneTotal = SCENES.filter(s => s.kind !== 'project').length
  const projectTotal = projectCodeSet.size

  return c.json(ok({
    attempts: agg.n,
    recallRate: agg.n ? Math.round(passRow.n / agg.n * 100) : null,  // 北极星：无提示复现率
    avgScore: agg.n ? Math.round(agg.avg) : null,
    bestScore: agg.best || 0,
    serious,
    explain: {
      attempts: exAgg.n,
      rate: exAgg.n ? Math.round(exPass / exAgg.n * 100) : null,
      avgScore: exAgg.n ? Math.round(exAgg.avg) : null,
      bestScore: exAgg.best || 0,
      passLine: TELL_PASS
    },
    scene: {
      attempts: scAgg.n,
      rate: scAgg.n ? Math.round(scPass / scAgg.n * 100) : null,
      avgScore: scAgg.n ? Math.round(scAgg.avg) : null,
      bestScore: scAgg.best || 0,
      passed: passedRows.length,
      total: SCENES.length,
      passLine: SCENE_PASS,
      general: { passed: passedRows.length - projectPassed, total: sceneTotal },
      project: { passed: projectPassed, total: projectTotal }
    },
    mastery: {
      known: known.size,
      say: sayCount,
      tell: tellCount,
      scene: passedRows.length,
      project: projectPassed,
      total: db.prepare('SELECT COUNT(*) n FROM questions').get().n
    },
    trend: last14,
    weakCategories: weak
  }))
})

/* --------- 第三档：讲得清（费曼关） --------- */

/** 讲清队列：**只收复现已达标的题**——阶梯式，先说得出，再讲得清 */
app.get('/api/recall/explain/queue', (c) => {
  const u = currentUser(c)
  if (!u) return c.json(fail('未登录', 401), 401)
  const LIMIT = 8

  const rows = db.prepare(`
    SELECT q.id, q.stem, q.category, q.star, q.points,
           MAX(a.score) AS recall_best,
           (SELECT MAX(e.score) FROM recall_attempts e
             WHERE e.user_id = a.user_id AND e.question_id = q.id AND e.mode = 'explain') AS explain_best
    FROM recall_attempts a JOIN questions q ON q.id = a.question_id
    WHERE a.user_id = ? AND a.mode = 'recall'
    GROUP BY q.id
    HAVING recall_best >= ? AND (explain_best IS NULL OR explain_best < ?)
    ORDER BY (explain_best IS NULL) DESC, recall_best ASC, q.id ASC
    LIMIT ?`).all(u.id, RECALL_PASS, TELL_PASS, LIMIT)

  const items = rows.map(r => {
    let points = []
    try { points = JSON.parse(r.points || '[]') } catch (e) { points = [] }
    return {
      id: r.id, stem: r.stem, category: r.category, star: r.star,
      recallBest: r.recall_best,
      explainBest: r.explain_best,
      points          // 讲清关**给出要点**：考表达，不考回忆
    }
  })

  const waiting = db.prepare(`
    SELECT COUNT(DISTINCT question_id) n FROM recall_attempts
    WHERE user_id=? AND mode='recall' AND score>=?`).get(u.id, RECALL_PASS).n

  return c.json(ok({ items, waiting, passLine: TELL_PASS }))
})

/** 提交一次「讲清」：四维判分（要点 60 + 比喻 20 + 篇幅 20，照抄封顶） */
app.post('/api/recall/:qid/explain', async (c) => {
  const u = currentUser(c)
  if (!u) return c.json(fail('未登录', 401), 401)
  const qid = Number(c.req.param('qid'))
  const q = db.prepare('SELECT * FROM questions WHERE id = ?').get(qid)
  if (!q) return c.json(fail('题目不存在', 404), 404)

  const body = await c.req.json().catch(() => ({}))
  const text = String(body.text || '').slice(0, EXPLAIN_MAX_LEN)
  const durationMs = Math.max(0, Math.min(60 * 60 * 1000, Math.round(Number(body.durationMs) || 0)))

  let points = []
  try { points = JSON.parse(q.points || '[]') } catch (e) { points = [] }
  if (!Array.isArray(points) || !points.length) {
    points = derivePoints(plain(q.explain))
    if (points.length) db.prepare('UPDATE questions SET points=? WHERE id=?').run(JSON.stringify(points), qid)
  }

  const answerText = plain(q.explain)
  const res = scoreExplain({ points, userText: text, answerText })
  const pass = res.score >= TELL_PASS

  db.prepare(`INSERT INTO recall_attempts (user_id,question_id,mode,score,hits,total,typed_len,duration_ms,detail)
    VALUES (?,?,?,?,?,?,?,?,?)`).run(
    u.id, qid, 'explain', res.score, res.coverage, res.total, res.length, durationMs,
    JSON.stringify({
      points: res.points.map(d => ({ t: d.text, h: d.hit ? 1 : 0 })),
      analogy: res.analogy ? 1 : 0, copied: res.copied ? 1 : 0, coverScore: res.coverScore
    }))

  // 讲清达标 = 真的会了 → 记忆引擎直接推到稳定掌握档，并从错题本移除
  if (pass) {
    const row = db.prepare('SELECT * FROM review_items WHERE user_id=? AND question_id=?').get(u.id, qid)
    const base = Math.max(row ? row.interval_idx : 0, 3)
    const sch = nextSchedule({ correct: true, selfRating: 'easy', covered: true, intervalIdx: base })
    const days = REVIEW_INTERVALS[sch.intervalIdx]
    const dueDate = shiftDate(today(), days)
    const state = reviewStateOf(sch.intervalIdx)
    if (row) {
      db.prepare(`UPDATE review_items SET state=?, interval_idx=?, due_date=?, ok_streak=ok_streak+1, last_review_at=?
        WHERE user_id=? AND question_id=?`).run(state, sch.intervalIdx, dueDate, today(), u.id, qid)
    } else {
      db.prepare(`INSERT INTO review_items (user_id,question_id,state,interval_idx,due_date,ok_streak,lapses,reviews,last_review_at)
        VALUES (?,?,?,?,?,1,0,1,?)`).run(u.id, qid, state, sch.intervalIdx, dueDate, today())
    }
    db.prepare(`INSERT INTO review_logs (user_id,question_id,result,self_rating,covered,delayed,interval_days)
      VALUES (?,?,1,'easy',1,0,?)`).run(u.id, qid, days)
    db.prepare('DELETE FROM wrong_book WHERE user_id=? AND question_id=?').run(u.id, qid)
  }

  const gained = pass ? 15 : Math.min(6, res.coverage)
  if (gained) addXp(u.id, gained, 'explain')

  const after = userById(u.id)
  const lv = levelOf(after.xp)
  db.prepare('UPDATE users SET level=? WHERE id=?').run(lv.level, u.id)

  return c.json(ok({
    score: res.score,
    coverScore: res.coverScore,
    coverage: res.coverage,
    total: res.total,
    pass,
    passLine: TELL_PASS,
    points: res.points,
    analogy: res.analogy,
    longEnough: res.longEnough,
    length: res.length,
    copied: res.copied,
    copyRate: res.copyRate,
    tips: res.tips,
    answerText,
    answerHtml: q.explain,
    stem: q.stem,
    category: q.category,
    clearedWrong: pass,
    gainedXp: gained,
    user: { xp: after.xp, level: lv.level }
  }))
})

/* --------- 第四档：用得上（场景题） --------- */

/** 场景队列：**不下发关键词清单与参考解法**（否则等于给答案） */
app.get('/api/scene/queue', (c) => {
  const u = currentUser(c)
  if (!u) return c.json(fail('未登录', 401), 401)

  // kind=project 只出「项目深挖」，kind=general 只出通用场景，不传则全部
  const kind = c.req.query('kind')
  const pool = SCENES.filter(s =>
    kind === 'project' ? s.kind === 'project' : (kind === 'general' ? s.kind !== 'project' : true)
  )

  const best = new Map(
    db.prepare('SELECT scene_code code, MAX(score) s FROM scene_attempts WHERE user_id=? GROUP BY scene_code')
      .all(u.id).map(r => [r.code, r.s])
  )
  const nextAt = new Map(
    db.prepare('SELECT scene_code code, MAX(next_at) n FROM scene_attempts WHERE user_id=? GROUP BY scene_code')
      .all(u.id).map(r => [r.code, r.n])
  )
  const d = today()

  // 错题闭环：没做过的必出；未达标的按 next_at 到期才出现（间隔回炉）；达标的保留供回顾
  const due = s => {
    const b = best.get(s.code)
    if (b === null || b === undefined) return true
    if (b >= SCENE_PASS) return true
    const n = nextAt.get(s.code)
    return !n || n <= d
  }

  const items = pool.filter(due).map(s => ({
    code: s.code,
    category: s.category,
    scene: s.scene,
    mustCount: s.must.length,
    followupCount: (FOLLOWUPS[s.code] || []).length,
    best: best.has(s.code) ? best.get(s.code) : null,
    passed: (best.get(s.code) || 0) >= SCENE_PASS
  }))

  // 未做的排前面，其次是没达标的（按分数升序，最差的先练）
  items.sort((a, b) => {
    if (a.best === null && b.best !== null) return -1
    if (a.best !== null && b.best === null) return 1
    return (a.best || 0) - (b.best || 0)
  })

  // 阶梯：通用场景 / 项目深挖 分开统计（项目深挖是面试主战场，单独看进度）
  const allPassed = SCENES.filter(s => (best.get(s.code) || 0) >= SCENE_PASS)
  const { known, say, tell } = masteryOf(u.id)
  return c.json(ok({
    kind: kind || 'all',
    items,
    passLine: SCENE_PASS,
    ladder: {
      known: known.size,
      say: [...say.values()].filter(s => s >= RECALL_PASS).length,
      tell: [...tell.values()].filter(s => s >= TELL_PASS).length,
      scene: allPassed.filter(s => s.kind !== 'project').length,
      project: allPassed.filter(s => s.kind === 'project').length,
      sceneTotal: SCENES.filter(s => s.kind !== 'project').length,
      projectTotal: SCENES.filter(s => s.kind === 'project').length
    }
  }))
})

/** 提交一次场景作答：判分 + 揭晓关键点/踩坑/参考解法 */
app.post('/api/scene/:code/submit', async (c) => {
  const u = currentUser(c)
  if (!u) return c.json(fail('未登录', 401), 401)
  const code = String(c.req.param('code'))
  const s = SCENE_BY_CODE[code]
  if (!s) return c.json(fail('场景不存在', 404), 404)

  const body = await c.req.json().catch(() => ({}))
  const text = String(body.text || '').slice(0, SCENE_MAX_LEN)
  const durationMs = Math.max(0, Math.min(60 * 60 * 1000, Math.round(Number(body.durationMs) || 0)))

  const res = scoreScene({ must: s.must, mustNot: s.mustNot, userText: text })
  const mainPass = res.score >= SCENE_PASS

  // 追问链：项目深挖题配了追问 —— 主题达标「且」追问全过，才算真正通过
  const fus = FOLLOWUPS[code] || []
  const fuIn = Array.isArray(body.followups) ? body.followups.map(x => String(x || '').slice(0, SCENE_MAX_LEN)) : []
  const followups = fus.map((f, i) => {
    const r = scoreScene({ must: f.must, userText: fuIn[i] || '', minLen: 15 })
    return {
      q: f.q, answer: f.answer, score: r.score, hits: r.hits, total: r.total,
      keywords: r.keywords, tips: r.tips, pass: r.score >= SCENE_PASS, text: (fuIn[i] || '').trim()
    }
  })
  const fuAllPass = followups.every(f => f.pass)
  const pass = mainPass && fuAllPass

  // 错题闭环：没全过 → 明天回炉（间隔复习）
  const nextAt = pass ? null : shiftDate(today(), 1)

  db.prepare(`INSERT INTO scene_attempts (user_id,scene_code,score,hits,total,typed_len,duration_ms,detail,next_at)
    VALUES (?,?,?,?,?,?,?,?,?)`).run(
    u.id, code, res.score, res.hits, res.total, res.length, durationMs,
    JSON.stringify({
      keywords: res.keywords.map(k => ({ k: k.key, h: k.hit ? 1 : 0 })),
      reasoned: res.reasoned ? 1 : 0, pitfalls: res.pitfalls, capped: res.capped ? 1 : 0,
      followups: followups.map(f => ({ q: f.q, score: f.score, pass: f.pass ? 1 : 0 }))
    }),
    nextAt)

  const gained = pass ? 20 : (mainPass ? 12 : Math.min(6, res.hits * 2))
  if (gained) addXp(u.id, gained, 'scene')

  const after = userById(u.id)
  const lv = levelOf(after.xp)
  db.prepare('UPDATE users SET level=? WHERE id=?').run(lv.level, u.id)

  const bestRow = db.prepare('SELECT MAX(score) s FROM scene_attempts WHERE user_id=? AND scene_code=?').get(u.id, code)

  return c.json(ok({
    score: res.score,
    mainPass,
    coverScore: res.coverScore,
    hits: res.hits,
    total: res.total,
    keywords: res.keywords,
    reasoned: res.reasoned,
    longEnough: res.longEnough,
    length: res.length,
    pitfalls: res.pitfalls,
    capped: res.capped,
    tips: res.tips,
    pass,
    passLine: SCENE_PASS,
    hasFollowups: followups.length > 0,
    followups,
    followupAvg: followups.length ? Math.round(followups.reduce((n, f) => n + f.score, 0) / followups.length) : null,
    nextAt,
    best: bestRow.s || 0,
    scene: s.scene,
    category: s.category,
    answer: s.answer,
    gainedXp: gained,
    user: { xp: after.xp, level: lv.level }
  }))
})

/* ================= 打比方素材库 ================= */
/**
 * 把自己讲清时用的比喻存下来 —— 面试时直接能说的表达素材。
 * 不做「正确性」判断，只做沉淀与检索（口径：这是你的话术资产，不是知识库）。
 */
app.get('/api/metaphor', (c) => {
  const u = currentUser(c)
  if (!u) return c.json(fail('未登录', 401), 401)
  const q = (c.req.query('q') || '').trim()
  const rows = q
    ? db.prepare(`SELECT id, question_id, topic, body, source, created_at FROM metaphors
        WHERE user_id=? AND (topic LIKE ? OR body LIKE ?)
        ORDER BY id DESC LIMIT 200`).all(u.id, '%' + q + '%', '%' + q + '%')
    : db.prepare(`SELECT id, question_id, topic, body, source, created_at FROM metaphors
        WHERE user_id=? ORDER BY id DESC LIMIT 200`).all(u.id)

  // 按知识点聚合，方便复习时一眼扫过
  const topics = db.prepare('SELECT topic, COUNT(*) n FROM metaphors WHERE user_id=? GROUP BY topic ORDER BY n DESC LIMIT 20').all(u.id)
  return c.json(ok({ items: rows, count: rows.length, topics }))
})

app.post('/api/metaphor', async (c) => {
  const u = currentUser(c)
  if (!u) return c.json(fail('未登录', 401), 401)
  const body = await c.req.json().catch(() => ({}))
  const topic = String(body.topic || '').trim().slice(0, 60)
  const text = String(body.body || '').trim().slice(0, 2000)
  if (!topic) return c.json(fail('先写「知识点」'), 400)
  if (!text) return c.json(fail('比喻内容不能为空'), 400)
  const qid = Number(body.questionId) || null
  const source = body.source === 'explain' ? 'explain' : 'manual'
  const r = db.prepare('INSERT INTO metaphors (user_id,question_id,topic,body,source) VALUES (?,?,?,?,?)')
    .run(u.id, qid, topic, text, source)
  return c.json(ok({ id: Number(r.lastInsertRowid), topic, body: text, source, questionId: qid }))
})

app.delete('/api/metaphor/:id', (c) => {
  const u = currentUser(c)
  if (!u) return c.json(fail('未登录', 401), 401)
  const id = Number(c.req.param('id'))
  const r = db.prepare('DELETE FROM metaphors WHERE id=? AND user_id=?').run(id, u.id)
  return c.json(ok({ deleted: r.changes }))
})

/* ================= 面试就绪度报告 ================= */
/**
 * 回答一个问题：「离能通过面试还差多少？」—— 而不是「练了多少」。
 *   知识就绪度 = 110 题按最高档位取分（认得25 / 说得出55 / 讲得清80），归一化到 100
 *   应用就绪度 = 场景达标率（通用 40% + 项目深挖 60%，项目是主战场）
 *   综合就绪度 = 知识 55% + 应用 45%
 *   最终就绪度 = 综合 × 延迟复测系数（隔天再测正确率 —— 最难自欺的指标；样本不足则不打折）
 */
app.get('/api/readiness', (c) => {
  const u = currentUser(c)
  if (!u) return c.json(fail('未登录', 401), 401)

  const tierScore = t => (t === 'tell' ? 80 : t === 'say' ? 55 : t === 'known' ? 25 : 0)

  // ---- 知识维度 ----
  const questions = db.prepare('SELECT id, category FROM questions').all()
  const sayMax = new Map(db.prepare("SELECT question_id qid, MAX(score) s FROM recall_attempts WHERE user_id=? AND mode='recall' GROUP BY question_id").all(u.id).map(r => [r.qid, r.s]))
  const tellMax = new Map(db.prepare("SELECT question_id qid, MAX(score) s FROM recall_attempts WHERE user_id=? AND mode='explain' GROUP BY question_id").all(u.id).map(r => [r.qid, r.s]))
  const knownSet = new Set(db.prepare('SELECT DISTINCT question_id qid FROM review_logs WHERE user_id=? AND result=1').all(u.id).map(r => r.qid))

  const tierOf = qid => {
    if ((tellMax.get(qid) || 0) >= TELL_PASS) return 'tell'
    if ((sayMax.get(qid) || 0) >= RECALL_PASS) return 'say'
    if (knownSet.has(qid)) return 'known'
    return 'none'
  }

  const catMap = new Map()
  const tierCount = { none: 0, known: 0, say: 0, tell: 0 }
  let kSum = 0
  for (const q of questions) {
    const t = tierOf(q.id)
    tierCount[t]++
    kSum += tierScore(t)
    const c = catMap.get(q.category) || { category: q.category, total: 0, score: 0, none: 0, known: 0, say: 0, tell: 0 }
    c.total++; c.score += tierScore(t); c[t]++
    catMap.set(q.category, c)
  }
  const knowledge = questions.length ? Math.round(kSum / questions.length / 80 * 100) : 0

  const categories = [...catMap.values()]
    .map(c => ({
      category: c.category, total: c.total,
      readiness: Math.round(c.score / c.total / 80 * 100),
      none: c.none, known: c.known, say: c.say, tell: c.tell
    }))
    .sort((a, b) => a.readiness - b.readiness)

  // ---- 应用维度 ----
  const passedRows = db.prepare('SELECT scene_code code, MAX(score) s FROM scene_attempts WHERE user_id=? GROUP BY scene_code HAVING s>=?')
    .all(u.id, SCENE_PASS)
  const passedSet = new Set(passedRows.map(r => r.code))
  const projScenes = SCENES.filter(s => s.kind === 'project')
  const genScenes = SCENES.filter(s => s.kind !== 'project')
  const gPassed = genScenes.filter(s => passedSet.has(s.code)).length
  const pPassed = projScenes.filter(s => passedSet.has(s.code)).length
  const apply = Math.round((genScenes.length ? gPassed / genScenes.length * 40 : 0) + (projScenes.length ? pPassed / projScenes.length * 60 : 0))

  const sceneCatMap = new Map()
  for (const s of SCENES) {
    const c = sceneCatMap.get(s.category) || { category: s.category, total: 0, passed: 0 }
    c.total++; if (passedSet.has(s.code)) c.passed++
    sceneCatMap.set(s.category, c)
  }
  const sceneCategories = [...sceneCatMap.values()]
    .map(c => ({ category: c.category, total: c.total, passed: c.passed, readiness: Math.round(c.passed / c.total * 100) }))
    .sort((a, b) => a.readiness - b.readiness)

  // ---- 综合与打折 ----
  const composite = Math.round(knowledge * 0.55 + apply * 0.45)
  const dl = db.prepare('SELECT result, COUNT(*) n FROM review_logs WHERE user_id=? AND delayed=1 GROUP BY result').all(u.id)
  const dTotal = dl.reduce((s, r) => s + r.n, 0)
  const dOk = (dl.find(r => r.result === 1) || {}).n || 0
  const delayedRate = dTotal ? Math.round(dOk / dTotal * 100) : null
  const coef = dTotal >= 5 ? Math.max(0.5, delayedRate / 100) : null
  const overall = coef === null ? composite : Math.round(composite * coef)

  // ---- 薄弱点 Top3（知识分类 + 场景分类合并，排除没数据的）----
  const weak = [...categories.map(c => ({ ...c, type: '知识' })), ...sceneCategories.map(c => ({ ...c, type: '场景' }))]
    .filter(c => c.total > 0)
    .sort((a, b) => a.readiness - b.readiness)
    .slice(0, 3)

  // ---- 预计还需 N 天（按近 7 天日均提取量估算）----
  const recent7 = db.prepare("SELECT COUNT(*) n FROM review_logs WHERE user_id=? AND at >= datetime('now','-7 day')").get(u.id).n
  let etaDays = null
  if (recent7 > 0) {
    const daily = Math.max(1, Math.round(recent7 / 7))
    const remaining = questions.filter(q => tierOf(q.id) !== 'tell').length + (SCENES.length - passedRows.length)
    etaDays = Math.ceil(remaining / daily)
  }

  return c.json(ok({
    overall,
    composite,
    knowledge,
    apply,
    coefficient: coef,
    delayed: { rate: delayedRate, sample: dTotal },
    tiers: { ...tierCount, scenes: passedRows.length },
    totals: { questions: questions.length, scenes: SCENES.length },
    categories,
    sceneCategories,
    weak,
    etaDays
  }))
})

/* ================= AI 模型设置（国内外模型统一代理） ================= */
/**
 * 设计：
 *  - Key 存在本地 SQLite 的 settings 表里，接口返回时只给掩码（前端永远拿不到明文）；
 *  - 统一走 OpenAI 兼容协议（DeepSeek / 通义 / Kimi / 智谱 / 豆包 / OpenAI / Gemini 兼容层都支持），
 *    Anthropic 单独适配（system 是顶层参数、鉴权头不同）；
 *  - /api/ai/chat 是唯一出口，后续的模拟面试官直接复用它，前端不接触 Key。
 */
const AI_KEY = 'ai_config'

const AI_PRESETS = {
  deepseek:  { label: 'DeepSeek · 深度求索', region: 'cn', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat', api: 'openai' },
  qwen:      { label: '通义千问 · 阿里', region: 'cn', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus', api: 'openai' },
  kimi:      { label: 'Kimi · 月之暗面', region: 'cn', baseUrl: 'https://api.moonshot.cn/v1', model: 'moonshot-v1-8k', api: 'openai' },
  glm:       { label: '智谱 GLM', region: 'cn', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4-flash', api: 'openai' },
  doubao:    { label: '豆包 · 字节', region: 'cn', baseUrl: 'https://ark.cn-beijing.volces.com/api/v3', model: '', api: 'openai' },
  openai:    { label: 'OpenAI · GPT', region: 'global', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini', api: 'openai' },
  anthropic: { label: 'Anthropic · Claude', region: 'global', baseUrl: 'https://api.anthropic.com/v1', model: 'claude-3-5-sonnet-20241022', api: 'anthropic' },
  gemini:    { label: 'Gemini · Google', region: 'global', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini-1.5-flash', api: 'openai' },
  custom:    { label: '自定义（OpenAI 兼容）', region: 'cn', baseUrl: '', model: '', api: 'openai' }
}

function getAiConfig() {
  const row = db.prepare('SELECT value FROM settings WHERE key=?').get(AI_KEY)
  if (!row) return null
  try { return JSON.parse(row.value) } catch (e) { return null }
}

function maskKey(k) {
  if (!k) return ''
  if (k.length <= 8) return '****'
  return k.slice(0, 4) + '****' + k.slice(-4)
}

/** 统一的大模型调用入口（OpenAI 兼容 / Anthropic 两种协议） */
async function callLLM(cfg, { system, messages, maxTokens = 800, temperature = 0.6, timeoutMs = 60000 }) {
  const isA = cfg.api === 'anthropic'
  const url = (cfg.baseUrl || '').replace(/\/+$/, '') + (isA ? '/messages' : '/chat/completions')
  const headers = isA
    ? { 'Content-Type': 'application/json', 'x-api-key': cfg.apiKey, 'anthropic-version': '2023-06-01' }
    : { 'Content-Type': 'application/json', Authorization: 'Bearer ' + cfg.apiKey }
  const payload = isA
    ? { model: cfg.model, max_tokens: maxTokens, temperature, ...(system ? { system } : {}), messages }
    : { model: cfg.model, max_tokens: maxTokens, temperature, messages: system ? [{ role: 'system', content: system }, ...messages] : messages }

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  let res
  try {
    res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(payload), signal: ctrl.signal })
  } catch (e) {
    clearTimeout(timer)
    throw new Error(e.name === 'AbortError' ? '请求超时（' + timeoutMs + 'ms），可能是网络不通或需要代理' : '连不上模型服务：' + e.message)
  }
  clearTimeout(timer)

  const raw = await res.text()
  if (!res.ok) throw new Error('HTTP ' + res.status + '：' + raw.slice(0, 220))
  let j
  try { j = JSON.parse(raw) } catch (e) { throw new Error('返回不是 JSON：' + raw.slice(0, 140)) }
  const content = isA
    ? (Array.isArray(j.content) && j.content[0] && j.content[0].text)
    : (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content)
  if (!content) throw new Error('响应里没有内容：' + raw.slice(0, 180))
  return { content: String(content), usage: j.usage || null }
}

app.get('/api/ai/config', (c) => {
  const u = currentUser(c)
  if (!u) return c.json(fail('未登录', 401), 401)
  const cfg = getAiConfig()
  return c.json(ok({
    presets: AI_PRESETS,
    config: cfg ? {
      provider: cfg.provider, baseUrl: cfg.baseUrl, model: cfg.model, api: cfg.api,
      keyMask: maskKey(cfg.apiKey), hasKey: !!cfg.apiKey
    } : null
  }))
})

app.post('/api/ai/config', async (c) => {
  const u = currentUser(c)
  if (!u) return c.json(fail('未登录', 401), 401)
  const body = await c.req.json().catch(() => ({}))
  const provider = String(body.provider || 'custom')
  const preset = AI_PRESETS[provider]
  if (!preset) return c.json(fail('未知的模型提供方'), 400)

  const prev = getAiConfig() || {}
  const baseUrl = String(body.baseUrl || preset.baseUrl || '').trim().replace(/\/+$/, '')
  const model = String(body.model || preset.model || '').trim()
  const api = preset.api || 'openai'
  const apiKey = String(body.apiKey || '').trim() || prev.apiKey || ''   // 留空 = 沿用旧 Key

  if (!baseUrl) return c.json(fail('接口地址（Base URL）不能为空'))
  if (!model) return c.json(fail('模型名不能为空'))
  if (!apiKey) return c.json(fail('API Key 不能为空'))

  db.prepare('INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value')
    .run(AI_KEY, JSON.stringify({ provider, baseUrl, model, api, apiKey }))
  return c.json(ok({ provider, baseUrl, model, api, keyMask: maskKey(apiKey), hasKey: true }))
})

/** 连通性测试：真发一次极小请求 */
app.post('/api/ai/test', async (c) => {
  const u = currentUser(c)
  if (!u) return c.json(fail('未登录', 401), 401)
  const body = await c.req.json().catch(() => ({}))
  const preset = AI_PRESETS[String(body.provider || 'custom')] || {}
  const prev = getAiConfig() || {}
  const cfg = {
    api: preset.api || 'openai',
    baseUrl: String(body.baseUrl || '').trim(),
    model: String(body.model || '').trim(),
    apiKey: String(body.apiKey || '').trim() || prev.apiKey || ''
  }
  if (!cfg.baseUrl || !cfg.model) return c.json(fail('先填接口地址和模型名'))
  if (!cfg.apiKey) return c.json(fail('还没有 API Key'))
  const t0 = Date.now()
  try {
    const r = await callLLM(cfg, {
      system: '你是连通性测试助手。',
      messages: [{ role: 'user', content: '只回复两个字：连通' }],
      maxTokens: 20, temperature: 0, timeoutMs: 20000
    })
    return c.json(ok({ ok: true, latencyMs: Date.now() - t0, sample: r.content.slice(0, 60) }))
  } catch (e) {
    return c.json(ok({ ok: false, latencyMs: Date.now() - t0, error: e.message }))
  }
})

/** 统一代理出口：模拟面试官等 AI 能力都走这里，前端不接触 Key */
app.post('/api/ai/chat', async (c) => {
  const u = currentUser(c)
  if (!u) return c.json(fail('未登录', 401), 401)
  const cfg = getAiConfig()
  if (!cfg || !cfg.apiKey) return c.json(fail('先在「AI 设置」里配置模型', 400), 400)
  const body = await c.req.json().catch(() => ({}))
  const messages = Array.isArray(body.messages) ? body.messages : []
  if (!messages.length) return c.json(fail('messages 不能为空'))
  try {
    const r = await callLLM(cfg, {
      system: body.system,
      messages,
      maxTokens: Number(body.maxTokens) || 800,
      temperature: Number(body.temperature) || 0.6,
      timeoutMs: Number(body.timeoutMs) || 60000
    })
    return c.json(ok({ content: r.content, usage: r.usage }))
  } catch (e) {
    return c.json(fail('AI 调用失败：' + e.message, 502), 502)
  }
})

/** 成就解锁通用逻辑 */
function unlockAchievements(userId, rules) {
  const unlocked = []
  const has = db.prepare('SELECT 1 FROM user_achievements WHERE user_id=? AND achievement_id=?')
  for (const [code, ok] of rules) {
    if (!ok) continue
    const a = db.prepare('SELECT * FROM achievements WHERE code=?').get(code)
    if (!a || has.get(userId, a.id)) continue
    db.prepare('INSERT INTO user_achievements (user_id,achievement_id) VALUES (?,?)').run(userId, a.id)
    addXp(userId, a.xp_reward, 'achievement:' + a.code)
    unlocked.push({ code: a.code, title: a.title, desc: a.desc, xpReward: a.xp_reward })
  }
  return unlocked
}

/* ---------------- 健康检查 ---------------- */
app.get('/api/health', (c) => c.json(ok({
  service: 'js-basics-game',
  time: new Date().toISOString(),
  counts: {
    chapters: db.prepare('SELECT COUNT(*) n FROM chapters').get().n,
    levels: db.prepare('SELECT COUNT(*) n FROM levels').get().n,
    questions: db.prepare('SELECT COUNT(*) n FROM questions').get().n,
    users: db.prepare('SELECT COUNT(*) n FROM users').get().n
  }
})))

/* ---------------- 登录（昵称，demo 级） ---------------- */
app.post('/api/auth/login', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const name = String(body.name || '').trim()
  if (!name) return c.json(fail('昵称不能为空'), 400)
  if (name.length > 20) return c.json(fail('昵称最多 20 字'), 400)

  let u = db.prepare('SELECT * FROM users WHERE name = ?').get(name)
  if (!u) {
    const r = db.prepare('INSERT INTO users (name) VALUES (?)').run(name)
    u = userById(r.lastInsertRowid)
  }
  return c.json(ok({ userId: u.id, name: u.name, token: 'u_' + u.id }))
})

/* ---------------- 我的数据 ---------------- */
app.get('/api/me', (c) => {
  const u = currentUser(c)
  if (!u) return c.json(fail('未登录', 401), 401)
  settleWeeks()
  const unread = db.prepare('SELECT COUNT(*) n FROM notifications WHERE user_id=? AND read_at IS NULL').get(u.id).n
  const lv = levelOf(u.xp)
  const clears = db.prepare('SELECT COUNT(DISTINCT level_id) n FROM attempts WHERE user_id=? AND stars>=1').get(u.id).n
  const three = db.prepare('SELECT COUNT(*) n FROM (SELECT level_id, MAX(stars) s FROM attempts WHERE user_id=? GROUP BY level_id HAVING s=3)').get(u.id).n
  const wrong = db.prepare('SELECT COUNT(*) n FROM wrong_book WHERE user_id=?').get(u.id).n
  const ach = db.prepare(`
    SELECT a.code,a.title,a.desc,a.xp_reward,ua.unlocked_at
    FROM user_achievements ua JOIN achievements a ON a.id=ua.achievement_id
    WHERE ua.user_id=? ORDER BY ua.unlocked_at DESC`).all(u.id)
  return c.json(ok({
    id: u.id, name: u.name, xp: u.xp, coins: u.coins,
    level: lv.level, levelProgress: { current: lv.current, need: lv.need },
    streakDays: u.streak_days, lastPlayDate: u.last_play_date,
    stats: { clears, threeStars: three, wrongCount: wrong },
    unread,
    achievements: ach
  }))
})

/* ---------------- 世界地图 ---------------- */
app.get('/api/map', (c) => {
  const u = currentUser(c)
  const chapters = db.prepare('SELECT * FROM chapters ORDER BY order_no').all()
  const levels = db.prepare('SELECT * FROM levels ORDER BY chapter_id, order_no').all()
  const best = u
    ? db.prepare('SELECT level_id, MAX(stars) stars, MAX(score) score FROM attempts WHERE user_id=? GROUP BY level_id').all(u.id)
    : []
  const bestMap = new Map(best.map(b => [b.level_id, b]))

  const data = chapters.map(ch => {
    const ls = levels.filter(l => l.chapter_id === ch.id).map(l => {
      const b = bestMap.get(l.id)
      return {
        id: l.id, title: l.title, type: l.type, difficulty: l.difficulty,
        orderNo: l.order_no, xpBase: l.xp_base,
        config: JSON.parse(l.config),
        bestStars: b ? b.stars : 0, bestScore: b ? b.score : 0
      }
    })
    // 章节（星系）全部开放；章节内按顺序解锁：前一关拿到 1★ 才开下一关
    ls.forEach((l, i) => {
      l.unlocked = i === 0 ? true : ls[i - 1].bestStars >= 1
    })
    const done = ls.filter(l => l.bestStars >= 1).length
    const full = ls.filter(l => l.bestStars === 3).length
    return {
      id: ch.id, code: ch.code, title: ch.title, orderNo: ch.order_no,
      total: ls.length, done, full, percent: ls.length ? Math.round(done / ls.length * 100) : 0,
      levels: ls
    }
  })
  return c.json(ok({ chapters: data }))
})

/* ---------------- 关卡详情（quiz 不下发答案） ---------------- */
app.get('/api/levels/:id', (c) => {
  const id = Number(c.req.param('id'))
  const level = db.prepare('SELECT * FROM levels WHERE id=?').get(id)
  if (!level) return c.json(fail('关卡不存在', 404), 404)
  const config = JSON.parse(level.config)

  let questions = []
  if (['quiz', 'boss', 'recite'].includes(level.type)) {
    const ids = config.questionIds || []
    const rows = ids.length
      ? db.prepare(`SELECT * FROM questions WHERE id IN (${ids.map(() => '?').join(',')})`).all(...ids)
      : []
    const byId = new Map(rows.map(r => [r.id, r]))
    questions = ids.map(qid => {
      const q = byId.get(qid)
      if (!q) return null
      const base = { id: q.id, stem: q.stem, options: level.type === 'recite' ? [] : JSON.parse(q.options), star: q.star }
      return base
    }).filter(Boolean)
  }

  return c.json(ok({
    id: level.id, chapterId: level.chapter_id, title: level.title, type: level.type,
    difficulty: level.difficulty, passScore: level.pass_score, xpBase: level.xp_base,
    config, questions
  }))
})

/* ---------------- 提交成绩 ---------------- */
app.post('/api/levels/:id/attempts', async (c) => {
  const u = currentUser(c)
  if (!u) return c.json(fail('未登录', 401), 401)
  const levelId = Number(c.req.param('id'))
  const level = db.prepare('SELECT * FROM levels WHERE id=?').get(levelId)
  if (!level) return c.json(fail('关卡不存在', 404), 404)

  const body = await c.req.json().catch(() => ({}))
  const durationMs = Math.max(0, Math.round(Number(body.durationMs) || 0))

  // 服务端判分：quiz/boss/recite 由后端按 answers 校验；
  // code/typing/flash 需要跑代码/比对文本，服务端无法安全执行，沿用前端分（M4 再考虑沙箱）
  let score, accuracy, detail
  if (['quiz', 'boss', 'recite'].includes(level.type)) {
    const g = gradeLevel(level, body.answers)
    score = g.score
    accuracy = g.accuracy
    detail = { answers: g.detail, total: g.total, correct: g.correct }
  } else if (level.type === 'typing') {
    // 打字关：前端只提交敲入的文本，服务端逐字比对
    const cfg = JSON.parse(level.config || '{}')
    if (SERVER_EXEC_ENABLED && typeof body.typed === 'string') {
      const g = gradeTyping(cfg.text, body.typed)
      score = g.score; accuracy = g.accuracy
      detail = { mode: g.mode, correct: g.correct, total: g.total }
    } else {
      score = clampScore(body.score); accuracy = clampScore(body.accuracy ?? score)
      detail = { mode: 'client-typing' }
    }
  } else if (level.type === 'code') {
    // 代码关：前端提交源码，服务端在子进程里跑测试
    const cfg = JSON.parse(level.config || '{}')
    const problem = PROBLEMS[cfg.problemIndex]
    if (SERVER_EXEC_ENABLED && typeof body.code === 'string') {
      const g = await gradeCode(problem, body.code)
      score = g.score; accuracy = g.accuracy ?? g.score
      detail = { mode: g.mode, pass: g.pass, total: g.total, error: g.error || null }
    } else {
      score = clampScore(body.score); accuracy = clampScore(body.accuracy ?? score)
      detail = { mode: 'client-code' }
    }
  } else {
    // flash 等：无法服务端执行，沿用前端分
    score = clampScore(body.score); accuracy = clampScore(body.accuracy ?? score)
    detail = body.detail || {}
  }

  // 反刷榜：满分但耗时过短（< 2s）判定异常，按 0 分处理
  if (isTooFastToBeTrue(score, durationMs)) {
    score = 0
    accuracy = 0
    detail = { ...detail, flagged: 'too-fast' }
  }

  const prev = bestStars(u.id, levelId)
  const stars = starsOf(score)
  const firstClear = prev.stars < 1 && stars >= 1
  // 权重衰减：闪卡/背诵这类"单题极快"的关卡压低收益，防止周榜套利
  const weight = XP_WEIGHT[level.type] ?? 1
  const gainedXp = Math.round(xpOf({ xpBase: level.xp_base, difficulty: level.difficulty, stars, firstClear }) * weight)

  // 记分
  db.prepare('INSERT INTO attempts (user_id,level_id,score,stars,accuracy,duration_ms,detail) VALUES (?,?,?,?,?,?,?)')
    .run(u.id, levelId, score, stars, accuracy, durationMs, JSON.stringify(detail))

  // 错题本：答错进、答对清
  const answers = Array.isArray(detail.answers) ? detail.answers : []
  const addWrong = db.prepare(`INSERT INTO wrong_book (user_id,question_id,wrong_count,last_choice) VALUES (?,?,1,?)
    ON CONFLICT(user_id,question_id) DO UPDATE SET wrong_count=wrong_count+1, last_choice=excluded.last_choice, last_wrong_at=datetime('now')`)
  const delWrong = db.prepare('DELETE FROM wrong_book WHERE user_id=? AND question_id=?')
  for (const a of answers) {
    if (!a || !a.questionId) continue
    if (a.correct) delWrong.run(u.id, a.questionId)
    else addWrong.run(u.id, a.questionId, Number.isFinite(Number(a.choice)) ? Number(a.choice) : null)
    // 播种记忆条目：关卡=首次学习，之后由「复习」做提取练习
    ensureReviewItem(u.id, a.questionId, !!a.correct)
  }

  // 用户成长（XP 走账本；等级在末尾统一刷新）
  const streak = stars >= 1 ? nextStreak(u.last_play_date, u.streak_days) : u.streak_days
  addXp(u.id, gainedXp, 'level:' + levelId)
  db.prepare('UPDATE users SET coins=?, streak_days=?, last_play_date=? WHERE id=?')
    .run(u.coins + stars * 5, streak, today(), u.id)

  // 成就判定
  const clears = db.prepare('SELECT COUNT(DISTINCT level_id) n FROM attempts WHERE user_id=? AND stars>=1').get(u.id).n
  const threeN = db.prepare('SELECT COUNT(*) n FROM (SELECT level_id, MAX(stars) s FROM attempts WHERE user_id=? GROUP BY level_id HAVING s=3)').get(u.id).n
  const wrongCleared = db.prepare('SELECT COUNT(*) n FROM (SELECT user_id FROM wrong_book WHERE user_id=?)').get(u.id).n
  const unlocked = unlockAchievements(u.id, [
    ['first_clear', clears >= 1],
    ['first_three', threeN >= 1],
    ['ten_three', threeN >= 10],
    ['streak_3', streak >= 3],
    ['streak_7', streak >= 7],
    ['wrong_clear_10', wrongCleared === 0 && clears >= 10]
  ])

  // 每日任务（首战 / 三星）
  const daily = awardDaily(u.id, ['daily_first', ...(stars === 3 ? ['daily_three'] : [])])

  const after = userById(u.id)
  const lv = levelOf(after.xp)
  db.prepare('UPDATE users SET level=? WHERE id=?').run(lv.level, u.id)
  return c.json(ok({
    levelId, score, stars, accuracy, durationMs,
    gainedXp: gainedXp + daily.xp, firstClear,
    flagged: detail.flagged || null,
    detail,
    newBest: stars > prev.stars ? stars : prev.stars,
    daily,
    user: { xp: after.xp, level: lv.level, levelProgress: { current: lv.current, need: lv.need }, coins: after.coins, streakDays: after.streak_days },
    unlocked
  }))
})

/* ---------------- 错题本 ---------------- */
app.get('/api/wrongbook', (c) => {
  const u = currentUser(c)
  if (!u) return c.json(fail('未登录', 401), 401)
  const rows = db.prepare(`
    SELECT w.wrong_count, w.last_wrong_at, w.last_choice,
           q.id, q.category, q.stem, q.options, q.answer, q.explain, q.star
    FROM wrong_book w JOIN questions q ON q.id = w.question_id
    WHERE w.user_id=? ORDER BY w.last_wrong_at DESC`).all(u.id)
  const items = rows.map(r => {
    const options = JSON.parse(r.options || '[]')
    return {
      id: r.id, category: r.category, stem: r.stem, star: r.star,
      options,
      myChoice: r.last_choice,
      myAnswer: Number.isFinite(r.last_choice) && options[r.last_choice] !== undefined ? options[r.last_choice] : null,
      rightAnswer: options[r.answer] !== undefined ? options[r.answer] : null,
      explain: r.explain,
      wrongCount: r.wrong_count,
      lastWrongAt: r.last_wrong_at
    }
  })
  return c.json(ok({ count: items.length, items }))
})

/** 移出错题本（手动「已掌握」） */
app.post('/api/wrongbook/:qid/resolve', (c) => {
  const u = currentUser(c)
  if (!u) return c.json(fail('未登录', 401), 401)
  const qid = Number(c.req.param('qid'))
  const r = db.prepare('DELETE FROM wrong_book WHERE user_id=? AND question_id=?').run(u.id, qid)
  const remain = db.prepare('SELECT COUNT(*) n FROM wrong_book WHERE user_id=?').get(u.id).n
  return c.json(ok({ removed: r.changes, remaining: remain }))
})

/* ---------------- 每日任务 ---------------- */
app.get('/api/daily', (c) => {
  const u = currentUser(c)
  if (!u) return c.json(fail('未登录', 401), 401)
  const d = dailyStatus(u.id)
  return c.json(ok({ ...d, totalXp: d.tasks.reduce((s, t) => s + t.xp, 0), doneXp: d.tasks.filter(t => t.done).reduce((s, t) => s + t.xp, 0) }))
})

/* ---------------- 排行榜（默认周榜；?type=all_time 预留） ---------------- */
app.get('/api/leaderboard', (c) => {
  const u = currentUser(c)
  settleWeeks()
  const type = c.req.query('type') === 'all_time' ? 'all_time' : 'weekly'
  const weekStart = mondayOf()
  const LIMIT = 50

  const rows = type === 'all_time'
    ? db.prepare(`SELECT u.id, u.name, u.level, u.streak_days, u.xp AS score
                  FROM users u ORDER BY score DESC, u.id ASC LIMIT ${LIMIT}`).all()
    : db.prepare(`
        SELECT u.id, u.name, u.level, u.streak_days,
               COALESCE(SUM(l.amount), 0) AS score
        FROM users u
        LEFT JOIN xp_log l ON l.user_id = u.id AND l.date >= ?
        GROUP BY u.id
        ORDER BY score DESC, u.id ASC
        LIMIT ${LIMIT}`).all(weekStart)

  const items = rows.map((r, i) => ({ rank: i + 1, ...r, isMe: u ? r.id === u.id : false }))
  let me = null
  if (u) {
    const idx = items.findIndex(x => x.id === u.id)
    if (idx >= 0) {
      const prev = idx > 0 ? items[idx - 1] : null
      me = { rank: items[idx].rank, score: items[idx].score, gapToPrev: prev ? prev.score - items[idx].score : 0 }
    } else {
      const mine = type === 'all_time'
        ? u.xp
        : db.prepare('SELECT COALESCE(SUM(amount),0) s FROM xp_log WHERE user_id=? AND date>=?').get(u.id, weekStart).s
      me = { rank: items.length ? items.length + 1 : 1, score: mine, gapToPrev: items.length ? items[items.length - 1].score - mine : 0 }
    }
  }
  return c.json(ok({
    type, weekStart,
    weekEnd: type === 'weekly' ? new Date(new Date(weekStart).getTime() + 6 * 86400000).toISOString().slice(0, 10) : null,
    items, me
  }))
})

/* ---------------- 心魔试炼（错题本玩法化） ---------------- */
/** 错题 >= NIGHTMARE_MIN 即可召唤「心魔 BOSS」 */
app.get('/api/nightmare', (c) => {
  const u = currentUser(c)
  if (!u) return c.json(fail('未登录', 401), 401)
  const rows = db.prepare(`
    SELECT q.id, q.stem, q.category, q.star, q.options
    FROM wrong_book w JOIN questions q ON q.id = w.question_id
    WHERE w.user_id = ? ORDER BY w.wrong_count DESC, w.last_wrong_at DESC LIMIT 10`).all(u.id)
  const ready = rows.length >= NIGHTMARE_MIN
  return c.json(ok({
    ready, count: rows.length, need: NIGHTMARE_MIN,
    xpReward: NIGHTMARE_XP,
    questions: ready
      ? rows.map(q => ({ id: q.id, stem: q.stem, category: q.category, star: q.star, options: JSON.parse(q.options) }))
      : []
  }))
})

/** 挑战心魔：全对清空错题 + 高额 XP + 徽章「温故知新 / 斩心魔」 */
app.post('/api/nightmare/attempts', async (c) => {
  const u = currentUser(c)
  if (!u) return c.json(fail('未登录', 401), 401)
  const body = await c.req.json().catch(() => ({}))
  const wrong = db.prepare(`
    SELECT w.question_id AS qid, q.answer AS ans
    FROM wrong_book w JOIN questions q ON q.id = w.question_id WHERE w.user_id = ?`).all(u.id)
  if (wrong.length < NIGHTMARE_MIN) return c.json(fail('错题不足 ' + NIGHTMARE_MIN + ' 题，心魔还没成形'), 400)

  const key = new Map(wrong.map(r => [r.qid, r.ans]))
  const list = Array.isArray(body.answers) ? body.answers : []
  let correct = 0
  const cleared = []
  const detail = []
  for (const a of list) {
    const qid = Number(a && (a.qId ?? a.questionId))
    if (!key.has(qid)) continue
    const ok = Number(a.choice) === key.get(qid)
    if (ok) { correct++; cleared.push(qid) }
    detail.push({ questionId: qid, choice: Number(a.choice), correct: ok, answer: key.get(qid) })
  }
  const total = wrong.length
  const accuracy = Math.round(correct / total * 100)
  const perfect = total > 0 && correct === total
  const pass = accuracy >= 60

  // 答对的错题从错题本移出
  const del = db.prepare('DELETE FROM wrong_book WHERE user_id=? AND question_id=?')
  for (const qid of cleared) del.run(u.id, qid)

  // 奖励：过关给 NIGHTMARE_XP，全对再翻倍；未过关也有安慰奖
  const gainedXp = pass ? NIGHTMARE_XP + (perfect ? NIGHTMARE_XP : 0) : Math.max(1, Math.round(NIGHTMARE_XP * 0.1))
  const streak = pass ? nextStreak(u.last_play_date, u.streak_days) : u.streak_days
  addXp(u.id, gainedXp, 'nightmare')
  db.prepare('UPDATE users SET coins=?, streak_days=?, last_play_date=? WHERE id=?')
    .run(u.coins + (pass ? 30 : 0), streak, today(), u.id)

  const unlocked = unlockAchievements(u.id, [
    ['nightmare_clear', pass],
    ['nightmare_perfect', perfect],
    ['streak_3', streak >= 3],
    ['streak_7', streak >= 7]
  ])

  // 每日任务：斩心魔
  const daily = awardDaily(u.id, pass ? ['daily_nightmare', 'daily_first'] : [])

  const after = userById(u.id)
  const lv = levelOf(after.xp)
  db.prepare('UPDATE users SET level=? WHERE id=?').run(lv.level, u.id)
  const remain = db.prepare('SELECT COUNT(*) n FROM wrong_book WHERE user_id=?').get(u.id).n
  return c.json(ok({
    total, correct, accuracy, perfect, pass,
    cleared: cleared.length, remaining: remain,
    gainedXp: gainedXp + daily.xp,
    daily,
    user: { xp: after.xp, level: lv.level, levelProgress: { current: lv.current, need: lv.need }, coins: after.coins, streakDays: after.streak_days },
    detail, unlocked
  }))
})

/* ---------------- 站内通知 ---------------- */
app.get('/api/notifications', (c) => {
  const u = currentUser(c)
  if (!u) return c.json(fail('未登录', 401), 401)
  const rows = db.prepare(`
    SELECT id, type, title, body, payload, read_at, created_at
    FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 30`).all(u.id)
  const unread = db.prepare('SELECT COUNT(*) n FROM notifications WHERE user_id=? AND read_at IS NULL').get(u.id).n
  return c.json(ok({
    unread,
    items: rows.map(r => ({ ...r, payload: JSON.parse(r.payload || '{}'), read: !!r.read_at }))
  }))
})

app.post('/api/notifications/read', (c) => {
  const u = currentUser(c)
  if (!u) return c.json(fail('未登录', 401), 401)
  const r = db.prepare("UPDATE notifications SET read_at = datetime('now') WHERE user_id = ? AND read_at IS NULL").run(u.id)
  return c.json(ok({ marked: r.changes }))
})

/* ---------------- 上一周结算快照 ---------------- */
app.get('/api/board/last', (c) => {
  const row = db.prepare('SELECT * FROM week_settlements ORDER BY week_start DESC LIMIT 1').get()
  if (!row) return c.json(ok({ exists: false, top: null }))
  return c.json(ok({
    exists: true,
    weekStart: row.week_start,
    weekEnd: row.week_end,
    players: row.players,
    settledAt: row.settled_at,
    top: JSON.parse(row.top_json || '[]')
  }))
})

/* ---------------- 专属心魔卷（可重复挑战，冲三星） ---------------- */
/** 题序固定（按错题次数降序），反复挑战只比历史最好成绩 */
app.get('/api/nightmare/scroll', (c) => {
  const u = currentUser(c)
  if (!u) return c.json(fail('未登录', 401), 401)
  const MIN = 3
  const rows = db.prepare(`
    SELECT q.id, q.stem, q.category, q.star, q.options, w.wrong_count
    FROM wrong_book w JOIN questions q ON q.id = w.question_id
    WHERE w.user_id = ?
    ORDER BY w.wrong_count DESC, q.id ASC LIMIT 20`).all(u.id)
  const ready = rows.length >= MIN
  const best = db.prepare('SELECT best_score, best_stars, attempts FROM nightmare_best WHERE user_id=?').get(u.id)
  return c.json(ok({
    ready, count: rows.length, min: MIN,
    best: best || { best_score: 0, best_stars: 0, attempts: 0 },
    questions: ready
      ? rows.map(r => ({ id: r.id, stem: r.stem, category: r.category, star: r.star, options: JSON.parse(r.options), wrongCount: r.wrong_count }))
      : []
  }))
})

app.post('/api/nightmare/scroll/attempts', async (c) => {
  const u = currentUser(c)
  if (!u) return c.json(fail('未登录', 401), 401)
  const body = await c.req.json().catch(() => ({}))
  const wrong = db.prepare(`
    SELECT w.question_id AS qid, q.answer AS ans
    FROM wrong_book w JOIN questions q ON q.id = w.question_id WHERE w.user_id = ?`).all(u.id)
  if (wrong.length < 3) return c.json(fail('错题不足 3 题，无法生成心魔卷'), 400)
  const key = new Map(wrong.map(r => [r.qid, r.ans]))

  const list = Array.isArray(body.answers) ? body.answers : []
  let correct = 0
  const cleared = []
  const detail = []
  for (const a of list) {
    const qid = Number(a && (a.qId ?? a.questionId))
    if (!key.has(qid)) continue
    const ok = Number(a.choice) === key.get(qid)
    if (ok) { correct++; cleared.push(qid) }
    detail.push({ questionId: qid, choice: Number(a.choice), correct: ok, answer: key.get(qid) })
  }
  const total = wrong.length
  const score = Math.round(correct / total * 100)
  const stars = starsOf(score)

  const prevBest = db.prepare('SELECT best_score, best_stars, attempts FROM nightmare_best WHERE user_id=?').get(u.id)
  const prev = prevBest || { best_score: 0, best_stars: 0, attempts: 0 }
  const improved = score > prev.best_score
  const firstClear = prev.best_stars < 1 && stars >= 1

  // 防刷：只有「刷新纪录」才给正经 XP；原地重打只给 1 点安慰
  let gainedXp = 1
  if (improved) {
    const raw = xpOf({ xpBase: 40, difficulty: 3, stars, firstClear })
    gainedXp = Math.max(1, Math.round(raw * 0.6))
  }
  addXp(u.id, gainedXp, 'nightmare-scroll')

  db.prepare(`INSERT INTO nightmare_best (user_id,best_score,best_stars,attempts) VALUES (?,?,?,1)
    ON CONFLICT(user_id) DO UPDATE SET
      best_score = MAX(best_score, excluded.best_score),
      best_stars = MAX(best_stars, excluded.best_stars),
      attempts = attempts + 1,
      last_at = datetime('now')`).run(u.id, score, stars)

  // 三星 = 掌握 → 把这几题移出错题本
  let clearedWrong = 0
  if (stars === 3) {
    const del = db.prepare('DELETE FROM wrong_book WHERE user_id=? AND question_id=?')
    for (const qid of cleared) { del.run(u.id, qid); clearedWrong++ }
  }

  const after = userById(u.id)
  const lv = levelOf(after.xp)
  db.prepare('UPDATE users SET level=? WHERE id=?').run(lv.level, u.id)
  const remain = db.prepare('SELECT COUNT(*) n FROM wrong_book WHERE user_id=?').get(u.id).n

  return c.json(ok({
    total, correct, score, stars, accuracy: score,
    improved, prevBest: prev.best_score, attempts: prev.attempts + 1,
    clearedWrong, remain,
    gainedXp,
    user: { xp: after.xp, level: lv.level, levelProgress: { current: lv.current, need: lv.need }, coins: after.coins, streakDays: after.streak_days },
    detail
  }))
})

/* ---------------- 数据看板 ---------------- */
app.get('/api/stats', (c) => {
  const u = currentUser(c)
  if (!u) return c.json(fail('未登录', 401), 401)

  const overview = db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM users)        AS users,
      (SELECT COUNT(*) FROM attempts)     AS attempts,
      (SELECT ROUND(AVG(stars), 2) FROM attempts) AS avgStars,
      (SELECT COUNT(*) FROM wrong_book)   AS wrongOpen,
      (SELECT COALESCE(SUM(amount),0) FROM xp_log) AS totalXp`).get()

  // 近 14 天活跃（DAU）
  const dau = db.prepare(`
    SELECT date, COUNT(DISTINCT user_id) AS value
    FROM xp_log GROUP BY date ORDER BY date DESC LIMIT 14`).all()

  // 次日留存：当天活跃的人里，有多少第二天还活跃
  const retention = db.prepare(`
    SELECT a.date AS date,
           COUNT(DISTINCT a.user_id) AS base,
           COUNT(DISTINCT b.user_id) AS retained
    FROM (SELECT DISTINCT user_id, date FROM xp_log) a
    LEFT JOIN (SELECT DISTINCT user_id, date FROM xp_log) b
      ON b.user_id = a.user_id AND b.date = date(a.date, '+1 day')
    GROUP BY a.date ORDER BY a.date DESC LIMIT 14`).all()
    .map(r => ({ ...r, rate: r.base ? Math.round(r.retained / r.base * 100) : 0 }))

  // 各关「首次通过率」：每个用户在该关的第一次尝试是否拿到 ≥1★
  const levels = db.prepare(`
    WITH firsts AS (
      SELECT level_id, user_id, MIN(id) AS first_id
      FROM attempts GROUP BY level_id, user_id
    )
    SELECT l.id, l.title, l.type, l.difficulty,
           COUNT(f.user_id) AS players,
           SUM(CASE WHEN a.stars >= 1 THEN 1 ELSE 0 END) AS passed,
           ROUND(AVG(a.score), 1) AS avgScore,
           ROUND(AVG(a.stars), 2) AS avgStars
    FROM levels l
    JOIN firsts f ON f.level_id = l.id
    JOIN attempts a ON a.id = f.first_id
    GROUP BY l.id
    ORDER BY players DESC, l.id ASC
    LIMIT 20`).all()
    .map(r => ({ ...r, passRate: r.players ? Math.round(r.passed / r.players * 100) : 0 }))

  // 全站累计（不含尝试数，用于对比）
  const passedDist = db.prepare(`
    SELECT stars, COUNT(*) AS n FROM attempts GROUP BY stars ORDER BY stars DESC`).all()

  return c.json(ok({ overview, dau, retention, levels, passedDist }))
})

/* ---------------- 静态托管（线上单端口部署：后端直接托管前端产物） ----------------
 * 目录约定：server/public/ 放前端构建产物（index.html + assets/）。
 * 本地开发没有这个目录 → 自动跳过，行为与原来完全一致。
 */
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { serveStatic } from '@hono/node-server/serve-static'

const PUB_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public')
if (fs.existsSync(path.join(PUB_DIR, 'index.html'))) {
  // 静态文件（注册在所有 API 路由之后 → 不会拦截接口）
  app.use('*', serveStatic({ root: PUB_DIR }))
  // SPA 兜底：非接口路径一律回 index.html（前端是 history 路由）
  app.get('*', (c) => {
    if (c.req.path.startsWith('/api/')) return c.json({ ok: false, error: 'Not Found' }, 404)
    try {
      return c.html(fs.readFileSync(path.join(PUB_DIR, 'index.html'), 'utf8'))
    } catch (e) {
      return c.text('Not Found', 404)
    }
  })
  console.log('已启用前端静态托管 → ' + PUB_DIR)
}

/* ---------------- 启动 ---------------- */
const PORT = Number(process.env.PORT || 5181)
serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`《前端修炼·闯关》后端已启动 → http://localhost:${info.port}（静态托管${fs.existsSync(PUB_DIR) ? '已启用' : '未启用'}）`)
})


/**
 * 内容导入：把前端题库（八股文 / 手写题 / 闪卡）灌进 SQLite，并生成章节与关卡。
 * 用法：node src/seed.js [--force]
 */
import { db, initSchema, DB_PATH } from './db.js'
import { BAGUWEN, PROBLEMS, FLASHCARDS, plain, firstClause, mulberry32 } from './content.js'
import { ACHIEVEMENTS } from './game.js'
import { derivePoints } from './recall.js'
import { QUIZ_OVERRIDES } from './quizOverrides.js'

initSchema()
const force = process.argv.includes('--force')

const chapterCount = db.prepare('SELECT COUNT(*) AS n FROM chapters').get().n
if (chapterCount > 0 && !force) {
  console.log(`已初始化（${chapterCount} 个章节），跳过。要重建请加 --force`)
  process.exit(0)
}

if (force) {
  // 只清内容与成绩，保留 users / achievements 定义（成就定义随后 upsert）
  for (const t of ['level_questions', 'wrong_book', 'attempts', 'levels', 'questions', 'chapters']) {
    db.exec(`DELETE FROM ${t}`)
  }
  db.exec("DELETE FROM sqlite_sequence WHERE name IN ('levels','questions','chapters','attempts','wrong_book')")
}

/* ---------- 成就 ---------- */
const upAch = db.prepare(
  `INSERT INTO achievements (code,title,desc,xp_reward,condition) VALUES (?,?,?,?,?)
   ON CONFLICT(code) DO UPDATE SET title=excluded.title, desc=excluded.desc, xp_reward=excluded.xp_reward, condition=excluded.condition`
)
for (const a of ACHIEVEMENTS) upAch.run(a.code, a.title, a.desc, a.xp_reward, JSON.stringify(a.condition))

/* ---------- 章节 ---------- */
const insChapter = db.prepare('INSERT INTO chapters (code,title,order_no) VALUES (?,?,?)')
const insLevel = db.prepare(
  'INSERT INTO levels (chapter_id,order_no,title,type,difficulty,config,pass_score,xp_base) VALUES (?,?,?,?,?,?,?,?)'
)
const insQuestion = db.prepare(
  'INSERT INTO questions (category,stem,options,answer,explain,star,points) VALUES (?,?,?,?,?,?,?)'
)
const insLQ = db.prepare('INSERT INTO level_questions (level_id,question_id,order_no) VALUES (?,?,?)')

let levelTotal = 0
let manualCount = 0   // 人工校对的选项数
let autoCount = 0     // 自动生成的选项数（待校对）
function addLevel(chapterId, orderNo, title, type, difficulty, config, passScore, xpBase) {
  const r = insLevel.run(chapterId, orderNo, title, type, difficulty, JSON.stringify(config), passScore, xpBase)
  levelTotal++
  return Number(r.lastInsertRowid)
}

/* ---------- 全局干扰池（跨分类兜底） ---------- */
const globalPool = BAGUWEN.flatMap(s => s.items.map(it => firstClause(it.plain)))

/* ---------- 八股文 10 章 ---------- */
BAGUWEN.forEach((sec, ci) => {
  const chapterId = Number(insChapter.run('ch' + (ci + 1), sec.cat, ci + 1).lastInsertRowid)
  const difficulty = ci < 4 ? 1 : (ci < 7 ? 2 : 3)

  // 1) 每题生成一条选择题（选项：正确答案首句 + 同分类其他题首句 ×3）
  const pool = sec.items.map(it => firstClause(it.plain))
  const qids = []
  sec.items.forEach((it, ii) => {
    const ov = QUIZ_OVERRIDES[sec.cat] && QUIZ_OVERRIDES[sec.cat][ii]
    let options, answer
    if (ov && Array.isArray(ov.options) && ov.options.length >= 3) {
      // ① 人工校对过的选项（优先）
      if (ov.shuffle) {
        // shuffle:true 时，answer 指的是「作者书写时的下标」（通常 0 = 正确项写在首位），
        // 由 seed 确定性打乱后再回算真实下标 —— 从机制上杜绝人工填错 answer 的可能
        const r = mulberry32((ci + 1) * 8888 + ii * 31)
        const arr = ov.options.map((v, k) => ({ v, k, r: r() })).sort((a, b) => a.r - b.r)
        options = arr.map(o => o.v)
        answer = arr.findIndex(o => o.k === ov.answer)
      } else {
        options = ov.options
        answer = ov.answer
      }
      manualCount++
    } else {
      // ② 兜底自动生成（弱智选项风险，待批量校对：见 quizOverrides.js）
      const correct = firstClause(it.plain)
      const rnd = mulberry32((ci + 1) * 10000 + ii)
      const cands = pool.filter((_, k) => k !== ii && pool[k] !== correct)
      const shuffled = cands.map(v => ({ v, r: rnd() })).sort((a, b) => a.r - b.r).map(o => o.v)
      const distractors = []
      for (const c of shuffled) {
        if (distractors.length >= 3) break
        if (!distractors.includes(c)) distractors.push(c)
      }
      let g = 0
      while (distractors.length < 3 && g < globalPool.length) {
        const c = globalPool[(ci * 31 + ii * 7 + g * 13) % globalPool.length]
        if (c !== correct && !distractors.includes(c)) distractors.push(c)
        g++
      }
      const rnd2 = mulberry32((ci + 1) * 777 + ii * 13)
      const withIdx = [correct, ...distractors].map((v, k) => ({ v, k, r: rnd2() })).sort((a, b) => a.r - b.r)
      options = withIdx.map(o => o.v)
      answer = withIdx.findIndex(o => o.k === 0)
      autoCount++
    }
    // 复现要点：从答案纯文本自动抽取（白纸复现关的判分依据，无需人工维护）
    const points = derivePoints(it.plain)
    const qid = Number(insQuestion.run(sec.cat, it.q, JSON.stringify(options), answer, it.a, it.star, JSON.stringify(points)).lastInsertRowid)
    qids.push(qid)
  })

  // 2) 选择关：每 5 题一关
  let o = 0
  for (let s = 0; s < qids.length; s += 5) {
    const batch = qids.slice(s, s + 5)
    const lid = addLevel(chapterId, ++o, `${sec.cat} · 选择关 ${o}`, 'quiz', difficulty,
      { questionIds: batch, timeLimitSec: 5 * 60 }, 60, 10)
    batch.forEach((qid, k) => insLQ.run(lid, qid, k + 1))
  }

  // 3) 背诵关（自评，快速过一遍；低 XP 防刷）
  {
    const lid = addLevel(chapterId, ++o, `${sec.cat} · 背诵关`, 'recite', difficulty,
      { questionIds: qids }, 60, 5)
    qids.forEach((qid, k) => insLQ.run(lid, qid, k + 1))
  }

  // 4) 中文默写关（取本分类星标最高的题答案）
  {
    const best = sec.items.reduce((a, b) => (b.star > a.star ? b : a), sec.items[0])
    addLevel(chapterId, ++o, `${sec.cat} · 中文默写`, 'typing', difficulty,
      { title: best.q, text: best.plain, lang: 'zh' }, 60, 15)
  }

  // 5) BOSS 关（随机 5 题 + 限时）
  {
    const rnd = mulberry32(9000 + ci)
    const pick = qids.map(v => ({ v, r: rnd() })).sort((a, b) => a.r - b.r).slice(0, 5).map(o => o.v)
    const lid = addLevel(chapterId, ++o, `${sec.cat} · BOSS`, 'boss', difficulty,
      { questionIds: pick, timeLimitSec: 180 }, 80, 50)
    pick.forEach((qid, k) => insLQ.run(lid, qid, k + 1))
  }
})

/* ---------- 第 11 章：手写工坊（代码关） ---------- */
{
  const chapterId = Number(insChapter.run('ch11', '十一、手写工坊', 11).lastInsertRowid)
  let o = 0
  PROBLEMS.forEach((p, i) => {
    if (!p.tests) return // 诊断/自由练习不成关
    addLevel(chapterId, ++o, `手写 · ${p.title}`, 'code', 3, { problemIndex: i }, 60, 30)
  })
}

/* ---------- 第 12 章：打字道场（代码默写） ---------- */
{
  const chapterId = Number(insChapter.run('ch12', '十二、打字道场', 12).lastInsertRowid)
  let o = 0
  PROBLEMS.forEach((p, i) => {
    if (!p.tests || !p.ref) return
    const text = p.ref.split('\n').filter(l => !l.trim().startsWith('钩子')).join('\n').trim()
    addLevel(chapterId, ++o, `默写 · ${p.title}`, 'typing', 2, { title: p.title, text, lang: 'code' }, 60, 15)
  })
}

/* ---------- 第 13 章：闪卡速答 ---------- */
{
  const chapterId = Number(insChapter.run('ch13', '十三、闪卡速答', 13).lastInsertRowid)
  addLevel(chapterId, 1, '闪卡速答 · 全 16 张', 'flash', 1, { count: FLASHCARDS.length }, 60, 8)
}

/* ---------- 汇总 ---------- */
const stat = {
  chapters: db.prepare('SELECT COUNT(*) n FROM chapters').get().n,
  levels: db.prepare('SELECT COUNT(*) n FROM levels').get().n,
  questions: db.prepare('SELECT COUNT(*) n FROM questions').get().n,
  links: db.prepare('SELECT COUNT(*) n FROM level_questions').get().n,
  achievements: db.prepare('SELECT COUNT(*) n FROM achievements').get().n
}
console.log('导入完成 →', DB_PATH)
console.log(stat)
const byType = db.prepare('SELECT type, COUNT(*) n FROM levels GROUP BY type ORDER BY n DESC').all()
console.log('关卡类型分布：', byType)
console.log(`选项来源：人工校对 ${manualCount} 题 / 自动生成 ${autoCount} 题（自动项待校对）`)

// 复现要点生成情况（白纸复现关）
{
  const all = db.prepare('SELECT points FROM questions').all()
  const counts = all.map(r => { try { return JSON.parse(r.points || '[]').length } catch (e) { return 0 } })
  const withPoints = counts.filter(n => n > 0).length
  const avg = withPoints ? counts.reduce((s, n) => s + n, 0) / withPoints : 0
  console.log(`复现要点：${withPoints}/${all.length} 题已生成，平均 ${avg.toFixed(1)} 条/题`)
}

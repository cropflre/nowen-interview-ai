import { randomUUID } from 'node:crypto';
import { initQuest } from './quest.mjs';

const PLAYER = 'local';
const now = () => new Date().toISOString();
export class ProgressionError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

export const PATCHES = Object.freeze([
  { id: 'timer', title: '定时器里的旧状态', knowledgeId: 'interview:react-effects',
    symptom: '计数器每秒触发，但始终显示 1。请挑选修复旧闭包且能正确清理定时器的补丁。',
    code: 'useEffect(() => {\n  const id = setInterval(() => setCount(count + 1), 1000);\n}, []);',
    options: [
      'useEffect(() => { const id = setInterval(() => setCount(c => c + 1), 1000); return () => clearInterval(id); }, []);',
      'useEffect(() => { setInterval(() => setCount(count + 1), 1000); }, [count]);',
      'const id = setInterval(() => { count += 1; }, 1000);',
    ], correct: 0,
    explanation: '函数式更新读取最新排队状态；Effect 返回清理函数避免组件卸载后留下定时器。' },
  { id: 'race', title: '过期搜索结果', knowledgeId: 'interview:eng-debug',
    symptom: '输入 B 后先收到 B 的搜索结果，较慢的 A 却在最后覆盖了页面。',
    code: 'useEffect(() => {\n  fetch(`/search?q=${query}`).then(r => r.json()).then(setResults);\n}, [query]);',
    options: [
      '把 fetch 放进 setTimeout 并把延迟设为 0。',
      'Effect 创建 AbortController，将 signal 交给 fetch，清理时 abort，并忽略取消错误。',
      '删除 query 依赖，让 Effect 只执行一次。',
    ], correct: 1,
    explanation: '取消过期请求或使用请求序号校验，可防止旧响应覆盖新查询。' },
  { id: 'microtask', title: '长时间无响应', knowledgeId: 'interview:js-event-loop',
    symptom: '递归微任务占满检查点，用户点击得不到响应。',
    code: 'function run() {\n  doWork();\n  queueMicrotask(run);\n}\nrun();',
    options: [
      '把 queueMicrotask 换成 Promise.resolve().then(run)。',
      '将所有工作合并进一个同步 while 循环。',
      '把工作拆成有界批次，安排下一任务时让出事件循环，并测量交互延迟。',
    ], correct: 2,
    explanation: '连续续接微任务可能阻塞其他任务和渲染；使用有界批次并适时让出主线程。' },
]);

const SKILLS = Object.freeze([
  { id: 'syntax', title: '语言基础', desc: '作用域与闭包', gates: ['js-scope', 'js-closure'] },
  { id: 'async', title: '异步调度', desc: '事件循环与终局挑战', gates: ['js-async', 'js-boss'] },
  { id: 'engineering', title: '调试实战', desc: '排查代码与修复故障', gates: ['js-debug', 'code-repair'] },
  { id: 'memory', title: '长期记忆', desc: '跨天复测，不靠重复刷题', gates: ['delayed-review'] },
  { id: 'interview', title: '面试表达', desc: '完整回答一场技术面试', gates: ['full-interview'] },
]);
const ACHIEVEMENTS = Object.freeze([
  { id: 'first-step', title: '森林新兵', desc: '首次通过任意关卡', xp: 30 },
  { id: 'forest', title: '森林守护者', desc: '通过五个主线关卡', xp: 100 },
  { id: 'boss-perfect', title: '破盾专家', desc: 'BOSS 战全部答对', xp: 60 },
  { id: 'memory', title: '逆转遗忘', desc: '完成一次成功的跨天复习', xp: 40 },
  { id: 'demon', title: '心魔猎人', desc: '成功净化心魔', xp: 50 },
  { id: 'repair', title: '故障修复师', desc: '通过代码修复挑战', xp: 50 },
  { id: 'interview', title: '面试实战家', desc: '完整完成一次模拟面试', xp: 40 },
]);
const STORIES = Object.freeze([
  { id: 'arrival', title: '序章 · 森林来信', requires: null,
    text: '你的终端收到一封匿名邀请：“森林里的每道谜题，都藏着一次面试时说不清的原理。别急着背答案，先试着解释代码。”' },
  { id: 'scope', title: '第一幕 · 变量的影子', requires: 'js-scope',
    text: '离开第一片林地，你发现名字相同的变量并不是同一个人。下一条路通往闭包陷阱：被函数记住的究竟是什么？' },
  { id: 'async', title: '第二幕 · 异步迷雾', requires: 'js-async',
    text: '你看见 Promise 的微任务先穿过迷雾，定时器随后才抵达。守卫者留下挑战：当任务不停续接，谁还有机会响应用户？' },
  { id: 'finale', title: '终幕 · 守卫者的徽记', requires: 'js-boss',
    text: '守卫者收起护盾：“知道顺序只是开始。要让系统可靠，还得理解竞态、清理与主线程。去修好城门口的三段故障代码吧。”' },
]);

export function initProgression(db) {
  initQuest(db);
  db.exec(`CREATE TABLE IF NOT EXISTS progression_story_read (
    story_id TEXT PRIMARY KEY, read_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS progression_code_runs (
    id TEXT PRIMARY KEY, status TEXT NOT NULL CHECK(status IN ('active','cleared','practice')),
    started_at TEXT NOT NULL, finished_at TEXT, score INTEGER NOT NULL DEFAULT 0,
    earned_xp INTEGER NOT NULL DEFAULT 0
  );
  CREATE UNIQUE INDEX IF NOT EXISTS idx_progression_code_active ON progression_code_runs(status) WHERE status='active';
  CREATE TABLE IF NOT EXISTS progression_code_answers (
    run_id TEXT NOT NULL REFERENCES progression_code_runs(id) ON DELETE CASCADE,
    puzzle_id TEXT NOT NULL, choice INTEGER NOT NULL CHECK(choice BETWEEN 0 AND 2),
    reasoning TEXT NOT NULL, correct INTEGER NOT NULL CHECK(correct IN (0,1)),
    answered_at TEXT NOT NULL, PRIMARY KEY(run_id,puzzle_id)
  );`);
}
function snapshot(db) {
  const clear = new Set(db.prepare('SELECT stage_id FROM game_progress WHERE best_stars > 0').all().map(item => item.stage_id));
  const perfectBoss = Boolean(db.prepare("SELECT 1 FROM game_progress WHERE stage_id='js-boss' AND best_stars=2").get());
  const delayed = Boolean(db.prepare('SELECT 1 FROM review_logs WHERE delayed=1 AND correct=1 LIMIT 1').get());
  const demon = Boolean(db.prepare("SELECT 1 FROM demon_encounters WHERE status='cleared' LIMIT 1").get());
  const repaired = Boolean(db.prepare("SELECT 1 FROM progression_code_runs WHERE status='cleared' LIMIT 1").get());
  const interview = Boolean(db.prepare(`SELECT 1 FROM sessions s WHERE s.status='completed'
    AND EXISTS (SELECT 1 FROM turns t WHERE t.session_id=s.id AND t.answer IS NOT NULL)
    AND NOT EXISTS (SELECT 1 FROM turns t WHERE t.session_id=s.id AND t.answer IS NULL) LIMIT 1`).get());
  const passed = id => id === 'code-repair' ? repaired : id === 'delayed-review' ? delayed : id === 'full-interview' ? interview : clear.has(id);
  return { clear, passed, perfectBoss, delayed, demon, repaired, interview };
}
export function progressionDashboard(db) {
  initProgression(db);
  const data = snapshot(db);
  const skillTree = SKILLS.map(skill => ({ ...skill, completed: skill.gates.filter(data.passed).length,
    total: skill.gates.length, unlocked: skill.gates.every(data.passed),
    note: '仅展示训练里程碑，不代表实际岗位技能认证。' }));
  const unlocks = { 'first-step': data.clear.size > 0, forest: data.clear.size === 5,
    'boss-perfect': data.perfectBoss, memory: data.delayed, demon: data.demon,
    repair: data.repaired, interview: data.interview };
  const achievements = ACHIEVEMENTS.map(item => ({ ...item, unlocked: unlocks[item.id],
    claimed: Boolean(db.prepare('SELECT 1 FROM game_rewards WHERE event_key=?').get(`achievement:${item.id}`)) }));
  const stories = STORIES.map(story => ({ ...story, unlocked: story.requires === null || data.clear.has(story.requires),
    read: Boolean(db.prepare('SELECT 1 FROM progression_story_read WHERE story_id=?').get(story.id)),
    text: story.requires === null || data.clear.has(story.requires) ? story.text : null }));
  const last = db.prepare("SELECT id FROM progression_code_runs WHERE status='active' LIMIT 1").get();
  const best = db.prepare("SELECT MAX(score) AS score FROM progression_code_runs WHERE status='cleared'").get();
  return { skills: skillTree, achievements, stories,
    code: { unlocked: data.clear.has('js-debug'), activeId: last?.id ?? null,
      cleared: data.repaired, bestScore: best.score, total: PATCHES.length,
      notice: '安全的静态补丁选择练习：不会执行或沙箱运行用户代码；解释只做记录，不参与自动判分。' },
    player: db.prepare('SELECT xp FROM game_players WHERE id=?').get(PLAYER) };
}
export function readStory(db, id) {
  initProgression(db);
  const story = STORIES.find(item => item.id === id);
  if (!story) throw new ProgressionError('剧情不存在', 404);
  if (story.requires && !snapshot(db).clear.has(story.requires)) throw new ProgressionError('剧情尚未解锁', 409);
  db.prepare('INSERT OR IGNORE INTO progression_story_read(story_id,read_at) VALUES (?,?)').run(id, now());
  return { id, title: story.title, text: story.text, read: true };
}
export function claimAchievement(db, id) {
  if (!ACHIEVEMENTS.some(item => item.id === id)) throw new ProgressionError('成就不存在', 404);
  initProgression(db);
  db.exec('BEGIN IMMEDIATE');
  try {
    const item = progressionDashboard(db).achievements.find(entry => entry.id === id);
    if (!item.unlocked) throw new ProgressionError('成就条件尚未达成', 409);
    const key = `achievement:${id}`;
    const changed = db.prepare('INSERT OR IGNORE INTO game_rewards(event_key,amount,created_at) VALUES (?,?,?)').run(key, item.xp, now()).changes;
    if (changed) db.prepare('UPDATE game_players SET xp=xp+? WHERE id=?').run(item.xp, PLAYER);
    db.exec('COMMIT');
    return { id, claimed: true, earnedXp: changed ? item.xp : 0,
      xp: db.prepare('SELECT xp FROM game_players WHERE id=?').get(PLAYER).xp };
  } catch (error) { db.exec('ROLLBACK'); throw error; }
}
function codeRow(db, id) {
  if (typeof id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f-]{27}$/.test(id)) throw new ProgressionError('无效代码挑战记录', 404);
  const run = db.prepare('SELECT * FROM progression_code_runs WHERE id=?').get(id);
  if (!run) throw new ProgressionError('代码挑战记录不存在', 404);
  return run;
}
export function codeRun(db, id) {
  initProgression(db);
  const run = codeRow(db, id);
  const answered = db.prepare('SELECT * FROM progression_code_answers WHERE run_id=? ORDER BY answered_at,rowid').all(id);
  const current = PATCHES[answered.length];
  return { id, status: run.status, answered: answered.length, total: PATCHES.length,
    current: run.status === 'active' && current ? { id: current.id, title: current.title, symptom: current.symptom, code: current.code, options: current.options } : null,
    feedback: answered.map(record => { const puzzle = PATCHES.find(item => item.id === record.puzzle_id);
      return { puzzleId: record.puzzle_id, title: puzzle.title, choice: record.choice, correct: Boolean(record.correct),
        correctChoice: puzzle.correct, explanation: puzzle.explanation, reasoning: record.reasoning }; }),
    score: run.score, earnedXp: run.earned_xp,
    notice: '补丁选择是静态知识测验，不会运行代码，也不会验证你输入的解释。' };
}
export function startCodeRun(db) {
  initProgression(db);
  db.exec('BEGIN IMMEDIATE');
  try {
    if (!db.prepare("SELECT 1 FROM game_progress WHERE stage_id='js-debug' AND best_stars>0").get())
      throw new ProgressionError('先通关「代码侦探」再解锁修复副本', 409);
    const existing = db.prepare("SELECT id FROM progression_code_runs WHERE status='active'").get();
    const id = existing?.id ?? randomUUID();
    if (!existing) db.prepare("INSERT INTO progression_code_runs(id,status,started_at) VALUES (?,'active',?)").run(id, now());
    db.exec('COMMIT');
    return codeRun(db, id);
  } catch (error) { db.exec('ROLLBACK'); throw error; }
}
export function answerCodeRun(db, id, input = {}) {
  if (typeof input.puzzleId !== 'string' || !Number.isInteger(input.choice) || input.choice < 0 || input.choice > 2 ||
      typeof (input.reasoning ?? '') !== 'string' || (input.reasoning ?? '').length > 2000)
    throw new ProgressionError('请选择补丁，解释不能超过 2000 字');
  initProgression(db);
  db.exec('BEGIN IMMEDIATE');
  try {
    const run = codeRow(db, id);
    if (run.status !== 'active') throw new ProgressionError('挑战已结算，不能重复提交', 409);
    const previous = db.prepare('SELECT correct FROM progression_code_answers WHERE run_id=? ORDER BY answered_at,rowid').all(id);
    const puzzle = PATCHES[previous.length];
    if (!puzzle || puzzle.id !== input.puzzleId) throw new ProgressionError('关卡已经更新，请刷新后重试', 409);
    const correct = Number(input.choice === puzzle.correct);
    db.prepare('INSERT INTO progression_code_answers(run_id,puzzle_id,choice,reasoning,correct,answered_at) VALUES (?,?,?,?,?,?)')
      .run(id, puzzle.id, input.choice, (input.reasoning ?? '').trim(), correct, now());
    if (!correct) db.prepare('INSERT OR IGNORE INTO review_items(knowledge_id,due_on) SELECT id,? FROM knowledge_points WHERE id=?')
      .run(now().slice(0, 10), puzzle.knowledgeId);
    if (previous.length + 1 === PATCHES.length) {
      const score = previous.reduce((n, item) => n + item.correct, correct);
      const cleared = score >= 2;
      let xp = 0;
      if (cleared) {
        const first = db.prepare('INSERT OR IGNORE INTO game_rewards(event_key,amount,created_at) VALUES (?,?,?)')
          .run('code:first', 120, now()).changes;
        if (first) xp += 120;
        if (score === PATCHES.length) {
          const perfect = db.prepare('INSERT OR IGNORE INTO game_rewards(event_key,amount,created_at) VALUES (?,?,?)')
            .run('code:perfect', 30, now()).changes;
          if (perfect) xp += 30;
        }
        if (xp) db.prepare('UPDATE game_players SET xp=xp+? WHERE id=?').run(xp, PLAYER);
      }
      db.prepare('UPDATE progression_code_runs SET status=?, score=?, earned_xp=?, finished_at=? WHERE id=?')
        .run(cleared ? 'cleared' : 'practice', score, xp, now(), id);
    }
    db.exec('COMMIT');
    return codeRun(db, id);
  } catch (error) { db.exec('ROLLBACK'); throw error; }
}

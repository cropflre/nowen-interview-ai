import { randomUUID } from 'node:crypto';
import { initGame } from './game.mjs';
import { startReview, getAttempt } from './memory.mjs';

// Same UTC day convention as the existing game and memory engines.
const day = () => new Date().toISOString().slice(0, 10);
const now = () => new Date().toISOString();
const TASKS = Object.freeze([
  { id: 'stage', title: '完成一次冒险', description: '通关任意已解锁关卡（重玩也计入任务）', goal: 1, xp: 25 },
  { id: 'review', title: '完成一次记忆修炼', description: '独立回答、揭晓并完成自评', goal: 1, xp: 20 },
  { id: 'interview', title: '完成一次模拟面试', description: '完整完成或主动结束一次面试', goal: 1, xp: 40 },
  { id: 'demon', title: '净化心魔', description: '完成心魔挑战且所有知识卡核对通过', goal: 1, xp: 60 },
]);
export class QuestError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
export function initQuest(db) {
  initGame(db);
  db.exec(`CREATE TABLE IF NOT EXISTS demon_encounters (
    id TEXT PRIMARY KEY,
    day TEXT NOT NULL,
    knowledge_ids TEXT NOT NULL,
    cursor INTEGER NOT NULL DEFAULT 0,
    correct_count INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','cleared','practice')),
    started_at TEXT NOT NULL,
    finished_at TEXT
  );
  CREATE UNIQUE INDEX IF NOT EXISTS idx_demon_active_day ON demon_encounters(day) WHERE status='active';
  CREATE INDEX IF NOT EXISTS idx_demon_day ON demon_encounters(day, status);`);
}
function eligible(db) {
  return db.prepare(`SELECT k.id, k.category, k.prompt, k.source, r.lapses, r.due_on
    FROM review_items r JOIN knowledge_points k ON k.id=r.knowledge_id
    WHERE r.due_on <= ? AND (r.lapses > 0 OR r.attempts = 0 OR EXISTS (
      SELECT 1 FROM review_logs l WHERE l.knowledge_id=k.id AND l.correct=0
    ))
    ORDER BY r.lapses DESC, r.due_on, k.id LIMIT 30`).all(day());
}
function progress(db, date) {
  return {
    stage: db.prepare("SELECT COUNT(*) AS n FROM game_attempts WHERE status='cleared' AND substr(finished_at,1,10)=?").get(date).n,
    review: db.prepare('SELECT COUNT(*) AS n FROM review_logs WHERE substr(created_at,1,10)=?').get(date).n,
    interview: db.prepare("SELECT COUNT(*) AS n FROM sessions WHERE status='completed' AND substr(completed_at,1,10)=?").get(date).n,
    demon: db.prepare("SELECT COUNT(*) AS n FROM demon_encounters WHERE status='cleared' AND day=?").get(date).n,
  };
}
export function dailyDashboard(db) {
  initQuest(db);
  const date = day();
  const done = progress(db, date);
  const tasks = TASKS.map(task => ({
    ...task, progress: Math.min(task.goal, done[task.id]),
    completed: done[task.id] >= task.goal,
    claimed: Boolean(db.prepare('SELECT 1 FROM game_rewards WHERE event_key=?').get(`daily:${date}:${task.id}`)),
  }));
  const active = db.prepare("SELECT id FROM demon_encounters WHERE status='active' ORDER BY started_at DESC LIMIT 1").get();
  return { day: date, tasks, completed: tasks.filter(t => t.completed).length,
    claimed: tasks.filter(t => t.claimed).length, demons: eligible(db).slice(0, 3),
    activeEncounterId: active?.id ?? null, notice: '每日任务按 UTC 日期重置。未完成不会扣除等级、金币或经验。' };
}
export function claimDaily(db, taskId) {
  if (typeof taskId !== 'string' || !TASKS.some(task => task.id === taskId)) throw new QuestError('未知每日任务', 404);
  initQuest(db);
  db.exec('BEGIN IMMEDIATE');
  try {
    const date = day();
    const task = TASKS.find(item => item.id === taskId);
    if (progress(db, date)[taskId] < task.goal) throw new QuestError('尚未完成该任务', 409);
    const key = `daily:${date}:${taskId}`;
    const changed = db.prepare('INSERT OR IGNORE INTO game_rewards(event_key,amount,created_at) VALUES (?,?,?)')
      .run(key, task.xp, now()).changes;
    if (changed) db.prepare('UPDATE game_players SET xp=xp+? WHERE id=?').run(task.xp, 'local');
    db.exec('COMMIT');
    return { taskId, claimed: true, earnedXp: changed ? task.xp : 0,
      xp: db.prepare('SELECT xp FROM game_players WHERE id=?').get('local').xp };
  } catch (error) { db.exec('ROLLBACK'); throw error; }
}
function rowOf(db, id) {
  if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/.test(id)) throw new QuestError('无效心魔挑战', 404);
  const row = db.prepare('SELECT * FROM demon_encounters WHERE id=?').get(id);
  if (!row) throw new QuestError('心魔挑战不存在', 404);
  return row;
}
export function getDemon(db, id) {
  initQuest(db);
  const row = rowOf(db, id);
  const knowledgeIds = JSON.parse(row.knowledge_ids);
  const knowledgeId = knowledgeIds[row.cursor];
  let current = null;
  if (row.status === 'active' && knowledgeId) {
    const knowledge = db.prepare('SELECT id,category,prompt,source FROM knowledge_points WHERE id=?').get(knowledgeId);
    const attempt = db.prepare(`SELECT id FROM review_attempts WHERE knowledge_id=? AND
      (started_at >= ? OR completed_at >= ? OR phase != 'completed') ORDER BY started_at DESC LIMIT 1`)
      .get(knowledgeId, row.started_at, row.started_at);
    current = { ...knowledge, attempt: attempt ? getAttempt(db, attempt.id) : null };
  }
  return { id: row.id, day: row.day, status: row.status, cursor: row.cursor,
    total: knowledgeIds.length, correctCount: row.correct_count, current,
    notice: '心魔只使用原有复习作答与日志；自评不等于客观的事实正确率。' };
}
export function startDemon(db) {
  initQuest(db);
  const date = day();
  const existing = db.prepare("SELECT id FROM demon_encounters WHERE day=? AND status='active'").get(date);
  if (existing) return getDemon(db, existing.id);
  const selected = eligible(db).slice(0, 3);
  if (!selected.length) throw new QuestError('当前没有到期的薄弱知识；先闯关、复习或参加面试。', 409);
  const id = randomUUID();
  db.exec('BEGIN IMMEDIATE');
  try {
    const racing = db.prepare("SELECT id FROM demon_encounters WHERE day=? AND status='active'").get(date);
    if (racing) { db.exec('COMMIT'); return getDemon(db, racing.id); }
    db.prepare('INSERT INTO demon_encounters(id,day,knowledge_ids,started_at) VALUES (?,?,?,?)')
      .run(id, date, JSON.stringify(selected.map(item => item.id)), now());
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
  startReview(db, selected[0].id);
  return getDemon(db, id);
}
export function advanceDemon(db, id, attemptId) {
  initQuest(db);
  if (typeof attemptId !== 'string' || !/^[0-9a-f-]{36}$/.test(attemptId)) throw new QuestError('无效复习记录');
  db.exec('BEGIN IMMEDIATE');
  let nextId = null;
  try {
    const row = rowOf(db, id);
    if (row.status !== 'active') throw new QuestError('该挑战已经结算', 409);
    const ids = JSON.parse(row.knowledge_ids);
    const expected = ids[row.cursor];
    const attempt = db.prepare("SELECT * FROM review_attempts WHERE id=? AND knowledge_id=? AND phase='completed' AND completed_at >= ?")
      .get(attemptId, expected, row.started_at);
    if (!attempt) throw new QuestError('请先完成当前知识卡的独立回答与自评', 409);
    const log = db.prepare('SELECT correct FROM review_logs WHERE attempt_id=? AND knowledge_id=?').get(attemptId, expected);
    if (!log) throw new QuestError('当前知识卡缺少有效结算记录', 409);
    const cursor = row.cursor + 1;
    const correct = row.correct_count + Number(log.correct);
    const last = cursor === ids.length;
    nextId = last ? null : ids[cursor];
    const status = last ? (correct === ids.length ? 'cleared' : 'practice') : 'active';
    db.prepare("UPDATE demon_encounters SET cursor=?, correct_count=?, status=?, finished_at=? WHERE id=? AND status='active'")
      .run(cursor, correct, status, last ? now() : null, id);
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
  if (nextId) startReview(db, nextId);
  return getDemon(db, id);
}

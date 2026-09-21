import { randomUUID } from 'node:crypto';
import { QUESTIONS } from './questions.mjs';
import { AppError } from './core.mjs';

const INTERVALS = [1, 3, 7, 14, 30];
const RATINGS = new Set(['forgot', 'hard', 'good', 'easy']);
const dateOf = (date) => date.toISOString().slice(0, 10);
const today = () => dateOf(new Date());
const addDays = (date, days) => dateOf(new Date(new Date(`${date}T00:00:00.000Z`).getTime() + days * 86400000));
const toPublic = (row) => ({ id: row.id, category: row.category, prompt: row.prompt, source: row.source,
  status: row.interval_index === null ? 'new' : statusOf(row), dueOn: row.due_on, lapses: row.lapses ?? 0 });

export function statusOf(item) {
  if (item.interval_index >= 4 && item.delayed_success >= 3) return 'stable';
  if (item.interval_index >= 2 && item.delayed_success >= 1) return 'consolidating';
  if (item.interval_index >= 1) return 'recent';
  return 'learning';
}

export function scheduleReview({ intervalIndex = -1, delayedSuccess = 0, lapses = 0, rating, covered, delayed, at = today() }) {
  if (!RATINGS.has(rating) || typeof covered !== 'boolean') throw new AppError('请选择有效的自评并核对关键点');
  const correct = covered && rating !== 'forgot';
  if (!correct) return { intervalIndex: 0, delayedSuccess: 0, lapses: lapses + 1, dueOn: addDays(at, 1), correct };
  const nextSuccess = delayedSuccess + Number(delayed);
  const nextIdx = rating === 'hard' ? Math.max(0, intervalIndex)
    : rating === 'easy' && delayed && nextSuccess >= 2 ? intervalIndex + 2
      : intervalIndex + 1;
  const idx = Math.max(0, Math.min(INTERVALS.length - 1, nextIdx));
  return { intervalIndex: idx, delayedSuccess: nextSuccess, lapses, dueOn: addDays(at, INTERVALS[idx]), correct };
}

export function initMemory(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS knowledge_points (
      id TEXT PRIMARY KEY, category TEXT NOT NULL, prompt TEXT NOT NULL, reference TEXT NOT NULL,
      source TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS review_items (
      knowledge_id TEXT PRIMARY KEY REFERENCES knowledge_points(id) ON DELETE CASCADE,
      interval_index INTEGER NOT NULL DEFAULT -1, delayed_success INTEGER NOT NULL DEFAULT 0,
      lapses INTEGER NOT NULL DEFAULT 0, attempts INTEGER NOT NULL DEFAULT 0,
      due_on TEXT NOT NULL, last_review_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_review_due ON review_items(due_on);
    CREATE TABLE IF NOT EXISTS review_attempts (
      id TEXT PRIMARY KEY, knowledge_id TEXT NOT NULL REFERENCES knowledge_points(id),
      phase TEXT NOT NULL CHECK(phase IN ('question','revealed','completed')),
      answer TEXT, started_at TEXT NOT NULL, revealed_at TEXT, completed_at TEXT
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_one_open_attempt ON review_attempts(knowledge_id)
      WHERE phase != 'completed';
    CREATE TABLE IF NOT EXISTS review_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      attempt_id TEXT NOT NULL UNIQUE REFERENCES review_attempts(id),
      knowledge_id TEXT NOT NULL REFERENCES knowledge_points(id),
      rating TEXT NOT NULL, covered INTEGER NOT NULL, delayed INTEGER NOT NULL,
      correct INTEGER NOT NULL, due_on TEXT NOT NULL, created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_review_logs_date ON review_logs(created_at);`);
  const insert = db.prepare(`INSERT OR IGNORE INTO knowledge_points (id, category, prompt, reference, source)
    VALUES (?, ?, ?, ?, 'interview-checklist')`);
  for (const question of QUESTIONS) {
    const checklist = ['本卡仅是面试要点清单，不是经过人工校验的完整标准答案。',
      ...question.rubric.map((item) => `• ${item.label}`),
      ...question.followups.flatMap((followup) => [`追问：${followup.prompt}`, ...followup.rubric.map((item) => `• ${item.label}`)])].join('\n');
    insert.run(`interview:${question.id}`, question.track, question.prompt, checklist);
  }
}

export function importKnowledge(db, items) {
  if (!Array.isArray(items) || items.length > 5000) throw new AppError('无效题库');
  const statement = db.prepare(`INSERT INTO knowledge_points (id, category, prompt, reference, source)
    VALUES (?, ?, ?, ?, 'legacy-unreviewed') ON CONFLICT(id) DO NOTHING`);
  let added = 0;
  db.exec('BEGIN IMMEDIATE');
  try {
    for (const item of items) {
      if (!/^legacy:[a-z0-9_-]{1,80}$/i.test(item.id) || !item.prompt?.trim() || !item.reference?.trim() ||
        item.prompt.length > 1000 || item.reference.length > 10000 || typeof item.category !== 'string' || item.category.length > 80) {
        throw new AppError('题库存在无效条目');
      }
      added += Number(statement.run(item.id, item.category, item.prompt, item.reference).changes);
    }
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
  return { added, total: items.length };
}

export function knowledgeCatalog(db, query = '') {
  if (typeof query !== 'string' || query.length > 100) throw new AppError('搜索词过长');
  return db.prepare(`SELECT k.id, k.category, k.prompt, k.source, r.interval_index, r.delayed_success,
      r.due_on, r.lapses FROM knowledge_points k LEFT JOIN review_items r ON r.knowledge_id = k.id
      WHERE k.prompt LIKE ? OR k.category LIKE ? ORDER BY k.category, k.id LIMIT 200`).all(`%${query}%`, `%${query}%`).map(toPublic);
}

export function reviewQueue(db) {
  const date = today();
  const due = db.prepare(`SELECT k.id, k.category, k.prompt, k.source, r.interval_index, r.delayed_success, r.due_on, r.lapses
      FROM review_items r JOIN knowledge_points k ON k.id = r.knowledge_id
      WHERE r.due_on <= ? AND NOT EXISTS (SELECT 1 FROM review_attempts a WHERE a.knowledge_id = k.id AND a.phase != 'completed')
      ORDER BY r.due_on, r.lapses DESC, k.id LIMIT 40`).all(date).map(toPublic);
  const fresh = db.prepare(`SELECT k.id, k.category, k.prompt, k.source, NULL AS interval_index, NULL AS delayed_success,
      NULL AS due_on, NULL AS lapses FROM knowledge_points k
      WHERE NOT EXISTS (SELECT 1 FROM review_items r WHERE r.knowledge_id = k.id)
      AND NOT EXISTS (SELECT 1 FROM review_attempts a WHERE a.knowledge_id = k.id AND a.phase != 'completed')
      ORDER BY CASE WHEN k.source = 'interview-checklist' THEN 1 ELSE 0 END, k.id LIMIT 5`).all().map(toPublic);
  return { date, due, fresh };
}

export function reviewDashboard(db) {
  const date = today();
  const totals = db.prepare(`SELECT (SELECT COUNT(*) FROM knowledge_points) AS total,
    COUNT(*) AS enrolled,
    COALESCE(SUM(CASE WHEN due_on <= ? THEN 1 ELSE 0 END),0) AS due,
    COALESCE(SUM(CASE WHEN interval_index >= 4 AND delayed_success >= 3 THEN 1 ELSE 0 END),0) AS stable,
    COALESCE(SUM(CASE WHEN due_on < ? THEN 1 ELSE 0 END),0) AS overdue
    FROM review_items`).get(date, date);
  const delayed = db.prepare('SELECT COUNT(*) AS attempts, COALESCE(SUM(correct),0) AS correct FROM review_logs WHERE delayed = 1').get();
  const recentLapses = db.prepare("SELECT COUNT(*) AS total FROM review_logs WHERE correct = 0 AND created_at >= datetime('now', '-7 days')").get().total;
  return { ...totals, delayedAttempts: delayed.attempts, delayedRate: delayed.attempts ? Math.round(100 * delayed.correct / delayed.attempts) : null, recentLapses };
}

const getAttemptRow = (db, id) => {
  const row = db.prepare(`SELECT a.*, k.category, k.prompt, k.reference, k.source, r.interval_index, r.delayed_success, r.lapses,
      r.due_on, r.last_review_at FROM review_attempts a
      JOIN knowledge_points k ON k.id = a.knowledge_id
      LEFT JOIN review_items r ON r.knowledge_id = k.id WHERE a.id = ?`).get(id);
  if (!row) throw new AppError('复习记录不存在', 404);
  return row;
};
const publicAttempt = (row) => ({ id: row.id, knowledgeId: row.knowledge_id, phase: row.phase,
  prompt: row.prompt, category: row.category, source: row.source, answer: row.answer,
  ...(row.phase !== 'question' ? { reference: row.reference } : {}) });
export function getAttempt(db, id) { return publicAttempt(getAttemptRow(db, id)); }

export function startReview(db, knowledgeId) {
  if (typeof knowledgeId !== 'string' || knowledgeId.length > 100) throw new AppError('无效知识点');
  const existing = db.prepare("SELECT id FROM review_attempts WHERE knowledge_id = ? AND phase != 'completed'").get(knowledgeId);
  if (existing) return getAttempt(db, existing.id);
  const item = db.prepare('SELECT id FROM knowledge_points WHERE id = ?').get(knowledgeId);
  if (!item) throw new AppError('知识点不存在', 404);
  const id = randomUUID();
  try {
    db.prepare("INSERT INTO review_attempts (id, knowledge_id, phase, started_at) VALUES (?, ?, 'question', ?)")
      .run(id, knowledgeId, new Date().toISOString());
  } catch (error) {
    const concurrent = db.prepare("SELECT id FROM review_attempts WHERE knowledge_id = ? AND phase != 'completed'").get(knowledgeId);
    if (concurrent) return getAttempt(db, concurrent.id);
    throw error;
  }
  return getAttempt(db, id);
}

export function revealReview(db, id, input = {}) {
  if (typeof input.answer !== 'string' || !input.answer.trim() || input.answer.length > 4000) throw new AppError('请先独立回答，或填写「不会」（最多 4000 字）');
  const result = db.prepare("UPDATE review_attempts SET phase = 'revealed', answer = ?, revealed_at = ? WHERE id = ? AND phase = 'question'")
    .run(input.answer.trim(), new Date().toISOString(), id);
  if (!result.changes) { getAttemptRow(db, id); throw new AppError('该题已经揭晓，不能修改答案', 409); }
  return getAttempt(db, id);
}

export function completeReview(db, id, input = {}) {
  if (!RATINGS.has(input.rating) || typeof input.covered !== 'boolean') throw new AppError('请核对关键点并选择自评');
  db.exec('BEGIN IMMEDIATE');
  try {
    const attempt = getAttemptRow(db, id);
    if (attempt.phase !== 'revealed') throw new AppError('请先独立作答并揭晓答案', 409);
    const currentDate = today();
    const delayed = !!attempt.last_review_at && dateOf(new Date(attempt.last_review_at)) < currentDate;
    const result = scheduleReview({ intervalIndex: attempt.interval_index ?? -1,
      delayedSuccess: attempt.delayed_success ?? 0, lapses: attempt.lapses ?? 0,
      rating: input.rating, covered: input.covered, delayed, at: currentDate });
    const now = new Date().toISOString();
    db.prepare(`INSERT INTO review_items (knowledge_id, interval_index, delayed_success, lapses, attempts, due_on, last_review_at)
      VALUES (?, ?, ?, ?, 1, ?, ?)
      ON CONFLICT(knowledge_id) DO UPDATE SET interval_index=excluded.interval_index,
      delayed_success=excluded.delayed_success, lapses=excluded.lapses, attempts=review_items.attempts+1,
      due_on=excluded.due_on, last_review_at=excluded.last_review_at`)
      .run(attempt.knowledge_id, result.intervalIndex, result.delayedSuccess, result.lapses, result.dueOn, now);
    db.prepare('INSERT INTO review_logs (attempt_id, knowledge_id, rating, covered, delayed, correct, due_on, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(id, attempt.knowledge_id, input.rating, Number(input.covered), Number(delayed), Number(result.correct), result.dueOn, now);
    db.prepare("UPDATE review_attempts SET phase='completed', completed_at=? WHERE id=?").run(now, id);
    db.exec('COMMIT');
    return { ...result, delayed, status: statusOf({ interval_index: result.intervalIndex, delayed_success: result.delayedSuccess }) };
  } catch (error) { db.exec('ROLLBACK'); throw error; }
}

export function enrollInterviewGaps(db, sessionId) {
  const turns = db.prepare('SELECT question_id, feedback_json FROM turns WHERE session_id = ? AND answer IS NOT NULL').all(sessionId);
  const weakIds = new Set(turns.filter((t) => t.feedback_json && JSON.parse(t.feedback_json).missing.length).map((t) => `interview:${t.question_id}`));
  const insert = db.prepare('INSERT OR IGNORE INTO review_items (knowledge_id, due_on) VALUES (?, ?)');
  let added = 0;
  for (const id of weakIds) added += Number(insert.run(id, today()).changes);
  return added;
}

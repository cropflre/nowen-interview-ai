import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { QUESTIONS, TRACKS, questionById, selectQuestions } from './questions.mjs';

export class AppError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

export function createDatabase(filename = ':memory:') {
  if (filename !== ':memory:') mkdirSync(dirname(filename), { recursive: true });
  const db = new DatabaseSync(filename, { timeout: 5000 });
  db.exec(`PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY, track TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('active','completed')),
      question_ids TEXT NOT NULL, created_at TEXT NOT NULL, completed_at TEXT
    );
    CREATE TABLE IF NOT EXISTS turns (
      id INTEGER PRIMARY KEY AUTOINCREMENT, session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      question_id TEXT NOT NULL, depth INTEGER NOT NULL, prompt TEXT NOT NULL,
      answer TEXT, feedback_json TEXT, created_at TEXT NOT NULL, answered_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_turns_session ON turns(session_id, id);
    CREATE INDEX IF NOT EXISTS idx_sessions_created ON sessions(created_at DESC);`);
  if (filename !== ':memory:') db.exec('PRAGMA journal_mode = WAL');
  return db;
}

export function catalog() {
  return { tracks: [{ id: 'all', label: '前端综合面试', description: '五大领域综合考查' }, ...TRACKS], questionCount: QUESTIONS.length };
}

const load = (db, id) => {
  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(id);
  if (!session) throw new AppError('面试记录不存在', 404);
  const turns = db.prepare('SELECT * FROM turns WHERE session_id = ? ORDER BY id').all(id).map((turn) => ({
    id: turn.id, questionId: turn.question_id, depth: turn.depth, prompt: turn.prompt,
    answer: turn.answer, feedback: turn.feedback_json ? JSON.parse(turn.feedback_json) : null,
    createdAt: turn.created_at, answeredAt: turn.answered_at,
  }));
  return { id: session.id, track: session.track, status: session.status,
    questionCount: JSON.parse(session.question_ids).length, createdAt: session.created_at,
    completedAt: session.completed_at, turns };
};

export function getSession(db, id) {
  const session = load(db, id);
  // During the interview, do not expose rubric, answers or immediate scoring.
  if (session.status === 'active') {
    return { ...session, turns: session.turns.map(({ feedback, ...turn }) => turn), currentTurn: session.turns.find((turn) => turn.answer === null)?.id ?? null };
  }
  return { ...session, report: report(session) };
}

function insertTurn(db, sessionId, question, depth, focus = null) {
  const step = depth === 0 ? { prompt: question.prompt } : question.followups[depth - 1];
  db.prepare('INSERT INTO turns (session_id, question_id, depth, prompt, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(sessionId, question.id, depth, focus ? `刚才的回答尚未明确涉及「${focus}」。请先补充，再回答：${step.prompt}` : step.prompt, new Date().toISOString());
}

export function startSession(db, input = {}) {
  const track = input.track ?? 'all';
  const count = track === 'all' ? 5 : 3;
  let questions;
  try { questions = selectQuestions(track, count); } catch { throw new AppError('请选择有效的面试方向'); }
  if (!questions.length) throw new AppError('当前方向暂无题目');
  const id = randomUUID();
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare('INSERT INTO sessions (id, track, status, question_ids, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(id, track, 'active', JSON.stringify(questions.map((question) => question.id)), new Date().toISOString());
    insertTurn(db, id, questions[0], 0);
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
  return getSession(db, id);
}

export function assess(text, rubric) {
  // Transparent keyword coverage is a *practice checklist*, not semantic AI grading.
  const normalized = text.normalize('NFKC').toLowerCase();
  const matched = rubric.filter((item) => item.terms.some((term) => normalized.includes(term.toLowerCase()))).map((item) => item.label);
  const missing = rubric.filter((item) => !matched.includes(item.label)).map((item) => item.label);
  return { matched, missing, covered: matched.length, total: rubric.length,
    notice: '仅根据预设关键词检查覆盖情况，不能证明技术正确性；请结合参考要点自行复核。' };
}

export function answerSession(db, id, input = {}) {
  const answer = input.answer;
  if (typeof answer !== 'string' || !answer.trim() || answer.length > 4000) throw new AppError('回答不能为空，且不能超过 4000 字');
  if (!Number.isSafeInteger(input.turnId)) throw new AppError('无效的题目 ID');
  db.exec('BEGIN IMMEDIATE');
  try {
    const session = load(db, id);
    if (session.status !== 'active') throw new AppError('面试已结束，不能继续提交', 409);
    const current = session.turns.find((turn) => turn.answer === null);
    if (!current || current.id !== input.turnId) throw new AppError('题目已更新，请刷新后重试', 409);
    const question = questionById.get(current.questionId);
    const rubric = current.depth === 0 ? question.rubric : question.followups[current.depth - 1].rubric;
    const feedback = assess(answer.trim(), rubric);
    db.prepare('UPDATE turns SET answer = ?, feedback_json = ?, answered_at = ? WHERE id = ? AND answer IS NULL')
      .run(answer.trim(), JSON.stringify(feedback), new Date().toISOString(), current.id);
    if (current.depth < question.followups.length) {
      insertTurn(db, id, question, current.depth + 1, feedback.missing[0] ?? null);
    } else {
      const questionIds = JSON.parse(db.prepare('SELECT question_ids FROM sessions WHERE id = ?').get(id).question_ids);
      const next = questionIds.indexOf(current.questionId) + 1;
      if (next < questionIds.length) insertTurn(db, id, questionById.get(questionIds[next]), 0);
      else db.prepare("UPDATE sessions SET status = 'completed', completed_at = ? WHERE id = ?")
        .run(new Date().toISOString(), id);
    }
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
  return getSession(db, id);
}

export function finishSession(db, id) {
  db.prepare("UPDATE sessions SET status = 'completed', completed_at = ? WHERE id = ? AND status = 'active'")
    .run(new Date().toISOString(), id);
  return getSession(db, id);
}

export function listSessions(db) {
  return db.prepare(`SELECT s.id, s.track, s.status, s.created_at AS createdAt, s.completed_at AS completedAt,
    (SELECT COUNT(*) FROM turns t WHERE t.session_id = s.id AND t.answer IS NOT NULL) AS answeredTurns
    FROM sessions s ORDER BY s.created_at DESC, s.rowid DESC LIMIT 30`).all();
}

export function report(session) {
  const answered = session.turns.filter((turn) => turn.answer !== null);
  const total = answered.reduce((sum, turn) => sum + turn.feedback.total, 0);
  const covered = answered.reduce((sum, turn) => sum + turn.feedback.covered, 0);
  const gaps = [...new Set(answered.flatMap((turn) => turn.feedback.missing))];
  return { answeredTurns: answered.length, plannedTurns: session.questionCount * 3,
    covered, total, coverage: total ? Math.round(100 * covered / total) : null,
    gaps, notice: '覆盖率仅反映关键词命中，不是事实正确率，也不预测真实面试结果。' };
}

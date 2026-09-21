import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createDatabase, startSession, answerSession, finishSession } from './core.mjs';
import { reviewDashboard, reviewQueue, startReview, revealReview, completeReview, getAttempt,
  scheduleReview, knowledgeCatalog, importKnowledge } from './memory.mjs';
import { createAppServer } from './index.mjs';

const setup = () => createDatabase();

test('knowledge is seeded once and reference never leaks before reveal', () => {
  const db = setup();
  assert.equal(reviewDashboard(db).total, 15);
  const fresh = reviewQueue(db).fresh;
  assert.equal(fresh.length, 5);
  assert.equal('reference' in fresh[0], false);
  let attempt = startReview(db, fresh[0].id);
  assert.equal(attempt.phase, 'question');
  assert.equal(attempt.reference, undefined);
  assert.equal(startReview(db, fresh[0].id).id, attempt.id);
  assert.throws(() => completeReview(db, attempt.id, { rating: 'easy', covered: true }), /揭晓/);
  assert.throws(() => revealReview(db, attempt.id, { answer: '  ' }), /独立回答/);
  attempt = revealReview(db, attempt.id, { answer: '我先说原理' });
  assert.match(attempt.reference, /关键点|清单/);
  assert.equal(attempt.answer, '我先说原理');
  assert.throws(() => revealReview(db, attempt.id, { answer: '作弊重写' }), /不能修改/);
  assert.equal(getAttempt(db, attempt.id).answer, '我先说原理');
  const done = completeReview(db, attempt.id, { rating: 'easy', covered: false });
  assert.equal(done.correct, false);
  assert.equal(done.status, 'learning');
  assert.throws(() => completeReview(db, attempt.id, { rating: 'easy', covered: true }), /揭晓/);
  assert.equal(reviewDashboard(db).enrolled, 1);
  assert.equal(reviewQueue(db).due.length, 0);
  db.close();
});

test('schedule requires successful delayed reviews before stable mastery', () => {
  const first = scheduleReview({ rating: 'easy', covered: true, delayed: false, at: '2026-09-21' });
  assert.equal(first.intervalIndex, 0);
  assert.equal(first.dueOn, '2026-09-22');
  const second = scheduleReview({ intervalIndex: 0, delayedSuccess: 0, lapses: 0,
    rating: 'easy', covered: true, delayed: true, at: '2026-09-22' });
  assert.equal(second.intervalIndex, 1);
  assert.equal(second.delayedSuccess, 1);
  const third = scheduleReview({ intervalIndex: 1, delayedSuccess: 1, lapses: 0,
    rating: 'easy', covered: true, delayed: true, at: '2026-09-25' });
  assert.equal(third.intervalIndex, 3);
  const missed = scheduleReview({ intervalIndex: 4, delayedSuccess: 4, lapses: 0,
    rating: 'easy', covered: false, delayed: true, at: '2026-09-25' });
  assert.equal(missed.intervalIndex, 0);
  assert.equal(missed.delayedSuccess, 0);
  assert.equal(missed.lapses, 1);
  assert.equal(missed.dueOn, '2026-09-26');
});

test('a weak interview topic becomes a due knowledge point, repeated finish is idempotent', () => {
  const db = setup();
  let session = startSession(db, { track: 'react' });
  const firstQuestionId = session.turns[0].questionId;
  session = answerSession(db, session.id, { turnId: session.currentTurn, answer: '不会' });
  finishSession(db, session.id);
  finishSession(db, session.id);
  const due = reviewQueue(db).due;
  assert.deepEqual(due.map((item) => item.id), [`interview:${firstQuestionId}`]);
  assert.equal(reviewDashboard(db).enrolled, 1);
  const review = startReview(db, due[0].id);
  assert.ok(!('reference' in review));
  db.close();
});

test('import preserves source/answer and does not overwrite existing study history', () => {
  const db = setup();
  const input = [{ id: 'legacy:1', category: 'JavaScript', prompt: '旧题：闭包？', reference: '用户原始答案文本' }];
  assert.deepEqual(importKnowledge(db, input), { added: 1, total: 1 });
  assert.deepEqual(importKnowledge(db, input), { added: 0, total: 1 });
  assert.equal(reviewDashboard(db).total, 16);
  assert.equal(knowledgeCatalog(db, '闭包').find((x) => x.id === 'legacy:1').source, 'legacy-unreviewed');
  const attempt = startReview(db, 'legacy:1');
  assert.equal(revealReview(db, attempt.id, { answer: '不知道' }).reference, input[0].reference);
  completeReview(db, attempt.id, { rating: 'forgot', covered: false });
  importKnowledge(db, [{ ...input[0], reference: '不应覆盖旧版题库内容' }]);
  assert.equal(db.prepare("SELECT reference FROM knowledge_points WHERE id = 'legacy:1'").get().reference, input[0].reference);
  assert.equal(reviewDashboard(db).enrolled, 1);
  assert.throws(() => importKnowledge(db, [...input, { id: 'invalid', prompt: 'x', reference: 'x', category: 'x' }]), /无效条目/);
  db.close();
});

test('review state survives SQLite restart', () => {
  const dir = mkdtempSync(join(tmpdir(), 'nowen-memory-'));
  const path = join(dir, 'test.db');
  try {
    let db = createDatabase(path);
    const item = reviewQueue(db).fresh[0];
    const attempt = startReview(db, item.id);
    db.close();
    db = createDatabase(path);
    assert.equal(getAttempt(db, attempt.id).phase, 'question');
    revealReview(db, attempt.id, { answer: '再次独立作答' });
    assert.equal(completeReview(db, attempt.id, { rating: 'good', covered: true }).intervalIndex, 0);
    db.close();
    db = createDatabase(path);
    assert.equal(reviewDashboard(db).enrolled, 1);
    assert.equal(reviewDashboard(db).total, 15);
    db.close();
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('HTTP review flow rejects premature rating, avoids answer leakage, and reports correct stats', async () => {
  const db = setup();
  const server = createAppServer(db);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = async (url, body) => fetch(base + url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  try {
    const queue = await (await fetch(base + '/api/review/queue')).json();
    const item = queue.fresh[0];
    assert.equal(item.reference, undefined);
    const started = await (await post('/api/review/attempts', { knowledgeId: item.id })).json();
    assert.equal(started.reference, undefined);
    assert.equal((await post(`/api/review/attempts/${started.id}/complete`, { rating: 'easy', covered: true })).status, 409);
    const revealed = await (await post(`/api/review/attempts/${started.id}/reveal`, { answer: '不知道' })).json();
    assert.ok(revealed.reference);
    const completed = await (await post(`/api/review/attempts/${started.id}/complete`, { rating: 'forgot', covered: false })).json();
    assert.equal(completed.correct, false);
    assert.equal((await (await fetch(base + '/api/review/dashboard')).json()).enrolled, 1);
  } finally { await new Promise((resolve) => server.close(resolve)); db.close(); }
});

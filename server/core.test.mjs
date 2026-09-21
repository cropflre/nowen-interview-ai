import test from 'node:test';
import assert from 'node:assert/strict';
import { createDatabase, catalog, startSession, getSession, answerSession, finishSession, assess, AppError } from './core.mjs';
import { createAppServer } from './index.mjs';

const setup = () => createDatabase();
test('catalog and invalid tracks', () => {
  const db = setup();
  assert.equal(catalog().tracks.length, 6);
  assert.throws(() => startSession(db, { track: 'invalid' }), AppError);
  db.close();
});
test('questions are hidden during interview and recorded after completion', () => {
  const db = setup();
  let session = startSession(db, { track: 'react' });
  assert.equal(session.questionCount, 3);
  assert.equal(session.turns.length, 1);
  assert.equal(session.turns[0].feedback, undefined);
  assert.throws(() => answerSession(db, session.id, { turnId: session.currentTurn, answer: ' ' }), AppError);
  for (let index = 0; index < 9; index++) {
    const id = session.currentTurn;
    session = answerSession(db, session.id, { turnId: id, answer: '我会结合实际的渲染状态和测试进行解释' });
    assert.throws(() => answerSession(db, session.id, { turnId: id, answer: '重复提交' }), AppError);
  }
  assert.equal(session.status, 'completed');
  assert.equal(session.report.answeredTurns, 9);
  assert.equal(session.report.plannedTurns, 9);
  assert.ok(session.turns[0].feedback.notice.includes('关键词'));
  assert.equal(getSession(db, session.id).status, 'completed');
  db.close();
});
test('early finish reports answered turns only', () => {
  const db = setup();
  const session = startSession(db, { track: 'all' });
  const completed = finishSession(db, session.id);
  assert.equal(completed.report.coverage, null);
  assert.equal(completed.report.answeredTurns, 0);
  assert.equal(completed.report.plannedTurns, 15);
  assert.throws(() => answerSession(db, session.id, { turnId: session.currentTurn, answer: '回答' }), AppError);
  db.close();
});
test('checklist uses keywords but does not pretend semantic accuracy', () => {
  const result = assess('Promise 微任务优先', [{ label: '微任务', terms: ['微任务'] }, { label: '任务队列', terms: ['任务队列'] }]);
  assert.deepEqual(result.missing, ['任务队列']);
  assert.equal(result.covered, 1);
});
test('HTTP API creates interview, rejects stale submission, and supports history', async () => {
  const db = setup();
  const server = createAppServer(db);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const create = await fetch(`${base}/api/sessions`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ track: 'javascript' }) });
    assert.equal(create.status, 201);
    const session = await create.json();
    const stale = await fetch(`${base}/api/sessions/${session.id}/answers`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ turnId: -1, answer: 'foo' }) });
    assert.equal(stale.status, 409);
    const history = await (await fetch(`${base}/api/sessions`)).json();
    assert.equal(history[0].id, session.id);
    const missing = await fetch(`${base}/api/sessions/not-found`);
    assert.equal(missing.status, 404);
  } finally { await new Promise((resolve) => server.close(resolve)); db.close(); }
});

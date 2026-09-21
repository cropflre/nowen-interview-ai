import test from 'node:test';
import assert from 'node:assert/strict';
import { createDatabase, startSession, finishSession, answerSession } from './core.mjs';
import { dailyDashboard, claimDaily } from './quest.mjs';

const interviewTask = db => dailyDashboard(db).tasks.find(task => task.id === 'interview');

test('abandoning a session does not unlock the interview daily reward', () => {
  const db = createDatabase();
  const abandoned = startSession(db, { track: 'javascript' });
  finishSession(db, abandoned.id);
  assert.equal(interviewTask(db).completed, false);
  assert.throws(() => claimDaily(db, 'interview'), { status: 409 });
  db.close();
});

test('fully answering all interview turns unlocks one daily reward', () => {
  const db = createDatabase();
  let session = startSession(db, { track: 'javascript' });
  let answered = 0;
  while (session.status === 'active') {
    session = answerSession(db, session.id, { turnId: session.currentTurn, answer: '我会先解释原理，再描述实现细节和边界条件。' });
    answered++;
    assert.ok(answered <= 20, 'interview should finish within the planned turns');
  }
  assert.ok(answered >= 3);
  assert.equal(interviewTask(db).completed, true);
  assert.equal(claimDaily(db, 'interview').earnedXp, 40);
  assert.equal(claimDaily(db, 'interview').earnedXp, 0);
  db.close();
});

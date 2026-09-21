import test from 'node:test';
import assert from 'node:assert/strict';
import { createDatabase } from './core.mjs';
import { createAppServer } from './index.mjs';

test('quest HTTP: verify task claims and hide demon answers until reveal', async () => {
  const db = createDatabase();
  const server = createAppServer(db);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (path, data) => {
    const response = await fetch(base + path, data === undefined ? undefined : {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data),
    });
    return [response.status, await response.json()];
  };
  try {
    let [status, dashboard] = await call('/api/quest/daily');
    assert.equal(status, 200);
    assert.equal(dashboard.tasks.length, 4);
    [status] = await call('/api/quest/daily/stage/claim', {});
    assert.equal(status, 409);
    db.prepare('INSERT OR IGNORE INTO review_items(knowledge_id,due_on) VALUES (?,?)')
      .run('interview:js-closure', '2020-01-01');
    let battle;
    [status, battle] = await call('/api/quest/demon/start', {});
    assert.equal(status, 201);
    assert.equal(battle.current.attempt.phase, 'question');
    assert.equal('reference' in battle.current.attempt, false);
    const attemptId = battle.current.attempt.id;
    [status] = await call(`/api/quest/demon/${battle.id}/advance`, { attemptId });
    assert.equal(status, 409);
    [status] = await call(`/api/review/attempts/${attemptId}/reveal`, { answer: '我理解词法环境中的变量引用' });
    assert.equal(status, 200);
    [status] = await call(`/api/review/attempts/${attemptId}/complete`, { covered: true, rating: 'good' });
    assert.equal(status, 200);
    [status, battle] = await call(`/api/quest/demon/${battle.id}/advance`, { attemptId });
    assert.equal(status, 200);
    assert.equal(battle.status, 'cleared');
    [status, dashboard] = await call('/api/quest/daily/demon/claim', {});
    assert.equal(status, 200);
    assert.equal(dashboard.earnedXp, 60);
    [status, dashboard] = await call('/api/quest/daily/demon/claim', {});
    assert.equal(status, 200);
    assert.equal(dashboard.earnedXp, 0);
  } finally { await new Promise(resolve => server.close(resolve)); db.close(); }
});

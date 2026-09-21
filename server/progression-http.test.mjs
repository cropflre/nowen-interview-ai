import test from 'node:test';
import assert from 'node:assert/strict';
import { createDatabase } from './core.mjs';
import { createAppServer } from './index.mjs';

test('progression HTTP: gates, hidden solutions, stale turn and one-time claim', async () => {
  const db = createDatabase();
  const server = createAppServer(db);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (path, body) => {
    const res = await fetch(base + path, body === undefined ? {} : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    return [res.status, await res.json()];
  };
  try {
    let [status, progression] = await call('/api/progression');
    assert.equal(status, 200);
    assert.equal(progression.skills.length, 5);
    assert.equal(progression.stories[1].text, null);
    [status] = await call('/api/progression/code/start', {});
    assert.equal(status, 409);
    [status] = await call('/api/progression/story/scope/read', {});
    assert.equal(status, 409);
    db.prepare('INSERT INTO game_progress(stage_id,best_stars,clears,updated_at) VALUES (?,?,?,?)')
      .run('js-debug', 1, 1, new Date().toISOString());
    let run;
    [status, run] = await call('/api/progression/code/start', {});
    assert.equal(status, 201);
    assert.equal(run.current.id, 'timer');
    assert.equal('correct' in run.current, false);
    assert.equal('explanation' in run.current, false);
    const firstId = run.current.id;
    [status, run] = await call(`/api/progression/code/${run.id}/answer`, { puzzleId: firstId, choice: 0, reasoning: '函数式状态更新' });
    assert.equal(status, 200);
    assert.equal(run.answered, 1);
    assert.equal('correct' in run.current, false);
    [status] = await call(`/api/progression/code/${run.id}/answer`, { puzzleId: firstId, choice: 0 });
    assert.equal(status, 409);
    [status, progression] = await call('/api/progression');
    assert.equal(status, 200);
    assert.equal(progression.code.activeId, run.id);
    let reward;
    [status, reward] = await call('/api/progression/achievements/first-step/claim', {});
    assert.equal(status, 200);
    assert.equal(reward.earnedXp, 30);
    [status, reward] = await call('/api/progression/achievements/first-step/claim', {});
    assert.equal(status, 200);
    assert.equal(reward.earnedXp, 0);
  } finally {
    await new Promise(resolve => server.close(resolve));
    db.close();
  }
});

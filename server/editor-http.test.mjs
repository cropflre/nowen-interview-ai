import test from 'node:test';
import assert from 'node:assert/strict';
import { createDatabase } from './core.mjs';
import { createAppServer } from './index.mjs';
import { initEditor } from './editor.mjs';

const solution = 'function startCounter(setCount) { const timer = setInterval(() => setCount(n => n + 1), 1000); return () => clearInterval(timer); }';

test('editable workshop HTTP: lock, safe response, drafts, failed checks and one-time reward', async () => {
  const db = createDatabase();
  const server = createAppServer(db);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const request = async (path, method = 'GET', body) => {
    const response = await fetch(origin + path, { method, headers: { 'content-type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, data: await response.json() };
  };
  try {
    let response = await request('/api/editor');
    assert.equal(response.status, 200);
    assert.equal(response.data.unlocked, false);
    response = await request('/api/editor/counter');
    assert.equal(response.status, 409);
    initEditor(db);
    db.prepare("INSERT INTO game_progress(stage_id,best_stars,clears,updated_at) VALUES ('js-debug',1,1,?)").run(new Date().toISOString());
    response = await request('/api/editor/counter');
    assert.equal(response.status, 200);
    assert.equal(response.data.checks, null);
    assert.equal('solution' in response.data, false);
    assert.equal('correct' in response.data, false);
    response = await request('/api/editor/counter/draft', 'PUT', { source: 'function startCounter(setCount) { return () => {}; }' });
    assert.equal(response.status, 200);
    response = await request('/api/editor/counter');
    assert.match(response.data.source, /return \(\) =>/);
    response = await request('/api/editor/counter/submit', 'POST', { source: 'function startCounter(' });
    assert.equal(response.status, 200);
    assert.equal(response.data.lastPassed, false);
    assert.equal(response.data.earnedXp, 0);
    response = await request('/api/editor/counter/submit', 'POST', { source: solution });
    assert.equal(response.status, 200);
    assert.equal(response.data.lastPassed, true);
    assert.equal(response.data.earnedXp, 75);
    response = await request('/api/editor/counter/submit', 'POST', { source: solution });
    assert.equal(response.data.earnedXp, 0);
    assert.equal((await request('/api/editor')).data.player.xp, 75);
    assert.equal((await request('/api/editor/missing')).status, 404);
    assert.equal((await request('/api/editor/counter/draft', 'PUT', { source: '' })).status, 400);
  } finally {
    await new Promise(resolve => server.close(resolve));
    db.close();
  }
});

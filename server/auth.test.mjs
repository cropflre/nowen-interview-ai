import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createAccountStore } from './auth.mjs';
import { createAppServer } from './index.mjs';

const password = 'a-strong-password-for-tests-123';
test('account mode isolates every API in separate SQLite files and revokes sessions', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'nowen-auth-'));
  const auth = createAccountStore(dir);
  const server = createAppServer(null, auth);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (path, options = {}, cookie = '') => {
    const response = await fetch(base + path, { ...options, headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}), ...options.headers } });
    return { status: response.status, body: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0] };
  };
  try {
    assert.equal((await call('/api/auth/me')).body.setupRequired, true);
    assert.equal((await call('/api/game/world')).status, 401);
    const first = await call('/api/auth/setup', { method: 'POST', body: JSON.stringify({ username: 'alice', password }) });
    assert.equal(first.status, 201);
    assert.equal(first.body.user.username, 'alice');
    assert.equal((await call('/api/auth/setup', { method: 'POST', body: JSON.stringify({ username: 'eve', password }) })).status, 409);
    auth.createUser('bob', password);
    const second = await call('/api/auth/login', { method: 'POST', body: JSON.stringify({ username: 'bob', password }) });
    assert.equal(second.status, 200);
    assert.notEqual(first.body.user.id, second.body.user.id);
    const alice = await call('/api/game/stages/js-scope/start', { method: 'POST', body: '{}' }, first.cookie);
    const bob = await call('/api/game/stages/js-scope/start', { method: 'POST', body: '{}' }, second.cookie);
    assert.equal(alice.status, 201);
    assert.equal(bob.status, 201);
    assert.notEqual(alice.body.id, bob.body.id);
    assert.equal((await call(`/api/game/attempts/${alice.body.id}`, {}, second.cookie)).status, 404);
    assert.equal((await call('/api/auth/me', {}, first.cookie)).body.user.username, 'alice');
    assert.equal((await call('/api/auth/me', {}, second.cookie)).body.user.username, 'bob');
    assert.equal((await call('/api/game/world', { headers: { origin: 'https://attacker.example' } }, first.cookie)).status, 200);
    assert.equal((await call('/api/game/stages/js-scope/start', { method: 'POST', body: '{}', headers: { origin: 'https://attacker.example' } }, first.cookie)).status, 403);
    assert.equal((await call('/api/auth/logout', { method: 'POST', body: '{}' }, first.cookie)).status, 200);
    assert.equal((await call('/api/game/world', {}, first.cookie)).status, 401);
    assert.equal((await call('/api/game/world', {}, second.cookie)).status, 200);
  } finally {
    await new Promise(resolve => server.close(resolve));
    auth.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

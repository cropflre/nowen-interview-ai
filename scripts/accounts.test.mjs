import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createDatabase, startSession } from '../server/core.mjs';
import { createAccountStore } from '../server/auth.mjs';
import { migrateLegacyAccount } from './accounts.mjs';

test('offline legacy migration preserves original database, restores history and refuses overwrite', () => {
  const dir = mkdtempSync(join(tmpdir(), 'nowen-account-migration-'));
  try {
    const old = join(dir, 'interview.db');
    const db = createDatabase(old);
    const session = startSession(db, { track: 'react' });
    db.close();
    const before = createHash('sha256').update(readFileSync(old)).digest('hex');
    const auth = createAccountStore(dir);
    auth.createUser('alice', 'a-sufficiently-long-password-123');
    auth.close();
    assert.throws(() => migrateLegacyAccount('alice', old, dir), /--confirm/);
    const result = migrateLegacyAccount('alice', old, dir, { confirm: true });
    assert.equal(result.sourcePreserved, true);
    assert.equal(existsSync(result.destination), true);
    assert.equal(createHash('sha256').update(readFileSync(old)).digest('hex'), before);
    const imported = createDatabase(result.destination);
    assert.equal(imported.prepare('SELECT id FROM sessions WHERE id=?').get(session.id).id, session.id);
    imported.close();
    assert.throws(() => migrateLegacyAccount('alice', old, dir, { confirm: true }), /refusing to overwrite/);
    assert.throws(() => migrateLegacyAccount('missing', old, dir, { confirm: true }), /not found/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

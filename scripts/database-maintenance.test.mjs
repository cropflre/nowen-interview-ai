import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createDatabase } from '../server/core.mjs';
import { backupDatabase, restoreDatabase } from './database-maintenance.mjs';

test('SQLite snapshot: preserves interview and review data, verifies digest, keeps rollback copy', () => {
  const dir = mkdtempSync(join(tmpdir(), 'nowen-backup-'));
  const source = join(dir, 'live.sqlite');
  const backup = join(dir, 'snapshot.sqlite');
  try {
    const db = createDatabase(source);
    db.prepare("INSERT INTO sessions(id,track,status,question_ids,created_at) VALUES ('saved','react','active','[]',?)").run(new Date().toISOString());
    db.prepare("INSERT INTO review_items(knowledge_id,due_on) VALUES ('interview:react-effects','2026-01-01')").run();
    db.close();
    const saved = backupDatabase(source, backup);
    assert.equal(saved.manifest.valid, true);
    assert.equal(saved.manifest.sha256.length, 64);
    assert.ok(existsSync(`${backup}.json`));
    const edited = createDatabase(source);
    edited.prepare("DELETE FROM sessions WHERE id='saved'").run();
    edited.close();
    assert.throws(() => restoreDatabase(backup, source), /--confirm/);
    const restored = restoreDatabase(backup, source, { confirm: true });
    assert.ok(restored.previous && existsSync(restored.previous));
    const check = createDatabase(source);
    assert.ok(check.prepare("SELECT id FROM sessions WHERE id='saved'").get());
    assert.ok(check.prepare("SELECT knowledge_id FROM review_items WHERE knowledge_id='interview:react-effects'").get());
    check.close();
    writeFileSync(backup, Buffer.concat([readFileSync(backup), Buffer.from('tamper')]));
    assert.throws(() => restoreDatabase(backup, source, { confirm: true }), /checksum/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
test('offline restore refuses WAL/SHM to avoid losing uncheckpointed data', () => {
  const dir = mkdtempSync(join(tmpdir(), 'nowen-wal-'));
  const source = join(dir, 'live.sqlite');
  const backup = join(dir, 'snapshot.sqlite');
  let db;
  try {
    db = createDatabase(source);
    backupDatabase(source, backup);
    writeFileSync(`${source}-wal`, 'active WAL marker');
    assert.throws(() => restoreDatabase(backup, source, { confirm: true }), /WAL\/SHM/);
  } finally { if (db) db.close(); rmSync(dir, { recursive: true, force: true }); }
});

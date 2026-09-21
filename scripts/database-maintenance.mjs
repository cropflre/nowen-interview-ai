import { DatabaseSync } from 'node:sqlite';
import { createHash, randomUUID } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
export const defaultDatabase = () => resolve(process.env.DATA_DIR || resolve(ROOT, 'data'), 'interview.db');
const digest = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const inspect = file => {
  const db = new DatabaseSync(file, { readOnly: true });
  try {
    const integrity = db.prepare('PRAGMA integrity_check').get();
    if (Object.values(integrity)[0] !== 'ok') throw new Error(`SQLite integrity_check failed for ${file}`);
    const tables = new Set(db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(row => row.name));
    for (const table of ['sessions', 'turns', 'knowledge_points', 'review_items']) {
      if (!tables.has(table)) throw new Error(`Backup missing essential table: ${table}`);
    }
    return { valid: true, tables: tables.size };
  } finally { db.close(); }
};
const unique = prefix => `${prefix}.${randomUUID()}.tmp`;

export function backupDatabase(source = defaultDatabase(), destination) {
  source = resolve(source);
  if (!existsSync(source)) throw new Error(`Database not found: ${source}`);
  destination = resolve(destination || resolve(ROOT, 'backups', `interview-${new Date().toISOString().replace(/[:.]/g, '-')}.sqlite`));
  if (source === destination || existsSync(destination) || existsSync(`${destination}.json`)) throw new Error('Refusing to overwrite a database or existing backup');
  mkdirSync(dirname(destination), { recursive: true });
  const temp = unique(destination);
  let db;
  try {
    db = new DatabaseSync(source, { readOnly: true, timeout: 5000 });
    // VACUUM INTO produces a consistent SQLite snapshot even when the source uses WAL.
    db.prepare('VACUUM main INTO ?').run(temp);
    db.close(); db = null;
    const verification = inspect(temp);
    const manifest = { format: 'nowen-sqlite-backup-v1', createdAt: new Date().toISOString(),
      sha256: digest(temp), bytes: statSync(temp).size, ...verification };
    renameSync(temp, destination);
    try { writeFileSync(`${destination}.json`, JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx', mode: 0o600 }); }
    catch (error) { rmSync(destination, { force: true }); throw error; }
    return { destination, manifest };
  } finally { if (db) db.close(); rmSync(temp, { force: true }); }
}

export function restoreDatabase(backup, destination = defaultDatabase(), { confirm = false } = {}) {
  if (!confirm) throw new Error('Restore is destructive: pass --confirm after stopping the app');
  backup = resolve(backup); destination = resolve(destination);
  if (backup === destination) throw new Error('Source and target database must differ');
  if (!existsSync(backup)) throw new Error('Backup file does not exist');
  const manifestPath = `${backup}.json`;
  if (!existsSync(manifestPath)) throw new Error('Backup manifest is missing');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  if (manifest.format !== 'nowen-sqlite-backup-v1' || manifest.sha256 !== digest(backup) || manifest.bytes !== statSync(backup).size)
    throw new Error('Backup checksum or format verification failed; destination is unchanged');
  inspect(backup);
  // An active WAL may hold the latest transactions. Never replace only the main .db file.
  if (existsSync(`${destination}-wal`) || existsSync(`${destination}-shm`))
    throw new Error('WAL/SHM files detected: stop the app and checkpoint/close SQLite before restoring');
  mkdirSync(dirname(destination), { recursive: true });
  const temp = unique(destination);
  const previous = `${destination}.pre-restore-${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID()}.sqlite`;
  let displaced = false;
  try {
    copyFileSync(backup, temp);
    if (digest(temp) !== manifest.sha256) throw new Error('Temporary restore copy failed checksum');
    inspect(temp);
    if (existsSync(destination)) { renameSync(destination, previous); displaced = true; }
    try { renameSync(temp, destination); }
    catch (error) { if (displaced) renameSync(previous, destination); displaced = false; throw error; }
    return { destination, previous: displaced ? previous : null, restoredFrom: backup };
  } finally { rmSync(temp, { force: true }); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [, , command, ...args] = process.argv;
    if (command === 'backup') console.log(JSON.stringify(backupDatabase(args[0] || defaultDatabase(), args[1]), null, 2));
    else if (command === 'restore' && args[0]) console.log(JSON.stringify(restoreDatabase(args[0], args[1] && args[1] !== '--confirm' ? args[1] : defaultDatabase(), { confirm: args.includes('--confirm') }), null, 2));
    else throw new Error('Usage: npm run backup -- [db] [output.sqlite] | npm run restore -- <backup.sqlite> [db] --confirm');
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}

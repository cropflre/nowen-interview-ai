import { DatabaseSync } from 'node:sqlite';
import { existsSync, mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { createAccountStore } from '../server/auth.mjs';
import { backupDatabase, defaultDatabase, restoreDatabase } from './database-maintenance.mjs';

const root = () => resolve(process.env.DATA_DIR || resolve(fileURLToPath(new URL('../data/', import.meta.url))));
export function migrateLegacyAccount(username, source = defaultDatabase(), dir = root(), { confirm = false } = {}) {
  if (!confirm) throw new Error('Migration requires --confirm and a stopped application');
  const authFile = join(dir, 'auth.sqlite');
  if (!existsSync(authFile)) throw new Error('Accounts have not been initialized');
  const auth = new DatabaseSync(authFile, { readOnly: true });
  let user;
  try { user = auth.prepare('SELECT id,username FROM auth_users WHERE username=?').get(String(username).toLowerCase()); }
  finally { auth.close(); }
  if (!user || !/^[0-9a-f-]{36}$/.test(user.id)) throw new Error('Account not found');
  const destination = join(dir, 'users', user.id, 'interview.db');
  if (existsSync(destination) || existsSync(`${destination}-wal`) || existsSync(`${destination}-shm`))
    throw new Error('Destination account already has a save: refusing to overwrite any data');
  if (resolve(source) === resolve(destination)) throw new Error('Source and destination must differ');
  const temporary = mkdtempSync(join(tmpdir(), 'nowen-account-import-'));
  try {
    const archive = join(temporary, 'snapshot.sqlite');
    backupDatabase(source, archive);
    mkdirSync(dirname(destination), { recursive: true, mode: 0o700 });
    const result = restoreDatabase(archive, destination, { confirm: true });
    return { username: user.username, destination: result.destination, sourcePreserved: true };
  } finally { rmSync(temporary, { recursive: true, force: true }); }
}

async function passwordPrompt() {
  if (process.env.NOWEN_NEW_USER_PASSWORD) return process.env.NOWEN_NEW_USER_PASSWORD;
  if (!process.stdin.isTTY || !process.stdin.setRawMode) throw new Error('Interactive terminal required; alternatively set NOWEN_NEW_USER_PASSWORD in your local shell');
  process.stdout.write('New account password (at least 12 characters; input hidden): ');
  return new Promise((resolvePassword, reject) => {
    let value = '';
    const restore = () => { process.stdin.off('data', handler); process.stdin.setRawMode(false); process.stdin.pause(); process.stdout.write('\n'); };
    const handler = chunk => {
      const chars = chunk.toString('utf8');
      for (const char of chars) {
        if (char === '\r' || char === '\n') { restore(); resolvePassword(value); return; }
        if (char === '\u0003') { restore(); reject(new Error('Cancelled')); return; }
        if (char === '\u007f' || char === '\b') value = Array.from(value).slice(0, -1).join('');
        else value += char;
      }
    };
    process.stdin.setRawMode(true); process.stdin.resume(); process.stdin.on('data', handler);
  });
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [, , command, username, ...args] = process.argv;
    if (command === 'create' && username) {
      const password = await passwordPrompt();
      const store = createAccountStore(root());
      try { console.log(JSON.stringify(store.createUser(username, password), null, 2)); }
      finally { store.close(); }
    } else if (command === 'migrate' && username && args.includes('--confirm')) {
      const source = args.find(arg => arg !== '--confirm') || defaultDatabase();
      console.log(JSON.stringify(migrateLegacyAccount(username, source, root(), { confirm: true }), null, 2));
    } else throw new Error('Usage: npm run account -- create <username> | npm run account -- migrate <username> [old.db] --confirm');
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}

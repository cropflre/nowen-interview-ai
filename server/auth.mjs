import { DatabaseSync } from 'node:sqlite';
import { randomBytes, randomUUID, scryptSync, createHash, timingSafeEqual } from 'node:crypto';
import { mkdirSync, chmodSync } from 'node:fs';
import { join } from 'node:path';
import { createDatabase, AppError } from './core.mjs';

const TTL = 7 * 24 * 60 * 60 * 1000;
const COOKIE = 'nowen_sid';
const nameOf = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{3,32}$/.test(value) ? value.toLowerCase() : null;
const hash = token => createHash('sha256').update(token).digest('hex');
function validPassword(password) {
  if (typeof password !== 'string' || password.length < 12 || password.length > 256) throw new AppError('密码需为 12–256 个字符', 400);
}
function secret(password, salt) { return scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 }); }
function safeFile(path) { try { chmodSync(path, 0o600); } catch { /* filesystem may disallow chmod */ } }
export function createAccountStore(root) {
  const directory = join(root, 'users');
  mkdirSync(root, { recursive: true, mode: 0o700 });
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const database = join(root, 'auth.sqlite');
  const db = new DatabaseSync(database, { timeout: 5000 });
  safeFile(database);
  db.exec(`PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS auth_users(id TEXT PRIMARY KEY,username TEXT UNIQUE NOT NULL,salt TEXT NOT NULL,digest TEXT NOT NULL,created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS auth_sessions(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,expires_at INTEGER NOT NULL);`);
  const opened = new Map();
  const failures = new Map();
  function count() { return db.prepare('SELECT COUNT(*) AS n FROM auth_users').get().n; }
  function createUser(username, password, firstOnly = false) {
    const name = nameOf(username);
    if (!name) throw new AppError('用户名需为 3–32 位英文字母、数字、下划线或连字符');
    validPassword(password);
    db.exec('BEGIN IMMEDIATE');
    try {
      if (firstOnly && count() !== 0) throw new AppError('初始账户已创建', 409);
      const id = randomUUID(), salt = randomBytes(24).toString('hex');
      db.prepare('INSERT INTO auth_users(id,username,salt,digest,created_at) VALUES (?,?,?,?,?)')
        .run(id, name, salt, secret(password, salt).toString('hex'), new Date().toISOString());
      db.exec('COMMIT');
      return { id, username: name };
    } catch (error) {
      db.exec('ROLLBACK');
      if (String(error.message).includes('UNIQUE')) throw new AppError('用户名已存在', 409);
      throw error;
    }
  }
  function login(username, password, address = '') {
    const name = nameOf(username);
    if (!name || typeof password !== 'string' || password.length > 256) throw new AppError('用户名或密码不正确', 401);
    const key = `${address}:${name}`, time = Date.now();
    const record = failures.get(key) || { count: 0, until: time + 15 * 60 * 1000 };
    if (time > record.until) { record.count = 0; record.until = time + 15 * 60 * 1000; }
    if (record.count >= 5) throw new AppError('尝试次数过多，请稍后再试', 429);
    const user = db.prepare('SELECT * FROM auth_users WHERE username=?').get(name);
    const candidate = secret(password, user?.salt || 'unknown-user-salt');
    const expected = user ? Buffer.from(user.digest, 'hex') : Buffer.alloc(64);
    if (!user || !timingSafeEqual(candidate, expected)) {
      record.count++; failures.set(key, record);
      throw new AppError('用户名或密码不正确', 401);
    }
    failures.delete(key);
    const token = randomBytes(32).toString('base64url');
    db.prepare('DELETE FROM auth_sessions WHERE expires_at<=?').run(time);
    db.prepare('INSERT INTO auth_sessions(token_hash,user_id,expires_at) VALUES (?,?,?)')
      .run(hash(token), user.id, time + TTL);
    return { token, user: { id: user.id, username: user.username } };
  }
  function cookieToken(req) {
    const match = /(?:^|;\s*)nowen_sid=([A-Za-z0-9_-]{43})(?:;|$)/.exec(req.headers.cookie || '');
    return match?.[1] || null;
  }
  function identity(req) {
    const token = cookieToken(req);
    if (!token) return null;
    const user = db.prepare(`SELECT u.id,u.username FROM auth_sessions s JOIN auth_users u ON u.id=s.user_id
      WHERE s.token_hash=? AND s.expires_at>?`).get(hash(token), Date.now());
    return user || null;
  }
  function logout(req) {
    const token = cookieToken(req);
    if (token) db.prepare('DELETE FROM auth_sessions WHERE token_hash=?').run(hash(token));
  }
  function accountDatabase(user) {
    if (!user || !/^[0-9a-f-]{36}$/.test(user.id)) throw new AppError('请先登录', 401);
    if (!opened.has(user.id)) {
      const dir = join(directory, user.id);
      mkdirSync(dir, { recursive: true, mode: 0o700 });
      const file = join(dir, 'interview.db');
      opened.set(user.id, createDatabase(file));
      safeFile(file);
    }
    return opened.get(user.id);
  }
  return { count, createUser, login, identity, logout, accountDatabase,
    cookie: token => `${COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/api; Max-Age=${TTL / 1000}`,
    clearCookie: `${COOKIE}=; HttpOnly; SameSite=Strict; Path=/api; Max-Age=0`,
    close() { for (const connection of opened.values()) connection.close(); db.close(); },
  };
}

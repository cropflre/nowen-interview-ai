import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, extname, sep } from 'node:path';
import { createDatabase, catalog, startSession, getSession, answerSession, finishSession, listSessions, AppError } from './core.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const DIST = resolve(ROOT, 'dist');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };

async function parseJson(req) {
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 65536) throw new AppError('请求内容不能超过 64 KB', 413);
  }
  try {
    const result = JSON.parse(body || '{}');
    if (!result || Array.isArray(result) || typeof result !== 'object') throw new Error();
    return result;
  } catch { throw new AppError('JSON 格式不正确'); }
}

export function createAppServer(db) {
  return http.createServer(async (req, res) => {
    const send = (status, data) => {
      res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
      res.end(JSON.stringify(data));
    };
    try {
      const url = new URL(req.url, 'http://localhost');
      const path = url.pathname;
      if (path.startsWith('/api/')) {
        if (req.method === 'GET' && path === '/api/health') return send(200, { ok: true });
        if (req.method === 'GET' && path === '/api/catalog') return send(200, catalog());
        if (req.method === 'GET' && path === '/api/sessions') return send(200, listSessions(db));
        if (req.method === 'POST' && path === '/api/sessions') return send(201, startSession(db, await parseJson(req)));
        const match = /^\/api\/sessions\/([0-9a-f-]{36})(?:\/(answers|finish))?$/.exec(path);
        if (match) {
          const [, id, action] = match;
          if (req.method === 'GET' && !action) return send(200, getSession(db, id));
          if (req.method === 'POST' && action === 'answers') return send(200, answerSession(db, id, await parseJson(req)));
          if (req.method === 'POST' && action === 'finish') return send(200, finishSession(db, id));
        }
        return send(404, { error: '接口不存在' });
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') return send(405, { error: 'Method not allowed' });
      if (path.includes('\0') || path.includes('\\')) return send(400, { error: '无效路径' });
      const file = resolve(DIST, '.' + decodeURIComponent(path));
      if (file !== DIST && !file.startsWith(DIST + sep)) return send(403, { error: '禁止访问' });
      let target = file;
      try { if (!(await stat(target)).isFile()) target = resolve(DIST, 'index.html'); }
      catch { target = resolve(DIST, 'index.html'); }
      const bytes = await readFile(target);
      res.writeHead(200, { 'content-type': MIME[extname(target)] || 'application/octet-stream', 'x-content-type-options': 'nosniff' });
      res.end(req.method === 'HEAD' ? undefined : bytes);
    } catch (error) {
      const status = error instanceof AppError ? error.status : 500;
      if (status === 500) console.error(error);
      send(status, { error: status === 500 ? '服务器发生错误' : error.message });
    }
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const db = createDatabase(resolve(process.env.DATA_DIR || resolve(ROOT, 'data'), 'interview.db'));
  const port = Number(process.env.PORT || 3001);
  const host = process.env.HOST || '127.0.0.1';
  createAppServer(db).listen(port, host, () => console.log(`Nowen Interview API: http://${host}:${port}`));
}

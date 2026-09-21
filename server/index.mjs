import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, extname, sep } from 'node:path';
import { createDatabase, catalog, startSession, getSession, answerSession, finishSession, listSessions, AppError } from './core.mjs';
import { knowledgeCatalog, reviewQueue, reviewDashboard, startReview, getAttempt, revealReview, completeReview } from './memory.mjs';
import { gameWorld, startGameStage, gameAttempt, answerGameStage } from './game.mjs';
import { frameworkWorld, startFrameworkStage, frameworkAttempt, answerFrameworkStage } from './framework.mjs';
import { dailyDashboard, claimDaily, startDemon, getDemon, advanceDemon } from './quest.mjs';
import { progressionDashboard, readStory, claimAchievement, startCodeRun, codeRun, answerCodeRun } from './progression.mjs';
import { editorCatalog, editorPuzzle, saveEditorDraft, submitEditor } from './editor.mjs';
import { aiConfig, getAiSession, startAiSession, answerAiSession, finishAiSession } from './ai.mjs';
import { createAccountStore } from './auth.mjs';

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
function checkOrigin(req) {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return;
  const site = req.headers['sec-fetch-site'];
  if (site && site !== 'same-origin' && site !== 'none') throw new AppError('拒绝跨站请求', 403);
  if (req.headers.origin) {
    let origin;
    try { origin = new URL(req.headers.origin); } catch { throw new AppError('无效请求来源', 403); }
    if (origin.host !== req.headers.host || origin.protocol !== 'http:') throw new AppError('拒绝跨站请求', 403);
  }
}
export function createAppServer(baseDb, auth = null) {
  return http.createServer(async (req, res) => {
    const send = (status, data, extra = {}) => {
      res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', ...extra });
      res.end(JSON.stringify(data));
    };
    try {
      const url = new URL(req.url, 'http://localhost');
      const path = url.pathname;
      let db = baseDb;
      if (path.startsWith('/api/')) {
        if (req.method === 'GET' && path === '/api/health') return send(200, { ok: true });
        if (req.method === 'GET' && path === '/api/auth/me') {
          if (!auth) return send(200, { mode: 'local', authenticated: true });
          const user = auth.identity(req);
          return send(200, { mode: 'accounts', authenticated: Boolean(user), user, setupRequired: !auth.count() });
        }
        if (auth) {
          checkOrigin(req);
          if (req.method === 'POST' && path === '/api/auth/setup') {
            const address = req.socket.remoteAddress || '';
            if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(address)) throw new AppError('只能在本机创建首个账户', 403);
            const body = await parseJson(req);
            auth.createUser(body.username, body.password, true);
            const result = auth.login(body.username, body.password, address);
            return send(201, { mode: 'accounts', authenticated: true, user: result.user }, { 'set-cookie': auth.cookie(result.token) });
          }
          if (req.method === 'POST' && path === '/api/auth/login') {
            const body = await parseJson(req);
            const result = auth.login(body.username, body.password, req.socket.remoteAddress || '');
            return send(200, { mode: 'accounts', authenticated: true, user: result.user }, { 'set-cookie': auth.cookie(result.token) });
          }
          if (req.method === 'POST' && path === '/api/auth/logout') {
            auth.logout(req);
            return send(200, { authenticated: false }, { 'set-cookie': auth.clearCookie });
          }
          const user = auth.identity(req);
          if (!user) throw new AppError('请先登录', 401);
          db = auth.accountDatabase(user);
        }
        if (req.method === 'GET' && path === '/api/catalog') return send(200, catalog());
        if (req.method === 'GET' && path === '/api/ai/config') return send(200, aiConfig());
        if (req.method === 'POST' && path === '/api/ai/sessions') {
          const body = await parseJson(req);
          if (body.consent !== true) throw new AppError('使用 AI 面试前请明确同意将回答发送到配置的模型服务', 400);
          return send(201, startAiSession(db, body));
        }
        const aiMatch = /^\/api\/ai\/sessions\/([0-9a-f-]{36})(?:\/(answers|finish))?$/.exec(path);
        if (aiMatch) {
          const [, id, action] = aiMatch;
          if (req.method === 'GET' && !action) return send(200, getAiSession(db, id));
          if (req.method === 'POST' && action === 'answers') return send(200, await answerAiSession(db, id, await parseJson(req)));
          if (req.method === 'POST' && action === 'finish') return send(200, await finishAiSession(db, id));
        }
        if (req.method === 'GET' && path === '/api/game/world') return send(200, gameWorld(db));
        const stageMatch = /^\/api\/game\/stages\/([a-z0-9-]+)\/start$/.exec(path);
        if (req.method === 'POST' && stageMatch) return send(201, startGameStage(db, stageMatch[1]));
        const gameMatch = /^\/api\/game\/attempts\/([0-9a-f-]{36})(?:\/(answer))?$/.exec(path);
        if (gameMatch) {
          if (req.method === 'GET' && !gameMatch[2]) return send(200, gameAttempt(db, gameMatch[1]));
          if (req.method === 'POST' && gameMatch[2] === 'answer') return send(200, answerGameStage(db, gameMatch[1], await parseJson(req)));
        }
        if (req.method === 'GET' && path === '/api/framework/world') return send(200, frameworkWorld(db));
        const frameworkStage = /^\/api\/framework\/stages\/([a-z0-9-]+)\/start$/.exec(path);
        if (req.method === 'POST' && frameworkStage) return send(201, startFrameworkStage(db, frameworkStage[1]));
        const frameworkMatch = /^\/api\/framework\/attempts\/([0-9a-f-]{36})(?:\/(answer))?$/.exec(path);
        if (frameworkMatch) {
          if (req.method === 'GET' && !frameworkMatch[2]) return send(200, frameworkAttempt(db, frameworkMatch[1]));
          if (req.method === 'POST' && frameworkMatch[2] === 'answer') return send(200, answerFrameworkStage(db, frameworkMatch[1], await parseJson(req)));
        }
        if (req.method === 'GET' && path === '/api/quest/daily') return send(200, dailyDashboard(db));
        const dailyMatch = /^\/api\/quest\/daily\/(stage|review|interview|demon)\/claim$/.exec(path);
        if (req.method === 'POST' && dailyMatch) return send(200, claimDaily(db, dailyMatch[1]));
        if (req.method === 'POST' && path === '/api/quest/demon/start') return send(201, startDemon(db));
        const demonMatch = /^\/api\/quest\/demon\/([0-9a-f-]{36})(?:\/(advance))?$/.exec(path);
        if (demonMatch) {
          if (req.method === 'GET' && !demonMatch[2]) return send(200, getDemon(db, demonMatch[1]));
          if (req.method === 'POST' && demonMatch[2] === 'advance') return send(200, advanceDemon(db, demonMatch[1], (await parseJson(req)).attemptId));
        }
        if (req.method === 'GET' && path === '/api/progression') return send(200, progressionDashboard(db));
        const storyMatch = /^\/api\/progression\/story\/([a-z0-9-]+)\/read$/.exec(path);
        if (req.method === 'POST' && storyMatch) return send(200, readStory(db, storyMatch[1]));
        const achievementMatch = /^\/api\/progression\/achievements\/([a-z0-9-]+)\/claim$/.exec(path);
        if (req.method === 'POST' && achievementMatch) return send(200, claimAchievement(db, achievementMatch[1]));
        if (req.method === 'POST' && path === '/api/progression/code/start') return send(201, startCodeRun(db));
        const codeMatch = /^\/api\/progression\/code\/([0-9a-f-]{36})(?:\/(answer))?$/.exec(path);
        if (codeMatch) {
          if (req.method === 'GET' && !codeMatch[2]) return send(200, codeRun(db, codeMatch[1]));
          if (req.method === 'POST' && codeMatch[2] === 'answer') return send(200, answerCodeRun(db, codeMatch[1], await parseJson(req)));
        }
        if (req.method === 'GET' && path === '/api/editor') return send(200, editorCatalog(db));
        const editorMatch = /^\/api\/editor\/([a-z0-9-]+)(?:\/(draft|submit))?$/.exec(path);
        if (editorMatch) {
          const [, puzzleId, action] = editorMatch;
          if (req.method === 'GET' && !action) return send(200, editorPuzzle(db, puzzleId));
          if (req.method === 'PUT' && action === 'draft') return send(200, saveEditorDraft(db, puzzleId, (await parseJson(req)).source));
          if (req.method === 'POST' && action === 'submit') return send(200, submitEditor(db, puzzleId, (await parseJson(req)).source));
        }
        if (req.method === 'GET' && path === '/api/knowledge') return send(200, knowledgeCatalog(db, url.searchParams.get('q') || ''));
        if (req.method === 'GET' && path === '/api/review/queue') return send(200, reviewQueue(db));
        if (req.method === 'GET' && path === '/api/review/dashboard') return send(200, reviewDashboard(db));
        if (req.method === 'POST' && path === '/api/review/attempts') return send(201, startReview(db, (await parseJson(req)).knowledgeId));
        const reviewMatch = /^\/api\/review\/attempts\/([0-9a-f-]{36})(?:\/(reveal|complete))?$/.exec(path);
        if (reviewMatch) {
          const [, attemptId, action] = reviewMatch;
          if (req.method === 'GET' && !action) return send(200, getAttempt(db, attemptId));
          if (req.method === 'POST' && action === 'reveal') return send(200, revealReview(db, attemptId, await parseJson(req)));
          if (req.method === 'POST' && action === 'complete') return send(200, completeReview(db, attemptId, await parseJson(req)));
        }
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
      const status = error instanceof AppError || (Number.isInteger(error?.status) && error.status >= 400 && error.status < 500) ? error.status : 500;
      if (status === 500) console.error(error);
      send(status, { error: status === 500 ? '服务器发生错误' : error.message });
    }
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dataDir = resolve(process.env.DATA_DIR || resolve(ROOT, 'data'));
  const mode = process.env.AUTH_MODE || 'local';
  if (!['local', 'accounts'].includes(mode)) throw new Error('AUTH_MODE 只支持 local 或 accounts');
  const port = Number(process.env.PORT || 3001);
  const host = process.env.HOST || '127.0.0.1';
  if (mode === 'accounts' && !['127.0.0.1', '::1', 'localhost'].includes(host)) throw new Error('账户模式仅允许绑定本机；公网部署需要单独完成 TLS、安全审计和反向代理配置');
  const db = mode === 'local' ? createDatabase(resolve(dataDir, 'interview.db')) : null;
  const auth = mode === 'accounts' ? createAccountStore(dataDir) : null;
  createAppServer(db, auth).listen(port, host, () => console.log(`Nowen Interview API: http://${host}:${port} (${mode})`));
}

import { randomUUID } from 'node:crypto';
import { parse } from 'acorn';
import { initProgression } from './progression.mjs';

const PLAYER = 'local';
const stamp = () => new Date().toISOString();
export class EditorError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

const PUZZLES = Object.freeze([
  {
    id: 'counter', title: '定时器里的旧闭包', topic: 'React Effect · 函数式更新与清理',
    knowledgeId: 'interview:react-effects', xp: 75,
    symptom: '定时器不断触发，但计数一直停留在 1；离开页面后，定时器仍在运行。请直接修改下方函数。',
    starter: 'function startCounter(setCount) {\n  const timer = setInterval(() => setCount(count + 1), 1000);\n  return () => {};\n}',
    goals: ['用 setCount(previous => previous + 1) 形式读取最新状态', '返回清理函数，调用 clearInterval(timer)'],
    hint: '定时器回调捕获的 count 不会自动更新。清理函数必须由 startCounter 返回。'
  },
  {
    id: 'stale-request', title: '搜索竞态：旧结果覆盖新结果', topic: 'React Effect · 请求失效保护',
    knowledgeId: 'interview:eng-debug', xp: 75,
    symptom: 'A 请求比 B 慢，过时的 A 最后到达，将新搜索结果覆盖。修复函数，让旧请求的回调在清理后失效。',
    starter: 'function loadLatest(query, fetcher, render) {\n  let active = true;\n  fetcher(query).then(render);\n  return () => {};\n}',
    goals: ['then 接收回调，且仅当 active 为真时调用 render', '在返回的清理函数中将 active 设置为 false'],
    hint: '在 then(data => { if (active) render(data); }) 中检查当前请求是否还有效；清理函数需要修改同一个 active。'
  }
]);
const byId = new Map(PUZZLES.map(puzzle => [puzzle.id, puzzle]));
const ident = (node, name) => node?.type === 'Identifier' && node.name === name;
const literal = (node, value) => node?.type === 'Literal' && node.value === value;
const isFunction = node => node?.type === 'ArrowFunctionExpression' || node?.type === 'FunctionExpression';
function nodes(tree, predicate) {
  const found = [];
  function visit(node) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach(visit); return; }
    if (typeof node.type !== 'string') return;
    if (predicate(node)) found.push(node);
    for (const [key, value] of Object.entries(node)) {
      if (key !== 'start' && key !== 'end' && key !== 'type') visit(value);
    }
  }
  visit(tree);
  return found;
}
const has = (tree, predicate) => nodes(tree, predicate).length > 0;
const call = (node, name) => node?.type === 'CallExpression' && ident(node.callee, name);
const returnFunction = fn => fn?.body?.body?.find(node => node.type === 'ReturnStatement' && isFunction(node.argument))?.argument;
function counterChecks(ast) {
  const fn = ast.body.find(node => node.type === 'FunctionDeclaration' && ident(node.id, 'startCounter'));
  const timer = fn?.body.body.find(node => node.type === 'VariableDeclaration')?.declarations.find(node => ident(node.id, 'timer') && call(node.init, 'setInterval'));
  const callback = timer?.init.arguments[0];
  const fresh = isFunction(callback) && has(callback.body, node => {
    if (!call(node, 'setCount')) return false;
    const updater = node.arguments[0];
    if (!isFunction(updater) || !ident(updater.params[0], updater.params[0]?.name)) return false;
    const returned = updater.body.type === 'BlockStatement' ? updater.body.body.find(item => item.type === 'ReturnStatement')?.argument : updater.body;
    return returned?.type === 'BinaryExpression' && returned.operator === '+' && ident(returned.left, updater.params[0].name) && literal(returned.right, 1);
  });
  const cleanup = returnFunction(fn);
  return [
    { label: '定时器在 startCounter 中创建，且使用函数式状态更新', ok: Boolean(timer && fresh) },
    { label: 'startCounter 返回清理函数，清理对应 timer', ok: Boolean(cleanup && has(cleanup.body, node => call(node, 'clearInterval') && ident(node.arguments[0], 'timer'))) }
  ];
}
function requestChecks(ast) {
  const fn = ast.body.find(node => node.type === 'FunctionDeclaration' && ident(node.id, 'loadLatest'));
  const active = fn?.body.body.some(node => node.type === 'VariableDeclaration' && node.kind === 'let' && node.declarations.some(item => ident(item.id, 'active') && literal(item.init, true)));
  const promise = fn && nodes(fn.body, node => node.type === 'CallExpression' && node.callee.type === 'MemberExpression' && !node.callee.computed && ident(node.callee.property, 'then') && call(node.callee.object, 'fetcher') && ident(node.callee.object.arguments[0], 'query')).find(node => isFunction(node.arguments[0]));
  const callback = promise?.arguments[0];
  const guard = callback && has(callback.body, node => node.type === 'IfStatement' && ident(node.test, 'active') && has(node.consequent, child => call(child, 'render') && ident(child.arguments[0], callback.params[0]?.name)));
  const cleanup = returnFunction(fn);
  const invalidates = cleanup && has(cleanup.body, node => node.type === 'AssignmentExpression' && node.operator === '=' && ident(node.left, 'active') && literal(node.right, false));
  return [
    { label: '请求通过 then 回调接收结果，仅在 active 为真时渲染', ok: Boolean(active && promise && guard) },
    { label: '返回清理函数，将同一个 active 标志置为 false', ok: Boolean(cleanup && invalidates) }
  ];
}
export function checkSource(id, source) {
  const puzzle = byId.get(id);
  if (!puzzle) throw new EditorError('代码题不存在', 404);
  if (typeof source !== 'string' || !source.trim() || source.length > 4096) throw new EditorError('代码必须为非空文本，最多 4096 字符');
  let ast;
  try { ast = parse(source, { ecmaVersion: 'latest', sourceType: 'script' }); }
  catch (error) { return { passed: false, checks: [{ label: 'JavaScript 语法检查', ok: false, detail: `语法未通过：${error.message}` }] }; }
  const checks = [{ label: 'JavaScript 语法检查', ok: true }, ...(id === 'counter' ? counterChecks(ast) : requestChecks(ast))];
  return { passed: checks.every(item => item.ok), checks };
}
export function initEditor(db) {
  initProgression(db);
  db.exec(`CREATE TABLE IF NOT EXISTS editor_drafts (
    puzzle_id TEXT PRIMARY KEY, source TEXT NOT NULL, updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS editor_submissions (
    id TEXT PRIMARY KEY, puzzle_id TEXT NOT NULL, source TEXT NOT NULL,
    passed INTEGER NOT NULL CHECK(passed IN (0,1)), checks_json TEXT NOT NULL, created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_editor_submissions_puzzle ON editor_submissions(puzzle_id, created_at DESC);`);
}
function accessible(db) {
  return Boolean(db.prepare("SELECT 1 FROM game_progress WHERE stage_id='js-debug' AND best_stars>0").get());
}
function requirePuzzle(db, id) {
  const puzzle = byId.get(id);
  if (!puzzle) throw new EditorError('代码题不存在', 404);
  if (!accessible(db)) throw new EditorError('请先通关 JavaScript 森林的「代码侦探」', 409);
  return puzzle;
}
function latest(db, id) {
  return db.prepare('SELECT * FROM editor_submissions WHERE puzzle_id=? ORDER BY created_at DESC, rowid DESC LIMIT 1').get(id);
}
function solved(db, id) {
  return Boolean(db.prepare('SELECT 1 FROM editor_submissions WHERE puzzle_id=? AND passed=1 LIMIT 1').get(id));
}
export function editorCatalog(db) {
  initEditor(db);
  const unlocked = accessible(db);
  return { unlocked, notice: '代码只解析 AST，绝不执行。检查固定结构，不等于验证全部运行语义或通过真实单元测试。',
    puzzles: PUZZLES.map(puzzle => ({ id: puzzle.id, title: puzzle.title, topic: puzzle.topic, xp: puzzle.xp,
      solved: unlocked && solved(db, puzzle.id), submissions: unlocked ? db.prepare('SELECT COUNT(*) AS n FROM editor_submissions WHERE puzzle_id=?').get(puzzle.id).n : 0 })),
    player: db.prepare('SELECT xp FROM game_players WHERE id=?').get(PLAYER) };
}
export function editorPuzzle(db, id) {
  initEditor(db);
  const puzzle = requirePuzzle(db, id);
  const draft = db.prepare('SELECT source,updated_at FROM editor_drafts WHERE puzzle_id=?').get(id);
  const last = latest(db, id);
  return { id, title: puzzle.title, topic: puzzle.topic, symptom: puzzle.symptom, goals: puzzle.goals, hint: puzzle.hint,
    source: draft?.source ?? puzzle.starter, updatedAt: draft?.updated_at ?? null,
    solved: solved(db, id), checks: last ? JSON.parse(last.checks_json) : null,
    lastPassed: last ? Boolean(last.passed) : null,
    submissions: db.prepare('SELECT COUNT(*) AS n FROM editor_submissions WHERE puzzle_id=?').get(id).n,
    notice: '只检查语法和特定 AST 结构；不会执行代码，也不能代替运行测试。' };
}
export function saveEditorDraft(db, id, source) {
  initEditor(db);
  requirePuzzle(db, id);
  if (typeof source !== 'string' || !source.trim() || source.length > 4096) throw new EditorError('草稿必须为非空文本，最多 4096 字符');
  db.prepare(`INSERT INTO editor_drafts(puzzle_id,source,updated_at) VALUES (?,?,?)
    ON CONFLICT(puzzle_id) DO UPDATE SET source=excluded.source,updated_at=excluded.updated_at`).run(id, source, stamp());
  return editorPuzzle(db, id);
}
export function submitEditor(db, id, source) {
  initEditor(db);
  const puzzle = requirePuzzle(db, id);
  const result = checkSource(id, source);
  db.exec('BEGIN IMMEDIATE');
  try {
    const at = stamp();
    db.prepare(`INSERT INTO editor_drafts(puzzle_id,source,updated_at) VALUES (?,?,?)
      ON CONFLICT(puzzle_id) DO UPDATE SET source=excluded.source,updated_at=excluded.updated_at`).run(id, source, at);
    db.prepare('INSERT INTO editor_submissions(id,puzzle_id,source,passed,checks_json,created_at) VALUES (?,?,?,?,?,?)')
      .run(randomUUID(), id, source, Number(result.passed), JSON.stringify(result.checks), at);
    let earnedXp = 0;
    if (result.passed) {
      const inserted = db.prepare('INSERT OR IGNORE INTO game_rewards(event_key,amount,created_at) VALUES (?,?,?)')
        .run(`editor:${id}`, puzzle.xp, at).changes;
      if (inserted) {
        earnedXp = puzzle.xp;
        db.prepare('UPDATE game_players SET xp=xp+? WHERE id=?').run(earnedXp, PLAYER);
      }
    } else {
      db.prepare('INSERT OR IGNORE INTO review_items(knowledge_id,due_on) SELECT id,? FROM knowledge_points WHERE id=?')
        .run(at.slice(0, 10), puzzle.knowledgeId);
    }
    db.exec('COMMIT');
    return { ...editorPuzzle(db, id), earnedXp };
  } catch (error) { db.exec('ROLLBACK'); throw error; }
}

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createDatabase } from './core.mjs';
import { checkSource, editorCatalog, editorPuzzle, initEditor, saveEditorDraft, submitEditor } from './editor.mjs';

const COUNTER = `function startCounter(setCount) {
  const timer = setInterval(() => setCount(previous => previous + 1), 1000);
  return () => clearInterval(timer);
}`;
const REQUEST = `function loadLatest(query, fetcher, render) {
  let active = true;
  fetcher(query).then(data => { if (active) render(data); });
  return () => { active = false; };
}`;
function unlock(db) {
  initEditor(db);
  db.prepare("INSERT OR IGNORE INTO game_progress(stage_id,best_stars,clears,updated_at) VALUES ('js-debug',1,1,?)").run(new Date().toISOString());
}

test('parse-only checker gives actionable feedback and ignores comment/string spoofing', () => {
  assert.equal(checkSource('counter', COUNTER).passed, true);
  assert.equal(checkSource('stale-request', REQUEST).passed, true);
  assert.equal(checkSource('counter', 'function startCounter(setCount) { return () => {}; } // setCount(n => n+1); clearInterval(timer)').passed, false);
  const syntax = checkSource('counter', 'function startCounter( {');
  assert.equal(syntax.passed, false);
  assert.match(syntax.checks[0].detail, /语法未通过/);
  assert.throws(() => checkSource('counter', 'x'.repeat(4097)), /4096/);
  assert.throws(() => checkSource('missing', 'hello'), /不存在/);
});

test('unlock gate, persistent draft, real feedback, wrong-topic enrollment and one-time XP', () => {
  const folder = mkdtempSync(join(tmpdir(), 'nowen-editor-'));
  const path = join(folder, 'study.db');
  let db = createDatabase(path);
  try {
    assert.equal(editorCatalog(db).unlocked, false);
    assert.throws(() => editorPuzzle(db, 'counter'), /代码侦探/);
    unlock(db);
    assert.equal(editorCatalog(db).unlocked, true);
    saveEditorDraft(db, 'counter', 'function startCounter(setCount) { return () => {}; }');
    db.close();
    db = createDatabase(path);
    assert.match(editorPuzzle(db, 'counter').source, /return \(\) => \{\}/);
    const initial = submitEditor(db, 'counter', 'function startCounter(setCount) { return () => {}; }');
    assert.equal(initial.lastPassed, false);
    assert.equal(initial.earnedXp, 0);
    assert.equal(initial.checks.length, 3);
    assert.ok(db.prepare("SELECT 1 FROM review_items WHERE knowledge_id='interview:react-effects'").get());
    const success = submitEditor(db, 'counter', COUNTER);
    assert.equal(success.lastPassed, true);
    assert.equal(success.earnedXp, 75);
    assert.equal(submitEditor(db, 'counter', COUNTER).earnedXp, 0);
    assert.equal(submitEditor(db, 'stale-request', REQUEST).earnedXp, 75);
    assert.equal(db.prepare("SELECT xp FROM game_players WHERE id='local'").get().xp, 150);
    assert.equal(editorCatalog(db).puzzles.filter(item => item.solved).length, 2);
    db.close();
    db = createDatabase(path);
    assert.equal(editorPuzzle(db, 'counter').solved, true);
    assert.equal(editorPuzzle(db, 'counter').source, COUNTER);
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM game_rewards WHERE event_key LIKE 'editor:%'").get().n, 2);
  } finally { db.close(); rmSync(folder, { recursive: true, force: true }); }
});

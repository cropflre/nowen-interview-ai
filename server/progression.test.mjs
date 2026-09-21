import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PATCHES, progressionDashboard, readStory, claimAchievement, startCodeRun, codeRun, answerCodeRun } from './progression.mjs';

function fixture(filename = ':memory:') {
  const db = new DatabaseSync(filename);
  db.exec(`PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS game_progress(stage_id TEXT PRIMARY KEY,best_stars INTEGER NOT NULL DEFAULT 0,clears INTEGER NOT NULL DEFAULT 0,updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS knowledge_points(id TEXT PRIMARY KEY);
    CREATE TABLE IF NOT EXISTS review_items(knowledge_id TEXT PRIMARY KEY REFERENCES knowledge_points(id),due_on TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS review_logs(id INTEGER PRIMARY KEY, knowledge_id TEXT, delayed INTEGER,correct INTEGER);
    CREATE TABLE IF NOT EXISTS sessions(id TEXT PRIMARY KEY,status TEXT);
    CREATE TABLE IF NOT EXISTS turns(id INTEGER PRIMARY KEY,session_id TEXT,answer TEXT);`);
  for (const id of new Set(PATCHES.map(p => p.knowledgeId)))
    db.prepare('INSERT OR IGNORE INTO knowledge_points(id) VALUES (?)').run(id);
  return db;
}
const clear = (db, stageId, stars = 1) => db.prepare('INSERT OR REPLACE INTO game_progress(stage_id,best_stars,clears,updated_at) VALUES (?,?,1,?)').run(stageId, stars, new Date().toISOString());
function answer(db, run, choices) {
  for (const choice of choices)
    run = answerCodeRun(db, run.id, { puzzleId: run.current.id, choice, reasoning: '观察问题并解释补丁' });
  return run;
}

test('skill tree and story are derived from real progress; no premature story reveal', () => {
  const db = fixture();
  const start = progressionDashboard(db);
  assert.equal(start.skills[0].completed, 0);
  assert.equal(start.stories[0].unlocked, true);
  assert.equal(start.stories[1].text, null);
  assert.throws(() => readStory(db, 'scope'), { status: 409 });
  assert.equal(readStory(db, 'arrival').read, true);
  clear(db, 'js-scope'); clear(db, 'js-closure');
  assert.equal(progressionDashboard(db).skills[0].unlocked, true);
  assert.equal(readStory(db, 'scope').title, '第一幕 · 变量的影子');
  assert.equal(progressionDashboard(db).stories[1].read, true);
  db.close();
});

test('achievements require evidence and pay XP once, even across repeated claims', () => {
  const db = fixture();
  assert.throws(() => claimAchievement(db, 'first-step'), { status: 409 });
  clear(db, 'js-scope');
  assert.equal(claimAchievement(db, 'first-step').earnedXp, 30);
  assert.equal(claimAchievement(db, 'first-step').earnedXp, 0);
  assert.equal(progressionDashboard(db).player.xp, 30);
  assert.throws(() => claimAchievement(db, 'nonexistent'), { status: 404 });
  db.close();
});

test('code puzzle is gated, hides current solution, blocks replay, saves wrong topic', () => {
  const db = fixture();
  assert.throws(() => startCodeRun(db), { status: 409 });
  clear(db, 'js-debug');
  const run = startCodeRun(db);
  assert.equal(startCodeRun(db).id, run.id);
  assert.equal('correct' in run.current, false);
  assert.equal('explanation' in run.current, false);
  const next = answerCodeRun(db, run.id, { puzzleId: run.current.id, choice: 1 });
  assert.equal(next.feedback[0].correct, false);
  assert.equal(next.current.id, 'race');
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM review_items').get().n, 1);
  assert.throws(() => answerCodeRun(db, run.id, { puzzleId: 'timer', choice: 0 }), { status: 409 });
  const finished = answer(db, next, [1, 2]);
  assert.equal(finished.status, 'cleared');
  assert.equal(finished.score, 2);
  assert.equal(finished.earnedXp, 120);
  assert.equal(claimAchievement(db, 'repair').earnedXp, 50);
  assert.throws(() => answerCodeRun(db, run.id, { puzzleId: 'microtask', choice: 2 }), { status: 409 });
  db.close();
});

test('retry improves to perfect but rewards are idempotent', () => {
  const db = fixture(); clear(db, 'js-debug');
  assert.equal(answer(db, startCodeRun(db), [0, 0, 2]).earnedXp, 120);
  assert.equal(answer(db, startCodeRun(db), [0, 1, 2]).earnedXp, 30);
  assert.equal(answer(db, startCodeRun(db), [0, 1, 2]).earnedXp, 0);
  assert.equal(progressionDashboard(db).code.bestScore, 3);
  assert.equal(progressionDashboard(db).player.xp, 150);
  db.close();
});

test('unfinished code run and story reading persist across SQLite restart', () => {
  const dir = mkdtempSync(join(tmpdir(), 'nowen-progression-'));
  try {
    const path = join(dir, 'game.db');
    let db = fixture(path); clear(db, 'js-debug');
    const initial = startCodeRun(db);
    const partial = answerCodeRun(db, initial.id, { puzzleId: initial.current.id, choice: 0 });
    readStory(db, 'arrival'); db.close();
    db = fixture(path);
    assert.equal(startCodeRun(db).id, initial.id);
    assert.equal(codeRun(db, initial.id).current.id, partial.current.id);
    assert.equal(progressionDashboard(db).stories[0].read, true);
    db.close();
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

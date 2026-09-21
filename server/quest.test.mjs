import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createDatabase } from './core.mjs';
import { revealReview, completeReview } from './memory.mjs';
import { dailyDashboard, claimDaily, startDemon, getDemon, advanceDemon } from './quest.mjs';

function seed(db, id = 'interview:js-closure') {
  db.prepare('INSERT OR IGNORE INTO review_items (knowledge_id,due_on) VALUES (?,?)').run(id, '2020-01-01');
}

test('daily tasks verify real events and reward exactly once', () => {
  const db = createDatabase();
  assert.equal(dailyDashboard(db).completed, 0);
  assert.throws(() => claimDaily(db, 'stage'), { status: 409 });
  const instant = new Date().toISOString();
  db.prepare("INSERT INTO game_attempts (id,stage_id,status,started_at,finished_at) VALUES (?,?,'cleared',?,?)")
    .run('daily-test-stage', 'js-scope', instant, instant);
  assert.equal(dailyDashboard(db).tasks.find(t => t.id === 'stage').completed, true);
  assert.equal(claimDaily(db, 'stage').earnedXp, 25);
  assert.equal(claimDaily(db, 'stage').earnedXp, 0);
  assert.equal(db.prepare("SELECT xp FROM game_players WHERE id='local'").get().xp, 25);
  assert.throws(() => claimDaily(db, 'unknown'), { status: 404 });
  db.close();
});

test('demon battle hides reference, requires real completed review and pays once', () => {
  const db = createDatabase();
  assert.throws(() => startDemon(db), { status: 409 });
  seed(db);
  const battle = startDemon(db);
  assert.equal(battle.total, 1);
  assert.equal(battle.current.attempt.phase, 'question');
  assert.equal('reference' in battle.current.attempt, false);
  assert.equal(startDemon(db).id, battle.id);
  assert.throws(() => advanceDemon(db, battle.id, battle.current.attempt.id), { status: 409 });
  revealReview(db, battle.current.attempt.id, { answer: '闭包访问词法环境中的变量' });
  completeReview(db, battle.current.attempt.id, { covered: true, rating: 'good' });
  const result = advanceDemon(db, battle.id, battle.current.attempt.id);
  assert.equal(result.status, 'cleared');
  assert.equal(result.correctCount, 1);
  assert.equal(dailyDashboard(db).tasks.find(t => t.id === 'demon').completed, true);
  assert.equal(claimDaily(db, 'demon').earnedXp, 60);
  assert.equal(claimDaily(db, 'demon').earnedXp, 0);
  assert.throws(() => advanceDemon(db, battle.id, battle.current.attempt.id), { status: 409 });
  db.close();
});

test('forgotten knowledge counts as practice, never as demon victory', () => {
  const db = createDatabase();
  seed(db);
  const battle = startDemon(db);
  assert.throws(() => advanceDemon(db, battle.id, '00000000-0000-0000-0000-000000000000'), { status: 409 });
  revealReview(db, battle.current.attempt.id, { answer: '不会' });
  completeReview(db, battle.current.attempt.id, { covered: false, rating: 'forgot' });
  assert.equal(advanceDemon(db, battle.id, battle.current.attempt.id).status, 'practice');
  assert.throws(() => claimDaily(db, 'demon'), { status: 409 });
  db.close();
});

test('unfinished demon challenge survives database reopen', () => {
  const dir = mkdtempSync(join(tmpdir(), 'nowen-demon-'));
  try {
    const file = join(dir, 'study.sqlite');
    let db = createDatabase(file);
    seed(db);
    const battle = startDemon(db);
    db.close();
    db = createDatabase(file);
    assert.equal(getDemon(db, battle.id).current.attempt.id, battle.current.attempt.id);
    assert.equal(dailyDashboard(db).activeEncounterId, battle.id);
    db.close();
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

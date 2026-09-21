import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { STAGES, initGame, gameWorld, startGameStage, gameAttempt, answerGameStage } from './game.mjs';
function fixture(path = ':memory:') {
 const db = new DatabaseSync(path);
 db.exec(`PRAGMA foreign_keys=ON;CREATE TABLE IF NOT EXISTS knowledge_points (id TEXT PRIMARY KEY);CREATE TABLE IF NOT EXISTS review_items (knowledge_id TEXT PRIMARY KEY REFERENCES knowledge_points(id),due_on TEXT NOT NULL);CREATE TABLE IF NOT EXISTS review_logs (id INTEGER PRIMARY KEY,knowledge_id TEXT,delayed INTEGER,correct INTEGER);`);
 for(const id of new Set(STAGES.flatMap(s=>s.questions.map(q=>q.knowledgeId))))db.prepare('INSERT OR IGNORE INTO knowledge_points(id) VALUES (?)').run(id);
 initGame(db);return db;
}
function play(db, stage, answers) {
 let current=startGameStage(db,stage);
 for(const choice of answers)current=answerGameStage(db,current.id,{questionId:current.current.id,choice,reasoning:'我独立解释了自己的思路'});
 return current;
}
test('world unlocks sequentially and does not expose correct answers',()=>{
 const db=fixture(),world=gameWorld(db);
 assert.equal(world.stages.length,5);
 assert.deepEqual(world.stages.map(s=>s.status),['available','locked','locked','locked','locked']);
 assert.throws(()=>startGameStage(db,'js-boss'),{status:409});
 const attempt=startGameStage(db,'js-scope');
 assert.equal('correct' in attempt.current,false);
 assert.equal('explanation' in attempt.current,false);
 assert.equal(startGameStage(db,'js-scope').id,attempt.id);db.close();
});
test('wrong answers enter memory without rewards; stale or duplicate answers fail',()=>{
 const db=fixture(),started=startGameStage(db,'js-scope');
 let a=answerGameStage(db,started.id,{questionId:started.current.id,choice:0});
 assert.equal(a.feedback[0].correct,false);assert.equal('correct' in a.current,false);
 assert.throws(()=>answerGameStage(db,started.id,{questionId:'scope-1',choice:1}),{status:409});
 a=answerGameStage(db,started.id,{questionId:a.current.id,choice:0});
 a=answerGameStage(db,started.id,{questionId:a.current.id,choice:1});
 assert.equal(a.status,'failed');assert.equal(gameWorld(db).player.xp,0);
 assert.equal(db.prepare('SELECT count(*) AS n FROM review_items').get().n,1);
 assert.throws(()=>answerGameStage(db,started.id,{questionId:'scope-3',choice:0}),{status:409});db.close();
});
test('all five levels clear, XP is idempotent, and the memory star requires delayed review',()=>{
 const db=fixture();const first=play(db,'js-scope',[1,1,0]);
 assert.equal(first.status,'cleared');assert.equal(first.stars,2);assert.equal(first.earnedXp,120);
 assert.equal(gameWorld(db).stages[1].status,'available');
 assert.equal(play(db,'js-scope',[1,1,0]).earnedXp,0);
 play(db,'js-closure',[1,1,2]);play(db,'js-async',[1,2,1]);play(db,'js-debug',[1,2,2]);
 const boss=play(db,'js-boss',[2,2,2]);assert.equal(boss.earnedXp,360);
 const world=gameWorld(db);assert.equal(world.cleared,5);assert.equal(world.player.xp,840);
 assert.equal(world.stages[4].stars,2);
 db.prepare('INSERT INTO review_logs(knowledge_id,delayed,correct) VALUES (?,?,?)').run('interview:js-event-loop',1,1);
 assert.equal(gameWorld(db).stages[4].stars,3);db.close();
});
test('improving partial clear grants only the one-time bonus',()=>{
 const db=fixture();assert.equal(play(db,'js-scope',[1,1,2]).earnedXp,100);
 assert.equal(play(db,'js-scope',[1,1,0]).earnedXp,20);
 assert.equal(play(db,'js-scope',[1,1,0]).earnedXp,0);
 assert.equal(db.prepare('SELECT count(*) AS n FROM game_rewards').get().n,2);db.close();
});
test('unfinished battle survives database restart',()=>{
 const dir=mkdtempSync(join(tmpdir(),'nowen-game-'));
 try{const path=join(dir,'game.db');let db=fixture(path);const started=startGameStage(db,'js-scope');const next=answerGameStage(db,started.id,{questionId:started.current.id,choice:1});db.close();db=fixture(path);assert.equal(startGameStage(db,'js-scope').id,started.id);assert.equal(gameAttempt(db,started.id).current.id,next.current.id);db.close();}
 finally{rmSync(dir,{recursive:true,force:true});}
});
test('unknown stage and malformed or stale submission are rejected',()=>{
 const db=fixture();assert.throws(()=>startGameStage(db,'__proto__'),{status:404});
 const attempt=startGameStage(db,'js-scope');
 assert.throws(()=>answerGameStage(db,attempt.id,{questionId:'scope-1',choice:4}),{status:400});
 assert.throws(()=>answerGameStage(db,attempt.id,{questionId:'scope-9',choice:1}),{status:409});
 assert.equal(gameAttempt(db,attempt.id).answered,0);db.close();
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createDatabase } from './core.mjs';
import { FRAMEWORK_STAGES, frameworkWorld, startFrameworkStage, frameworkAttempt, answerFrameworkStage } from './framework.mjs';

function open() { const dir=mkdtempSync(join(tmpdir(),'framework-'));return {dir,path:join(dir,'game.sqlite'),close:()=>rmSync(dir,{recursive:true,force:true})}; }
function unlockForest(db) {db.prepare("INSERT INTO game_progress(stage_id,best_stars,clears,updated_at) VALUES ('js-boss',1,1,?)").run(new Date().toISOString());}

test('React world requires forest boss, hides future answers, completes five stages and cannot farm XP',()=>{
 const tmp=open(),db=createDatabase(tmp.path);
 try{
  assert.equal(frameworkWorld(db).unlocked,false);
  assert.equal(frameworkWorld(db).stages[0].status,'locked');
  assert.throws(()=>startFrameworkStage(db,'react-state'),/森林 BOSS/);
  unlockForest(db);
  assert.equal(frameworkWorld(db).stages[0].status,'available');
  assert.equal(frameworkWorld(db).stages[1].status,'locked');
  for(let index=0;index<FRAMEWORK_STAGES.length;index++){
    const stage=FRAMEWORK_STAGES[index];
    const attempt=startFrameworkStage(db,stage.id);
    assert.ok(attempt.current);
    assert.equal(JSON.stringify(attempt).includes('correctChoice'),false);
    assert.equal(frameworkWorld(db).stages[index].status,'available');
    let next=attempt;
    for(const question of stage.questions){
      next=answerFrameworkStage(db,attempt.id,{questionId:question.id,choice:question.correct,reasoning:'独立解释'});
    }
    assert.equal(next.status,'cleared');
    assert.equal(next.stars,2);
    assert.ok(next.earnedXp>0);
    assert.throws(()=>answerFrameworkStage(db,attempt.id,{questionId:stage.questions[2].id,choice:stage.questions[2].correct}),/已结算/);
    assert.equal(frameworkWorld(db).cleared,index+1);
  }
  assert.equal(frameworkWorld(db).player.xp,1020);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM game_rewards WHERE event_key LIKE ?').get('framework:%').n,10);
  const again=startFrameworkStage(db,'react-boss');
  let replay=again;
  for(const question of FRAMEWORK_STAGES[4].questions)replay=answerFrameworkStage(db,again.id,{questionId:question.id,choice:question.correct});
  assert.equal(replay.earnedXp,0);
  assert.equal(frameworkWorld(db).player.xp,1020);
 } finally {db.close();tmp.close();}
});

test('wrong answer enters shared memory; unfinished chapter survives SQLite reopening',()=>{
 const tmp=open();let db=createDatabase(tmp.path);
 try{
  frameworkWorld(db);unlockForest(db);
  const started=startFrameworkStage(db,'react-state');
  let current=answerFrameworkStage(db,started.id,{questionId:started.current.id,choice:0});
  assert.equal(current.feedback[0].correct,false);
  assert.ok(db.prepare("SELECT knowledge_id FROM review_items WHERE knowledge_id='interview:react-state'").get());
  db.close();db=createDatabase(tmp.path);
  assert.equal(frameworkAttempt(db,started.id).answered,1);
  assert.equal(startFrameworkStage(db,'react-state').id,started.id);
  for(const question of FRAMEWORK_STAGES[0].questions.slice(1))current=answerFrameworkStage(db,started.id,{questionId:question.id,choice:question.correct});
  assert.equal(current.status,'cleared');
  assert.equal(current.stars,1);
  assert.equal(frameworkWorld(db).stages[1].status,'available');
 } finally {db.close();tmp.close();}
});

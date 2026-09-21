import test from 'node:test';
import assert from 'node:assert/strict';
import { createDatabase } from './core.mjs';
import { calendarDay, calendarRange } from './calendar.mjs';
import { gameWorld } from './game.mjs';
import { dailyDashboard, claimDaily } from './quest.mjs';
import { reviewQueue, reviewDashboard } from './memory.mjs';

test('calendar boundary: UTC previous date belongs to Shanghai today across all dashboards',()=>{
 const old=process.env.APP_TIME_ZONE;
 process.env.APP_TIME_ZONE='Asia/Shanghai';
 const db=createDatabase();
 try{
  const today=calendarDay(),{start,end,zone}=calendarRange();
  assert.equal(zone,'Asia/Shanghai');
  const justAfterMidnight=new Date(Date.parse(start)+60000).toISOString();
  assert.equal(calendarDay(justAfterMidnight),today);
  // Prior UTC date, current local date: substr(finished_at,1,10) would be wrong.
  assert.notEqual(justAfterMidnight.slice(0,10),today);
  const dashboard=dailyDashboard(db);
  assert.equal(dashboard.day,today);
  assert.equal(dashboard.timeZone,'Asia/Shanghai');
  db.prepare("INSERT INTO game_attempts(id,stage_id,status,started_at,finished_at,correct_count,stars,earned_xp) VALUES ('boundary','js-scope','cleared',?,?,2,1,0)").run(justAfterMidnight,justAfterMidnight);
  assert.equal(dailyDashboard(db).tasks.find(task=>task.id==='stage').completed,true);
  assert.equal(claimDaily(db,'stage').earnedXp,25);
  assert.equal(claimDaily(db,'stage').earnedXp,0);
  db.prepare('INSERT INTO review_items(knowledge_id,due_on) VALUES (?,?)').run('interview:react-effects',today);
  assert.equal(reviewQueue(db).due.length,1);
  assert.equal(reviewDashboard(db).due,1);
  assert.equal(gameWorld(db).dueReviews,1);
 }finally{db.close();if(old===undefined)delete process.env.APP_TIME_ZONE;else process.env.APP_TIME_ZONE=old;}
});

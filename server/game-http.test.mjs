import test from 'node:test';
import assert from 'node:assert/strict';
import { createDatabase } from './core.mjs';
import { createAppServer } from './index.mjs';

test('game HTTP: locked gate, hidden answer, sequential turns, no duplicate submit',async()=>{
 const db=createDatabase();const server=createAppServer(db);
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base=`http://127.0.0.1:${server.address().port}`;
 const call=async(path,init)=>{const response=await fetch(base+path,{...init,headers:{'content-type':'application/json'}});return [response.status,await response.json()];};
 try{
  let [status,world]=await call('/api/game/world');
  assert.equal(status,200);assert.deepEqual(world.stages.map(s=>s.status),['available','locked','locked','locked','locked']);
  [status]=await call('/api/game/stages/js-boss/start',{method:'POST',body:'{}'});assert.equal(status,409);
  let attempt;[status,attempt]=await call('/api/game/stages/js-scope/start',{method:'POST',body:'{}'});
  assert.equal(status,201);assert.ok(!('correct' in attempt.current));
  const firstId=attempt.current.id;
  [status,attempt]=await call(`/api/game/attempts/${attempt.id}/answer`,{method:'POST',body:JSON.stringify({questionId:firstId,choice:1})});
  assert.equal(status,200);assert.equal(attempt.answered,1);
  [status]=await call(`/api/game/attempts/${attempt.id}/answer`,{method:'POST',body:JSON.stringify({questionId:firstId,choice:1})});assert.equal(status,409);
  [status,world]=await call('/api/game/world');assert.equal(status,200);assert.equal(world.player.xp,0);
 }finally{await new Promise(resolve=>server.close(resolve));db.close();}
});

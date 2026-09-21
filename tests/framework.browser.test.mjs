import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createDatabase } from '../server/core.mjs';
import { createAppServer } from '../server/index.mjs';
import { FRAMEWORK_STAGES } from '../server/framework.mjs';

test('Chromium: locked islands -> forest boss unlock -> five-stage React journey -> replay and daily quest', {timeout:90000},async()=>{
 const db=createDatabase();
 const server=createAppServer(db);
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 let browser;
 try{
  browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:1250,height:850}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  const tabs=page.locator('.quest-global-tabs');
  await page.getByRole('heading',{name:'修炼世界地图'}).waitFor();
  await tabs.getByRole('button',{name:/框架群岛/}).click();
  await page.getByRole('heading',{name:/群岛航线尚未开放/}).waitFor();
  // Seed only the prerequisite earned in the separate forest E2E. Do not bypass island stages.
  db.prepare("INSERT INTO game_progress(stage_id,best_stars,clears,updated_at) VALUES ('js-boss',1,1,?)").run(new Date().toISOString());
  await tabs.getByRole('button',{name:/世界地图/}).click();
  await page.getByRole('heading',{name:'修炼世界地图'}).waitFor();
  await page.getByRole('button',{name:/进入框架群岛/}).click();
  await page.getByRole('heading',{name:'React 群岛航路'}).waitFor();
  assert.equal(await page.locator('.quest-stage').count(),5);
  assert.equal(await page.locator('.quest-stage').nth(1).isDisabled(),true);
  for(let i=0;i<FRAMEWORK_STAGES.length;i++){
   await page.locator('.quest-stage').nth(i).click();
   for(let j=0;j<3;j++){
    await page.getByText(`第 ${j+1} / 3 回合`).waitFor();
    if(i===0&&j===1){
     await page.reload();
     await page.getByRole('heading',{name:'修炼世界地图'}).waitFor();
     await tabs.getByRole('button',{name:/框架群岛/}).click();
     await page.getByText('第 2 / 3 回合').waitFor();
    }
    const answer=FRAMEWORK_STAGES[i].questions[j].correct;
    await page.locator('.quest-options [role="radio"]').nth(answer).click();
    await page.getByRole('button',{name:/锁定答案/}).click();
   }
   await page.getByRole('heading',{name:'群岛关卡通关！'}).waitFor();
   await page.getByRole('button',{name:/返回群岛/}).click();
   await page.getByRole('heading',{name:'React 群岛航路'}).waitFor();
  }
  await page.getByText('章节进度 5 / 5').waitFor();
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM framework_progress').get().n,5);
  const xp=db.prepare("SELECT xp FROM game_players WHERE id='local'").get().xp;
  assert.equal(xp,1020);
  await page.locator('.quest-stage').nth(4).click();
  for(const q of FRAMEWORK_STAGES[4].questions){await page.locator('.quest-options [role="radio"]').nth(q.correct).click();await page.getByRole('button',{name:/锁定答案/}).click();}
  await page.getByText('本次获得 +0 XP').waitFor();
  assert.equal(db.prepare("SELECT xp FROM game_players WHERE id='local'").get().xp,xp);
  await tabs.getByRole('button',{name:/每日修炼/}).click();
  await page.getByRole('heading',{name:'今日修炼'}).waitFor();
  await page.getByRole('button',{name:'领取奖励'}).first().click();
  await page.getByText(/领取成功，获得 25 XP/).waitFor();
  assert.equal(db.prepare("SELECT xp FROM game_players WHERE id='local'").get().xp,xp+25);
  assert.deepEqual(errors,[]);
 }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));db.close();}
});

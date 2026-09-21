import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createDatabase } from '../server/core.mjs';
import { createAppServer } from '../server/index.mjs';

async function withBrowser(run) {
  const db = createDatabase();
  const server = createAppServer(db);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1280, height: 850 } });
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.getByRole('heading', { name: '修炼世界地图' }).waitFor();
    await run({ db, page });
    assert.deepEqual(pageErrors, [], `Unexpected browser errors: ${pageErrors.join('; ')}`);
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
    db.close();
  }
}

async function answerQuestion(page, option) {
  await page.locator('.quest-options [role="radio"]').nth(option).click();
  await page.getByRole('button', { name: /锁定答案/ }).click();
}

const ANSWERS = [
  [1, 1, 0], // 作用域
  [1, 1, 2], // 闭包
  [1, 2, 1], // 异步
  [1, 2, 2], // 调试
  [2, 2, 2], // BOSS
];

test('Chromium: five stages unlock sequentially, restore mid-stage and never pay replay XP twice', { timeout: 90000 }, async () => {
  await withBrowser(async ({ db, page }) => {
    await page.getByRole('button', { name: /冒险闯关/ }).click();
    await page.getByRole('heading', { name: /程序员修炼之路/ }).waitFor();
    assert.equal(await page.locator('.quest-stage').count(), 5);
    assert.equal(await page.locator('.quest-stage').nth(1).isDisabled(), true);

    for (let stage = 0; stage < ANSWERS.length; stage++) {
      const stageButton = page.locator('.quest-stage').nth(stage);
      assert.equal(await stageButton.isDisabled(), false, `stage ${stage + 1} should be unlocked`);
      if (stage < 4) assert.equal(await page.locator('.quest-stage').nth(stage + 1).isDisabled(), true);
      await stageButton.click();
      await page.getByText('第 1 / 3 回合').waitFor();
      await answerQuestion(page, ANSWERS[stage][0]);

      if (stage === 0) {
        await page.getByText('第 2 / 3 回合').waitFor();
        await page.reload();
        await page.getByRole('heading', { name: '修炼世界地图' }).waitFor();
        await page.getByRole('button', { name: /冒险闯关/ }).click();
        // The game view restores the active attempt from localStorage + SQLite.
        await page.getByText('第 2 / 3 回合').waitFor();
        assert.equal(db.prepare("SELECT COUNT(*) AS n FROM game_attempts WHERE stage_id='js-scope'").get().n, 1);
      }

      for (let turn = 1; turn < 3; turn++) {
        await page.getByText(`第 ${turn + 1} / 3 回合`).waitFor();
        await answerQuestion(page, ANSWERS[stage][turn]);
      }
      await page.getByRole('heading', { name: '关卡通关！' }).waitFor();
      assert.equal(db.prepare('SELECT COUNT(*) AS n FROM game_progress').get().n, stage + 1);
      await page.getByRole('button', { name: /返回世界地图 ↗/ }).click();
      await page.getByRole('heading', { name: /森林冒险路线/ }).waitFor();
    }

    const firstXp = db.prepare("SELECT xp FROM game_players WHERE id='local'").get().xp;
    const firstRewards = db.prepare('SELECT COUNT(*) AS n FROM game_rewards').get().n;
    assert.equal(firstXp, 840, 'four normal full clears and one boss full clear');
    assert.equal(firstRewards, 10, 'first-clear and first-perfect events are unique per stage');
    await page.locator('.quest-stage').nth(4).click();
    for (const option of ANSWERS[4]) await answerQuestion(page, option);
    await page.getByRole('heading', { name: '关卡通关！' }).waitFor();
    await page.getByText('本次获得 +0 XP').waitFor();
    assert.equal(db.prepare("SELECT xp FROM game_players WHERE id='local'").get().xp, firstXp);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM game_rewards').get().n, firstRewards);
    assert.equal(db.prepare("SELECT clears FROM game_progress WHERE stage_id='js-boss'").get().clears, 2);
    await page.getByRole('button', { name: /返回世界地图 ↗/ }).click();
    await page.getByRole('button', { name: /世界地图/ }).click();
    await page.getByText('关卡进度 5/5').waitFor();
  });
});

test('Chromium: independent recall, reveal, reload, scheduled due review and self-reported delayed statistics', { timeout: 60000 }, async () => {
  await withBrowser(async ({ db, page }) => {
    const nav = page.locator('.quest-global-tabs');
    await nav.getByRole('button', { name: /记忆修炼/ }).click();
    await page.getByRole('heading', { name: '记忆训练中心' }).waitFor();
    await page.getByRole('tab', { name: /新学推荐/ }).click();
    await page.getByRole('button', { name: /开始学习/ }).first().click();
    assert.equal(await page.locator('.memory-reference').count(), 0, 'reference must be hidden while answering');
    await page.getByLabel('你的独立回答').fill('第一次独立回忆：整理关键点。');
    await page.getByRole('button', { name: /揭晓参考内容/ }).click();
    await page.locator('.memory-reference').waitFor();
    const knowledgeId = db.prepare("SELECT knowledge_id FROM review_attempts WHERE phase='revealed'").get().knowledge_id;
    await page.reload();
    await page.getByRole('heading', { name: '修炼世界地图' }).waitFor();
    await nav.getByRole('button', { name: /记忆修炼/ }).click();
    await page.locator('.memory-reference').waitFor();
    assert.equal(await page.getByLabel('你的独立回答').inputValue(), '第一次独立回忆：整理关键点。');
    assert.equal(await page.getByLabel('你的独立回答').isDisabled(), true);
    await page.getByRole('checkbox', { name: /独立回答覆盖了关键点/ }).check();
    await page.getByRole('button', { name: '正常' }).click();
    await page.getByText(/本次复习已保存/).waitFor();
    let item = db.prepare('SELECT * FROM review_items WHERE knowledge_id=?').get(knowledgeId);
    assert.equal(item.attempts, 1);
    assert.equal(item.interval_index, 0);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM review_logs WHERE knowledge_id=?').get(knowledgeId).n, 1);

    // Simulate an elapsed UTC day by aging persisted data; do not mock the browser clock.
    const yesterday = new Date(Date.now() - 86400000);
    const oldDate = yesterday.toISOString().slice(0, 10);
    db.prepare('UPDATE review_items SET due_on=?, last_review_at=? WHERE knowledge_id=?')
      .run(oldDate, yesterday.toISOString(), knowledgeId);
    await page.reload();
    await page.getByRole('heading', { name: '修炼世界地图' }).waitFor();
    await nav.getByRole('button', { name: /记忆修炼/ }).click();
    await page.getByRole('tab', { name: /到期复习 1/ }).waitFor();
    await page.getByRole('button', { name: /独立复习/ }).first().click();
    await page.getByLabel('你的独立回答').fill('第二次回忆时忘记了。');
    await page.getByRole('button', { name: /揭晓参考内容/ }).click();
    await page.locator('.memory-reference').waitFor();
    await page.getByRole('button', { name: '忘记了' }).click();
    await page.getByText(/本次属于延迟复测/).waitFor();
    item = db.prepare('SELECT * FROM review_items WHERE knowledge_id=?').get(knowledgeId);
    assert.equal(item.attempts, 2);
    assert.equal(item.lapses, 1);
    assert.equal(item.delayed_success, 0);
    const delayed = db.prepare('SELECT delayed, correct, covered FROM review_logs WHERE knowledge_id=? ORDER BY id DESC LIMIT 1').get(knowledgeId);
    assert.deepEqual({ ...delayed }, { delayed: 1, correct: 0, covered: 0 });
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM review_attempts WHERE knowledge_id=? AND phase='completed'").get(knowledgeId).n, 2);
    await page.getByText('0%').waitFor();
  });
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createDatabase } from '../server/core.mjs';
import { initEditor } from '../server/editor.mjs';
import { createAppServer } from '../server/index.mjs';

const solution = `function startCounter(setCount) {
  const timer = setInterval(() => setCount(previous => previous + 1), 1000);
  return () => clearInterval(timer);
}`;

test('Chromium: homepage -> workshop -> edit -> check -> persisted state -> map', { timeout: 60000 }, async () => {
  const db = createDatabase();
  initEditor(db);
  db.prepare("INSERT INTO game_progress(stage_id,best_stars,clears,updated_at) VALUES ('js-debug',1,1,?)").run(new Date().toISOString());
  const server = createAppServer(db);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1280, height: 850 } });
    const origin = `http://127.0.0.1:${server.address().port}`;
    await page.goto(origin);
    await page.getByRole('button', { name: /代码工坊/ }).click();
    await page.getByRole('heading', { name: '代码工坊' }).waitFor();
    await page.getByRole('button', { name: /定时器里的旧闭包/ }).click();
    const editor = page.getByRole('textbox', { name: /JavaScript · 代码编辑区/ });
    await editor.fill(solution);
    await page.getByRole('button', { name: /提交结构检查/ }).click();
    await page.getByText('结构检查通过，获得 +75 XP！').waitFor();
    assert.equal(await editor.inputValue(), solution);
    await page.reload();
    await page.getByRole('button', { name: /代码工坊/ }).click();
    await page.getByRole('button', { name: /定时器里的旧闭包/ }).click();
    assert.equal(await page.getByRole('textbox', { name: /JavaScript · 代码编辑区/ }).inputValue(), solution);
    await page.getByText('已完成本题。建议仍在项目中补充真实运行测试和边界用例。').waitFor();
    await page.getByRole('button', { name: /世界地图/ }).click();
    await page.getByRole('button', { name: /代码工坊/ }).waitFor();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: /代码工坊/ }).click();
    await page.getByRole('heading', { name: '代码工坊' }).waitFor();
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
    db.close();
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createAccountStore } from '../server/auth.mjs';
import { createAppServer } from '../server/index.mjs';

test('Chromium: account setup -> private map -> AI consent -> dynamic question -> logout', { timeout: 60000 }, async () => {
  const dir = mkdtempSync(join(tmpdir(), 'nowen-account-browser-'));
  const auth = createAccountStore(dir);
  const server = createAppServer(null, auth);
  const previous = { AI_API_URL: process.env.AI_API_URL, AI_MODEL: process.env.AI_MODEL, AI_API_KEY: process.env.AI_API_KEY };
  const originalFetch = globalThis.fetch;
  process.env.AI_API_URL = 'https://provider.example/v1/chat/completions';
  process.env.AI_MODEL = 'mock-model';
  process.env.AI_API_KEY = 'mock-server-only';
  globalThis.fetch = async (_url, options) => {
    assert.equal(options.headers.authorization, 'Bearer mock-server-only');
    return new Response(JSON.stringify({ choices: [{ message: { content: '请从状态机的角度解释你刚才的回答？' } }] }), { status: 200 });
  };
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1150, height: 820 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.getByRole('heading', { name: '创建首个本机账户' }).waitFor();
    await page.getByLabel('用户名').fill('alice');
    await page.getByLabel('密码').fill('this-is-a-long-passphrase-123');
    await page.getByRole('button', { name: /创建账户并进入/ }).click();
    await page.getByRole('button', { name: /世界地图/ }).waitFor();
    assert.match(await page.locator('body').innerText(), /alice · 独立存档/);
    await page.getByRole('button', { name: /AI 面试/ }).click();
    await page.getByRole('heading', { name: 'AI 动态面试' }).waitFor();
    assert.equal(await page.getByRole('button', { name: /开始 AI 面试/ }).isDisabled(), true);
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: /开始 AI 面试/ }).click();
    await page.getByLabel(/你的独立回答/).fill('我会分析 state、props 与清理函数。');
    await page.getByRole('button', { name: /提交回答/ }).click();
    await page.getByText('请从状态机的角度解释你刚才的回答？').waitFor();
    await page.reload();
    await page.getByRole('button', { name: /AI 面试/ }).click();
    await page.getByText('请从状态机的角度解释你刚才的回答？').waitFor();
    await page.getByRole('button', { name: '退出登录' }).click();
    await page.getByRole('heading', { name: '登录修炼档案' }).waitFor();
    assert.deepEqual(errors, []);
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
    auth.close();
    globalThis.fetch = originalFetch;
    for (const [key, value] of Object.entries(previous)) if (value === undefined) delete process.env[key]; else process.env[key] = value;
    rmSync(dir, { recursive: true, force: true });
  }
});

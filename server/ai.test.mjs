import test from 'node:test';
import assert from 'node:assert/strict';
import { createDatabase } from './core.mjs';
import { aiConfig, startAiSession, getAiSession, answerAiSession, finishAiSession } from './ai.mjs';

const keys = ['AI_API_URL', 'AI_MODEL', 'AI_API_KEY'];
async function configured(run) {
  const old = Object.fromEntries(keys.map(k => [k, process.env[k]]));
  const fetchBefore = globalThis.fetch;
  process.env.AI_API_URL = 'https://provider.example/v1/chat/completions';
  process.env.AI_MODEL = 'test-interviewer';
  process.env.AI_API_KEY = 'secret-test-key';
  try { await run(); } finally {
    globalThis.fetch = fetchBefore;
    for (const k of keys) if (old[k] === undefined) delete process.env[k]; else process.env[k] = old[k];
  }
}
test('AI interview follows user answers and only reveals qualitative report after completion', async () => configured(async () => {
  const db = createDatabase();
  const calls = [];
  globalThis.fetch = async (_url, options) => {
    calls.push(JSON.parse(options.body));
    assert.equal(options.headers.authorization, 'Bearer secret-test-key');
    return new Response(JSON.stringify({ choices: [{ message: { content: calls.length === 7 ? '你解释了哪些证据？\n还有哪些地方需要核验？\n下次练习解释竞态。' : '请结合你刚才的代码举出一个反例？' } }] }), { status: 200 });
  };
  try {
    assert.equal(aiConfig().enabled, true);
    let session = startAiSession(db, { track: 'react' });
    assert.equal(session.ai.reportText, null);
    for (let i = 0; i < 9; i++) {
      const turnId = session.currentTurn;
      session = await answerAiSession(db, session.id, { turnId, answer: `我的第 ${i + 1} 个回答：说明 React 状态和清理。` });
      if (i === 0) {
        assert.match(session.turns.find(t => t.id === session.currentTurn).prompt, /反例/);
        assert.equal(session.ai.reportText, null);
        assert.equal(session.ai.lastMode, 'generated');
      }
    }
    assert.equal(session.status, 'completed');
    assert.equal(session.ai.reportStatus, 'generated');
    assert.match(session.ai.reportText, /证据/);
    assert.equal(getAiSession(db, session.id).ai.reportText, session.ai.reportText);
    assert.equal(calls.length, 7);
    assert.equal(calls[0].model, 'test-interviewer');
    assert.equal(calls.some(call => JSON.stringify(call).includes('secret-test-key')), false);
  } finally { db.close(); }
}));

test('provider outage falls back to curated followup without erasing answers', async () => configured(async () => {
  const db = createDatabase();
  globalThis.fetch = async () => { throw new Error('provider offline'); };
  try {
    let session = startAiSession(db, { track: 'react' });
    session = await answerAiSession(db, session.id, { turnId: session.currentTurn, answer: 'useEffect 在提交后运行，并执行清理。' });
    assert.equal(session.ai.lastMode, 'curated-fallback');
    assert.equal(session.turns.filter(turn => turn.answer !== null).length, 1);
    session = await finishAiSession(db, session.id);
    assert.equal(session.status, 'completed');
    assert.equal(session.ai.reportStatus, 'unavailable');
  } finally { db.close(); }
}));

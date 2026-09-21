import { useEffect, useState } from 'react';

async function request(path, options) {
  const response = await fetch(path, { ...options, headers: { 'content-type': 'application/json', ...options?.headers } });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || `请求失败 ${response.status}`);
  return body;
}
const tracks = [{ id: 'all', label: '前端综合' }, { id: 'javascript', label: 'JavaScript / TS' }, { id: 'react', label: 'React' }, { id: 'browser', label: '浏览器与网络' }, { id: 'engineering', label: '工程化' }, { id: 'ai', label: 'AI 应用前端' }];
export default function AiInterviewView({ onRules }) {
  const [config, setConfig] = useState(null), [session, setSession] = useState(null);
  const [consent, setConsent] = useState(false), [track, setTrack] = useState('all');
  const [answer, setAnswer] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  useEffect(() => { let live = true;
    request('/api/ai/config').then(data => { if (live) setConfig(data); }).catch(e => { if (live) setError(e.message); });
    const id = localStorage.getItem('nowen-ai-active');
    if (id) request(`/api/ai/sessions/${id}`).then(data => { if (live) setSession(data); })
      .catch(() => localStorage.removeItem('nowen-ai-active'));
    return () => { live = false; };
  }, []);
  async function act(fn) { if (busy) return; setBusy(true); setError(''); try { await fn(); } catch (e) { setError(e.message); } finally { setBusy(false); } }
  function sync(data) { setSession(data); setAnswer(''); localStorage.setItem('nowen-ai-active', data.id); }
  const current = session?.turns.find(turn => turn.id === session.currentTurn);
  const answered = session?.turns.filter(turn => turn.answer !== null).length || 0;
  return <main className="quest-hub" style={{ padding: '28px clamp(16px,4vw,54px)' }}><div className="quest-hub-inner">
    <header className="quest-hub-header"><div><span className="quest-hub-eyebrow">V0.8 · OPTIONAL AI PRACTICE</span><h1>🤖 AI 动态面试</h1><p>人工题库作为锚点，模型根据你的回答生成追问；服务不可用时回退到固定追问。</p></div></header>
    {error && <p role="alert" className="quest-hub-alert">{error} <button onClick={() => setError('')}>关闭</button></p>}
    {!config ? <p>正在读取服务端模型配置…</p> : !config.enabled ? <section className="framework-lock"><h2>AI 服务尚未启用</h2><p>需由本机管理员设置 AI_API_URL 与 AI_MODEL。密钥只保存在服务端环境变量，规则面试照常可用。</p><button onClick={onRules}>进入原有规则面试 →</button></section> : !session ? <section className="framework-lock" style={{ justifyItems: 'stretch' }}>
      <h2>选择方向 · {config.model}</h2><label>面试方向<select value={track} onChange={e => setTrack(e.target.value)}>{tracks.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}</select></label>
      <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} />我了解我的面试问题和回答将发送到管理员配置的模型服务；不包含本地密码或 API 密钥。AI 反馈可能不准确，需自行核验。</label>
      <button className="quest-hub-primary" disabled={!consent || busy} onClick={() => act(async () => sync(await request('/api/ai/sessions', { method: 'POST', body: JSON.stringify({ track, consent: true }) })))}>开始 AI 面试 ↗</button>
    </section> : session.status === 'active' ? <section className="framework-banner" style={{ background: '#123b49' }}>
      <span>LIVE · {session.ai.model} · 已回答 {answered} / {session.questionCount * 3}</span><h2>{current?.depth ? `追问 ${current.depth}` : '主题提问'}</h2><p style={{ whiteSpace: 'pre-wrap' }}>{current?.prompt}</p>
      <label htmlFor="ai-answer">你的独立回答（最长 4000 字）</label>
      <textarea id="ai-answer" style={{ minHeight: 180, width: '100%', padding: 16, borderRadius: 12, color: '#122c33' }} maxLength={4000} value={answer} onChange={e => setAnswer(e.target.value)} disabled={busy} />
      <p style={{ fontSize: 13 }}>{session.ai.lastMode === 'curated-fallback' ? '上一次模型调用失败：已经回退到人工追问。' : '面试进行中隐藏关键词与参考答案。模型生成内容不等于事实判断。'}</p>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}><button className="quest-hub-primary" disabled={busy || !answer.trim()} onClick={() => act(async () => sync(await request(`/api/ai/sessions/${session.id}/answers`, { method: 'POST', body: JSON.stringify({ turnId: session.currentTurn, answer }) })))}>{busy ? '正在生成或保存…' : '提交回答 →'}</button><button disabled={busy} onClick={() => act(async () => sync(await request(`/api/ai/sessions/${session.id}/finish`, { method: 'POST', body: '{}' })))}>提前结束并复盘</button><button disabled={busy} onClick={() => act(async () => sync(await request(`/api/ai/sessions/${session.id}`)))}>刷新进度</button></div>
    </section> : <section className="framework-lock" style={{ justifyItems: 'stretch' }}><h2>本轮训练结束</h2><p>回答 {session.report?.answeredTurns ?? 0} / {session.report?.plannedTurns ?? 0} 轮；固定关键词检查覆盖 {session.report?.coverage ?? '—'}%，不能作为技术正确率。</p>
      <h3>AI 复盘 · {session.ai.reportStatus === 'generated' ? '已生成' : '本次不可用'}</h3><p style={{ whiteSpace: 'pre-wrap' }}>{session.ai.reportText || '模型暂未提供复盘。可查看原有关键词报告，或重新练习。'}</p><p>{session.ai.notice}</p>
      <button className="quest-hub-primary" onClick={() => { localStorage.removeItem('nowen-ai-active'); setSession(null); }}>开始新的一轮</button><button onClick={onRules}>切换规则面试</button>
    </section>}
  </div></main>;
}

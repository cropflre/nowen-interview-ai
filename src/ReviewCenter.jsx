import { useCallback, useEffect, useState } from 'react';

const api = async (path, options) => {
  const response = await fetch(path, { ...options, headers: { 'content-type': 'application/json', ...options?.headers } });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `请求失败：${response.status}`);
  return data;
};
const post = (path, body) => api(path, { method: 'POST', body: JSON.stringify(body) });
const KEY = 'nowen-review-attempt';
const labels = { new: '未学习', learning: '初步理解', recent: '短期记住', consolidating: '待巩固', stable: '稳定掌握' };
const sources = { 'legacy-unreviewed': '旧版题库 · 待人工校对', 'interview-checklist': '面试关键点清单 · 非完整答案' };

export default function ReviewCenter() {
  const [dashboard, setDashboard] = useState(null);
  const [queue, setQueue] = useState(null);
  const [library, setLibrary] = useState([]);
  const [search, setSearch] = useState('');
  const [attempt, setAttempt] = useState(null);
  const [answer, setAnswer] = useState('');
  const [covered, setCovered] = useState(false);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('due');

  const refresh = useCallback(async (query = '') => {
    const [nextDashboard, nextQueue, nextLibrary] = await Promise.all([
      api('/api/review/dashboard'), api('/api/review/queue'), api(`/api/knowledge?q=${encodeURIComponent(query)}`),
    ]);
    setDashboard(nextDashboard); setQueue(nextQueue); setLibrary(nextLibrary);
  }, []);

  useEffect(() => {
    let active = true;
    async function restore() {
      try {
        await refresh();
        const id = localStorage.getItem(KEY);
        if (id && active) {
          try {
            const saved = await api(`/api/review/attempts/${id}`);
            if (saved.phase !== 'completed') { setAttempt(saved); setAnswer(saved.answer || ''); }
            else localStorage.removeItem(KEY);
          } catch { localStorage.removeItem(KEY); }
        }
      } catch (e) { if (active) setError(e.message); }
    }
    restore();
    return () => { active = false; };
  }, [refresh]);

  async function run(task) {
    if (busy) return;
    setBusy(true); setError('');
    try { await task(); } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  const open = (knowledgeId) => run(async () => {
    const next = await post('/api/review/attempts', { knowledgeId });
    setAttempt(next); setAnswer(next.answer || ''); setCovered(false); setResult(null);
    localStorage.setItem(KEY, next.id);
  });
  const reveal = () => run(async () => {
    const next = await post(`/api/review/attempts/${attempt.id}/reveal`, { answer });
    setAttempt(next); setCovered(false);
  });
  const complete = (rating) => run(async () => {
    const next = await post(`/api/review/attempts/${attempt.id}/complete`, { covered, rating });
    localStorage.removeItem(KEY);
    setAttempt(null); setAnswer(''); setCovered(false); setResult(next);
    await refresh(search);
  });
  const find = (event) => { event.preventDefault(); run(() => refresh(search)); };
  const cards = tab === 'due' ? queue?.due : tab === 'fresh' ? queue?.fresh : library;

  return <section className="memory-page">
    <div className="section-heading"><div><span className="eyebrow dark">ACTIVE RECALL · SPACED PRACTICE</span><h1>记忆训练中心</h1><p>先独立回答，揭晓后核对关键点，再决定下次复习日期。</p></div></div>
    {error && <div className="alert" role="alert">⚠ {error}<button aria-label="关闭错误" onClick={() => setError('')}>×</button></div>}
    {dashboard && <div className="memory-metrics">
      <div><strong>{dashboard.due}</strong><small>今日到期</small></div>
      <div><strong>{dashboard.stable}</strong><small>稳定掌握</small></div>
      <div><strong>{dashboard.delayedRate === null ? '—' : `${dashboard.delayedRate}%`}</strong><small>延迟复测自评覆盖率 · {dashboard.delayedAttempts} 次样本</small></div>
      <div><strong>{dashboard.total}</strong><small>知识库题目数</small></div>
    </div>}
    {attempt ? <div className="memory-practice">
      <div className="memory-label"><span>{attempt.category}</span><span>{attempt.phase === 'question' ? '① 独立回忆' : '② 揭晓与核对'}</span></div>
      <h2>{attempt.prompt}</h2>
      <p className="memory-source">{sources[attempt.source] || attempt.source}</p>
      <label htmlFor="review-answer">你的独立回答</label>
      <textarea id="review-answer" value={answer} maxLength={4000} onChange={(e) => setAnswer(e.target.value)} disabled={busy || attempt.phase !== 'question'} placeholder="不要翻参考答案。用自己的语言作答，不会可以填写「不会」。" />
      {attempt.phase === 'question' ? <div className="memory-actions"><button className="primary-button" disabled={busy || !answer.trim()} onClick={reveal}>揭晓参考内容 →</button></div> : <>
        <div className="memory-reference"><h3>参考内容（需自行核实）</h3><p>{attempt.reference}</p></div>
        <label className="memory-check"><input type="checkbox" checked={covered} onChange={(e) => setCovered(e.target.checked)} disabled={busy} /> 我已核对事实，独立回答覆盖了关键点</label>
        <p className="memory-source">自评不能代替客观判分；未勾选时按未掌握安排复习。旧题库未经逐条审核。</p>
        <div className="memory-actions">{[
          ['forgot', '忘记了'], ['hard', '很困难'], ['good', '正常'], ['easy', '轻松'],
        ].map(([value, name]) => <button className={value === 'good' ? 'primary-button' : 'ghost-button'} key={value} disabled={busy} onClick={() => complete(value)}>{name}</button>)}</div>
      </>}
    </div> : <>
      {result && <div className="memory-result" role="status">本次复习已保存：{labels[result.status]} · 下次复习 {result.dueOn}。{result.delayed ? '本次属于延迟复测。' : ''}</div>}
      <div className="memory-toolbar" role="tablist" aria-label="复习内容">
        <button role="tab" aria-selected={tab === 'due'} className={tab === 'due' ? 'active' : ''} onClick={() => setTab('due')}>到期复习 {queue?.due.length ?? '…'}</button>
        <button role="tab" aria-selected={tab === 'fresh'} className={tab === 'fresh' ? 'active' : ''} onClick={() => setTab('fresh')}>新学推荐 {queue?.fresh.length ?? '…'}</button>
        <button role="tab" aria-selected={tab === 'library'} className={tab === 'library' ? 'active' : ''} onClick={() => setTab('library')}>知识库</button>
      </div>
      {tab === 'library' && <form className="memory-search" onSubmit={find}><input value={search} onChange={(e) => setSearch(e.target.value)} maxLength={100} placeholder="搜索知识点或分类…" /><button className="ghost-button" disabled={busy}>搜索</button></form>}
      {cards?.length ? <div className="memory-cards">{cards.map((item) => <div className="memory-card" key={item.id}>
        <div><span className="memory-category">{item.category}</span><span className="memory-status">{labels[item.status]}</span></div>
        <h3>{item.prompt}</h3>
        <p>{sources[item.source] || item.source}{item.dueOn ? ` · 下次 ${item.dueOn}` : ''}</p>
        <button className="ghost-button" disabled={busy} onClick={() => open(item.id)}>{item.status === 'new' ? '开始学习 →' : '独立复习 →'}</button>
      </div>)}</div> : <div className="empty">{queue ? '这里暂时没有题目。可以到「知识库」选择想复习的内容。' : '正在载入记忆数据…'}</div>}
      <p className="memory-footnote">默认每次推荐最多 5 个新知识点；旧题库导入需运行 README 中的迁移命令。数据仅保存在当前本地 SQLite。</p>
    </>}
  </section>;
}

import { useEffect, useState } from 'react';
import ReviewCenter from './ReviewCenter.jsx';
import './memory.css';

const request = async (url, options) => {
  const response = await fetch(url, { ...options, headers: { 'content-type': 'application/json', ...options?.headers } });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `请求失败 (${response.status})`);
  return data;
};
const formatDate = (value) => value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '—';
const trackIcons = { all: '✦', javascript: 'JS', react: '⚛', browser: '◎', engineering: '⌘', ai: '✧' };

export default function App() {
  const [catalog, setCatalog] = useState(null);
  const [history, setHistory] = useState([]);
  const [track, setTrack] = useState('all');
  const [session, setSession] = useState(null);
  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [view, setView] = useState('hall');

  const refreshHistory = () => request('/api/sessions').then(setHistory);
  useEffect(() => {
    let alive = true;
    Promise.all([request('/api/catalog'), request('/api/sessions')]).then(async ([cat, sessions]) => {
      if (!alive) return;
      setCatalog(cat); setHistory(sessions);
      const id = localStorage.getItem('nowen-active-session');
      if (id) {
        try {
          const previous = await request(`/api/sessions/${id}`);
          if (alive) { setSession(previous); setView(previous.status === 'active' ? 'interview' : 'report'); }
        } catch { localStorage.removeItem('nowen-active-session'); }
      }
    }).catch((e) => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, []);

  async function run(action) {
    if (busy) return;
    setBusy(true); setError('');
    try { await action(); } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  function syncSession(next) {
    setSession(next);
    setAnswer('');
    if (next.status === 'active') { localStorage.setItem('nowen-active-session', next.id); setView('interview'); }
    else { localStorage.removeItem('nowen-active-session'); setView('report'); refreshHistory().catch(() => {}); }
  }
  const begin = () => run(async () => syncSession(await request('/api/sessions', { method: 'POST', body: JSON.stringify({ track }) })));
  const submit = () => run(async () => {
    if (!answer.trim()) { setError('先写下你的回答，也可以直接输入「不会」并继续。'); return; }
    syncSession(await request(`/api/sessions/${session.id}/answers`, {
      method: 'POST', body: JSON.stringify({ turnId: session.currentTurn, answer }),
    }));
  });
  const finish = () => {
    if (!window.confirm('现在结束面试？未回答的题目不会计入覆盖率。')) return;
    run(async () => syncSession(await request(`/api/sessions/${session.id}/finish`, { method: 'POST' })));
  };
  const openHistory = (id) => run(async () => {
    const next = await request(`/api/sessions/${id}`);
    syncSession(next);
  });
  const navigate = (next) => {
    if (session?.status === 'active' && next !== 'interview') {
      setView(next); return;
    }
    setView(next);
  };
  const current = session?.turns.find((turn) => turn.id === session.currentTurn);
  const answered = session?.turns.filter((turn) => turn.answer !== null).length || 0;
  const total = (session?.questionCount || 0) * 3;
  const currentNumber = current ? Math.floor(answered / 3) + 1 : 0;
  const activeTrack = catalog?.tracks.find((item) => item.id === session?.track);
  const previous = session?.turns.filter((turn) => turn.answer !== null) || [];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button className="brand" onClick={() => navigate('hall')} aria-label="返回面试大厅"><span className="brand-symbol">N</span><span>NOWEN <b>INTERVIEW</b><small>你的前端面试训练场</small></span></button>
        <div className="side-label">WORKSPACE</div>
        <nav aria-label="主导航">
          <button className={`nav-link ${view === 'hall' ? 'selected' : ''}`} onClick={() => navigate('hall')}><span>▦</span> 面试大厅</button>
          <button className={`nav-link ${view === 'interview' ? 'selected' : ''}`} disabled={!session || session.status !== 'active'} onClick={() => navigate('interview')}><span>◉</span> 进行中的面试 {session?.status === 'active' && <i className="online-dot" />}</button>
          <button className={`nav-link ${view === 'review' ? 'selected' : ''}`} onClick={() => navigate('review')}><span>◈</span> 记忆复习</button>
          <button className={`nav-link ${view === 'history' ? 'selected' : ''}`} onClick={() => { refreshHistory().catch((e) => setError(e.message)); navigate('history'); }}><span>◷</span> 面试记录</button>
          <button className={`nav-link ${view === 'report' ? 'selected' : ''}`} disabled={!session || session.status !== 'completed'} onClick={() => navigate('report')}><span>▤</span> 训练复盘</button>
        </nav>
        <div className="sidebar-bottom"><span className="status-dot" /> 本地优先 · SQLite 持久化<br /><small>题库追问 MVP · 非 AI 自动评分</small></div>
      </aside>
      <div className="main-area">
        <header className="topbar"><span><span className="crumb">训练中心</span> / {({ hall: '面试大厅', interview: '技术面试', history: '面试记录', report: '训练复盘', review: '记忆复习' })[view]}</span><span className="top-tag">FRONTEND INTERVIEW · V0.1</span></header>
        <main className="content">
          {error && <div className="alert" role="alert">⚠ {error}<button onClick={() => setError('')} aria-label="关闭错误">×</button></div>}
          {view === 'review' && <ReviewCenter />}
          {view === 'hall' && <>
            <div className="hero"><div className="hero-copy"><div className="eyebrow">✦ YOUR NEXT INTERVIEW STARTS HERE</div><h1>从知识储备，<br /><em>到面试中的从容表达。</em></h1><p>选择技术方向，进入真实的问答节奏。每道核心题包含两轮追问，结束后查看关键点覆盖与可执行的复习建议。</p><div className="hero-metrics"><span><b>05</b> 技术方向</span><span><b>{catalog?.questionCount || '—'}</b> 核心问题</span><span><b>02</b> 轮连续追问</span></div></div><div className="hero-art" aria-hidden="true"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><span>⌘</span><div className="art-caption">LEARN · PRACTICE · IMPROVE</div></div></div>
            <div className="section-heading"><div><span className="eyebrow dark">CHOOSE YOUR TRACK</span><h2>选择本次面试方向</h2></div><span className="muted">每次 3 道主题题 · 综合 5 道</span></div>
            {!catalog ? <p className="muted">正在载入题库…</p> : <div className="track-grid">{catalog.tracks.map((item) => <button key={item.id} className={`track-card ${track === item.id ? 'active' : ''}`} onClick={() => setTrack(item.id)} aria-pressed={track === item.id}><span className="track-icon">{trackIcons[item.id]}</span><span className="track-selected">{track === item.id ? '✓ 已选择' : '↗'}</span><strong>{item.label}</strong><small>{item.description}</small></button>)}</div>}
            <div className="start-panel"><div><span className="eyebrow dark">READY TO GO?</span><h3>{catalog?.tracks.find((item) => item.id === track)?.label || '前端综合面试'}</h3><p>完整记录回答 · 隐藏复盘要点 · 面试结束后统一反馈</p></div><button className="primary-button" disabled={busy || !catalog || session?.status === 'active'} onClick={begin}>{busy ? '创建中…' : session?.status === 'active' ? '已有进行中的面试' : '开始模拟面试 ↗'}</button>{session?.status === 'active' && <button className="text-button" onClick={() => navigate('interview')}>继续上次面试 →</button>}</div>
            <div className="tip">ⓘ 当前为离线规则版：追问来自人工编写的题库，报告是关键词覆盖检查，并非 AI 语义理解或真实面试通过率。后续可接入模型生成动态追问。</div>
          </>}
          {view === 'interview' && session?.status === 'active' && current && <>
            <div className="interview-heading"><div><span className="eyebrow dark">LIVE SESSION / {activeTrack?.label}</span><h1>技术模拟面试 <span className="live-pill">● 进行中</span></h1><p>无需背诵标准答案。用自己的语言解释原理，再尝试回答追问。</p></div><button className="ghost-button" disabled={busy} onClick={finish}>结束面试</button></div>
            <div className="progress-box"><div><span>当前主题 <b>{currentNumber} / {session.questionCount}</b></span><span>已回答 <b>{answered} / {total}</b></span></div><div className="progress-track"><div style={{ width: `${Math.round(100 * answered / total)}%` }} /></div></div>
            <div className="interview-layout"><section className="question-panel"><div className="question-top"><div className="avatar">N</div><span>NOWEN 面试官<small>技术面试 · {current.depth === 0 ? '主题问题' : `第 ${current.depth} 轮追问`}</small></span><span className="question-badge">Q{currentNumber} · {current.depth + 1}/3</span></div><div className="question-content"><div className="eyebrow dark">INTERVIEW QUESTION</div><h2>{current.prompt}</h2></div><div className="question-foot">✦ 重点考查：理解原理、解释过程与实际应用。可输入「不会」并继续。</div></section>
            <section className="answer-panel"><label htmlFor="answer"><span>你的回答</span><small>{answer.length} / 4000 字</small></label><textarea id="answer" value={answer} onChange={(event) => setAnswer(event.target.value)} maxLength={4000} placeholder="请独立组织语言回答。建议先说结论，再解释原理，最后结合例子…" disabled={busy} onKeyDown={(event) => { if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && !event.nativeEvent.isComposing) { event.preventDefault(); submit(); } }} /><div className="answer-actions"><span>Ctrl / ⌘ + Enter 提交</span><button className="primary-button" disabled={busy || !answer.trim()} onClick={submit}>{busy ? '提交中…' : '提交回答 →'}</button></div></section></div>
            <div className="interview-note">面试进行期间不展示关键词与参考要点，避免影响真实回忆；完成后可逐题复盘。</div>
          </>}
          {view === 'report' && session?.status === 'completed' && <><div className="report-head"><div className="eyebrow dark">POST INTERVIEW REVIEW</div><h1>面试训练复盘 <span className="report-icon">✳</span></h1><p>本次面试于 {formatDate(session.completedAt)} 结束 · {activeTrack?.label}</p></div><div className="report-stats"><div><small>已回答题目</small><strong>{session.report.answeredTurns}<span> / {session.report.plannedTurns}</span></strong></div><div><small>检查到的关键点</small><strong>{session.report.covered}<span> / {session.report.total}</span></strong></div><div><small>关键词覆盖率</small><strong>{session.report.coverage === null ? '—' : `${session.report.coverage}%`}</strong></div></div><div className="report-disclaimer">ⓘ {session.report.notice} 同义词、反例及错误观点都可能影响检查结果，必须由你核对事实。</div><div className="section-heading"><div><span className="eyebrow dark">ANSWER BREAKDOWN</span><h2>逐题查看与纠正</h2></div></div>{previous.length ? previous.map((turn, index) => <details className="review-card" key={turn.id} open={index === 0}><summary><span className="review-count">{String(index + 1).padStart(2, '0')}</span><span className="review-title">{turn.prompt}<small>{turn.depth === 0 ? '主题问题' : `第 ${turn.depth} 轮追问`}</small></span><span className="review-score">{turn.feedback.covered}/{turn.feedback.total} 关键点</span><span>⌄</span></summary><div className="review-body"><h4>你的原始回答</h4><p className="original-answer">{turn.answer}</p><h4>命中的要点</h4><div className="chip-row">{turn.feedback.matched.length ? turn.feedback.matched.map((label) => <span className="chip good" key={label}>✓ {label}</span>) : <span className="muted">未检测到预设关键词</span>}</div><h4>建议重新检查的要点</h4><div className="chip-row">{turn.feedback.missing.length ? turn.feedback.missing.map((label) => <span className="chip missed" key={label}>↗ {label}</span>) : <span className="muted">预设关键词已全部命中，仍需检查事实正确性。</span>}</div><p className="rubric-note">{turn.feedback.notice}</p></div></details>) : <div className="empty">本次提前结束，没有作答记录。</div>}<div className="start-panel report-bottom"><div><h3>下一步：针对遗漏点重新复述</h3><p>{session.report.gaps.length ? `优先复习：${session.report.gaps.slice(0, 4).join('、')}` : '你可以换一个方向，继续进行独立训练。'}</p><p>关键词检查显示的遗漏主题已加入复习队列（不会删除已有复习历史）。</p></div><button className="primary-button" onClick={() => navigate('review')}>进入记忆复习 ↗</button><button className="ghost-button" onClick={() => { setSession(null); setView('hall'); }}>返回面试大厅</button></div></>}
          {view === 'history' && <><div className="section-heading history-title"><div><span className="eyebrow dark">YOUR PRACTICE LOG</span><h1>面试记录</h1><p>最近 30 场训练保存在本机 SQLite 数据库中。</p></div><button className="ghost-button" onClick={() => refreshHistory().catch((e) => setError(e.message))}>刷新记录 ↻</button></div>{history.length ? <div className="history-list">{history.map((item) => <button className="history-row" key={item.id} disabled={busy} onClick={() => openHistory(item.id)}><span className="history-icon">{trackIcons[item.track]}</span><span className="history-details"><strong>{catalog?.tracks.find((t) => t.id === item.track)?.label || item.track}</strong><small>{formatDate(item.createdAt)} · 已回答 {item.answeredTurns} 题</small></span><span className={`history-status ${item.status === 'active' ? 'unfinished' : ''}`}>{item.status === 'active' ? '继续面试' : '查看复盘'}</span><span className="history-arrow">→</span></button>)}</div> : <div className="empty">还没有面试记录。先去面试大厅开始第一场训练吧。</div>}</>}
        </main>
      </div>
    </div>
  );
}

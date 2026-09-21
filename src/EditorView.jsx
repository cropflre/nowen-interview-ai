import { useEffect, useState } from 'react';
import './editor.css';

async function api(path, method, body) {
  const response = await fetch(path, { method: method || 'GET', headers: { 'content-type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `请求失败 (${response.status})`);
  return data;
}

export default function EditorView({ onPlay, onReview }) {
  const [catalog, setCatalog] = useState(null);
  const [detail, setDetail] = useState(null);
  const [source, setSource] = useState('');
  const [saved, setSaved] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  useEffect(() => {
    let live = true;
    api('/api/editor').then(data => { if (live) setCatalog(data); }).catch(e => { if (live) setError(e.message); });
    return () => { live = false; };
  }, []);
  useEffect(() => {
    if (!detail || source === saved || !source.trim() || source.length > 4096) return;
    const id = detail.id;
    const snapshot = source;
    const timer = setTimeout(() => {
      api(`/api/editor/${id}/draft`, 'PUT', { source: snapshot })
        .then(() => { if (detail.id === id) setSaved(snapshot); })
        .catch(e => setError(`自动保存失败：${e.message}`));
    }, 1000);
    return () => clearTimeout(timer);
  }, [detail?.id, source, saved]);
  async function openPuzzle(id) {
    if (busy) return;
    setBusy(true); setError(''); setMessage('');
    try {
      if (detail && source !== saved && source.trim()) await api(`/api/editor/${detail.id}/draft`, 'PUT', { source });
      const result = await api(`/api/editor/${id}`);
      setDetail(result); setSource(result.source); setSaved(result.source);
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  async function save() {
    if (!detail || busy) return;
    setBusy(true); setError('');
    try { await api(`/api/editor/${detail.id}/draft`, 'PUT', { source }); setSaved(source); setMessage('草稿已保存到 SQLite。'); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  async function submit() {
    if (!detail || busy) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const result = await api(`/api/editor/${detail.id}/submit`, 'POST', { source });
      setDetail(result); setSaved(source);
      setMessage(result.lastPassed ? (result.earnedXp ? `结构检查通过，获得 +${result.earnedXp} XP！` : '结构检查通过；该题 XP 已领取。') : '检查未全部通过，请根据反馈继续修改。');
      setCatalog(await api('/api/editor'));
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  return <main className="editor-page"><div className="editor-wrap">
    <header className="editor-header"><div><span>NOWEN QUEST · CODE WORKSHOP / V0.5</span><h1>代码工坊</h1><p>从选补丁升级为亲手改代码：修复、检查、复盘。训练结果不等于生产代码正确性。</p></div><strong>{catalog?.player?.xp ?? '—'} XP</strong></header>
    {error && <div className="editor-error" role="alert">{error}<button onClick={() => setError('')}>关闭</button></div>}
    {message && <div className="editor-message" role="status">{message}</div>}
    {!catalog ? <p role="status">正在加载代码工坊…</p> : !catalog.unlocked ? <section className="editor-locked"><span>🔒</span><h2>先完成「代码侦探」</h2><p>通关 JavaScript 森林第四关即可解锁代码编辑副本。你的原有闯关进度不会丢失。</p><button onClick={onPlay}>前往冒险闯关 →</button></section> : <div className="editor-layout">
      <aside className="editor-sidebar"><h2>修复清单</h2><p>{catalog.puzzles.filter(item => item.solved).length} / {catalog.puzzles.length} 项完成</p>{catalog.puzzles.map(item => <button key={item.id} className={detail?.id === item.id ? 'selected' : ''} disabled={busy} onClick={() => openPuzzle(item.id)}><span>{item.solved ? '✓' : '◇'}</span><strong>{item.title}</strong><small>{item.topic} · {item.xp} XP</small></button>)}<p className="editor-disclaimer">{catalog.notice}</p></aside>
      <section className="editor-workspace">
        {!detail ? <div className="editor-empty"><span>⌨️</span><h2>选择左侧题目开始修复</h2><p>你的代码与检查记录保存在本机 SQLite。提交不运行代码。</p></div> : <>
          <div className="editor-task"><span>{detail.solved ? '✓ 已完成' : '● 修复任务'}</span><h2>{detail.title}</h2><p>{detail.symptom}</p><h3>验收目标</h3><ul>{detail.goals.map(goal => <li key={goal}>{goal}</li>)}</ul></div>
          <div className="editor-code-head"><label htmlFor="editor-source">JavaScript · 代码编辑区</label><small>{source.length} / 4096 字符 · {source === saved ? '已保存' : '修改未保存'}</small></div>
          <textarea id="editor-source" className="editor-source" value={source} onChange={event => setSource(event.target.value)} disabled={busy} maxLength={4096} spellCheck={false} autoCapitalize="off" autoCorrect="off" aria-describedby="editor-limit" />
          <p id="editor-limit" className="editor-disclaimer">仅执行静态语法与 AST 结构检查；不执行 JavaScript，也不保证全部运行行为正确。</p>
          <div className="editor-actions"><button className="editor-save" onClick={save} disabled={busy || source === saved || !source.trim()}>保存草稿</button><button className="editor-submit" onClick={submit} disabled={busy || !source.trim() || source.length > 4096}>{busy ? '处理中…' : '提交结构检查 →'}</button></div>
          {detail.checks && <div className="editor-feedback" aria-live="polite"><h3>{detail.lastPassed ? '✓ 检查通过' : '检查反馈'}</h3>{detail.checks.map((check, i) => <div key={`${i}-${check.label}`} className={check.ok ? 'ok' : 'fail'}><span>{check.ok ? '✓' : '×'}</span><div><strong>{check.label}</strong>{check.detail && <p>{check.detail}</p>}</div></div>)}{!detail.lastPassed && <p className="editor-hint">提示：{detail.hint}</p>}{detail.lastPassed && <p className="editor-hint">已完成本题。建议仍在项目中补充真实运行测试和边界用例。</p>}</div>}
          <div className="editor-bottom"><span>已提交 {detail.submissions} 次</span><button onClick={onReview}>去记忆复习 ↗</button></div>
        </>}
      </section>
    </div>}
  </div></main>;
}

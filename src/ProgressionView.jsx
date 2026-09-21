import { useEffect, useState } from 'react';
import './progression.css';

const ACTIVE = 'nowen-active-code-run';
async function api(path, options) {
  const response = await fetch(path, { ...options, headers: { 'content-type': 'application/json', ...options?.headers } });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `请求失败 (${response.status})`);
  return data;
}
const post = (path, body = {}) => api(path, { method: 'POST', body: JSON.stringify(body) });
const tabs = [{ id: 'skills', title: '技能树' }, { id: 'story', title: '剧情日志' }, { id: 'achievements', title: '成就图鉴' }, { id: 'code', title: '代码修复副本' }];

export default function ProgressionView({ onPlay, onReview }) {
  const [tab, setTab] = useState('skills');
  const [data, setData] = useState(null);
  const [run, setRun] = useState(null);
  const [choice, setChoice] = useState(null);
  const [reasoning, setReasoning] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  async function refresh() { const next = await api('/api/progression'); setData(next); return next; }
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const next = await api('/api/progression');
        if (!live) return;
        setData(next);
        const id = localStorage.getItem(ACTIVE) || next.code.activeId;
        if (id) {
          try {
            const saved = await api(`/api/progression/code/${id}`);
            if (live && saved.status === 'active') { setRun(saved); localStorage.setItem(ACTIVE, saved.id); }
            else localStorage.removeItem(ACTIVE);
          } catch { localStorage.removeItem(ACTIVE); }
        }
      } catch (e) { if (live) setError(e.message); }
    })();
    return () => { live = false; };
  }, []);
  async function runAction(action) {
    if (busy) return;
    setBusy(true); setError(''); setMessage('');
    try { await action(); } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  function sync(next) {
    setRun(next); setChoice(null); setReasoning('');
    if (next.status === 'active') localStorage.setItem(ACTIVE, next.id);
    else localStorage.removeItem(ACTIVE);
  }
  const begin = () => runAction(async () => { sync(await post('/api/progression/code/start')); setTab('code'); });
  const submit = () => runAction(async () => {
    if (!run?.current || choice === null) return;
    const next = await post(`/api/progression/code/${run.id}/answer`, { puzzleId: run.current.id, choice, reasoning });
    sync(next);
    if (next.status !== 'active') await refresh();
  });
  const claim = id => runAction(async () => {
    const result = await post(`/api/progression/achievements/${id}/claim`);
    setMessage(result.earnedXp ? `成就已领取，获得 ${result.earnedXp} XP。` : '这项成就已经领取过。');
    await refresh();
  });
  const read = id => runAction(async () => {
    await post(`/api/progression/story/${id}/read`);
    await refresh();
  });
  const latest = run?.feedback.at(-1);
  return <main className="progression-page"><div className="progression-container">
    <header className="progression-header"><div><span className="progression-eyebrow">NOWEN QUEST · GROWTH / V0.4</span><h1>成长与挑战</h1><p>你的每一步修炼，都有实际记录。技能树是训练里程碑，而不是能力认证。</p></div><div className="progression-xp">✦ {data?.player?.xp ?? '—'} XP</div></header>
    {error && <div className="progression-alert" role="alert">{error}<button onClick={() => setError('')}>关闭</button></div>}
    {message && <div className="progression-success" role="status">{message}</div>}
    <nav className="progression-tabs" aria-label="成长模块">{tabs.map(item => <button key={item.id} aria-current={tab === item.id ? 'page' : undefined} className={tab === item.id ? 'selected' : ''} onClick={() => setTab(item.id)}>{item.title}</button>)}</nav>
    {!data ? <p role="status">正在读取成长记录…</p> : <>
      {tab === 'skills' && <><h2>技能树 · 训练里程碑</h2><p className="progression-muted">每个节点从真实通关、完整面试与跨天复习计算，不允许手动加点。</p><div className="progression-grid">{data.skills.map(skill => <article className={`progression-card ${skill.unlocked ? 'complete' : ''}`} key={skill.id}><span className="progression-icon">{skill.unlocked ? '✦' : '◇'}</span><div><strong>{skill.title}</strong><p>{skill.desc}</p><span>{skill.completed} / {skill.total} 项里程碑</span></div><div className="progression-meter"><i style={{ width: `${100 * skill.completed / skill.total}%` }} /></div><small>{skill.unlocked ? '✓ 已完成训练节点' : '继续冒险解锁'}</small></article>)}</div><div className="progression-actions"><button onClick={onPlay}>前往闯关 ↗</button><button onClick={onReview}>去记忆修炼 ↗</button></div></>}
      {tab === 'story' && <><h2>森林剧情日志</h2><p className="progression-muted">剧情随关卡真实推进解锁；阅读不影响 XP，也不妨碍自由复习。</p><div className="progression-story">{data.stories.map(story => <article key={story.id} className={`progression-card ${story.unlocked ? '' : 'locked'}`}><span className="progression-icon">{story.unlocked ? '📜' : '🔒'}</span><div><strong>{story.title}</strong>{story.unlocked ? <p>{story.text}</p> : <p>通关前置关卡后解锁这段剧情。</p>}{story.unlocked && <button disabled={busy || story.read} onClick={() => read(story.id)}>{story.read ? '✓ 已阅读' : '标记为已阅读'}</button>}</div></article>)}</div></>}
      {tab === 'achievements' && <><h2>成就图鉴</h2><p className="progression-muted">解锁条件在服务器核验；同一成就奖励只发放一次。</p><div className="progression-grid">{data.achievements.map(item => <article className={`progression-card ${item.unlocked ? 'complete' : 'locked'}`} key={item.id}><span className="progression-icon">{item.unlocked ? '🏅' : '🔒'}</span><div><strong>{item.title}</strong><p>{item.desc}</p><small>奖励 {item.xp} XP</small></div><button disabled={busy || !item.unlocked || item.claimed} onClick={() => claim(item.id)}>{item.claimed ? '✓ 已领取' : item.unlocked ? '领取奖励' : '尚未解锁'}</button></article>)}</div></>}
      {tab === 'code' && <><h2>故障修复副本</h2><p className="progression-muted">先读代码，再从三个补丁里挑选解决方案并记录思路。不会执行用户代码，解释不参与自动判分。</p>{!run ? <div className="progression-code-intro"><span>🛠️</span><h3>修复真实场景中的三个 BUG</h3><p>旧闭包、请求竞态、微任务饥饿。先通关 JavaScript 森林「代码侦探」才能解锁。</p><p>最佳战绩：{data.code.bestScore === null ? '暂无' : `${data.code.bestScore}/${data.code.total}`} · {data.code.cleared ? '已通关' : '尚未通关'}</p><button disabled={busy || !data.code.unlocked} onClick={begin}>{data.code.unlocked ? '进入修复副本 ↗' : '🔒 先通关「代码侦探」'}</button></div> : run.status === 'active' && run.current ? <div className="progression-code-battle"><div className="progression-battle-head">修复挑战 {run.answered + 1} / {run.total}<h3>{run.current.title}</h3><p>{run.current.symptom}</p></div><pre><code>{run.current.code}</code></pre><fieldset disabled={busy}><legend>选择最合理的修复补丁</legend>{run.current.options.map((option, index) => <label key={index} className={choice === index ? 'selected' : ''}><input type="radio" checked={choice === index} onChange={() => setChoice(index)} name="patch-choice" /> <span>{'ABC'[index]} · {option}</span></label>)}</fieldset><label htmlFor="progression-reasoning">为什么选择它？（可选，最多 2000 字）</label><textarea id="progression-reasoning" value={reasoning} maxLength={2000} disabled={busy} onChange={event => setReasoning(event.target.value)} placeholder="写下你对根因与修复边界的理解…" /><button disabled={busy || choice === null} onClick={submit}>锁定补丁 · 进入下一题 →</button>{latest && <div className={`progression-feedback ${latest.correct ? 'correct' : ''}`} role="status"><strong>{latest.correct ? '✓ 上题补丁正确' : '↗ 上题需要复习'}</strong><p>{latest.explanation}</p></div>}</div> : <div className="progression-code-result"><span>🏁</span><h3>{run.status === 'cleared' ? '修复副本通关' : '本轮已结束，继续巩固'}</h3><p>完成 {run.score}/{run.total} · 本轮获得 +{run.earnedXp} XP</p>{run.feedback.map(item => <div key={item.puzzleId}><strong>{item.title}：{item.correct ? '正确' : '待巩固'}</strong><p>参考补丁 {'ABC'[item.correctChoice]} · {item.explanation}</p>{item.reasoning && <small>你的思路：{item.reasoning}</small>}</div>)}<div className="progression-actions"><button disabled={busy} onClick={() => { setRun(null); refresh().catch(e => setError(e.message)); }}>返回副本首页</button><button onClick={onReview}>复习薄弱点</button></div></div>}</>}
    </>}
    <footer className="progression-footer">本地单人模式 · SQLite 持久化 · 不运行用户代码 · 不提供真实面试通过率</footer>
  </div></main>;
}

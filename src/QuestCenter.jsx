import { useEffect, useState } from 'react';
import './quest.css';

const ACTIVE_DEMON = 'nowen-active-demon';
async function api(path, options) {
  const response = await fetch(path, { ...options, headers: { 'content-type': 'application/json', ...options?.headers } });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `请求失败（${response.status}）`);
  return data;
}
const post = (path, data = {}) => api(path, { method: 'POST', body: JSON.stringify(data) });
const taskIcons = { stage: '🗺️', review: '🧠', interview: '⚔️', demon: '👹' };

export default function QuestCenter({ mode, onPlay, onReview, onInterview, onDemon }) {
  const [daily, setDaily] = useState(null);
  const [world, setWorld] = useState(null);
  const [demon, setDemon] = useState(null);
  const [answer, setAnswer] = useState('');
  const [covered, setCovered] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [reward, setReward] = useState('');

  async function refresh() {
    const [tasks, map] = await Promise.all([api('/api/quest/daily'), api('/api/game/world')]);
    setDaily(tasks); setWorld(map);
    return tasks;
  }
  useEffect(() => {
    let live = true;
    Promise.all([api('/api/quest/daily'), api('/api/game/world')]).then(async ([tasks, map]) => {
      if (!live) return;
      setDaily(tasks); setWorld(map);
      if (mode === 'demon') {
        const id = localStorage.getItem(ACTIVE_DEMON) || tasks.activeEncounterId;
        if (id) {
          try {
            const existing = await api(`/api/quest/demon/${id}`);
            if (live) { setDemon(existing); if (existing.status === 'active') localStorage.setItem(ACTIVE_DEMON, existing.id); else localStorage.removeItem(ACTIVE_DEMON); }
          } catch { localStorage.removeItem(ACTIVE_DEMON); }
        }
      }
    }).catch(e => { if (live) setError(e.message); });
    return () => { live = false; };
  }, [mode]);
  async function run(action) {
    if (busy) return;
    setBusy(true); setError('');
    try { await action(); } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  function syncDemon(next) {
    setDemon(next); setAnswer(next.current?.attempt?.answer || ''); setCovered(false);
    if (next.status === 'active') localStorage.setItem(ACTIVE_DEMON, next.id);
    else localStorage.removeItem(ACTIVE_DEMON);
  }
  const claim = taskId => run(async () => {
    const result = await post(`/api/quest/daily/${taskId}/claim`);
    setReward(result.earnedXp ? `领取成功，获得 ${result.earnedXp} XP。` : '这项任务的奖励已领取。');
    await refresh();
  });
  const beginDemon = () => run(async () => {
    const next = await post('/api/quest/demon/start');
    syncDemon(next); await refresh();
  });
  const ensureAttempt = () => run(async () => {
    if (!demon?.current) return;
    await post('/api/review/attempts', { knowledgeId: demon.current.id });
    syncDemon(await api(`/api/quest/demon/${demon.id}`));
  });
  const reveal = () => run(async () => {
    await post(`/api/review/attempts/${demon.current.attempt.id}/reveal`, { answer });
    syncDemon(await api(`/api/quest/demon/${demon.id}`));
  });
  const complete = rating => run(async () => {
    await post(`/api/review/attempts/${demon.current.attempt.id}/complete`, { covered, rating });
    syncDemon(await api(`/api/quest/demon/${demon.id}`));
    await refresh();
  });
  const advance = () => run(async () => {
    const next = await post(`/api/quest/demon/${demon.id}/advance`, { attemptId: demon.current.attempt.id });
    syncDemon(next); await refresh();
  });
  const continueStage = world?.stages.find(stage => stage.status === 'available') || world?.stages.at(-1);
  return <main className="quest-hub"><div className="quest-hub-inner">
    <header className="quest-hub-header"><div><span className="quest-hub-eyebrow">NOWEN CODE QUEST · V0.3</span><h1>{mode === 'daily' ? '今日修炼' : mode === 'demon' ? '心魔讨伐' : '修炼世界地图'}</h1><p>{mode === 'daily' ? '每天完成一小步。不打卡也不会掉级。' : mode === 'demon' ? '把薄弱知识变成可战胜的挑战。' : '从 JavaScript 森林启程，沿着技能之路成长。'}</p></div><div className="quest-hub-level"><span>✦ 修炼等级</span><strong>Lv.{world?.player.level ?? '—'}</strong><small>{world?.player.xp ?? '—'} XP</small></div></header>
    {error && <div className="quest-hub-alert" role="alert">⚠️ {error}<button onClick={() => setError('')}>关闭</button></div>}
    {!daily || !world ? <p className="quest-hub-loading">正在读取 SQLite 修炼存档…</p> : <>
      {mode === 'map' && <>
        <section className="quest-world-feature"><div><span className="quest-world-tag">WORLD 01 · 已开放</span><h2>JavaScript 森林</h2><p>作用域、闭包、异步与调试。完成五关后迎战事件循环守卫者。</p><div className="quest-world-progress"><span>关卡进度 {world.cleared}/{world.stages.length}</span><span>{Math.round(world.cleared / world.stages.length * 100)}%</span></div><div className="quest-hub-bar"><i style={{ width: `${world.cleared / world.stages.length * 100}%` }} /></div><button onClick={onPlay} className="quest-hub-primary">{world.cleared === world.stages.length ? '重返森林 ↗' : `继续冒险 · ${continueStage?.title || '第一关'} ↗`}</button></div><div className="quest-world-art" aria-hidden="true"><span>✦</span><div>🌲</div><small>THE FOREST OF JAVASCRIPT</small></div></section>
        <div className="quest-hub-zones"><div className="quest-hub-zone"><span>🏝️ WORLD 02</span><h3>框架群岛</h3><p>React、Vue 与组件工程</p><small>规划中 · 尚未开放</small></div><div className="quest-hub-zone"><span>🏙️ WORLD 03</span><h3>工程之城</h3><p>构建、性能、测试与架构</p><small>规划中 · 尚未开放</small></div></div>
        <div className="quest-hub-shortcuts"><button onClick={onDemon}><strong>👹 心魔图鉴</strong><span>当前 {daily.demons.length} 个到期薄弱知识 · 进入讨伐 ↗</span></button><button onClick={onReview}><strong>🧠 记忆修炼</strong><span>复习 {world.dueReviews} 个到期知识点 ↗</span></button><button onClick={onInterview}><strong>⚔️ 面试之塔</strong><span>用连续追问检验综合表达 ↗</span></button></div>
      </>}
      {mode === 'daily' && <section className="quest-daily"><div className="quest-daily-summary"><div><span>DAILY QUESTS · {daily.day} (UTC)</span><h2>已完成 {daily.completed} / {daily.tasks.length} 项</h2><p>任务由真实的闯关、复习和面试记录自动计算；奖励只能领取一次。</p></div><div className="quest-daily-ring">{daily.completed}<small>/ 4</small></div></div><div className="quest-daily-list">{daily.tasks.map(task => <div className="quest-daily-item" key={task.id}><span className="quest-daily-icon">{taskIcons[task.id]}</span><div className="quest-daily-copy"><strong>{task.title}</strong><p>{task.description}</p><small>{task.progress}/{task.goal} · 奖励 {task.xp} XP</small></div><button disabled={busy || task.claimed || !task.completed} onClick={() => claim(task.id)}>{task.claimed ? '✓ 已领取' : task.completed ? '领取奖励' : '待完成'}</button></div>)}</div>{reward && <p className="quest-hub-success" role="status">{reward}</p>}<div className="quest-daily-quick"><button onClick={onPlay}>🗺️ 去冒险</button><button onClick={onReview}>🧠 去复习</button><button onClick={onDemon}>👹 讨伐心魔</button><button onClick={onInterview}>⚔️ 去面试</button></div><p className="quest-hub-note">{daily.notice}</p></section>}
      {mode === 'demon' && <section className="quest-demon">
        {!demon ? <><div className="quest-demon-intro"><span>👹</span><h2>讨伐今日心魔</h2><p>从当前到期薄弱知识中选择最多 3 张卡，先独立回答，再揭晓参考内容并核对。全部核对通过才算净化成功。</p><button className="quest-hub-primary" disabled={busy || (!daily.demons.length && !daily.activeEncounterId)} onClick={beginDemon}>{busy ? '准备中…' : daily.activeEncounterId ? '继续未完成的挑战 ↗' : daily.demons.length ? '开始心魔讨伐 ↗' : '当前没有可讨伐的心魔'}</button></div><h3>心魔候选 · {daily.demons.length}</h3><div className="quest-demon-list">{daily.demons.length ? daily.demons.map(item => <div key={item.id}><strong>👁 {item.category}</strong><p>{item.prompt}</p><small>遗忘 {item.lapses} 次 · 到期 {item.due_on}</small></div>) : <p>目前没有到期薄弱点。先去冒险或面试，系统会将新的遗漏关联到记忆复习。</p>}</div></> : demon.status !== 'active' ? <div className="quest-demon-intro"><span>{demon.status === 'cleared' ? '🏆' : '🧭'}</span><h2>{demon.status === 'cleared' ? '心魔净化成功！' : '本次训练已完成'}</h2><p>核对通过 {demon.correctCount} / {demon.total}。{demon.status === 'cleared' ? '可以返回今日任务领取奖励，未来仍需按间隔继续巩固。' : '部分知识仍不牢固，复习引擎会保留后续计划，不会把它们视为掌握。'}</p><button className="quest-hub-primary" onClick={() => { setDemon(null); refresh().catch(e => setError(e.message)); }}>返回心魔图鉴</button></div> : <div className="quest-demon-fight"><div className="quest-demon-boss"><span>👹</span><div><small>DEMON BATTLE · {demon.cursor + 1}/{demon.total}</small><h2>记忆心魔</h2><p>当前通过 {demon.correctCount} 个 · 每张知识卡必须独立回答</p></div></div><div className="quest-demon-card"><span className="quest-hub-eyebrow">{demon.current?.category} · {demon.current?.source}</span><h3>{demon.current?.prompt}</h3>{!demon.current?.attempt ? <button className="quest-hub-primary" disabled={busy} onClick={ensureAttempt}>载入当前知识卡</button> : demon.current.attempt.phase === 'question' ? <><label htmlFor="quest-demon-answer">你的独立回答</label><textarea id="quest-demon-answer" value={answer} maxLength={4000} disabled={busy} placeholder="不查答案，用自己的语言回答；不知道可输入「不会」。" onChange={event => setAnswer(event.target.value)} /><button className="quest-hub-primary" disabled={busy || !answer.trim()} onClick={reveal}>锁定回答并揭晓 →</button></> : demon.current.attempt.phase === 'revealed' ? <><div className="quest-demon-original"><strong>你的原始回答</strong><p>{demon.current.attempt.answer}</p></div><div className="quest-demon-reference"><strong>参考内容（来源需自行核实）</strong><p>{demon.current.attempt.reference}</p></div><label className="quest-demon-check"><input type="checkbox" checked={covered} disabled={busy} onChange={event => setCovered(event.target.checked)} /> 我已核对事实，独立回答覆盖关键点</label><p className="quest-hub-note">未勾选或选择「忘记了」将计入本次未净化；自评并非 AI 语义判分。</p><div className="quest-demon-ratings">{[['forgot','忘记了'],['hard','困难'],['good','正常'],['easy','轻松']].map(([key,label]) => <button key={key} disabled={busy} onClick={() => complete(key)}>{label}</button>)}</div></> : <><div className="quest-hub-success" role="status">本张卡已完成自评，准备进入下一关。</div><button className="quest-hub-primary" disabled={busy} onClick={advance}>确认结算 · {demon.cursor + 1 === demon.total ? '查看结果' : '下一只心魔'} →</button></>}</div><p className="quest-hub-note">回答与复习日志直接写入现有 SQLite 记忆引擎，不会额外生成一套学习记录。</p></div>}
      </section>}
    </>}
  </div></main>;
}

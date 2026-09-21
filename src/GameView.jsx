import { useEffect, useState } from 'react';
import './game.css';

const KEY = 'nowen-active-game-attempt';
async function api(path, init) {
  const response = await fetch(path, { ...init, headers: { 'content-type': 'application/json', ...init?.headers } });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `请求失败（${response.status}）`);
  return data;
}
const iconFor = { quiz: '📘', recall: '🌀', predict: '⚡', debug: '🔍', boss: '👹' };
const stageType = { quiz: '知识探索', recall: '闭包试炼', predict: '代码推演', debug: '代码侦探', boss: '最终 BOSS' };
const stars = count => <span aria-label={`${count} 星`} className="quest-stars">{'★'.repeat(count)}<span>{'☆'.repeat(3-count)}</span></span>;
export default function GameView({ onOpenInterview, onOpenReview }) {
 const [world,setWorld]=useState(null),[battle,setBattle]=useState(null),[choice,setChoice]=useState(null);
 const [reasoning,setReasoning]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function reloadWorld(){setWorld(await api('/api/game/world'));}
 useEffect(()=>{let active=true;(async()=>{try{
   const loaded=await api('/api/game/world');if(!active)return;setWorld(loaded);
   const saved=localStorage.getItem(KEY);if(saved){try{
     const session=await api(`/api/game/attempts/${saved}`);
     if(active&&session.status==='active')setBattle(session);else localStorage.removeItem(KEY);
   }catch{localStorage.removeItem(KEY);}}
 }catch(e){if(active)setError(e.message);}})();return()=>{active=false;};},[]);
 async function act(fn){if(busy)return;setBusy(true);setError('');try{await fn();}catch(e){setError(e.message);}finally{setBusy(false);}}
 function synchronize(next){setBattle(next);setChoice(null);setReasoning('');if(next.status==='active')localStorage.setItem(KEY,next.id);else localStorage.removeItem(KEY);}
 function start(stage){act(async()=>synchronize(await api(`/api/game/stages/${stage.id}/start`,{method:'POST',body:'{}'})));}
 function submit(){if(choice===null||!battle?.current)return;act(async()=>{
   const next=await api(`/api/game/attempts/${battle.id}/answer`,{method:'POST',body:JSON.stringify({questionId:battle.current.id,choice,reasoning})});
   synchronize(next);if(next.status!=='active')await reloadWorld();
 });}
 function back(){setBattle(null);setChoice(null);reloadWorld().catch(e=>setError(e.message));}
 const next=world?.stages.find(item=>item.status==='available')??world?.stages.at(-1);
 const latest=battle?.feedback.at(-1);
 return <main className="quest-page"><div className="quest-container">
  <header className="quest-heading"><div><div className="quest-eyebrow">NOWEN · CODE QUEST / V0.2</div><h1>程序员修炼之路 <span>✦</span></h1><p>把知识化作冒险，把遗忘变成下一次挑战。</p></div>
    <div className="quest-character"><div className="quest-avatar">{'{ }'}</div><div><strong>修炼者 · Lv.{world?.player.level??'—'}</strong><small>累计经验 {world?.player.xp??'—'} XP</small></div></div>
  </header>
  {error&&<div className="quest-error" role="alert">{error}<button onClick={()=>setError('')} aria-label="关闭错误">×</button></div>}
  {!world&&<div className="quest-loading" role="status">正在载入修炼大陆… <button onClick={()=>act(reloadWorld)}>重试</button></div>}
  {world&&!battle&&<>
   <section className="quest-hero" aria-label="世界地图"><div className="quest-hero-copy"><span className="quest-pill">🌲 第一世界 · JavaScript 森林</span><h2>踏入异步迷雾，<br/>迎战事件循环守卫者。</h2><p>四段修炼、一次终局。先理解代码，再通过自己的判断走出森林。</p>
    <div className="quest-hero-actions"><button className="quest-primary" disabled={busy||!next} onClick={()=>next&&start(next)}>{busy?'进入中…':world.cleared===world.stages.length?'重返森林 ↗':'继续冒险 ↗'}</button><button className="quest-link-light" onClick={onOpenReview}>待复习 {world.dueReviews} 题 ↗</button></div>
   </div><div className="quest-scene" aria-hidden="true"><span className="quest-moon">✦</span><span className="quest-mountain one">▲</span><span className="quest-mountain two">▲</span><span className="quest-mountain three">▲</span><span className="quest-scene-label">JS FOREST · CHAPTER 01</span></div></section>
   <div className="quest-kpis"><div><span>世界进度</span><strong>{world.cleared}<small> / {world.stages.length} 关</small></strong></div><div><span>累计经验</span><strong>{world.player.xp}<small> XP</small></strong></div><div><span>今日到期</span><strong>{world.dueReviews}<small> 题</small></strong></div></div>
   <section className="quest-path" aria-label="章节关卡"><div className="quest-section-title"><div><span>WORLD 01 / STORYLINE</span><h2>森林冒险路线</h2></div><p>每关 3 道题 · 解锁下一关需至少答对 2 道</p></div>
     <div className="quest-stage-list">{world.stages.map((stage,index)=><button key={stage.id} className={`quest-stage ${stage.type==='boss'?'quest-boss':''} ${stage.status}`} disabled={busy||stage.status==='locked'} onClick={()=>start(stage)} aria-label={`${stage.title}，${stage.status==='locked'?'未解锁':stage.status==='cleared'?'已通关，可再次挑战':'可以挑战'}`}>
       <span className="quest-stage-icon">{stage.status==='locked'?'🔒':iconFor[stage.type]}</span><span className="quest-stage-copy"><small>{stage.type==='boss'?'FINAL CHALLENGE':`STAGE ${String(index+1).padStart(2,'0')} · ${stageType[stage.type]}`}</small><strong>{stage.title}</strong><em>{stage.subtitle}</em></span><span className="quest-stage-state">{stage.status==='cleared'?stars(stage.stars):<span>{stage.status==='locked'?'尚未解锁':'开始挑战 →'}</span>}</span>
     </button>)}</div>
   </section>
   <section className="quest-secondary"><div><span>🧠 心魔训练</span><h3>遗忘不是失败，是下一次修炼的线索。</h3><p>答错的知识自动进入现有记忆系统。满分通关并完成跨天复习，即可补全第三颗星。</p><button onClick={onOpenReview}>打开记忆中心 ↗</button></div><div><span>⚔️ 面试之塔</span><h3>离开地图，进行真正的文字面试。</h3><p>原有面试大厅和两轮追问均被保留；游戏选择题不等于真实面试能力评分。</p><button onClick={onOpenInterview}>进入模拟面试 ↗</button></div></section>
  </>}
  {world&&battle&&<>
   <div className="quest-battle-top"><button className="quest-back" onClick={back}>← 返回世界地图</button><span className="quest-pill-dark">{battle.stageId==='js-boss'?'👹 BOSS BATTLE':'⚔️ STAGE CHALLENGE'}</span></div>
   {battle.status==='active'&&battle.current?<section className="quest-fight">
     <div className="quest-fight-head"><span>第 {battle.answered+1} / {battle.total} 回合</span><h2>{battle.stageTitle}</h2><p>选择答案前请先独立判断。提交后本回合不可修改。</p><div className="quest-progress"><i style={{width:`${battle.answered/battle.total*100}%`}}/></div></div>
     <div className="quest-question"><div className="quest-question-tag">QUESTION {String(battle.answered+1).padStart(2,'0')}</div><h3>{battle.current.prompt}</h3>{battle.current.code&&<pre><code>{battle.current.code}</code></pre>}
      <div className="quest-options" role="radiogroup" aria-label="选择正确答案">{battle.current.options.map((option,index)=><button type="button" key={index} role="radio" aria-checked={choice===index} className={choice===index?'chosen':''} onClick={()=>setChoice(index)}><b>{'ABCD'[index]}</b><span>{option}</span><span className="quest-option-check">{choice===index?'✓':''}</span></button>)}</div>
      <label htmlFor="quest-reasoning">补充你的思路（选填，不参与自动判分）</label><textarea id="quest-reasoning" value={reasoning} maxLength={2000} onChange={e=>setReasoning(e.target.value)} placeholder="你为什么这样判断？先写下自己的解释，训练面试表达…"/>
      <div className="quest-actions"><small>当前是客观选项判分，不是 AI 语义评分</small><button className="quest-primary" disabled={busy||choice===null} onClick={submit}>{busy?'提交中…':'锁定答案 · 下一回合 →'}</button></div>
     </div>
     {latest&&<aside className={`quest-feedback ${latest.correct?'ok':'not-ok'}`} aria-live="polite"><strong>{latest.correct?'✓ 上一回合判断正确':'↗ 上一回合需要巩固'}</strong><p>{latest.explanation}</p>{!latest.correct&&<small>该知识已进入待复习队列（已有学习计划不会被覆盖）。</small>}</aside>}
    </section>:<section className="quest-result"><span className="quest-result-icon">{battle.status==='cleared'?'🏆':'🧭'}</span><div className="quest-eyebrow">CHALLENGE COMPLETE</div><h2>{battle.status==='cleared'?'关卡通关！':'再积累一点，就能破除迷雾'}</h2><div className="quest-result-stars">{stars(battle.stars)}</div><p>答对 {battle.correctCount} / {battle.total} 题 · 本次获得 +{battle.earnedXp} XP</p><p className="quest-result-hint">{battle.reviewHint}</p>
      <div className="quest-result-answers">{battle.feedback.map((item,index)=><div key={item.questionId}><strong>{index+1}. {item.correct?'✓ 正确':'× 待巩固'}</strong><p>你的选择：{'ABCD'[item.choice]} · 参考选项：{'ABCD'[item.correctChoice]}</p><small>{item.explanation}</small>{item.reasoning&&<p className="quest-own-reason">你的思路：{item.reasoning}</p>}</div>)}</div>
      <div className="quest-result-actions"><button className="quest-primary" onClick={back}>返回世界地图 ↗</button><button className="quest-secondary-button" disabled={busy} onClick={()=>start({id:battle.stageId})}>再次挑战</button><button className="quest-secondary-button" onClick={onOpenReview}>复习薄弱知识</button></div>
    </section>}
  </>}
  <footer className="quest-footer">本地单人体验 · SQLite 存档 · 星级仅代表游戏挑战表现，不代表真实面试通过率</footer>
 </div></main>;
}

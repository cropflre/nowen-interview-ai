import { useEffect, useState } from 'react';
import './game.css';
import './framework.css';

const KEY='nowen-framework-attempt';
async function api(path,options){const response=await fetch(path,{...options,headers:{'content-type':'application/json',...options?.headers}});const data=await response.json();if(!response.ok)throw new Error(data.error||`请求失败（${response.status}）`);return data;}
const post=(path,body={})=>api(path,{method:'POST',body:JSON.stringify(body)});
const star=count=>`${'★'.repeat(count)}${'☆'.repeat(3-count)}`;

export default function FrameworkView({onForest,onReview,onMap}){
 const [world,setWorld]=useState(null),[battle,setBattle]=useState(null),[choice,setChoice]=useState(null),[reasoning,setReasoning]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function refresh(){setWorld(await api('/api/framework/world'));}
 useEffect(()=>{let alive=true;(async()=>{try{
  const data=await api('/api/framework/world');if(!alive)return;setWorld(data);
  const id=localStorage.getItem(KEY);if(id){try{const saved=await api(`/api/framework/attempts/${id}`);if(alive&&saved.status==='active')setBattle(saved);else localStorage.removeItem(KEY);}catch{localStorage.removeItem(KEY);}}
 }catch(e){if(alive)setError(e.message);}})();return()=>{alive=false;};},[]);
 async function run(callback){if(busy)return;setBusy(true);setError('');try{await callback();}catch(e){setError(e.message);}finally{setBusy(false);}}
 function sync(next){setBattle(next);setChoice(null);setReasoning('');if(next.status==='active')localStorage.setItem(KEY,next.id);else localStorage.removeItem(KEY);}
 function start(stage){run(async()=>sync(await post(`/api/framework/stages/${stage.id}/start`)));}
 function answer(){if(choice===null||!battle?.current)return;run(async()=>{const next=await post(`/api/framework/attempts/${battle.id}/answer`,{questionId:battle.current.id,choice,reasoning});sync(next);if(next.status!=='active')await refresh();});}
 function back(){setBattle(null);setChoice(null);run(refresh);}
 const next=world?.stages.find(item=>item.status==='available')??world?.stages.at(-1);
 return <main className="quest-page framework-page"><div className="quest-container">
  <header className="quest-heading"><div><span className="quest-eyebrow">WORLD 02 · REACT ISLANDS · V0.7</span><h1>🏝️ 框架群岛</h1><p>把状态、Effect、列表身份与性能优化变成实战试炼。</p></div><div className="quest-character"><div className="quest-avatar">⚛</div><div><strong>React 修炼者</strong><small>累计经验 {world?.player.xp??'—'} XP</small></div></div></header>
  {error&&<div className="quest-error" role="alert">{error}<button aria-label="关闭错误" onClick={()=>setError('')}>×</button></div>}
  {!world&&<p role="status">正在读取群岛存档…</p>}
  {world&&!world.unlocked&&<section className="framework-lock"><h2>🔒 群岛航线尚未开放</h2><p>先击败 JavaScript 森林的事件循环守卫者，再解锁五个 React 关卡。已有森林进度不会被重置。</p><button className="quest-primary" onClick={onForest}>返回 JavaScript 森林 ↗</button></section>}
  {world&&world.unlocked&&!battle&&<>
   <section className="framework-banner"><span>第二世界 · 已开放</span><h2>五座岛屿，一场终局试炼</h2><p>每关三题，至少答对两题通关；前一关完成后解锁下一关。满分和跨天复习可分别获得表现星与记忆星。</p><strong>章节进度 {world.cleared} / {world.stages.length} · {world.player.xp} XP</strong><div className="framework-progress"><i style={{width:`${world.cleared/world.stages.length*100}%`}}/></div><button className="quest-primary" disabled={busy||!next} onClick={()=>next&&start(next)}>{world.cleared===5?'重返群岛 ↗':'继续冒险 ↗'}</button></section>
   <section className="quest-path"><div className="quest-section-title"><div><span>WORLD 02 / CHAPTER 01</span><h2>React 群岛航路</h2></div><p>5 个关卡 · 独立 SQLite 存档</p></div><div className="quest-stage-list">{world.stages.map((stage,index)=><button key={stage.id} className={`quest-stage ${stage.type==='boss'?'quest-boss':''} ${stage.status}`} disabled={busy||stage.status==='locked'} onClick={()=>start(stage)} aria-label={`${stage.title}，${stage.status==='locked'?'未解锁':stage.status==='cleared'?'已通关，可再次挑战':'可以挑战'}`}><span className="quest-stage-icon">{stage.status==='locked'?'🔒':stage.type==='boss'?'👹':'⚛️'}</span><span className="quest-stage-copy"><small>{stage.type==='boss'?'FINAL BOSS':`ISLAND ${String(index+1).padStart(2,'0')}`}</small><strong>{stage.title}</strong><em>{stage.subtitle}</em></span><span className="quest-stage-state">{stage.status==='cleared'?star(stage.stars):stage.status==='locked'?'尚未解锁':'开始挑战 →'}</span></button>)}</div></section>
   <div className="framework-links"><button onClick={onForest}>🌲 返回 JavaScript 森林</button><button onClick={onReview}>🧠 复习薄弱知识</button><button onClick={onMap}>🌍 世界地图</button></div>
  </>}
  {world&&battle&&<>
    <div className="quest-battle-top"><button className="quest-back" onClick={back}>← 返回框架群岛</button><span className="quest-pill-dark">{battle.stageId==='react-boss'?'👹 REACT BOSS':'⚛️ REACT CHALLENGE'}</span></div>
    {battle.status==='active'&&battle.current?<section className="quest-fight"><div className="quest-fight-head"><span>第 {battle.answered+1} / {battle.total} 回合</span><h2>{battle.stageTitle}</h2><p>独立作答；提交后本回合不可修改。</p><div className="quest-progress"><i style={{width:`${battle.answered/battle.total*100}%`}}/></div></div><div className="quest-question"><div className="quest-question-tag">REACT CHALLENGE</div><h3>{battle.current.prompt}</h3>{battle.current.code&&<pre><code>{battle.current.code}</code></pre>}<div className="quest-options" role="radiogroup" aria-label="选择正确答案">{battle.current.options.map((option,index)=><button key={index} type="button" role="radio" aria-checked={choice===index} className={choice===index?'chosen':''} onClick={()=>setChoice(index)}><b>{'ABCD'[index]}</b><span>{option}</span><span className="quest-option-check">{choice===index?'✓':''}</span></button>)}</div><label htmlFor="framework-reasoning">你的思路（选填，不参与判分）</label><textarea id="framework-reasoning" maxLength={2000} value={reasoning} onChange={e=>setReasoning(e.target.value)} placeholder="解释你为什么选择这个答案…"/><div className="quest-actions"><small>客观选项检查，不是 AI 语义评分</small><button className="quest-primary" disabled={busy||choice===null} onClick={answer}>锁定答案 · 下一回合 →</button></div></div>{battle.feedback.length>0&&<aside className="quest-feedback" aria-live="polite"><strong>{battle.feedback.at(-1).correct?'上一回合正确':'上一回合待巩固'}</strong><p>{battle.feedback.at(-1).explanation}</p></aside>}</section>:<section className="quest-result"><span className="quest-result-icon">{battle.status==='cleared'?'🏆':'🧭'}</span><h2>{battle.status==='cleared'?'群岛关卡通关！':'还需要再巩固一次'}</h2><div className="quest-result-stars">{star(battle.stars)}</div><p>答对 {battle.correctCount} / {battle.total} · 本次获得 +{battle.earnedXp} XP</p><div className="quest-result-answers">{battle.feedback.map((item,index)=><div key={item.questionId}><strong>{index+1}. {item.correct?'✓ 正确':'× 待巩固'}</strong><p>你的选择：{'ABCD'[item.choice]} · 参考：{'ABCD'[item.correctChoice]}</p><small>{item.explanation}</small></div>)}</div><div className="quest-result-actions"><button className="quest-primary" onClick={back}>返回群岛 ↗</button><button className="quest-secondary-button" disabled={busy} onClick={()=>start({id:battle.stageId})}>再次挑战</button><button className="quest-secondary-button" onClick={onReview}>记忆修炼</button></div></section>}
  </>}
  <footer className="quest-footer">React 群岛使用与森林相同的玩家 XP 和奖励账本 · 选项判分不等于面试能力认证</footer>
 </div></main>;
}

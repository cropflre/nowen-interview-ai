import { useState } from 'react';
import App from './App.jsx';
import ReviewCenter from './ReviewCenter.jsx';
import GameView from './GameView.jsx';
import './memory.css';
import './game.css';

export default function GameShell() {
  const [mode, setMode] = useState('game');
  return <>
    <nav className="quest-global-nav" aria-label="训练模式切换">
      <div className="quest-global-brand">✦ NOWEN <b>QUEST</b></div>
      <div className="quest-global-tabs">
        <button className={mode === 'game' ? 'active' : ''} onClick={() => setMode('game')} aria-pressed={mode === 'game'}>🗺 冒险闯关</button>
        <button className={mode === 'review' ? 'active' : ''} onClick={() => setMode('review')} aria-pressed={mode === 'review'}>🧠 记忆修炼</button>
        <button className={mode === 'interview' ? 'active' : ''} onClick={() => setMode('interview')} aria-pressed={mode === 'interview'}>⚔️ 模拟面试</button>
      </div>
    </nav>
    {mode === 'game' && <GameView onOpenInterview={() => setMode('interview')} onOpenReview={() => setMode('review')} />}
    {mode === 'review' && <main className="quest-review-shell"><button className="quest-back" onClick={() => setMode('game')}>← 返回冒险地图</button><ReviewCenter /></main>}
    {mode === 'interview' && <App />}
  </>;
}

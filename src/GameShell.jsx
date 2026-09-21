import { useState } from 'react';
import App from './App.jsx';
import ReviewCenter from './ReviewCenter.jsx';
import GameView from './GameView.jsx';
import FrameworkView from './FrameworkView.jsx';
import WorldMap from './WorldMap.jsx';
import QuestCenter from './QuestCenter.jsx';
import ProgressionView from './ProgressionView.jsx';
import EditorView from './EditorView.jsx';
import './memory.css';
import './game.css';
import './quest.css';
import './navigation.css';

export default function GameShell() {
  const [mode, setMode] = useState('map');
  return <>
    <nav className="quest-global-nav" aria-label="训练模式切换">
      <div className="quest-global-brand">✦ NOWEN <b>QUEST</b></div>
      <div className="quest-global-tabs">
        <button className={mode === 'map' ? 'active' : ''} onClick={() => setMode('map')} aria-pressed={mode === 'map'}>🌍 世界地图</button>
        <button className={mode === 'game' ? 'active' : ''} onClick={() => setMode('game')} aria-pressed={mode === 'game'}>🗺 冒险闯关</button>
        <button className={mode === 'framework' ? 'active' : ''} onClick={() => setMode('framework')} aria-pressed={mode === 'framework'}>🏝 框架群岛</button>
        <button className={mode === 'daily' ? 'active' : ''} onClick={() => setMode('daily')} aria-pressed={mode === 'daily'}>📜 每日修炼</button>
        <button className={mode === 'demon' ? 'active' : ''} onClick={() => setMode('demon')} aria-pressed={mode === 'demon'}>👹 心魔讨伐</button>
        <button className={mode === 'progression' ? 'active' : ''} onClick={() => setMode('progression')} aria-pressed={mode === 'progression'}>🌟 成长与挑战</button>
        <button className={mode === 'editor' ? 'active' : ''} onClick={() => setMode('editor')} aria-pressed={mode === 'editor'}>⌨️ 代码工坊</button>
        <button className={mode === 'review' ? 'active' : ''} onClick={() => setMode('review')} aria-pressed={mode === 'review'}>🧠 记忆修炼</button>
        <button className={mode === 'interview' ? 'active' : ''} onClick={() => setMode('interview')} aria-pressed={mode === 'interview'}>⚔️ 模拟面试</button>
      </div>
    </nav>
    {mode === 'map' && <WorldMap onForest={() => setMode('game')} onFramework={() => setMode('framework')} onDaily={() => setMode('daily')} onDemon={() => setMode('demon')} onReview={() => setMode('review')} onInterview={() => setMode('interview')} />}
    {['daily', 'demon'].includes(mode) && <QuestCenter mode={mode} onPlay={() => setMode('game')} onReview={() => setMode('review')} onInterview={() => setMode('interview')} onDemon={() => setMode('demon')} />}
    {mode === 'game' && <GameView onOpenInterview={() => setMode('interview')} onOpenReview={() => setMode('review')} />}
    {mode === 'framework' && <FrameworkView onForest={() => setMode('game')} onReview={() => setMode('review')} onMap={() => setMode('map')} />}
    {mode === 'progression' && <ProgressionView onPlay={() => setMode('game')} onReview={() => setMode('review')} />}
    {mode === 'editor' && <EditorView onPlay={() => setMode('game')} onReview={() => setMode('review')} />}
    {mode === 'review' && <main className="quest-review-shell"><button className="quest-back" onClick={() => setMode('map')}>← 返回世界地图</button><ReviewCenter /></main>}
    {mode === 'interview' && <App />}
  </>;
}

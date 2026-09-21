import { useEffect, useState } from 'react';
import GameShell from './GameShell.jsx';

async function request(path, options) {
  const response = await fetch(path, { credentials: 'same-origin', ...options, headers: { 'content-type': 'application/json', ...options?.headers } });
  const value = await response.json();
  if (!response.ok) throw new Error(value.error || `请求失败 ${response.status}`);
  return value;
}
export default function AccountGate() {
  const [auth, setAuth] = useState(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { let live = true; request('/api/auth/me').then(result => { if (live) setAuth(result); })
    .catch(e => { if (live) setError(e.message); }); return () => { live = false; }; }, []);
  async function submit(event) {
    event.preventDefault(); if (busy) return;
    setBusy(true); setError('');
    try {
      const setup = auth?.setupRequired;
      const result = await request(setup ? '/api/auth/setup' : '/api/auth/login', {
        method: 'POST', body: JSON.stringify({ username, password }),
      });
      setPassword(''); setAuth(result);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  async function logout() {
    setBusy(true); setError('');
    try {
      await request('/api/auth/logout', { method: 'POST', body: '{}' });
      for (const key of Object.keys(localStorage)) if (key.startsWith('nowen-')) localStorage.removeItem(key);
      setAuth({ mode: 'accounts', authenticated: false, setupRequired: false });
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  if (!auth) return <main style={{ maxWidth: 520, margin: '8vh auto', padding: 32 }} role="status">{error || '正在检查本地账户…'}</main>;
  if (auth.mode === 'local') return <GameShell />;
  if (!auth.authenticated) return <main style={{ maxWidth: 480, margin: '7vh auto', padding: 32, background: '#fff', borderRadius: 20, boxShadow: '0 16px 40px #0001' }}>
    <span style={{ color: '#0c766e', fontWeight: 800 }}>NOWEN · PRIVATE QUEST</span>
    <h1>{auth.setupRequired ? '创建首个本机账户' : '登录修炼档案'}</h1>
    <p>账户数据保存在独立 SQLite 文件中。此模式只允许本机访问，不提供公网账户服务。</p>
    {error && <p role="alert" style={{ color: '#aa2020' }}>{error}</p>}
    <form onSubmit={submit} style={{ display: 'grid', gap: 14 }}>
      <label>用户名<input required minLength={3} maxLength={32} pattern="[a-zA-Z0-9_-]{3,32}" autoComplete="username" value={username} onChange={e => setUsername(e.target.value)} style={{ display: 'block', width: '100%', padding: 12 }} /></label>
      <label>密码<input required type="password" minLength={auth.setupRequired ? 12 : undefined} autoComplete={auth.setupRequired ? 'new-password' : 'current-password'} value={password} onChange={e => setPassword(e.target.value)} style={{ display: 'block', width: '100%', padding: 12 }} /></label>
      {auth.setupRequired && <small>初始密码至少 12 位。旧本地存档不会自动迁入新账户，请先备份。</small>}
      <button disabled={busy} type="submit" className="quest-hub-primary">{busy ? '正在处理…' : auth.setupRequired ? '创建账户并进入' : '登录'}</button>
    </form>
  </main>;
  return <><div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 14, padding: '8px 20px', background: '#eaf7f2' }}>
    <span>👤 {auth.user?.username} · 独立存档</span><button type="button" disabled={busy} onClick={logout}>退出登录</button>
  </div><GameShell key={auth.user?.id} /></>;
}

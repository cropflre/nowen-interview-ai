/** 后端 API 客户端（闯关游戏）
 *  - 开发环境：直连本机 5181 后端
 *  - 生产环境（线上部署）：后端同端口托管前端产物 → 走同源相对路径
 */
const BASE = import.meta.env.PROD
  ? ''
  : (import.meta.env.VITE_API_BASE || 'http://localhost:5181')
const TKEY = 'jb_token'
const UKEY = 'jb_user'

export const API_BASE = BASE

export function saveAuth(token, name) {
  localStorage.setItem(TKEY, token)
  localStorage.setItem(UKEY, name)
}
export function getAuth() {
  return { token: localStorage.getItem(TKEY), name: localStorage.getItem(UKEY) }
}
export function clearAuth() {
  localStorage.removeItem(TKEY)
  localStorage.removeItem(UKEY)
}

async function req(path, opts = {}) {
  const { token } = getAuth()
  let res
  try {
    res = await fetch(BASE + path, {
      method: opts.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: 'Bearer ' + token } : {})
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined
    })
  } catch (e) {
    throw new Error('连不上后端（' + BASE + '），请确认已 npm run dev')
  }
  const json = await res.json().catch(() => ({ ok: false, error: '返回不是 JSON' }))
  if (!json.ok) throw new Error(json.error || ('HTTP ' + res.status))
  return json.data
}

export const api = {
  login: (name) => req('/api/auth/login', { method: 'POST', body: { name } }),
  me: () => req('/api/me'),
  map: () => req('/api/map'),
  level: (id) => req('/api/levels/' + id),
  submit: (id, payload) => req('/api/levels/' + id + '/attempts', { method: 'POST', body: payload }),
  nightmare: () => req('/api/nightmare'),
  nightmareSubmit: (payload) => req('/api/nightmare/attempts', { method: 'POST', body: payload }),
  daily: () => req('/api/daily'),
  leaderboard: (type = 'weekly') => req('/api/leaderboard?type=' + type),
  wrongbook: () => req('/api/wrongbook'),
  resolveWrong: (qid) => req('/api/wrongbook/' + qid + '/resolve', { method: 'POST' }),
  notifications: () => req('/api/notifications'),
  markRead: () => req('/api/notifications/read', { method: 'POST' }),
  lastBoard: () => req('/api/board/last'),
  scroll: () => req('/api/nightmare/scroll'),
  scrollSubmit: (payload) => req('/api/nightmare/scroll/attempts', { method: 'POST', body: payload }),
  stats: () => req('/api/stats'),
  reviewToday: () => req('/api/review/today'),
  reviewGrade: (qid, payload) => req('/api/review/' + qid + '/grade', { method: 'POST', body: payload }),
  reviewAnswer: (qid, payload) => req('/api/review/' + qid + '/answer', { method: 'POST', body: payload }),
  reviewStats: () => req('/api/review/stats'),
  // 白纸复现（无提示提取）
  recallQueue: () => req('/api/recall/queue'),
  recallSubmit: (qid, payload) => req('/api/recall/' + qid + '/submit', { method: 'POST', body: payload }),
  recallStats: () => req('/api/recall/stats'),
  // 讲得清（费曼关）
  explainQueue: () => req('/api/recall/explain/queue'),
  explainSubmit: (qid, payload) => req('/api/recall/' + qid + '/explain', { method: 'POST', body: payload }),
  // 用得上（场景题 / 项目深挖）
  sceneQueue: (kind) => req('/api/scene/queue' + (kind ? '?kind=' + encodeURIComponent(kind) : '')),
  sceneSubmit: (code, payload) => req('/api/scene/' + code + '/submit', { method: 'POST', body: payload }),
  // 打比方素材库
  metaphors: (q) => req('/api/metaphor' + (q ? '?q=' + encodeURIComponent(q) : '')),
  addMetaphor: (payload) => req('/api/metaphor', { method: 'POST', body: payload }),
  delMetaphor: (id) => req('/api/metaphor/' + id, { method: 'DELETE' }),
  // 面试就绪度报告
  readiness: () => req('/api/readiness'),
  // AI 模型设置
  aiConfig: () => req('/api/ai/config'),
  aiSave: (payload) => req('/api/ai/config', { method: 'POST', body: payload }),
  aiTest: (payload) => req('/api/ai/test', { method: 'POST', body: payload })
}

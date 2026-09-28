<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { api, getAuth, saveAuth, clearAuth, API_BASE } from '../api.js'
import MapView from './MapView.vue'
import QuizView from './QuizView.vue'
import ResultView from './ResultView.vue'
import CodeLevelView from './CodeLevelView.vue'
import FlashLevelView from './FlashLevelView.vue'
import LeaderboardView from './LeaderboardView.vue'
import WrongBookView from './WrongBookView.vue'
import StatsView from './StatsView.vue'
import ReviewView from './ReviewView.vue'
import RecallView from './RecallView.vue'
import ExplainView from './ExplainView.vue'
import SceneView from './SceneView.vue'
import MetaphorView from './MetaphorView.vue'
import ReadinessView from './ReadinessView.vue'
import AiSettingsModal from './AiSettingsModal.vue'

const props = defineProps({
  initialTab: { type: String, default: 'map' }   // 顶层「🔁 复习」入口直接落到复习页
})
import TypingDrill from '../components/TypingDrill.vue'
import { PROBLEMS } from '../data/problems.js'
import { isMuted, toggleMuted } from '../sound.js'

const loading = ref(true)
const error = ref('')
const toast = ref('')
const me = ref(null)
const map = ref(null)
const nightmare = ref(null)
const daily = ref(null)
const notif = ref(null)
const lastBoard = ref(null)
const showNotif = ref(false)
const muted = ref(isMuted())
const showAi = ref(false)

async function toggleNotif() {
  showNotif.value = !showNotif.value
  if (showNotif.value && notif.value && notif.value.unread > 0) {
    try {
      await api.markRead()
      notif.value = { ...notif.value, unread: 0, items: notif.value.items.map(i => ({ ...i, read: true })) }
      if (me.value) me.value = { ...me.value, unread: 0 }
    } catch (e) { /* 忽略 */ }
  }
}
function toggleMute() { muted.value = toggleMuted() }

const typingRef = ref(null)
const codeProblem = ref(null)

/* 地图区的三个子页：地图 / 周榜 / 错题本 */
const gameTab = ref('map')
const board = ref(null)
const wrong = ref(null)
const stats = ref(null)
const reviewDue = ref(0)
const reviewRef = ref(null)
const recallTodo = ref(0)
const explainTodo = ref(0)
const sceneTodo = ref(0)
const projectTodo = ref(0)

async function openTab(t) {
  gameTab.value = t
  try {
    if (t === 'board') board.value = await api.leaderboard('weekly')
    if (t === 'wrong') wrong.value = await api.wrongbook()
    if (t === 'stats') stats.value = await api.stats()
    if (t === 'review') reviewDue.value = (await api.reviewStats()).dueToday
    if (t === 'recall') recallTodo.value = (await api.recallQueue()).items.length
    if (t === 'explain') explainTodo.value = (await api.explainQueue()).items.length
    if (t === 'scene') {
      const q = await api.sceneQueue('general')
      sceneTodo.value = q.items.filter(i => !i.passed).length
    }
    if (t === 'project') {
      const q = await api.sceneQueue('project')
      projectTodo.value = q.items.filter(i => !i.passed).length
    }
  } catch (e) { flash(e.message) }
}

/** 复现关提交后同步 HUD 的 XP / 等级 */
async function onRecallRefresh() {
  try { me.value = await api.me() } catch (e) { /* 忽略 */ }
}

// 顶层「🔁 复习」按钮：已登录时切换子页
watch(() => props.initialTab, v => {
  if (v && v !== gameTab.value) openTab(v)
})

async function resolveWrong(qid) {
  busy.value = true
  try {
    await api.resolveWrong(qid)
    wrong.value = await api.wrongbook()
    await refreshAll()
    flash('已移出错题本 ✅')
  } catch (e) { flash(e.message) }
  finally { busy.value = false }
}

const view = ref('map')            // map | quiz | code | typing | result
const level = ref(null)            // 当前关卡（心魔时为 null）
const questions = ref([])
const lastResult = ref(null)
const isNightmare = ref(false)
const isScroll = ref(false)

/** 答题器标题（普通关 / 心魔 / 心魔卷 各不相同） */
const quizTitle = computed(() => {
  if (!level.value) return ''
  if (isNightmare.value) return '心魔试炼（错题 ' + questions.value.length + ' 题）'
  if (isScroll.value) {
    const b = level.value.best || { best_score: 0, attempts: 0 }
    return '⚔️ ' + level.value.title + ' · 历史最佳 ' + b.best_score + ' 分 / ' + b.attempts + ' 次'
  }
  return level.value.title
})
const busy = ref(false)
const quizKey = ref(0)   // 每次进入关卡 +1，强制重挂载答题器

const loggedIn = computed(() => !!me.value)
const nameInput = ref(getAuth().name || '')

function flash(msg) {
  toast.value = msg
  setTimeout(() => { toast.value = '' }, 2200)
}

async function refreshAll() {
  const [m, mp, nm, dl, nf, lb] = await Promise.all([
    api.me(), api.map(), api.nightmare(), api.daily(), api.notifications(), api.lastBoard()
  ])
  me.value = m
  map.value = mp
  nightmare.value = nm
  daily.value = dl
  notif.value = nf
  lastBoard.value = lb
}

async function boot() {
  loading.value = true
  error.value = ''
  try {
    if (getAuth().token) {
      await refreshAll()
      if (props.initialTab && props.initialTab !== 'map') await openTab(props.initialTab)
    }
  } catch (e) {
    error.value = e.message
    clearAuth()
  } finally {
    loading.value = false
  }
}

async function doLogin() {
  const name = nameInput.value.trim()
  if (!name) return flash('先起个名字吧')
  busy.value = true
  try {
    const r = await api.login(name)
    saveAuth(r.token, r.name)
    await refreshAll()
  } catch (e) {
    error.value = e.message
  } finally {
    busy.value = false
  }
}

function logout() {
  clearAuth()
  me.value = null
  map.value = null
  nightmare.value = null
  view.value = 'map'
}

/** 进入关卡：quiz/boss/recite 答题、code 手写、typing 默写 */
async function openLevel(lv) {
  if (!lv.unlocked) return flash('先通过上一关')
  const t = lv.type
  isNightmare.value = false

  if (t === 'code') {
    const p = PROBLEMS[lv.config && lv.config.problemIndex]
    if (!p) return flash('题目数据缺失')
    level.value = lv
    codeProblem.value = p
    quizKey.value++
    view.value = 'code'
    return
  }
  if (t === 'typing') {
    level.value = lv
    quizKey.value++
    view.value = 'typing'
    return
  }
  if (t === 'flash') {
    level.value = lv
    quizKey.value++
    view.value = 'flash'
    return
  }
  if (!['quiz', 'boss', 'recite'].includes(t)) {
    return flash('「' + t + '」玩法开发中，敬请期待')
  }

  busy.value = true
  try {
    const d = await api.level(lv.id)
    level.value = { ...lv, ...d }
    questions.value = d.questions || []
    if (!questions.value.length) return flash('这关没有题目')
    quizKey.value++
    view.value = 'quiz'
  } catch (e) {
    flash(e.message)
  } finally {
    busy.value = false
  }
}

/** 打字关交卷：只提交敲入的文本，判分在服务端 */
function submitTyping() {
  const ref = typingRef.value
  const typed = (ref && ref.getTyped && ref.getTyped()) || ''
  const s = (ref && ref.getStats && ref.getStats()) || { elapsed: 0 }
  onSubmit({ typed, durationMs: Math.round((s.elapsed || 0) * 1000) })
}

async function openNightmare() {
  busy.value = true
  try {
    const d = await api.nightmare()
    if (!d.ready) return flash('错题还不够，心魔还没成形')
    level.value = { id: 0, title: '心魔试炼', type: 'nightmare', timeLimitSec: 0 }
    questions.value = d.questions
    isNightmare.value = true
    isScroll.value = false
    quizKey.value++
    view.value = 'quiz'
  } catch (e) {
    flash(e.message)
  } finally {
    busy.value = false
  }
}

/** 专属心魔卷：固定题序、可反复挑战冲三星；三星自动移出错题本 */
async function openScroll() {
  busy.value = true
  try {
    const d = await api.scroll()
    if (!d.ready) return flash('错题不足 3 题，先去练习场补补')
    level.value = { id: 0, title: `专属心魔卷（${d.count} 题）`, type: 'scroll', timeLimitSec: 0 }
    level.value.best = d.best
    questions.value = d.questions
    isNightmare.value = false
    isScroll.value = true
    quizKey.value++
    view.value = 'quiz'
  } catch (e) {
    flash(e.message)
  } finally {
    busy.value = false
  }
}

async function onSubmit(payload) {
  busy.value = true
  try {
    let r
    if (isNightmare.value) {
      r = await api.nightmareSubmit({ answers: payload.answers })
    } else if (isScroll.value) {
      r = await api.scrollSubmit({ answers: payload.answers })
    } else {
      r = await api.submit(level.value.id, payload)
    }
    lastResult.value = r
    view.value = 'result'
    await refreshAll()   // 同步 XP / 解锁状态
  } catch (e) {
    flash(e.message)
  } finally {
    busy.value = false
  }
}

function backToMap() { view.value = 'map' }
function retry() {
  if (isNightmare.value) return openNightmare()
  if (isScroll.value) return openScroll()
  openLevel(level.value)
}
function nextLevel() {
  const ch = map.value.chapters.find(c => c.levels.some(l => l.id === level.value.id))
  const i = ch ? ch.levels.findIndex(l => l.id === level.value.id) : -1
  const nx = i >= 0 ? ch.levels[i + 1] : null
  if (nx && nx.unlocked) openLevel(nx)
  else { flash('下一关还没解锁，回地图看看'); backToMap() }
}

onMounted(boot)
</script>

<template>
  <div class="shell">
    <div v-if="toast" class="toast">{{ toast }}</div>

    <!-- 加载 / 报错 -->
    <div v-if="loading" class="center">加载中…</div>
    <div v-else-if="error && !loggedIn" class="center">
      <p class="err">{{ error }}</p>
      <button class="primary" @click="boot">重试</button>
      <p class="muted">后端地址：{{ API_BASE }}（需先运行 server: npm run dev）</p>
    </div>

    <!-- 登录 -->
    <div v-else-if="!loggedIn" class="login">
      <h2>🗺 前端修炼 · 闯关</h2>
      <p class="muted">输入一个昵称即可开始（demo 级登录，无需密码）</p>
      <div class="login-row">
        <input v-model="nameInput" placeholder="你的昵称" maxlength="20" @keyup.enter="doLogin" />
        <button class="primary" :disabled="busy" @click="doLogin">进入修炼</button>
      </div>
      <p class="muted">进度会保存在后端 SQLite，换浏览器用同一昵称即可续上</p>
    </div>

    <!-- 主界面 -->
    <template v-else>
      <header class="hud">
        <div class="hud-left">
          <span class="hud-name">🧑‍💻 {{ me.name }}</span>
          <span class="hud-lv">Lv.{{ me.level }}</span>
        </div>
        <div class="hud-xp">
          <span class="pbar"><i :style="{ width: Math.min(100, me.levelProgress.current / me.levelProgress.need * 100) + '%' }"></i></span>
          <span class="muted">{{ me.levelProgress.current }}/{{ me.levelProgress.need }} XP</span>
        </div>
        <div class="hud-right">
          <span title="总经验">⭐ {{ me.xp }}</span>
          <span title="金币">🪙 {{ me.coins }}</span>
          <span title="连续天数">🔥 {{ me.streakDays }}天</span>
          <span title="错题数">📕 {{ me.stats.wrongCount }}</span>
          <button class="ghost tiny" title="AI 设置（用于模拟面试等 AI 能力）" @click="showAi = true">⚙️</button>
          <button class="ghost tiny" :title="muted ? '音效已静音' : '音效开启'" @click="toggleMute">{{ muted ? '🔇' : '🔊' }}</button>
          <button class="ghost tiny bell" title="通知" @click="toggleNotif">
            🔔<span v-if="me.unread" class="badge-dot">{{ me.unread }}</span>
          </button>
          <button class="ghost tiny" @click="logout">退出</button>
        </div>
      </header>

      <!-- 通知面板 -->
      <div v-if="showNotif" class="notif-panel">
        <div class="notif-head">
          <span>🔔 通知</span>
          <button class="ghost tiny" @click="showNotif = false">收起</button>
        </div>
        <div v-if="!notif || !notif.items.length" class="muted" style="padding:6px 0">暂时没有新消息</div>
        <div
          v-for="n in (notif && notif.items) || []"
          :key="n.id"
          class="notif-item"
          :class="{ unread: !n.read }"
        >
          <div class="notif-title">{{ n.title }}</div>
          <div class="notif-body">{{ n.body }}</div>
          <div class="notif-time">{{ n.created_at }}</div>
        </div>
      </div>

      <template v-if="view === 'map'">
        <div class="subtabs">
          <button :class="{ active: gameTab === 'map' }" @click="openTab('map')">🗺 地图</button>
          <button :class="{ active: gameTab === 'board' }" @click="openTab('board')">🏆 周榜</button>
          <button :class="{ active: gameTab === 'wrong' }" @click="openTab('wrong')">
            📕 错题本<span v-if="me.stats.wrongCount"> ({{ me.stats.wrongCount }})</span>
          </button>
          <button :class="{ active: gameTab === 'stats' }" @click="openTab('stats')">📊 数据</button>
          <button :class="{ active: gameTab === 'review' }" @click="openTab('review')">
            🔁 复习<span v-if="reviewDue"> ({{ reviewDue }})</span>
          </button>
          <button :class="{ active: gameTab === 'recall' }" @click="openTab('recall')">
            📝 复现<span v-if="recallTodo"> ({{ recallTodo }})</span>
          </button>
          <button :class="{ active: gameTab === 'explain' }" @click="openTab('explain')">
            🗣 讲清<span v-if="explainTodo"> ({{ explainTodo }})</span>
          </button>
          <button :class="{ active: gameTab === 'scene' }" @click="openTab('scene')">
            🧩 场景<span v-if="sceneTodo"> ({{ sceneTodo }})</span>
          </button>
          <button :class="{ active: gameTab === 'project' }" @click="openTab('project')">
            💼 项目<span v-if="projectTodo"> ({{ projectTodo }})</span>
          </button>
          <button :class="{ active: gameTab === 'metaphor' }" @click="openTab('metaphor')">🎨 比喻库</button>
        </div>

        <MapView
          v-if="gameTab === 'map'"
          :map="map"
          :nightmare="nightmare"
          :daily="daily"
          :busy="busy"
          @pick="openLevel"
          @nightmare="openNightmare"
        />
        <LeaderboardView v-else-if="gameTab === 'board'" :data="board" :last="lastBoard" :busy="busy" />
        <WrongBookView v-else-if="gameTab === 'wrong'" :data="wrong" :busy="busy" @resolve="resolveWrong" @scroll="openScroll" />
        <template v-else-if="gameTab === 'stats'">
          <ReadinessView />
          <StatsView :data="stats" />
        </template>
        <ReviewView v-else-if="gameTab === 'review'" ref="reviewRef" @toast="flash" />
        <RecallView v-else-if="gameTab === 'recall'" @toast="flash" @refresh="onRecallRefresh" />
        <ExplainView v-else-if="gameTab === 'explain'" @toast="flash" @refresh="onRecallRefresh" />
        <SceneView v-else-if="gameTab === 'scene'" kind="general" @toast="flash" @refresh="onRecallRefresh" />
        <SceneView v-else-if="gameTab === 'project'" kind="project" @toast="flash" @refresh="onRecallRefresh" />
        <MetaphorView v-else-if="gameTab === 'metaphor'" @toast="flash" />
      </template>

      <div v-else-if="view === 'quiz'" :class="{ 'nm-theme': isNightmare || isScroll }">
        <QuizView
          :key="quizKey"
          :title="quizTitle"
          :questions="questions"
          :type="isNightmare ? 'nightmare' : level.type"
          :time-limit-sec="isNightmare ? 0 : (level.config && level.config.timeLimitSec || 0)"
          :busy="busy"
          @submit="onSubmit"
          @cancel="backToMap"
        />
        <p v-if="isNightmare" class="nm-tip">⚠️ 心魔试炼为一场 Boss 战：中途退出不保存进度，必须一口气打完。</p>
      </div>

      <CodeLevelView
        v-else-if="view === 'code'"
        :key="quizKey"
        :problem="codeProblem"
        :title="level.title"
        :busy="busy"
        @submit="onSubmit"
        @cancel="backToMap"
      />

      <div v-else-if="view === 'typing'">
        <div class="card">
          <h2 style="font-size:16px">⌨️ {{ level.title }}</h2>
          <p class="desc">照着目标敲完，点「交卷」按<b>准确率</b>计分（满分但用时不足 2 秒会被判异常）。</p>
          <div class="r-bar" style="justify-content:flex-start;margin:0">
            <button class="ghost" @click="backToMap">退出</button>
            <button class="primary" :disabled="busy" @click="submitTyping">{{ busy ? '结算中…' : '交卷' }}</button>
          </div>
        </div>
        <TypingDrill
          ref="typingRef"
          :key="quizKey"
          :title="level.title"
          :text="(level.config && level.config.text) || ''"
        />
      </div>

      <FlashLevelView
        v-else-if="view === 'flash'"
        :key="quizKey"
        :seconds="4"
        :count="(level.config && level.config.count) || 0"
        :busy="busy"
        @submit="onSubmit"
        @cancel="backToMap"
      />

      <ResultView
        v-else-if="view === 'result'"
        :result="lastResult"
        :title="isNightmare ? '心魔试炼' : level.title"
        :is-nightmare="isNightmare"
        @back="backToMap"
        @retry="retry"
        @next="nextLevel"
      />
    </template>
  </div>
  <AiSettingsModal v-if="showAi" @close="showAi = false" @saved="flash('AI 配置已保存 ✅')" @toast="flash" />
</template>

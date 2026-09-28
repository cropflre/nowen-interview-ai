<script setup>
/**
 * 🔁 复习（记忆引擎的提取练习）
 *
 * 方案主旨：**选择题只服务「首次学习」，到期复习一律走「无提示提取」通道。**
 *  - 到期题（due）：默认 **🧠 无提示** —— 只给题干，自己写出来，服务端按要点判分并推进档位；
 *  - 新学题（new）：保留 **👀 有选项** —— 第一次接触门槛要低，先认出来。
 * 想换回去也可以：顶部开关切到「有选项」。
 */
import { ref, computed, onMounted } from 'vue'
import { api } from '../api.js'
import { play } from '../sound.js'

const emit = defineEmits(['toast', 'refresh'])

const loading = ref(true)
const today = ref(null)
const stats = ref(null)

/* 流程：question → （揭晓/自评）→ done */
const phase = ref('question')
const qi = ref(0)
const picked = ref(null)
const graded = ref(null)
const lastNext = ref(null)
const records = ref([])

/* 无提示模式 */
const noHint = ref(localStorage.getItem('jb_review_hint') !== '0')   // 默认开
const text = ref('')
const recallResult = ref(null)
const startedAt = ref(0)

const queue = computed(() => (today.value ? today.value.items : []))
const cur = computed(() => queue.value[qi.value] || null)
const doneCount = computed(() => records.value.length)
const rightCount = computed(() => records.value.filter(r => r.correct).length)

/** 只有「到期」题才走无提示；新学题门槛要低，仍给选项 */
const useNoHint = computed(() => noHint.value && !!cur.value && cur.value.kind === 'due')

const RATINGS = [
  { k: 'forgot', label: '忘记了', hint: '回第 1 档，明天重来' },
  { k: 'hard', label: '很吃力', hint: '退一档，缩短间隔' },
  { k: 'good', label: '正常', hint: '进一档' },
  { k: 'easy', label: '轻松', hint: '进两档（需答对且覆盖要点）' }
]

function setNoHint(v) {
  noHint.value = v
  localStorage.setItem('jb_review_hint', v ? '1' : '0')
}

async function load() {
  loading.value = true
  try {
    const [t, s] = await Promise.all([api.reviewToday(), api.reviewStats()])
    today.value = t
    stats.value = s
    qi.value = 0
    picked.value = null
    graded.value = null
    text.value = ''
    recallResult.value = null
    records.value = []
    startedAt.value = Date.now()
    phase.value = queue.value.length ? 'question' : 'done'
  } catch (e) {
    emit('toast', e.message)
  } finally {
    loading.value = false
  }
}

/** 无提示：提交后由服务端判分 + 揭晓 + 推进档位 */
async function submitRecall() {
  if (!cur.value || recallResult.value) return
  const body = { text: text.value.trim(), durationMs: Date.now() - startedAt.value }
  if (!body.text) return emit('toast', '先写点什么——写「想不起来」也算一次诚实记录')
  try {
    const r = await api.recallSubmit(cur.value.id, body)
    recallResult.value = r
    lastNext.value = r.next
    records.value = [...records.value, { correct: r.pass, delayed: r.delayed, next: r.next }]
    if (r.pass) play('swoosh')
    else play('pop')
    emit('refresh')
  } catch (e) {
    emit('toast', e.message)
  }
}

/** 有选项：第一步只判分，不改状态 */
async function pick(i) {
  if (picked.value !== null) return
  picked.value = i
  play('pop')
  try {
    graded.value = await api.reviewGrade(cur.value.id, { choice: i })
  } catch (e) {
    emit('toast', e.message)
  }
}

/** 有选项：第二步自评 → 提交并调度下一次 */
async function rate(r) {
  try {
    const res = await api.reviewAnswer(cur.value.id, {
      choice: picked.value, selfRating: r, covered: r !== 'forgot'
    })
    lastNext.value = res.next
    records.value = [...records.value, { correct: res.correct, delayed: res.delayed, next: res.next }]
    await advance()
  } catch (e) {
    emit('toast', e.message)
  }
}

async function advance() {
  picked.value = null
  graded.value = null
  text.value = ''
  recallResult.value = null
  if (qi.value + 1 < queue.value.length) {
    qi.value++
    phase.value = 'question'
    startedAt.value = Date.now()
  } else {
    phase.value = 'done'
    try {
      stats.value = await api.reviewStats()
      today.value = await api.reviewToday()
    } catch (e) { /* 忽略 */ }
    emit('refresh')
  }
}

onMounted(load)
defineExpose({ load })
</script>

<template>
  <div v-if="loading" class="center">加载中…</div>
  <template v-else>
    <!-- 记忆看板 -->
    <div class="kpi" v-if="stats">
      <div>
        <b>{{ stats.delayedRate === null ? '—' : stats.delayedRate + '%' }}</b>
        <span>延迟复测正确率{{ stats.delayedSample ? '（' + stats.delayedSample + ' 次样本）' : '' }}</span>
      </div>
      <div><b>{{ stats.stable }}</b><span>稳定掌握</span></div>
      <div><b>{{ stats.dueToday }}</b><span>今日到期</span></div>
      <div><b :style="stats.overdue ? 'color:#e54545' : ''">{{ stats.overdue }}</b><span>已逾期</span></div>
      <div><b>{{ stats.forgotten7d }}</b><span>近 7 天遗忘</span></div>
    </div>

    <div class="card" v-if="stats">
      <h2 style="font-size:14px">掌握分布（共 {{ stats.total }} 个知识点）</h2>
      <div class="dist">
        <div v-for="d in stats.dist" :key="d.state" class="dist-row">
          <span class="dist-label">{{ d.text }}</span>
          <span class="dist-bar"><i :style="{ width: (stats.total ? Math.round(d.n / stats.total * 100) : 0) + '%' }"></i></span>
          <span class="dist-n">{{ d.n }} 个 · {{ stats.total ? Math.round(d.n / stats.total * 100) : 0 }}%</span>
        </div>
      </div>
    </div>

    <!-- 模式开关 -->
    <div class="card mode-card" v-if="phase !== 'done'">
      <div class="mode-row">
        <span class="mode-label">提取方式</span>
        <button class="mode-btn" :class="{ on: noHint }" @click="setNoHint(true)">
          🧠 无提示（推荐）
        </button>
        <button class="mode-btn" :class="{ on: !noHint }" @click="setNoHint(false)">
          👀 有选项
        </button>
      </div>
      <p class="muted" style="margin:6px 0 0">
        <template v-if="noHint">到期题只给题干、**不给选项**——自己写出来，写完才揭晓要点。新学题仍给选项（第一次接触门槛要低）。</template>
        <template v-else>已切回「有选项」模式（再认）。要真正记住，建议切回无提示。</template>
      </p>
    </div>

    <!-- 训练区 -->
    <div class="card review-card" v-if="phase === 'question' && cur">
      <div class="quiz-head">
        <div class="quiz-title">
          🔁 今日复习
          <span class="muted">（{{ qi + 1 }} / {{ queue.length }}）</span>
        </div>
        <div class="quiz-meta">
          <span class="tag" :class="cur.kind === 'new' ? 'gold' : ''">{{ cur.kind === 'new' ? '新学' : '到期' }}</span>
          <span class="muted">{{ cur.category }}</span>
          <span v-if="cur.lapses" class="bad" style="font-size:12px">遗忘 {{ cur.lapses }} 次</span>
        </div>
      </div>

      <!-- A. 无提示（到期题默认） -->
      <template v-if="useNoHint">
        <div class="recall-hint" v-if="!recallResult">
          🚫 <b>不给选项</b>——凭记忆把答案写出来。写得越具体，判分越准。
        </div>

        <div class="q-stem">{{ cur.stem }}</div>

        <template v-if="!recallResult">
          <textarea
            v-model="text"
            class="recall-input"
            rows="6"
            placeholder="凭记忆写出来……（想到多少写多少，别翻资料）"
            @keydown.ctrl.enter="submitRecall"
            @keydown.meta.enter="submitRecall"
          ></textarea>
          <div class="r-bar" style="justify-content:space-between">
            <span class="muted">{{ text.trim().length }} 字 · Ctrl/⌘ + Enter 提交</span>
            <button class="primary" @click="submitRecall">提交复现</button>
          </div>
        </template>

        <template v-else>
          <div class="score-line">
            <b :class="recallResult.pass ? 'ok' : 'no'">{{ recallResult.score }}</b>
            <span class="muted">/ 100（及格 {{ recallResult.passLine }}）· 命中 {{ recallResult.hits }}/{{ recallResult.total }} 个要点</span>
          </div>
          <ul class="point-list">
            <li v-for="(p, i) in recallResult.points" :key="i" :class="p.hit ? 'hit' : 'miss'">
              <span class="pt-mark">{{ p.hit ? '✅' : '❌' }}</span>
              <span class="pt-text">{{ p.text }}</span>
              <span class="pt-cov">{{ p.coverage }}%</span>
            </li>
          </ul>
          <details class="answer-box">
            <summary>对照参考答案</summary>
            <div class="answer-body" v-html="recallResult.answerHtml"></div>
          </details>
          <p class="muted" style="margin:10px 0 0">
            记忆引擎：{{ recallResult.next.stateText }} · {{ recallResult.next.intervalDays }} 天后（{{ recallResult.next.dueDate }}）再来一次
            <template v-if="recallResult.delayed"> · 本次属于<b>延迟复测</b></template>
          </p>
          <div class="r-bar" style="justify-content:flex-start">
            <button class="primary" @click="advance">
              {{ qi + 1 < queue.length ? '下一题' : '完成今日复习' }}
            </button>
          </div>
        </template>
      </template>

      <!-- B. 有选项（新学题 / 手动切换） -->
      <template v-else>
        <div class="recall-hint">🧠 <b>先自己回忆</b>——不要翻资料，凭记忆选一个；选完才揭晓。</div>

        <div class="q-stem">{{ cur.stem }}</div>
        <div class="opts">
          <button
            v-for="(o, i) in cur.options"
            :key="i"
            class="opt"
            :class="{
              picked: picked === i,
              right: graded && graded.answer === i,
              wrongPick: graded && picked === i && graded.answer !== i
            }"
            :disabled="picked !== null"
            @click="pick(i)"
          >
            <span class="opt-k">{{ String.fromCharCode(65 + i) }}</span>
            <span class="opt-v">{{ o }}</span>
          </button>
        </div>

        <div v-if="graded" class="recall-result" :class="graded.correct ? 'ok' : 'no'">
          {{ graded.correct ? '✅ 答对了' : '❌ 答错了' }} —— 先别急着走，选一个<b>「这次回忆的质量」</b>：
        </div>
        <div v-if="graded" class="rate-bar">
          <button v-for="r in RATINGS" :key="r.k" class="ghost" :title="r.hint" @click="rate(r.k)">
            {{ r.label }}
          </button>
        </div>
      </template>
    </div>

    <!-- 完成 -->
    <div class="card" v-if="phase === 'done'">
      <h2 style="font-size:16px">🎉 今日复习完成</h2>
      <div v-if="doneCount" class="r-line" style="justify-content:flex-start">
        <span>本次提取 <b>{{ doneCount }}</b> 题</span>
        <span>达标 <b>{{ rightCount }}</b> 题（{{ Math.round(rightCount / doneCount * 100) }}%）</span>
      </div>
      <p v-if="doneCount" class="muted">
        最后一题的安排：{{ lastNext.stateText }} · {{ lastNext.intervalDays }} 天后（{{ lastNext.dueDate }}）再来一次
      </p>
      <p v-if="!doneCount" class="muted">
        今天没有到期的知识点。想加速的话，去<b>闯关</b>或<b>练习场</b>学新内容——学过的题会自动进入明天的复习队列。
      </p>
      <div class="r-bar" style="justify-content:flex-start">
        <button class="ghost" @click="load">再查一次队列</button>
      </div>
    </div>
  </template>
</template>

<style scoped>
.mode-card { padding: 10px 12px; }
.mode-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.mode-label { font-size: 13px; opacity: 0.7; margin-right: 2px; }
.mode-btn {
  font-size: 13px;
  padding: 5px 12px;
  border-radius: 999px;
  border: 1px solid var(--bd, #d9d9d9);
  background: transparent;
  color: inherit;
  cursor: pointer;
}
.mode-btn.on {
  border-color: rgba(61, 126, 255, 0.5);
  background: rgba(61, 126, 255, 0.1);
  color: #2f6fe0;
}
.recall-input {
  width: 100%;
  box-sizing: border-box;
  margin: 10px 0 0;
  padding: 10px 12px;
  border: 1px solid var(--bd, #d9d9d9);
  border-radius: 8px;
  background: transparent;
  color: inherit;
  font: inherit;
  line-height: 1.6;
  resize: vertical;
}
.recall-input:focus { outline: none; border-color: #3d7eff; }
.score-line { display: flex; align-items: baseline; gap: 8px; margin: 8px 0 6px; flex-wrap: wrap; }
.score-line b { font-size: 28px; line-height: 1; }
.score-line .ok { color: #2e9e63; }
.score-line .no { color: #e54545; }
.point-list { list-style: none; margin: 0; padding: 0; }
.point-list li {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 6px 0;
  border-bottom: 1px dashed var(--bd, #e6e6e6);
  font-size: 13px;
}
.point-list li.miss .pt-text { color: #e54545; }
.point-list li.hit .pt-text { color: #2e9e63; }
.pt-mark { flex: 0 0 auto; }
.pt-text { flex: 1 1 auto; }
.pt-cov { flex: 0 0 auto; opacity: 0.55; font-size: 12px; }
.answer-box {
  margin-top: 12px;
  border: 1px solid var(--bd, #e6e6e6);
  border-radius: 8px;
  padding: 8px 10px;
}
.answer-box summary { cursor: pointer; font-size: 13px; }
.answer-body { margin-top: 8px; font-size: 13px; line-height: 1.75; }
</style>

<script setup>
/**
 * 📝 白纸复现关（无提示提取）
 *
 * 与「🔁 复习」的区别：
 *   复习 = 给题干 + 选项（再认，有提示）
 *   复现 = 只给题干，**不给选项、不给要点**，自己写出来（提取，无提示）
 *
 * 判分在服务端：把答案拆成若干「要点」，用中文 2-gram 覆盖率算命中。
 * 口径：命中要点 ≠ 答得正确；写不出来本身也是有效信号。
 */
import { ref, computed, onMounted } from 'vue'
import { api } from '../api.js'
import { play } from '../sound.js'

const emit = defineEmits(['toast', 'refresh'])

const loading = ref(true)
const queue = ref([])
const stats = ref(null)

const qi = ref(0)
const text = ref('')
const submitted = ref(null)
const startedAt = ref(0)
const records = ref([])

const cur = computed(() => queue.value[qi.value] || null)
const phase = computed(() => (!cur.value ? 'done' : (submitted.value ? 'result' : 'question')))
const doneCount = computed(() => records.value.length)
const passCount = computed(() => records.value.filter(r => r.pass).length)

const KIND_TEXT = { due: '到期', wrong: '错题', fresh: '新题' }

async function load() {
  loading.value = true
  try {
    const [q, s] = await Promise.all([api.recallQueue(), api.recallStats()])
    queue.value = q.items || []
    stats.value = s
    qi.value = 0
    text.value = ''
    submitted.value = null
    records.value = []
    startedAt.value = Date.now()
  } catch (e) {
    emit('toast', e.message)
  } finally {
    loading.value = false
  }
}

async function submit() {
  if (!cur.value || submitted.value) return
  const body = { text: text.value.trim(), durationMs: Date.now() - startedAt.value }
  if (!body.text) {
    return emit('toast', '先写点什么——写「想不起来」也算一次诚实记录')
  }
  try {
    const r = await api.recallSubmit(cur.value.id, body)
    submitted.value = r
    records.value = [...records.value, r]
    if (r.score >= 85) play('tada')
    else if (r.pass) play('swoosh')
    else play('pop')
    stats.value = await api.recallStats()
    emit('refresh')   // 让 HUD 的 XP / 等级同步
  } catch (e) {
    emit('toast', e.message)
  }
}

function next() {
  if (qi.value + 1 < queue.value.length) {
    qi.value++
    text.value = ''
    submitted.value = null
    startedAt.value = Date.now()
  } else {
    queue.value = []
  }
}

onMounted(load)
defineExpose({ load })
</script>

<template>
  <div v-if="loading" class="center">加载中…</div>
  <template v-else>
    <!-- 看板：北极星是「无提示复现率」 -->
    <div class="kpi" v-if="stats">
      <div>
        <b :style="stats.recallRate !== null && stats.recallRate < 60 ? 'color:#e54545' : ''">
          {{ stats.recallRate === null ? '—' : stats.recallRate + '%' }}
        </b>
        <span>无提示复现率</span>
      </div>
      <div><b>{{ stats.avgScore === null ? '—' : stats.avgScore }}</b><span>平均得分</span></div>
      <div><b>{{ stats.mastery.say }}</b><span>「说得出」题数</span></div>
      <div><b>{{ stats.mastery.known }}</b><span>「认得」题数</span></div>
      <div><b>{{ stats.attempts }}</b><span>累计复现</span></div>
    </div>

    <!-- 四档阶梯 -->
    <div class="card" v-if="stats">
      <h2 style="font-size:14px">掌握四档（共 {{ stats.mastery.total }} 个知识点）</h2>
      <div class="tier-row">
        <div class="tier on">
          <span class="tier-n">{{ stats.mastery.known }}</span>
          <span class="tier-t">1 认得<i>看到选项能认出来</i></span>
        </div>
        <div class="tier on">
          <span class="tier-n">{{ stats.mastery.say }}</span>
          <span class="tier-t">2 说得出<i>什么都不给也能写</i></span>
        </div>
        <div class="tier on">
          <span class="tier-n">{{ stats.mastery.tell }}</span>
          <span class="tier-t">3 讲得清<i>讲明白，会打比方</i></span>
        </div>
        <div class="tier on">
          <span class="tier-n">{{ stats.mastery.scene }}</span>
          <span class="tier-t">4 用得上<i>场景里选对方案</i></span>
        </div>
      </div>
      <p class="muted" style="margin:8px 0 0">
        只有跨过第 2 档才算「真的记住」——现在星级只认第 1 档。
      </p>
    </div>

    <!-- 复现区 -->
    <div class="card review-card" v-if="phase === 'question' && cur">
      <div class="quiz-head">
        <div class="quiz-title">
          📝 白纸复现
          <span class="muted">（{{ qi + 1 }} / {{ queue.length }}）</span>
        </div>
        <div class="quiz-meta">
          <span class="tag" :class="cur.kind === 'wrong' ? 'gold' : ''">{{ KIND_TEXT[cur.kind] || '' }}</span>
          <span class="muted">{{ cur.category }}</span>
          <span class="muted">要点 × {{ cur.pointCount }}</span>
        </div>
      </div>

      <div class="recall-hint">
        🚫 <b>不给选项、不给要点</b>——凭记忆把答案写出来。写不完整也要提交，卡住的地方才是你真正没懂的地方。
      </div>

      <div class="q-stem">{{ cur.stem }}</div>

      <textarea
        v-model="text"
        class="recall-input"
        rows="7"
        placeholder="凭记忆写出来……（想到多少写多少，别翻资料）"
        @keydown.ctrl.enter="submit"
        @keydown.meta.enter="submit"
      ></textarea>

      <div class="r-bar" style="justify-content:space-between">
        <span class="muted">{{ text.trim().length }} 字 · Ctrl/⌘ + Enter 提交</span>
        <span>
          <button class="ghost" @click="next">跳过这题</button>
          <button class="primary" @click="submit">提交复现</button>
        </span>
      </div>
    </div>

    <!-- 揭晓 -->
    <div class="card review-card" v-if="phase === 'result' && submitted">
      <div class="quiz-head">
        <div class="quiz-title">
          {{ submitted.pass ? '✅ 复现通过' : '❌ 还没记住' }}
          <span class="muted">（{{ qi + 1 }} / {{ queue.length }}）</span>
        </div>
        <div class="quiz-meta">
          <span class="muted">命中 {{ submitted.hits }} / {{ submitted.total }} 个要点</span>
          <span v-if="submitted.gainedXp" class="tag gold">+{{ submitted.gainedXp }} XP</span>
        </div>
      </div>

      <div class="score-line">
        <b :class="submitted.pass ? 'ok' : 'no'">{{ submitted.score }}</b>
        <span class="muted">/ 100（及格线 {{ submitted.passLine }}）</span>
      </div>

      <h3 class="mini-h">要点命中</h3>
      <ul class="point-list">
        <li v-for="(p, i) in submitted.points" :key="i" :class="p.hit ? 'hit' : 'miss'">
          <span class="pt-mark">{{ p.hit ? '✅' : '❌' }}</span>
          <span class="pt-text">{{ p.text }}</span>
          <span class="pt-cov">{{ p.coverage }}%</span>
        </li>
      </ul>

      <details class="answer-box">
        <summary>对照参考答案（{{ submitted.category }}）</summary>
        <div class="answer-body" v-html="submitted.answerHtml"></div>
      </details>

      <p class="muted" style="margin:10px 0 0">
        记忆引擎：{{ submitted.next.stateText }} · {{ submitted.next.intervalDays }} 天后（{{ submitted.next.dueDate }}）再来一次
        <template v-if="submitted.delayed"> · 本次属于<b>延迟复测</b>（已隔 ≥1 天）</template>
      </p>

      <div class="r-bar" style="justify-content:flex-start">
        <button class="primary" @click="next">
          {{ qi + 1 < queue.length ? '下一题' : '完成本轮' }}
        </button>
      </div>
    </div>

    <!-- 完成 -->
    <div class="card" v-if="phase === 'done'">
      <h2 style="font-size:16px">🎉 本轮复现结束</h2>
      <div v-if="doneCount" class="r-line" style="justify-content:flex-start">
        <span>复现 <b>{{ doneCount }}</b> 题</span>
        <span>达标 <b>{{ passCount }}</b> 题（{{ Math.round(passCount / doneCount * 100) }}%）</span>
      </div>
      <p v-if="doneCount" class="muted">
        达标 = 什么都不给也能写出来。没达标的题已回第 1 档，明天会再来找你。
      </p>
      <p v-if="!doneCount" class="muted">
        当前没有待复现的题。去<b>闯关</b>学新内容，学过的题会自动进入明天的复现队列。
      </p>
      <div class="r-bar" style="justify-content:flex-start">
        <button class="ghost" @click="load">再查一次队列</button>
      </div>
    </div>
  </template>
</template>

<style scoped>
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
.recall-input:focus {
  outline: none;
  border-color: #3d7eff;
}
.score-line {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin: 6px 0 4px;
}
.score-line b {
  font-size: 30px;
  line-height: 1;
}
.score-line .ok { color: #2e9e63; }
.score-line .no { color: #e54545; }
.mini-h {
  font-size: 13px;
  margin: 14px 0 6px;
  font-weight: 500;
}
.point-list {
  list-style: none;
  margin: 0;
  padding: 0;
}
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
.pt-cov {
  flex: 0 0 auto;
  opacity: 0.55;
  font-size: 12px;
}
.answer-box {
  margin-top: 14px;
  border: 1px solid var(--bd, #e6e6e6);
  border-radius: 8px;
  padding: 8px 10px;
}
.answer-box summary {
  cursor: pointer;
  font-size: 13px;
}
.answer-body {
  margin-top: 8px;
  font-size: 13px;
  line-height: 1.75;
}
/* 四档阶梯 */
.tier-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 8px;
}
.tier {
  flex: 1 1 0;
  min-width: 120px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid var(--bd, #e6e6e6);
}
.tier.on { background: rgba(46, 158, 99, 0.10); border-color: rgba(46, 158, 99, 0.35); }
.tier.off { opacity: 0.5; }
.tier-n {
  font-size: 20px;
  font-weight: 500;
  min-width: 28px;
  text-align: center;
}
.tier-t {
  display: flex;
  flex-direction: column;
  font-size: 13px;
}
.tier-t i {
  font-style: normal;
  font-size: 11px;
  opacity: 0.6;
}
</style>

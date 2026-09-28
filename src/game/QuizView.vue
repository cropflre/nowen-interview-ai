<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { play } from '../sound.js'

const props = defineProps({
  title: { type: String, required: true },
  questions: { type: Array, required: true },
  type: { type: String, default: 'quiz' },     // quiz | boss | recite | nightmare
  timeLimitSec: { type: Number, default: 0 },
  busy: { type: Boolean, default: false }
})
const emit = defineEmits(['submit', 'cancel'])

const idx = ref(0)
const answers = ref({})        // qid -> choice
const startTs = Date.now()
const elapsed = ref(0)
let timer = null

onMounted(() => { timer = setInterval(() => { elapsed.value = Math.floor((Date.now() - startTs) / 1000) }, 500) })
onUnmounted(() => clearInterval(timer))

const q = computed(() => props.questions[idx.value] || {})
const answeredCount = computed(() => Object.keys(answers.value).length)
const total = computed(() => props.questions.length)
const allAnswered = computed(() => answeredCount.value === total.value)
const remain = computed(() => props.timeLimitSec ? Math.max(0, props.timeLimitSec - elapsed.value) : 0)

const isRecite = computed(() => props.type === 'recite')

function pick(choice) {
  play('pop')                                   // 轻点反馈（判分在服务端，选完才知对错，这里做即时手感）
  answers.value = { ...answers.value, [q.value.id]: choice }
  // 选择题自动跳到下一题（BOSS/心魔不跳，慢一点想）
  if (!isRecite.value && props.type !== 'boss' && props.type !== 'nightmare' && idx.value < total.value - 1) {
    setTimeout(() => { if (answers.value[q.value.id] !== undefined) idx.value++ }, 220)
  }
}
function go(d) {
  const n = idx.value + d
  if (n >= 0 && n < total.value) idx.value = n
}
function submit(force) {
  const list = props.questions
    .filter(qq => answers.value[qq.id] !== undefined)
    .map(qq => ({ qId: qq.id, choice: answers.value[qq.id] }))
  if (!force && !allAnswered.value) {
    if (!confirm(`还有 ${total.value - answeredCount.value} 题没答，确定交卷吗？（未作答按错处理）`)) return
  }
  emit('submit', { answers: list, durationMs: Date.now() - startTs })
}
const fmt = s => String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0')
</script>

<template>
  <div class="quiz">
    <div class="quiz-head">
      <div class="quiz-title">{{ title }}</div>
      <div class="quiz-meta">
        <span v-if="timeLimitSec" class="timer" :class="{ danger: remain <= 30 }">
          ⏳ {{ fmt(remain) }}
        </span>
        <span v-else class="timer">⏱ {{ fmt(elapsed) }}</span>
        <span class="count">{{ idx + 1 }} / {{ total }}</span>
      </div>
    </div>

    <div class="progress"><i :style="{ width: (answeredCount / total * 100) + '%' }"></i></div>

    <div class="q-stem">
      <span class="q-star">{{ '⭐'.repeat(q.star || 0) }}</span>
      {{ q.stem }}
    </div>

    <!-- 选择题 -->
    <div v-if="!isRecite" class="opts">
      <button
        v-for="(opt, i) in q.options"
        :key="i"
        class="opt"
        :class="{ picked: answers[q.id] === i }"
        @click="pick(i)"
      >
        <span class="opt-k">{{ String.fromCharCode(65 + i) }}</span>
        <span class="opt-v">{{ opt }}</span>
      </button>
    </div>

    <!-- 背诵自评 -->
    <div v-else class="opts">
      <button class="opt" :class="{ picked: answers[q.id] === 1 }" @click="pick(1)">
        <span class="opt-k">✅</span><span class="opt-v">我会（能讲清楚）</span>
      </button>
      <button class="opt" :class="{ picked: answers[q.id] === 0 }" @click="pick(0)">
        <span class="opt-k">❌</span><span class="opt-v">我卡了（记不住）</span>
      </button>
    </div>

    <div class="quiz-bar">
      <button class="ghost" :disabled="idx === 0" @click="go(-1)">← 上一题</button>
      <button class="ghost" :disabled="idx >= total - 1" @click="go(1)">下一题 →</button>
      <button class="ghost" @click="emit('cancel')">退出</button>
      <button class="primary" :disabled="busy" @click="submit(false)">
        {{ busy ? '结算中…' : '交卷' }}
      </button>
    </div>
  </div>
</template>

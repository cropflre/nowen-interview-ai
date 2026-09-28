<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { FLASHCARDS } from '../data/flashcards.js'
import { play } from '../sound.js'

const props = defineProps({
  seconds: { type: Number, default: 4 },     // 每题倒计时（超时判错）
  count: { type: Number, default: 0 },       // 0 = 全部
  busy: { type: Boolean, default: false }
})
const emit = defineEmits(['submit', 'cancel'])

const cards = computed(() => props.count > 0 ? FLASHCARDS.slice(0, props.count) : FLASHCARDS)
const idx = ref(0)
const marks = ref([])          // 1 = 会，0 = 不会/超时
const remain = ref(props.seconds)
const startedAt = Date.now()
let timer = null

const cur = computed(() => cards.value[idx.value] || {})
const done = computed(() => marks.value.length)
const passed = computed(() => marks.value.filter(x => x === 1).length)

function tick() {
  remain.value = Math.max(0, remain.value - 0.1)
  if (remain.value <= 0) answer(0)     // 超时 → 判错
}
onMounted(() => { timer = setInterval(tick, 100) })
onUnmounted(() => clearInterval(timer))

function answer(v) {
  marks.value = [...marks.value, v]
  if (v === 1) play('pop')
  if (idx.value >= cards.value.length - 1) return finish()
  idx.value++
  remain.value = props.seconds
}

function finish() {
  clearInterval(timer)
  const total = cards.value.length
  const score = Math.round(passed.value / total * 100)
  emit('submit', { score, accuracy: score, durationMs: Date.now() - startedAt })
}

const fmt = s => s.toFixed(1) + 's'
</script>

<template>
  <div class="card flash-lv">
    <div class="quiz-head">
      <div class="quiz-title">🎴 闪卡速答（每题 {{ seconds }}s，超时判错）</div>
      <div class="quiz-meta">
        <span class="timer" :class="{ danger: remain <= 1.2 }">⏳ {{ fmt(remain) }}</span>
        <span class="count">{{ idx + 1 }} / {{ cards.length }}</span>
      </div>
    </div>

    <div class="progress"><i :style="{ width: (done / cards.length * 100) + '%' }"></i></div>

    <div class="flash-q">{{ cur.q }}</div>
    <div v-if="marks.length > idx" class="flash-a">{{ cur.a }}</div>

    <div class="opts">
      <button class="opt" @click="answer(1)">
        <span class="opt-k">✅</span><span class="opt-v">我会（讲得清楚）</span>
      </button>
      <button class="opt" @click="answer(0)">
        <span class="opt-k">❌</span><span class="opt-v">不会 / 卡住了</span>
      </button>
    </div>

    <div class="r-bar" style="justify-content:flex-start">
      <button class="ghost" @click="emit('cancel')">退出</button>
      <span class="muted">已答 {{ done }} · 会 {{ passed }}</span>
      <span class="muted" style="margin-left:auto">⚖️ 闪卡关卡 XP 有衰减（防套利）</span>
    </div>
  </div>
</template>

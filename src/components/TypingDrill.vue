<script setup>
import { ref, computed, watch, onUnmounted } from 'vue'

const props = defineProps({
  title: { type: String, default: '' },
  text: { type: String, default: '' },
  defaultHint: { type: Boolean, default: true }
})

const typed = ref('')
const judged = ref('')       // 实际参与判分的文本（中文输入法组合中不更新）
const composing = ref(false)
const hintOn = ref(props.defaultHint)
const elapsed = ref(0)
let timer = null
let t0 = 0

watch(() => props.text, reset)
watch(() => props.defaultHint, v => { hintOn.value = v })

const mirror = computed(() => {
  const t = props.text
  const j = judged.value
  let html = ''
  for (let i = 0; i < t.length; i++) {
    const c = esc(t[i])
    if (i < j.length) {
      html += (j[i] === t[i]) ? '<span class="ok">' + c + '</span>' : '<span class="bad">' + c + '</span>'
    } else if (hintOn.value) {
      html += '<span class="ghost">' + c + '</span>'
    }
  }
  return html
})

const stats = computed(() => {
  const t = props.text
  const j = judged.value
  const total = t.length
  const done = Math.min(j.length, total)
  let ok = 0, streak = 0, best = 0
  for (let i = 0; i < done; i++) {
    if (j[i] === t[i]) { ok++; streak++; if (streak > best) best = streak }
    else streak = 0
  }
  return { done, total, acc: done ? Math.round(ok / done * 100) : 100, best }
})

function esc(c) {
  return c.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function startTimer() {
  if (timer) return
  t0 = Date.now()
  timer = setInterval(() => { elapsed.value = (Date.now() - t0) / 1000 }, 100)
}

function reset() {
  typed.value = ''
  judged.value = ''
  clearInterval(timer)
  timer = null
  t0 = 0
  elapsed.value = 0
}

/** 普通输入：更新判分文本；中文输入法组合中先不判分 */
function onInput(e) {
  typed.value = e.target.value
  startTimer()
  if (!composing.value) judged.value = e.target.value
}
function onCompositionStart() { composing.value = true }
function onCompositionEnd(e) {
  composing.value = false
  typed.value = e.target.value
  judged.value = e.target.value
}

onUnmounted(() => clearInterval(timer))

/** 供"关卡模式"读取成绩 */
function getStats() {
  return { done: stats.value.done, total: stats.value.total, acc: stats.value.acc, elapsed: elapsed.value }
}
/** 供关卡模式提交原始输入（判分在服务端） */
function getTyped() { return typed.value }
defineExpose({ getStats, getTyped, reset })
</script>

<template>
  <div class="card">
    <h2 style="font-size:15px">⌨️ 打字默写<span v-if="title">：{{ title }}</span></h2>
    <p class="desc">
      上面是<b>提词框</b>：打对的变绿、打错的变红、没打的是灰色提示。下面是<b>输入框</b>，照着敲。
      <b>中文输入法打字时不会误判</b>（拼音上屏过程中不判分）。想凭记忆盲打就点「提词：关」。
    </p>

    <div class="bar">
      <button class="ghost" @click="hintOn = !hintOn">提词：{{ hintOn ? '开' : '关' }}</button>
      <button class="ghost" @click="reset">重新开始</button>
    </div>

    <template v-if="hintOn">
      <div class="typing-label">↑ 提词框（逐字提示）</div>
      <div class="typing-ref" v-html="mirror"></div>
    </template>

    <div class="typing-label">↓ 输入框（在这里敲）</div>
    <textarea
      class="typing-input"
      spellcheck="false"
      autocomplete="off"
      autocorrect="off"
      autocapitalize="off"
      placeholder="在这里照着敲…"
      :value="typed"
      @input="onInput"
      @compositionstart="onCompositionStart"
      @compositionend="onCompositionEnd"
    ></textarea>

    <div class="stats">
      <span>进度 <b>{{ stats.done }} / {{ stats.total }}</b></span>
      <span>准确率 <b>{{ stats.acc }}%</b></span>
      <span>用时 <b>{{ elapsed.toFixed(1) }}s</b></span>
      <span>最长连续正确 <b>{{ stats.best }}</b></span>
    </div>
  </div>
</template>

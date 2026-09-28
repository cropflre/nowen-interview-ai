<script setup>
import { ref, computed } from 'vue'
import { runCode } from '../composables/useRunner.js'
import { play } from '../sound.js'

const props = defineProps({
  problem: { type: Object, required: true },
  title: { type: String, default: '' },
  busy: { type: Boolean, default: false }
})
const emit = defineEmits(['submit', 'cancel'])

const code = ref(props.problem.starter)
const results = ref([])
const logs = ref([])
const running = ref(false)
const showRef = ref(false)
const startedAt = ref(0)
const hasRun = ref(false)

const pass = computed(() => results.value.filter(r => r.ok).length)
const total = computed(() => results.value.length)

async function run() {
  if (!startedAt.value) startedAt.value = Date.now()
  hasRun.value = true
  running.value = true
  const r = await runCode(props.problem, code.value)
  results.value = r.results
  logs.value = r.logs
  running.value = false
  if (r.results.some(x => x.ok)) play('pop')
}

function reset() {
  code.value = props.problem.starter
  results.value = []
  logs.value = []
  startedAt.value = 0
  hasRun.value = false
}

function submit() {
  if (!hasRun.value && !confirm('还没本地运行过，确定直接交卷？（由服务端判分）')) return
  const durationMs = startedAt.value ? Date.now() - startedAt.value : 0
  // 只提交源码，判分交给服务端（防前端改分）
  emit('submit', { code: code.value, durationMs })
}

function onTab(e) {
  if (e.key !== 'Tab') return
  e.preventDefault()
  const el = e.target
  const s = el.selectionStart, t = el.selectionEnd
  el.value = el.value.slice(0, s) + '  ' + el.value.slice(t)
  el.setSelectionRange(s + 2, s + 2)
  code.value = el.value
}
</script>

<template>
  <div class="card">
    <h2 style="font-size:16px">💻 {{ title }}</h2>
    <p class="desc">{{ problem.desc }} —— 写完点「运行」自测，通过后「交卷」。</p>

    <textarea class="editor" spellcheck="false" v-model="code" @keydown="onTab"></textarea>

    <div class="bar">
      <button @click="run" :disabled="running">{{ running ? '运行中…' : '▶ 运行' }}</button>
      <button class="ghost" @click="reset">重置代码</button>
      <button class="ghost" @click="showRef = !showRef">{{ showRef ? '收起参考' : '查看参考实现' }}</button>
      <span class="score" v-if="total">用例：{{ pass }} / {{ total }}</span>
    </div>

    <details v-if="showRef" open>
      <summary>参考实现（看完合上，重新默写一遍）</summary>
      <pre>{{ problem.ref }}</pre>
    </details>

    <div class="out" style="margin-top:10px">
      <template v-if="!logs.length && !results.length">点「运行」看结果…</template>
      <template v-for="(l, i) in logs" :key="'l' + i">› {{ l }}<br /></template>
      <template v-for="(r, i) in results" :key="'r' + i">
        <span :class="r.ok ? 'r-ok' : 'r-no'">{{ r.ok ? '✅' : '❌' }} {{ r.name }}</span><template v-if="!r.ok"> → {{ r.msg }}</template><br />
      </template>
    </div>

    <div class="r-bar" style="justify-content:flex-start;margin-top:14px">
      <button class="ghost" @click="emit('cancel')">退出</button>
      <button class="primary" :disabled="busy" @click="submit">{{ busy ? '结算中…' : '交卷' }}</button>
    </div>
  </div>
</template>

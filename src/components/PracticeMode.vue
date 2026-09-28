<script setup>
import { ref, computed } from 'vue'
import { runCode } from '../composables/useRunner.js'
import ConceptPanel from './ConceptPanel.vue'

const props = defineProps({
  problem: { type: Object, required: true }
})

const code = ref(props.problem.starter)
const results = ref([])
const logs = ref([])
const running = ref(false)
const showRef = ref(false)

const pass = computed(() => results.value.filter(r => r.ok).length)

async function run() {
  running.value = true
  const r = await runCode(props.problem, code.value)
  results.value = r.results
  logs.value = r.logs
  running.value = false
}

function reset() {
  code.value = props.problem.starter
  results.value = []
  logs.value = []
}

/** Tab 键缩进两个空格（顺手同步 v-model） */
function onTab(e) {
  if (e.key !== 'Tab') return
  e.preventDefault()
  const el = e.target
  const s = el.selectionStart
  const t = el.selectionEnd
  el.value = el.value.slice(0, s) + '  ' + el.value.slice(t)
  el.setSelectionRange(s + 2, s + 2)
  code.value = el.value
}
</script>

<template>
  <ConceptPanel :problem="problem" />

  <div class="card">
    <h2>{{ problem.title }}</h2>
    <p class="desc">{{ problem.desc }}</p>

    <textarea class="editor" spellcheck="false" v-model="code" @keydown="onTab"></textarea>

    <div class="bar">
      <button @click="run" :disabled="running">{{ running ? '运行中…' : '▶ 运行' }}</button>
      <button class="ghost" @click="reset">重置代码</button>
      <button class="ghost" @click="showRef = !showRef">{{ showRef ? '收起参考' : '查看参考实现' }}</button>
      <span class="score" v-if="results.length">得分：{{ pass }} / {{ results.length }}</span>
    </div>

    <details v-if="showRef" open>
      <summary>参考实现（看完合上，重新默写一遍）</summary>
      <pre>{{ problem.ref }}</pre>
    </details>
  </div>

  <div class="card">
    <h2 style="font-size:14px">运行结果</h2>
    <div class="out">
      <template v-if="!logs.length && !results.length">点「运行」看结果…</template>
      <template v-for="(l, i) in logs" :key="'l' + i">› {{ l }}<br /></template>
      <template v-for="(r, i) in results" :key="'r' + i">
        <span :class="r.ok ? 'r-ok' : 'r-no'">{{ r.ok ? '✅' : '❌' }} {{ r.name }}</span><template v-if="!r.ok"> → {{ r.msg }}</template><br />
      </template>
    </div>
  </div>
</template>

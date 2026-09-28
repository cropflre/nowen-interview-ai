<script setup>
import { ref, computed, watch } from 'vue'
import TypingDrill from './TypingDrill.vue'

const props = defineProps({
  problems: { type: Array, required: true },
  startIndex: { type: Number, default: 0 }
})

const typable = computed(() =>
  props.problems.map((p, i) => ({ p, i })).filter(o => !!o.p.tests && o.p.ref)
)

const idx = ref(props.startIndex)

watch(() => props.startIndex, v => {
  if (typable.value.some(o => o.i === v)) idx.value = v
})

const target = computed(() => {
  const p = props.problems[idx.value]
  if (!p || !p.ref) return ''
  return p.ref.split('\n').filter(l => !l.trim().startsWith('钩子')).join('\n').trim()
})
const title = computed(() => (props.problems[idx.value] || {}).title || '')
</script>

<template>
  <div class="card">
    <h2 style="font-size:15px">⌨️ 打字默写 · 代码</h2>
    <p class="desc">选一道手写题，照着参考实现敲一遍。练的是手指记忆。</p>
    <div class="bar">
      <select v-model.number="idx">
        <option v-for="o in typable" :key="o.i" :value="o.i">{{ o.p.title }}</option>
      </select>
    </div>
  </div>

  <TypingDrill :key="idx" :title="title" :text="target" />
</template>

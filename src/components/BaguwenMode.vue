<script setup>
import { ref, computed, reactive } from 'vue'
import { BAGUWEN } from '../data/baguwen.js'
import TypingDrill from './TypingDrill.vue'

const tab = ref('recite')            // recite | type
const open = reactive({})            // 背诵：哪几题展开了

function toggle(ci, ii) {
  const k = ci + '-' + ii
  open[k] = !open[k]
}
const starText = n => '⭐'.repeat(n)

// 展平题目，用于「中文默写」下拉
const flat = []
BAGUWEN.forEach((s, ci) => s.items.forEach((it, ii) => flat.push({ ci, ii, s, it, idx: flat.length })))

const selIdx = ref(0)
const sel = computed(() => flat[selIdx.value])
const total = flat.length
</script>

<template>
  <div class="card">
    <div class="modeline" style="margin-bottom:0">
      <button :class="{ active: tab === 'recite' }" @click="tab = 'recite'">📚 背诵（问答）</button>
      <button :class="{ active: tab === 'type' }" @click="tab = 'type'">⌨️ 中文默写（手打答案）</button>
      <span class="score">共 {{ total }} 题</span>
    </div>
  </div>

  <!-- 背诵 -->
  <template v-if="tab === 'recite'">
    <div v-for="(s, ci) in BAGUWEN" :key="ci" class="card">
      <h2 style="font-size:15px">{{ s.cat }}<span class="muted">（{{ s.items.length }} 题）</span></h2>
      <div v-for="(it, ii) in s.items" :key="ii" class="bw-item">
        <div class="bw-q" @click="toggle(ci, ii)">
          <span class="star">{{ starText(it.star) }}</span>
          <span>{{ it.q }}</span>
        </div>
        <div v-if="open[ci + '-' + ii]" class="bw-a" v-html="it.a"></div>
      </div>
    </div>
  </template>

  <!-- 中文默写 -->
  <template v-else>
    <div class="card">
      <h2 style="font-size:15px">⌨️ 中文默写 · 手打答案</h2>
      <p class="desc">选一道题，照着标准答案用手打一遍。中文输入法打字不会误判；先「提词：开」照着敲，熟了再关掉盲打。</p>
      <div class="bar">
        <select v-model.number="selIdx">
          <optgroup v-for="(s, ci) in BAGUWEN" :key="ci" :label="s.cat">
            <option v-for="o in flat.filter(x => x.ci === ci)" :key="o.idx" :value="o.idx">
              {{ o.it.q.slice(0, 34) }}
            </option>
          </optgroup>
        </select>
      </div>
    </div>

    <TypingDrill :key="selIdx" :title="sel ? sel.it.q : ''" :text="sel ? sel.it.plain : ''" />
  </template>
</template>

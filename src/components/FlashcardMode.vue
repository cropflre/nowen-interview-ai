<script setup>
import { ref, computed } from 'vue'
import { FLASHCARDS } from '../data/flashcards.js'

const fi = ref(0)
const shown = ref(false)
const card = computed(() => FLASHCARDS[fi.value])

function flip() {
  shown.value = !shown.value
}
function next(d) {
  fi.value = (fi.value + d + FLASHCARDS.length) % FLASHCARDS.length
  shown.value = false
}
function shuffle() {
  fi.value = Math.floor(Math.random() * FLASHCARDS.length)
  shown.value = false
}
</script>

<template>
  <div class="card">
    <h2 style="font-size:15px">🎴 闪卡（背钩子）</h2>
    <p class="desc">
      先在心里想答案，点卡片翻面看"钩子"。想不起来就多点几次，直到形成条件反射。（闪卡是全局的，与左侧选题无关）
    </p>

    <div class="flash-card" @click="flip">
      <div class="fq">{{ card.q }}</div>
      <div v-if="shown" class="fa">{{ card.a }}</div>
      <div v-else class="tip">（点我翻面看答案）</div>
    </div>

    <div class="bar">
      <button class="ghost" @click="next(-1)">上一张</button>
      <button class="ghost" @click="next(1)">下一张</button>
      <button class="ghost" @click="shuffle">随机</button>
      <span class="score">{{ fi + 1 }} / {{ FLASHCARDS.length }}</span>
    </div>
  </div>
</template>

<script setup>
defineProps({
  problem: { type: Object, required: true }
})
</script>

<template>
  <div class="card">
    <details open>
      <summary>📖 概念讲解（先看懂，再动手）</summary>
      <div class="concept-body" v-html="problem.concept || '（本关无概念讲解）'"></div>
    </details>
  </div>
</template>

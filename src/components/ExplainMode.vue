<script setup>
defineProps({
  problem: { type: Object, required: true }
})
</script>

<template>
  <div class="card">
    <h2 style="font-size:15px">📖 通俗讲解：{{ problem.title }}</h2>
    <div class="concept-body" v-html="problem.explain || '（本关无讲解）'"></div>
  </div>
</template>

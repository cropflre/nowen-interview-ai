<script setup>
import { ref } from 'vue'

const props = defineProps({
  data: { type: Object, default: null },
  busy: { type: Boolean, default: false }
})
const emit = defineEmits(['resolve', 'scroll'])

const openId = ref(null)
function toggle(id) { openId.value = openId.value === id ? null : id }
</script>

<template>
  <div v-if="!data" class="center">加载中…</div>
  <template v-else>
    <div class="board-head">
      <div>
        <div class="board-title">📕 错题本</div>
        <div class="muted">
          共 <b>{{ data.count }}</b> 题。
          <template v-if="data.count >= 5">错题已凝聚成「心魔」，回地图挑战可一键清空。</template>
          <template v-else>攒到 5 题即可召唤「心魔试炼」。</template>
        </div>
        <div class="bar" style="margin:0">
          <button
            class="ghost"
            :disabled="data.count < 3 || busy"
            :title="data.count >= 3 ? '固定题序，可反复挑战冲三星；三星自动移出错题本' : '错题至少要有 3 题才能生成'"
            @click="emit('scroll')"
          >
            ⚔️ 生成专属心魔卷（{{ data.count < 3 ? '需 3 题' : data.count + ' 题' }}）
          </button>
        </div>
      </div>
    </div>

    <div v-if="!data.count" class="center">
      🎉 错题本是空的，继续保持
    </div>

    <div v-for="q in data.items" :key="q.id" class="wb-item">
      <div class="wb-stem" @click="toggle(q.id)">
        <span class="wb-star">{{ '⭐'.repeat(q.star || 0) }}</span>
        <span class="wb-cat">{{ q.category }}</span>
        <span class="wb-q">{{ q.stem }}</span>
        <span class="wb-count">错 {{ q.wrongCount }} 次</span>
        <span class="wb-arrow">{{ openId === q.id ? '▲' : '▼' }}</span>
      </div>

      <div v-if="openId === q.id" class="wb-body">
        <div class="wb-ans bad">
          <b>❌ 我当时选的：</b>{{ q.myAnswer || '（未作答）' }}
        </div>
        <div class="wb-ans good">
          <b>✅ 正确答案：</b>{{ q.rightAnswer || '—' }}
        </div>
        <details open>
          <summary>📖 解析</summary>
          <div class="concept-body" v-html="q.explain"></div>
        </details>
        <div class="wb-bar">
          <button class="ghost" :disabled="busy" @click="emit('resolve', q.id)">✅ 已掌握，移出错题本</button>
        </div>
      </div>
    </div>
  </template>
</template>

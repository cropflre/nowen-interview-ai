<script setup>
const props = defineProps({
  map: { type: Object, required: true },     // { chapters: [...] }
  nightmare: { type: Object, default: null }, // { ready, count, need, xpReward }
  daily: { type: Object, default: null },     // { tasks:[{code,title,desc,xp,done}], doneXp, totalXp }
  busy: { type: Boolean, default: false }
})
const emit = defineEmits(['pick', 'nightmare'])

const TYPE_META = {
  quiz: { icon: '❓', label: '选择' },
  recite: { icon: '🧠', label: '背诵' },
  typing: { icon: '⌨️', label: '默写' },
  code: { icon: '💻', label: '手写' },
  boss: { icon: '👹', label: 'BOSS' },
  flash: { icon: '🎴', label: '闪卡' }
}
const meta = t => TYPE_META[t] || { icon: '🎯', label: t }
const stars = n => '★'.repeat(n) + '☆'.repeat(3 - n)
</script>

<template>
  <div class="map-wrap">
    <!-- 今日任务 -->
    <div v-if="daily" class="daily">
      <div class="daily-head">
        📅 今日任务
        <span class="muted">{{ daily.doneXp }} / {{ daily.totalXp }} XP</span>
      </div>
      <div class="daily-list">
        <span
          v-for="t in daily.tasks"
          :key="t.code"
          class="daily-item"
          :class="{ done: t.done }"
          :title="t.desc"
        >{{ t.done ? '✅' : '⬜' }} {{ t.title }} <b>+{{ t.xp }}</b></span>
      </div>
    </div>

    <!-- 心魔试炼入口 -->
    <div v-if="nightmare" class="nightmare" :class="{ ready: nightmare.ready }">
      <div class="nm-left">
        <div class="nm-title">👺 心魔试炼</div>
        <div class="nm-sub">
          <template v-if="nightmare.ready">
            错题已凝聚成 <b>{{ nightmare.count }}</b> 题心魔 —— 全对可清空错题，得 <b>{{ nightmare.xpReward }}</b> XP 与徽章「温故知新」
          </template>
          <template v-else>
            错题本 {{ nightmare.count }} / {{ nightmare.need }} 题，再攒 {{ nightmare.need - nightmare.count }} 题即可召唤心魔
          </template>
        </div>
      </div>
      <button :disabled="!nightmare.ready || busy" @click="emit('nightmare')">
        {{ nightmare.ready ? '挑战心魔' : '尚未成形' }}
      </button>
    </div>

    <!-- 星系（章节） -->
    <div v-for="ch in map.chapters" :key="ch.id" class="galaxy">
      <div class="galaxy-head">
        <div class="galaxy-title">{{ ch.title }}</div>
        <div class="galaxy-prog">
          <span class="pbar"><i :style="{ width: ch.percent + '%' }"></i></span>
          <span class="pct">{{ ch.done }}/{{ ch.total }} · {{ ch.percent }}%</span>
          <span v-if="ch.full" class="full">满星 {{ ch.full }}</span>
        </div>
      </div>

      <div class="levels">
        <button
          v-for="lv in ch.levels"
          :key="lv.id"
          class="lv"
          :class="{
            locked: !lv.unlocked,
            done: lv.bestStars >= 1,
            full: lv.bestStars === 3,
            boss: lv.type === 'boss',
            'coming': !['quiz','boss','recite'].includes(lv.type)
          }"
          :disabled="!lv.unlocked || busy"
          :title="lv.unlocked ? (['quiz','boss','recite'].includes(lv.type) ? '开始挑战' : '该玩法开发中（M3）') : '先通过上一关解锁'"
          @click="emit('pick', lv)"
        >
          <span class="lv-icon">{{ lv.unlocked ? meta(lv.type).icon : '🔒' }}</span>
          <span class="lv-name">{{ meta(lv.type).label }}</span>
          <span class="lv-stars">{{ stars(lv.bestStars) }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

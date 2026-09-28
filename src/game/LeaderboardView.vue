<script setup>
const props = defineProps({
  data: { type: Object, default: null },
  last: { type: Object, default: null },   // 上周结算快照
  busy: { type: Boolean, default: false }
})

const MEDAL = ['🥇', '🥈', '🥉']
</script>

<template>
  <div v-if="!data" class="center">加载中…</div>
  <template v-else>
    <!-- 上周结算横幅 -->
    <div v-if="last && last.exists && last.top && last.top.length" class="last-week">
      <div class="lw-left">
        <div class="lw-title">🏆 上周冠军</div>
        <div class="lw-name">{{ last.top[0].name }} <span class="lw-score">{{ last.top[0].score }} XP</span></div>
      </div>
      <div class="lw-right muted">
        {{ last.weekStart }} ~ {{ last.weekEnd }}<br />
        上周共 {{ last.players }} 人参与 · 已结算
      </div>
    </div>

    <div class="board-head">
      <div>
        <div class="board-title">🏆 本周 XP 榜</div>
        <div class="muted">自然周结算：{{ data.weekStart }} ~ {{ data.weekEnd }}（每周一 00:00 重置）</div>
      </div>
      <div v-if="data.me" class="my-rank">
        <div class="my-rank-no">#{{ data.me.rank }}</div>
        <div class="muted">本周 {{ data.me.score }} XP</div>
        <div v-if="data.me.rank > 1" class="gap">距上一名还差 <b>{{ data.me.gapToPrev }}</b> XP</div>
        <div v-else class="gap top">你就是第一名 🎉</div>
      </div>
    </div>

    <!-- Top 3 领奖台 -->
    <div class="podium">
      <div
        v-for="(it, i) in data.items.slice(0, 3)"
        :key="it.id"
        class="pod"
        :class="['p' + (i + 1), { me: it.isMe }]"
      >
        <div class="pod-medal">{{ MEDAL[i] }}</div>
        <div class="pod-name">{{ it.name }}<span v-if="it.isMe" class="tag">我</span></div>
        <div class="pod-xp">{{ it.score }} XP</div>
      </div>
    </div>

    <!-- 4 名之后 -->
    <div class="board-list">
      <div
        v-for="it in data.items.slice(3)"
        :key="it.id"
        class="board-row"
        :class="{ me: it.isMe }"
      >
        <span class="br-rank">#{{ it.rank }}</span>
        <span class="br-name">{{ it.name }}</span>
        <span class="br-lv">Lv.{{ it.level }}</span>
        <span class="br-streak">🔥{{ it.streak_days }}天</span>
        <span class="br-xp">{{ it.score }} XP</span>
      </div>
      <div v-if="data.items.length <= 3" class="muted" style="padding:10px 0">还没有其他人上榜，去把他们超了 👀</div>
    </div>
  </template>
</template>

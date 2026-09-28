<script setup>
import { ref, onMounted, computed } from 'vue'
import confetti from 'canvas-confetti'
import { play } from '../sound.js'

const props = defineProps({
  result: { type: Object, required: true },
  title: { type: String, default: '' },
  isNightmare: { type: Boolean, default: false }
})
const emit = defineEmits(['back', 'retry', 'next'])

const showXp = ref(0)
const popped = ref(false)
const gained = computed(() => props.result.gainedXp || 0)
const stars = computed(() => props.result.stars || 0)
const pass = computed(() => (props.isNightmare ? props.result.pass : stars.value >= 1))
const comfort = computed(() => !pass.value && gained.value > 0)

/** 只在「3★」或「斩心魔」时撒花 —— 保持稀缺性 */
function celebrate() {
  const base = { spread: 70, startVelocity: 42, ticks: 200, zIndex: 9999 }
  confetti({ ...base, particleCount: 80, origin: { x: 0.5, y: 0.62 } })
  setTimeout(() => confetti({ ...base, particleCount: 55, angle: 60, origin: { x: 0.1, y: 0.7 } }), 160)
  setTimeout(() => confetti({ ...base, particleCount: 55, angle: 120, origin: { x: 0.9, y: 0.7 } }), 260)
}

onMounted(() => {
  play('swoosh')                                        // 结算页滑出
  if (stars.value === 3 || (props.isNightmare && props.result.perfect)) {
    setTimeout(() => { play('tada'); celebrate() }, 380) // 三星 / 斩心魔：音效 + 撒花
  }
  setTimeout(() => { popped.value = true }, 120)
  // XP 数字滚动
  const target = gained.value
  const t0 = performance.now()
  const dur = 700
  const tick = (t) => {
    const p = Math.min(1, (t - t0) / dur)
    showXp.value = Math.round(target * (1 - Math.pow(1 - p, 3)))
    if (p < 1) requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
})
</script>

<template>
  <div class="result" :class="{ win: pass, lose: !pass }">
    <div class="r-head">{{ isNightmare ? '👺 心魔试炼' : title }}</div>

    <!-- 星级（心魔不显示星） -->
    <div v-if="!isNightmare" class="star-row" :class="{ pop: popped }">
      <span v-for="i in 3" :key="i" class="star" :class="{ on: i <= stars, d1: i === 1, d2: i === 2, d3: i === 3 }">★</span>
    </div>
    <div v-else class="nm-verdict">{{ result.perfect ? '心魔已斩！' : (pass ? '心魔退散' : '心魔仍在…') }}</div>

    <div class="r-line">
      <span>得分 <b>{{ result.score ?? '—' }}</b></span>
      <span>正确率 <b>{{ result.accuracy }}%</b></span>
      <span v-if="!isNightmare">用时 <b>{{ Math.round((result.durationMs || 0) / 1000) }}s</b></span>
      <span v-else>清空错题 <b>{{ result.cleared }} / {{ result.total }}</b></span>
    </div>

    <div class="xp-gain">
      +<span class="xp-num">{{ showXp }}</span> XP
      <span v-if="result.firstClear" class="tag">首通奖励</span>
      <span v-if="result.perfect && isNightmare" class="tag gold">全对翻倍</span>
    </div>

    <div v-if="result.flagged === 'too-fast'" class="comfort" style="background:#fdeaea;border-left-color:#e54545;color:#7a1f1f">
      ⚠️ 检测到异常耗时（满分但用时不足 2 秒），本关已按 0 分计。
    </div>

    <div v-if="result.daily && result.daily.done && result.daily.done.length" class="unlock" style="background:#fffbe6;border-color:#ffe58f">
      <div class="unlock-title" style="color:#d48806">📅 每日任务完成</div>
      <div v-for="d in result.daily.done" :key="d.code" class="unlock-item">
        <b>{{ d.title }}</b> <span class="tag">+{{ d.xp }} XP</span>
      </div>
    </div>

    <div v-if="comfort" class="comfort">
      🌱 这次没过关，但「交卷即成长」——这 {{ gained }} 点是安慰 XP，先记进账上。
    </div>

    <div v-if="result.unlocked && result.unlocked.length" class="unlock">
      <div class="unlock-title">🎖 解锁成就</div>
      <div v-for="u in result.unlocked" :key="u.code" class="unlock-item">
        <b>{{ u.title }}</b> —— {{ u.desc }} <span class="tag">+{{ u.xpReward }} XP</span>
      </div>
    </div>

    <div v-if="result.user" class="u-line">
      Lv.{{ result.user.level }} · 总 XP {{ result.user.xp }}
      <span v-if="result.user.levelProgress">（{{ result.user.levelProgress.current }}/{{ result.user.levelProgress.need }}）</span>
      · 金币 {{ result.user.coins }} · 连续 {{ result.user.streakDays }} 天
    </div>

    <div class="r-bar">
      <button class="ghost" @click="emit('back')">返回地图</button>
      <button class="ghost" @click="emit('retry')">再来一次</button>
      <button v-if="pass && !isNightmare" class="primary" @click="emit('next')">下一关 →</button>
    </div>
  </div>
</template>

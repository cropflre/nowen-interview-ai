<script setup>
import { computed } from 'vue'

const props = defineProps({
  data: { type: Object, default: null }
})

const TYPE_LABEL = { quiz: '选择', recite: '背诵', typing: '默写', code: '手写', boss: 'BOSS', flash: '闪卡' }

/** DAU 柱状：按最大值归一化 */
const dauMax = computed(() => Math.max(1, ...(props.data?.dau || []).map(d => d.value)))
const dauList = computed(() => (props.data?.dau || []).slice().reverse())   // 时间正序
const barH = v => Math.max(4, Math.round(v / dauMax.value * 72))

const starRows = computed(() => (props.data?.passedDist || []).map(r => ({
  label: r.stars === 0 ? '未通过' : '★'.repeat(r.stars),
  n: r.n
})))
const starTotal = computed(() => starRows.value.reduce((s, r) => s + r.n, 0) || 1)
</script>

<template>
  <div v-if="!data" class="center">加载中…</div>
  <template v-else>
    <!-- KPI -->
    <div class="kpi">
      <div><b>{{ data.overview.users }}</b><span>用户数</span></div>
      <div><b>{{ data.overview.attempts }}</b><span>累计挑战</span></div>
      <div><b>{{ data.overview.totalXp }}</b><span>累计 XP</span></div>
      <div><b>{{ data.overview.avgStars ?? '—' }}</b><span>平均星级</span></div>
      <div><b>{{ data.overview.wrongOpen }}</b><span>未掌握错题</span></div>
    </div>

    <!-- DAU -->
    <div class="card">
      <h2 style="font-size:15px">📈 近 14 天活跃（DAU）</h2>
      <p class="desc">口径：当天产生过 XP 的去重用户数（数据来自 xp_log 账本）</p>
      <div class="chart">
        <div v-for="d in dauList" :key="d.date" class="col" :title="d.date + ' · ' + d.value + ' 人'">
          <span class="col-v">{{ d.value }}</span>
          <span class="col-bar" :style="{ height: barH(d.value) + 'px' }"></span>
          <span class="col-x">{{ d.date.slice(5) }}</span>
        </div>
        <div v-if="!dauList.length" class="muted">暂无数据</div>
      </div>
    </div>

    <!-- 次日留存 -->
    <div class="card">
      <h2 style="font-size:15px">🔁 次日留存（D1 Retention）</h2>
      <p class="desc">口径：当天活跃的人里，第二天仍然活跃的比例</p>
      <table>
        <tr><th>日期</th><th>当天活跃</th><th>次日回访</th><th>次日留存率</th></tr>
        <tr v-for="r in data.retention" :key="r.date">
          <td>{{ r.date }}</td>
          <td>{{ r.base }}</td>
          <td>{{ r.retained }}</td>
          <td>
            <span class="rate" :class="{ good: r.rate >= 40, bad: r.rate > 0 && r.rate < 20 }">{{ r.rate }}%</span>
          </td>
        </tr>
        <tr v-if="!data.retention.length"><td colspan="4" class="muted">暂无数据</td></tr>
      </table>
    </div>

    <!-- 星级分布 -->
    <div class="card">
      <h2 style="font-size:15px">⭐ 结算星级分布</h2>
      <div class="dist">
        <div v-for="r in starRows" :key="r.label" class="dist-row">
          <span class="dist-label">{{ r.label }}</span>
          <span class="dist-bar"><i :style="{ width: Math.round(r.n / starTotal * 100) + '%' }"></i></span>
          <span class="dist-n">{{ r.n }} 次 · {{ Math.round(r.n / starTotal * 100) }}%</span>
        </div>
      </div>
    </div>

    <!-- 关卡难度 -->
    <div class="card">
      <h2 style="font-size:15px">🎯 各关首次通过率</h2>
      <p class="desc">口径：每个用户在该关的第一次尝试是否拿到 ≥1★（越低说明这关越“劝退”）</p>
      <table>
        <tr><th>关卡</th><th>类型</th><th>难度</th><th>参与人数</th><th>首次通过率</th><th>平均分</th></tr>
        <tr v-for="l in data.levels" :key="l.id">
          <td>{{ l.title }}</td>
          <td>{{ TYPE_LABEL[l.type] || l.type }}</td>
          <td>{{ '◆'.repeat(l.difficulty) }}</td>
          <td>{{ l.players }}</td>
          <td>
            <span class="rate" :class="{ bad: l.passRate < 50 }">{{ l.passRate }}%</span>
            <span class="muted">（{{ l.passed }}/{{ l.players }}）</span>
          </td>
          <td>{{ l.avgScore ?? '—' }}</td>
        </tr>
        <tr v-if="!data.levels.length"><td colspan="6" class="muted">还没有人挑战过关卡</td></tr>
      </table>
    </div>
  </template>
</template>

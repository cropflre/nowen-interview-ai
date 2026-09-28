<script setup>
/**
 * 🎯 面试就绪度报告
 *
 * 回答一个此前平台回答不了的问题：「离能通过面试还差多少？」
 *   知识就绪度 = 每道题按最高档取分（认得25 / 说得出55 / 讲得清80）归一化到 100
 *   应用就绪度 = 场景达标率（通用 40% + 项目深挖 60%）
 *   最终就绪度 = (知识55% + 应用45%) × 延迟复测系数
 * 延迟复测系数 = 隔天再测的正确率 —— 平台里最难自欺的指标，样本不足时不打折。
 */
import { ref, computed, onMounted } from 'vue'
import { api } from '../api.js'

const emit = defineEmits(['toast'])

const loading = ref(true)
const d = ref(null)

const scoreColor = computed(() => {
  const v = d.value ? d.value.overall : 0
  if (v >= 80) return '#2e9e63'
  if (v >= 60) return '#d48806'
  return '#e54545'
})
const verdict = computed(() => {
  const v = d.value ? d.value.overall : 0
  if (v >= 80) return '可以约面试了'
  if (v >= 60) return '能聊，但会被追问打穿'
  if (v >= 30) return '能认题，说不出'
  return '还在「认得」这一档'
})

async function load() {
  loading.value = true
  try {
    d.value = await api.readiness()
  } catch (e) {
    emit('toast', e.message)
  } finally {
    loading.value = false
  }
}

function pct(n) {
  return (n === null || n === undefined) ? '—' : n + '%'
}
onMounted(load)
defineExpose({ load })
</script>

<template>
  <div v-if="loading" class="center">加载中…</div>
  <template v-else-if="d">
    <!-- 总分 -->
    <div class="card rd-top">
      <div class="rd-score">
        <div class="rd-num" :style="{ color: scoreColor }">{{ d.overall }}</div>
        <div class="rd-label">面试就绪度</div>
        <div class="rd-verdict">{{ verdict }}</div>
      </div>
      <div class="rd-main">
        <div class="rd-row">
          <span class="rd-k">知识就绪度</span>
          <span class="rd-bar"><i :style="{ width: d.knowledge + '%' }"></i></span>
          <b>{{ d.knowledge }}</b>
        </div>
        <div class="rd-row">
          <span class="rd-k">应用就绪度</span>
          <span class="rd-bar"><i :style="{ width: d.apply + '%' }"></i></span>
          <b>{{ d.apply }}</b>
        </div>
        <div class="rd-row">
          <span class="rd-k">延迟复测系数</span>
          <span class="rd-bar"><i :style="{ width: (d.coefficient === null ? 0 : d.coefficient * 100) + '%' }"></i></span>
          <b>{{ d.coefficient === null ? '样本不足' : '×' + d.coefficient.toFixed(2) }}</b>
        </div>
        <p class="muted" style="margin:8px 0 0;font-size:12.5px">
          口径：{{ d.totals.questions }} 道知识点按最高档取分（认得 25 / 说得出 55 / 讲得清 80）+
          {{ d.totals.scenes }} 道场景达标率（项目深挖权重 60%）。
          <template v-if="d.delayed.sample >= 5">
            已按延迟复测正确率（{{ d.delayed.rate }}%，{{ d.delayed.sample }} 次样本）打折 —— 这是平台里最难自欺的指标。
          </template>
          <template v-else>延迟复测样本还不足 5 次，暂不打折（样本够了会按真实留存率打折）。</template>
        </p>
        <p v-if="d.etaDays !== null" class="muted" style="margin:6px 0 0;font-size:12.5px">
          按你近 7 天的节奏，清完剩余目标约需 <b>{{ d.etaDays }}</b> 天。
        </p>
      </div>
    </div>

    <!-- 薄弱点 -->
    <div class="card">
      <h2 style="font-size:14px">🎯 薄弱点 Top3（先打这里）</h2>
      <div v-if="!d.weak.length" class="muted" style="padding:6px 0">还没有足够数据 —— 先去闯关和场景题里留下记录。</div>
      <div v-for="w in d.weak" :key="w.category" class="weak-row">
        <span class="weak-cat">{{ w.category }}</span>
        <span class="weak-bar"><i :style="{ width: w.readiness + '%' }"></i></span>
        <b class="weak-n">{{ w.readiness }}</b>
        <span class="weak-meta">{{ w.type }} · {{ w.total }} 项<template v-if="w.passed !== undefined"> · 达标 {{ w.passed }}</template></span>
      </div>
    </div>

    <!-- 知识分类明细 -->
    <div class="card">
      <h2 style="font-size:14px">📚 知识分类（{{ d.categories.length }}）</h2>
      <div v-for="c in d.categories" :key="c.category" class="rd-cat">
        <div class="rd-cat-head">
          <span class="rd-cat-name">{{ c.category }}</span>
          <b :style="c.readiness >= 60 ? 'color:#2e9e63' : 'color:#e54545'">{{ c.readiness }}</b>
        </div>
        <div class="rd-tier">
          <span>共 {{ c.total }} 题</span>
          <span class="t0">未接触 {{ c.none }}</span>
          <span class="t1">认得 {{ c.known }}</span>
          <span class="t2">说得出 {{ c.say }}</span>
          <span class="t3">讲得清 {{ c.tell }}</span>
        </div>
      </div>
    </div>

    <!-- 场景分类明细 -->
    <div class="card">
      <h2 style="font-size:14px">🧩 场景 / 项目分类（{{ d.sceneCategories.length }}）</h2>
      <div v-for="c in d.sceneCategories" :key="c.category" class="rd-cat">
        <div class="rd-cat-head">
          <span class="rd-cat-name">{{ c.category }}</span>
          <b :style="c.readiness >= 60 ? 'color:#2e9e63' : 'color:#e54545'">{{ c.readiness }}</b>
        </div>
        <div class="rd-tier"><span>共 {{ c.total }} 道 · 达标 {{ c.passed }}</span></div>
      </div>
    </div>
  </template>
</template>

<style scoped>
.rd-top{display:flex;gap:20px;align-items:stretch;}
.rd-score{flex:0 0 150px;display:flex;flex-direction:column;align-items:center;justify-content:center;
  border-right:1px solid var(--bd,#e9edf3);padding-right:18px;}
.rd-num{font-size:52px;font-weight:700;line-height:1;}
.rd-label{font-size:12.5px;opacity:.65;margin-top:4px;}
.rd-verdict{font-size:13px;margin-top:8px;font-weight:500;}
.rd-main{flex:1 1 auto;min-width:0;}
.rd-row{display:flex;align-items:center;gap:10px;margin-bottom:7px;font-size:13px;}
.rd-k{flex:0 0 92px;opacity:.75;}
.rd-bar{flex:1 1 auto;height:9px;background:#e9edf3;border-radius:6px;overflow:hidden;}
.rd-bar i{display:block;height:100%;background:linear-gradient(90deg,#5b8def,#2b6de5);}
.rd-row b{flex:0 0 62px;text-align:right;}
.weak-row{display:flex;align-items:center;gap:10px;padding:6px 0;font-size:13px;}
.weak-cat{flex:0 0 190px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.weak-bar{flex:1 1 auto;height:9px;background:#e9edf3;border-radius:6px;overflow:hidden;}
.weak-bar i{display:block;height:100%;background:linear-gradient(90deg,#ff9a76,#e54545);}
.weak-n{flex:0 0 34px;text-align:right;color:#e54545;}
.weak-meta{flex:0 0 auto;font-size:12px;opacity:.6;}
.rd-cat{padding:7px 0;border-bottom:1px dashed var(--bd,#e9edf3);}
.rd-cat:last-child{border-bottom:none;}
.rd-cat-head{display:flex;justify-content:space-between;font-size:13px;}
.rd-cat-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.rd-tier{display:flex;gap:12px;font-size:12px;opacity:.65;margin-top:3px;flex-wrap:wrap;}
@media (max-width: 640px){
  .rd-top{flex-direction:column;}
  .rd-score{border-right:none;border-bottom:1px solid var(--bd,#e9edf3);padding:0 0 12px;width:100%;}
  .weak-cat{flex-basis:130px;}
}
</style>

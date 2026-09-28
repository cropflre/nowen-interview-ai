<script setup>
/**
 * 🗣 讲得清（费曼关）—— 掌握四档的第 3 档
 *
 * 与「📝 复现」的区别：
 *   复现 = 什么都不给，考你**能不能想起来**
 *   讲清 = 给你要点，考你**能不能讲明白**（用自己的话，最好打个比方）
 *
 * 只收「复现已达标」的题 —— 阶梯式进阶：先说得出，再讲得清。
 * 判分四维：要点覆盖 60 + 比喻/例子 20 + 篇幅 20，与参考答案高度雷同则封顶 40。
 */
import { ref, computed, onMounted } from 'vue'
import { api } from '../api.js'
import { play } from '../sound.js'

const emit = defineEmits(['toast', 'refresh'])

const loading = ref(true)
const queue = ref([])
const stats = ref(null)
const passLine = ref(70)

const qi = ref(0)
const text = ref('')
const submitted = ref(null)
const startedAt = ref(0)
const records = ref([])

/* 讲清达标后，可一键把这段沉淀成面试话术 */
const saveTopic = ref('')
const saveBody = ref('')
const saved = ref(false)
const saving = ref(false)

const cur = computed(() => queue.value[qi.value] || null)
const phase = computed(() => (!cur.value ? 'done' : (submitted.value ? 'result' : 'question')))
const doneCount = computed(() => records.value.length)
const passCount = computed(() => records.value.filter(r => r.pass).length)

async function load() {
  loading.value = true
  try {
    const [q, s] = await Promise.all([api.explainQueue(), api.recallStats()])
    queue.value = q.items || []
    passLine.value = q.passLine || 70
    stats.value = s
    qi.value = 0
    text.value = ''
    submitted.value = null
    records.value = []
    startedAt.value = Date.now()
  } catch (e) {
    emit('toast', e.message)
  } finally {
    loading.value = false
  }
}

async function submit() {
  if (!cur.value || submitted.value) return
  const body = { text: text.value.trim(), durationMs: Date.now() - startedAt.value }
  if (!body.text) return emit('toast', '先写一段讲解——不用专业，讲给人听懂就行')
  try {
    const r = await api.explainSubmit(cur.value.id, body)
    submitted.value = r
    records.value = [...records.value, r]
    if (r.pass) {
      // 达标 → 预填一份「素材草稿」，让用户顺手沉淀成面试话术
      saveTopic.value = String(cur.value.stem || '').replace(/^\d+[.、]\s*/, '').slice(0, 26)
      saveBody.value = text.value.trim()
      saved.value = false
      play('tada')
    } else {
      play('pop')
    }
    stats.value = await api.recallStats()
    emit('refresh')
  } catch (e) {
    emit('toast', e.message)
  }
}

async function save() {
  const t = saveTopic.value.trim()
  const b = saveBody.value.trim()
  if (!t) return emit('toast', '先写「知识点」')
  if (!b) return emit('toast', '内容不能为空')
  saving.value = true
  try {
    await api.addMetaphor({ topic: t, body: b, questionId: cur.value ? cur.value.id : null, source: 'explain' })
    saved.value = true
    emit('toast', '已存进比喻库 ✅')
  } catch (e) {
    emit('toast', e.message)
  } finally {
    saving.value = false
  }
}

function next() {
  if (qi.value + 1 < queue.value.length) {
    qi.value++
    text.value = ''
    submitted.value = null
    saved.value = false
    startedAt.value = Date.now()
  } else {
    queue.value = []
  }
}

onMounted(load)
defineExpose({ load })
</script>

<template>
  <div v-if="loading" class="center">加载中…</div>
  <template v-else>
    <!-- 看板 -->
    <div class="kpi" v-if="stats">
      <div>
        <b :style="stats.explain.rate !== null && stats.explain.rate < 60 ? 'color:#e54545' : ''">
          {{ stats.explain.rate === null ? '—' : stats.explain.rate + '%' }}
        </b>
        <span>讲清达标率</span>
      </div>
      <div><b>{{ stats.explain.avgScore === null ? '—' : stats.explain.avgScore }}</b><span>平均得分</span></div>
      <div><b>{{ stats.mastery.tell }}</b><span>「讲得清」题数</span></div>
      <div><b>{{ stats.mastery.say }}</b><span>「说得出」题数</span></div>
      <div><b>{{ stats.explain.attempts }}</b><span>累计讲清</span></div>
    </div>

    <!-- 目标说明 -->
    <div class="card">
      <h2 style="font-size:14px">🗣 讲得清 · 判分四维（达标线 {{ passLine }} 分）</h2>
      <ul class="rubric">
        <li><b>60</b> 要点覆盖 —— 该讲的都讲到了</li>
        <li><b>20</b> 打比方 / 举例子 —— 真懂还是背台词的分水岭</li>
        <li><b>20</b> 篇幅够展开 —— 太短说明没讲透</li>
        <li><b>—</b> 照抄参考答案 → 封顶 40 分（讲清楚 ≠ 抄一遍）</li>
      </ul>
      <p class="muted" style="margin:8px 0 0">
        这一关<b>给你要点</b>——考的不是记忆力，是能不能对着一个不懂的人讲明白。面试考的就是这个。
      </p>
    </div>

    <!-- 讲清区 -->
    <div class="card review-card" v-if="phase === 'question' && cur">
      <div class="quiz-head">
        <div class="quiz-title">
          🗣 讲得清
          <span class="muted">（{{ qi + 1 }} / {{ queue.length }}）</span>
        </div>
        <div class="quiz-meta">
          <span class="tag gold">复现 {{ cur.recallBest }} 分</span>
          <span class="muted">{{ cur.category }}</span>
        </div>
      </div>

      <div class="q-stem">{{ cur.stem }}</div>

      <div class="point-hint">
        <div class="ph-title">要讲到的要点（{{ cur.points.length }} 条）</div>
        <ol>
          <li v-for="(p, i) in cur.points" :key="i">{{ p }}</li>
        </ol>
        <div class="ph-note">把它们讲成一段大白话——最好举个例子。</div>
      </div>

      <textarea
        v-model="text"
        class="recall-input"
        rows="8"
        placeholder="用你自己的话讲清楚……（比如：「你可以把它想成……因为……所以……」）"
        @keydown.ctrl.enter="submit"
        @keydown.meta.enter="submit"
      ></textarea>

      <div class="r-bar" style="justify-content:space-between">
        <span class="muted">{{ text.trim().length }} 字 · Ctrl/⌘ + Enter 提交</span>
        <span>
          <button class="ghost" @click="next">跳过这题</button>
          <button class="primary" @click="submit">提交讲解</button>
        </span>
      </div>
    </div>

    <!-- 揭晓 -->
    <div class="card review-card" v-if="phase === 'result' && submitted">
      <div class="quiz-head">
        <div class="quiz-title">
          {{ submitted.pass ? '✅ 讲清楚了' : '❌ 还没讲明白' }}
          <span class="muted">（{{ qi + 1 }} / {{ queue.length }}）</span>
        </div>
        <div class="quiz-meta">
          <span v-if="submitted.gainedXp" class="tag gold">+{{ submitted.gainedXp }} XP</span>
          <span v-if="submitted.clearedWrong" class="muted">已移出错题本</span>
        </div>
      </div>

      <div class="score-line">
        <b :class="submitted.pass ? 'ok' : 'no'">{{ submitted.score }}</b>
        <span class="muted">/ 100（达标线 {{ submitted.passLine }}）</span>
      </div>

      <div class="dims">
        <span class="dim" :class="submitted.coverage === submitted.total ? 'good' : 'bad'">
          要点 {{ submitted.coverage }}/{{ submitted.total }} · {{ submitted.coverScore }}/60
        </span>
        <span class="dim" :class="submitted.analogy ? 'good' : 'bad'">
          {{ submitted.analogy ? '✅ 打了比方/举了例' : '❌ 没打比方/例子' }} · {{ submitted.analogy ? 20 : 0 }}/20
        </span>
        <span class="dim" :class="submitted.longEnough ? 'good' : 'bad'">
          篇幅 {{ submitted.length }} 字 · {{ submitted.longEnough ? 20 : 0 }}/20
        </span>
        <span v-if="submitted.copied" class="dim bad">
          ⚠️ 与参考答案雷同 {{ submitted.copyRate }}% → 封顶 40
        </span>
      </div>

      <div v-if="submitted.tips && submitted.tips.length" class="tips">
        <div class="tips-title">还能更好：</div>
        <div v-for="(t, i) in submitted.tips" :key="i" class="tip-item">· {{ t }}</div>
      </div>

      <h3 class="mini-h">要点命中</h3>
      <ul class="point-list">
        <li v-for="(p, i) in submitted.points" :key="i" :class="p.hit ? 'hit' : 'miss'">
          <span class="pt-mark">{{ p.hit ? '✅' : '❌' }}</span>
          <span class="pt-text">{{ p.text }}</span>
          <span class="pt-cov">{{ p.coverage }}%</span>
        </li>
      </ul>

      <details class="answer-box">
        <summary>对照参考答案（{{ submitted.category }}）</summary>
        <div class="answer-body" v-html="submitted.answerHtml"></div>
      </details>

      <p class="muted" style="margin:10px 0 0">
        <template v-if="submitted.pass">达标 → 该题已推到「稳定掌握」，并从错题本移除。</template>
        <template v-else>再想想怎么把它讲给一个完全不懂的人听，然后重讲一遍。</template>
      </p>

      <div v-if="submitted.pass" class="save-box">
        <div class="sb-title">💡 把这段沉淀成面试话术（存进 🎨 比喻库）</div>
        <input v-model="saveTopic" class="sb-input" placeholder="知识点，如：闭包" maxlength="60" />
        <textarea v-model="saveBody" class="sb-input sb-area" rows="3" placeholder="留下你刚才那句比喻 / 讲法…"></textarea>
        <div class="r-bar" style="justify-content:flex-end">
          <button class="ghost" :disabled="saving || saved" @click="save">
            {{ saved ? '已存入素材库 ✅' : (saving ? '保存中…' : '存进比喻库') }}
          </button>
        </div>
      </div>

      <div class="r-bar" style="justify-content:flex-start">
        <button class="primary" @click="next">
          {{ qi + 1 < queue.length ? '下一题' : '完成本轮' }}
        </button>
      </div>
    </div>

    <!-- 完成 / 空态 -->
    <div class="card" v-if="phase === 'done'">
      <h2 style="font-size:16px">🎉 本轮讲清结束</h2>
      <div v-if="doneCount" class="r-line" style="justify-content:flex-start">
        <span>讲清 <b>{{ doneCount }}</b> 题</span>
        <span>达标 <b>{{ passCount }}</b> 题（{{ Math.round(passCount / doneCount * 100) }}%）</span>
      </div>
      <p v-if="doneCount" class="muted">讲得清 = 真的会了。这些题已推到「稳定掌握」。</p>
      <p v-if="!doneCount && stats && stats.mastery.say < 3" class="muted">
        讲清队列是空的——因为它<b>只收「📝 复现已达标」的题</b>。<br>
        你现在「说得出」的题只有 <b>{{ stats.mastery.say }}</b> 道，先去复现关把它们说到 60 分以上。
      </p>
      <p v-else-if="!doneCount" class="muted">
        当前没有待讲清的题。去<b>复现关</b>刷达标，达标的题会自动进入这里。
      </p>
      <div class="r-bar" style="justify-content:flex-start">
        <button class="ghost" @click="load">再查一次队列</button>
      </div>
    </div>
  </template>
</template>

<style scoped>
.rubric {
  margin: 8px 0 0;
  padding-left: 18px;
  font-size: 13px;
  line-height: 1.9;
}
.rubric b {
  display: inline-block;
  min-width: 26px;
  color: #3d7eff;
}
.recall-input {
  width: 100%;
  box-sizing: border-box;
  margin: 10px 0 0;
  padding: 10px 12px;
  border: 1px solid var(--bd, #d9d9d9);
  border-radius: 8px;
  background: transparent;
  color: inherit;
  font: inherit;
  line-height: 1.7;
  resize: vertical;
}
.recall-input:focus { outline: none; border-color: #3d7eff; }
.point-hint {
  margin: 12px 0 0;
  padding: 10px 12px;
  border-radius: 8px;
  background: rgba(61, 126, 255, 0.07);
  border: 1px solid rgba(61, 126, 255, 0.22);
  font-size: 13px;
}
.ph-title { font-weight: 500; margin-bottom: 4px; }
.point-hint ol { margin: 0; padding-left: 20px; line-height: 1.85; }
.ph-note { margin-top: 6px; opacity: 0.65; font-size: 12px; }
.score-line { display: flex; align-items: baseline; gap: 8px; margin: 6px 0 8px; }
.score-line b { font-size: 30px; line-height: 1; }
.score-line .ok { color: #2e9e63; }
.score-line .no { color: #e54545; }
.dims { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; }
.dim {
  font-size: 12px;
  padding: 3px 9px;
  border-radius: 999px;
  border: 1px solid var(--bd, #e6e6e6);
}
.dim.good { color: #2e9e63; border-color: rgba(46,158,99,.4); background: rgba(46,158,99,.08); }
.dim.bad { color: #e54545; border-color: rgba(229,69,69,.35); background: rgba(229,69,69,.07); }
.tips {
  padding: 8px 12px;
  border-radius: 8px;
  background: rgba(250, 200, 80, 0.12);
  border: 1px solid rgba(186, 117, 23, 0.3);
  font-size: 13px;
  margin-bottom: 10px;
}
.tips-title { font-weight: 500; margin-bottom: 2px; }
.tip-item { line-height: 1.7; }
.mini-h { font-size: 13px; margin: 12px 0 6px; font-weight: 500; }
.point-list { list-style: none; margin: 0; padding: 0; }
.point-list li {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 6px 0;
  border-bottom: 1px dashed var(--bd, #e6e6e6);
  font-size: 13px;
}
.point-list li.miss .pt-text { color: #e54545; }
.point-list li.hit .pt-text { color: #2e9e63; }
.pt-mark { flex: 0 0 auto; }
.pt-text { flex: 1 1 auto; }
.pt-cov { flex: 0 0 auto; opacity: 0.55; font-size: 12px; }
.answer-box {
  margin-top: 14px;
  border: 1px solid var(--bd, #e6e6e6);
  border-radius: 8px;
  padding: 8px 10px;
}
.answer-box summary { cursor: pointer; font-size: 13px; }
.answer-body { margin-top: 8px; font-size: 13px; line-height: 1.75; }
.save-box {
  margin-top: 12px;
  padding: 10px 12px;
  border-radius: 8px;
  background: rgba(61, 126, 255, 0.07);
  border: 1px solid rgba(61, 126, 255, 0.25);
}
.sb-title { font-size: 13px; font-weight: 500; margin-bottom: 6px; }
.sb-input {
  width: 100%;
  box-sizing: border-box;
  margin-top: 6px;
  padding: 7px 10px;
  border: 1px solid var(--bd, #d9d9d9);
  border-radius: 8px;
  background: transparent;
  color: inherit;
  font: inherit;
}
.sb-input:focus { outline: none; border-color: #3d7eff; }
.sb-area { line-height: 1.6; resize: vertical; }
</style>

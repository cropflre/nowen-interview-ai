<script setup>
/**
 * 🧩 用得上（场景题）—— 掌握四档的第 4 档
 *
 * 前三档都在问「这个知识点是什么」；这一档只给**真实业务场景**，
 * 要你自己判断「该用哪个技术 + 为什么」。这是面试里真正的考法。
 *
 * 判分：必答关键点命中 70 + 讲了理由 15 + 篇幅 15；
 *       提到明确误区且覆盖不足一半 → 封顶 45（选错了，理由再对也不算过）。
 */
import { ref, computed, onMounted } from 'vue'
import { api } from '../api.js'
import { play } from '../sound.js'

const emit = defineEmits(['toast', 'refresh'])

const props = defineProps({
  // '' = 全部场景 | 'project' = 项目深挖（三大旗舰项目）| 'general' = 通用场景
  kind: { type: String, default: '' }
})

const loading = ref(true)
const queue = ref([])
const passLine = ref(70)
const ladder = ref(null)
const stats = ref(null)

const qi = ref(0)
const text = ref('')
const submitted = ref(null)
const startedAt = ref(0)
const records = ref([])
const busy = ref(false)

/* 追问链：主题达标后还要往下追几层 */
const mainText = ref('')
const fuTexts = ref([])
const fuResult = ref(null)

const isProject = computed(() => props.kind === 'project')

/** 结果卡标题：区分「主题达标」「进入追问」「全链通过」三种状态 */
const headVerdict = computed(() => {
  const r = submitted.value
  if (!r) return ''
  if (fuResult.value) return r.pass ? '✅ 全链通过' : '❌ 追问没全答上'
  if (!r.mainPass) return '❌ 方案还不到位'
  if (r.hasFollowups) return '🎤 主题达标 · 进入追问'
  return '✅ 选型正确'
})

const cur = computed(() => queue.value[qi.value] || null)
const phase = computed(() => (!cur.value ? 'done' : (submitted.value ? 'result' : 'question')))
const doneCount = computed(() => records.value.length)
const passCount = computed(() => records.value.filter(r => r.pass).length)
const passedTotal = computed(() => queue.value.filter(i => i.passed).length)

async function load() {
  loading.value = true
  try {
    const [q, s] = await Promise.all([api.sceneQueue(props.kind), api.recallStats()])
    queue.value = q.items || []
    passLine.value = q.passLine || 70
    ladder.value = q.ladder
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
  if (!body.text) return emit('toast', '先写下你的方案——哪怕只说大意')
  try {
    const r = await api.sceneSubmit(cur.value.code, body)
    submitted.value = r
    mainText.value = body.text
    const item = queue.value.find(i => i.code === cur.value.code)
    if (item) { item.best = Math.max(item.best || 0, r.score); item.passed = item.best >= passLine.value }
    // 有追问且主题达标 → 先不记成绩，进入追问阶段
    if (r.mainPass && r.hasFollowups) {
      fuTexts.value = r.followups.map(() => '')
      play('swoosh')
    } else {
      records.value = [...records.value, r]
      if (r.pass) play('tada')
      else play('pop')
      stats.value = await api.recallStats()
      emit('refresh')
    }
  } catch (e) {
    emit('toast', e.message)
  }
}

/** 提交追问：同一主题再交一次（主答分不变），拿到全链结论 */
async function submitFu() {
  if (!cur.value || !submitted.value) return
  const answers = fuTexts.value.map(t => String(t || '').trim())
  if (answers.some(t => !t)) return emit('toast', '每层追问都要作答——答不上就写「想不起来」，这本身就是信号')
  busy.value = true
  try {
    const r = await api.sceneSubmit(cur.value.code, { text: mainText.value, durationMs: 0, followups: answers })
    submitted.value = r
    fuResult.value = r
    records.value = [...records.value, r]
    const item = queue.value.find(i => i.code === cur.value.code)
    if (item) { item.best = Math.max(item.best || 0, r.score); item.passed = item.best >= passLine.value }
    if (r.pass) play('tada')
    else play('pop')
    stats.value = await api.recallStats()
    emit('refresh')
  } catch (e) {
    emit('toast', e.message)
  } finally {
    busy.value = false
  }
}

function next() {
  if (qi.value + 1 < queue.value.length) {
    qi.value++
    text.value = ''
    submitted.value = null
    fuTexts.value = []
    fuResult.value = null
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
    <!-- 阶梯状态 -->
    <div class="kpi" v-if="stats">
      <div><b>{{ passedTotal }}/{{ queue.length }}</b><span>{{ isProject ? '项目题已达标' : '场景已达标' }}</span></div>
      <div><b>{{ stats.scene.rate === null ? '—' : stats.scene.rate + '%' }}</b><span>场景达标率</span></div>
      <div><b>{{ stats.scene.avgScore === null ? '—' : stats.scene.avgScore }}</b><span>场景平均分</span></div>
      <div><b>{{ stats.mastery.tell }}</b><span>「讲得清」题数</span></div>
      <div><b>{{ stats.mastery.say }}</b><span>「说得出」题数</span></div>
    </div>

    <div class="card proj-intro" v-if="isProject">
      <h2 style="font-size:14px">💼 项目深挖 · 面试官追问</h2>
      <p class="muted" style="margin:4px 0 6px">
        这一组绑定你的三大旗舰项目：<b>SQL AI 审查（Monaco 内联 diff）</b> ·
        <b>pnpm monorepo 分包</b> · <b>权限转交（ApplyDataPermission）</b>。
        senior 面试里，**六成以上的时间是面试官在追问你的项目** —— 这才是主战场。
      </p>
      <p class="muted" style="margin:0">
        ⚠️ 参考解法是「**高分回答骨架**」，请按你的**真实实现**校准再讲出来 ——
        <b>别背，讲你自己的版本</b>（背的答案一被追问细节就露馅）。
      </p>
    </div>

    <div class="card" v-if="stats && stats.mastery.tell < 1">
      <p class="muted" style="margin:0">
        ⚠️ 建议先过前两档：你现在「讲得清」<b>{{ stats.mastery.tell }}</b> 题、「说得出」<b>{{ stats.mastery.say }}</b> 题。
        场景题考的是**选型与取舍**，最好在「🗣 讲清」有底子之后再来（不过想直接试也行）。
      </p>
    </div>

    <div class="card" v-if="phase === 'question' && cur">
      <div class="quiz-head">
        <div class="quiz-title">
          {{ isProject ? '💼 项目深挖' : '🧩 用得上' }}
          <span class="muted">（{{ qi + 1 }} / {{ queue.length }}）</span>
        </div>
        <div class="quiz-meta">
          <span class="tag gold">{{ cur.category }}</span>
          <span v-if="cur.best !== null" class="muted">历史最高 {{ cur.best }}</span>
          <span class="muted">关键点 × {{ cur.mustCount }}</span>
        </div>
      </div>

      <div class="scene">💼 {{ cur.scene }}</div>

      <textarea
        v-model="text"
        class="scene-input"
        rows="8"
        placeholder="你会怎么做？用哪个方案、为什么用它而不是别的？（例：用 XX，因为……）"
        @keydown.ctrl.enter="submit"
        @keydown.meta.enter="submit"
      ></textarea>

      <div class="r-bar" style="justify-content:space-between">
        <span class="muted">{{ text.trim().length }} 字 · Ctrl/⌘ + Enter 提交</span>
        <span>
          <button class="ghost" @click="next">跳过这题</button>
          <button class="primary" @click="submit">提交方案</button>
        </span>
      </div>
    </div>

    <!-- 揭晓 -->
    <div class="card" v-if="phase === 'result' && submitted">
      <div class="quiz-head">
        <div class="quiz-title">
          {{ headVerdict }}
          <span class="muted">（{{ qi + 1 }} / {{ queue.length }}）</span>
        </div>
        <div class="quiz-meta">
          <span v-if="submitted.gainedXp" class="tag gold">+{{ submitted.gainedXp }} XP</span>
          <span class="muted">历史最高 {{ submitted.best }}</span>
        </div>
      </div>

      <div class="score-line">
        <b :class="submitted.mainPass ? 'ok' : 'no'">{{ submitted.score }}</b>
        <span class="muted">/ 100（主题达标线 {{ submitted.passLine }}）<template v-if="fuResult"> · 追问均分 {{ fuResult.followupAvg }}</template></span>
      </div>

      <div class="dims">
        <span class="dim" :class="submitted.hits === submitted.total ? 'good' : 'bad'">
          关键点 {{ submitted.hits }}/{{ submitted.total }} · {{ submitted.coverScore }}/70
        </span>
        <span class="dim" :class="submitted.reasoned ? 'good' : 'bad'">
          {{ submitted.reasoned ? '✅ 讲了理由' : '❌ 没讲理由' }} · {{ submitted.reasoned ? 15 : 0 }}/15
        </span>
        <span class="dim" :class="submitted.longEnough ? 'good' : 'bad'">
          篇幅 {{ submitted.length }} 字 · {{ submitted.longEnough ? 15 : 0 }}/15
        </span>
        <span v-if="submitted.capped" class="dim bad">⚠️ 命中误区 → 封顶 45</span>
      </div>

      <h3 class="mini-h">关键点命中</h3>
      <div class="chips">
        <span v-for="(k, i) in submitted.keywords" :key="i" class="chip" :class="k.hit ? 'ok' : 'no'">
          {{ k.hit ? '✅' : '❌' }} {{ k.key }}
        </span>
      </div>

      <div v-if="submitted.pitfalls.length" class="warn">
        ⚠️ 你提到了「{{ submitted.pitfalls.join('、') }}」——它在这题里不是主选，看看参考解法里的取舍。
      </div>

      <div v-if="submitted.tips.length" class="tips">
        <div class="tips-title">还能更好：</div>
        <div v-for="(t, i) in submitted.tips" :key="i" class="tip-item">· {{ t }}</div>
      </div>

      <details class="answer-box" open>
        <summary>参考解法（{{ submitted.category }}）</summary>
        <div class="answer-body">{{ submitted.answer }}</div>
      </details>

      <!-- 追问链：主题达标后，面试官会继续往下追 -->
      <template v-if="submitted.mainPass && submitted.hasFollowups && !fuResult">
        <div class="fu-head">
          🎤 <b>面试官追问（{{ submitted.followups.length }} 层）</b>
          <span class="muted">主题达标只是第一层，全链答上才算通过</span>
        </div>
        <div v-for="(f, i) in submitted.followups" :key="i" class="fu-item">
          <div class="fu-q">追问 {{ i + 1 }}：{{ f.q }}</div>
          <textarea
            v-model="fuTexts[i]"
            class="scene-input fu-input"
            rows="3"
            placeholder="你的回答…（答不上就写「想不起来」，这本身是信号）"
          ></textarea>
        </div>
        <div class="r-bar" style="justify-content:flex-end">
          <button class="primary" :disabled="busy" @click="submitFu">{{ busy ? '判分中…' : '提交追问' }}</button>
        </div>
      </template>

      <!-- 追问结果 -->
      <template v-if="fuResult">
        <div class="fu-head" :class="fuResult.pass ? 'ok' : 'no'">
          {{ fuResult.pass ? '✅ 追问全链通过' : '❌ 追问没全答上' }}
          <span class="muted"> · 明天这题会再来找你</span>
        </div>
        <div v-for="(f, i) in fuResult.followups" :key="'fu' + i" class="fu-res" :class="f.pass ? 'ok' : 'no'">
          <div class="fu-q">
            {{ f.pass ? '✅' : '❌' }} 追问 {{ i + 1 }}：{{ f.q }}
            <span class="pt-cov">{{ f.score }} 分 · 关键点 {{ f.hits }}/{{ f.total }}</span>
          </div>
          <div class="chips" style="margin:4px 0 6px">
            <span v-for="(k, j) in f.keywords" :key="j" class="chip" :class="k.hit ? 'ok' : 'no'">
              {{ k.hit ? '✅' : '❌' }} {{ k.key }}
            </span>
          </div>
          <details class="fu-answer">
            <summary>高分答法</summary>
            <div class="fu-answer-body">{{ f.answer }}</div>
          </details>
        </div>
      </template>

      <div class="r-bar" style="justify-content:flex-start" v-if="!submitted.hasFollowups || fuResult || !submitted.mainPass">
        <button class="primary" @click="next">
          {{ qi + 1 < queue.length ? '下一题' : '完成本轮' }}
        </button>
      </div>
    </div>

    <!-- 完成 -->
    <div class="card" v-if="phase === 'done'">
      <h2 style="font-size:16px">🎉 {{ isProject ? '本轮项目深挖结束' : '本轮场景题结束' }}</h2>
      <div v-if="doneCount" class="r-line" style="justify-content:flex-start">
        <span>作答 <b>{{ doneCount }}</b> 题</span>
        <span>达标 <b>{{ passCount }}</b> 题（{{ Math.round(passCount / doneCount * 100) }}%）</span>
      </div>
      <p v-if="doneCount" class="muted">
        <template v-if="isProject">这些是面试官真会问的追问 —— 拿你达标的答案对着镜子讲一遍，比再刷十道题有用。</template>
        <template v-else>场景题问的是「你会怎么做」——这正是面试官最想听的部分。达标的题会记进看板。</template>
      </p>
      <p v-if="!doneCount" class="muted">当前没有场景题。改天再来。</p>
      <div class="r-bar" style="justify-content:flex-start">
        <button class="ghost" @click="load">再查一次</button>
      </div>
    </div>
  </template>
</template>

<style scoped>
.scene {
  margin: 12px 0 0;
  padding: 12px 14px;
  border-radius: 8px;
  background: rgba(255, 176, 32, 0.10);
  border: 1px solid rgba(186, 117, 23, 0.28);
  font-size: 14px;
  line-height: 1.75;
}
.proj-intro {
  background: rgba(61, 126, 255, 0.07);
  border-left: 3px solid rgba(61, 126, 255, 0.5);
}
.scene-input {
  width: 100%;
  box-sizing: border-box;
  margin: 12px 0 0;
  padding: 10px 12px;
  border: 1px solid var(--bd, #d9d9d9);
  border-radius: 8px;
  background: transparent;
  color: inherit;
  font: inherit;
  line-height: 1.7;
  resize: vertical;
}
.scene-input:focus { outline: none; border-color: #3d7eff; }
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
.mini-h { font-size: 13px; margin: 12px 0 6px; font-weight: 500; }
.chips { display: flex; flex-wrap: wrap; gap: 6px; }
.chip {
  font-size: 12px;
  padding: 3px 9px;
  border-radius: 999px;
  border: 1px solid var(--bd, #e6e6e6);
}
.chip.ok { color: #2e9e63; border-color: rgba(46,158,99,.4); background: rgba(46,158,99,.08); }
.chip.no { color: #e54545; border-color: rgba(229,69,69,.35); background: rgba(229,69,69,.07); }
.warn {
  margin: 10px 0 0;
  padding: 8px 12px;
  border-radius: 8px;
  background: rgba(229, 69, 69, 0.08);
  border: 1px solid rgba(229, 69, 69, 0.3);
  font-size: 13px;
  color: #c93b3b;
}
.tips {
  margin: 10px 0 0;
  padding: 8px 12px;
  border-radius: 8px;
  background: rgba(250, 200, 80, 0.12);
  border: 1px solid rgba(186, 117, 23, 0.3);
  font-size: 13px;
}
.tips-title { font-weight: 500; margin-bottom: 2px; }
.tip-item { line-height: 1.7; }
.answer-box {
  margin-top: 14px;
  border: 1px solid var(--bd, #e6e6e6);
  border-radius: 8px;
  padding: 8px 10px;
}
.answer-box summary { cursor: pointer; font-size: 13px; }
.answer-body {
  margin-top: 8px;
  font-size: 13px;
  line-height: 1.8;
  white-space: pre-wrap;
}
/* 追问链 */
.fu-head {
  margin: 14px 0 0;
  padding: 9px 12px;
  border-radius: 8px;
  font-size: 13.5px;
  background: rgba(61, 126, 255, 0.08);
  border: 1px solid rgba(61, 126, 255, 0.28);
}
.fu-head.ok { background: rgba(46,158,99,.1); border-color: rgba(46,158,99,.4); color: #1f6b45; }
.fu-head.no { background: rgba(229,69,69,.08); border-color: rgba(229,69,69,.35); color: #c93b3b; }
.fu-item { margin-top: 12px; }
.fu-q { font-size: 13.5px; font-weight: 500; line-height: 1.6; margin-bottom: 4px; }
.fu-input { margin-top: 6px; }
.fu-res {
  margin-top: 10px;
  padding: 9px 12px;
  border-radius: 8px;
  font-size: 13px;
  border: 1px solid var(--bd, #e6e6e6);
}
.fu-res.ok { border-color: rgba(46,158,99,.4); background: rgba(46,158,99,.06); }
.fu-res.no { border-color: rgba(229,69,69,.35); background: rgba(229,69,69,.05); }
.fu-answer { margin-top: 6px; }
.fu-answer summary { cursor: pointer; font-size: 12.5px; opacity: .8; }
.fu-answer-body { margin-top: 6px; line-height: 1.75; white-space: pre-wrap; opacity: .9; }
</style>

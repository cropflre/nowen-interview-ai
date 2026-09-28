<script setup>
import { ref, computed } from 'vue'
import { PROBLEMS } from './data/problems.js'
import PracticeMode from './components/PracticeMode.vue'
import TypingMode from './components/TypingMode.vue'
import FlashcardMode from './components/FlashcardMode.vue'
import ExplainMode from './components/ExplainMode.vue'
import BaguwenMode from './components/BaguwenMode.vue'
import GameShell from './game/GameShell.vue'

const appTab = ref('game')        // game=闯关/复习 | lab=练习场
const gameTab = ref('map')        // 闯关内的子页：map | review | ...
const cur = ref(0)

/** 顶层入口跳转：闯关 / 复习（复习需要登录态，故复用 GameShell） */
function goGame(t) {
  gameTab.value = t
  appTab.value = 'game'
}
const mode = ref('practice')
const problem = computed(() => PROBLEMS[cur.value])

const MODES = [
  { k: 'practice', label: '✍️ 做题（判分）' },
  { k: 'typing', label: '⌨️ 默写（打字）' },
  { k: 'flash', label: '🎴 闪卡（背钩子）' },
  { k: 'explain', label: '📖 讲解（通俗）' },
  { k: 'baguwen', label: '📚 八股文（背诵/中文默写）' }
]

// 点左侧题目：切到当前题；闪卡/八股文是全局的，点了就回「做题」给出反馈
function pick(i) {
  cur.value = i
  if (mode.value === 'flash' || mode.value === 'baguwen') mode.value = 'practice'
}
</script>

<template>
  <div class="wrap">
    <header>
      <h1>前端修炼 · Vue3</h1>
      <div class="meta">🗺 闯关：地图 / 关卡 / 结算（连后端 SQLite）　｜　🧪 练习场：做题 / 默写 / 闪卡 / 讲解 / 八股文</div>
      <div class="apptabs">
        <button :class="{ active: appTab === 'game' && !['review', 'recall', 'explain', 'scene', 'project', 'metaphor'].includes(gameTab) }" @click="goGame('map')">🗺 闯关</button>
        <button :class="{ active: appTab === 'game' && gameTab === 'review' }" @click="goGame('review')">🔁 复习</button>
        <button :class="{ active: appTab === 'game' && gameTab === 'recall' }" @click="goGame('recall')">📝 复现</button>
        <button :class="{ active: appTab === 'lab' }" @click="appTab = 'lab'">🧪 练习场</button>
      </div>
    </header>

    <GameShell v-if="appTab === 'game'" :initial-tab="gameTab" />

    <template v-else>
    <div class="hint">别让 AI 替你写。可问"我错在哪"，别问"帮我写"。写不出来先空着点运行，看 ❌ 的提示再想。</div>

    <div class="layout">
      <nav class="nav">
        <button
          v-for="(p, i) in PROBLEMS"
          :key="i"
          :class="{ active: i === cur }"
          @click="pick(i)"
        >{{ p.title }}</button>
      </nav>

      <main class="main">
        <div class="modeline">
          <button
            v-for="m in MODES"
            :key="m.k"
            :class="{ active: mode === m.k }"
            @click="mode = m.k"
          >{{ m.label }}</button>
        </div>

        <PracticeMode v-if="mode === 'practice'" :key="'p' + cur" :problem="problem" />
        <TypingMode v-else-if="mode === 'typing'" :problems="PROBLEMS" :start-index="cur" />
        <FlashcardMode v-else-if="mode === 'flash'" />
        <ExplainMode v-else-if="mode === 'explain'" :key="'e' + cur" :problem="problem" />
        <BaguwenMode v-else-if="mode === 'baguwen'" />
      </main>
    </div>
    </template>

    <footer>梁智钊 · 前端修炼 Vue3 · 闯关（地图/关卡/结算 + SQLite 后端）· 练习场 5 种模式</footer>
  </div>
</template>

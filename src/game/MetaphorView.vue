<script setup>
/**
 * 🎨 打比方素材库
 *
 * 起因：记忆方法的阶梯里，「讲给别人听」是留存最高的一档。
 * 你讲清一个知识点时用的那个比喻，本身就是**面试时能直接说出口的话术**。
 * 这个页面就是把它沉淀下来 —— 不判断对错，只做沉淀与检索。
 */
import { ref, computed, onMounted } from 'vue'
import { api } from '../api.js'

const emit = defineEmits(['toast'])

const loading = ref(true)
const items = ref([])
const topics = ref([])
const q = ref('')

const topic = ref('')
const body = ref('')
const busy = ref(false)

const count = computed(() => items.value.length)

async function load() {
  loading.value = true
  try {
    const d = await api.metaphors(q.value.trim())
    items.value = d.items || []
    topics.value = d.topics || []
  } catch (e) {
    emit('toast', e.message)
  } finally {
    loading.value = false
  }
}

async function add() {
  const t = topic.value.trim()
  const b = body.value.trim()
  if (!t) return emit('toast', '先写「知识点」，比如「闭包」')
  if (!b) return emit('toast', '把比喻写出来——哪怕一句话')
  busy.value = true
  try {
    await api.addMetaphor({ topic: t, body: b, source: 'manual' })
    topic.value = ''
    body.value = ''
    await load()
    emit('toast', '已存进素材库 ✅')
  } catch (e) {
    emit('toast', e.message)
  } finally {
    busy.value = false
  }
}

async function del(id) {
  try {
    await api.delMetaphor(id)
    await load()
  } catch (e) {
    emit('toast', e.message)
  }
}

function fmt(s) {
  return String(s || '').replace('T', ' ').slice(0, 16)
}

onMounted(load)
defineExpose({ load })
</script>

<template>
  <div v-if="loading" class="center">加载中…</div>
  <template v-else>
    <div class="kpi">
      <div><b>{{ count }}</b><span>条比喻</span></div>
      <div><b>{{ topics.length }}</b><span>覆盖知识点</span></div>
    </div>

    <div class="card">
      <h2 style="font-size:14px">➕ 记一条你的比喻</h2>
      <p class="muted" style="margin:4px 0 8px">
        好比喻的标准：**一个完全不懂的人也能听懂**，而且能对上真实机制（别为了好懂而讲错）。
      </p>
      <input v-model="topic" class="mf-input" placeholder="知识点，如：闭包 / 事件循环 / 事件委托" maxlength="60" />
      <textarea
        v-model="body"
        class="mf-input mf-area"
        rows="3"
        placeholder="你的比喻，如：闭包就像一个随身背包——函数走到哪，都背着定义时那个环境里的变量。"
      ></textarea>
      <div class="r-bar" style="justify-content:flex-end">
        <button class="primary" :disabled="busy" @click="add">{{ busy ? '保存中…' : '存进素材库' }}</button>
      </div>
    </div>

    <div class="card">
      <div class="mf-head">
        <h2 style="font-size:14px">📚 我的素材库（{{ count }}）</h2>
        <span class="mf-search">
          <input v-model="q" class="mf-input" placeholder="搜索知识点或内容…" @keyup.enter="load" />
          <button class="ghost" @click="load">搜索</button>
        </span>
      </div>

      <div v-if="topics.length" class="chips" style="margin:8px 0">
        <span v-for="t in topics" :key="t.topic" class="chip">{{ t.topic }} × {{ t.n }}</span>
      </div>

      <div v-if="!items.length" class="muted" style="padding:8px 0">
        还没有素材。等你在「🗣 讲清」里讲出一道题、或者现在随手写一条，都会出现在这里。
      </div>

      <div v-for="m in items" :key="m.id" class="mf-item">
        <div class="mf-topic">
          {{ m.topic }}
          <span v-if="m.source === 'explain'" class="mf-src">来自讲清关</span>
          <button class="mf-del" title="删除" @click="del(m.id)">✕</button>
        </div>
        <div class="mf-body">{{ m.body }}</div>
        <div class="mf-time">{{ fmt(m.created_at) }}</div>
      </div>
    </div>
  </template>
</template>

<style scoped>
.mf-input {
  width: 100%;
  box-sizing: border-box;
  margin-top: 6px;
  padding: 8px 10px;
  border: 1px solid var(--bd, #d9d9d9);
  border-radius: 8px;
  background: transparent;
  color: inherit;
  font: inherit;
}
.mf-input:focus { outline: none; border-color: #3d7eff; }
.mf-area { line-height: 1.6; resize: vertical; }
.mf-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
.mf-search { display: flex; gap: 6px; align-items: center; min-width: 220px; flex: 0 1 280px; }
.mf-search .mf-input { margin-top: 0; }
.chips { display: flex; flex-wrap: wrap; gap: 6px; }
.chip {
  font-size: 12px;
  padding: 3px 9px;
  border-radius: 999px;
  border: 1px solid var(--bd, #e6e6e6);
  opacity: 0.85;
}
.mf-item {
  padding: 10px 0;
  border-bottom: 1px dashed var(--bd, #e6e6e6);
}
.mf-topic {
  font-size: 13px;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 8px;
}
.mf-src {
  font-size: 11px;
  font-weight: 400;
  padding: 1px 7px;
  border-radius: 999px;
  border: 1px solid rgba(46,158,99,.4);
  color: #2e9e63;
}
.mf-del {
  margin-left: auto;
  border: none;
  background: transparent;
  color: inherit;
  opacity: 0.35;
  cursor: pointer;
  font-size: 13px;
}
.mf-del:hover { opacity: 0.9; color: #e54545; }
.mf-body {
  font-size: 13px;
  line-height: 1.75;
  margin: 5px 0 3px;
  white-space: pre-wrap;
}
.mf-time { font-size: 11px; opacity: 0.45; }
</style>

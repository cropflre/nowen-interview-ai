<script setup>
/**
 * ⚙️ AI 模型设置
 *
 * 支持国内外主流模型（统一走 OpenAI 兼容协议，Anthropic 单独适配）：
 *   国内：DeepSeek / 通义千问 / Kimi / 智谱 GLM / 豆包
 *   国外：OpenAI / Anthropic / Gemini
 * Key 保存在本机 SQLite，接口只返回掩码 —— 前端永远拿不到明文。
 * 这是「AI 模拟面试官」的前置能力。
 */
import { ref, computed, onMounted } from 'vue'
import { api } from '../api.js'

const emit = defineEmits(['close', 'saved', 'toast'])

const presets = ref({})
const loading = ref(true)
const form = ref({ provider: '', baseUrl: '', model: '', apiKey: '' })
const keyMask = ref('')
const hasKey = ref(false)
const testing = ref(false)
const testResult = ref(null)
const saving = ref(false)

const groups = computed(() => {
  const cn = [], gl = []
  Object.entries(presets.value).forEach(([k, p]) => {
    if (k === 'custom') return
    ;(p.region === 'cn' ? cn : gl).push({ key: k, ...p })
  })
  return [
    { title: '🇨🇳 国内模型（网络直连，推荐）', items: cn },
    { title: '🌍 国外模型（可能需要代理）', items: gl }
  ]
})

function pick(key) {
  const p = presets.value[key]
  if (!p) return
  form.value.provider = key
  form.value.baseUrl = p.baseUrl || ''
  form.value.model = p.model || ''
  testResult.value = null
}

async function load() {
  loading.value = true
  try {
    const d = await api.aiConfig()
    presets.value = d.presets || {}
    if (d.config) {
      form.value = { provider: d.config.provider, baseUrl: d.config.baseUrl, model: d.config.model, apiKey: '' }
      keyMask.value = d.config.keyMask || ''
      hasKey.value = !!d.config.hasKey
    } else {
      pick('deepseek')
    }
  } catch (e) {
    emit('toast', e.message)
  } finally {
    loading.value = false
  }
}

async function test() {
  testing.value = true
  testResult.value = null
  try {
    const r = await api.aiTest({ provider: form.value.provider, baseUrl: form.value.baseUrl, model: form.value.model, apiKey: form.value.apiKey })
    testResult.value = r
  } catch (e) {
    testResult.value = { ok: false, error: e.message }
  } finally {
    testing.value = false
  }
}

async function save() {
  saving.value = true
  try {
    await api.aiSave({
      provider: form.value.provider,
      baseUrl: form.value.baseUrl,
      model: form.value.model,
      apiKey: form.value.apiKey
    })
    emit('saved')
    emit('close')
  } catch (e) {
    emit('toast', e.message)
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="mask" @click.self="emit('close')">
    <div class="modal">
      <header class="m-head">
        <b>⚙️ AI 模型设置</b>
        <button class="x" @click="emit('close')">✕</button>
      </header>

      <div v-if="loading" class="center">加载中…</div>
      <template v-else>
        <div v-for="g in groups" :key="g.title" class="grp">
          <div class="grp-t">{{ g.title }}</div>
          <div class="cards">
            <button
              v-for="p in g.items"
              :key="p.key"
              class="pcard"
              :class="{ on: form.provider === p.key }"
              @click="pick(p.key)"
            >
              <span class="pc-name">{{ p.label }}</span>
              <span class="pc-model">{{ p.model || '需手填模型名' }}</span>
            </button>
          </div>
        </div>

        <div class="grp" v-if="presets.custom">
          <div class="grp-t">🛠 自定义</div>
          <button class="pcard wide" :class="{ on: form.provider === 'custom' }" @click="pick('custom')">
            <span class="pc-name">{{ presets.custom.label }}</span>
            <span class="pc-model">任何 OpenAI 兼容的网关 / 中转 / 私有部署</span>
          </button>
        </div>

        <div class="fld">
          <label>接口地址 Base URL</label>
          <input v-model="form.baseUrl" placeholder="https://api.deepseek.com/v1" />
        </div>
        <div class="fld">
          <label>模型名</label>
          <input v-model="form.model" placeholder="deepseek-chat" />
        </div>
        <div class="fld">
          <label>API Key</label>
          <input
            v-model="form.apiKey"
            type="password"
            :placeholder="hasKey ? '已保存（' + keyMask + '）——留空则不修改' : '粘贴你的 Key'"
          />
          <div class="hint">Key 只存本机 SQLite，接口只返回掩码；上传/分享代码时注意不要带数据库文件。</div>
        </div>

        <div v-if="testResult" class="tres" :class="testResult.ok ? 'ok' : 'no'">
          <template v-if="testResult.ok">
            ✅ 连通成功 · {{ testResult.latencyMs }}ms · 回复「{{ testResult.sample }}」
          </template>
          <template v-else>
            ❌ {{ testResult.error }}
            <div class="tres-tip">国外模型在本机网络下常见超时，换国内模型或确认代理；401 = Key 不对；404 = Base URL 或模型名不对。</div>
          </template>
        </div>

        <footer class="m-foot">
          <button class="ghost" :disabled="testing" @click="test">{{ testing ? '测试中…' : '测试连通' }}</button>
          <button class="primary" :disabled="saving" @click="save">{{ saving ? '保存中…' : '保存' }}</button>
        </footer>
      </template>
    </div>
  </div>
</template>

<style scoped>
.mask {
  position: fixed; inset: 0; background: rgba(15, 20, 30, .45);
  display: flex; align-items: flex-start; justify-content: center;
  padding: 40px 16px; z-index: 60; overflow: auto;
}
.modal {
  width: 100%; max-width: 620px; background: #fff; border-radius: 12px;
  border: 1px solid var(--line, #e6e6e6); padding: 16px 18px; box-shadow: 0 12px 40px rgba(0,0,0,.16);
}
.m-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; font-size: 15px; }
.x { border: none; background: transparent; cursor: pointer; font-size: 15px; opacity: .5; }
.x:hover { opacity: 1; }
.grp { margin-bottom: 14px; }
.grp-t { font-size: 12.5px; opacity: .65; margin-bottom: 6px; }
.cards { display: flex; gap: 8px; flex-wrap: wrap; }
.pcard {
  display: flex; flex-direction: column; gap: 2px; text-align: left;
  border: 1px solid var(--line, #e6e6e6); background: #fff; border-radius: 9px;
  padding: 8px 11px; cursor: pointer; font-family: inherit; min-width: 132px;
}
.pcard:hover { border-color: #9db8e8; }
.pcard.on { border-color: #2b6de5; background: rgba(43,109,229,.07); box-shadow: inset 0 0 0 1px #2b6de5; }
.pc-name { font-size: 13px; font-weight: 500; }
.pc-model { font-size: 11.5px; opacity: .55; }
.pcard.wide { width: 100%; }
.fld { margin-bottom: 10px; }
.fld label { display: block; font-size: 12.5px; opacity: .7; margin-bottom: 4px; }
.fld input {
  width: 100%; box-sizing: border-box; padding: 8px 10px;
  border: 1px solid var(--line, #d9d9d9); border-radius: 8px; font: inherit; background: #fff;
}
.fld input:focus { outline: none; border-color: #2b6de5; }
.hint { font-size: 11.5px; opacity: .55; margin-top: 4px; line-height: 1.5; }
.tres { margin: 6px 0 4px; padding: 9px 12px; border-radius: 8px; font-size: 13px; line-height: 1.6; }
.tres.ok { background: #eaf7e6; border-left: 3px solid #2aa515; color: #1f5c11; }
.tres.no { background: #fdeaea; border-left: 3px solid #e54545; color: #7a1f1f; }
.tres-tip { margin-top: 4px; font-size: 12px; opacity: .8; }
.m-foot { display: flex; justify-content: flex-end; gap: 8px; margin-top: 12px; }
.m-foot .primary, .m-foot .ghost {
  border-radius: 8px; padding: 8px 16px; font-size: 13.5px; cursor: pointer; font-family: inherit;
}
.m-foot .primary { border: 1px solid var(--brand, #2b6de5); background: var(--brand, #2b6de5); color: #fff; }
.m-foot .ghost { border: 1px solid var(--line, #d9d9d9); background: #fff; }
.center { text-align: center; padding: 20px 0; opacity: .7; }
</style>

# JS 基础回炉 · Vue3 在线练习

把单文件练习页重构成了 **Vue 3 + Vite** 项目。五种模式：**做题判分 / 打字默写 / 闪卡背钩子 / 通俗讲解 / 八股文（背诵 + 中文默写）**。

## 启动

```bash
cd "C:\Program Files\Github开源项目\js-basics-vue"
npm install        # 或 pnpm install
npm run dev        # 默认 http://localhost:5180
```

构建：`npm run build` → 产物在 `dist/`。

## 目录结构

```
js-basics-vue/
├─ index.html
├─ vite.config.js
├─ package.json
└─ src/
   ├─ main.js
   ├─ style.css
   ├─ App.vue                      # 布局 + 当前题目 + 模式切换
   ├─ data/
   │   ├─ problems.js              # 7 关题目（starter / tests / ref / concept / explain）
   │   ├─ flashcards.js            # 16 张闪卡
   │   └─ baguwen.js               # 前端八股文 110 题（10 分类，含星标与纯文本答案）
   ├─ composables/
   │   └─ useRunner.js             # new Function 执行用户代码 + 测试，返回判分/日志
   └─ components/
       ├─ ConceptPanel.vue         # 概念讲解（details 折叠）
       ├─ PracticeMode.vue         # ✍️ 做题：写代码 → 运行 → 自动判分
       ├─ TypingDrill.vue          # ⌨️ 通用打字默写（代码 / 中文都支持，含 IME 处理）
       ├─ TypingMode.vue           # ⌨️ 打字默写 · 代码（选题 + 复用 TypingDrill）
       ├─ FlashcardMode.vue        # 🎴 闪卡：翻面看钩子
       ├─ ExplainMode.vue          # 📖 讲解：通俗思路
       └─ BaguwenMode.vue          # 📚 八股文：背诵（问答）+ 中文默写（手打答案）
```

## 内容从哪来

`src/data/problems.js` 与 `flashcards.js` 是从单文件 HTML 版**自动抽取**生成的（保持一致）。
要改题目内容，直接编辑这两个文件即可。

## 中文手打支持

`TypingDrill.vue` 处理了中文输入法（IME）：

- 监听 `compositionstart / compositionend`，**拼音上屏过程中不参与判分**，避免"打字时一片红"。
- 输入框文本实时保留（v-model 换成 `:value` + `@input`，避免打断输入法）。
- 逐字比对、进度、准确率、用时、最长连续正确——中文和代码都用同一套。

## 相比单文件版的改进

- 模式切换、当前题目用 Vue 响应式管理，**不再靠手写 DOM 操作**（顺带修掉了"点 tab 没变化"的问题）。
- 提词框 / 输入框拆成两个独立组件区块。
- 点左侧题目时：闪卡模式会自动回到「做题」，避免"点了没反应"。

## 提醒

练习时**不要让 AI 替你写代码**。可以问"我错在哪"，不要问"帮我写"。

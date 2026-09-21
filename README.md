# Nowen Interview AI · 前端技术面试训练 MVP

基于 **Node.js + React + SQLite** 的本地优先面试训练工具。当前仓库先交付「前端技术面试」模块，不包含真正的 AI 模型调用或语音功能。

## 功能

- 面试大厅：JavaScript/TypeScript、React、浏览器与网络、工程化实战、AI 应用前端及综合方向。
- 15 道人工编写的核心题，每道题附 2 轮连续追问；根据回答中遗漏的关键点生成针对性的补充提示。
- 完整文字答题流程，Ctrl/⌘ + Enter 提交，允许输入「不会」；题目切换由服务端维护，阻止重复提交。
- 面试结束后展示每题原始回答、命中及未命中的预设关键点，自动形成复盘建议；可提前结束。
- SQLite 持久化面试记录；刷新页面可恢复正在进行的面试，最近 30 场记录可查。
- 本地开发默认仅监听 127.0.0.1，前后端同源代理；题目评价规则在面试结束前不下发。

**评价边界：** 当前仅做预设关键词检查，不是语义 AI 评分。关键词命中不等于事实正确，关键词遗漏也不等于回答错误，更不代表面试通过概率。

## 运行要求

Node.js >= 22.13（`node:sqlite` 在部分版本中仍有实验性警告），npm。

```bash
npm install
npm run dev
```

打开 http://127.0.0.1:5173 。后端默认 http://127.0.0.1:3001，Vite 代理 `/api`。

```bash
npm test
npm run build
npm start
```

生产构建后运行 `npm start`，打开 http://127.0.0.1:3001 。SQLite 默认存储在 `data/interview.db`，可通过 `DATA_DIR` 调整目录；请自行备份该目录。端口可通过 `PORT` 修改。

## 结构

- `src/`：React 面试大厅、答题与复盘页面。
- `server/questions.mjs`：人工维护的题库和检查要点。
- `server/core.mjs`：SQLite 数据模型、面试状态机、反馈逻辑。
- `server/index.mjs`：Node HTTP API、生产静态文件服务。
- `server/core.test.mjs`：节点测试及 HTTP 集成测试。

## API

`GET /api/health`、`GET /api/catalog`、`GET /api/sessions`、`POST /api/sessions`（`{ "track": "react" }`）、`GET /api/sessions/:id`、`POST /api/sessions/:id/answers`（`{ "turnId": 1, "answer": "..." }`）、`POST /api/sessions/:id/finish`。

## 当前限制与后续计划

当前版本是单人本地学习工具，**没有账号认证，不应直接暴露公网或共享局域网**。题库顺序固定，尚无随机组卷。后续适合添加登录与数据隔离、AI Provider（服务端持有密钥）、真实语义评价和证据引用、语音模拟、记忆调度、知识点变式题、项目简历深挖与适配多用户的部署方案。

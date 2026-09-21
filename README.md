# Nowen Interview AI · CODE QUEST

**V0.9.0 本机原型**：React + Node.js + SQLite 的前端闯关、文字模拟面试、间隔记忆与代码修复训练游戏。默认不启用 AI 和用户账户，保持旧版单人数据不变。尚不适合直接开放公网。

## 当前玩法

- **世界 01：JavaScript 森林**：作用域、闭包、异步、代码侦探、事件循环 BOSS，共五关 15 题。
- **世界 02：React 框架群岛**：状态、副作用、列表 key、性能及组件架构 BOSS，共五关 15 题，森林 BOSS 通关后解锁。
- **成长循环**：星级、XP、关卡进度、世界地图、成就、剧情、每日修炼、薄弱知识心魔讨伐；SQLite 保存且奖励不重复发放。
- **记忆中心**：15 条内置面试知识点与间隔复习，旧版 110 题可选导入；V0.9 可另导入 12 条进阶记忆卡。先独立回答，再显示参考和进行自评；自评并非客观正确率。
- **代码工坊**：两道完整函数编辑修复题，使用语法树进行静态结构检查并持久化草稿；另有三个补丁选择题。**不执行用户 JavaScript，结构检查不是语义正确性保证。**
- **规则模拟面试**：五个技术方向及综合，15 道人工编写的核心题，每题两轮追问；关键词覆盖只作为练习清单，不能预测面试结果。
- **V0.8 可选 AI 面试**：服务端配置兼容 OpenAI Chat Completions 的供应方，玩家明确同意后，基于刚才的回答动态追问和生成文字复盘；超时回退人工追问，不输出伪造的能力分数。
- **V0.9 可选本机账户**：首次账户创建、登录/退出、密码哈希、会话撤销；每个账户独立存储面试、XP、游戏和复习 SQLite。默认继续原有 `local` 模式。

## 启动

Node.js >=22.13，npm：

```bash
npm install
npm run dev
```

开发界面 `http://127.0.0.1:5173`，API `http://127.0.0.1:3001`；生产本机模式使用 `npm run build && npm start`，访问 `http://127.0.0.1:3001`。默认数据库为 `data/interview.db`；`DATA_DIR` 可指定数据目录。变更前请先备份数据库。

## V0.8 与 V0.9 配置

**AI 默认关闭。** 由启动服务的终端设置 `AI_API_URL`（完整 HTTPS Chat Completions URL）、`AI_MODEL` 与可选 `AI_API_KEY`，再次启动即可在「🤖 AI 面试」中使用。只有在明确设置 `AI_ALLOW_HTTP_LOCAL=1` 且目标为回环地址时才接受本机 HTTP 模型。绝不要在前端配置或提交密钥。用户回答会发送到自选供应方，需核查其数据政策。

**账户模式默认关闭。** 设置 `AUTH_MODE=accounts` 再启动，只允许监听本机回环地址。首次从本机页面创建账户，后续用户通过 `npm run account -- create <username>` 添加。账号数据与原始旧版 `data/interview.db` 分开，不自动迁移。原始进度转移到新账户需要先停止应用、备份，再用 `npm run account -- migrate <username> [old.db] --confirm`；目标账户必须尚无存档，绝不覆盖既有记录。备份工具 `npm run backup` 与 `npm run restore -- ... --confirm` 可继续用于玩家数据库；账户模式还需安全保存 `auth.sqlite` 与 `users/` 数据。**不要直接开放局域网或公网。**

**12 条进阶知识卡需要主动导入**：`npm run bank:seed`（默认本地旧库）或 `npm run bank:seed -- /absolute/path/interview.db`。已存在的题卡及学习记录不会被覆盖。旧八股题库导入仍为 `npm run import:legacy -- /absolute/path/to/old/src/data/baguwen.js`，重复导入不清空历史；导入前停止应用并备份。

具体 Windows PowerShell、Linux/macOS 配置、账户迁移步骤和安全边界，请阅读 **[V0.8–V0.9 使用及数据迁移文档](docs/V0.8-V0.9.md)**。此前的 [V0.6–V0.7 数据与双世界文档](docs/V0.6-V0.7.md)、[代码工坊文档](docs/CODE_WORKSHOP.md) 与 [成长玩法说明](docs/PROGRESSION.md) 继续有效。

## 测试

```bash
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

GitHub Actions 自动进行 Node 单元/HTTP 测试、Vite 构建和真实 Chromium E2E。验证范围包含双世界关卡与重复奖励保护、备份恢复、时区边界、AI mock 服务生成/降级、账户 API 数据隔离、账号迁移、题库幂等和账户/AI 页面流程。**测试中的模型是假服务，不代表已测试真实供应方的模型质量。**

## 尚未实现

真正运行用户代码的隔离沙箱、客观 AI 语义正确率、语音面试、工程之城、跨设备同步、邮件找回、完整公网多租户安全防护、完整移动设备矩阵和正式 V1.0 Release，均不在当前交付范围。游戏 XP 和星级不代表真实职业能力或招聘结论。

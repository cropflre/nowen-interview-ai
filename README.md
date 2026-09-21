# Nowen Interview AI · CODE QUEST

以**闯关游戏 + 前端模拟面试 + 间隔记忆 + 代码修复训练**为核心的本地优先学习游戏。技术栈 Node.js + React + SQLite。当前不接入 AI 模型；面试追问为人工编写，关键词检查与代码结构检查都不等于实际面试通过率或程序语义正确性。

## V0.5：可编辑代码工坊

顶部导航「⌨️ 代码工坊」已开放两道可编辑修复题：React 定时器旧闭包、异步搜索结果竞态。需先通关 JavaScript 森林第四关「代码侦探」解锁。进入工坊后，直接修改完整函数，可自动/手动保存草稿、提交查看逐项语法与 AST 结构反馈；提交及草稿保存在 SQLite，刷新后可恢复。每题首次结构检查通过获得 75 XP，重复提交不会重复领取。未通过的知识关联原有记忆队列。

**安全和教学边界：** 解析器仅解析 JavaScript 源码，不在服务端执行玩家代码；结构通过不代表真实测试通过，更不代表代码安全。详细玩法、API 和验收说明参见 [V0.5 代码工坊文档](docs/CODE_WORKSHOP.md)。

## V0.4：成长与挑战

保留技能树、关卡剧情、成就和静态补丁选择副本，详情见 [成长与挑战文档](docs/PROGRESSION.md)。V0.5 是新增编辑训练模式，并未替换原有副本。

## V0.3：每日修炼与心魔讨伐

- **世界地图**：默认首页。JavaScript 森林可进入并继续已有五关进度；框架群岛和工程之城标注「规划中」，尚未开放。
- **每日修炼**：根据 SQLite 中真实关卡通关、复习日志、完整面试和心魔净化事件，提供四项每日任务，分别奖励 25/20/40/60 XP；服务端事务与 `game_rewards` 唯一键防刷。提前结束面试不算完成。当前按 UTC 自然日重置（北京时间每天 08:00）。
- **心魔讨伐**：从到期薄弱知识生成 1–3 张卡，使用同一套记忆引擎「独立作答→揭晓→自评→间隔调度」。完成状态可从 SQLite 恢复，遗忘后继续保留复习计划；自评不是客观正确率。

## V0.2：JavaScript 森林与面试/记忆核心

- 五关主线：作用域、闭包陷阱、异步迷宫、代码侦探、事件循环守卫者 BOSS。关卡至少答对 2/3 题解锁下一关，全对获得第二颗星，跨天延迟复习对应知识后获得第三颗记忆星。星级不是面试能力证书。
- 每关仅下发当前题目与选项；回答后才展示答案。SQLite 保存未完成挑战、历史记录、XP 和奖励账本。每关首通 100 XP、BOSS 首通 300 XP，首次全对额外 20/60 XP；重复挑战不重复领取首次奖励。
- 面试大厅保留 JavaScript/TypeScript、React、浏览器/网络、工程化、AI 前端与综合方向。15 道核心题，每题两轮人工编写的追问；支持作答、刷新恢复、复盘和最近 30 场记录。
- 统一知识库默认创建 15 条面试知识点，可选导入旧《前端修炼·闯关》110 道八股题，标记 `legacy-unreviewed`。记忆中心支持搜索、到期、新学、先回答再揭晓、自评和 1/3/7/14/30 天间隔调度。

## 启动与测试

要求 Node.js >=22.13 和 npm；部分 Node 22 版本会对 `node:sqlite` 显示实验性提示。

```bash
npm install
npm run dev
```

开发网页：http://127.0.0.1:5173；API 默认 http://127.0.0.1:3001。生产模式：

```bash
npm test
npm run build
npm start
```

生产地址：http://127.0.0.1:3001。运行真实 Chromium 冒烟测试（请先构建）：

```bash
npx playwright install chromium
npm run test:e2e
```

CI 会安装 Chromium 与系统依赖，再执行 Node 测试、Vite 生产构建和浏览器端编辑工坊冒烟测试。注意浏览器 E2E 目前覆盖工坊入口、编辑、提交、奖励、刷新恢复、模式切换与窄屏入口，并不覆盖全部游戏地图或跨天记忆流程。

数据库默认为 `data/interview.db`，通过 `DATA_DIR` 修改目录。更新前备份 SQLite 数据库及 WAL 文件。

## 旧版题库导入（可选）

从旧 ZIP 解压 `src/data/baguwen.js`：

```bash
npm run import:legacy -- /absolute/path/to/old/src/data/baguwen.js
```

第二参数可选目标数据库文件。导入脚本用 JSON.parse 解析已知格式，不执行旧代码，生成稳定 ID；重复导入不清空学习记录。操作前停止服务、备份数据库、确认目标数据库路径。不要复制旧工程不安全的 Token 登录或用户代码执行器。

## 核心 API

- `GET /api/game/world`；`POST /api/game/stages/:stageId/start`；`GET /api/game/attempts/:id`；`POST /api/game/attempts/:id/answer`。
- `GET /api/quest/daily`；`POST /api/quest/daily/:taskId/claim`；`POST /api/quest/demon/start`；`GET /api/quest/demon/:id`；`POST /api/quest/demon/:id/advance`。
- `GET /api/editor`；`GET /api/editor/:id`；`PUT /api/editor/:id/draft`；`POST /api/editor/:id/submit`，草稿和提交请求体为 `{ "source": "..." }`。
- 面试：`GET /api/catalog`、`GET/POST /api/sessions`、`GET /api/sessions/:id`、`POST /api/sessions/:id/answers`、`POST /api/sessions/:id/finish`。
- 知识与记忆：`GET /api/knowledge`、`GET /api/review/dashboard`、`GET /api/review/queue`、`POST /api/review/attempts`、`GET /api/review/attempts/:id`、`POST /api/review/attempts/:id/reveal`、`POST /api/review/attempts/:id/complete`。

**部署边界：项目暂时没有账户认证或多用户隔离，只适合本机单人使用，不要直接开放公网或共享局域网。** 尚未实现真正 AI 语义评价、语音面试、多区域地图、动态 BOSS 或安全的自由代码执行。规则检查、游戏星级不代表实际求职结果。

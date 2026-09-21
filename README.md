# Nowen Interview AI · CODE QUEST

以**闯关游戏 + 前端模拟面试 + 间隔记忆**为核心的本地优先训练工具。技术栈：Node.js + React + SQLite。当前不调用 AI 模型；面试追问为人工编写，关键词检查不等于技术正确性或面试通过率。

## V0.3：每日修炼与心魔讨伐（默认首页）

- **世界地图**：现在默认进入世界地图；JavaScript 森林可以进入并继续已有 5 关进度；框架群岛与工程之城明确标注「规划中」，暂不假装已经开放。
- **每日修炼**：基于 SQLite 中当天真实的关卡通关、复习日志、完整面试及心魔净化事件，提供 4 项可独立领取的任务。奖励分别为 25/20/40/60 XP，每项每天最多一次，由服务端事务和 `game_rewards` 唯一键保证幂等。重玩通关也算当天冒险；**主动提前结束面试不算完成**。休息日不扣经验或进度。
- **心魔图鉴**：根据到期的薄弱知识生成 1–3 张卡的讨伐，沿用现有记忆引擎的独立作答→揭晓参考→人工核对与自评→间隔调度。不另造一套知识、答案或复习记录；刷新可恢复未完成讨伐。全部核对通过才计入今日净化任务，遗忘则保留为后续复习。任何自评均不等同于事实正确率。
- **数据延续**：现有面试、记忆、游戏 SQLite 表保持不变，新增 `demon_encounters` 表用于讨伐流程。已有的 `game_rewards` 继续记录 XP 防刷。适用于旧数据库的 `CREATE TABLE IF NOT EXISTS` 增量建表，不清空原有记录。
- **日期边界**：为与当前记忆/游戏引擎一致，当前每日任务以 **UTC 自然日**计算并在界面明确标识。北京时间对应每日 08:00 重置；后续统一时间区设置前，不应把它理解为当地零点。

## V0.2：JavaScript 森林（游戏主线）

- 五关完整主线：作用域、闭包陷阱、异步迷宫、代码侦探、事件循环守卫者 BOSS。每关三道经过人工设计的客观题，其中包含代码输出与调试场景。
- 解锁：第一关开放；一关至少答对 2/3 题获得一星并解锁下一关。全部答对获得二星；对应知识点通过跨天复习后，地图显示第三颗记忆星。星级只是游戏表现，不是面试能力证书。
- 服务器判题：当前题只下发题干和选项，不下发正确答案；每道题只能提交一次，提交后才展示解说。解释输入可选、保留原文但不参与自动评分。
- 持久化：SQLite 保存未完成挑战、历史尝试、最佳星级、XP 和奖励账本；刷新页面从未结束的回合恢复。
- 经济：每关首通 100 XP，BOSS 首通 300 XP；首次全对额外增加 20/60 XP。重复挑战不能刷首通或首次全对奖励；结算通过数据库事务和唯一奖励键完成。
- 心魔联动：答错自动添加相应知识点到复习队列，不覆盖已存在的学习计划；游戏主页直接通向记忆中心和模拟面试大厅。
- 地图支持 PC 和移动端适配。游戏仅在本地单人模式提供，无账号与多用户数据隔离。

## 原有模块（均保留）

- 面试大厅：JavaScript/TypeScript、React、浏览器与网络、工程化实战、AI 应用前端及综合方向。15 道核心题，每题两轮规则追问，支持独立回答、刷新恢复、复盘和最近 30 场记录。
- 统一知识库：启动时创建 15 条面试知识点；可导入旧《前端修炼·闯关》的 110 道八股题（10 分类）。导入内容带 `legacy-unreviewed` 标识，不自动宣称答案正确。
- 记忆中心：知识点搜索、今日到期、新学推荐、先答题再揭晓和自评、历史记录。间隔 1/3/7/14/30 天；跨天复测影响掌握状态。面试检查到的遗漏主题进入复习队列。

## 启动

要求 Node.js >= 22.13 和 npm。Node 22 部分版本的 `node:sqlite` 会显示实验性警告。

```bash
npm install
npm run dev
```

打开 http://127.0.0.1:5173；后端默认 http://127.0.0.1:3001。生产模式：

```bash
npm test
npm run build
npm start
```

生产模式打开 http://127.0.0.1:3001。数据默认位于 `data/interview.db`，可通过 `DATA_DIR` 修改，请备份 SQLite 数据库及其 WAL 文件。

## 旧版八股题导入（可选）

从旧 ZIP 解压 `src/data/baguwen.js`，执行：

```bash
npm run import:legacy -- /absolute/path/to/old/src/data/baguwen.js
```

可追加数据库文件作为第二参数。导入脚本使用 JSON.parse 解析已知格式，不执行旧 JS；按原题号生成稳定 ID，重复导入不会清空复习记录。导入前先停止服务或完成备份，确保目标数据库路径与服务配置一致。**不要复制旧工程中的 Token 登录或用户代码执行器。**

## 游戏、任务与心魔 API

- `GET /api/game/world`：章节进度、等级、XP、解锁状态和到期复习数量。
- `POST /api/game/stages/:stageId/start`：开始或恢复当前关卡；`GET /api/game/attempts/:id`：恢复回合。
- `POST /api/game/attempts/:id/answer`：`{ "questionId": "scope-1", "choice": 1, "reasoning": "我的理解" }`；选项索引为 0–3。
- `GET /api/quest/daily`：今日四项任务、领取状态、心魔候选和未完成讨伐 ID。
- `POST /api/quest/daily/:taskId/claim`：服务端验证完成条件后领取每日奖励；重复请求返回 `earnedXp: 0`。
- `POST /api/quest/demon/start`：创建或恢复今日讨伐；无到期薄弱知识时返回 409。
- `GET /api/quest/demon/:id`：恢复讨伐；未揭晓的知识卡不包含参考内容。
- `POST /api/quest/demon/:id/advance`：请求体 `{ "attemptId": "..." }`；必须先通过正常复习 API 完成当前知识卡才允许前进。

面试 API：`GET /api/catalog`、`GET/POST /api/sessions`、`GET /api/sessions/:id`、`POST /api/sessions/:id/answers`、`POST /api/sessions/:id/finish`。知识库 API：`GET /api/knowledge?q=闭包`。复习 API：`GET /api/review/dashboard`、`GET /api/review/queue`、`POST /api/review/attempts`、`GET /api/review/attempts/:id`、`POST /api/review/attempts/:id/reveal`、`POST /api/review/attempts/:id/complete`。

## 测试与边界

`npm test` 覆盖面试、记忆、游戏关卡、任务奖励、防刷、心魔状态机、SQLite 重启、HTTP 路由与旧题库解析。GitHub Actions 在 push/main 和 PR 时运行 `npm test` 与 `npm run build`。浏览器端真实交互 E2E 仍需进一步补齐；CI 成功不代表真实面试能力评分已实现。

当前项目**没有账号认证**，只能供单人本机使用，不要直接暴露公网或共享局域网。游戏没有执行用户提交的代码，代码侦探为静态推演题；也尚未接入真正的 AI 语义评价、语音面试、多区域地图和动态 BOSS。三颗游戏星及规则检查均不代表实际面试通过率。

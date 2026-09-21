# V0.4 · 成长与挑战

在原有 `main` 的 JavaScript 森林、记忆引擎、心魔与模拟面试基础上，新增四个互相联动的模块。继续使用 Node.js、React 和 SQLite，不复制题库，不执行用户代码。

## 游玩路线

1. `npm install && npm run dev`，打开 http://127.0.0.1:5173。
2. 顶部进入「🌟 成长与挑战」。技能树包含语言基础、异步调度、调试实战、长期记忆和面试表达，共 5 个里程碑节点，进度只从真实训练记录计算，不可手工加点，也不代表岗位技能认证。
3. 剧情日志有 4 幕；序章默认可读，第一幕需要通过 `js-scope`，第二幕需要通过 `js-async`，终幕需要通过 `js-boss`。未解锁时 API 不下发剧透正文；阅读状态保存在 SQLite，阅读没有 XP 奖励。
4. 成就图鉴有 7 项，分别依赖首次闯关、森林全通、BOSS 满分、跨天成功复习、净化心魔、修复副本通关、完整模拟面试。奖励从实际记录核验，使用 `game_rewards` 的唯一 `achievement:<id>` 键和事务防重复领取；奖励 XP 为 30～100。
5. 「代码修复副本」在主线 `js-debug` 通关后解锁。3 道题对应定时器旧闭包、请求竞态和微任务饥饿。题目显示故障代码及三个静态补丁选项，玩家可以输入原因（不参与自动评分），正确方案只在该题提交后揭晓。
6. 修复副本答对至少 2/3 通关，首通获得 120 XP；首次满分额外获得 30 XP；重复挑战不能刷奖励。选错会把对应的已有知识点加入复习队列，但不会重置正在进行的复习计划。答题过程和剧情阅读状态在 SQLite 中保存，刷新后可恢复未完成副本。

## HTTP API

- `GET /api/progression`：技能树、剧情解锁、成就状态、代码副本解锁和当前玩家 XP；未解锁剧情不返回正文。
- `POST /api/progression/story/:id/read`：仅已解锁章节可标记已读。
- `POST /api/progression/achievements/:id/claim`：校验真实记录，首次领取奖励，重试返回 `earnedXp: 0`。
- `POST /api/progression/code/start`：通过调试关卡才可开始；同一未完成副本返回现有记录。
- `GET /api/progression/code/:id`：恢复代码挑战；当前题不下发正确选项或讲解。
- `POST /api/progression/code/:id/answer`：提交 `{ "puzzleId": "timer", "choice": 0, "reasoning": "..." }`，选项索引为 0～2，解释最多 2000 字。服务端拒绝重复或过期提交。

## 数据结构与边界

新增 `progression_story_read`、`progression_code_runs`、`progression_code_answers`。技能节点和成就解锁直接查询现有的 `game_progress`、`sessions`、`turns`、`review_logs`、`demon_encounters` 等表，不创建独立的学习进度。奖励沿用 `game_rewards`。

这是一套**静态补丁选择练习，不是自由编码、代码执行器或 AI 自动评分**；原始解释只用于复盘。没有账号认证，仍仅允许本地单人使用，不能直接暴露公网。GitHub Actions 运行 Node 测试及 Vite 构建；浏览器交互与不同移动设备的手工 E2E 需要另行验收。

建议手动验收：初次打开成长页面、未解锁剧情无法读取、通关代码侦探后进入副本、错题进入复习、重复提交受阻、刷新恢复题目、领取一次成就后再次领取不重复增加 XP、切换其他顶部模块后返回成长页面。

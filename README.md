# Nowen Interview AI · CODE QUEST

一款**本地优先的程序员闯关学习游戏**：JavaScript 森林 + React 框架群岛 + 模拟面试 + 间隔复习 + 代码修复训练。技术栈 Node.js + React + SQLite；当前是无账号的本机单人版本，没有 AI 模型，客观选项、关键词与 AST 结构检查不能代表语义正确或真实面试通过率。

## V0.7：第二世界 · React 框架群岛

通关 JavaScript 森林最终 BOSS 后，从世界地图或顶部导航进入 React 群岛。现已开放 **5 个完整关卡、15 道题**：状态港湾、副作用礁石、协调航道、性能灯塔和 BOSS「组件架构守卫者」。逐关解锁，每关答对至少 2/3 通关；满分取得第二颗星，对应知识完成成功跨天复习可获得第三颗记忆星。群岛独立保存挑战和进度，但**共享原玩家 XP、唯一奖励账本与记忆库**。失败知识进入现有复习队列，刷新与重启可恢复未完成的挑战。首通与首次满分奖励仅发一次；整个群岛满分首次通关总奖励 1020 XP。每日冒险任务统计两个世界。

## V0.6：统一日历、备份与数据恢复

- **自然日按 IANA 时区计算**：`APP_TIME_ZONE` 默认 `Asia/Shanghai`（北京时间 00:00 重置），也可设置 `America/Los_Angeles` 等有效时区。所有数据库事件时间戳仍保存 UTC；每日任务、复习到期、延迟复测与世界地图待复习数量使用配置的日历日期。支持 DST 23/25 小时日期边界。
- **一致性快照备份**：`npm run backup` 使用 SQLite `VACUUM INTO` 快照 WAL 数据，验证数据库完整性，生成备份文件及 SHA-256 清单；已有备份不会覆盖。备份包含个人学习记录，默认放入被 Git 忽略的 `backups/`。
- **受保护的离线恢复**：`npm run restore -- <backup.sqlite> [db] --confirm`。先退出网站和 Node API、关闭 SQLite，恢复前核对清单及 SHA-256；若存在目标 WAL/SHM 文件则拒绝恢复。恢复前原库会保留为 `.pre-restore-...sqlite`。不要手动删除活跃 WAL 绕过保护。
- **兼容旧数据库**：只新增群岛数据表，不删除森林、面试、复习或已有 XP 记录。旧每日奖励键不会自动重写；升级当天 UTC 与本地自然日交界处可能有历史归属差异，请先备份、避免频繁更改时区。

详细操作、升级边界与测试说明：[V0.6–V0.7 文档](docs/V0.6-V0.7.md)。

## 历史已实现功能

- **V0.5 · 可编辑代码工坊**：定时器旧闭包、异步搜索竞态两道修复题；先通关森林第四关解锁。修改源码，保存草稿，使用语法树进行结构检查并查看逐项反馈。每题首次通过奖励 75 XP，错误知识进入记忆队列。服务端**不执行玩家 JavaScript**；结构通过不代表功能测试通过。见 [代码工坊文档](docs/CODE_WORKSHOP.md)。
- **V0.4 · 成长与挑战**：技能树、关卡剧情、成就、静态补丁选择副本。见 [成长与挑战文档](docs/PROGRESSION.md)。
- **V0.3 · 每日修炼与心魔讨伐**：依据关卡、复习日志、完整面试、心魔净化生成四项任务，每日奖励分别为 25/20/40/60 XP，服务端使用唯一事件防重；提前结束面试不计入完成。心魔从到期薄弱知识抽取 1–3 张卡，复用原有「先答→揭晓→自评」引擎。
- **V0.2 · 森林与面试核心**：JS 森林五关（作用域、闭包、异步、代码侦探与事件循环 BOSS），SQLite 保存 XP、星级、关卡和复习。原面试大厅包含五个技术领域与综合方向，15 道核心题每题两轮人工追问；支持文字作答、恢复、复盘、最近 30 场记录。记忆库默认 15 张核心卡，可选导入旧版 110 道题并标记未校验；支持搜索、到期队列、1/3/7/14/30 天复习计划，自评不等于客观判分。

## 启动与测试

需要 Node.js >=22.13 与 npm；`node:sqlite` 在部分 Node 22 版本会显示实验性提示。

```bash
npm install
npm run dev
```

开发网页：`http://127.0.0.1:5173`，API：`http://127.0.0.1:3001`。生产运行：

```bash
npm test
npm run build
npm start
```

生产地址：`http://127.0.0.1:3001`。真实 Chromium E2E（先构建）：

```bash
npx playwright install chromium
npm run test:e2e
```

CI 自动执行 Node 测试、Vite 生产构建和 Chromium 浏览器 E2E，包含：森林五关及重复奖励、React 群岛十五道题及途中恢复、记忆复习、代码工坊与每日任务。时区测试通过构造上海午夜、洛杉矶夏令时以及测试 SQLite 历史记录核验，不会等待真实跨天；尚未覆盖全部设备或每一种用户操作。

数据库默认 `data/interview.db`，可用 `DATA_DIR` 改变目录。升级前运行：

```bash
npm run backup
# 自定义备份目标：
npm run backup -- /absolute/path/interview.db /absolute/path/backup.sqlite
```

**恢复必须离线**，退出服务后：

```bash
npm run restore -- /absolute/path/backup.sqlite --confirm
# 或指定恢复到另一个数据库：
npm run restore -- /absolute/path/backup.sqlite /absolute/path/interview.db --confirm
```

备份要将 `.sqlite` 与同名 `.sqlite.json` 一起保存。备份不上传云端；自行复制到安全位置。

## 旧版题库导入（可选）

从旧 ZIP 提取 `src/data/baguwen.js`：

```bash
npm run import:legacy -- /absolute/path/to/old/src/data/baguwen.js
```

第二参数可指定目标 SQLite 文件。导入器使用 JSON.parse 处理已知结构，不执行旧 JavaScript；重复导入不清空复习记录。操作前停止服务、备份数据库并核对路径；不要复制旧版不安全的 Token 登录或用户代码执行器。

## 核心 API

- JS 森林：`GET /api/game/world`，`POST /api/game/stages/:id/start`，`GET /api/game/attempts/:id`，`POST /api/game/attempts/:id/answer`。
- React 群岛：`GET /api/framework/world`，`POST /api/framework/stages/:id/start`，`GET /api/framework/attempts/:id`，`POST /api/framework/attempts/:id/answer`。
- 每日与心魔：`GET /api/quest/daily`，`POST /api/quest/daily/:taskId/claim`，`POST /api/quest/demon/start`，`GET /api/quest/demon/:id`，`POST /api/quest/demon/:id/advance`。
- 代码工坊：`GET /api/editor`，`GET /api/editor/:id`，`PUT /api/editor/:id/draft`，`POST /api/editor/:id/submit`。
- 面试：`GET /api/catalog`，`GET/POST /api/sessions`，`GET /api/sessions/:id`，`POST /api/sessions/:id/answers`，`POST /api/sessions/:id/finish`。
- 记忆：`GET /api/knowledge`，`GET /api/review/dashboard`，`GET /api/review/queue`，`POST /api/review/attempts`，`GET /api/review/attempts/:id`，`POST /api/review/attempts/:id/reveal`，`POST /api/review/attempts/:id/complete`。

**安全边界：无账户认证或多用户隔离，仅供本机单人使用；不得直接开放公网或共享局域网。** 目前没有 AI 动态追问/语义判分、语音面试、安全的自由代码执行沙箱或第三个开放世界。游戏 XP/星级不是技能认证或求职结果预测。

# 《前端修炼 · 闯关》后端

Node + **Hono** + **SQLite（Node 内置 `node:sqlite`，零编译）**。

## 启动

```bash
cd "C:\Program Files\Github开源项目\js-basics-vue\server"
npm install
npm run seed        # 灌内容（首次；重建加 --force）
npm run dev         # http://localhost:5181
```

前端（Vue）在 5180，后端在 5181。

## 数据

| 项 | 值 |
|---|---|
| 数据库 | `server/data/app.db` |
| 章节 | 13 |
| 关卡 | 66（quiz 25 / typing 15 / recite 10 / boss 10 / code 5 / flash 1） |
| 题目 | 110（来自八股文题库） |
| 成就 | 6 |

内容**不在后端重复维护**：`src/content.js` 直接 import 前端的 `src/data/*.js`（单一来源）。

## 目录

```
server/
├─ data/app.db
└─ src/
   ├─ db.js        # 连接 + 建表（node:sqlite）
   ├─ content.js   # 复用前端题库 + plain/firstClause/伪随机
   ├─ game.js      # 星级 / XP / 等级 / 成就 / 连续天数规则
   ├─ seed.js      # 内容导入 + 生成章节与关卡
   └─ index.js     # Hono 路由（API）
```

## API

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/health` | 健康检查 + 数据量 |
| POST | `/api/auth/login` | `{name}` → `{userId, name, token}`（token 形如 `u_1`） |
| GET | `/api/me` | XP / 等级 / 进度 / 成就 / 错题数 |
| GET | `/api/map` | 章节 + 关卡 + 我的最佳星级与完成度 |
| GET | `/api/levels/:id` | 关卡详情（**quiz 不下发答案**） |
| POST | `/api/levels/:id/attempts` | 提交成绩 → 星级 / XP / 解锁 / 成就 |
| GET | `/api/wrongbook` | 错题本 |
| GET | `/api/leaderboard` | 排行榜（按 XP） |

鉴权：`Authorization: Bearer u_<userId>`（也支持 `?userId=`）。

### 提交成绩示例

```bash
curl -X POST http://localhost:5181/api/levels/1/attempts \
  -H "Content-Type: application/json" -H "Authorization: Bearer u_1" \
  -d '{"score":100,"accuracy":80,"durationMs":42000,
       "detail":{"answers":[{"questionId":1,"correct":true},{"questionId":2,"correct":false}]}}'
```

返回：`stars`（60/80/95 → 1/2/3 星）、`gainedXp`、`firstClear`、`newBest`、`user`、`unlocked`（新成就）。

## 游戏规则（`src/game.js`）

- 星级：`≥60 → 1★`，`≥80 → 2★`，`≥95 → 3★`
- `XP = xpBase × 难度 × (星级/3) + 首通奖励(xpBase×0.5)`
- 等级：每级所需 XP 递增（100 → ×1.6）
- 连续天数：昨天玩过 +1，今天玩过不变，否则重置
- 错题本：答错入本（累计次数），答对出本

## 服务端判分（M4）

| 关卡类型 | 判分方 | 做法 |
|---|---|---|
| quiz / boss / recite | **服务端** | 前端只传 `answers:[{qId,choice}]`，后端比对 `questions.answer`；漏答不得分 |
| typing | **服务端** | 前端只传 `typed` 文本，后端逐字比对；**分母用目标长度**，防止"只打一个字" |
| code | **服务端（子进程沙箱）** | 前端只传 `code` 源码，后端写临时文件 → 子进程跑「用户代码 + 测试」→ 超时 5s 强杀 |
| flash | 前端 | 自评，靠 XP 权重衰减（0.35）+ 反刷规则兜底 |

**安全开关**：`ALLOW_SERVER_EXEC=0` 可关闭服务端执行（回退为前端判分 + 反刷规则）。
调超时：`JUDGE_TIMEOUT_MS`（默认 5000）。

> ⚠️ 开启时会在服务器上执行用户提交的代码。本项目定位为**自托管单用户学习工具**，默认开启；若要公开部署，请务必先上更严格的隔离（容器 / isolate）。

## 反刷与收益平衡

- 满分且耗时 < 2000ms → 判 0 分并标记 `too-fast`
- XP 权重衰减：flash ×0.35、recite ×0.5
- 0 星仍给安慰 XP（`max(1, 10%)`）
- 重复挑战只记最高分，首通奖励仅一次

## 已知取舍（后续）

- 第 4–10 章共 58 题仍为自动生成选项，待人工校对（前三章 52 题已校对）。
- flash / recite 为自评，存在主观刷分空间（已用低权重压制）。

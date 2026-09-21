# Nowen Interview AI · 面试与记忆训练

本地优先的 **Node.js + React + SQLite** 前端面试训练应用。当前不调用 AI 模型；追问来自人工配置，反馈仅做关键词覆盖检查，不是事实正确率或面试通过率。

## 功能

- 面试大厅：JavaScript/TypeScript、React、浏览器与网络、工程化实战、AI 应用前端及综合方向。15 道核心题，每题 2 轮规则追问；文字回答、断点恢复、面试复盘与最近 30 场记录。
- 统一知识库：启动时幂等创建 15 条面试知识点；支持从上传的旧版《前端修炼·闯关》`src/data/baguwen.js` 导入 110 道题（10 个分类）。导入后的答案标记 `legacy-unreviewed`，内容原样保存、未经逐条校对。
- 记忆中心：知识库搜索、今日到期、新学推荐（最多 5 题）、先作答再揭晓、用户对照参考要点自评、重启后恢复进行中的复习。服务器保存一次性提交状态和全量历史记录。
- 复习调度：初始间隔 1/3/7/14/30 天；回答未覆盖关键点或选择忘记则重新安排；「轻松」加速必须经过延迟复测，稳定掌握还要求至少 3 次成功的跨日提取。周期是初始产品规则，非准确记忆预测。
- 面试与复习联动：面试结束时，规则检查检测到的遗漏主题自动加入到期队列，重复结束不会重复建卡；已有复习记录不覆盖。缺漏主题是关键词检测结果，不等于知识事实错误。
- 本地默认仅监听 `127.0.0.1`，资料存于 SQLite；复习题目的参考内容在用户提交独立回答前不下发。

## 运行

Node.js >=22.13.0（部分版本 `node:sqlite` 有实验性提示），npm。

```bash
npm install
npm run dev
```

访问 http://127.0.0.1:5173 ，API 默认 http://127.0.0.1:3001 。生产模式 `npm run build && npm start`，访问 http://127.0.0.1:3001 。

SQLite 数据默认存储在 `data/interview.db`；可通过 `DATA_DIR` 更改数据目录，请自行备份数据库与 WAL 文件。数据不会被导入脚本删除。

### 导入用户提供的旧题库

先从旧版 ZIP 解压出 **`src/data/baguwen.js`**。无需安装 Vue，也不要将旧版 `node_modules`、账号系统或不安全的代码执行器复制到本项目。

```bash
npm run import:legacy -- /absolute/path/to/old/src/data/baguwen.js
```

第二个参数可指定数据库文件：

```bash
npm run import:legacy -- /absolute/path/to/baguwen.js ./data/interview.db
```

脚本使用 `JSON.parse` 解析已知数据导出格式，不执行旧 JS 模块；按原题号生成稳定的 `legacy:1` 至 `legacy:110` ID；重复导入只跳过旧记录，不清空任何学习记录。默认导入当前工作目录的 `data/interview.db`，请确保与服务实际使用的数据库路径相同，并先停止服务或进行备份。

**特别注意：** 旧题库部分答案可能包含简化或不准确的技术表述，平台仅展示原始纯文本和来源警示。导入数据不会作为 AI 权威事实或自动判分依据。

## 验证

```bash
npm test
npm run build
```

测试覆盖面试状态机、HTTP 接口、参考答案隐藏、复习流程、重复提交、复习调度、迁移幂等、SQLite 重启恢复和旧数据解析。合并前仍应在具备 npm 网络访问的环境执行 React/Vite 构建和浏览器 E2E 验证。

## API

- 面试：`GET /api/catalog`、`GET /api/sessions`、`POST /api/sessions`、`GET /api/sessions/:id`、`POST /api/sessions/:id/answers`、`POST /api/sessions/:id/finish`。
- 知识库：`GET /api/knowledge?q=闭包`。
- 复习：`GET /api/review/dashboard`、`GET /api/review/queue`、`POST /api/review/attempts` `{ "knowledgeId": "legacy:1" }`、`GET /api/review/attempts/:id`、`POST /api/review/attempts/:id/reveal` `{ "answer": "..." }`、`POST /api/review/attempts/:id/complete` `{ "covered": true, "rating": "good" }`。

## 部署及能力边界

**当前仅限单人本机学习**：没有注册登录和多用户隔离，不要直接暴露公网或局域网。自评由用户本人核验，不是自动语义评分，不能用它预测真实面试成绩；题库数据来源与评分要点必须继续人工校对。后续再考虑身份认证、AI Provider、真实语义反馈、语音、题目变式及项目深挖。

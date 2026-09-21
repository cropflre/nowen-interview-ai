import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDatabase } from '../server/core.mjs';
import { defaultDatabase } from './database-maintenance.mjs';

// Curated, reviewable training prompts. References are study checklists, not objective AI scores.
export const ADVANCED_CARDS = Object.freeze([
  ['ts-boundary','TypeScript 与外部 API','如何避免接口返回的数据不符合 TypeScript 类型时导致白屏？','类型只在编译阶段发挥作用；在网络边界做运行时 schema 校验；区分错误数据和网络错误；提供可观察的降级展示。'],
  ['react-stale','React 与闭包','为什么 setInterval 中读取 count 可能一直是初始值？如何修复？','说明闭包捕获对应渲染的值；使用函数式 state 更新；Effect 返回 clearInterval 清理函数；按实际依赖或 ref 选择方案。'],
  ['react-race','React 请求竞态','输入 A 后迅速输入 B，A 较晚返回，如何防止旧结果覆盖新结果？','AbortController 清理旧请求或请求序号校验；只提交当前查询对应的响应；区分取消错误和真实请求失败；补充快速切换测试。'],
  ['react-identity','React 列表身份','可重排序表单列表为什么不应使用数组索引作为 key？','React 依据 key 关联同级节点身份；重排时索引变化可能错配局部状态；优先稳定业务 id；通过重排输入框用例验证。'],
  ['browser-inp','浏览器性能','一次输入延迟严重，你怎样定位 INP 问题并验证优化？','使用 Performance 或真实用户 INP 指标定位长任务；区分事件排队、处理和呈现延迟；拆分工作或虚拟化；多次对照测试。'],
  ['browser-xss','前端安全','用户 Markdown 中包含危险链接和 HTML，渲染时应该如何防护？','避免直接信任 HTML；可信的净化/白名单；危险协议校验；CSP 是额外防线而非替代输出编码。'],
  ['stream-frames','AI 流式渲染','SSE 数据分块边界截断一个 UTF-8 字符或 JSON，前端应该怎么办？','TextDecoder 使用 stream 模式处理跨块字符；先按协议帧缓冲再解析；处理断连和取消；禁止把模型输出当作可信 HTML。'],
  ['worker-lifecycle','Web Worker','将计算迁移到 Web Worker 后，消息、取消和卸载应该如何设计？','定义消息 id 和返回关联；终止 worker 与释放资源；处理错误和过期响应；传输大数据时评估拷贝与 transferable 成本。'],
  ['build-repro','工程化与构建','同一提交在本地正常但 CI 构建失败，应该怎样定位？','锁定 Node 和依赖版本；使用 lockfile 可重复安装；比对环境变量和平台差异；定位最小失败步骤并建立回归。'],
  ['rollout','部署与回滚','前端新版本上线后用户加载了旧 HTML 与新资源，如何设计缓存和回滚？','静态资源按内容哈希长期缓存；HTML 采用适当重新验证策略；保留旧资源一段时间；灰度和回滚检验。'],
  ['agent-permission','AI Agent 安全','模型请求删除用户文件时，工具执行层必须检查什么？','服务端独立校验用户权限；最小授权；高风险操作明确确认；记录执行结果并保证幂等；模型意图不能替代授权。'],
  ['rag-evidence','AI 检索与引用','RAG 返回的引用不支持结论或用户无权查看，应该如何处理？','在检索阶段强制访问控制；引用绑定可定位文档片段；复核主张是否被证据支持；不足时明确不知道且不泄露片段。'],
]);

export function seedAdvancedBank(db) {
  const statement = db.prepare(`INSERT OR IGNORE INTO knowledge_points(id,category,prompt,reference,source)
    VALUES (?,?,?,?,'curated-v0.9')`);
  let added = 0;
  db.exec('BEGIN IMMEDIATE');
  try {
    for (const [id, category, prompt, reference] of ADVANCED_CARDS) {
      added += statement.run(`curated:${id}`, category, prompt, `学习要点（需结合官方文档与实际代码核验）：\n${reference}`).changes;
    }
    db.exec('COMMIT');
  } catch (e) { db.exec('ROLLBACK'); throw e; }
  return { added, total: ADVANCED_CARDS.length };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const target = resolve(process.argv[2] || defaultDatabase());
  if (!existsSync(target)) { console.error(`Database does not exist: ${target}. Start the app to initialize it first.`); process.exitCode = 1; }
  else {
    const db = createDatabase(target);
    try { console.log(JSON.stringify({ database: target, ...seedAdvancedBank(db) }, null, 2)); }
    finally { db.close(); }
  }
}

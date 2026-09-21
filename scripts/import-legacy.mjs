// Import the user's exported baguwen.js as DATA, without executing the source module.
// Usage: node scripts/import-legacy.mjs /path/to/extracted/src/data/baguwen.js [sqlite-path]
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDatabase } from '../server/core.mjs';
import { importKnowledge } from '../server/memory.mjs';

export function parseLegacy(text) {
  const prefix = /^\s*(?:\/\/[^\n]*\n)*\s*export const BAGUWEN\s*=\s*/;
  if (!prefix.test(text)) throw new Error('仅支持旧项目 src/data/baguwen.js 的 BAGUWEN 数据导出');
  const raw = text.replace(prefix, '').trim().replace(/;\s*$/, '');
  const categories = JSON.parse(raw);
  if (!Array.isArray(categories)) throw new Error('旧题库格式错误');
  const ids = new Set();
  return categories.flatMap((group, categoryIndex) => {
    if (typeof group.cat !== 'string' || !Array.isArray(group.items)) throw new Error('旧题库分类格式错误');
    return group.items.map((item, itemIndex) => {
      const number = /^\s*(\d+)[.、．]/.exec(item.q || '')?.[1];
      const id = `legacy:${number || `${categoryIndex}-${itemIndex}`}`;
      if (ids.has(id)) throw new Error(`重复题号：${id}`);
      ids.add(id);
      return { id, category: group.cat, prompt: item.q, reference: item.plain };
    });
  });
}

export function importFile(filename, databaseFile) {
  const items = parseLegacy(readFileSync(filename, 'utf8'));
  const db = createDatabase(databaseFile);
  try { return importKnowledge(db, items); } finally { db.close(); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const source = process.argv[2];
  if (!source) { console.error('用法: npm run import:legacy -- /path/to/baguwen.js [database-file]'); process.exitCode = 1; }
  else {
    try {
      const destination = resolve(process.argv[3] || process.env.DATA_DIR || 'data/interview.db');
      const result = importFile(resolve(source), destination);
      console.log(`旧题库导入成功：新增 ${result.added} / 共 ${result.total} 题；重复导入不会覆盖原数据。数据库：${destination}`);
      console.log('来源标记 legacy-unreviewed：参考答案尚未逐条人工校验。');
    } catch (error) { console.error(error.message); process.exitCode = 1; }
  }
}

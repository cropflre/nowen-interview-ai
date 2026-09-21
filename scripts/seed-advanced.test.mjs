import test from 'node:test';
import assert from 'node:assert/strict';
import { createDatabase } from '../server/core.mjs';
import { seedAdvancedBank, ADVANCED_CARDS } from './seed-advanced.mjs';

test('advanced question bank adds twelve cards once and preserves existing study logs', () => {
  const db = createDatabase();
  try {
    const initial = db.prepare('SELECT COUNT(*) AS n FROM knowledge_points').get().n;
    assert.equal(seedAdvancedBank(db).added, ADVANCED_CARDS.length);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM knowledge_points').get().n, initial + 12);
    db.prepare("INSERT OR IGNORE INTO review_items(knowledge_id,due_on) VALUES ('curated:ts-boundary','2020-01-01')").run();
    assert.equal(seedAdvancedBank(db).added, 0);
    assert.equal(db.prepare("SELECT due_on FROM review_items WHERE knowledge_id='curated:ts-boundary'").get().due_on, '2020-01-01');
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM knowledge_points').get().n, initial + 12);
  } finally { db.close(); }
});

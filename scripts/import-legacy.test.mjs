import test from 'node:test';
import assert from 'node:assert/strict';
import { parseLegacy } from './import-legacy.mjs';

test('legacy parser reads only exported JSON data, never runs arbitrary JavaScript', () => {
  const fixture = '// generated\nexport const BAGUWEN = [{"cat":"JS","items":[{"q":"1. 闭包？","plain":"答案"}]}];';
  assert.deepEqual(parseLegacy(fixture), [{ id: 'legacy:1', category: 'JS', prompt: '1. 闭包？', reference: '答案' }]);
  assert.throws(() => parseLegacy('export const BAGUWEN = process.exit(1);'), SyntaxError);
  assert.throws(() => parseLegacy('const BAGUWEN = [];'), /仅支持/);
});

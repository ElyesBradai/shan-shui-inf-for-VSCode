'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../dist/landscape-worker.js'), 'utf8');
function engine(seed) {
  const messages = [];
  const self = { postMessage(data) { messages.push(data); } };
  const context = vm.createContext({ self });
  vm.runInContext(source, context, { timeout: 1000 });
  const random = vm.runInContext('Math.random', context);
  self.onmessage({ data: { type: 'init', seed } });
  assert.equal(messages.pop().type, 'ready');
  return {
    context, random,
    tile(index) {
      self.onmessage({ data: { type: 'tile', index } });
      return messages.pop();
    }
  };
}
test('real upstream engine generates deterministic finite SVG with isolated Math', () => {
  const first = engine(1234), second = engine(1234), third = engine(9876);
  const a = first.tile(0), b = second.tile(0), c = third.tile(0);
  assert.equal(a.type, 'tile');
  assert.ok(a.svg.length > 10000);
  assert.equal(a.svg, b.svg);
  assert.notEqual(a.svg, c.svg);
  assert.doesNotMatch(a.svg, /NaN|Infinity|undefined/);
  assert.equal(vm.runInContext('Math.random', first.context), first.random);
  assert.equal(first.tile(3).type, 'error');
});
test('long scrolling generates new scenery and evicts old geometry/planner cells', () => {
  const landscape = engine(42);
  let maxChunks = 0, maxCells = 0, previous;
  for (let i = 0; i < 35; i++) {
    const tile = landscape.tile(i);
    assert.equal(tile.type, 'tile');
    assert.doesNotMatch(tile.svg, /NaN|Infinity|undefined/);
    assert.notEqual(tile.svg, previous);
    previous = tile.svg;
    maxChunks = Math.max(maxChunks, tile.stats.chunks);
    maxCells = Math.max(maxCells, tile.stats.plannerCells);
    assert.ok(tile.stats.chunks < 350, `unbounded geometry at tile ${i}: ${tile.stats.chunks}`);
    assert.ok(tile.stats.plannerCells < 2000, `unbounded planner at tile ${i}: ${tile.stats.plannerCells}`);
  }
  console.log(`35 tiles: maximum ${maxChunks} objects, ${maxCells} planner cells`);
});

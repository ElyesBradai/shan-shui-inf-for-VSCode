import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TileCache, createLandscape, paintTile, ridge, MAX_WIDTH, MAX_HEIGHT } from '../renderer/landscape.mjs';

function canvasFactory() {
  const context = new Proxy({}, { get(target, name) { return target[name] ?? (() => {}); } });
  return { width: 0, height: 0, getContext: () => context };
}
test('ridge is deterministic, continuous and seed-dependent', () => {
  for (let x = -1000; x < 1000; x += .5) {
    const h = ridge(1234, x, 0);
    assert.ok(Number.isFinite(h));
    assert.equal(h, ridge(1234, x, 0));
    assert.ok(Math.abs(h - ridge(1234, x + .001, 0)) < .02);
  }
  assert.notEqual(ridge(1234, 77, 1), ridge(9876, 77, 1));
});
test('both axes scale equally at normal and enlarged status bar heights', () => {
  for (const height of [22, 32, 48]) {
    const scales = [];
    const ctx = canvasFactory().getContext();
    ctx.scale = (...args) => scales.push(args);
    paintTile(ctx, 42, 256, 256, height);
    assert.deepEqual(scales, [[height / 32, height / 32]]);
  }
});
test('many hours of tiles stay bounded and evicted native surfaces are zeroed', () => {
  const allocated = [];
  const cache = new TileCache(42, () => { const c = canvasFactory(); allocated.push(c); return c; });
  for (let i = 0; i < 500; i++) {
    cache.prepare(i * 256 + .5, 1920, 22, 2);
    assert.ok(cache.tiles.size <= 9);
    assert.ok(cache.bytes <= 9 * 512 * 44 * 4);
  }
  const live = new Set(cache.tiles.values());
  for (const c of allocated) if (!live.has(c)) assert.equal(c.width * c.height, 0);
  cache.prepare(100, 800, 32, 1);
  assert.ok(cache.tiles.size <= 5);
  cache.clear();
  assert.equal(cache.bytes, 0);
  for (const c of allocated) assert.equal(c.width * c.height, 0);
});
test('pause and dispose cancel all scheduled work; huge windows obey raster budget', () => {
  let id = 0;
  const timers = new Map(), frames = new Map();
  const env = {
    crypto: { getRandomValues: a => { a[0] = 123; return a; } },
    document: { createElement: canvasFactory },
    setTimeout: cb => { timers.set(++id, cb); return id; }, clearTimeout: key => timers.delete(key),
    requestAnimationFrame: cb => { frames.set(++id, cb); return id; }, cancelAnimationFrame: key => frames.delete(key)
  };
  const canvas = canvasFactory();
  const scene = createLandscape(canvas, { speed: 6, maxFPS: 20 }, env);
  scene.resize(1920, 22, 2);
  assert.ok(scene.stats.rasterBytes < 1.5 * 1024 * 1024);
  scene.setRunning(true);
  assert.equal(frames.size, 1);
  scene.setRunning(true);
  assert.equal(frames.size, 1, 'no duplicate loops');
  const [key, callback] = frames.entries().next().value;
  frames.delete(key); callback(100);
  assert.equal(timers.size, 1);
  scene.setRunning(false);
  assert.equal(timers.size + frames.size, 0);
  scene.resize(100000, 100000, 8);
  assert.equal(canvas.width, MAX_WIDTH * 2);
  assert.equal(canvas.height, MAX_HEIGHT * 2);
  assert.ok(scene.stats.rasterBytes <= 17 * 1024 * 1024);
  scene.dispose();
  assert.equal(scene.stats.rasterBytes, 0);
  assert.equal(scene.stats.tiles, 0);
  assert.equal(timers.size + frames.size, 0);
});

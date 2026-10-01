'use strict';
const { chromium } = require('playwright');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const assert = require('node:assert/strict');
const { install } = require('../src/patcher');
const root = path.resolve(__dirname, '..');

async function verifyPage(page, screenshot) {
  const problems = [];
  page.on('pageerror', error => problems.push(error.message));
  page.on('console', msg => {
    if (msg.type() === 'error' && /Shan Shui|Content Security Policy|Trusted|worker/i.test(msg.text())) problems.push(msg.text());
  });
  await page.waitForSelector('canvas.shan-shui-landscape');
  await page.waitForFunction(() => {
    const c = document.querySelector('canvas.shan-shui-landscape');
    if (!c || !c.width) return false;
    return c.getContext('2d').getImageData(Math.min(300, c.width - 1), Math.floor(c.height / 2), 1, 1).data[3] > 0;
  }, null, { timeout: 90000 });
  const before = await page.locator('canvas.shan-shui-landscape').screenshot();
  await page.waitForTimeout(1500);
  const after = await page.locator('canvas.shan-shui-landscape').screenshot();
  assert.notDeepEqual(before, after, 'landscape should scroll');
  assert.equal(await page.locator('canvas.shan-shui-landscape').evaluate(c => getComputedStyle(c).pointerEvents), 'none');
  assert.deepEqual(problems, []);
  if (screenshot) await page.screenshot({ path: screenshot });
}

async function memoryStress(page, browser) {
  const cdp = await page.context().newCDPSession(page);
  const browserCDP = await browser.newBrowserCDPSession();
  async function measure() {
    await cdp.send('HeapProfiler.collectGarbage');
    const heap = await cdp.send('Runtime.getHeapUsage');
    const dom = await cdp.send('Memory.getDOMCounters');
    let rss = null;
    if (process.platform === 'linux') {
      const { processInfo } = await browserCDP.send('SystemInfo.getProcessInfo');
      rss = 0;
      for (const p of processInfo.filter(p => p.type === 'renderer')) {
        try {
          const status = await fs.readFile(`/proc/${p.id}/status`, 'utf8');
          rss += Number(status.match(/VmRSS:\s+(\d+)/)[1]) * 1024;
        } catch (error) { if (error.code !== 'ENOENT') throw error; }
      }
    }
    return { heap: heap.usedSize, nodes: dom.nodes, rss };
  }
  await page.evaluate(async () => {
    const url = new URL('landscape.mjs', document.querySelector('script[src*="shan-shui-assets"]').src).href;
    const { TileCache } = await import(url);
    window.testCache = new TileCache(42, () => document.createElement('canvas'));
    for (let i = 0; i < 1000; i++) window.testCache.prepare(i * 256, 1920, 22, 2);
  });
  const before = await measure();
  const result = await page.evaluate(() => {
    let maxBytes = 0, maxTiles = 0;
    const start = performance.now();
    for (let i = 1000; i < 6000; i++) {
      window.testCache.prepare(i * 256 + .5, 1920, 22, 2);
      maxBytes = Math.max(maxBytes, window.testCache.bytes);
      maxTiles = Math.max(maxTiles, window.testCache.tiles.size);
    }
    return { maxBytes, maxTiles, milliseconds: performance.now() - start };
  });
  const after = await measure();
  assert.ok(result.maxTiles <= 9);
  assert.ok(result.maxBytes < 1024 * 1024);
  assert.ok(after.heap - before.heap < 8 * 1024 * 1024, 'JS heap grew during sustained scrolling');
  assert.ok(after.nodes - before.nodes < 100, 'detached canvas nodes accumulated');
  if (after.rss !== null) assert.ok(after.rss - before.rss < 32 * 1024 * 1024, 'renderer RSS grew by more than 32 MiB');
  const report = { before, after, ...result, simulatedHoursAtDefaultSpeed: 5000 * 256 / 6 / 3600 };
  await fs.writeFile(path.join(root, 'test-results/memory.json'), JSON.stringify(report, null, 2));
  console.log('Memory stress:', JSON.stringify(report));
  await page.evaluate(() => { window.testCache.clear(); delete window.testCache; });
  await cdp.detach();
  await browserCDP.detach();
}

async function main() {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'shan-shui-browser-'));
  const directory = path.join(temporary, 'out/vs/code/electron-browser/workbench');
  await fs.mkdir(directory, { recursive: true });
  await fs.copyFile(path.join(__dirname, 'fixtures/workbench.html'), path.join(directory, 'workbench.html'));
  await install(temporary, root, { speed: 80, pauseWhenUnfocused: false, respectReducedMotion: true });
  const server = http.createServer(async (request, response) => {
    try {
      const relative = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      const file = path.resolve(directory, '.' + relative);
      if (!file.startsWith(directory + path.sep)) throw new Error('invalid path');
      response.setHeader('Content-Type', /\.[cm]?js$/.test(file) ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html');
      response.end(await fs.readFile(file));
    } catch { response.statusCode = 404; response.end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ args: ['--no-sandbox'] });
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const initScript = () => {
      window.sampledSeeds = [];
      const original = Crypto.prototype.getRandomValues;
      Crypto.prototype.getRandomValues = function (array) {
        const result = Reflect.apply(original, this, [array]);
        if (array instanceof Uint32Array && array.length === 1) window.sampledSeeds.push(array[0]);
        return result;
      };
      window.originalMathRandom = Math.random;
    };
    await page.addInitScript(initScript);
    await fs.mkdir(path.join(root, 'test-results'), { recursive: true });
    await page.goto(`http://127.0.0.1:${server.address().port}/workbench.html`);
    await verifyPage(page, path.join(root, 'test-results/statusbar-browser.png'));
    await page.locator('#branch').click();
    assert.match(page.url(), /#clicked$/);
    assert.equal(await page.evaluate(() => Math.random === window.originalMathRandom), true);
    await page.locator('textarea').fill('The lightweight canvas keeps the editor responsive.');
    assert.equal(page.workers().length, 0);
    const seed = await page.evaluate(() => window.sampledSeeds[0]);
    await page.reload();
    await page.waitForFunction(() => window.sampledSeeds.length === 1);
    assert.notEqual(await page.evaluate(() => window.sampledSeeds[0]), seed);
    await page.setViewportSize({ width: 1920, height: 900 });
    await page.waitForFunction(() => document.querySelector('canvas').width === 1920);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForTimeout(100);
    const still = await page.locator('canvas.shan-shui-landscape').screenshot();
    await page.waitForTimeout(250);
    assert.deepEqual(await page.locator('canvas.shan-shui-landscape').screenshot(), still);
    await memoryStress(page, browser);
    console.log('Browser: memory stress, CSP, artwork, scrolling, clicks, resizing, typing, fresh seeds and reduced-motion pause passed.');
  } finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
    await fs.rm(temporary, { recursive: true, force: true });
  }
}
module.exports = { verifyPage };
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });

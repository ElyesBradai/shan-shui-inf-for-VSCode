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
  // Wait for prefetch, then movement, without depending on the machine's speed.
  await page.waitForTimeout(8000);
  const after = await page.locator('canvas.shan-shui-landscape').screenshot();
  assert.notDeepEqual(before, after, 'landscape should scroll');
  assert.equal(await page.locator('canvas.shan-shui-landscape').evaluate(c => getComputedStyle(c).pointerEvents), 'none');
  assert.deepEqual(problems, []);
  if (screenshot) await page.screenshot({ path: screenshot });
}

async function main() {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'shan-shui-browser-'));
  const directory = path.join(temporary, 'out/vs/code/electron-browser/workbench');
  await fs.mkdir(directory, { recursive: true });
  await fs.copyFile(path.join(__dirname, 'fixtures/workbench.html'), path.join(directory, 'workbench.html'));
  await install(temporary, root, { speed: 80, pauseWhenUnfocused: false, respectReducedMotion: false });
  const server = http.createServer(async (request, response) => {
    try {
      const relative = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      const file = path.resolve(directory, '.' + relative);
      if (!file.startsWith(directory + path.sep)) throw new Error('invalid path');
      response.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html');
      response.end(await fs.readFile(file));
    } catch { response.statusCode = 404; response.end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ args: ['--no-sandbox'] });
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const initScript = () => {
      window.workerSeeds = [];
      const OriginalWorker = window.Worker;
      window.Worker = class extends OriginalWorker {
        postMessage(message, ...args) {
          if (message.type === 'init') window.workerSeeds.push(message.seed);
          return super.postMessage(message, ...args);
        }
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
    await page.locator('textarea').fill('The worker keeps the editor responsive.');
    const seed = await page.evaluate(() => window.workerSeeds[0]);
    await page.reload();
    await page.waitForFunction(() => window.workerSeeds.length === 1);
    assert.notEqual(await page.evaluate(() => window.workerSeeds[0]), seed);
    await page.setViewportSize({ width: 1920, height: 900 });
    await page.waitForFunction(() => document.querySelector('canvas').width === 1920);
    console.log('Browser: CSP, Trusted Types, artwork, scrolling, clicks, resizing, typing, random restart seed passed.');
  } finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
    await fs.rm(temporary, { recursive: true, force: true });
  }
}
module.exports = { verifyPage };
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });

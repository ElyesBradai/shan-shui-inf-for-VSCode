'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { install, uninstall, patchHTML, stripPatch, normalizeConfig } = require('../src/patcher');
const root = path.resolve(__dirname, '..');
async function fixture(t, kind = 'electron-browser') {
  const app = await fs.mkdtemp(path.join(os.tmpdir(), 'shan-shui-'));
  t.after(() => fs.rm(app, { recursive: true, force: true }));
  const file = path.join(app, `out/vs/code/${kind}/workbench/workbench.html`);
  await fs.mkdir(path.dirname(file), { recursive: true });
  const original = await fs.readFile(path.join(__dirname, 'fixtures/workbench.html'), 'utf8');
  await fs.writeFile(file, original);
  return { app, file, original };
}
test('CSP stays intact and a patch strips byte-for-byte', async () => {
  const original = await fs.readFile(path.join(__dirname, 'fixtures/workbench.html'), 'utf8');
  const patched = patchHTML(original, '0123456789abcdef0123');
  assert.equal(stripPatch(patched), original);
  assert.equal(patchHTML(patched, '0123456789abcdef0123'), patched);
  assert.match(patched, /script-src 'self' 'unsafe-eval' blob:/);
  assert.match(patched, /require-trusted-types-for 'script'/);
  assert.equal((patched.match(/shanShuiWorker/g) || []).length, 1);
  assert.equal((patched.match(/SHAN-SHUI:BEGIN/g) || []).length, 1);
});
for (const kind of ['electron-browser', 'electron-sandbox']) {
  test(`install, repeat, repair missing assets and restore ${kind}`, async t => {
    const { app, file, original } = await fixture(t, kind);
    assert.equal((await install(app, root, {})).changed, true);
    const patched = await fs.readFile(file, 'utf8');
    assert.equal(await fs.readFile(file + '.shan-shui-original', 'utf8'), original);
    assert.equal((await install(app, root, {})).changed, false);
    const worker = path.join(path.dirname(file), patched.match(/\.\/([^" ]+)\/statusbar\.js/)[1], 'landscape-worker.js');
    await fs.rm(worker);
    assert.equal((await install(app, root, {})).changed, true);
    assert.ok((await fs.stat(worker)).size > 10000);
    assert.equal((await uninstall(app)).changed, true);
    assert.equal(await fs.readFile(file, 'utf8'), original);
    assert.equal((await uninstall(app)).changed, false);
  });
}
test('configuration uses a new asset URL and restoration preserves other edits', async t => {
  const { app, file, original } = await fixture(t);
  await install(app, root, {});
  const before = await fs.readFile(file, 'utf8');
  await install(app, root, { speed: 30 });
  const after = await fs.readFile(file, 'utf8');
  assert.notEqual(before, after);
  await fs.writeFile(file, after.replace('</head>', '<!-- another extension --></head>'));
  await uninstall(app);
  assert.equal(await fs.readFile(file, 'utf8'), original.replace('</head>', '<!-- another extension --></head>'));
});
test('VS Code update replaces backup with the new version', async t => {
  const { app, file, original } = await fixture(t);
  await install(app, root, {});
  const updated = original.replace('<head>', '<head><!-- new VS Code -->');
  await fs.writeFile(file, updated);
  await install(app, root, {});
  await uninstall(app);
  assert.equal(await fs.readFile(file, 'utf8'), updated);
});
test('unsupported and malformed workbenches are rejected without edits', async t => {
  const { app, file } = await fixture(t);
  for (const invalid of ['<html></html>', '<html><!-- SHAN-SHUI:BEGIN --></html>']) {
    await fs.writeFile(file, invalid);
    await assert.rejects(install(app, root, {}));
    assert.equal(await fs.readFile(file, 'utf8'), invalid);
  }
  await assert.rejects(install(path.join(app, 'missing'), root, {}), /desktop VS Code/);
});
test('lock excludes simultaneous workbench writes', async t => {
  const { app, file, original } = await fixture(t);
  await fs.writeFile(file + '.shan-shui-lock', '');
  await assert.rejects(install(app, root, {}), /in progress/);
  assert.equal(await fs.readFile(file, 'utf8'), original);
});
test('invalid configuration cannot inject script content', () => {
  assert.deepEqual(normalizeConfig({ speed: '</script>', maxFPS: Infinity, opacity: -10 }), {
    speed: 8, opacity: .1, maxFPS: 30, pauseWhenUnfocused: true, respectReducedMotion: true
  });
});

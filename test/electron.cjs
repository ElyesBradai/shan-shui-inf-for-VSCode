'use strict';
const { downloadAndUnzipVSCode, runTests, runVSCodeCommand } = require('@vscode/test-electron');
const { chromium } = require('playwright');
const path = require('node:path');
const fs = require('node:fs/promises');
const os = require('node:os');
const { install, uninstall } = require('../src/patcher');
const { verifyPage } = require('./browser.cjs');
const root = path.resolve(__dirname, '..');

async function main() {
  const version = process.env.VSCODE_VERSION || 'stable';
  const vscodeExecutablePath = await downloadAndUnzipVSCode(version);
  const appRoot = process.platform === 'darwin'
    ? path.resolve(vscodeExecutablePath, '../../Resources/app')
    : path.join(path.dirname(vscodeExecutablePath), 'resources/app');
  const userData = await fs.mkdtemp(path.join(os.tmpdir(), 'shan-shui-vscode-'));
  const extensions = path.join(userData, 'extensions');
  await fs.mkdir(path.join(userData, 'User'), { recursive: true });
  await fs.writeFile(path.join(userData, 'User/settings.json'), JSON.stringify({
    'workbench.startupEditor': 'none', 'window.restoreWindows': 'none',
    'security.workspace.trust.enabled': false, 'telemetry.telemetryLevel': 'off'
  }));
  const common = ['--no-sandbox', '--disable-gpu', '--user-data-dir', userData, '--extensions-dir', extensions];
  // Exercise the shipped VSIX with VS Code's own installer.
  const extensionVersion = require('../package.json').version;
  await runVSCodeCommand([...common, '--install-extension', path.join(root, `artifacts/shan-shui-statusbar-${extensionVersion}.vsix`), '--force'], { version });
  await install(appRoot, root, { speed: 40, pauseWhenUnfocused: false, respectReducedMotion: false });
  let browser;
  try {
    const tests = runTests({ vscodeExecutablePath, extensionDevelopmentPath: root,
      extensionTestsPath: path.join(__dirname, 'extension-suite.cjs'),
      launchArgs: [...common, '--remote-debugging-port=9223', '--skip-welcome', '--skip-release-notes'],
      extensionTestsEnv: { SHAN_SHUI_TEST_SIGNAL: path.join(userData, 'done') }
    });
    // Avoid an unhandled rejection while waiting for CDP.
    tests.catch(() => {});
    for (let i = 0; i < 120; i++) {
      try { browser = await chromium.connectOverCDP('http://127.0.0.1:9223'); break; }
      catch { await new Promise(resolve => setTimeout(resolve, 500)); }
    }
    if (!browser) throw new Error('VS Code renderer debugging endpoint did not start.');
    let page;
    for (let i = 0; i < 120; i++) {
      page = browser.contexts().flatMap(c => c.pages()).find(p => /workbench\.html/.test(p.url()));
      if (page) break;
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    if (!page) throw new Error('VS Code workbench page did not load.');
    await fs.mkdir(path.join(root, 'test-results'), { recursive: true });
    await verifyPage(page, path.join(root, 'test-results/statusbar-vscode.png'));
    await fs.writeFile(path.join(userData, 'done'), 'ok');
    await tests;
    console.log('Desktop VS Code: package installation, extension activation, commands, native workbench injection and scrolling passed.');
  } finally {
    await browser?.close().catch(() => {});
    await uninstall(appRoot);
    await fs.rm(userData, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });

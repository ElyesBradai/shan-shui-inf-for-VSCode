'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const vscode = require('vscode');
exports.run = async () => {
  const extension = vscode.extensions.getExtension('ElyesBradai.shan-shui-statusbar');
  assert.ok(extension, 'extension is discoverable');
  // Dismiss the onboarding toast; no installation prompt is needed in this test.
  const activation = extension.activate();
  for (let i = 0; i < 50; i++) {
    await vscode.commands.executeCommand('notifications.clearAll');
    if (extension.isActive) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  await activation;
  const commands = await vscode.commands.getCommands(true);
  for (const name of ['enable', 'disable', 'newLandscape', 'settings']) assert.ok(commands.includes(`shanShui.${name}`));
  const doc = await vscode.workspace.openTextDocument({ content: 'Shan Shui keeps the editor responsive.', language: 'plaintext' });
  await vscode.window.showTextDocument(doc);
  for (let i = 0; i < 1800; i++) {
    try { await fs.access(process.env.SHAN_SHUI_TEST_SIGNAL); return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Renderer smoke test timed out.');
};

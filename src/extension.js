'use strict';
const vscode = require('vscode');
const patcher = require('./patcher');
let output;
function getConfig() {
  const settings = vscode.workspace.getConfiguration('shanShui');
  return Object.fromEntries(['speed', 'opacity', 'maxFPS', 'pauseWhenUnfocused', 'respectReducedMotion', 'mode']
    .map(key => [key, settings.get(key)]));
}
function friendlyError(error) {
  if (['EACCES', 'EPERM', 'EROFS'].includes(error.code)) {
    return 'The VS Code installation is not writable. Use a per-user installation (Windows User Setup, a writable Applications folder on macOS, or a user-owned Linux archive). Shan Shui does not request administrator privileges.';
  }
  return error.message || String(error);
}
async function activate(context) {
  output = vscode.window.createOutputChannel('Shan Shui');
  context.subscriptions.push(output);
  let busy = false;
  async function operation(fn) {
    if (busy) return;
    busy = true;
    try { return await fn(); }
    catch (error) {
      output.appendLine(error.stack || String(error));
      await vscode.window.showErrorMessage(`Shan Shui: ${friendlyError(error)}`);
    } finally { busy = false; }
  }
  async function reload(message) {
    if (await vscode.window.showInformationMessage(message, 'Reload Window') === 'Reload Window') {
      await vscode.commands.executeCommand('workbench.action.reloadWindow');
    }
  }
  async function enable() {
    return operation(async () => {
      if (!context.globalState.get('enabled', false)) {
        const answer = await vscode.window.showInformationMessage(
          'Shan Shui modifies the local desktop workbench because VS Code has no API for status bar images. This may show a modified-installation warning. Restore the original status bar before uninstalling the extension.',
          { modal: true }, 'Enable Landscape');
        if (answer !== 'Enable Landscape') return;
      }
      await patcher.install(vscode.env.appRoot, context.extensionPath, getConfig());
      await context.globalState.update('enabled', true);
      await reload('Shan Shui is ready. Reload to start a fresh, endlessly scrolling landscape.');
    });
  }
  const commands = {
    'shanShui.enable': enable,
    'shanShui.disable': () => operation(async () => {
      const result = await patcher.uninstall(vscode.env.appRoot);
      await context.globalState.update('enabled', false);
      if (result.changed) await reload('Original status bar restored. Reload to finish.');
      else await vscode.window.showInformationMessage('The original status bar is already restored.');
    }),
    'shanShui.newLandscape': async () => {
      if (!context.globalState.get('enabled', false)) return enable();
      await reload('Reload to generate a new random landscape.');
    },
    'shanShui.settings': () => vscode.commands.executeCommand('workbench.action.openSettings', '@ext:ElyesBradai.shan-shui-statusbar')
  };
  for (const [name, handler] of Object.entries(commands)) context.subscriptions.push(vscode.commands.registerCommand(name, handler));
  context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(async event => {
    if (event.affectsConfiguration('shanShui') && context.globalState.get('enabled', false)) {
      const choice = await vscode.window.showInformationMessage('Apply the new Shan Shui settings and reload?', 'Apply');
      if (choice === 'Apply') await enable();
    }
  }));
  if (context.globalState.get('enabled', false)) {
    await operation(async () => {
      const result = await patcher.install(vscode.env.appRoot, context.extensionPath, getConfig());
      if (result.changed) void reload('Shan Shui was reapplied after an update or settings change. Reload to activate it.');
    });
  } else if (!context.globalState.get('introduced', false)) {
    await context.globalState.update('introduced', true);
    void vscode.window.showInformationMessage('Shan Shui is installed. Enable the infinite landscape in your bottom status bar?', 'Enable Landscape')
      .then(choice => { if (choice === 'Enable Landscape') return enable(); });
  }
}
function deactivate() {}
module.exports = { activate, deactivate };

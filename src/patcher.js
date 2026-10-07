'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const BEGIN = '<!-- SHAN-SHUI:BEGIN -->';
const END = '<!-- SHAN-SHUI:END -->';
const ASSETS = 'shan-shui-assets';
const BACKUP = '.shan-shui-original';

function normalizeConfig(input = {}) {
  const number = (key, fallback, min, max) => typeof input[key] === 'number' && Number.isFinite(input[key])
    ? Math.min(max, Math.max(min, input[key])) : fallback;
  return {
    speed: number('speed', 6, 0, 80), opacity: number('opacity', .85, .1, 1),
    maxFPS: Math.round(number('maxFPS', 20, 10, 30)),
    pauseWhenUnfocused: input.pauseWhenUnfocused !== false,
    respectReducedMotion: input.respectReducedMotion !== false,
    mode: ['auto', 'day', 'night'].includes(input.mode) ? input.mode : 'auto'
  };
}
function stripPatch(html) {
  if (!html.includes(BEGIN) && !html.includes(END)) return html;
  const start = html.indexOf(BEGIN), end = html.indexOf(END);
  if (start < 0 || end < start || html.indexOf(BEGIN, start + 1) >= 0 || html.indexOf(END, end + 1) >= 0) {
    throw new Error('Incomplete Shan Shui patch. Restore the saved workbench.html.shan-shui-original backup before retrying.');
  }
  const block = html.slice(start, end);
  let clean = html.slice(0, html[start - 1] === '\n' ? start - 1 : start) + html.slice(end + END.length);
  if (block.includes('data-shan-shui-policy="added"')) {
    clean = clean.replace(/(\btrusted-types\s+[^;]*?) shanShuiWorker(?=\s|;)/, '$1');
  }
  return clean;
}
function patchHTML(html, hash) {
  const clean = stripPatch(html);
  if (!/<\/html\s*>/i.test(clean)) throw new Error('Unsupported workbench: missing closing HTML tag.');
  const csp = /(<meta\b[^>]*http-equiv=["']Content-Security-Policy["'][^>]*content=")([^"]*)("[^>]*>)/i;
  const match = clean.match(csp);
  if (!match) throw new Error('Unsupported workbench: cannot identify its Content Security Policy. No files changed.');
  // Native canvas rendering needs no additional CSP or Trusted Types permissions.
  const base = `./${ASSETS}/${hash}`;
  const block = `\n${BEGIN}\n<link rel="stylesheet" href="${base}/statusbar.css">\n<script type="module" src="${base}/statusbar.js"></script>\n${END}`;
  return clean.replace(/<\/html\s*>/i, block + '$&');
}
async function findWorkbench(appRoot) {
  const candidates = [
    'out/vs/code/electron-browser/workbench/workbench.html',
    'out/vs/code/electron-sandbox/workbench/workbench.html'
  ];
  for (const relative of candidates) {
    const file = path.join(appRoot, relative);
    try { await fs.access(file); return file; } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  throw new Error('Shan Shui requires a writable desktop VS Code installation. VS Code for the Web and remote server installations are not supported.');
}
async function atomicWrite(file, content) {
  const temporary = `${file}.shan-shui-${crypto.randomBytes(6).toString('hex')}.tmp`;
  let mode;
  try { mode = (await fs.stat(file)).mode; } catch (error) { if (error.code !== 'ENOENT') throw error; }
  try {
    await fs.writeFile(temporary, content, { flag: 'wx', mode });
    await fs.rename(temporary, file);
  } finally { await fs.rm(temporary, { force: true }); }
}
async function withLock(file, operation) {
  const lock = `${file}.shan-shui-lock`;
  let handle;
  try { handle = await fs.open(lock, 'wx'); }
  catch (error) {
    if (error.code === 'EEXIST') throw new Error(`Another Shan Shui operation is in progress. If no VS Code window is applying changes, remove the stale lock: ${lock}`);
    throw error;
  }
  try { return await operation(); }
  finally { await handle.close(); await fs.rm(lock, { force: true }); }
}
async function install(appRoot, extensionRoot, input) {
  const file = await findWorkbench(appRoot);
  return withLock(file, async () => {
    const before = await fs.readFile(file, 'utf8');
    const clean = stripPatch(before);
    const config = normalizeConfig(input);
    const [renderer, css, landscape] = await Promise.all(['statusbar.js', 'statusbar.css', 'landscape.mjs']
      .map(name => fs.readFile(path.join(extensionRoot, 'renderer', name), 'utf8')));
    const js = `const SHAN_SHUI_CONFIG = ${JSON.stringify(config)};\n${renderer}`;
    const hash = crypto.createHash('sha256').update(js).update(css).update(landscape).digest('hex').slice(0, 20);
    const after = patchHTML(clean, hash);
    const directory = path.join(path.dirname(file), ASSETS, hash);
    const contents = { 'statusbar.js': js, 'statusbar.css': css, 'landscape.mjs': landscape };
    let assetsMatch = true;
    for (const [name, content] of Object.entries(contents)) {
      try { if (await fs.readFile(path.join(directory, name), 'utf8') !== content) assetsMatch = false; }
      catch (error) { if (error.code === 'ENOENT') assetsMatch = false; else throw error; }
    }
    if (before === after && assetsMatch) return { changed: false, file };
    await fs.mkdir(directory, { recursive: true });
    for (const [name, content] of Object.entries(contents)) await atomicWrite(path.join(directory, name), content);
    // Only replace the HTML once all assets exist. Back up the CURRENT unpatched
    // workbench, including unrelated customizations and changes from VS Code updates.
    if (!before.includes(BEGIN)) await atomicWrite(file + BACKUP, clean);
    await atomicWrite(file, after);
    return { changed: true, file };
  });
}
async function uninstall(appRoot) {
  const file = await findWorkbench(appRoot);
  return withLock(file, async () => {
    const before = await fs.readFile(file, 'utf8');
    let after = stripPatch(before);
    // Prefer byte-for-byte restoration only if no other customizer edited HTML.
    try {
      const original = await fs.readFile(file + BACKUP, 'utf8');
      const hash = before.match(/shan-shui-assets\/([a-f0-9]{20})\/statusbar\.js/)?.[1];
      if (hash && patchHTML(original, hash) === before) after = original;
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (before !== after) await atomicWrite(file, after);
    await fs.rm(path.join(path.dirname(file), ASSETS), { recursive: true, force: true });
    await fs.rm(file + BACKUP, { force: true });
    return { changed: before !== after, file };
  });
}
module.exports = { install, uninstall, findWorkbench, patchHTML, stripPatch, normalizeConfig, BEGIN, END };

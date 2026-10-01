'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const start = html.indexOf('<script id="PerlinNoise">');
const end = html.indexOf('  document.addEventListener("mousemove"');
if (start < 0 || end <= start) throw new Error('Upstream engine boundaries changed; review the extraction.');
// The original drawing code runs only inside a worker. Never run its Math.random
// replacement or its page/event code in the VS Code workbench.
const engine = html.slice(start, end).replace(/<\/?script[^>]*>/g, '')
  .replace('  MEM = {', '  var MEM = {').replace('planmtx: [],', 'planmtx: Object.create(null),');
const worker = fs.readFileSync(path.join(root, 'renderer/worker.js'), 'utf8').replace('/* UPSTREAM_ENGINE */', engine);
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist/landscape-worker.js'), worker);
fs.copyFileSync(path.join(root, 'renderer/statusbar.js'), path.join(root, 'dist/statusbar.js'));
fs.copyFileSync(path.join(root, 'renderer/statusbar.css'), path.join(root, 'dist/statusbar.css'));
console.log('Built isolated upstream renderer and status bar assets.');

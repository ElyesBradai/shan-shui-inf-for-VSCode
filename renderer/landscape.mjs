// Tiny, height-native ink scenery. No scene graph, image decoder, SVG or worker.
export const TILE_WIDTH = 256;
export const MAX_WIDTH = 8192;
export const MAX_HEIGHT = 64;
export const MAX_DPR = 2;

function random(seed, index) {
  let x = (seed ^ Math.imul(index, 0x45d9f3b)) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x21f0aaad);
  x = Math.imul(x ^ (x >>> 15), 0x735a2d97);
  return ((x ^ (x >>> 15)) >>> 0) / 4294967296;
}
function noise(seed, x) {
  const i = Math.floor(x), f = x - i, t = f * f * (3 - 2 * f);
  return random(seed, i) * (1 - t) + random(seed, i + 1) * t;
}
export function ridge(seed, x, layer) {
  const envelope = Math.pow(noise(seed + layer * 7919, x / 65), 1.4);
  const detail = noise(seed + 17 + layer, x / 13) * .17 + noise(seed + 89, x / 5) * .045;
  return (layer === 0 ? 20 : 27) - (layer === 0 ? 18 : 20) * (envelope + detail);
}

export function paintTile(ctx, seed, start, width, height) {
  // Both axes use the SAME scale. A 32-unit-tall scene is drawn directly at
  // the bar's height, never a full-sized landscape squeezed into a ribbon.
  const scale = height / 32;
  const left = start / scale, right = (start + width) / scale;
  ctx.save();
  ctx.fillStyle = '#e9e5da';
  ctx.fillRect(0, 0, width, height);
  ctx.scale(scale, scale);
  ctx.translate(-left, 0);
  ctx.lineJoin = 'round';
  for (let layer = 0; layer < 2; layer++) {
    ctx.beginPath();
    ctx.moveTo(left - 2, 32);
    for (let x = Math.floor(left) - 2; x <= right + 2; x++) ctx.lineTo(x, ridge(seed, x, layer));
    ctx.lineTo(right + 2, 32);
    ctx.closePath();
    ctx.fillStyle = layer === 0 ? '#bcc4bd' : '#818f87';
    ctx.fill();
    ctx.beginPath();
    for (let x = Math.floor(left) - 2; x <= right + 2; x++) {
      const y = ridge(seed, x, layer);
      if (x === Math.floor(left) - 2) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = layer === 0 ? '#a2ada5' : '#66776d';
    ctx.lineWidth = .6;
    ctx.stroke();
  }
  // Sparse ink hatching, anchored to world coordinates for seamless tiles.
  ctx.lineWidth = .35;
  ctx.strokeStyle = 'rgba(46,68,56,.3)';
  ctx.beginPath();
  for (let cell = Math.floor((left - 15) / 5); cell <= (right + 15) / 5; cell++) {
    const x = cell * 5 + random(seed + 71, cell) * 3;
    const y = ridge(seed, x, 1);
    ctx.moveTo(x, y + 2);
    ctx.lineTo(x + 2, Math.min(30, y + 5 + random(seed + 63, cell) * 8));
  }
  ctx.stroke();
  // Mist/river foreground keeps the composition airy at 22 pixels high.
  ctx.fillStyle = 'rgba(233,229,218,.7)';
  ctx.fillRect(left, 28, right - left, 4);
  for (let cell = Math.floor((left - 12) / 42); cell <= (right + 12) / 42; cell++) {
    if (random(seed + 401, cell) < .48) continue;
    const x = cell * 42 + random(seed + 44, cell) * 24;
    const ground = ridge(seed, x, 1) + 2;
    const treeHeight = 3 + random(seed + 83, cell) * 4;
    ctx.strokeStyle = '#415b49';
    ctx.lineWidth = .7;
    ctx.beginPath();
    ctx.moveTo(x, ground);
    ctx.lineTo(x, ground - treeHeight);
    ctx.stroke();
    ctx.fillStyle = '#506b57';
    for (let b = 0; b < 3; b++) {
      const y = ground - treeHeight + b * treeHeight * .23;
      const spread = treeHeight * (.16 + b * .1);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - spread, y + treeHeight * .38);
      ctx.lineTo(x + spread, y + treeHeight * .38);
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.restore();
}

export class TileCache {
  constructor(seed, createCanvas) {
    this.seed = seed;
    this.createCanvas = createCanvas;
    this.tiles = new Map();
    this.height = 0;
    this.dpr = 0;
  }
  clear() {
    for (const canvas of this.tiles.values()) { canvas.width = 0; canvas.height = 0; }
    this.tiles.clear();
  }
  prepare(offset, width, height, dpr) {
    if (height !== this.height || dpr !== this.dpr) {
      this.clear(); this.height = height; this.dpr = dpr;
    }
    const first = Math.floor(offset / TILE_WIDTH);
    const last = Math.floor((offset + width - 1 / dpr) / TILE_WIDTH);
    // Release native backing stores BEFORE allocating replacements.
    for (const [index, canvas] of this.tiles) {
      if (index < first || index > last) {
        canvas.width = 0; canvas.height = 0;
        this.tiles.delete(index);
      }
    }
    for (let index = first; index <= last; index++) {
      if (this.tiles.has(index)) continue;
      const canvas = this.createCanvas();
      canvas.width = Math.ceil(TILE_WIDTH * dpr);
      canvas.height = Math.ceil(height * dpr);
      const ctx = canvas.getContext('2d', { alpha: false });
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      paintTile(ctx, this.seed, index * TILE_WIDTH, TILE_WIDTH, height);
      this.tiles.set(index, canvas);
    }
  }
  draw(ctx, offset, height) {
    for (const [index, canvas] of this.tiles) {
      // Integer device-pixel positions and equal scale avoid resampling seams.
      const x = Math.round((index * TILE_WIDTH - offset) * this.dpr) / this.dpr;
      ctx.drawImage(canvas, x, 0, TILE_WIDTH, height);
    }
  }
  get bytes() {
    let bytes = 0;
    for (const canvas of this.tiles.values()) bytes += canvas.width * canvas.height * 4;
    return bytes;
  }
}

export function createLandscape(canvas, config, environment = globalThis) {
  const seed = environment.crypto.getRandomValues(new Uint32Array(1))[0];
  const cache = new TileCache(seed, () => environment.document.createElement('canvas'));
  const ctx = canvas.getContext('2d', { alpha: false });
  let width = 0, height = 0, dpr = 1, offset = 0;
  let timer = 0, frame = 0, last = 0, running = false, disposed = false;
  let frames = 0;
  function paint() {
    if (disposed || !width || !height) return;
    cache.prepare(offset, width, height, dpr);
    cache.draw(ctx, offset, height);
    frames++;
  }
  function tick(time) {
    frame = 0;
    if (!running || disposed) return;
    offset += config.speed * (last ? Math.min((time - last) / 1000, .25) : 0);
    last = time;
    paint();
    // Request animation frames only at the configured cadence, not every 60Hz
    // refresh just to skip most of them. Paused windows have no pending timer.
    timer = environment.setTimeout(() => {
      timer = 0;
      if (running && !disposed) frame = environment.requestAnimationFrame(tick);
    }, 1000 / config.maxFPS);
  }
  function pause() {
    running = false; last = 0;
    environment.clearTimeout(timer); timer = 0;
    environment.cancelAnimationFrame(frame); frame = 0;
  }
  return {
    resize(w, h, ratio) {
      if (disposed) return;
      const nextDpr = Math.min(MAX_DPR, Math.max(1, ratio || 1));
      const nextWidth = Math.min(MAX_WIDTH, Math.max(0, Math.ceil(w)));
      const nextHeight = Math.min(MAX_HEIGHT, Math.max(0, Math.ceil(h)));
      if (width === nextWidth && height === nextHeight && dpr === nextDpr) return;
      width = nextWidth; height = nextHeight; dpr = nextDpr;
      canvas.width = Math.ceil(width * dpr); canvas.height = Math.ceil(height * dpr);
      if (!width || !height) { pause(); cache.clear(); return; }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      paint();
    },
    setRunning(value) {
      if (!value || !width || !height || !config.speed || disposed) { pause(); return; }
      if (!running) { running = true; last = 0; frame = environment.requestAnimationFrame(tick); }
    },
    dispose() { pause(); disposed = true; cache.clear(); canvas.width = 0; canvas.height = 0; },
    get stats() { return { seed, frames, offset, tiles: cache.tiles.size, rasterBytes: cache.bytes + canvas.width * canvas.height * 4, running }; }
  };
}

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
  if (layer === 0) {
    const broad = noise(seed + 7919, x / 55);
    const secondary = noise(seed + 8101, x / 22);
    return 19 - broad * 9 - secondary * 3;
  }

  const broad = noise(seed + 15838, x / 38);
  const secondary = noise(seed + 15991, x / 15);
  const detail = noise(seed + 16021, x / 6) * 1.5;
  return 24 - broad * 13 - secondary * 4 - detail;
}

function drawMountain(ctx, seed, left, right, layer) {
  ctx.beginPath();
  ctx.moveTo(left - 2, 32);
  for (let x = Math.floor(left) - 2; x <= right + 2; x++) {
    ctx.lineTo(x, ridge(seed, x, layer));
  }
  ctx.lineTo(right + 2, 32);
  ctx.closePath();

  if (layer === 0) {
    ctx.fillStyle = 'rgba(180,190,184,.48)';
  } else {
    ctx.fillStyle = 'rgba(90,108,98,.78)';
  }
  ctx.fill();

  ctx.beginPath();
  for (let x = Math.floor(left) - 2; x <= right + 2; x++) {
    const y = ridge(seed, x, layer);
    if (x === Math.floor(left) - 2) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = layer === 0
    ? 'rgba(105,120,112,.35)'
    : 'rgba(55,73,62,.75)';
  ctx.lineWidth = layer === 0 ? .45 : .7;
  ctx.stroke();
}

function drawMist(ctx, seed, left, right) {
  ctx.save();
  ctx.fillStyle = 'rgba(233,229,218,.42)';
  const start = Math.floor((left - 80) / 70);
  const end = Math.ceil((right + 80) / 70);

  for (let cell = start; cell <= end; cell++) {
    const x = cell * 70 + random(seed + 500, cell) * 35;
    const y = 17 + random(seed + 501, cell) * 8;
    const width = 35 + random(seed + 502, cell) * 55;
    const height = 1.5 + random(seed + 503, cell) * 2.5;
    ctx.beginPath();
    ctx.ellipse(x, y, width, height, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawTrees(ctx, seed, left, right) {
  for (let cell = Math.floor((left - 12) / 42); cell <= (right + 12) / 42; cell++) {
    if (random(seed + 401, cell) < .48) continue;

    const x = cell * 42 + random(seed + 44, cell) * 24;
    const ground = ridge(seed, x, 1) + 2;
    const sizeVariation = .7 + random(seed + 84, cell) * .7;
    const treeHeight = (4.5 + random(seed + 83, cell) * 5.5) * sizeVariation;

    ctx.strokeStyle = '#415b49';
    ctx.lineWidth = .7;
    ctx.beginPath();
    ctx.moveTo(x, ground);
    ctx.lineTo(x, ground - treeHeight);
    ctx.stroke();

    ctx.fillStyle = '#506b57';
    for (let b = 0; b < 3; b++) {
      const y = ground - treeHeight + b * treeHeight * .23;
      const spread = treeHeight * (.20 + b * .13);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - spread, y + treeHeight * .38);
      ctx.lineTo(x + spread, y + treeHeight * .38);
      ctx.closePath();
      ctx.fill();
    }
  }
}

function drawPagoda(ctx, x, ground) {
  ctx.save();
  ctx.strokeStyle = 'rgba(48,64,53,.8)';
  ctx.fillStyle = 'rgba(55,72,60,.85)';
  ctx.lineWidth = .55;

  ctx.beginPath();
  ctx.moveTo(x, ground);
  ctx.lineTo(x, ground - 5);
  ctx.moveTo(x - 2.5, ground - 4.5);
  ctx.lineTo(x + 2.5, ground - 4.5);
  ctx.moveTo(x - 1.8, ground - 4.5);
  ctx.lineTo(x - 2.5, ground - 5.5);
  ctx.moveTo(x + 1.8, ground - 4.5);
  ctx.lineTo(x + 2.5, ground - 5.5);
  ctx.moveTo(x - 1.4, ground - 2.5);
  ctx.lineTo(x + 1.4, ground - 2.5);
  ctx.stroke();
  ctx.restore();
}

function drawBoat(ctx, x, y) {
  ctx.save();
  ctx.strokeStyle = 'rgba(45,61,51,.75)';
  ctx.lineWidth = .65;

  ctx.beginPath();
  ctx.moveTo(x - 4, y);
  ctx.quadraticCurveTo(x, y + 1.8, x + 4, y);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, y - 3);
  ctx.moveTo(x, y - 3);
  ctx.lineTo(x + 2.5, y - 1);
  ctx.stroke();
  ctx.restore();
}

function drawBridge(ctx, x, ground) {
  ctx.save();
  ctx.strokeStyle = 'rgba(50,66,55,.65)';
  ctx.lineWidth = .6;
  ctx.beginPath();
  ctx.moveTo(x - 7, ground);
  ctx.quadraticCurveTo(x, ground - 3, x + 7, ground);
  ctx.stroke();
  ctx.restore();
}

function drawLandmarks(ctx, seed, left, right) {
  const start = Math.floor((left - 100) / 120);
  const end = Math.ceil((right + 100) / 120);

  for (let cell = start; cell <= end; cell++) {
    if (random(seed + 900, cell) > .16) continue;

    const x = cell * 120 + random(seed + 901, cell) * 80;
    const ground = ridge(seed, x, 1) + 2;
    const type = Math.floor(random(seed + 902, cell) * 3);

    if (type === 0) drawPagoda(ctx, x, ground);
    else if (type === 1) drawBoat(ctx, x, 30);
    else drawBridge(ctx, x, ground);
  }
}

function setupScene(ctx, start, width, height) {
  const scale = height / 32;
  const left = start / scale;
  const right = (start + width) / scale;
  ctx.save();
  ctx.scale(scale, scale);
  ctx.translate(-left, 0);
  ctx.lineJoin = 'round';
  return { left, right, scale };
}

function paintBackground(ctx, seed, start, width, height) {
  const { left, right } = setupScene(ctx, start, width, height);
  drawMountain(ctx, seed, left, right, 0);
  ctx.restore();
}

function paintForeground(ctx, seed, start, width, height) {
  const { left, right } = setupScene(ctx, start, width, height);
  drawMountain(ctx, seed, left, right, 1);

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

  drawMist(ctx, seed, left, right);
  ctx.restore();
}

function paintDetails(ctx, seed, start, width, height) {
  const { left, right } = setupScene(ctx, start, width, height);
  drawTrees(ctx, seed, left, right);
  drawLandmarks(ctx, seed, left, right);
  ctx.restore();
}

export function paintTile(ctx, seed, start, width, height) {
  // Both axes use the SAME scale. A 32-unit-tall scene is drawn directly at
  // the bar's height, never a full-sized landscape squeezed into a ribbon.
  const scale = height / 32;
  const left = start / scale;
  const right = (start + width) / scale;

  ctx.save();
  ctx.fillStyle = '#e9e5da';
  ctx.fillRect(0, 0, width, height);
  ctx.scale(scale, scale);
  ctx.translate(-left, 0);
  ctx.lineJoin = 'round';

  drawMountain(ctx, seed, left, right, 0);
  drawMountain(ctx, seed, left, right, 1);

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

  drawMist(ctx, seed, left, right);
  drawTrees(ctx, seed, left, right);
  drawLandmarks(ctx, seed, left, right);
  ctx.restore();
}

export class TileCache {
  constructor(seed, createCanvas, painter = paintTile, alpha = false) {
    this.seed = seed;
    this.createCanvas = createCanvas;
    this.painter = painter;
    this.alpha = alpha;
    this.tiles = new Map();
    this.height = 0;
    this.dpr = 0;
  }

  clear() {
    for (const canvas of this.tiles.values()) {
      canvas.width = 0;
      canvas.height = 0;
    }
    this.tiles.clear();
  }

  prepare(offset, width, height, dpr) {
    if (height !== this.height || dpr !== this.dpr) {
      this.clear();
      this.height = height;
      this.dpr = dpr;
    }

    const first = Math.floor(offset / TILE_WIDTH);
    const last = Math.floor((offset + width - 1 / dpr) / TILE_WIDTH);

    // Release native backing stores BEFORE allocating replacements.
    for (const [index, canvas] of this.tiles) {
      if (index < first || index > last) {
        canvas.width = 0;
        canvas.height = 0;
        this.tiles.delete(index);
      }
    }

    for (let index = first; index <= last; index++) {
      if (this.tiles.has(index)) continue;

      const canvas = this.createCanvas();
      canvas.width = Math.ceil(TILE_WIDTH * dpr);
      canvas.height = Math.ceil(height * dpr);
      const ctx = canvas.getContext('2d', { alpha: this.alpha });
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.painter(ctx, this.seed, index * TILE_WIDTH, TILE_WIDTH, height);
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
    for (const canvas of this.tiles.values()) {
      bytes += canvas.width * canvas.height * 4;
    }
    return bytes;
  }
}

export function createLandscape(canvas, config, environment = globalThis) {
  const seed = environment.crypto.getRandomValues(new Uint32Array(1))[0];
  const createCanvas = () => environment.document.createElement('canvas');

  const backgroundCache = new TileCache(
    seed,
    createCanvas,
    paintBackground,
    false
  );
  const foregroundCache = new TileCache(
    seed + 1009,
    createCanvas,
    paintForeground,
    true
  );
  const detailCache = new TileCache(
    seed + 2017,
    createCanvas,
    paintDetails,
    true
  );

  const ctx = canvas.getContext('2d', { alpha: false });
  let width = 0, height = 0, dpr = 1, offset = 0;
  let timer = 0, frame = 0, last = 0, running = false, disposed = false;
  let frames = 0;

  function paint() {
    if (disposed || !width || !height) return;

    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#e9e5da';
    ctx.fillRect(0, 0, width, height);
    ctx.restore();

    backgroundCache.prepare(offset * .15, width, height, dpr);
    foregroundCache.prepare(offset * .45, width, height, dpr);
    detailCache.prepare(offset, width, height, dpr);

    backgroundCache.draw(ctx, offset * .15, height);
    foregroundCache.draw(ctx, offset * .45, height);
    detailCache.draw(ctx, offset, height);
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
      if (running && !disposed) {
        frame = environment.requestAnimationFrame(tick);
      }
    }, 1000 / config.maxFPS);
  }

  function pause() {
    running = false;
    last = 0;
    environment.clearTimeout(timer);
    timer = 0;
    environment.cancelAnimationFrame(frame);
    frame = 0;
  }

  return {
    resize(w, h, ratio) {
      if (disposed) return;

      const nextDpr = Math.min(MAX_DPR, Math.max(1, ratio || 1));
      const nextWidth = Math.min(MAX_WIDTH, Math.max(0, Math.ceil(w)));
      const nextHeight = Math.min(MAX_HEIGHT, Math.max(0, Math.ceil(h)));

      if (width === nextWidth && height === nextHeight && dpr === nextDpr) return;

      width = nextWidth;
      height = nextHeight;
      dpr = nextDpr;
      canvas.width = Math.ceil(width * dpr);
      canvas.height = Math.ceil(height * dpr);

      if (!width || !height) {
        pause();
        backgroundCache.clear();
        foregroundCache.clear();
        detailCache.clear();
        return;
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      paint();
    },

    setRunning(value) {
      if (!value || !width || !height || !config.speed || disposed) {
        pause();
        return;
      }

      if (!running) {
        running = true;
        last = 0;
        frame = environment.requestAnimationFrame(tick);
      }
    },

    dispose() {
      pause();
      disposed = true;
      backgroundCache.clear();
      foregroundCache.clear();
      detailCache.clear();
      canvas.width = 0;
      canvas.height = 0;
    },

    get stats() {
      return {
        seed,
        frames,
        offset,
        tiles: backgroundCache.tiles.size +
          foregroundCache.tiles.size +
          detailCache.tiles.size,
        rasterBytes: backgroundCache.bytes +
          foregroundCache.bytes +
          detailCache.bytes +
          canvas.width * canvas.height * 4,
        running
      };
    }
  };
}

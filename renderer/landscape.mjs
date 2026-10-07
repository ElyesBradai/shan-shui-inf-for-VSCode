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

function drawMountain(ctx, seed, left, right, layer, palette) {
  ctx.beginPath();
  ctx.moveTo(left - 2, 32);
  for (let x = Math.floor(left) - 2; x <= right + 2; x++) {
    ctx.lineTo(x, ridge(seed, x, layer));
  }
  ctx.lineTo(right + 2, 32);
  ctx.closePath();

  if (layer === 0) {
    ctx.fillStyle = palette.distantFill;
  } else {
    ctx.fillStyle = palette.foregroundFill;
  }
  ctx.fill();

  ctx.beginPath();
  for (let x = Math.floor(left) - 2; x <= right + 2; x++) {
    const y = ridge(seed, x, layer);
    if (x === Math.floor(left) - 2) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = layer === 0 ? palette.distantStroke : palette.foregroundStroke;
  ctx.lineWidth = layer === 0 ? .45 : .7;
  ctx.stroke();
}

function drawMist(ctx, seed, left, right, palette) {
  ctx.save();
  ctx.fillStyle = palette.mist;
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

function drawTrees(ctx, seed, left, right, palette) {
  for (let cell = Math.floor((left - 12) / 42); cell <= (right + 12) / 42; cell++) {
    if (random(seed + 401, cell) < .48) continue;

    const x = cell * 42 + random(seed + 44, cell) * 24;
    const ground = ridge(seed, x, 1) + 2;
    const sizeVariation = .7 + random(seed + 84, cell) * .7;
    const treeHeight = (6 + random(seed + 83, cell) * 7) * sizeVariation;

    ctx.strokeStyle = palette.treeStroke;
    ctx.lineWidth = .9;
    ctx.beginPath();
    ctx.moveTo(x, ground);
    ctx.lineTo(x, ground - treeHeight);
    ctx.stroke();

    ctx.fillStyle = palette.treeFill;
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

function drawPagoda(ctx, x, ground, palette) {
  ctx.save();
  ctx.strokeStyle = palette.landmarkStroke;
  ctx.fillStyle = palette.landmarkFill;
  ctx.lineWidth = .75;

  ctx.beginPath();
  ctx.moveTo(x, ground);
  ctx.lineTo(x, ground - 5);
  ctx.moveTo(x - 3.5, ground - 6);
  ctx.lineTo(x + 3.5, ground - 6);
  ctx.moveTo(x - 1.8, ground - 6);
  ctx.lineTo(x - 2.5, ground - 7);
  ctx.moveTo(x + 1.8, ground - 4.5);
  ctx.lineTo(x + 2.5, ground - 5.5);
  ctx.moveTo(x - 1.4, ground - 3.5);
  ctx.lineTo(x + 1.4, ground - 3.5);
  ctx.stroke();
  ctx.restore();
}

function drawBoat(ctx, x, y, palette) {
  ctx.save();
  ctx.strokeStyle = palette.landmarkStroke;
  ctx.lineWidth = .65;

  ctx.beginPath();
  ctx.moveTo(x - 6, y);
  ctx.quadraticCurveTo(x, y + 1.8, x + 6, y);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, y - 4.5);
  ctx.moveTo(x, y - 3);
  ctx.lineTo(x + 3.5, y - 1.5);
  ctx.stroke();
  ctx.restore();
}

function drawBridge(ctx, x, ground, palette) {
  ctx.save();
  ctx.strokeStyle = palette.landmarkStroke;
  ctx.lineWidth = .8;
  ctx.beginPath();
  ctx.moveTo(x - 9, ground);
  ctx.quadraticCurveTo(x, ground - 3, x + 9, ground);
  ctx.stroke();
  ctx.restore();
}

function drawLandmarks(ctx, seed, left, right, palette) {
  const start = Math.floor((left - 100) / 120);
  const end = Math.ceil((right + 100) / 120);

  for (let cell = start; cell <= end; cell++) {
    if (random(seed + 900, cell) > .16) continue;

    const x = cell * 120 + random(seed + 901, cell) * 80;
    const ground = ridge(seed, x, 1) + 2;
    const type = Math.floor(random(seed + 902, cell) * 3);

    if (type === 0) drawPagoda(ctx, x, ground, palette);
    else if (type === 1) drawBoat(ctx, x, 30, palette);
    else drawBridge(ctx, x, ground, palette);
  }
}

const DAY_PALETTE = { distantFill:'rgba(126,157,174,.58)', distantStroke:'rgba(72,103,121,.58)', foregroundFill:'rgba(52,104,88,.88)', foregroundStroke:'rgba(25,67,52,.9)', mist:'rgba(246,240,220,.55)', hatching:'rgba(28,70,54,.42)', treeStroke:'#214f3b', treeFill:'#2f7650', landmarkStroke:'rgba(117,70,39,.95)', landmarkFill:'rgba(147,82,42,.95)', background:'#e9e5da' };
const NIGHT_PALETTE = { distantFill:'rgba(65,88,126,.72)', distantStroke:'rgba(105,132,175,.62)', foregroundFill:'rgba(31,76,70,.94)', foregroundStroke:'rgba(72,139,122,.9)', mist:'rgba(173,190,201,.22)', hatching:'rgba(135,173,163,.34)', treeStroke:'#8fc4a8', treeFill:'#4f9b78', landmarkStroke:'rgba(224,170,92,.98)', landmarkFill:'rgba(220,151,67,.98)', background:'#101b2a' };
function paletteFor(mode) { return mode === 'night' ? NIGHT_PALETTE : DAY_PALETTE; }

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

function paintBackground(ctx, seed, start, width, height, palette) {
  const { left, right } = setupScene(ctx, start, width, height);
  drawMountain(ctx, seed, left, right, 0, palette);
  ctx.restore();
}

function paintForeground(ctx, seed, start, width, height, palette) {
  const { left, right } = setupScene(ctx, start, width, height);
  drawMountain(ctx, seed, left, right, 1, palette);

  ctx.lineWidth = .35;
  ctx.strokeStyle = palette.hatching;
  ctx.beginPath();
  for (let cell = Math.floor((left - 15) / 5); cell <= (right + 15) / 5; cell++) {
    const x = cell * 5 + random(seed + 71, cell) * 3;
    const y = ridge(seed, x, 1);
    ctx.moveTo(x, y + 2);
    ctx.lineTo(x + 2, Math.min(30, y + 5 + random(seed + 63, cell) * 8));
  }
  ctx.stroke();

  drawMist(ctx, seed, left, right, palette);
  ctx.restore();
}

function paintDetails(ctx, seed, start, width, height, palette) {
  const { left, right } = setupScene(ctx, start, width, height);
  drawTrees(ctx, seed, left, right, palette);
  drawLandmarks(ctx, seed, left, right, palette);
  ctx.restore();
}

export function paintTile(ctx, seed, start, width, height, palette = DAY_PALETTE) {
  // Both axes use the SAME scale. A 32-unit-tall scene is drawn directly at
  // the bar's height, never a full-sized landscape squeezed into a ribbon.
  const scale = height / 32;
  const left = start / scale;
  const right = (start + width) / scale;

  ctx.save();
  ctx.fillStyle = palette.background;
  ctx.fillRect(0, 0, width, height);
  ctx.scale(scale, scale);
  ctx.translate(-left, 0);
  ctx.lineJoin = 'round';

  drawMountain(ctx, seed, left, right, 0, palette);
  drawMountain(ctx, seed, left, right, 1, palette);

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

  drawMist(ctx, seed, left, right, palette);
  drawTrees(ctx, seed, left, right, palette);
  drawLandmarks(ctx, seed, left, right, palette);
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
    this.palette = DAY_PALETTE;
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
      this.painter(ctx, this.seed, index * TILE_WIDTH, TILE_WIDTH, height, this.palette);
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

  setPalette(palette) {
    this.palette = palette;
    this.clear();
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
  let mode = config.mode === 'night' ? 'night' : 'day';
  let palette = paletteFor(mode);
  backgroundCache.setPalette(palette);
  foregroundCache.setPalette(palette);
  detailCache.setPalette(palette);

  const ctx = canvas.getContext('2d', { alpha: false });
  let width = 0, height = 0, dpr = 1, offset = 0;
  let timer = 0, frame = 0, last = 0, running = false, disposed = false;
  let frames = 0;

  function paint() {
    if (disposed || !width || !height) return;

    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = palette.background;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();

    // Atmospheric layers use 1x rasterization to keep the three-layer
    // composition inside the extension's native memory budget. Fine detail
    // stays at the display DPR where it is most visible.
    const atmosphericDpr = Math.min(1, dpr);
    backgroundCache.prepare(offset * .15, width, height, atmosphericDpr);
    foregroundCache.prepare(offset * .45, width, height, atmosphericDpr);
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
    setMode(value) {
      const next = value === 'night' ? 'night' : 'day';
      if (next === mode) return;
      mode = next;
      palette = paletteFor(mode);
      backgroundCache.setPalette(palette);
      foregroundCache.setPalette(palette);
      detailCache.setPalette(palette);
      paint();
    },

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

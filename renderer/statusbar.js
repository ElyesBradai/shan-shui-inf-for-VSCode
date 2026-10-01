// SHAN_SHUI_CONFIG is prepended by the installer. All assets remain local.
(() => {
  'use strict';
  const config = SHAN_SHUI_CONFIG;
  const TILE = 512;
  const scriptURL = new URL(import.meta.url);
  const workerURL = new URL(config.worker, scriptURL).href;
  let trustedURL = workerURL;
  if (globalThis.trustedTypes) {
    const policy = trustedTypes.createPolicy('shanShuiWorker', {
      createScriptURL(url) {
        if (url !== workerURL) throw new TypeError('Unexpected landscape worker URL');
        return url;
      }
    });
    trustedURL = policy.createScriptURL(workerURL);
  }
  const seed = crypto.getRandomValues(new Uint32Array(1))[0];
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let worker, bar, canvas, ctx, resizeObserver;
  let animation = 0, lastTime = 0, lastPaint = 0, offset = 0;
  let width = 0, height = 0, dpr = 1, nextIndex = 0, pending = false;
  let disposed = false, ready = false;
  const tiles = new Map();
  const urls = new Set();
  const listeners = new AbortController();

  function visible() {
    return bar?.isConnected && width > 0 && height > 0 && !document.hidden;
  }
  function moving() {
    return visible() && config.speed > 0 && (!config.pauseWhenUnfocused || document.hasFocus()) &&
      (!config.respectReducedMotion || !motion.matches);
  }
  function requestTile() {
    if (disposed || !ready || pending || !visible()) return;
    // Bound raster cache to the visible width plus two tiles of prefetch.
    const needed = Math.ceil((offset + width) / TILE) + 2;
    if (nextIndex >= needed) return;
    pending = true;
    worker.postMessage({ type: 'tile', index: nextIndex });
  }
  function paint() {
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);
    for (const [index, img] of tiles) {
      const x = index * TILE - offset;
      if (x > width || x + TILE < 0) continue;
      // Round shared edges at device resolution to avoid hairline tile seams.
      const left = Math.round(x * dpr) / dpr;
      const right = Math.round((x + TILE) * dpr) / dpr;
      ctx.drawImage(img, left, 0, right - left, height);
    }
  }
  function tick(time) {
    animation = 0;
    if (disposed || !visible()) return;
    const delta = lastTime ? Math.min((time - lastTime) / 1000, 0.1) : 0;
    lastTime = time;
    if (moving()) {
      const proposal = offset + config.speed * delta;
      // Do not scroll into an unfinished tile if generation falls behind.
      if (tiles.has(Math.floor((proposal + width) / TILE))) offset = proposal;
    }
    for (const index of tiles.keys()) {
      if ((index + 1) * TILE < offset) tiles.delete(index);
    }
    if (time - lastPaint >= 1000 / config.maxFPS) {
      paint();
      lastPaint = time;
    }
    requestTile();
    if (moving()) animation = requestAnimationFrame(tick);
  }
  function wake() {
    lastTime = 0;
    if (!animation && visible() && !disposed) animation = requestAnimationFrame(tick);
  }
  function resize() {
    if (!canvas || !bar) return;
    width = bar.clientWidth;
    height = bar.clientHeight;
    dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.ceil(width * dpr);
    canvas.height = Math.ceil(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    paint();
    wake();
  }
  function fail(error) {
    console.error('[Shan Shui] Landscape stopped. Run Enable / Repair Landscape.', error);
    dispose();
  }
  function attach(target) {
    bar = target;
    canvas = document.createElement('canvas');
    canvas.className = 'shan-shui-landscape';
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.setProperty('--shan-shui-opacity', String(config.opacity));
    ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) throw new Error('Canvas is unavailable');
    bar.prepend(canvas);
    bar.classList.add('shan-shui-active');
    resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(bar);
    worker = new Worker(trustedURL);
    worker.onerror = fail;
    worker.onmessage = async ({ data }) => {
      if (disposed) return;
      if (data.type === 'error') return fail(data.message);
      if (data.type === 'ready') {
        ready = true;
        requestTile();
        return;
      }
      if (data.type !== 'tile') return;
      const url = URL.createObjectURL(new Blob([data.svg], { type: 'image/svg+xml' }));
      urls.add(url);
      try {
        const img = new Image();
        img.src = url;
        await img.decode();
        if (disposed) return;
        tiles.set(data.index, img);
        nextIndex = data.index + 1;
        pending = false;
        paint();
        requestTile();
        wake();
      } catch (error) { fail(error); }
      finally { URL.revokeObjectURL(url); urls.delete(url); }
    };
    worker.postMessage({ type: 'init', seed });
    resize();
  }
  function dispose() {
    disposed = true;
    cancelAnimationFrame(animation);
    worker?.terminate();
    resizeObserver?.disconnect();
    observer.disconnect();
    listeners.abort();
    tiles.clear();
    for (const url of urls) URL.revokeObjectURL(url);
    urls.clear();
    canvas?.remove();
    bar?.classList.remove('shan-shui-active');
  }
  function findBar() {
    if (disposed) return;
    if (bar && !bar.isConnected) { dispose(); return; }
    if (bar) return;
    const target = document.querySelector('.monaco-workbench .part.statusbar');
    if (target) {
      try { attach(target); } catch (error) { fail(error); }
    }
  }
  const observer = new MutationObserver(findBar);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  for (const type of ['focus', 'blur']) addEventListener(type, wake, { signal: listeners.signal });
  addEventListener('resize', resize, { signal: listeners.signal });
  document.addEventListener('visibilitychange', wake, { signal: listeners.signal });
  motion.addEventListener('change', wake, { signal: listeners.signal });
  addEventListener('pagehide', dispose, { once: true, signal: listeners.signal });
  findBar();
})();

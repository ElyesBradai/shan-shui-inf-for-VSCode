import { createLandscape, MAX_WIDTH, MAX_HEIGHT } from './landscape.mjs';

// SHAN_SHUI_CONFIG is prepended by the installer. No host globals are changed.
(() => {
  const config = SHAN_SHUI_CONFIG;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const listeners = new AbortController();
  let bar, canvas, landscape, observer, resizeObserver;
  let disposed = false, lookupTimer = 0, attempts = 0, themeListener;

  function updateMotion() {
    landscape?.setRunning(!document.hidden && (!config.pauseWhenUnfocused || document.hasFocus()) &&
      (!config.respectReducedMotion || !motion.matches));
  }
  function resize() {
    // Never stretch beyond the fixed raster budget on an unusually large display.
    // CSS leaves any extra area as the status bar's normal background.
    canvas.style.width = Math.min(bar.clientWidth, MAX_WIDTH) + 'px';
    canvas.style.height = Math.min(bar.clientHeight, MAX_HEIGHT) + 'px';
    landscape.resize(bar.clientWidth, bar.clientHeight, devicePixelRatio);
    updateMotion();
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    clearTimeout(lookupTimer);
    listeners.abort();
    observer?.disconnect();
    resizeObserver?.disconnect();
    landscape?.dispose();
    canvas?.remove();
    bar?.classList.remove('shan-shui-active');
  }
  function findBar() {
    if (disposed) return;
    bar = document.querySelector('.monaco-workbench .part.statusbar');
    if (!bar) {
      // A short startup-only search; never observe every editor DOM mutation.
      if (++attempts < 120) lookupTimer = setTimeout(findBar, 250);
      return;
    }
    try {
      canvas = document.createElement('canvas');
      canvas.className = 'shan-shui-landscape';
      canvas.setAttribute('aria-hidden', 'true');
      canvas.style.setProperty('--shan-shui-opacity', String(config.opacity));
      landscape = createLandscape(canvas, config);
      const theme = matchMedia('(prefers-color-scheme: dark)');
      const applyTheme = () => landscape?.setMode(config.mode === 'auto' ? (theme.matches ? 'night' : 'day') : config.mode);
      themeListener = applyTheme;
      applyTheme();
      theme.addEventListener('change', applyTheme, { signal: listeners.signal });
      bar.prepend(canvas);
      bar.classList.add('shan-shui-active');
      resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(bar);
      // Watch only direct status bar siblings, not the full workbench subtree.
      observer = new MutationObserver(() => { if (!bar.isConnected) dispose(); });
      observer.observe(bar.parentNode, { childList: true });
      resize();
    } catch (error) {
      console.error('[Shan Shui] Landscape stopped.', error);
      dispose();
    }
  }
  for (const type of ['focus', 'blur']) addEventListener(type, updateMotion, { signal: listeners.signal });
  addEventListener('resize', () => { if (bar && landscape) resize(); }, { signal: listeners.signal });
  document.addEventListener('visibilitychange', updateMotion, { signal: listeners.signal });
  motion.addEventListener('change', updateMotion, { signal: listeners.signal });
  addEventListener('pagehide', dispose, { once: true, signal: listeners.signal });
  findBar();
})();

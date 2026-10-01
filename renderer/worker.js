/* Derived from shan-shui-inf, Copyright (c) 2018 Lingdong Huang, MIT. */
(() => {
  // Lexically scoped: the upstream generator cannot alter any host globals.
  const Math = Object.create(globalThis.Math);
  const console = { log() {} };
  let state = 1;
  Math.random = () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  /* UPSTREAM_ENGINE */

  const WIDTH = 1600;
  const MARGIN = 2500; // covers the original generator's widest primitives
  let initialized = false;
  let nextIndex = 0;
  self.onmessage = ({ data }) => {
    try {
      if (data.type === 'init' && !initialized) {
        state = data.seed >>> 0;
        initialized = true;
        self.postMessage({ type: 'ready', seed: state });
        return;
      }
      if (!initialized || data.type !== 'tile' || data.index !== nextIndex) {
        throw new Error('Landscape tiles must be requested sequentially after initialization.');
      }
      const x = nextIndex * WIDTH;
      // Generate well beyond both tile edges before rasterization, so neighboring
      // tiles include the same overhanging mountains, trees and water strokes.
      chunkloader(x - MARGIN, x + WIDTH + MARGIN);
      const geometry = MEM.chunks.filter(c => c.x >= x - MARGIN && c.x <= x + WIDTH + MARGIN)
        .map(c => c.canv).join('');
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="128" viewBox="${x} 70 ${WIDTH} 700" preserveAspectRatio="none"><rect x="${x}" y="70" width="${WIDTH}" height="700" fill="#eee9db"/>${geometry}</svg>`;
      const keepFrom = x - MARGIN;
      MEM.chunks = MEM.chunks.filter(c => c.x >= keepFrom);
      for (const key of Object.keys(MEM.planmtx)) {
        if (Number(key) * 5 < keepFrom - 512) delete MEM.planmtx[key];
      }
      MEM.canv = '';
      nextIndex += 1;
      self.postMessage({ type: 'tile', index: data.index, svg,
        stats: { chunks: MEM.chunks.length, plannerCells: Object.keys(MEM.planmtx).length } });
    } catch (error) {
      self.postMessage({ type: 'error', message: String(error.message || error) });
    }
  };
})();

/* Registered hardware life. Presentation time and pixels never resolve gameplay. */
(() => {
  'use strict';
  if (window.RelayProtocolLife) return;
  const W = 420, H = 650, FPS = 24;
  const freeze = value => {
    if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
    return value;
  };
  const definitions = freeze({
    bypass: {
      source: 'assets/protocols/bypass-calibrator.png', sourceSize: [1008, 1561],
      protected: [[0, 0, 420, 92], [53, 318, 314, 192], [0, 517, 420, 133]],
      detailCrop: [146, 155, 128, 128],
      leds: [
        { id: 'left-status', rect: [22, 122, 3, 4], color: '#85e9ec' },
        { id: 'lower-lens', rect: [66, 280, 4, 4], color: '#8be6e1' },
        { id: 'bank-one', rect: [337, 272, 2, 10], color: '#8de2e2' },
        { id: 'bank-two', rect: [345, 272, 2, 10], color: '#8de2e2' },
        { id: 'bank-three', rect: [353, 272, 2, 10], color: '#8de2e2' }
      ],
      surfaces: [
        { id: 'core', rect: [207, 195, 7, 22], color: '#ffb050' },
        { id: 'left-winding', rect: [112, 176, 2, 40], color: '#ffbb69' },
        { id: 'right-winding', rect: [296, 176, 2, 40], color: '#ffbb69' }
      ],
      sparks: [{ id: 'coil-contact', at: [171, 202], color: '#ffdda2' }],
      bus: [[73, 292], [116, 292], [126, 285]]
    },
    typing: {
      source: 'assets/protocols/injection-crt.png', sourceSize: [1008, 1561],
      protected: [[0, 0, 420, 92], [78, 153, 266, 212], [60, 395, 238, 31], [0, 570, 420, 80]],
      detailCrop: [262, 385, 128, 128],
      leds: [
        { id: 'left-upper', rect: [28, 257, 3, 3], color: '#ffd48d' },
        { id: 'left-middle', rect: [28, 272, 3, 3], color: '#ffd48d' },
        { id: 'left-lower', rect: [28, 288, 3, 3], color: '#81d3c8' },
        { id: 'right-amber', rect: [387, 293, 5, 4], color: '#ffd08a' },
        { id: 'right-teal', rect: [388, 311, 3, 3], color: '#8fe2d4' },
        { id: 'bezel-a', rect: [321, 405, 3, 4], color: '#ffd086' },
        { id: 'bezel-b', rect: [334, 405, 3, 4], color: '#ffd086' },
        { id: 'keyboard-link', rect: [115, 563, 2, 3], color: '#ffe0a3' }
      ],
      surfaces: [],
      sparks: [{ id: 'keyboard-contact', at: [341, 477], color: '#a4e6d4' }],
      bus: [[121, 542], [226, 542], [251, 542]]
    },
    backdoor: {
      source: 'assets/protocols/memory-patch-bay-v2.png', sourceSize: [1008, 1560],
      protected: [[0, 0, 420, 92], [44, 103, 293, 44], [49, 177, 305, 306], [0, 541, 420, 109]],
      detailCrop: [65, 475, 128, 128],
      leds: [
        { id: 'upper-board-a', rect: [143, 163, 2, 2], color: '#ffd993' },
        { id: 'phase-lens', rect: [340, 128, 4, 4], color: '#ffd18a' },
        { id: 'left-board', rect: [42, 351, 3, 4], color: '#ffd58c' },
        { id: 'lower-board', rect: [93, 504, 4, 5], color: '#ffd18a' }
      ],
      surfaces: [
        { id: 'copper-fin-a', rect: [276, 155, 1, 14], color: '#ffcb7f' },
        { id: 'copper-fin-b', rect: [287, 156, 1, 14], color: '#ffcb7f' },
        { id: 'copper-fin-c', rect: [303, 157, 1, 14], color: '#ffcb7f' }
      ],
      sparks: [{ id: 'bus-terminal', at: [334, 519], color: '#ffd590' }],
      bus: [[112, 531], [305, 531], [334, 520]]
    }
  });
  const devices = new Map(), removers = [];
  const media = window.matchMedia('(prefers-reduced-motion: reduce)');
  let snapshot = window.RiskPresentation?.snapshot() || {}, protocol = window.RiskPresentation?.protocol() || null;
  let disposed = false, raf = 0, visible = '', trackedScreen = '', lastStamp = 0, exportCanvas = null, frameCount = 0;
  const listen = (target, type, fn) => { target.addEventListener(type, fn); removers.push(() => target.removeEventListener(type, fn)); };
  const phaseName = value => ['countdown', 'active', 'result'].includes(value) ? value : 'active';
  const finiteTime = value => Math.max(0, Math.min(86400, Number(value) || 0));
  const intersects = (a, b) => a[0] < b[0] + b[2] && a[0] + a[2] > b[0] && a[1] < b[1] + b[3] && a[1] + a[3] > b[1];
  const empty = () => ({ leds: 0, modulation: 0, sparks: 0, sweeps: 0, pixels: 0, emissions: [] });
  const pulse = (time, period, offset, length = .18) => {
    const p = ((time + offset) % period) / period;
    return p < length ? Math.sin(p / length * Math.PI) ** 2 : 0;
  };
  function paint(ctx, time, options = {}) {
    const game = options.game, def = definitions[game], stats = empty();
    if (!def || options.effectsLevel === 'off' || options.reducedMotion) return stats;
    const low = options.effectsLevel === 'low', phase = phaseName(options.phase), t = finiteTime(time);
    const phaseTime = finiteTime(options.phaseTime ?? time);
    // Every written rectangle is clipped against the real controls, including their labels.
    const rect = (kind, id, box, color, alpha) => {
      const bounds = box.map(Math.round);
      if (alpha <= .006 || bounds[2] <= 0 || bounds[3] <= 0 || def.protected.some(area => intersects(bounds, area))) return;
      ctx.globalAlpha = Math.min(.75, Math.max(0, alpha)); ctx.fillStyle = color;
      ctx.fillRect(...bounds);
      stats.pixels += bounds[2] * bounds[3];
      stats.emissions.push({ kind, id, bounds, opacity: Math.round(ctx.globalAlpha * 1000) / 1000 });
    };
    ctx.save(); ctx.imageSmoothingEnabled = false;
    def.leds.forEach((lamp, index) => {
      if (low && index % 2) return;
      const wave = pulse(t, 3.7 + index * .23, index * .73, .22);
      const strength = (phase === 'active' ? .17 : .26) + wave * (low ? .25 : .47);
      rect('led', lamp.id, lamp.rect, lamp.color, strength * (low ? .7 : 1));
      // One pixel of glass spill stays attached to the painted housing.
      if (!low && wave > .2) rect('led-housing', lamp.id, [lamp.rect[0] - 1, lamp.rect[1], 1, lamp.rect[3]], lamp.color, wave * .11);
      stats.leds++;
    });
    def.surfaces.forEach((surface, index) => {
      if (low && index) return;
      const breathe = .5 + Math.sin(t * 1.2 + index * 1.7) * .5;
      rect('modulation', surface.id, surface.rect, surface.color, (.025 + breathe * .075) * (low ? .55 : 1));
      stats.modulation++;
    });
    // High contrast contact arcs and travelling copper pulses never run during input.
    const stopFeedback = game === 'bypass' && Number.isFinite(options.stopAge) && options.stopAge >= 0 && options.stopAge < .32;
    if ((phase !== 'active' || stopFeedback) && !low) {
      const beat = ((stopFeedback ? options.stopAge : phaseTime) + .04) % 1.65;
      if (beat > .08 && beat < .24) def.sparks.forEach(spark => {
        const frame = Math.floor(beat * 24) % 3, [x, y] = spark.at;
        const color = phase === 'result' && options.success === false ? '#eead7d' : spark.color;
        [[x - 3, y, 3, 1], [x, y - 2 + frame, 1, 3], [x + 1, y - 2, 2, 1]].forEach(box => rect('spark', spark.id, box, color, .5));
        stats.sparks++;
      });
      const sweep = (phaseTime % 2.4) / 2.4;
      if (phase !== 'active' && sweep < .7) {
        const points = def.bus, length = points.slice(1).reduce((sum, point, i) => sum + Math.hypot(point[0] - points[i][0], point[1] - points[i][1]), 0);
        let travel = length * sweep / .7;
        for (let i = 1; i < points.length; i++) {
          const a = points[i - 1], b = points[i], segment = Math.hypot(b[0] - a[0], b[1] - a[1]);
          if (travel <= segment) {
            rect('sweep', 'copper-bus', [a[0] + (b[0] - a[0]) * travel / segment, a[1] + (b[1] - a[1]) * travel / segment, 3, 1], '#d1b679', .4);
            stats.sweeps++; break;
          }
          travel -= segment;
        }
      }
    }
    ctx.restore(); return stats;
  }
  function ready(device) { return !!device && device.image.complete && device.image.naturalWidth > 0; }
  function enabled() {
    const prefs = snapshot.preferences || snapshot;
    return !disposed && !document.hidden && !media.matches && !prefs.reducedMotion && prefs.effectsLevel !== 'off';
  }
  function optionsFor(device) {
    return { game: device.game, phase: device.phase, effectsLevel: (snapshot.preferences || snapshot).effectsLevel || 'full',
      phaseTime: device.time - device.phaseStart, stopAge: device.time - device.stopTime, success: protocol?.game === device.game ? protocol.success : undefined };
  }
  function clear(device) { device.ctx.clearRect(0, 0, W, H); device.stats = empty(); device.canvas.hidden = true; }
  function draw(device) {
    device.ctx.clearRect(0, 0, W, H); device.canvas.hidden = false;
    device.stats = paint(device.ctx, device.time, optionsFor(device)); device.draws++; frameCount++;
  }
  function tick(stamp) {
    raf = 0;
    const device = devices.get(visible);
    if (!device || !ready(device) || !enabled()) { sync(); return; }
    device.time += Math.max(0, Math.min(.1, (stamp - lastStamp) / 1000)); lastStamp = stamp;
    const frame = Math.floor(device.time * FPS);
    if (frame !== device.frame) { device.frame = frame; draw(device); }
    raf = requestAnimationFrame(tick);
  }
  function sync() {
    if (disposed) return;
    const screen = window.RiskPresentation?.currentScreen() || snapshot.screen || '';
    if (screen !== trackedScreen) {
      const entered = devices.get(screen);
      if (entered) { entered.time = 0; entered.phaseStart = 0; entered.stopTime = -Infinity; entered.frame = -1; }
      trackedScreen = screen;
    }
    const next = devices.has(screen) && enabled() && ready(devices.get(screen)) ? screen : '';
    if (visible !== next) {
      if (visible) clear(devices.get(visible));
      cancelAnimationFrame(raf); raf = 0; visible = next;
      if (next) devices.get(next).frame = -1;
    }
    devices.forEach(device => {
      const phase = phaseName(protocol?.game === device.game ? protocol.phase : device.node.dataset.phase);
      if (device.phase !== phase) { device.phase = phase; device.phaseStart = device.time; device.frame = -1; }
      if (device.game !== visible && !device.canvas.hidden) clear(device);
    });
    if (visible) {
      const device = devices.get(visible);
      if (device.frame === -1) { draw(device); device.frame = Math.floor(device.time * FPS); }
      if (!raf) { lastStamp = performance.now(); raf = requestAnimationFrame(tick); }
    } else { cancelAnimationFrame(raf); raf = 0; }
  }
  document.querySelectorAll('[data-protocol-device]').forEach(node => {
    const game = node.dataset.protocolDevice, image = node.querySelector('.protocol-art');
    if (!definitions[game] || !image) return;
    const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
    canvas.className = 'protocol-life-canvas'; canvas.dataset.protocolLifeCanvas = game;
    canvas.setAttribute('aria-hidden', 'true'); canvas.hidden = true; image.after(canvas);
    devices.set(game, { game, node, image, canvas, ctx: canvas.getContext('2d'), time: 0, phaseStart: 0, stopTime: -Infinity, phase: phaseName(node.dataset.phase), frame: -1, draws: 0, stats: empty() });
    node.dataset.protocolLife = 'true'; listen(image, 'load', sync); listen(image, 'error', sync);
  });
  listen(document, 'risk:state', event => { snapshot = event.detail || {}; if (snapshot.protocol) protocol = snapshot.protocol; sync(); });
  listen(document, 'risk:protocol', event => {
    const next = event.detail || null;
    if (next?.game === 'bypass' && next.phase === 'active' && protocol?.game === 'bypass' && next.stops > (protocol.stops || 0)) {
      const device = devices.get('bypass'); device.stopTime = device.time; device.frame = -1;
    }
    protocol = next; sync();
  });
  listen(document, 'visibilitychange', sync); listen(media, 'change', sync);
  function getDiagnostics() {
    return { ready: !disposed && devices.size === 3 && [...devices.values()].every(ready), disposed, screen: window.RiskPresentation?.currentScreen() || snapshot.screen,
      visibleDevice: visible || null, phase: devices.get(visible)?.phase || null, frameRateLimit: FPS, frames: frameCount,
      ownedRAF: raf ? 1 : 0, ownedTimers: 0, canvasCount: devices.size + (exportCanvas ? 1 : 0), exportCanvasCount: exportCanvas ? 1 : 0,
      reducedMotion: !!(snapshot.preferences || snapshot).reducedMotion || media.matches, effectsLevel: (snapshot.preferences || snapshot).effectsLevel || 'full',
      devices: [...devices.values()].map(device => ({ game: device.game, ready: ready(device), visible: device.game === visible, phase: device.phase,
        time: device.time, draws: device.draws, ...device.stats })),
      limits: { liveCanvases: 3, authoringCanvases: 1, idleActiveSparks: 0, successfulStopSparks: 1, activeSweeps: 0, maximumLEDs: 8, lowMaximumLEDs: 4, maximumSparks: 1, maximumSweeps: 1 } };
  }
  function exportFrame(time = 0, options = {}) {
    if (disposed) return { image: null, width: W, height: H, error: 'disposed' };
    const device = devices.get(options.game);
    if (!device) return { image: null, width: W, height: H, error: 'unknown device' };
    if (!exportCanvas) { exportCanvas = document.createElement('canvas'); exportCanvas.width = W; exportCanvas.height = H; }
    const ctx = exportCanvas.getContext('2d'); ctx.clearRect(0, 0, W, H); ctx.imageSmoothingEnabled = false;
    if (options.includeBackground && ready(device)) ctx.drawImage(device.image, 0, 0, W, H);
    const stats = paint(ctx, time, options);
    try {
      return { image: exportCanvas.toDataURL('image/png'), width: W, height: H, game: device.game, time: finiteTime(time), ...stats };
    } catch (error) {
      // A file-origin authoring preview can forbid reading imported pixels.
      // Reset its one scratch canvas so a later transparent export still works.
      exportCanvas.width = W;
      return { image: null, width: W, height: H, game: device.game, error: 'Image export requires a readable local origin, such as localhost.' };
    }
  }
  function dispose() {
    if (disposed) return;
    disposed = true; cancelAnimationFrame(raf); raf = 0; visible = '';
    removers.splice(0).forEach(remove => remove());
    devices.forEach(device => { device.canvas.remove(); delete device.node.dataset.protocolLife; }); devices.clear(); exportCanvas = null;
  }
  listen(window, 'beforeunload', dispose);
  window.RelayProtocolLife = Object.freeze({ getDiagnostics, exportFrame, dispose,
    getDefinition: () => freeze({ version: 1, nativeSize: [W, H], fps: FPS, devices: definitions }) });
  sync();
})();

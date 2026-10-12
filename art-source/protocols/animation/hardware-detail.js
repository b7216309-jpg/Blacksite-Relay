/* Read-only film detail: unchanged native backplate + the actual live effect canvas.
 * No controls, timing, phase, decorative seed or gameplay state is altered here.
 */
(function () {
  'use strict';
  const cache = new WeakMap();
  const crops = {
    typing: { square: [262, 385, 128, 128], wide: [37, 390, 346, 123], label: 'INJECTION / BEZEL CIRCUITRY' },
    backdoor: { square: [65, 475, 128, 128], wide: [37, 480, 346, 123], label: 'MEMORY / COPPER BUS' },
    bypass: { square: [146, 155, 128, 128], wide: [37, 140, 346, 123], label: 'BYPASS / CENTRAL COUPLER' }
  };
  function snapshot(frame, game) {
    const doc = frame.contentDocument;
    const wrapper = doc.querySelector('[data-protocol-device="' + game + '"]');
    const art = wrapper?.querySelector('.protocol-art');
    const effects = wrapper?.querySelector('[data-protocol-life-canvas="' + game + '"]');
    if (!art?.complete || !art.naturalWidth || !effects?.width) return null;
    let entry = cache.get(frame);
    if (!entry) { entry = {}; cache.set(frame, entry); }
    if (!entry[game]) {
      const canvas = document.createElement('canvas'); canvas.width = 420; canvas.height = 650;
      entry[game] = { canvas, sampled: false };
    }
    const item = entry[game];
    const visible = wrapper.getClientRects().length > 0 && frame.contentWindow.getComputedStyle(wrapper).visibility !== 'hidden';
    if (visible || !item.sampled) {
      const c = item.canvas.getContext('2d'); c.imageSmoothingEnabled = false;
      c.clearRect(0, 0, 420, 650); c.drawImage(art, 0, 0, 420, 650);
      c.drawImage(effects, 0, 0, 420, 650);
      const shade = c.createLinearGradient(0, 0, 0, 650);
      for (const [stop, color] of [[0, '#02070ba6'], [.12, '#02070b52'], [.2, '#02070b00'], [.8, '#02070b00'], [.9, '#02070b91'], [1, '#02070bbc']]) shade.addColorStop(stop, color);
      c.fillStyle = shade; c.fillRect(0, 0, 420, 650); item.sampled = true;
    }
    return { canvas: item.canvas, live: visible, game, phase: wrapper.dataset.phase, label: crops[game].label };
  }
  function draw(target, frame, game, format = 'square') {
    const sample = snapshot(frame, game); if (!sample) return null;
    const [x, y, w, h] = crops[game][format];
    const c = target.getContext('2d'); c.imageSmoothingEnabled = false;
    c.fillStyle = '#071015'; c.fillRect(0, 0, target.width, target.height);
    const scale = Math.min(target.width / w, target.height / h);
    const dw = w * scale, dh = h * scale;
    c.drawImage(sample.canvas, x, y, w, h, Math.floor((target.width - dw) / 2), Math.floor((target.height - dh) / 2), dw, dh);
    return { game, phase: sample.phase, live: sample.live, label: sample.label, sourceCrop: [x, y, w, h], scale };
  }
  window.ProtocolMediaDetail = Object.freeze({ draw, getDefinition: () => JSON.parse(JSON.stringify(crops)) });
})();

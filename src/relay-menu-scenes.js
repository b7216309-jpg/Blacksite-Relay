/* Adjacent Blacksite rooms. Presentation only: no gameplay state writes or RNG. */
(() => {
  'use strict';
  if (window.RelayMenuScenes) return;
  const definitions = [
    { screen: 'persistent', id: 'screen-persistent', art: 'workbench', offset: 60, lights: [[330,64,0],[98,65,1],[362,148,2]], crt: [[310,48],[332,58],[332,85],[310,76]] },
    { screen: 'achievements', id: 'screen-achievements', art: 'records', offset: 80, lights: [[346,127,1],[347,145,2],[278,166,0]], crt: [[279,76],[306,88],[306,115],[279,102]] },
    { screen: 'leaderboard', id: 'screen-leaderboard', art: 'signal', offset: 25, lights: [[302,103,0],[301,116,2],[95,93,1]], crt: [[191,73],[216,83],[216,109],[191,99]] },
    { screen: 'settings', id: 'screen-settings', art: 'controls', offset: 60, lights: [[155,91,0],[195,102,1],[344,172,2]], crt: null },
    { screen: 'tutorial', id: 'screen-tutorial', art: 'briefing', offset: 75, lights: [[337,127,0],[276,106,2]], crt: [[309,53],[345,67],[345,102],[309,87]] }
  ];
  const rooms = [], removers = [];
  let state = window.RiskPresentation?.snapshot() || {}, raf = 0, lastFrame = -Infinity, disposed = false;
  let active = null, elapsed = 0, previousTime = 0;
  function listen(target, name, callback) {
    target.addEventListener(name, callback); removers.push(() => target.removeEventListener(name, callback));
  }
  function moving() {
    const preferences = state.preferences || state;
    return !disposed && !document.hidden && !preferences.reducedMotion && preferences.effectsLevel !== 'off';
  }
  function paint(room, time = 0) {
    if (!room?.context || !room.ready) { if (room?.screen === 'tutorial') window.RelaySecretRooms?.drawGuide?.(time / 1000, { isStatic:true }); return; }
    const ctx = room.context;
    ctx.clearRect(0, 0, 420, 650);
    ctx.fillStyle = '#070e13'; ctx.fillRect(0, 0, 420, 650);
    ctx.drawImage(room.image, 0, -room.offset, 420, 630);
    if (!moving()) { if (room.screen === 'tutorial') window.RelaySecretRooms?.drawGuide?.(time / 1000, { isStatic:true }); return; }
    const low = (state.preferences || state).effectsLevel === 'low';
    if (room.crt) {
      ctx.save(); ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = `rgba(140,231,199,${(low ? .012 : .023) + Math.sin(time * .0007) * .007})`;
      ctx.beginPath(); room.crt.forEach(([x,y], i) => i ? ctx.lineTo(x,y) : ctx.moveTo(x,y)); ctx.closePath(); ctx.fill(); ctx.restore();
    }
    room.lights.forEach(([x,y,phase], index) => {
      const beat = (Math.floor(time / 190) + phase * 7) % (23 + index * 4);
      const bright = beat === 0 || beat === 2;
      ctx.fillStyle = bright ? (index % 2 ? '#e9c886' : '#99d6bd') : '#537267';
      ctx.globalAlpha = bright ? (low ? .45 : .8) : .38;
      ctx.fillRect(x, y, 2, 1);
      if (bright && !low) { ctx.globalAlpha = .07; ctx.fillRect(x - 1, y - 1, 4, 3); }
      ctx.globalAlpha = 1;
    });
    if (room.screen === 'tutorial') window.RelaySecretRooms?.drawGuide?.(time / 1000, { isStatic:false, low });
  }
  function stop() { if (raf) cancelAnimationFrame(raf); raf = 0; previousTime = 0; }
  function frame(now) {
    raf = 0;
    if (!active || !active.ready || !active.context || !moving()) return;
    elapsed += previousTime ? Math.min(100, now - previousTime) : 0; previousTime = now;
    if (now - lastFrame >= 1000 / 24) { paint(active, elapsed); lastFrame = now; }
    raf = requestAnimationFrame(frame);
  }
  function sync() {
    if (disposed) return;
    const next = rooms.find(room => room.screen === state.screen) || null;
    if (next !== active) { stop(); active = next; lastFrame = -Infinity; }
    rooms.forEach(room => { room.host.dataset.submenuActive = String(room === active); });
    if (!moving() || !active?.ready || !active.context) { stop(); if (active) paint(active); return; }
    paint(active, elapsed);
    if (!raf) raf = requestAnimationFrame(frame);
  }
  for (const definition of definitions) {
    const host = document.getElementById(definition.id);
    if (!host) continue;
    host.dataset.submenuScene = definition.art;
    const mount = document.createElement('div'); mount.className = 'submenu-artwork'; mount.setAttribute('aria-hidden', 'true');
    const source = 'assets/menus/' + definition.art + '.png';
    mount.style.backgroundImage = `url("${source}")`;
    mount.style.backgroundPosition = `center -${definition.offset}px`;
    const canvas = document.createElement('canvas'); canvas.width = 420; canvas.height = 650;
    canvas.dataset.submenuCanvas = definition.screen;
    const shade = document.createElement('div'); shade.className = 'submenu-shade';
    mount.append(canvas, shade); host.prepend(mount);
    const context = canvas.getContext('2d'); if (context) context.imageSmoothingEnabled = false;
    const image = new Image();
    const room = { ...definition, host, mount, canvas, context, image, ready: false, error: false };
    rooms.push(room);
    image.onload = () => { if (disposed) return; room.ready = true; paint(room); sync(); };
    image.onerror = () => { room.error = true; sync(); };
    image.src = source;
  }
  listen(document, 'risk:state', event => { state = event.detail || {}; sync(); });
  listen(document, 'visibilitychange', sync);
  function dispose() {
    if (disposed) return;
    disposed = true; stop(); removers.splice(0).forEach(remove => remove());
    rooms.forEach(room => { room.image.onload = null; room.image.onerror = null; room.mount.remove(); }); active = null;
  }
  listen(window, 'beforeunload', dispose);
  window.RelayMenuScenes = Object.freeze({
    dispose,
    getDiagnostics: () => Object.freeze({
      ready: rooms.length === 5 && rooms.every(room => room.ready),
      error: rooms.some(room => room.error), disposed,
      activeRoom: active?.art || null, ownedRAF: raf ? 1 : 0, ownedTimers: 0,
      canvasCount: rooms.length,
      rooms: rooms.map(({screen, art, ready, error, context}) => ({screen, art, ready, error, staticFallback: !context}))
    })
  });
  sync();
})();

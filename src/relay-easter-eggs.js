/* Scenery interactions share the existing scene clocks. No gameplay mutations. */
(() => {
  'use strict';
  if (!window.RelaySecretState || window.RelayEasterEggs) return;
  const t = (key, fallback, params = {}) => window.RiskI18n?.t(key, params) ?? fallback.replace(/\{(\w+)\}/g, (_, name) => params[name] ?? '');
  const model = window.RelaySecretState.create(), listeners = [], buttons = new Map(), timers = new Map();
  const miniScreens = new Set(['typing', 'backdoor', 'bypass']);
  const sceneHost = document.querySelector('.diorama'), guideHost = document.querySelector('.guide-hero');
  let state = window.RiskPresentation?.snapshot() || { screen: 'menu' }, disposed = false, lastSceneTime = 0, lastSceneOptions = {}, lastGuideTime = 0, pressed = null, lastDiscovery = null, currentCaption = '';
  const silent = document.createElement('div'); silent.className = 'secret-a11y'; silent.setAttribute('role', 'status'); silent.setAttribute('aria-live', 'polite'); document.body.append(silent);
  const note = document.createElement('div'); note.className = 'secret-whisper'; note.hidden = true; sceneHost?.append(note);
  const layers = {};
  for (const [name, host] of [['scene', sceneHost], ['guide', guideHost]]) {
    if (!host) continue;
    const layer = document.createElement('div'); layer.className = 'secret-hit-layer'; layer.hidden = true; layer.dataset.secretSurface = name; host.append(layer); layers[name] = layer;
  }
  const listen = (target, event, fn, options) => { target.addEventListener(event, fn, options); listeners.push(() => target.removeEventListener(event, fn, options)); };
  const motionOff = () => !!state.reducedMotion || state.effectsLevel === 'off';
  const hide = (node, value) => { if (node && node.hidden !== value) node.hidden = value; };
  function allowed(domain) {
    if (disposed || document.hidden || window.RiskSaveLoading || window.RiskSaveReadBlocked) return false;
    const current = window.RiskPresentation?.currentScreen?.() || state.screen;
    return domain === 'scene' ? current === 'game' : current === 'tutorial' && document.getElementById('screen-tutorial')?.dataset.guideCurrent === 'overview';
  }
  function repaint() { window.BlacksiteScene?.setState({}); if (allowed('guide')) window.RelaySecretRooms?.drawGuide?.(lastGuideTime,{isStatic:motionOff()}); }
  function updateStaticTimers() {
    const active = model.diagnostics().active;
    for (const [key, run] of timers) {
      if (!active.includes(key)) { clearTimeout(run.handle); timers.delete(key); continue; }
      const canRun = allowed(key === 'room404' ? 'guide' : 'scene');
      if (!canRun && run.handle) { clearTimeout(run.handle); run.handle = null; run.remaining = Math.max(0, run.deadline - performance.now()); }
      if (canRun && !run.handle) {
        run.deadline = performance.now() + run.remaining;
        run.handle = setTimeout(() => { timers.delete(key); model.finish(key); repaint(); }, run.remaining);
      }
    }
  }
  function finishStatic(key) {
    if (timers.has(key)) clearTimeout(timers.get(key).handle);
    timers.set(key, { handle: null, remaining: 6000, deadline: 0 }); updateStaticTimers();
  }
  const messages = {
    ratUnion: 'Rat Union: break time.', rootAccess: 'Root Access: sudo purr.',
    snailMail: 'Snail Mail. Delivery estimate: eventually.', locker: 'The Missing Technician is out to lunch.', room404: 'Room 404. A relay inside the relay.'
  };
  function trigger(id, extra = {}) {
    const domain = id.startsWith('led-') ? 'guide' : 'scene';
    if (!allowed(domain)) return null;
    const residents = window.RelayPets?.getDiagnostics?.().residents || [];
    const snail = residents.find(p => p.id === 'coil-snail');
    const phase = Math.floor((snail?.phase || lastSceneTime) * 12) / 12 % 19.7;
    const result = model.act(id, { origins: residents, feelers: phase > 4.4 && phase < 5.6, ...extra });
    window.RelayAudio?.unlock?.();
    if (result) {
      lastDiscovery = result;
      silent.textContent = t('extra.secret.' + result, messages[result]);
      window.RelayAudio?.play?.('egg-' + ({ ratUnion: 'rat', rootAccess: 'cat', snailMail: 'snail', locker: 'locker', room404: 'arcade' }[result]));
      if (motionOff()) finishStatic(result);
      document.dispatchEvent(new CustomEvent('risk:discovery', { detail: Object.freeze({ id: result }) }));
    } else if (id === 'locker') window.RelayAudio?.play?.('egg-knock', { volume: .55 });
    repaint(); return result;
  }
  function knock(milliseconds) {
    if (!Number.isFinite(milliseconds) || milliseconds < 0 || milliseconds > 2500) return;
    if (milliseconds <= 450) trigger('locker', { knock: 'short' });
    else if (milliseconds >= 650) trigger('locker', { knock: 'long' });
  }
  function addButton(id, key, label, domain, params = {}) {
    if (!layers[domain]) return;
    const button = document.createElement('button'); button.type = 'button'; button.className = 'secret-hit';
    button.dataset.secretId = id;
    const refreshLabel = () => { const value = t(key, label, params); button.setAttribute('aria-label', value); button.title = value; };
    refreshLabel(); listen(document, 'risk:language', refreshLabel);
    layers[domain].append(button); buttons.set(id, button);
    listen(button, 'click', e => { e.stopPropagation(); if (id !== 'locker') trigger(id); else if (e.detail === 0 && !pressed) knock(0); });
    // Space on a focused decorative target must never execute Transfer or Stop Scanner.
    listen(button, 'keydown', e => {
      if (!['Space', 'Enter'].includes(e.code)) return;
      e.preventDefault(); e.stopPropagation();
      if (e.repeat) return;
      if (id === 'locker') pressed = { kind: 'key', key: e.code, at: performance.now(), button };
      else trigger(id);
    });
    listen(button, 'keyup', e => {
      if (!['Space', 'Enter'].includes(e.code)) return;
      e.preventDefault(); e.stopPropagation();
      if (id === 'locker' && pressed?.kind === 'key' && pressed.key === e.code) { const elapsed = performance.now() - pressed.at; pressed = null; knock(elapsed); }
    });
    if (id === 'locker') {
      listen(button, 'pointerdown', e => { if (e.button !== 0 || !allowed(domain)) return; e.preventDefault(); button.focus({ preventScroll: true }); pressed = { kind: 'pointer', pointerId: e.pointerId, at: performance.now(), button }; button.setPointerCapture?.(e.pointerId); });
      listen(button, 'pointerup', e => { if (pressed?.kind !== 'pointer' || pressed.pointerId !== e.pointerId) return; const elapsed = performance.now() - pressed.at; pressed = null; button.releasePointerCapture?.(e.pointerId); knock(elapsed); });
      listen(button, 'pointercancel', () => { pressed = null; });
      listen(button, 'lostpointercapture', () => { pressed = null; });
    }
    listen(button, 'blur', () => { if (pressed?.button === button) pressed = null; });
  }
  addButton('cable-rat', 'extra.secret.cableRat', 'Tap the cable rat', 'scene'); addButton('rack-rat', 'extra.secret.rackRat', 'Tap the rack rat', 'scene');
  addButton('server-cat', 'extra.secret.cat', 'Pet the server cat', 'scene'); addButton('coil-snail', 'extra.secret.snail', 'Inspect the courier snail', 'scene');
  addButton('locker', 'extra.secret.knock', 'Knock on the maintenance locker', 'scene');
  for (let i = 0; i < 4; i++) addButton('led-' + i, 'extra.secret.led', 'Inspect service LED {number}', 'guide', { number: i + 1 });
  const captions = { purr: 'sudo purr', delivery: 'DELIVERY ESTIMATE: EVENTUALLY', lunch: 'OUT TO LUNCH' };
  function paintCaption() {
    const caption = currentCaption ? t('extra.secret.' + currentCaption, captions[currentCaption]) : '';
    if (note.textContent !== caption) note.textContent = caption;
  }
  function box(button, bounds, host) {
    if (!button || !host) return;
    const width = host.clientWidth, height = host.clientHeight;
    const w = Math.min(width, Math.max(16, bounds.w)), h = Math.min(height, Math.max(18, bounds.h));
    const x = Math.max(0, Math.min(width - w, bounds.x + (bounds.w - w) / 2));
    const y = Math.max(0, Math.min(height - h, bounds.y + (bounds.h - h) / 2));
    button.style.left = Math.round(x) + 'px'; button.style.top = Math.round(y) + 'px'; button.style.width = Math.round(w) + 'px'; button.style.height = Math.round(h) + 'px';
  }
  function updateSceneTargets(canvas, t, options) {
    if (disposed || !sceneHost || canvas.id !== 'relay-scene') return;
    const rect = canvas.getBoundingClientRect(), hostRect = sceneHost.getBoundingClientRect();
    const scale = Math.max(canvas.width / 1536, canvas.height / 1024), ox = (canvas.width - 1536 * scale) * .5, oy = (canvas.height - 1024 * scale) * .48;
    const residents = window.RelayPets?.getDiagnostics?.().residents || [];
    const sizes = { rat: [30,16,18,12,1], cat: [28,22,15,18,1], snail: [21,18,11,14,.65] };
    const sx = rect.width / canvas.width, sy = rect.height / canvas.height;
    for (const p of residents) {
      const [w,h,px,py,size] = sizes[p.kind], unit = 1536/420 * size;
      const left = p.x - (p.facing < 0 ? w-px : px) * unit;
      box(buttons.get(p.id), { x: (left * scale + ox)*sx + rect.left-hostRect.left, y: ((p.y-py*unit)*scale+oy)*sy + rect.top-hostRect.top, w: w*unit*scale*sx, h: h*unit*scale*sy }, sceneHost);
    }
    const layout = window.RelaySecretRooms?.getLayout?.(), locker = layout?.locker;
    if (locker) { const [x,y,w,h] = Array.isArray(locker) ? locker : [locker.x,locker.y,locker.w,locker.h]; box(buttons.get('locker'), {x:(x*scale+ox)*sx,y:(y*scale+oy)*sy,w:w*scale*sx,h:h*scale*sy},sceneHost); }
    const secrets = model.snapshot('scene');
    currentCaption = secrets.rootAccess.active && secrets.rootAccess.elapsed > 1.2 ? 'purr' : secrets.snailMail.active && secrets.snailMail.elapsed > 1.2 ? 'delivery' : secrets.locker.active && secrets.locker.elapsed > 2 ? 'lunch' : '';
    paintCaption();
    hide(note, !currentCaption || !allowed('scene'));
  }
  function guideFrame(t, options = {}) {
    if (disposed) return;
    lastGuideTime = t; model.advance('guide', t, !!options.isStatic);
    const layout = window.RelaySecretRooms?.getLayout?.();
    (layout?.guideLEDs || []).forEach((bounds, i) => box(buttons.get('led-'+i), bounds, guideHost));
    hide(layers.guide, !allowed('guide'));
  }
  function sync(next = state) {
    const previous = state; state = next;
    for (const [domain, layer] of Object.entries(layers)) hide(layer, !allowed(domain));
    if (!allowed('scene')) { hide(note, true); pressed = null; }
    if (state.screen !== previous.screen) {
      model.rebase('scene'); model.rebase('guide');
      if (state.screen !== 'game' && !miniScreens.has(state.screen)) model.reset('scene');
      if (state.screen !== 'tutorial') model.reset('guide');
    }
    if (state.reducedMotion !== previous.reducedMotion || state.effectsLevel !== previous.effectsLevel) {
      model.rebase('scene'); model.rebase('guide');
      if (motionOff()) for (const id of model.diagnostics().active) finishStatic(id);
      else { for (const timer of timers.values()) clearTimeout(timer.handle); timers.clear(); }
    }
    updateStaticTimers();
    if (miniScreens.has(state.screen) || !['game', 'tutorial'].includes(state.screen)) for (const name of ['rat','cat','snail','locker','arcade','knock']) window.RelayAudio?.stop?.('egg-' + name);
  }
  listen(document, 'risk:state', e => sync(e.detail || {}));
  listen(document, 'risk:language', () => {
    // Translate only revealed copy; do not replay discoveries, advance timers or move focus.
    if (lastDiscovery) silent.textContent = t('extra.secret.' + lastDiscovery, messages[lastDiscovery]);
    paintCaption();
  });
  listen(document, 'visibilitychange', () => { pressed = null; model.rebase('scene'); model.rebase('guide'); sync(); });
  // Guide sub-pages share one screen; they must disable hidden LED targets immediately.
  const guide = document.getElementById('screen-tutorial');
  const observer = guide ? new MutationObserver(() => { if (guide.dataset.guideCurrent !== 'overview') model.reset('guide'); sync(); }) : null;
  observer?.observe(guide, { attributes: true, attributeFilter: ['data-guide-current'] });
  function dispose() {
    if (disposed) return; disposed = true;
    listeners.splice(0).forEach(remove => remove()); observer?.disconnect();
    for (const timer of timers.values()) clearTimeout(timer.handle); timers.clear();
    Object.values(layers).forEach(layer => layer.remove()); silent.remove(); note.remove(); buttons.clear();
    model.reset('scene'); model.reset('guide');
  }
  listen(window, 'beforeunload', dispose); listen(window, 'pagehide', dispose);
  window.RelayEasterEggs = Object.freeze({
    prepareFrame(canvas,t,options={}) { if(disposed||canvas.id!=='relay-scene')return; lastSceneTime=t;lastSceneOptions=options;model.advance('scene',t,!!options.isStatic); },
    afterFrame: updateSceneTargets, guideFrame,
    getSceneState(t=lastSceneTime,o=lastSceneOptions) { model.advance('scene',t,!!o.isStatic);return model.snapshot('scene'); },
    getGuideState(t=lastGuideTime,isStatic=motionOff()) { model.advance('guide',t,isStatic);return model.snapshot('guide'); },
    getDiagnostics: () => Object.freeze({...model.diagnostics(),disposed,screen:state.screen,ownTimers:[...timers.values()].filter(run=>run.handle).length,pausedReveals:[...timers.values()].filter(run=>!run.handle).length,ownAnimationFrames:0,targets:buttons.size}), dispose
  });
  sync(); repaint();
})();

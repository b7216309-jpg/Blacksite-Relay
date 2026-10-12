/* Small, mounted hardware details. This layer never advances or resolves play. */
(() => {
  'use strict';
  if (window.RelayScreenLife) return;
  const contacts = [], keys = new Map(), activeGlints = new Map();
  const listeners = [];
  let disposed = false;
  let state = window.RiskPresentation?.snapshot() || {};
  let protocol = window.RiskPresentation?.protocol() || null;
  const quietProtocols = new Set(['typing', 'backdoor', 'bypass']);

  function listen(target, type, callback) {
    target.addEventListener(type, callback);
    listeners.push(() => target.removeEventListener(type, callback));
  }
  function mountContacts(selector, screen, position) {
    const host = document.querySelector(selector);
    if (!host) return;
    const rail = document.createElement('span');
    rail.className = 'screen-life-contacts screen-life-' + position;
    rail.setAttribute('aria-hidden', 'true');
    for (let index = 0; index < 3; index++) rail.appendChild(document.createElement('i'));
    host.appendChild(rail);
    contacts.push({ rail, screen });
  }
  mountContacts('.agent-field', 'menu', 'menu-contacts');
  mountContacts('.header', 'game', 'header-contacts');
  if (!window.RelayProtocolLife) {
    mountContacts('.terminal-game .device-indicator-mount', 'typing', 'terminal-contacts');
    mountContacts('.patch-game .device-indicator-mount', 'backdoor', 'patch-contacts');
    mountContacts('.calibration-game .device-indicator-mount', 'bypass', 'calibration-contacts');
  }

  document.querySelectorAll('.btn-hack, .bonus-section .btn-bonus').forEach(button => {
    const rail = document.createElement('span'), glint = document.createElement('i');
    rail.className = 'screen-life-key-edge';
    rail.setAttribute('aria-hidden', 'true');
    rail.appendChild(glint); button.appendChild(rail); keys.set(button, { rail, glint });
  });

  function motionAllowed() {
    const preferences = state.preferences || state;
    return !disposed && !document.hidden && !preferences.reducedMotion && preferences.effectsLevel !== 'off';
  }
  function clearGlints() {
    activeGlints.forEach(animation => animation.cancel());
    activeGlints.clear();
  }
  function sync() {
    const enabled = motionAllowed();
    const activeChallenge = quietProtocols.has(state.screen) &&
      (protocol?.game !== state.screen || protocol.phase === 'active');
    contacts.forEach(({ rail, screen }) => {
      rail.dataset.lifeMotion = String(enabled && state.screen === screen && !activeChallenge);
      rail.dataset.lifeLow = String((state.preferences || state).effectsLevel === 'low');
    });
    if (!enabled || state.screen !== 'game') clearGlints();
  }
  function respond(button) {
    const detail = keys.get(button);
    if (!detail || !motionAllowed() || state.screen !== 'game' || typeof detail.glint.animate !== 'function') return;
    activeGlints.get(button)?.cancel();
    const low = (state.preferences || state).effectsLevel === 'low';
    const animation = detail.glint.animate([
      { left: '0%', opacity: 0 },
      { left: '18%', opacity: low ? 0.35 : 0.7, offset: 0.2 },
      { left: '76%', opacity: 0 }
    ], { duration: 520, easing: 'ease-out', fill: 'none' });
    activeGlints.set(button, animation);
    animation.finished.then(() => {
      if (activeGlints.get(button) === animation) activeGlints.delete(button);
    }, () => {
      if (activeGlints.get(button) === animation) activeGlints.delete(button);
    });
  }
  listen(document, 'risk:state', event => { state = event.detail || {}; if (state.protocol) protocol = state.protocol; sync(); });
  listen(document, 'risk:protocol', event => { protocol = event.detail || null; sync(); });
  listen(document, 'risk:event', event => {
    const outcome = event.detail || {};
    if (outcome.type === 'hack') respond(document.querySelectorAll('.btn-hack')[Number(outcome.hackType) - 1]);
    if (outcome.type === 'bonus') respond(document.querySelectorAll('.bonus-section .btn-bonus')[Number(outcome.bonusId) - 1]);
  });
  listen(document, 'visibilitychange', sync);
  function dispose() {
    if (disposed) return;
    disposed = true; clearGlints(); listeners.splice(0).forEach(remove => remove());
    contacts.splice(0).forEach(({ rail }) => rail.remove());
    keys.forEach(({ rail }) => rail.remove()); keys.clear();
  }
  listen(window, 'beforeunload', dispose);
  window.RelayScreenLife = Object.freeze({
    dispose,
    stats: () => Object.freeze({
      disposed, contacts: contacts.length, keys: keys.size,
      activeGlints: activeGlints.size,
      movingContacts: contacts.filter(({ rail }) => rail.dataset.lifeMotion === 'true').length,
      animationFrameLoops: 0, timers: 0
    })
  });
  sync();
})();

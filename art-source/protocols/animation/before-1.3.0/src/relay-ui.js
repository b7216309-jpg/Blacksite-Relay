/* Blacksite interface enhancements. This module never resolves gameplay or uses its RNG. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const settings = $('screen-settings'), intro = $('screen-intro'), video = $('relay-intro-video');
  const tooltip = $('relay-tooltip'), notification = $('relay-notification');
  let state = {}, settingsFocus = null, introFocus = null, tooltipOwner = null;
  let hoverTooltipsArmed = true, lastPointerX = null, lastPointerY = null;
  let introResolve = null, introPromise = null, introTimer = 0, notificationTimer = 0, pendingNotification = '';
  const animatedButtons = new Map();
  let protocolState = null, protocolFrame = 0, protocolResultTimer = 0, protocolPulseTimer = 0;
  const protocolReceipt = $('protocol-outcome');
  const screenElements = {
    menu: 'main-menu', persistent: 'screen-persistent', tutorial: 'screen-tutorial',
    leaderboard: 'screen-leaderboard', achievements: 'screen-achievements',
    busted: 'screen-busted', success: 'screen-success', bypass: 'screen-bypass',
    typing: 'typing-container', backdoor: 'backdoor-container', settings: 'screen-settings', intro: 'screen-intro'
  };
  const refresh = () => window.RiskPresentation?.refresh();
  const shown = node => node && node.style.display === 'flex';
  const current = () => window.RiskPresentation?.currentScreen() || state.screen || 'menu';
  const updateText = (id, text) => { const node = $(id); if (node && node.textContent !== text) node.textContent = text; };
  const focusSafely = node => { if (node?.isConnected && node.getClientRects().length) node.focus({ preventScroll: true }); };
  const protocolDevices = [...document.querySelectorAll('[data-protocol-device]')];
  const systemReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  function syncProtocolArtwork() {
    const preferences = state.preferences || state;
    const enabled = !document.hidden && !preferences.reducedMotion && preferences.effectsLevel !== 'off' && !systemReducedMotion.matches;
    protocolDevices.forEach(device => {
      const visible = current() === device.dataset.protocolDevice;
      const phase = device.dataset.phase;
      device.dataset.deviceFeedback = String(enabled && visible);
      device.dataset.deviceMotion = enabled && visible && phase !== 'active' ? (phase === 'result' ? 'resolved' : 'prepare') : 'off';
    });
  }
  protocolDevices.forEach(device => {
    const artwork = device.querySelector('.protocol-art');
    const loaded = () => { device.dataset.artState = artwork.naturalWidth > 0 ? 'ready' : 'fallback'; };
    artwork.addEventListener('load', loaded);
    artwork.addEventListener('error', () => { device.dataset.artState = 'fallback'; });
    if (artwork.complete) loaded();
  });
  function getProtocolDiagnostics() {
    const devices = protocolDevices.map(device => {
      const artwork = device.querySelector('.protocol-art');
      const decorativeAnimations = device.getAnimations({ subtree: true }).filter(animation => animation.playState === 'running' &&
        /^(deviceAccess|screenLifeContact)$/.test(animation.animationName || '')).map(animation => animation.animationName);
      return { game: device.dataset.protocolDevice, ready: device.dataset.artState === 'ready', imageState: device.dataset.artState || 'loading',
        naturalSize: [artwork.naturalWidth, artwork.naturalHeight], phase: device.dataset.phase, motion: device.dataset.deviceMotion,
        decorativeAnimations };
    });
    return { screen: current(), phase: protocolState?.phase || null, devices,
      decorativeAnimationCount: devices.reduce((count, device) => count + device.decorativeAnimations.length, 0), ownArtworkTimers: 0, ownArtworkAnimationFrames: 0 };
  }
  systemReducedMotion.addEventListener('change', syncProtocolArtwork);

  function onState(next = {}) {
    const screenChanged = state.screen !== next.screen;
    if (state.screen === 'persistent' && next.screen === 'game') {
      // Awards belong to the run that earned them. In-run protocol handoffs
      // still defer their new awards, but a fresh run must not revive old ones.
      clearTimeout(notificationTimer);
      pendingNotification = '';
      notification.hidden = true;
      notification.textContent = '';
    }
    if (screenChanged && ['typing', 'backdoor', 'bypass'].includes(state.screen)) {
      hoverTooltipsArmed = false;
      hideTooltip();
    }
    state = next;
    // A receipt may bridge the memory protocol's existing result delay, but it
    // belongs only to that handoff and gameplay, never to another destination.
    if (!['game', 'typing', 'backdoor', 'bypass'].includes(next.screen)) {
      protocolReceipt.hidden = true;
      clearTimeout(protocolResultTimer);
    }
    // The covered controls cannot receive Tab focus or mouse input through a modal.
    document.querySelector('.widget').inert = next.screen !== 'game';
    Object.entries(screenElements).forEach(([name, id]) => { $(id).inert = name !== next.screen; });
    if (screenChanged && !['typing', 'backdoor', 'settings', 'intro'].includes(next.screen)) {
      const destination = next.screen === 'game' ? document.querySelector('.btn-hack') : $(screenElements[next.screen])?.querySelector('button:not(:disabled)');
      if (!document.activeElement?.closest('#' + screenElements[next.screen])) focusSafely(destination);
    }
    const risk = Number(next.risk) || 0, danger = risk >= 75;
    updateText('trace-condition', danger ? 'CRITICAL / EXTRACT' : risk >= 45 ? 'TRACE RISING' : 'STABLE');
    if (next.bypassCharge !== undefined) updateText('bypass-charge', (next.bypassCharge >= next.bypassChargeMax ? 'READY ' : 'CHARGING ') + next.bypassCharge + '/' + next.bypassChargeMax);
    if (next.bonusStatuses) next.bonusStatuses.forEach((status, index) => {
      const label = $('bonus-status-' + (index + 1)), price = $('price-' + (index + 1));
      if (!label || !price) return;
      const button = price.parentElement;
      updateText(label.id, status);
      button.dataset.cooldown = String(status.includes('HACKS') || status === 'LOCKED');
      button.dataset.active = String(status === 'ACTIVE');
      button.setAttribute('aria-disabled', String(next.bonusAvailable?.[index] === false));
      button.setAttribute('aria-label', button.querySelector('strong').textContent + ', ' + price.textContent + ', ' + status);
      price.title = next.bonusCosts ? '$' + next.bonusCosts[index].toLocaleString('en-US', { maximumFractionDigits: 2 }) : price.textContent;
    });
    const preferences = next.preferences || next;
    if (typeof preferences.reducedMotion === 'boolean') $('reduced-motion-toggle').checked = preferences.reducedMotion;
    if (['full', 'low', 'off'].includes(preferences.effectsLevel)) $('effects-quality').value = preferences.effectsLevel;
    for (const [key, prefix] of [['musicVolume', 'music'], ['sfxVolume', 'sfx']]) {
      if (Number.isFinite(next[key])) {
        if (document.activeElement !== $(prefix + '-slider')) $(prefix + '-slider').value = next[key];
        updateText(prefix + '-vol-val', Math.round(next[key] * 100) + '%');
      }
    }
    const money = $('money-text');
    money?.classList.toggle('compact-number', money.textContent.length > 10);
    if (next.screen !== 'game') hideTooltip();
    if (next.protocol && next.protocol !== protocolState) onProtocol(next.protocol);
    syncProtocolArtwork();
    if (['typing', 'backdoor', 'bypass', 'intro'].includes(next.screen)) {
      if (!notification.hidden) pendingNotification = notification.textContent;
      notification.hidden = true; clearTimeout(notificationTimer);
    } else if (pendingNotification) {
      const pending = pendingNotification; pendingNotification = ''; notify(pending);
    }
  }

  function showSettings() {
    if (!['menu', 'persistent', 'game'].includes(current())) return false;
    settingsFocus = document.activeElement;
    settings.style.display = 'flex';
    hideTooltip(); refresh(); focusSafely($('music-slider'));
    window.RelayAudio?.play('click');
    return true;
  }
  function hideSettings() {
    if (!shown(settings) || shown(intro)) return;
    settings.style.display = 'none';
    window.saveGameState?.(); refresh(); focusSafely(settingsFocus);
    window.RelayAudio?.play('click');
  }

  function showIntro({ replay = false } = {}) {
    if (introPromise) return introPromise;
    if (['typing', 'backdoor', 'bypass'].includes(current())) return Promise.resolve(false);
    introFocus = document.activeElement;
    introPromise = new Promise(resolve => { introResolve = resolve; });
    intro.classList.toggle('is-replay', replay);
    intro.style.display = 'flex';
    video.muted = true; video.currentTime = 0;
    hideTooltip(); refresh(); focusSafely($('skip-intro'));
    // A bounded fallback ensures an unavailable/unsupported local video never blocks startup.
    introTimer = window.setTimeout(hideIntro, 6000);
    if (video.error) { queueMicrotask(hideIntro); }
    else { const play = video.play(); if (play?.catch) play.catch(hideIntro); }
    if (replay) window.RelayAudio?.unlock().then(() => { if (shown(intro)) window.RelayAudio.play('intro'); });
    return introPromise;
  }
  function hideIntro() {
    if (!introResolve) return;
    clearTimeout(introTimer); introTimer = 0;
    video.pause(); intro.style.display = 'none'; window.RelayAudio?.stop?.('intro');
    const resolve = introResolve; introResolve = null; introPromise = null;
    window.RiskPresentation?.setPreferences({ introSeen: true });
    refresh(); focusSafely(introFocus); resolve(true);
  }
  video.addEventListener('ended', hideIntro);
  video.addEventListener('error', hideIntro);

  function showTooltip(button) {
    const source = button?.querySelector('.tooltip');
    if (!source || current() !== 'game') return;
    tooltipOwner = button;
    tooltip.textContent = source.textContent;
    tooltip.hidden = false;
    button.setAttribute('aria-describedby', tooltip.id);
    const rect = button.getBoundingClientRect(), tip = tooltip.getBoundingClientRect();
    const left = Math.max(8, Math.min(window.innerWidth - tip.width - 8, rect.left + rect.width / 2 - tip.width / 2));
    const above = rect.top - tip.height - 9;
    tooltip.style.left = left + 'px';
    tooltip.style.top = Math.max(8, Math.min(window.innerHeight - tip.height - 8, above >= 8 ? above : rect.bottom + 9)) + 'px';
  }
  function hideTooltip() {
    tooltip.hidden = true;
    tooltipOwner?.removeAttribute('aria-describedby'); tooltipOwner = null;
  }
  document.querySelectorAll('.bonus-section .btn-bonus').forEach(button => {
    button.addEventListener('pointerenter', () => { if (hoverTooltipsArmed) showTooltip(button); });
    button.addEventListener('pointerleave', hideTooltip);
    button.addEventListener('focus', () => showTooltip(button));
    button.addEventListener('blur', hideTooltip);
    button.addEventListener('click', hideTooltip);
  });
  document.addEventListener('pointermove', event => {
    const moved = event.clientX !== lastPointerX || event.clientY !== lastPointerY;
    lastPointerX = event.clientX; lastPointerY = event.clientY;
    if (!moved || hoverTooltipsArmed || current() !== 'game') return;
    hoverTooltipsArmed = true;
    showTooltip(event.target.closest?.('.bonus-section .btn-bonus'));
  }, { passive: true });
  window.addEventListener('resize', hideTooltip);
  const memoryGrid = $('backdoor-grid');
  // This is a typing challenge. Clipboard/drop insertion must not submit a
  // complete command while ordinary typing, correction and IME remain native.
  const typingField = $('typing-input');
  typingField.addEventListener('beforeinput', event => {
    if (['insertFromPaste', 'insertFromDrop'].includes(event.inputType)) event.preventDefault();
  });
  typingField.addEventListener('paste', event => event.preventDefault());
  typingField.addEventListener('drop', event => event.preventDefault());
  const memoryObserver = new MutationObserver(() => {
    [...memoryGrid.children].forEach((cell, index) => {
      const portLabel = 'Patch port ' + String.fromCharCode(65 + Math.floor(index / 8)) + (index % 8 + 1);
      const portState = ({ target: ', illuminated', correct: ', connected', wrong: ', incorrect selection' })[cell.dataset.state] || '';
      cell.setAttribute('aria-label', portLabel + portState);
      cell.setAttribute('aria-pressed', String(['correct', 'wrong'].includes(cell.dataset.state)));
      if (cell.dataset.keyboardReady) return;
      cell.dataset.keyboardReady = 'true';
      cell.tabIndex = index === 0 ? 0 : -1; cell.setAttribute('role', 'button');
      cell.addEventListener('keydown', event => {
        const direction = { ArrowUp: -8, ArrowDown: 8, ArrowLeft: -1, ArrowRight: 1 }[event.key];
        if (current() === 'backdoor' && direction) {
          event.preventDefault(); event.stopPropagation();
          const targetIndex = Math.max(0, Math.min(63, index + direction));
          if ((direction === -1 && index % 8 === 0) || (direction === 1 && index % 8 === 7)) return;
          [...memoryGrid.children].forEach(item => { item.tabIndex = -1; });
          const target = memoryGrid.children[targetIndex]; target.tabIndex = 0; focusSafely(target);
          return;
        }
        if (current() === 'backdoor' && ['Enter', ' '].includes(event.key) && !event.repeat) {
          event.preventDefault(); event.stopPropagation(); cell.click();
        }
      });
    });
  });
  memoryObserver.observe(memoryGrid, { childList: true, attributes: true, subtree: true, attributeFilter: ['data-state'] });
  $('reduced-motion-toggle').addEventListener('change', event => window.RiskPresentation?.setPreferences({ reducedMotion: event.target.checked }));
  $('effects-quality').addEventListener('change', event => window.RiskPresentation?.setPreferences({ effectsLevel: event.target.value }));

  function notify(message) {
    clearTimeout(notificationTimer);
    if (['typing', 'backdoor', 'bypass', 'intro'].includes(current())) { pendingNotification = message; return; }
    notification.textContent = message; notification.hidden = false;
    notificationTimer = window.setTimeout(() => { notification.hidden = true; }, 3500);
  }
  function pulse(button) {
    if (!button || state.reducedMotion) return;
    clearTimeout(animatedButtons.get(button));
    button.classList.remove('signal-action');
    // Force one layout only on an action, never on the animation frame loop.
    void button.offsetWidth;
    button.classList.add('signal-action');
    animatedButtons.set(button, window.setTimeout(() => { button.classList.remove('signal-action'); animatedButtons.delete(button); }, 330));
  }
  const compactMoney = value => '$' + Number(value || 0).toLocaleString('en-US', { notation: 'compact', maximumFractionDigits: 1 });
  function setSlots(id, filled, className) {
    const slots = $(id);
    if (slots) [...slots.children].forEach((slot, index) => slot.classList.toggle(className, index < filled));
  }
  function drawProtocolClock() {
    protocolFrame = 0;
    const data = protocolState;
    if (!data || data.phase !== 'active' || !data.deadlineAt || current() !== data.game || document.hidden) return;
    const remaining = Math.max(0, data.deadlineAt - performance.now());
    const fraction = Math.max(0, Math.min(1, remaining / data.durationMs));
    const screen = data.game === 'typing' ? $('typing-container') : $('backdoor-container');
    const bar = $(data.game === 'typing' ? 'typing-time-fill' : 'backdoor-time-fill');
    if (bar) bar.style.transform = 'scaleX(' + fraction.toFixed(4) + ')';
    screen.dataset.urgent = String(remaining <= 2000);
    if (data.game === 'typing') {
      const value = (Math.ceil(remaining / 100) / 10).toFixed(1);
      const clock = $('typing-time-value');
      if (clock.dataset.value !== value) { clock.dataset.value = value; clock.innerHTML = value + '<small>s</small>'; }
    }
    // The game owns the deadline and its numeric memory display; this bar only interpolates it.
    if (remaining > 0) protocolFrame = requestAnimationFrame(drawProtocolClock);
  }
  function showProtocolReceipt(data) {
    clearTimeout(protocolResultTimer);
    const titles = {
      typing: data.success ? 'COMMAND ACCEPTED' : 'INJECTION REJECTED',
      backdoor: data.success ? 'HIDDEN ROUTE OPEN' : 'PATCH ROUTE LOST',
      bypass: data.rewardReduction > 0 ? 'TRACE DISRUPTED' : data.success ? 'COUPLER DISCONNECTED' : 'CALIBRATION LOST'
    };
    updateText('protocol-outcome-title', titles[data.game] || 'PROTOCOL COMPLETE');
    updateText('protocol-outcome-detail', data.rewardText || (data.success ? 'The relay is ready.' : 'Return to the relay.'));
    protocolReceipt.dataset.success = String(!!data.success);
    protocolReceipt.dataset.game = data.game;
    protocolReceipt.querySelector('use').setAttribute('href', ({ bypass: '#i-bolt', typing: '#i-chip', backdoor: '#i-hex' })[data.game] || '#i-shield');
    protocolReceipt.hidden = false;
    // The receipt owns this outcome; the status log resumes with the next action.
    $('log-container').replaceChildren();
    const life = protocolReceipt.querySelector('.outcome-lifetime');
    life.style.animation = 'none'; void life.offsetWidth; life.style.animation = '';
    // This receipt never captures input or changes the resolved game's screen.
    protocolResultTimer = window.setTimeout(() => { protocolReceipt.hidden = true; }, 2400);
  }
  function onProtocol(data = {}) {
    if (!data.game || data === protocolState) return;
    const previous = protocolState;
    protocolState = data;
    cancelAnimationFrame(protocolFrame); protocolFrame = 0;
    const element = $(screenElements[data.game]);
    if (!element) return;
    element.dataset.phase = data.phase;
    element.dataset.errors = String((data.errors || 0) > 0);
    element.dataset.urgent = 'false';
    if (data.phase === 'countdown' || (previous?.game !== data.game && data.phase === 'active')) {
      protocolReceipt.hidden = true; clearTimeout(protocolResultTimer);
    }
    if (data.game === 'bypass') {
      const stops = data.stops || 0, rawEarned = data.rewardReduction || 0;
      const risk = Math.max(0, Number(state.risk) || 0), earned = Math.min(risk, rawEarned);
      const earnedLabel = displayRiskPoints(earned);
      updateText('bypass-stop-count', String(stops).padStart(2, '0'));
      $('bypass-earned').innerHTML = '−' + earnedLabel + '<small> PTS</small>';
      element.dataset.rewardReady = String(rawEarned > 0);
      updateText('bypass-exit-label', rawEarned > 0 ? 'EXIT & APPLY' : 'EXIT');
      if (data.phase === 'active' && previous?.game === 'bypass' && stops > (previous.stops || 0)) {
        clearTimeout(protocolPulseTimer); element.classList.remove('is-stop-success'); void element.offsetWidth; element.classList.add('is-stop-success');
        protocolPulseTimer = window.setTimeout(() => element.classList.remove('is-stop-success'), 380);
      }
    } else if (data.game === 'typing') {
      const errors = data.errors || 0, correct = data.correctCount || 0, target = data.targetCount || data.phrase?.length || 0;
      updateText('typing-input-status', data.phase === 'countdown' ? 'WAIT FOR ACCESS' : errors ? 'EDIT MISMATCH' : 'AUTO-SUBMIT');
      updateText('typing-character-count', correct + ' / ' + target + ' MATCHED');
      updateText('typing-phase-label', data.phase === 'countdown' ? 'STARTS IN' : 'TIME LEFT');
      updateText('typing-reward-label', '+' + Math.max(Number(state.nodesValidated) || 0, 1) + ' MULTIPLIER');
      $('typing-input').placeholder = data.phase === 'countdown' ? '…' : '';
      setSlots('typing-error-slots', errors, 'is-error');
      $('typing-command-progress').style.transform = 'scaleX(' + (target ? correct / target : 0) + ')';
      if (data.phase === 'countdown') $('typing-time-fill').style.transform = 'scaleX(' + Math.max(0, Number(data.countdown) || 0) / 3 + ')';
    } else if (data.game === 'backdoor') {
      const correct = data.correctCount || 0, errors = data.errors || 0;
      updateText('backdoor-phase-label', data.phase === 'countdown' ? 'MEMORIZE' : data.phase === 'active' ? 'RECALL' : data.success ? 'CONNECTED' : 'FAILED');
      updateText('backdoor-instruction', data.phase === 'countdown' ? 'Remember the five lit ports.' : data.phase === 'active' ? 'Select the ports you saw.' : data.rewardText || 'Returning…');
      updateText('backdoor-progress-label', correct + '/' + (data.targetCount || 5));
      updateText('backdoor-errors-label', errors + '/' + (data.maxErrors || 3));
      updateText('backdoor-reward-label', '+' + compactMoney((Number(state.multiplier) || 1) * 3) + ' / −25 RISK');
      setSlots('backdoor-progress-slots', correct, 'is-filled'); setSlots('backdoor-error-slots', errors, 'is-error');
      if (data.phase === 'countdown') $('backdoor-time-fill').style.transform = 'scaleX(' + Math.max(0, Number(data.countdown) || 0) / 3 + ')';
      if (data.phase === 'result') { element.dataset.success = String(!!data.success); updateText('backdoor-timer', data.success ? 'OK' : '×'); }
      if (data.phase === 'active' && previous?.phase !== 'active') focusSafely($('backdoor-grid').querySelector('[tabindex="0"]'));
    }
    if (data.phase === 'result') showProtocolReceipt(data);
    else if (data.phase === 'active' && data.deadlineAt) protocolFrame = requestAnimationFrame(drawProtocolClock);
    syncProtocolArtwork();
  }
  document.addEventListener('risk:protocol', event => onProtocol(event.detail));
  document.addEventListener('visibilitychange', () => {
    cancelAnimationFrame(protocolFrame); protocolFrame = 0;
    if (!document.hidden && protocolState?.phase === 'active' && protocolState.deadlineAt) protocolFrame = requestAnimationFrame(drawProtocolClock);
    syncProtocolArtwork();
  });
  const proximityObserver = new MutationObserver(() => {
    const proximity = $('bypass-cursor').dataset.proximity || 'far';
    if ($('screen-bypass').dataset.proximity === proximity) return;
    $('screen-bypass').dataset.proximity = proximity;
    $('bypass-proximity').innerHTML = '<i></i> ' + ({ inside: 'ALIGNED', near: 'APPROACHING', far: 'SCANNING' })[proximity];
  });
  proximityObserver.observe($('bypass-cursor'), { attributes: true, attributeFilter: ['data-proximity'] });
  document.addEventListener('risk:event', event => {
    const outcome = event.detail || {};
    if (outcome.type === 'hack') pulse(document.querySelectorAll('.btn-hack')[Number(outcome.level || outcome.hackType || 1) - 1]);
    else if (outcome.type === 'bonus') pulse($('price-' + outcome.bonusId)?.parentElement);
    else if (outcome.type === 'node') pulse($('node-text'));
  });
  document.addEventListener('risk:state', event => onState(event.detail));

  // Capture modal keystrokes before the original document handler. A skip never becomes a hack/transfer.
  document.addEventListener('keydown', event => {
    const editable = event.target?.matches?.('input,textarea,select,[contenteditable="true"]');
    if (event.repeat && !editable && ['Enter', ' '].includes(event.key)) {
      // Returning from the gameplay router alone still permits the browser's
      // native repeated button click, including after a modal changes focus.
      event.preventDefault(); event.stopImmediatePropagation(); return;
    }
    const modal = shown(intro) ? intro : shown(settings) ? settings : null;
    if (modal) {
      if (shown(intro) && ['Escape', ' ', 'Enter'].includes(event.key)) {
        event.preventDefault(); event.stopImmediatePropagation(); window.RelayAudio?.unlock(); hideIntro(); return;
      }
      if (event.key === 'Escape') {
        event.preventDefault(); event.stopImmediatePropagation(); hideSettings(); return;
      }
      if (event.key === 'Tab') {
        const focusables = [...modal.querySelectorAll('button,input,select,[tabindex="0"]')].filter(node => !node.disabled && node.getClientRects().length);
        const first = focusables[0], last = focusables[focusables.length - 1];
        if (event.shiftKey && (document.activeElement === first || !modal.contains(document.activeElement))) { event.preventDefault(); focusSafely(last); }
        else if (!event.shiftKey && (document.activeElement === last || !modal.contains(document.activeElement))) { event.preventDefault(); focusSafely(first); }
      }
      // Permit native input/select/button handling, suppress only downstream document gameplay shortcuts.
      event.stopPropagation();
      return;
    }
    if (event.key === 'Escape' && tooltipOwner) { hideTooltip(); return; }
    if (event.key === 'Enter' && current() === 'menu' && !event.repeat && (event.target === document.body || event.target === $('player-name'))) {
      event.preventDefault(); event.stopImmediatePropagation(); window.showPersistentUpgrades?.();
    }
  }, true);
  window.addEventListener('beforeunload', () => {
    clearTimeout(introTimer); clearTimeout(notificationTimer);
    animatedButtons.forEach(timer => clearTimeout(timer)); animatedButtons.clear();
    memoryObserver.disconnect();
    proximityObserver.disconnect(); cancelAnimationFrame(protocolFrame);
    clearTimeout(protocolResultTimer); clearTimeout(protocolPulseTimer);
    systemReducedMotion.removeEventListener('change', syncProtocolArtwork);
  });
  window.showSettings = showSettings;
  window.closeSettings = hideSettings;
  window.RelayUI = Object.freeze({ onState, onProtocol, showSettings, hideSettings, showIntro, hideIntro, notify, getProtocolDiagnostics });
})();

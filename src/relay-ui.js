/* Blacksite interface enhancements. This module never resolves gameplay or uses its RNG. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const tr = (key, fallback, params = {}) => window.RiskI18n?.t('live.' + key, params, fallback) ?? fallback.replace(/\{(\w+)\}/g, (token, name) => Object.hasOwn(params, name) ? String(params[name]) : token);
  const rewardText = data => window.RiskGameText?.reward(data) || data.rewardText;
  const settings = $('screen-settings'), intro = $('screen-intro'), video = $('relay-intro-video');
  const tooltip = $('relay-tooltip'), notification = $('relay-notification');
  let state = {}, settingsFocus = null, introFocus = null, tooltipOwner = null, menuPanelFocus = null;
  const menuPanelBack = { persistent: 'backToMenu', achievements: 'backToMenuFromAchievements', leaderboard: 'backToMenuFromLeaderboard' };
  let hoverTooltipsArmed = true, lastPointerX = null, lastPointerY = null;
  const tooltipDelayMs = 3000;
  let tooltipTimer = 0, tooltipPendingOwner = null;
  let introResolve = null, introPromise = null, introTimer = 0, notificationTimer = 0, pendingNotification = '';
  let notificationSource = null;
  const notificationText = source => String(typeof source === 'function' ? source() : source || '');
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
      decorativeAnimationCount: devices.reduce((count, device) => count + device.decorativeAnimations.length, 0), ownArtworkTimers: 0, ownArtworkAnimationFrames: 0,
      hardwareLife: window.RelayProtocolLife?.getDiagnostics() || null };
  }
  systemReducedMotion.addEventListener('change', syncProtocolArtwork);

  function onState(next = {}) {
    const screenChanged = state.screen !== next.screen;
    const returningToMenu = screenChanged && next.screen === 'menu' && Object.hasOwn(menuPanelBack, state.screen);
    if (screenChanged && state.screen === 'menu' && Object.hasOwn(menuPanelBack, next.screen)) {
      menuPanelFocus = $('main-menu').contains(document.activeElement) ? document.activeElement : null;
    }
    if (state.screen === 'persistent' && next.screen === 'game') {
      // Awards belong to the run that earned them. In-run protocol handoffs
      // still defer their new awards, but a fresh run must not revive old ones.
      clearTimeout(notificationTimer);
      pendingNotification = '';
      notificationSource = null;
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
    const quitOpen = window.RiskQuitBlocking || window.RelayQuitUI?.isOpen();
    document.querySelector('.widget').inert = quitOpen || next.screen !== 'game';
    Object.entries(screenElements).forEach(([name, id]) => { $(id).inert = quitOpen || name !== next.screen; });
    if (!quitOpen && screenChanged && !['typing', 'backdoor', 'settings', 'intro'].includes(next.screen)) {
      const destination = returningToMenu && menuPanelFocus?.isConnected ? menuPanelFocus : next.screen === 'game' ? document.querySelector('.btn-hack') : $(screenElements[next.screen])?.querySelector('button:not(:disabled)');
      if (!document.activeElement?.closest('#' + screenElements[next.screen])) focusSafely(destination);
    }
    if (returningToMenu) menuPanelFocus = null;
    const risk = Number(next.risk) || 0, danger = risk >= 75;
    updateText('trace-condition', danger ? tr('trace.critical','CRITICAL / EXTRACT') : risk >= 45 ? tr('trace.rising','TRACE RISING') : tr('trace.stable','STABLE'));
    if (next.bypassCharge !== undefined) updateText('bypass-charge', (next.bypassCharge >= next.bypassChargeMax ? tr('charge.ready','READY ') : tr('charge.loading','CHARGING ')) + next.bypassCharge + '/' + next.bypassChargeMax);
    if (next.bonusStatuses) next.bonusStatuses.forEach((status, index) => {
      const label = $('bonus-status-' + (index + 1)), price = $('price-' + (index + 1));
      if (!label || !price) return;
      const button = price.parentElement;
      const translatedStatus = window.RiskI18n?.bonusStatus(status) || status;
      button.dataset.longPrice = String(price.textContent.length > 6);
      updateText(label.id, translatedStatus);
      button.dataset.bonusState = status;
      button.dataset.cooldown = String(status.includes('HACKS') || status === 'LOCKED');
      button.dataset.active = String(status === 'ACTIVE');
      button.setAttribute('aria-disabled', String(next.bonusAvailable?.[index] === false));
      button.setAttribute('aria-label', button.querySelector('strong').textContent + ', ' + price.textContent + ', ' + translatedStatus);
    });
    const preferences = next.preferences || next;
    if (typeof preferences.reducedMotion === 'boolean') $('reduced-motion-toggle').checked = preferences.reducedMotion;
    if (['full', 'low', 'off'].includes(preferences.effectsLevel)) $('effects-quality').value = preferences.effectsLevel;
    if ($('language-select')) $('language-select').value = window.RiskI18n?.language || 'en';
    for (const [key, prefix] of [['musicVolume', 'music'], ['sfxVolume', 'sfx']]) {
      if (Number.isFinite(next[key])) {
        if (document.activeElement !== $(prefix + '-slider')) $(prefix + '-slider').value = next[key];
        updateText(prefix + '-vol-val', Math.round(next[key] * 100) + '%');
      }
    }
    const money = $('money-text');
    money?.classList.toggle('compact-number', money.textContent.length > 10);
    if (next.screen !== 'game' || window.RiskQuitBlocking) hideTooltip();
    else if (tooltipOwner) showTooltip(tooltipOwner);
    if (next.protocol && next.protocol !== protocolState) onProtocol(next.protocol);
    syncProtocolArtwork();
    if (['typing', 'backdoor', 'bypass', 'intro'].includes(next.screen)) {
      if (!notification.hidden) pendingNotification = notificationSource || notification.textContent;
      notification.hidden = true; clearTimeout(notificationTimer);
    } else if (pendingNotification) {
      const pending = pendingNotification; pendingNotification = ''; notify(pending);
    }
  }

  function showSettings() {
    if (window.RiskQuitBlocking) return false;
    if (!['menu', 'persistent', 'game'].includes(current())) return false;
    settingsFocus = document.activeElement;
    settings.style.display = 'flex';
    hideTooltip(); refresh(); focusSafely($('music-slider'));
    window.RelayAudio?.play('click');
    return true;
  }
  function hideSettings() {
    if (window.RiskQuitBlocking) return;
    if (!shown(settings) || shown(intro)) return;
    settings.style.display = 'none';
    window.saveGameState?.(); refresh(); focusSafely(settingsFocus);
    window.RelayAudio?.play('click');
  }

  function showIntro({ replay = false } = {}) {
    if (window.RiskQuitBlocking) return Promise.resolve(false);
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
    if (!source || current() !== 'game' || window.RiskQuitBlocking || document.hidden || button.closest('[inert]')) return;
    if (tooltipOwner && tooltipOwner !== button) tooltipOwner.removeAttribute('aria-describedby');
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
    clearTimeout(tooltipTimer); tooltipTimer = 0; tooltipPendingOwner = null;
    tooltip.hidden = true;
    tooltipOwner?.removeAttribute('aria-describedby'); tooltipOwner = null;
  }
  function queueTooltip(button, mode = 'hover') {
    if (!button?.querySelector('.tooltip') || current() !== 'game' || window.RiskQuitBlocking || document.hidden) return;
    if (tooltipOwner === button || tooltipPendingOwner === button) return;
    hideTooltip(); tooltipPendingOwner = button;
    tooltipTimer = setTimeout(() => {
      tooltipTimer = 0; tooltipPendingOwner = null;
      const stillInterested = mode === 'focus'
        ? document.activeElement === button && button.matches(':focus-visible')
        : button.matches(':hover') && hoverTooltipsArmed;
      if (button.isConnected && stillInterested) showTooltip(button);
    }, tooltipDelayMs);
  }
  document.querySelectorAll('.bonus-section .btn-bonus').forEach(button => {
    button.addEventListener('pointerenter', () => { if (hoverTooltipsArmed) queueTooltip(button); });
    button.addEventListener('pointerleave', hideTooltip);
    button.addEventListener('focus', () => { if (button.matches(':focus-visible')) queueTooltip(button, 'focus'); });
    button.addEventListener('blur', hideTooltip);
    button.addEventListener('click', hideTooltip);
  });
  document.addEventListener('pointermove', event => {
    const moved = event.clientX !== lastPointerX || event.clientY !== lastPointerY;
    lastPointerX = event.clientX; lastPointerY = event.clientY;
    if (!moved || hoverTooltipsArmed || current() !== 'game') return;
    hoverTooltipsArmed = true;
    queueTooltip(event.target.closest?.('.bonus-section .btn-bonus'));
  }, { passive: true });
  document.addEventListener('pointerdown', hideTooltip, true);
  document.addEventListener('visibilitychange', hideTooltip);
  document.addEventListener('risk:quit-state', event => { if (event.detail?.blocking) hideTooltip(); });
  window.addEventListener('blur', hideTooltip);
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
  function refreshPortLabels() {
    [...memoryGrid.children].forEach((cell, index) => {
      const portLabel = tr('port.name','Patch port {port}',{port:String.fromCharCode(65 + Math.floor(index / 8)) + (index % 8 + 1)});
      const portState = ({ target: tr('port.target',', illuminated'), correct: tr('port.correct',', connected'), wrong: tr('port.wrong',', incorrect selection') })[cell.dataset.state] || '';
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
  }
  const memoryObserver = new MutationObserver(refreshPortLabels);
  memoryObserver.observe(memoryGrid, { childList: true, attributes: true, subtree: true, attributeFilter: ['data-state'] });
  $('reduced-motion-toggle').addEventListener('change', event => window.RiskPresentation?.setPreferences({ reducedMotion: event.target.checked }));
  $('effects-quality').addEventListener('change', event => window.RiskPresentation?.setPreferences({ effectsLevel: event.target.value }));
  $('language-select')?.addEventListener('change', event => window.RiskI18n?.setLanguage(event.target.value));

  function notify(message) {
    clearTimeout(notificationTimer);
    notificationSource = message;
    if (['typing', 'backdoor', 'bypass', 'intro'].includes(current())) { pendingNotification = message; return; }
    notification.textContent = notificationText(message); notification.hidden = false;
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
  const compactMoney = value => window.RiskI18n?.language === 'fr'
    ? Number(value || 0).toLocaleString('fr-FR', { notation: 'compact', maximumFractionDigits: 1 }) + '\u00a0$'
    : '$' + Number(value || 0).toLocaleString('en-US', { notation: 'compact', maximumFractionDigits: 1 });
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
      const value = (Math.ceil(remaining / 100) / 10).toLocaleString(window.RiskI18n?.locale || 'en-US',{minimumFractionDigits:1,maximumFractionDigits:1});
      const clock = $('typing-time-value');
      if (clock.dataset.value !== value) { clock.dataset.value = value; clock.innerHTML = value + '<small>s</small>'; }
    }
    // The game owns the deadline and its numeric memory display; this bar only interpolates it.
    if (remaining > 0) protocolFrame = requestAnimationFrame(drawProtocolClock);
  }
  function paintProtocolReceipt(data) {
    const titles = {
      typing: data.success ? tr('receipt.typing.win','COMMAND ACCEPTED') : tr('receipt.typing.fail','INJECTION REJECTED'),
      backdoor: data.success ? tr('receipt.memory.win','HIDDEN ROUTE OPEN') : tr('receipt.memory.fail','PATCH ROUTE LOST'),
      bypass: data.rewardReduction > 0 ? tr('receipt.bypass.reward','TRACE DISRUPTED') : data.success ? tr('receipt.bypass.exit','COUPLER DISCONNECTED') : tr('receipt.bypass.fail','CALIBRATION LOST')
    };
    updateText('protocol-outcome-title', titles[data.game] || tr('receipt.complete','PROTOCOL COMPLETE'));
    updateText('protocol-outcome-detail', rewardText(data) || (data.success ? tr('receipt.ready','The relay is ready.') : tr('receipt.return','Return to the relay.')));
  }
  function showProtocolReceipt(data) {
    clearTimeout(protocolResultTimer);
    paintProtocolReceipt(data);
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
  function onProtocol(data = {}, languageOnly = false) {
    if (!data.game || (!languageOnly && data === protocolState)) return;
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
      updateText('bypass-exit-label', rawEarned > 0 ? tr('bypass.apply','EXIT & APPLY') : tr('bypass.exit','EXIT'));
      if (!languageOnly && data.phase === 'active' && previous?.game === 'bypass' && stops > (previous.stops || 0)) {
        clearTimeout(protocolPulseTimer); element.classList.remove('is-stop-success'); void element.offsetWidth; element.classList.add('is-stop-success');
        protocolPulseTimer = window.setTimeout(() => element.classList.remove('is-stop-success'), 380);
      }
    } else if (data.game === 'typing') {
      const errors = data.errors || 0, correct = data.correctCount || 0, target = data.targetCount || data.phrase?.length || 0;
      updateText('typing-input-status', data.phase === 'countdown' ? tr('typing.wait','WAIT FOR ACCESS') : errors ? tr('typing.edit','EDIT MISMATCH') : tr('typing.auto','AUTO-SUBMIT'));
      updateText('typing-character-count', tr('typing.matched','{correct} / {target} MATCHED',{correct,target}));
      updateText('typing-phase-label', data.phase === 'countdown' ? tr('typing.starts','STARTS IN') : tr('typing.time','TIME LEFT'));
      updateText('typing-reward-label', tr('typing.reward','+{count} MULTIPLIER',{count:Math.max(Number(state.nodesValidated) || 0, 1)}));
      $('typing-input').placeholder = data.phase === 'countdown' ? '…' : '';
      setSlots('typing-error-slots', errors, 'is-error');
      $('typing-command-progress').style.transform = 'scaleX(' + (target ? correct / target : 0) + ')';
      if (data.phase === 'countdown') $('typing-time-fill').style.transform = 'scaleX(' + Math.max(0, Number(data.countdown) || 0) / 3 + ')';
    } else if (data.game === 'backdoor') {
      const correct = data.correctCount || 0, errors = data.errors || 0;
      updateText('backdoor-phase-label', data.phase === 'countdown' ? tr('memory.memorize','MEMORIZE') : data.phase === 'active' ? tr('memory.recall','RECALL') : data.success ? tr('memory.connected','CONNECTED') : tr('memory.failed','FAILED'));
      updateText('backdoor-instruction', data.phase === 'countdown' ? tr('memory.remember','Remember the five lit ports.') : data.phase === 'active' ? tr('memory.select','Select the ports you saw.') : rewardText(data) || tr('memory.returning','Returning…'));
      updateText('backdoor-progress-label', correct + '/' + (data.targetCount || 5));
      updateText('backdoor-errors-label', errors + '/' + (data.maxErrors || 3));
      updateText('backdoor-reward-label', tr('memory.reward','+{money} / −25 RISK',{money:compactMoney((Number(state.multiplier) || 1) * 3)}));
      setSlots('backdoor-progress-slots', correct, 'is-filled'); setSlots('backdoor-error-slots', errors, 'is-error');
      if (data.phase === 'countdown') $('backdoor-time-fill').style.transform = 'scaleX(' + Math.max(0, Number(data.countdown) || 0) / 3 + ')';
      if (data.phase === 'result') { element.dataset.success = String(!!data.success); updateText('backdoor-timer', data.success ? 'OK' : '×'); }
      if (!languageOnly && data.phase === 'active' && previous?.phase !== 'active') focusSafely($('backdoor-grid').querySelector('[tabindex="0"]'));
    }
    if (data.phase === 'result') { if (languageOnly) paintProtocolReceipt(data); else showProtocolReceipt(data); }
    else if (data.phase === 'active' && data.deadlineAt) protocolFrame = requestAnimationFrame(drawProtocolClock);
    syncProtocolArtwork();
  }
  document.addEventListener('risk:protocol', event => onProtocol(event.detail));
  document.addEventListener('visibilitychange', () => {
    cancelAnimationFrame(protocolFrame); protocolFrame = 0;
    if (!document.hidden && protocolState?.phase === 'active' && protocolState.deadlineAt) protocolFrame = requestAnimationFrame(drawProtocolClock);
    syncProtocolArtwork();
  });
  function refreshProximity(languageOnly = false) {
    const proximity = $('bypass-cursor').dataset.proximity || 'far';
    if (!languageOnly && $('screen-bypass').dataset.proximity === proximity) return;
    $('screen-bypass').dataset.proximity = proximity;
    $('bypass-proximity').innerHTML = '<i></i> ' + ({ inside: tr('proximity.inside','ALIGNED'), near: tr('proximity.near','APPROACHING'), far: tr('proximity.far','SCANNING') })[proximity];
  }
  const proximityObserver = new MutationObserver(() => refreshProximity());
  proximityObserver.observe($('bypass-cursor'), { attributes: true, attributeFilter: ['data-proximity'] });
  document.addEventListener('risk:event', event => {
    const outcome = event.detail || {};
    if (outcome.type === 'hack') pulse(document.querySelectorAll('.btn-hack')[Number(outcome.level || outcome.hackType || 1) - 1]);
    else if (outcome.type === 'bonus') pulse($('price-' + outcome.bonusId)?.parentElement);
    else if (outcome.type === 'node') pulse($('node-text'));
  });
  document.addEventListener('risk:state', event => onState(event.detail));
  function onLanguage() {
    hideTooltip();
    onState(state);
    refreshPortLabels(); refreshProximity(true);
    if (protocolState) onProtocol(protocolState, true);
    if (!notification.hidden && notificationSource) notification.textContent = notificationText(notificationSource);
  }
  document.addEventListener('risk:language', onLanguage);

  // Capture modal keystrokes before the original document handler. A skip never becomes a hack/transfer.
  document.addEventListener('keydown', event => {
    if (window.RiskQuitBlocking) { event.preventDefault(); event.stopImmediatePropagation(); return; }
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
    const returnToMenu = window[menuPanelBack[current()]];
    if (event.key === 'Escape' && typeof returnToMenu === 'function') {
      event.preventDefault(); event.stopImmediatePropagation();
      if (!event.repeat) returnToMenu();
      return;
    }
    if (event.key === 'Escape' && (tooltipOwner || tooltipPendingOwner)) { hideTooltip(); return; }
    if (event.key === 'Enter' && current() === 'menu' && !event.repeat && (event.target === document.body || event.target === $('player-name'))) {
      event.preventDefault(); event.stopImmediatePropagation(); window.showPersistentUpgrades?.();
    }
  }, true);
  window.addEventListener('beforeunload', () => {
    hideTooltip();
    clearTimeout(introTimer); clearTimeout(notificationTimer);
    animatedButtons.forEach(timer => clearTimeout(timer)); animatedButtons.clear();
    memoryObserver.disconnect();
    proximityObserver.disconnect(); cancelAnimationFrame(protocolFrame);
    clearTimeout(protocolResultTimer); clearTimeout(protocolPulseTimer);
    systemReducedMotion.removeEventListener('change', syncProtocolArtwork);
    document.removeEventListener('risk:language', onLanguage);
  });
  window.showSettings = showSettings;
  window.closeSettings = hideSettings;
  window.RelayUI = Object.freeze({ onState, onProtocol, showSettings, hideSettings, showIntro, hideIntro:()=>{if(!window.RiskQuitBlocking)hideIntro();}, notify, getProtocolDiagnostics,
    getTooltipDiagnostics:()=>({pending:!!tooltipPendingOwner,visible:!tooltip.hidden,delayMs:tooltipDelayMs}) });
})();

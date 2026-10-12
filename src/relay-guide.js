/* Guide navigation only. No gameplay calls, randomness, timers or animation frames. */
(() => {
  'use strict';
  const screen = document.getElementById('screen-tutorial');
  if (!screen) return;
  const overview = document.getElementById('guide-overview');
  const scroll = document.getElementById('guide-scroll');
  const title = document.getElementById('guide-title');
  const subtitle = document.getElementById('guide-subtitle');
  const back = document.getElementById('guide-back');
  const pages = [...screen.querySelectorAll('[data-guide-page]')];
  const copy = Object.freeze({
    overview: ['ONE MORE HACK?', 'Know when to get out.'],
    hacks: ['HACKS & RISK', 'Every move has a price.'],
    bonuses: ['SIX WAYS TO STAY IN', 'Spend now. Survive longer.'],
    protocols: ['STAY SHARP.', 'Three challenges. One relay.'],
    progression: ['COME BACK STRONGER.', 'Bank it. Build it. Repeat.']
  });
  const localizeHeading = () => {
    const i18n = window.RiskI18n;
    title.textContent = i18n ? i18n.t(`guide.heading.${page}`) : copy[page][0];
    subtitle.textContent = i18n ? i18n.t(`guide.subtitle.${page}`) : copy[page][1];
  };
  let page = 'overview', visible = false, opener = null, lastOutsideFocus = null, pendingRestore = null, pendingHeading = false, disposed = false;
  const isVisible = () => screen.style.display === 'flex' && (!window.RiskPresentation || window.RiskPresentation.currentScreen() === 'tutorial');
  const focus = node => {
    if (!node?.isConnected || !node.getClientRects().length || node.closest('[inert]')) return false;
    node.focus({ preventScroll: true });
    return document.activeElement === node;
  };
  function setPage(next = 'overview', moveFocus = true) {
    if (!Object.hasOwn(copy, next)) return false;
    page = next;
    screen.dataset.guideCurrent = next;
    pages.forEach(node => { node.hidden = node.dataset.guidePage !== next; });
    overview.hidden = next !== 'overview';
    scroll.hidden = next === 'overview';
    back.hidden = next === 'overview';
    localizeHeading();
    scroll.scrollTop = 0;
    if (moveFocus) focus(title);
    return true;
  }
  function sync() {
    if (disposed) return;
    const next = isVisible();
    if (next && !visible) {
      opener = lastOutsideFocus;
      pendingRestore = null;
      pendingHeading = true;
      screen.querySelectorAll('details').forEach(node => { node.open = false; });
      setPage('overview', false);
    } else if (!next && visible) {
      pendingHeading = false;
      pendingRestore = opener;
      opener = null;
    }
    visible = next;
    // Direct display changes precede the presentation adapter's inert update.
    // Retry only on its normal state event, once the destination can receive focus.
    if (next && pendingHeading && focus(title)) pendingHeading = false;
    if (!next && pendingRestore && focus(pendingRestore)) pendingRestore = null;
  }
  function onFocus(event) {
    if (!screen.contains(event.target) && event.target instanceof HTMLElement && event.target !== document.body) lastOutsideFocus = event.target;
  }
  function onClick(event) {
    const topic = event.target.closest('[data-guide-topic]');
    if (topic && screen.contains(topic) && isVisible()) {
      setPage(topic.dataset.guideTopic);
      window.RelayAudio?.play('click');
    } else if (event.target.closest('#guide-back') && isVisible()) {
      setPage('overview');
      window.RelayAudio?.play('click');
    }
  }
  function onKey(event) {
    if (!isVisible()) return;
    if (event.key === 'Escape') {
      event.preventDefault(); event.stopImmediatePropagation();
      if (event.repeat) return;
      if (page !== 'overview') setPage('overview');
      else window.closeTutorial?.();
      return;
    }
    if (event.key === 'Tab') {
      const nodes = [...screen.querySelectorAll('button,summary,[href],[tabindex="0"]')].filter(node => !node.disabled && node.getClientRects().length);
      const first = nodes[0], last = nodes[nodes.length - 1];
      if (event.shiftKey && (document.activeElement === first || !screen.contains(document.activeElement))) {
        event.preventDefault(); focus(last);
      } else if (!event.shiftKey && (document.activeElement === last || !screen.contains(document.activeElement))) {
        event.preventDefault(); focus(first);
      }
    }
  }
  function getDiagnostics() {
    return { page, screen: isVisible() ? 'tutorial' : window.RiskPresentation?.currentScreen() || null, visible: isVisible(), disposed,
      overview: { height: overview.clientHeight, scrollHeight: overview.scrollHeight },
      detail: { height: scroll.clientHeight, scrollHeight: scroll.scrollHeight, scrollTop: scroll.scrollTop },
      ownTimers: 0, ownAnimationFrames: 0 };
  }
  function dispose() {
    disposed = true;
    observer.disconnect();
    document.removeEventListener('focusin', onFocus, true);
    document.removeEventListener('keydown', onKey, true);
    document.removeEventListener('risk:state', sync);
    document.removeEventListener('risk:language', localizeHeading);
    screen.removeEventListener('click', onClick);
  }
  const observer = new MutationObserver(sync);
  observer.observe(screen, { attributes: true, attributeFilter: ['style'] });
  document.addEventListener('focusin', onFocus, true);
  document.addEventListener('keydown', onKey, true);
  document.addEventListener('risk:state', sync);
  // Translate the current page without resetting its focus, expanded odds or scroll.
  document.addEventListener('risk:language', localizeHeading);
  screen.addEventListener('click', onClick);
  window.addEventListener('beforeunload', dispose, { once: true });
  window.RelayGuide = Object.freeze({ getDiagnostics, dispose });
  localizeHeading();
  sync();
})();

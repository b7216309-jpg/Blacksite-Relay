/* Read-only achievement presentation. Rules and saved progress belong to renderer.js. */
(() => {
  'use strict';
  const t = (key, fallback, params = {}) => window.RiskI18n?.t(key, params) ?? fallback.replace(/\{(\w+)\}/g, (_, name) => params[name] ?? '');
  const screen = document.getElementById('screen-achievements');
  const list = document.getElementById('achievements-list');
  if (!screen || !list) return;
  let entries = [], visible = false, disposed = false;
  const element = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  function card(entry, index) {
    const hidden = entry.secret && !entry.unlocked;
    const title = hidden ? t('extra.achievement.hidden', 'HIDDEN CHALLENGE') : entry.name;
    const node = element('article', 'achievement-card challenge-card' + (entry.unlocked ? ' unlocked' : '') + (entry.secret ? ' secret' : ''));
    node.dataset.achievementId = entry.id;
    node.setAttribute('role', 'listitem');
    const heading = element('header', 'challenge-heading');
    const marker = element('span', 'challenge-marker', entry.unlocked ? '✓' : hidden ? '?' : '');
    marker.setAttribute('aria-hidden', 'true');
    const name = element('h3', 'challenge-name', title);
    name.id = 'achievement-name-' + index;
    node.setAttribute('aria-labelledby', name.id);
    heading.append(marker, name);
    node.append(heading, element('p', 'challenge-description', hidden ? t('extra.achievement.reveal', 'Unlock to reveal.') : entry.description));
    // One-off conditions read clearly as a sentence; a 0/1 bar adds no useful progress.
    const measurable = !hidden && Number.isFinite(entry.current) && Number.isFinite(entry.target) && entry.target > 1;
    if (entry.unlocked || measurable) {
      const progress = element('div', 'challenge-progress');
      const caption = element('p', 'challenge-progress-caption');
      caption.append(element('span', 'challenge-scope', entry.unlocked ? '' : entry.scope), element('span', 'challenge-value', entry.unlocked ? t('extra.achievement.complete', 'COMPLETE') : entry.progressLabel));
      const track = element('span', 'challenge-track');
      const ratio = entry.unlocked ? 1 : Math.min(1, Math.max(0, entry.current / entry.target));
      track.setAttribute('role', 'progressbar');
      track.setAttribute('aria-label', title);
      track.setAttribute('aria-valuemin', '0');
      track.setAttribute('aria-valuemax', entry.unlocked ? '1' : String(entry.target));
      track.setAttribute('aria-valuenow', entry.unlocked ? '1' : String(Math.min(entry.target, Math.max(0, entry.current))));
      track.setAttribute('aria-valuetext', entry.unlocked ? t('extra.achievement.completeAria', 'Complete') : entry.progressLabel);
      const fill = element('i');
      fill.style.width = (ratio * 100) + '%';
      track.append(fill);
      progress.append(caption, track);
      node.append(progress);
    }
    return node;
  }
  function paint(resetScroll = false) {
    if (disposed) return;
    const previousScroll = resetScroll ? 0 : list.scrollTop;
    const fragment = document.createDocumentFragment();
    entries.forEach((entry, index) => fragment.append(card(entry, index)));
    if (!entries.length) fragment.append(element('p', 'challenge-empty', t('extra.achievement.empty', 'No achievements available.')));
    list.replaceChildren(fragment);
    list.scrollTop = previousScroll;
    const unlocked = entries.filter(entry => entry.unlocked).length;
    const progress = document.getElementById('achievement-progress');
    const counter = document.getElementById('achievement-counter');
    if (progress) progress.textContent = t('extra.achievement.unlocked', '{unlocked}/{total} UNLOCKED', { unlocked, total: entries.length });
    if (counter) counter.textContent = `${unlocked}/${entries.length}`;
  }
  function render(next) {
    if (disposed || !Array.isArray(next)) return false;
    const ids = new Set();
    entries = next.filter(entry => entry && typeof entry.id === 'string' && !ids.has(entry.id) && ids.add(entry.id)).map(entry => Object.freeze({
      id: entry.id, name: String(entry.name || ''), description: String(entry.description || ''),
      unlocked: !!entry.unlocked, secret: !!entry.secret,
      current: entry.current, target: entry.target,
      progressLabel: String(entry.progressLabel || ''), scope: String(entry.scope || '')
    }));
    paint();
    return true;
  }
  function onState(event) {
    const nextVisible = event.detail?.screen === 'achievements';
    if (nextVisible && !visible) {
      if (typeof window.getAchievementPresentation === 'function') render(window.getAchievementPresentation());
      paint(true);
      if (!screen.inert && list.getClientRects().length) list.focus({ preventScroll: true });
    }
    visible = nextVisible;
  }
  function getDiagnostics() {
    return Object.freeze({
      ready: !disposed, disposed, screen: visible ? 'achievements' : 'inactive', order: 'catalog',
      total: entries.length, unlocked: entries.filter(entry => entry.unlocked).length,
      visibleIds: Object.freeze(entries.map(entry => entry.id)),
      ownTimers: 0, ownAnimationFrames: 0
    });
  }
  function onLanguage() {
    if (typeof window.getAchievementPresentation === 'function') render(window.getAchievementPresentation());
    else paint();
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    document.removeEventListener('risk:state', onState);
    document.removeEventListener('risk:language', onLanguage);
    window.removeEventListener('pagehide', dispose);
    entries = [];
  }
  document.addEventListener('risk:state', onState);
  document.addEventListener('risk:language', onLanguage);
  window.addEventListener('pagehide', dispose);
  window.RelayAchievements = Object.freeze({ render, getDiagnostics, dispose });
})();

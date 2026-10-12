/* Explicit display localization. No gameplay state, random draws or timers. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory;
  else root.RiskI18n = factory(root);
})(typeof window === 'object' ? window : globalThis, function (host) {
  'use strict';
  host = host || {};
  const catalogs = { en: Object.create(null), fr: Object.create(null) };
  let language = 'en';
  const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
  function register(messages) {
    for (const lang of ['en', 'fr']) for (const [key, value] of Object.entries(messages?.[lang] || {})) {
      if (typeof value !== 'string') throw new TypeError('Translation must be text: ' + key);
      if (own(catalogs[lang], key) && catalogs[lang][key] !== value) throw new Error('Duplicate translation: ' + key);
      catalogs[lang][key] = value;
    }
  }
  function t(key, params = {}, fallback = key) {
    const template = catalogs[language][key] ?? catalogs.en[key] ?? fallback;
    return String(template).replace(/\{(\w+)\}/g, (token, name) => own(params, name) ? String(params[name]) : token);
  }
  function number(value, options = {}) { return Number(value).toLocaleString(language === 'fr' ? 'fr-FR' : 'en-US', options); }
  function apply(scope = host.document) {
    if (!scope?.querySelectorAll) return;
    const attributes = ['title', 'aria-label', 'placeholder'];
    const selector = ['[data-i18n]', ...attributes.map(a => '[data-i18n-' + a + ']')].join(',');
    const nodes = [...(scope.matches?.(selector) ? [scope] : []), ...scope.querySelectorAll(selector)];
    for (const node of nodes) {
      let params = {};
      try { const data = JSON.parse(node.getAttribute('data-i18n-vars') || '{}'); if (data && typeof data === 'object' && !Array.isArray(data)) params = data; } catch (_) { /* Invalid display metadata must not stop a screen. */ }
      const key = node.getAttribute('data-i18n');
      if (key) { const text = t(key, params); if (node.textContent !== text) node.textContent = text; }
      for (const attribute of attributes) {
        const attrKey = node.getAttribute('data-i18n-' + attribute);
        if (attrKey) node.setAttribute(attribute, t(attrKey, params));
      }
    }
  }
  function setLanguage(next, { persist = true } = {}) {
    if (!own(catalogs, next)) return false;
    const changed = next !== language;
    language = next;
    if (host.document?.documentElement) host.document.documentElement.lang = language;
    const select = host.document?.getElementById('language-select');
    if (select) select.value = language;
    apply();
    if (changed && host.document && host.CustomEvent) host.document.dispatchEvent(new host.CustomEvent('risk:language', { detail: Object.freeze({ language, locale: language === 'fr' ? 'fr-FR' : 'en-US' }) }));
    if (changed && persist) host.RiskPresentation?.setPreferences({ language });
    return true;
  }
  function bonusStatus(status) {
    const hacks = /^(\d+) HACKS$/.exec(status);
    return hacks ? t('live.status.' + (Number(hacks[1]) === 1 ? 'hack' : 'hacks'), { count: hacks[1] }, status) : t('live.status.' + status, {}, status);
  }
  function diagnostics() {
    const en = Object.keys(catalogs.en), fr = Object.keys(catalogs.fr);
    return { language, englishKeys: en.length, frenchKeys: fr.length,
      missingFrench: en.filter(key => !own(catalogs.fr, key)), missingEnglish: fr.filter(key => !own(catalogs.en, key)), ownTimers: 0 };
  }
  host.document?.addEventListener('DOMContentLoaded', () => apply(), { once: true });
  return Object.freeze({ register, t, number, apply, setLanguage, bonusStatus, getDiagnostics: diagnostics,
    get language() { return language; }, get locale() { return language === 'fr' ? 'fr-FR' : 'en-US'; } });
});

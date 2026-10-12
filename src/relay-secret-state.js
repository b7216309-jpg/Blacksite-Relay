/* Cosmetic discovery state. No game globals, saves, random numbers or timers. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.RelaySecretState = api;
})(typeof window === 'object' ? window : globalThis, function () {
  'use strict';
  const durations = Object.freeze({ ratUnion: 14, rootAccess: 5, snailMail: 6, locker: 7, room404: 10 });
  const midpoints = { ratUnion: 6, rootAccess: 2, snailMail: 2, locker: 3, room404: 4 };
  const domains = { ratUnion: 'scene', rootAccess: 'scene', snailMail: 'scene', locker: 'scene', room404: 'guide' };
  function create() {
    const clocks = { scene: 0, guide: 0 }, stamps = { scene: null, guide: null }, staticModes = { scene: false, guide: false };
    const active = {}, discovered = new Set();
    let rat = null, cat = { count: 0, at: 0 }, knocks = { count: 0, at: 0 }, leds = 0, lastLed = -1, lastKnock = -Infinity;
    function busy(domain) { return Object.keys(active).some(key => domains[key] === domain); }
    function advance(domain, time, isStatic = false) {
      if (!Object.hasOwn(clocks, domain) || !Number.isFinite(time)) return;
      if (!isStatic && !staticModes[domain] && stamps[domain] !== null) clocks[domain] += Math.max(0, time - stamps[domain]);
      stamps[domain] = time; staticModes[domain] = isStatic;
      for (const [key, run] of Object.entries(active)) if (domains[key] === domain && !isStatic && clocks[domain] - run.start >= durations[key]) delete active[key];
      if (domain === 'scene') {
        if (rat && clocks.scene - rat.at > 12) rat = null;
        if (clocks.scene - cat.at > 8) cat.count = 0;
        if (clocks.scene - knocks.at > 3) knocks.count = 0;
      }
    }
    function clearPending(domain) {
      if (domain === 'scene') { rat = null; cat.count = 0; knocks.count = 0; }
      else { leds = 0; lastLed = -1; }
    }
    function start(key, origins = []) {
      const domain = domains[key];
      if (!domain || busy(domain)) return null;
      clearPending(domain);
      active[key] = { start: clocks[domain], origins: origins.map(p => Object.freeze({ id: p.id, x: p.x, y: p.y, facing: p.facing })) };
      discovered.add(key);
      return key;
    }
    function act(id, data = {}) {
      const guide = /^led-[0-3]$/.test(id), domain = guide ? 'guide' : 'scene';
      if (busy(domain)) return null;
      if (id === 'cable-rat' || id === 'rack-rat') {
        if (rat && rat.id !== id && clocks.scene - rat.at <= 12) return start('ratUnion', data.origins || []);
        rat = { id, at: clocks.scene };
      } else if (id === 'server-cat') {
        cat.count = clocks.scene - cat.at > 8 ? 1 : cat.count + 1; cat.at = clocks.scene;
        if (cat.count === 3) return start('rootAccess');
      } else if (id === 'coil-snail') {
        if (data.feelers || staticModes.scene) return start('snailMail');
      } else if (id === 'locker') {
        if (!['short', 'long'].includes(data.knock)) return null;
        if (clocks.scene - knocks.at > 3) knocks.count = 0;
        lastKnock = clocks.scene; knocks.at = clocks.scene;
        const expected = knocks.count < 2 ? 'short' : 'long';
        knocks.count = data.knock === expected ? knocks.count + 1 : data.knock === 'short' ? 1 : 0;
        if (knocks.count === 3) return start('locker');
      } else if (guide) {
        const index = Number(id.slice(-1)); lastLed = index;
        leds = index === leds ? leds + 1 : index === 0 ? 1 : 0;
        if (leds === 4) return start('room404');
      }
      return null;
    }
    function entry(key) {
      const run = active[key], isStatic = staticModes[domains[key]];
      return Object.freeze({ active: !!run, elapsed: run ? isStatic ? midpoints[key] : Math.max(0, clocks[domains[key]] - run.start) : 0, duration: durations[key], isStatic, origins: Object.freeze(run ? [...run.origins] : []) });
    }
    function snapshot(domain) {
      const result = Object.fromEntries(Object.keys(durations).filter(key => domains[key] === domain).map(key => [key, entry(key)]));
      if (domain === 'scene') { result.ratTouched = rat?.id || null; result.catTaps = cat.count; result.knockProgress = knocks.count; result.knockAge = clocks.scene - lastKnock; }
      else { result.ledProgress = active.room404 ? 4 : leds; result.lastLed = lastLed; }
      return Object.freeze(result);
    }
    function reset(domain) { clearPending(domain); for (const key of Object.keys(active)) if (domains[key] === domain) delete active[key]; stamps[domain] = null; }
    return Object.freeze({ advance, act, snapshot, reset, rebase(domain) { stamps[domain] = null; }, finish(key) { delete active[key]; },
      diagnostics: () => Object.freeze({ active: Object.freeze(Object.keys(active)), discovered: Object.freeze([...discovered]), clocks: Object.freeze({ ...clocks }), ownTimers: 0, ownAnimationFrames: 0 }) });
  }
  return Object.freeze({ create, durations });
});

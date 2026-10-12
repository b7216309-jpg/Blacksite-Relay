/* Read-only soundtrack pacing. No game timers, saved state or random draws. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.RelayMusicDirector = api;
})(typeof window === 'object' ? window : globalThis, function () {
  'use strict';
  const tracks = Object.freeze(Object.fromEntries([
    ['neon-standby', 96, 0.9495],
    ['backstreet-signal', 112, 0.7482],
    ['chrome-pursuit', 128, 0.7907],
    ['redline-protocol', 160, 0.6926]
  ].map(([name, bpm, gain]) => [name, Object.freeze({ name, bpm, gain, loopStart: 0, loopEnd: 60 })])));
  const stages = Object.freeze(['backstreet-signal', 'chrome-pursuit', 'redline-protocol']);
  const policy = Object.freeze({
    middle: Object.freeze({ earliestSeconds: 60, scoreUnits: 50, fallbackSeconds: 120 }),
    fast: Object.freeze({ earliestSeconds: 150, scoreUnits: 500, fallbackSeconds: 240 }),
    minimumStageSeconds: 60, maxScoreUnits: 1e6, maxClockGapMs: 5000
  });
  const gameplayScreens = new Set(['game', 'typing', 'backdoor', 'bypass']);
  const endedScreens = new Set(['menu', 'main-menu', 'persistent', 'upgrades', 'prestige',
    'tutorial', 'achievements', 'leaderboard', 'success', 'secured', 'transfer', 'busted', 'bust']);
  const nonnegative = (value, fallback = 0) => typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, value) : fallback;
  const validId = value => Number.isSafeInteger(value) && value >= 0;

  function create({ now = () => performance.now() } = {}) {
    let anchor = nonnegative(now()), screen = 'menu', hidden = false, blocked = false, running = false;
    let runId = -1, endedRunId = -1, runActive = false, startMoney = 0, earningScale = 20;
    let activeSeconds = 0, stageStartedAt = 0, stage = 0, grossUnits = 0, peakUnits = 0;
    function eligible() { return runActive && gameplayScreens.has(screen) && running && !hidden && !blocked; }
    function settle() {
      const timestamp = nonnegative(now(), anchor);
      const gap = timestamp - anchor;
      // Sleep, suspension and a stopped scheduler cannot fast-forward the music.
      if (eligible() && gap >= 0 && gap <= policy.maxClockGapMs) activeSeconds += gap / 1000;
      anchor = timestamp;
    }
    function units(amount) { return Math.min(policy.maxScoreUnits, nonnegative(amount) / earningScale); }
    function score() { return Math.max(grossUnits, peakUnits); }
    function advanceStage() {
      if (!eligible() || stage >= 2) return;
      const threshold = stage === 0 ? policy.middle : policy.fast;
      if (activeSeconds >= threshold.earliestSeconds
          && activeSeconds - stageStartedAt >= policy.minimumStageSeconds
          && (score() >= threshold.scoreUnits || activeSeconds >= threshold.fallbackSeconds)) {
        stage += 1;
        stageStartedAt = activeSeconds;
      }
    }
    function begin(data) {
      if (!validId(data.runId) || data.runId === 0 || data.runId <= endedRunId || data.runId <= runId) return false;
      runId = data.runId;
      runActive = true;
      startMoney = nonnegative(data.startMoney);
      earningScale = Math.max(20, nonnegative(data.earningScale, 20));
      activeSeconds = 0; stageStartedAt = 0; stage = 0; grossUnits = 0; peakUnits = 0;
      return true;
    }
    function end() {
      endedRunId = Math.max(endedRunId, runId);
      runActive = false;
    }
    function noteMoney(value) {
      if (runActive && typeof value === 'number' && Number.isFinite(value)) {
        peakUnits = Math.max(peakUnits, units(Math.max(0, value - startMoney)));
      }
    }
    function state() {
      return Object.freeze({
        track: runActive && gameplayScreens.has(screen) ? stages[stage] : 'neon-standby',
        stage, activeSeconds, stageSeconds: activeSeconds - stageStartedAt,
        scoreUnits: score(), grossUnits, peakUnits, runId, runActive, startMoney, earningScale,
        screen, hidden, blocked, running, progressing: eligible()
      });
    }
    function setState(snapshot = {}) {
      settle();
      // An older state publication must not overwrite a newer run.
      if (validId(snapshot.runId) && snapshot.runId < runId) return state();
      if (typeof snapshot.screen === 'string') screen = snapshot.screen;
      if (gameplayScreens.has(screen) && validId(snapshot.runId) && snapshot.runId > runId) begin(snapshot);
      if (endedScreens.has(screen)) {
        if (validId(snapshot.runId)) endedRunId = Math.max(endedRunId, snapshot.runId);
        end();
      } else if (runActive && (!validId(snapshot.runId) || snapshot.runId === runId)) noteMoney(snapshot.money);
      advanceStage();
      return state();
    }
    function onEvent(detail = {}) {
      settle();
      if (detail.type === 'run-start') { begin(detail); return state(); }
      if (!runActive || !validId(detail.runId) || detail.runId !== runId) return state();
      if (detail.type === 'transfer' || detail.type === 'bust') end();
      else {
        noteMoney(detail.money);
        if (detail.type === 'hack') grossUnits = Math.min(policy.maxScoreUnits, grossUnits + units(detail.gain));
      }
      advanceStage();
      return state();
    }
    function flag(key, value) {
      settle();
      if (key === 'hidden') hidden = !!value;
      if (key === 'blocked') blocked = !!value;
      if (key === 'running') running = !!value;
      // Stage advancement is evaluated only with the new eligibility.
      advanceStage();
      return state();
    }
    return Object.freeze({
      setState, onEvent, tick() { settle(); advanceStage(); return state(); }, getState: state,
      setHidden(value) { return flag('hidden', value); },
      setBlocked(value) { return flag('blocked', value); },
      setRunning(value) { return flag('running', value); }
    });
  }
  return Object.freeze({ create, tracks, policy, stages });
});

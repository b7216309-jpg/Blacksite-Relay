(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.RiskQuitFlow = api;
})(typeof window === 'object' ? window : globalThis, function() {
  'use strict';
  function create(deps) {
    let phase = 'idle', problem = '', generation = 0, running = null, discarding = false;
    const timeoutMs = deps.timeoutMs || 10000;
    const state = () => Object.freeze({ phase, problem, discarding, ...deps.context() });
    function publish(next, message = '') {
      phase = next; problem = message;
      deps.block(next !== 'idle');
      deps.render(state());
    }
    function attempt(operation, pendingPhase) {
      if (running) return running;
      const token = ++generation;
      publish(pendingPhase);
      let timeout;
      const current = () => token === generation;
      const job = Promise.resolve().then(() => operation(current));
      const expired = new Promise(resolve => {
        timeout = deps.setTimeout(() => {
          if (current()) {
            generation++;
            deps.cancelNative?.();
            publish('error', discarding ? 'Closing took too long. Please retry.' : 'Saving took too long. Your previous save is protected.');
          }
          resolve(false);
        }, timeoutMs);
      });
      const pending = Promise.race([job, expired]).catch(() => {
        if (current()) publish('error', 'Could not save your progress.');
        return false;
      }).finally(() => {
        deps.clearTimeout(timeout);
        if (running === pending) running = null;
      });
      running = pending;
      return pending;
    }
    async function saveAndClose(current) {
      deps.beginNative?.();
      const loaded = await deps.waitForLoad();
      if (!current()) return false;
      if (!loaded) { publish('error', 'Your existing save could not be read. It has been preserved.'); return false; }
      publish('saving');
      const recordsSaved = await deps.flushRecords(true);
      if (!current()) return false;
      if (!await deps.save()) {
        if (current()) publish('error', 'Could not save your progress.');
        return false;
      }
      if (!current()) return false;
      if (!recordsSaved) { publish('error', 'Your progress is saved, but your local record could not be saved.'); return false; }
      // A protocol can resolve while a disk write is pending. The renderer's
      // save queue drains the latest snapshot; native finish checks its version.
      const closed = await deps.finish(false);
      if (!current()) return false;
      if (!closed) { publish('error', 'Could not finish saving. Please retry.'); return false; }
      publish('closed');
      return true;
    }
    function request() {
      if (phase !== 'idle') return running || Promise.resolve(false);
      discarding = false;
      if (!deps.loading()) {
        if (deps.context().runActive) { publish('confirm'); return Promise.resolve(false); }
        return attempt(saveAndClose, 'saving');
      }
      return attempt(async current => {
        const loaded = await deps.waitForLoad();
        if (!current()) return false;
        if (!loaded) { publish('error', 'Your existing save could not be read. It has been preserved.'); return false; }
        if (deps.context().runActive) { publish('confirm'); return false; }
        return saveAndClose(current);
      }, 'loading');
    }
    return Object.freeze({
      request,
      confirm() { if (phase !== 'confirm') return running || Promise.resolve(false); discarding = false; return attempt(saveAndClose, 'saving'); },
      retry() { if (phase !== 'error') return running || Promise.resolve(false); discarding = false; return attempt(saveAndClose, 'saving'); },
      cancel() {
        if (!['confirm', 'error'].includes(phase)) return false;
        generation++; discarding = false; deps.cancelNative?.(); publish('idle'); return true;
      },
      discard() {
        if (phase !== 'error') return running || Promise.resolve(false);
        discarding = true;
        return attempt(async current => {
          deps.beginNative?.();
          await deps.drainSaves?.();
          if (!current()) return false;
          const closed = await deps.finish(true);
          if (!current()) return false;
          publish(closed ? 'closed' : 'error', closed ? '' : 'Could not close yet. Please retry.');
          return !!closed;
        }, 'saving');
      },
      refresh() { if (phase !== 'idle') deps.render(state()); },
      getState: state
    });
  }
  return Object.freeze({ create });
});

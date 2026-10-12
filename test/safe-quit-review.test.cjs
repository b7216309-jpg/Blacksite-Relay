'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { harness } = require('./harness.cjs');
const turn = () => new Promise(resolve => setImmediate(resolve));
function deferred() { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; }
function memory(h) {
  h.run('money=100;risk=30;sessionHackCount=1;startBackdoorProtocol();');
  h.now(3000); h.run('startBackdoorGame();');
  return h.timers.get(h.run('backdoorTimer'));
}

test('a Memory deadline during a pending quit save is saved once without duplicated rewards or penalties', async () => {
  const h = harness(), deadline = memory(h), first = deferred(); let writes = 0, closed = 0;
  h.context.electronAPI.saveGame = data => { h.saves.push(JSON.parse(JSON.stringify(data))); return ++writes === 1 ? first.promise : Promise.resolve(true); };
  h.context.electronAPI.closeApp = () => { closed++; };
  await h.run('RiskQuit.request()'); const quitting = h.run('RiskQuit.confirm()'); await turn();
  assert.equal(writes, 1); h.now(11001); deadline(); deadline();
  assert.equal(h.run('risk'), 45); assert.equal(h.run('money'), 100);
  first.resolve(true); assert.equal(await quitting, true);
  assert.equal(closed, 1); assert.equal(h.saves.at(-1).risk, 45);
  assert.equal(h.events.filter(event => event.type === 'risk:event' && event.detail.type === 'minigame-fail').length, 1);
  assert.equal(h.run('achievementStats.cleanMemoryWins'), 0);
});

test('a late Memory outcome while explicitly discarding cannot start a new save or retry', async () => {
  const h = harness(), deadline = memory(h), finishing = deferred(); let writes = 0, recordCalls = 0;
  h.context.electronAPI.saveGame = () => { writes++; return Promise.resolve(false); };
  h.context.electronAPI.flushLocalScores = () => { recordCalls++; return Promise.resolve(true); };
  h.context.electronAPI.finishQuit = ({ discard }) => { assert.equal(discard, true); return finishing.promise; };
  await h.run('RiskQuit.request()'); await h.run('RiskQuit.confirm()');
  assert.equal(h.run('RiskQuit.getState().phase'), 'error');
  const priorWrites = writes, priorRecords = recordCalls, discarding = h.run('RiskQuit.discard()'); await turn();
  h.now(11001); deadline(); await turn();
  assert.equal(h.run('risk'), 45, 'the real deadline still settles the existing challenge');
  assert.equal(writes, priorWrites, 'discard drains existing writes and does not enqueue a new one');
  assert.equal(recordCalls, priorRecords, 'discard never retries the record store');
  finishing.resolve(true); assert.equal(await discarding, true);
});

test('confirmation during Memory preparation never extends reveal or recall deadlines', async () => {
  const h = harness(); h.run('money=100;risk=30;sessionHackCount=1;startBackdoorProtocol();');
  const countdown = h.timers.get(h.run('backdoorCountdownInterval'));
  h.now(1000); await h.run('RiskQuit.request()');
  h.now(5000); countdown();
  assert.equal(h.run('backdoorDeadlineAt'), 11000);
  assert.equal(h.run('activeMiniGame.prepareDeadlineAt'), 3000);
  assert.ok(h.elements.get('backdoor-grid').children.every(cell => cell.dataset.state === 'idle'));
  h.run('RiskQuit.cancel()'); h.now(11001);
  h.run('handleBackdoorClick(backdoorTargetPositions[0], document.getElementById("backdoor-grid").children[backdoorTargetPositions[0]])');
  assert.equal(h.run('risk'), 45); assert.equal(h.run('backdoorClicked'), 0);
  assert.equal(h.run('achievementStats.cleanMemoryWins'), 0);
});

test('time spent in a quit dialog remains part of the Quick Hands achievement clock', async () => {
  const h = harness(); h.run('money=100;risk=30;sessionHackCount=1;bypassCharge=15;bypass();');
  const started = h.run('activeMiniGame.achievementStartedAt');
  await h.run('RiskQuit.request()'); h.now(16001); h.run('RiskQuit.cancel()');
  assert.equal(h.run('activeMiniGame.achievementStartedAt'), started);
  // Place the isolated run at its tenth stop to exercise the actual award guard.
  h.run('bypassLevel=10;bypassGauge=bypassTarget;attemptBypass();');
  assert.equal(h.run('achievementStats.bestBypassStops'), 10);
  assert.equal(h.run('achievements.speedRunner.unlocked'), false);
});

for (const mode of ['unsuccessful', 'timed-out']) {
  test(`cancelling a discard after ${mode === 'unsuccessful' ? 'failure' : 'timeout'} restores ordinary transfer autosaves`, async () => {
    const h = harness(), late = deferred(); let failSave = true;
    h.run('money=100;risk=30;sessionHackCount=1;');
    h.context.electronAPI.saveGame = data => { h.saves.push(JSON.parse(JSON.stringify(data))); return Promise.resolve(!failSave); };
    h.context.electronAPI.finishQuit = ({ discard }) => { assert.equal(discard, true); return mode === 'timed-out' ? late.promise : Promise.resolve(false); };
    await h.run('RiskQuit.request()'); await h.run('RiskQuit.confirm()');
    const existingTimers = new Set(h.timers.keys());
    const discarding = h.run('RiskQuit.discard()'); await turn();
    if (mode === 'timed-out') {
      const deadlineTimers = [...h.timers].filter(([id]) => !existingTimers.has(id));
      assert.equal(deadlineTimers.length, 1);
      deadlineTimers[0][1]();
    }
    assert.equal(await discarding, false); assert.equal(h.run('RiskQuit.getState().phase'), 'error');
    assert.equal(h.run('RiskQuit.getState().discarding'), true);
    assert.equal(h.run('RiskQuit.cancel()'), true);
    assert.equal(h.run('RiskQuit.getState().discarding'), false); assert.equal(h.context.RiskQuitBlocking, false);
    const priorWrites = h.saves.length; failSave = false;
    h.run('transfer()'); await turn();
    assert.ok(h.saves.length > priorWrites, 'normal gameplay autosaves resume after Keep Playing');
    assert.equal(h.saves.at(-1).totalMoney, 100); assert.equal(h.saves.at(-1).money, 0);
    assert.equal(h.saves.at(-1).achievementStats.successfulSessions, 1);
    late.resolve(true); await turn();
    assert.equal(h.run('RiskQuit.getState().phase'), 'idle', 'a stale finish cannot revive the cancelled dialog');
  });
}

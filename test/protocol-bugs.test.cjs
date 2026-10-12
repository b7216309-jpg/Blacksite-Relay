const test = require('node:test');
const assert = require('node:assert/strict');
const {harness} = require('./harness.cjs');

function active(h, game) {
  h.run(game === 'typing' ? 'startTypingProtocol()' : 'startBackdoorProtocol()');
  h.advance(3000);
  h.run(game === 'typing' ? 'startTypingGame()' : 'startBackdoorGame()');
}
function results(h, game) {
  return h.events.filter(e => e.type === 'risk:protocol' && e.detail.game === game && e.detail.phase === 'result');
}
function closeMemory(h) {
  const id = h.run('activeMiniGame.closeTimer'), fn = h.timers.get(id);
  h.timers.delete(id); fn();
  return fn;
}

test('protocol starts reject covered screens, loading saves and each other without RNG consumption', () => {
  for (const screen of ['main-menu','screen-settings','screen-persistent','screen-tutorial','screen-success','screen-busted']) {
    const h=harness();h.run(`document.getElementById('${screen}').style.display='flex';bypassCharge=15`);
    const before=h.snapshot(),calls=h.calls();h.run('startTypingProtocol();startBackdoorProtocol();bypass()');
    assert.deepEqual(h.snapshot(),before,screen);assert.equal(h.calls(),calls);
  }
  for (const flag of ['RiskSaveLoading','RiskSaveReadBlocked']) {
    const loading=harness();loading.run(`window.${flag}=true;bypassCharge=15`);
    loading.run('startTypingProtocol();startBackdoorProtocol();bypass()');assert.equal(loading.run('activeMiniGame'),null);assert.equal(loading.calls(),0);
  }
  for (const first of ['startTypingProtocol()','startBackdoorProtocol()','bypassCharge=15;bypass()']) {
    const h=harness();h.run(first);const before=h.snapshot(),calls=h.calls();
    h.run('startTypingProtocol();startBackdoorProtocol();bypass()');assert.deepEqual(h.snapshot(),before);assert.equal(h.calls(),calls);
  }
});

test('typing cannot start early or renew its deadline by starting twice', () => {
  const h=harness();h.run('startTypingProtocol();startTypingGame()');assert.equal(h.run('typingStarted'),false);
  h.now(3000);h.run('startTypingGame()');assert.equal(h.run('typingDeadlineAt'),10000);
  const timer=h.run('typingTimeout');h.now(7000);h.run('startTypingGame()');assert.equal(h.run('typingDeadlineAt'),10000);assert.equal(h.run('typingTimeout'),timer);
});

test('late typing input loses even before its delayed timeout callback runs', () => {
  const h=harness();h.run('risk=20;multiplier=3');active(h,'typing');h.now(10000);
  h.run('document.getElementById("typing-input").value=typingPhrase;checkTypingInput()');
  assert.equal(h.run('multiplier'),3);assert.equal(h.run('risk'),30);assert.equal(results(h,'typing').length,1);assert.equal(results(h,'typing')[0].detail.success,false);
});

test('typing settlement is once-only and an old timeout cannot settle a new run', () => {
  const h=harness();h.run('nodesValidated=2;multiplier=1;risk=20');active(h,'typing');
  const oldTimeout=h.timers.get(h.run('typingTimeout'));h.run('successTypingProtocol();successTypingProtocol();failTypingProtocol()');
  assert.equal(h.run('multiplier'),3);assert.equal(h.run('risk'),20);assert.equal(results(h,'typing').length,1);
  active(h,'typing');oldTimeout();assert.equal(h.run('typingActive'),true);assert.equal(h.run('risk'),20);assert.equal(results(h,'typing').length,1);
});

test('a severely delayed preparation callback cannot grant a fresh typing window', () => {
  const h=harness();h.run('startTypingProtocol()');const callback=h.timers.get(h.run('typingCountdownInterval'));
  h.now(30000);callback();assert.equal(h.run('typingActive'),false);assert.equal(results(h,'typing').length,1);assert.equal(results(h,'typing')[0].detail.success,false);
});

test('case-insensitive trimmed typing validation and character feedback agree', () => {
  const h=harness();active(h,'typing');h.run('document.getElementById("typing-input").value="  "+typingPhrase.slice(0,4).toUpperCase();checkTypingInput()');
  const state=h.run('RiskPresentation.protocol()');assert.equal(state.errors,0);assert.equal(state.correctCount,4);
  h.run('document.getElementById("typing-input").value="  "+typingPhrase.toUpperCase()+"  ";checkTypingInput()');assert.equal(results(h,'typing')[0].detail.success,true);
});

test('memory deadline stays fixed when a timer tick is delayed', () => {
  const h=harness();active(h,'backdoor');const tick=h.timers.get(h.run('backdoorTimer'));
  h.now(6500);tick();assert.equal(h.run('backdoorTimeLeft'),5);assert.equal(h.run('backdoorDeadlineAt'),11000);
  h.now(30000);tick();assert.equal(h.run('backdoorActive'),false);assert.equal(h.run('backdoorTimeLeft'),0);assert.equal(results(h,'backdoor').length,1);
});

test('late memory selection fails before its delayed interval callback', () => {
  const h=harness();h.run('money=100;multiplier=8;risk=20');active(h,'backdoor');h.now(11000);
  h.run('handleBackdoorClick(backdoorTargetPositions[0],document.getElementById("backdoor-grid").children[backdoorTargetPositions[0]])');
  assert.equal(h.run('money'),100);assert.equal(h.run('risk'),35);assert.equal(h.run('backdoorClicked'),0);assert.equal(results(h,'backdoor')[0].detail.success,false);
});

test('delayed memory preparation expires rather than extending target memorization', () => {
  const h=harness();h.run('startBackdoorProtocol()');const tick=h.timers.get(h.run('backdoorCountdownInterval'));
  h.now(30000);tick();assert.equal(h.run('backdoorActive'),false);assert.equal(results(h,'backdoor')[0].detail.success,false);
  assert.equal(h.elements.get('backdoor-grid').children.filter(c=>c.dataset.state==='target').length,0);
});

test('memory completion, close callback and stale cells cannot affect a newer run', () => {
  const h=harness();h.run('money=100;multiplier=8;risk=50');active(h,'backdoor');const oldCell=h.elements.get('backdoor-grid').children[0];
  const before=h.run('money');h.run('endBackdoor(true);endBackdoor(true);endBackdoor(false)');assert.equal(h.run('money'),before+24);assert.equal(h.run('risk'),25);assert.equal(results(h,'backdoor').length,1);
  const calls=h.calls();h.run('startBackdoorProtocol();startTypingProtocol()');assert.equal(h.calls(),calls,'result delay retains ownership');
  const oldClose=closeMemory(h);active(h,'backdoor');oldClose();h.context.staleCell=oldCell;h.run('handleBackdoorClick(0,staleCell)');
  assert.equal(h.run('currentPresentationScreen()'),'backdoor');assert.equal(h.run('backdoorClicked'),0);assert.equal(h.run('backdoorErrors'),0);
});

test('memory ignores repeated selection and credits the fifth target exactly once', () => {
  const h=harness();h.run('money=100;multiplier=8;risk=50');active(h,'backdoor');
  h.run('for(const i of backdoorTargetPositions){const cell=document.getElementById("backdoor-grid").children[i];handleBackdoorClick(i,cell);handleBackdoorClick(i,cell)}');
  assert.equal(h.run('backdoorClicked'),5);assert.equal(h.run('money'),124);assert.equal(h.run('risk'),25);assert.equal(results(h,'backdoor').length,1);
});

test('memory reward saturates extreme balances instead of producing Infinity', () => {
  const h=harness();h.run('money=Number.MAX_VALUE;multiplier=Number.MAX_VALUE;risk=50');active(h,'backdoor');h.run('endBackdoor(true)');
  assert.equal(h.run('money'),Number.MAX_VALUE);assert.equal(h.run('Number.isFinite(money)'),true);
});

test('bypass catches up fixed60Hz movement after a visible frame stall', () => {
  const smooth=harness(false,[.5]),lagged=harness(false,[.5]);
  for(const h of [smooth,lagged]){h.run('bypassCharge=15;bypass()');h.frame(0);}
  for(let n=1;n<=600;n++)smooth.frame(n*1000/60);lagged.frame(10000);
  assert.ok(Math.abs(smooth.run('bypassGauge')-lagged.run('bypassGauge'))<1e-8);assert.equal(smooth.run('bypassDirection'),lagged.run('bypassDirection'));
  const stepped=harness(false,[.5]),longStall=harness(false,[.5]);
  for(const h of [stepped,longStall]){h.run('bypassCharge=15;bypass()');h.frame(0);}
  stepped.run('for(let i=0;i<36000;i++)updateBypassGauge(false)');longStall.frame(600000);
  assert.ok(Math.abs(stepped.run('bypassGauge')-longStall.run('bypassGauge'))<1e-8,'whole-cycle skipping preserves ten minutes of simulation');
  assert.equal(stepped.run('bypassDirection'),longStall.run('bypassDirection'));assert.equal(longStall.rafs.size,1);
});

test('stale bypass level frames and repeated exits cannot duplicate movement or rewards', () => {
  const h=harness(false,[.5,.5,.5]);h.run('bypassCharge=15;risk=50;bypass()');const oldFrame=[...h.rafs.values()][0];
  h.run('bypassGauge=bypassTarget;attemptBypass()');const before=h.run('bypassGauge');oldFrame(1000);assert.equal(h.run('bypassGauge'),before);assert.equal(h.rafs.size,1);
  h.run('bypassGauge=bypassTarget;attemptBypass();exitBypassGame();exitBypassGame()');assert.equal(h.run('risk'),46);assert.equal(results(h,'bypass').length,1);assert.equal(h.rafs.size,0);
});

test('bypass counts the fiftieth successful stop and rewards all fifty', () => {
  const h=harness();h.run('bypassCharge=15;risk=100;bypass();for(let i=0;i<50;i++){bypassGauge=bypassTarget;attemptBypass()}');
  const result=results(h,'bypass')[0].detail;assert.equal(result.stops,50);assert.equal(result.rewardReduction,100);assert.equal(h.run('risk'),0);assert.equal(h.run('currentPresentationScreen()'),'game');
});

test('Speed Runner requires ten completed stops, not entering level ten', () => {
  for(const stops of [9,10]){const h=harness();h.run(`bypassCharge=15;bypass();for(let i=0;i<${stops};i++){bypassGauge=bypassTarget;attemptBypass()}exitBypassGame()`);assert.equal(h.run('achievementStats.bypassLevel10Plus'),stops===10?1:0);}
});

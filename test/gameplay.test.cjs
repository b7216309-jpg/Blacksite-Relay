const test = require('node:test');
const assert = require('node:assert/strict');
const {harness} = require('./harness.cjs');
function parity(name,setup,action,rolls=[]) {
  test(name,()=>{
    const old=harness(true,[...rolls]),next=harness(false,[...rolls]);
    for(const h of [old,next]){h.run(setup);h.run(action);}
    // Compare original reward/risk/cooldown formulas; corrected achievements and
    // peak-risk accounting are asserted in economy-bugs/protocol-bugs tests.
    const mechanics=h=>{const s=h.snapshot();delete s.achievements;delete s.achievementStats;delete s.sessionStats.maxRisk;return s;};
    assert.deepEqual(mechanics(next),mechanics(old));
    assert.equal(next.calls(),old.calls(),'presentation must not consume gameplay RNG');
  });
}
parity('all three hack types retain rewards, multipliers, nodes and risk', 'money=500;risk=12;pUpgrades.miner.lvl=2;pUpgrades.vpn.lvl=4;prestigePoints=2;', 'hack(1);hack(2);hack(3);hack(1);hack(2);');
parity('overclock gains and all turn cooldowns remain unchanged','money=4000;risk=12;overclockBonusTurns=2;overclockCooldown=7;gambleCooldown=4;insuranceTurns=5;', 'hack(3);hack(2);hack(1);');
parity('stealth hack preserves RNG sequence and risk suppression','money=100;risk=0;pUpgrades.volt.lvl=40;','hack(2);',[.1,.99,.99,.99]);
parity('ghost saves a detection and remaining hack proceeds','money=100;risk=89;ghostShieldActive=true;','hack(3);',[.99,0,.99,.99,.99]);
parity('bust preserves insurance recovery and run reset','money=1280;risk=89;insuranceTurns=3;','hack(3);',[.99,0]);
for (const [name,roll] of [['jackpot',0],['risk reduction',.2],['penalty',.5],['loss',.8],['purge',.905],['bust',.99]]) parity('gamble '+name+' outcome unchanged','money=1000;risk=50;sessionHackCount=1;','buyBonus(3);',[roll]);
parity('gamble ghost save remains identical','money=1000;risk=50;sessionHackCount=1;ghostShieldActive=true;','buyBonus(3);',[.99]);
parity('purchased bonuses retain costs and effects','money=10000;risk=75;pUpgrades.fan.lvl=10;nodesValidated=3;','buyBonus(1);buyBonus(1);buyBonus(2);buyBonus(4);buyBonus(5);');
parity('overclock costs and blocked purchase remain unchanged','money=10000;risk=44;','buyBonus(6);buyBonus(6);');
parity('persistent upgrades and prestige reset remain unchanged','totalMoney=300000;document.getElementById("screen-persistent").style.display="flex";','buyPersistent("ram");buyPersistent("miner");doPrestige();');
parity('transfer preserves bank and reset','sessionHackCount=1;money=1234;risk=42;multiplier=12;nodesValidated=7;sessionStats.maxMultiplier=12;sessionStats.maxRisk=61;sessionStats.maxNodes=7;','transfer();');
function protocolParity(name,game,setup,action) {
  test(name,()=>{
    const old=harness(true),next=harness();
    for(const h of [old,next]) {
      h.run(setup);
      h.run(game==='typing'?'startTypingProtocol()':game==='backdoor'?'startBackdoorProtocol()':'bypassCharge=15;bypass()');
      if(game!=='bypass'){h.advance(3000);h.run(game==='typing'?'startTypingGame()':'startBackdoorGame()');}
      h.run(action);
    }
    for(const key of ['money','risk','multiplier','typingActive','typingStarted','backdoorActive','backdoorStarted','bypassCharge']) assert.equal(next.run(key),old.run(key),key);
    assert.equal(next.calls(),old.calls(),'normal protocol outcomes retain gameplay RNG consumption');
  });
}
protocolParity('typing success preserves multiplier bonus','typing','nodesValidated=7;multiplier=3;','successTypingProtocol();');
protocolParity('typing failure preserves risk penalty','typing','risk=95;','failTypingProtocol();');
protocolParity('backdoor success preserves reward','backdoor','money=80;risk=60;multiplier=8;','endBackdoor(true);');
protocolParity('backdoor failure preserves penalty','backdoor','risk=95;','endBackdoor(false);');
protocolParity('bypass reward unchanged','bypass','risk=80;','bypassLevel=12;exitBypassGame(false);');
test('effects events and snapshots preserve state and randomness',()=>{
  const h=harness();const before=h.snapshot(),calls=h.calls();
  h.run(`relayEvent('hack',{hackType:3});publishPresentation();publishPresentation();`);
  assert.deepEqual(h.snapshot(),before);assert.equal(h.calls(),calls);
  const state=h.events.find(e=>e.type==='risk:state').detail;
  assert.ok(Object.isFrozen(state)&&Object.isFrozen(state.bonusCosts));
});
test('all overlays block underlying hacks, bonuses and transfers',()=>{
  for(const id of ['screen-tutorial','screen-achievements','screen-leaderboard','screen-persistent','screen-settings','screen-intro','screen-bypass','typing-container','backdoor-container','screen-success','screen-busted','main-menu']){
    const h=harness();h.run(`money=1000;risk=15;document.getElementById(${JSON.stringify(id)}).style.display='flex';`);
    const before=h.snapshot();h.run('hack(3);buyBonus(1);transfer();bypass();');assert.deepEqual(h.snapshot(),before,id);
  }
});
test('bypass gauge timing matches across 60, 120, 144 and 240 Hz',()=>{
  const results=[];
  for(const hz of [60,120,144,240]) {
    const h=harness(false,[.5]);h.run('bypassCharge=15;bypass();');
    h.frame(0);for(let n=1;n<=hz*3;n++)h.frame(n*1000/hz);
    results.push(h.run('({gauge:bypassGauge,direction:bypassDirection})'));
    assert.equal(h.rafs.size,1);h.run('exitBypassGame()');assert.equal(h.rafs.size,0);
  }
  for (const result of results.slice(1)) {
    assert.ok(Math.abs(results[0].gauge-result.gauge)<1e-8);
    assert.equal(results[0].direction,result.direction);
  }
});
test('old save restores progression and receives presentation defaults',async()=>{
  const h=harness();const save={money:900,totalMoney:42000,playerName:'LEGACY',pUpgrades:{ram:{lvl:7},miner:{lvl:5}},achievements:{firstBlood:{unlocked:true}},prestigeLevel:2,prestigePoints:2,musicVolume:0,sfxVolume:.25,tutorialSeen:true};
  h.context.electronAPI.loadGame=async()=>save;await h.run('loadSavedGame()');h.run('saveGameState()');
  const out=h.saves.at(-1);assert.equal(out.totalMoney,42000);assert.equal(out.pUpgrades.ram.lvl,7);assert.equal(out.achievements.firstBlood.unlocked,true);assert.equal(out.musicVolume,0);assert.equal(out.prestigeLevel,2);assert.deepEqual(out.presentation,{version:1,reducedMotion:false,effectsLevel:'full',introSeen:false,language:'en'});
});
test('presentation settings round-trip without changing gameplay',async()=>{
  const h=harness();h.run(`money=50;RiskPresentation.setPreferences({reducedMotion:true,effectsLevel:'low',introSeen:true});`);
  const save=h.saves.at(-1);h.context.electronAPI.loadGame=async()=>save;await h.run('loadSavedGame()');
  assert.equal(h.run('money'),50);assert.equal(h.run('presentationPreferences.reducedMotion'),true);assert.equal(h.run('presentationPreferences.effectsLevel'),'low');
});
test('player-controlled event text is escaped',()=>{const h=harness();h.run(`updateLog('<img src=x onerror=bad>');`);assert.ok(h.elements.get('log-container').innerHTML.includes('&lt;img'));});

test('protocol presentation exposes the real typing deadline without adding gameplay rolls',()=>{
  const h=harness(false,[.1,.2,.3]);h.run('startTypingProtocol()');const calls=h.calls();
  const countdown=h.run('RiskPresentation.protocol()');assert.equal(countdown.phase,'countdown');assert.equal(countdown.countdown,3);
  h.advance(3000);h.run('startTypingGame()');const active=h.run('RiskPresentation.protocol()');
  assert.equal(active.durationMs,7000);assert.equal(active.deadlineAt,10000);assert.ok(Object.isFrozen(active));
  assert.equal(h.calls(),calls);assert.equal(h.run('typingStarted'),true);
});
test('memory presentation removes target styling before recall and exposes no target positions',()=>{
  const h=harness();h.run('startBackdoorProtocol()');const grid=h.elements.get('backdoor-grid');
  assert.equal(grid.children.filter(c=>c.dataset.state==='target').length,5);const calls=h.calls();
  h.advance(3000);h.run('startBackdoorGame()');assert.ok(grid.children.every(c=>c.dataset.state==='idle'));
  const s=h.run('RiskPresentation.protocol()');assert.equal(s.phase,'active');assert.equal(s.durationMs,8000);assert.equal(s.targetCount,5);
  assert.equal(s.targets,undefined);assert.equal(s.targetPositions,undefined);assert.equal(h.calls(),calls);
});
test('mini-game outcome receipts describe the actual resolved changes',()=>{
  const h=harness();h.run('risk=95;startTypingProtocol()');h.advance(3000);h.run('startTypingGame();failTypingProtocol()');
  let s=h.run('RiskPresentation.protocol()');assert.equal(s.success,false);assert.equal(s.rewardValue,5);assert.equal(s.phase,'result');
  h.run('risk=50;money=100;multiplier=8;startBackdoorProtocol()');h.advance(3000);h.run('startBackdoorGame();endBackdoor(true)');
  s=h.run('RiskPresentation.protocol()');assert.equal(s.success,true);assert.ok(s.rewardText.includes('$24'));assert.ok(s.rewardText.includes('25'));assert.equal(h.run('money'),124);
  h.timers.get(h.run('activeMiniGame.closeTimer'))();
  h.run('risk=3;bypassCharge=15;bypass();bypassLevel=4;exitBypassGame()');
  s=h.run('RiskPresentation.protocol()');assert.equal(s.rewardReduction,3);assert.equal(h.run('risk'),0);
  h.run('risk=3.14159265359;bypassCharge=15;bypass();bypassLevel=4;exitBypassGame()');
  s=h.run('RiskPresentation.protocol()');assert.equal(s.rewardText,'Trace −3.14 points');assert.equal(s.rewardReduction,3.14159265359);
  h.run('risk=0;bypassCharge=15;bypass();bypassLevel=4;exitBypassGame()');
  s=h.run('RiskPresentation.protocol()');assert.match(s.rewardText,/already clear/);assert.equal(s.rewardReduction,0);
});
test('bonus price labels follow a packet reward without changing its outcome',()=>{
  const h=harness(false,[.3]);h.run('money=100;updateUI();');assert.equal(h.elements.get('price-2').textContent,'$20');
  h.run('triggerRandomEvent()');const expected=h.run('displayMoney(money*.2)');assert.equal(h.elements.get('price-2').textContent,expected);
  const old=harness(true,[.3]);old.run('money=100;updateUI();triggerRandomEvent();');assert.equal(h.run('money'),150);assert.equal(h.run('money'),old.run('money'));assert.equal(h.calls(),old.calls());
});
test('memory display uses the fixed deadline after a delayed real tick',()=>{
  const h=harness();h.run('startBackdoorProtocol()');h.advance(3000);h.run('startBackdoorGame()');h.now(6500);
  h.timers.get(h.run('backdoorTimer'))();const s=h.run('RiskPresentation.protocol()');
  assert.equal(h.run('backdoorTimeLeft'),5);assert.equal(s.remainingMs,4500);assert.equal(s.deadlineAt,11000);
});

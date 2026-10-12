const test = require('node:test');
const assert = require('node:assert/strict');
const {harness} = require('./harness.cjs');

test('failed or zero-fund purchases never award bonuses or arsenal credit',()=>{
  const h=harness();
  h.run('for(let id=1;id<=6;id++)buyBonus(id)');
  assert.equal(h.run('insuranceTurns'),0);
  assert.equal(h.run('gambleCooldown'),0);
  assert.deepEqual(h.snapshot().achievementStats.bonusesBoughtThisSession,[]);
  assert.equal(h.calls(),0);
  h.run('money=200;ghostShieldActive=true;buyBonus(6)');
  assert.equal(h.run('money'),200);
  assert.equal(h.run('achievementStats.boughtAllBonusesThisSession'),false);
});

test('a busted gamble cannot leak purchase credit into the next run',()=>{
  const h=harness(false,[.99]);h.run('money=100;risk=50;sessionHackCount=1;buyBonus(3)');
  assert.deepEqual(h.snapshot().achievementStats.bonusesBoughtThisSession,[]);
  assert.equal(h.run('achievementStats.gambleStreak'),0);
  assert.equal(h.run('currentPresentationScreen()'),'busted');
});

test('startup grant cannot be extracted without a successful hack',()=>{
  const h=harness();h.run(`pUpgrades.ram.lvl=20;document.getElementById('screen-persistent').style.display='flex';startGame();transfer();`);
  assert.equal(h.run('totalMoney'),0);assert.equal(h.run('money'),200);
  assert.equal(h.run('achievementStats.successfulSessions'),0);
  h.run('hack(1);transfer()');
  assert.equal(h.run('totalMoney'),205);assert.equal(h.run('achievementStats.successfulSessions'),1);
  assert.equal(h.run('achievements.masochist.unlocked'),false);
  h.run('transfer();closeOverlays();startGame();transfer()');
  assert.equal(h.run('totalMoney'),205);
});

test('ten successful hacks unlock a combo despite short multiplier streak resets',()=>{
  const h=harness();h.run('for(let i=0;i<10;i++){risk=0;hack(1);}');
  assert.equal(h.run('streakCounter'),0);
  assert.equal(h.run('achievementStats.maxStreak'),10);
  assert.equal(h.run('achievements.comboSpec.unlocked'),true);
});

test('comeback rewards risk removal by a bonus but not a bust reset',()=>{
  const h=harness();h.run('money=10000;risk=90;updateUI();for(let i=0;i<9;i++)buyBonus(1)');
  assert.equal(h.run('risk'),0);assert.equal(h.run('achievements.comebackKing.unlocked'),true);
  const busted=harness();busted.run('money=100;risk=95;updateUI();showBusted()');
  assert.equal(busted.run('achievements.comebackKing.unlocked'),false);
});

test('a risk peak before node cooling disqualifies a perfect run',()=>{
  const h=harness();h.run('money=500;sessionHackCount=9;risk=49;nodesHacked=99;hack(1)');
  assert.equal(h.run('risk'),47);assert.equal(h.run('sessionStats.maxRisk'),52);
  h.run('transfer()');assert.equal(h.run('achievements.perfectRun.unlocked'),false);
});

test('random scans cannot lower100risk; random risk peaks count for achievements',()=>{
  const h=harness(false,[.1]);h.run('risk=100;triggerRandomEvent()');assert.equal(h.run('risk'),100);
  const scan=harness(false,[.1]);scan.run('risk=49;triggerRandomEvent();risk=0;checkSessionEndAchievements()');
  assert.equal(scan.run('achievementStats.perfectRunActive'),false);
});

test('exact-risk achievement matches its stated67percent condition',()=>{
  const h=harness();h.run('money=100;sessionHackCount=1;risk=66.7;checkSessionEndAchievements()');
  assert.equal(h.run('achievements.balanced.unlocked'),false);
  h.run('risk=67;checkSessionEndAchievements()');assert.equal(h.run('achievements.balanced.unlocked'),true);
});

test('screen and loading gates prevent restart, upgrade, prestige and invalid-key mutations',()=>{
  const h=harness();h.run('money=999;totalMoney=300000;');const before=h.snapshot();
  assert.doesNotThrow(()=>h.run(`startGame();buyPersistent('ram');buyPersistent('__proto__');buyPersistent('unknown');doPrestige();showPersistentUpgrades();`));
  assert.deepEqual(h.snapshot(),before);
  h.run(`document.getElementById('screen-persistent').style.display='flex';window.RiskSaveLoading=true;startGame();buyPersistent('ram');doPrestige();`);
  assert.deepEqual(h.snapshot(),before);
});

test('extreme legitimate numeric saves cannot produce negative risk or nonfinite bank',()=>{
  const h=harness(false,[.0]);h.run('prestigePoints=75;money=Number.MAX_VALUE;risk=10;sessionHackCount=1;buyBonus(3)');
  assert.ok(Number.isFinite(h.run('money')));
  h.run('risk=0;hack(3)');assert.ok(h.run('risk')>=0);
  h.run('totalMoney=Number.MAX_VALUE;transfer()');assert.ok(Number.isFinite(h.run('totalMoney')));
  h.run(`document.getElementById('screen-success').style.display='none';document.getElementById('screen-persistent').style.display='flex';prestigeLevel=1000;doPrestige();`);
  assert.equal(h.run('prestigeLevel'),1000);
});

test('insurance recovery immediately unlocks bank milestones',()=>{
  const h=harness();h.run('money=1000;insuranceTurns=1;showBusted()');
  assert.equal(h.run('totalMoney'),500);assert.equal(h.run('achievements.firstBlood.unlocked'),true);
});

test('bust recovery cannot award surviving the risk that just caught the player',()=>{
  const h=harness();h.run('money=1000;risk=99;insuranceTurns=1;showBusted()');
  assert.equal(h.run('achievements.firstBlood.unlocked'),true);
  assert.equal(h.run('achievements.livingDanger.unlocked'),false);
  assert.equal(h.run('achievements.onTheEdge.unlocked'),false,'busts do not fabricate an Injection skill win');
  assert.equal(h.run('achievements.riskTaker.unlocked'),false,'busts do not fabricate a Memory skill win');
  assert.equal(h.run('achievementStats.maxRiskSurvived'),0);
});

test('read-error protection still allows the tutorial to be dismissed without saving',()=>{
  const h=harness();h.run(`window.RiskSaveReadBlocked=true;mainMenu.style.display='flex';showTutorial();closeTutorial();`);
  assert.equal(h.run('currentPresentationScreen()'),'menu');assert.equal(h.saves.length,0);
});

test('thousands of deterministic mixed actions keep funds, risk, buffs and screens valid',()=>{
  const h=harness();let seed=7216309;
  const roll=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  h.context.Math.random=roll;
  h.run('totalMoney=10000;pUpgrades.ram.lvl=4;');
  for(let step=0;step<2500;step++) {
    h.advance(100);
    const screen=h.run('currentPresentationScreen()');
    if(screen==='game') {
      const choice=Math.floor(roll()*12);
      if(choice<5)h.run('hack('+ (1+choice%3)+')');
      else if(choice<10)h.run('buyBonus('+ (1+Math.floor(roll()*6))+')');
      else h.run(choice===10?'transfer()':'bypass()');
    } else if(['busted','success'].includes(screen))h.run('closeOverlays()');
    else if(screen==='persistent')h.run('startGame()');
    else if(screen==='typing') {
      h.advance(3000);h.run('startTypingGame();typingInput=typingPhrase;successTypingProtocol()');
    } else if(screen==='backdoor') {
      h.advance(3000);h.run('startBackdoorGame();endBackdoor(false)');
      const close=h.run('activeMiniGame?.closeTimer');
      h.timers.get(close)?.();
    } else if(screen==='bypass')h.run('exitBypassGame()');
    const s=h.snapshot();
    assert.ok(Number.isFinite(s.money)&&s.money>=0,'funds at action '+step);
    assert.ok(Number.isFinite(s.totalMoney)&&s.totalMoney>=0,'bank at action '+step);
    assert.ok(s.risk>=0&&s.risk<=100,'trace at action '+step);
    for(const key of ['insuranceTurns','ghostCooldown','overclockCooldown','gambleCooldown','bypassCharge'])assert.ok(s[key]>=0,key);
    assert.ok(!(s.typingActive&&s.backdoorActive),'protocols cannot overlap');
  }
});

test('out-of-order leaderboard responses cannot overwrite a reopened board',async()=>{
  const h=harness();h.run(`screenLeaderboard=document.getElementById('screen-leaderboard');leaderboardList=document.getElementById('leaderboard-list');mainMenu.style.display='flex';`);
  let first,second;
  const replies=[new Promise(r=>first=r),new Promise(r=>second=r)];
  h.context.electronAPI.getLeaderboard=()=>replies.shift();
  const old=h.run('showLeaderboard()');h.run('backToMenuFromLeaderboard()');const next=h.run('showLeaderboard()');
  second(JSON.stringify({scope:'local',metric:'best-bank-balance',limit:10,entries:[{name:'NEW',score:100}]}));await next;
  const board=h.elements.get('leaderboard-list');const latest=board.children[0];
  first('broken stale response');await old;
  assert.equal(board.children[0],latest);
});

function leaderboardHarness() {
  const h=harness();h.run(`screenLeaderboard=document.getElementById('screen-leaderboard');leaderboardList=document.getElementById('leaderboard-list');mainMenu.style.display='flex';`);return h;
}
const localBoard=entries=>JSON.stringify({scope:'local',metric:'best-bank-balance',limit:10,entries});

test('local leaderboard seeds only the observed current bank and preserves cents',async()=>{
  const h=leaderboardHarness(),submitted=[];h.run(`playerName='LOCAL_AGENT';totalMoney=42.75;`);
  h.context.electronAPI.submitScore=async(name,score)=>{submitted.push([name,score]);return 'OK';};
  h.context.electronAPI.getLeaderboard=async()=>localBoard([{name:'LOCAL_AGENT',score:42.75}]);
  const before=h.snapshot();await h.run('showLeaderboard()');h.run('backToMenuFromLeaderboard()');await h.run('showLeaderboard()');
  assert.deepEqual(submitted,[['LOCAL_AGENT',42.75]]);
  assert.deepEqual(h.snapshot(),before,'opening the board does not change save/economy state');
  assert.equal(h.elements.get('leaderboard-list').children[0].children[1].textContent,'$42.75');
  h.run(`backToMenuFromLeaderboard();playerName='  ＬＯＣＡＬ_ＡＧＥＮＴ  ';`);await h.run('showLeaderboard()');
  assert.equal(h.elements.get('leaderboard-list').children[0].children[0].style.color,'var(--accent-blue)','normalized name highlights the current agent');
});

test('local leaderboard renders at most ten safe ranked names and truthful small values',async()=>{
  const h=leaderboardHarness();
  const entries=Array.from({length:12},(_,i)=>({name:i===0?'<img src=x onerror=alert(1)>':'AGENT_'+i,score:i===0?.002:100-i}));
  entries.push({name:'INVALID',score:Infinity},{name:'WRONG_TYPE',score:'999'});
  h.context.electronAPI.getLeaderboard=async()=>localBoard(entries);
  await h.run('showLeaderboard()');const rows=h.elements.get('leaderboard-list').children;
  assert.equal(rows.length,10);assert.equal(rows[0].children[1].textContent,'$99');
  h.run('backToMenuFromLeaderboard()');h.context.electronAPI.getLeaderboard=async()=>localBoard([entries[0]]);await h.run('showLeaderboard()');
  const row=h.elements.get('leaderboard-list').children[0];
  assert.equal(row.children[0].children[0].textContent,'01  <img src=x onerror=alert(1)>');
  assert.equal(row.children[0].innerHTML,'');assert.equal(row.children[1].textContent,'<$0.01');
});

test('local storage failure is visible and a failed current-bank seed can retry',async()=>{
  const h=leaderboardHarness();h.run(`playerName='LOCAL_AGENT';totalMoney=10;`);let attempts=0;
  h.context.electronAPI.submitScore=async()=>{attempts++;if(attempts===1)throw Error('disk unavailable');return 'OK';};
  h.context.electronAPI.getLeaderboard=async()=>localBoard([{name:'LOCAL_AGENT',score:10}]);
  await h.run('showLeaderboard()');assert.match(h.elements.get('leaderboard-list').children[0].textContent,/Local scores unavailable/);
  assert.equal(h.elements.get('leaderboard-list')['aria-busy'],'false');
  h.run('backToMenuFromLeaderboard()');await h.run('showLeaderboard()');assert.equal(attempts,2);assert.equal(h.elements.get('leaderboard-list').children[0].children[1].textContent,'$10');
});

test('transfers submit the resulting local bank and report unavailable score storage without undoing funds',async()=>{
  const h=leaderboardHarness(),submitted=[],notices=[];h.run(`mainMenu.style.display='none';playerName='LOCAL_AGENT';totalMoney=10;money=5.25;sessionHackCount=1;`);
  h.context.RelayUI={notify:message=>notices.push(typeof message === 'function' ? message() : message)};
  h.context.electronAPI.submitScore=async(name,score)=>{submitted.push([name,score]);throw Error('disk unavailable');};
  h.run('transfer()');await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(submitted,[['LOCAL_AGENT',15.25]]);assert.equal(h.run('totalMoney'),15.25);assert.equal(h.run('money'),0);
  assert(notices.some(message=>message==='Local leaderboard unavailable. Score not recorded.'));
});

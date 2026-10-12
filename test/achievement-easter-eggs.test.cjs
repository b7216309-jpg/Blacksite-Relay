const test=require('node:test');
const assert=require('node:assert/strict');
const {harness}=require('./harness.cjs');

const keys=['leeroyJenkins','hearthstone'];
const earned=(h,key)=>h.run(`achievements.${key}.unlocked`);
const awards=(h,key)=>h.events.filter(e=>e.type==='risk:event'&&e.detail.type==='achievement'&&e.detail.key===key).length;
function arm(h,{risk=80,hacks=1}={}){h.run(`money=1000;risk=${risk};sessionHackCount=${hacks};buyBonus(5)`);}
function startAgain(h){h.run('closeOverlays();startGame()');}
function finishProtocol(h,game){
  if(game==='bypass'){h.run('exitBypassGame()');return;}
  h.advance(3000);
  if(game==='typing'){h.run('startTypingGame();failTypingProtocol()');return;}
  h.run('startBackdoorGame();endBackdoor(false)');
  const id=h.run('activeMiniGame.closeTimer'),fn=h.timers.get(id);h.timers.delete(id);fn();
}

test('new secrets have stable distinct IDs and no difficulty tags',()=>{
  const h=harness(),rows=h.run('getAchievementPresentation()');
  for(const [key,name] of [['leeroyJenkins','LEEROY JENKINS'],['hearthstone','HEARTHSTONE']]){
    const row=rows.find(row=>row.id===key);assert.ok(row);assert.equal(row.name,name);
    assert.equal(row.secret,true);assert.equal(row.unlocked,false);assert.equal(Object.hasOwn(row,'difficulty'),false);
  }
});

test('Leeroy unlocks on the third opening Brute success, once, without changing its economy or RNG',async()=>{
  const h=harness(),old=harness(true);
  for(let i=1;i<=3;i++){
    h.run('hack(3)');old.run('hack(3)');
    assert.equal(earned(h,'leeroyJenkins'),i===3);
    for(const field of ['money','risk','multiplier','nodesValidated','bypassCharge'])assert.equal(h.run(field),old.run(field),field);
  }
  assert.equal(h.run('money'),150);assert.equal(h.calls(),old.calls());assert.equal(h.run('currentPresentationScreen()'),'game');
  await h.run('saveWritePromise');
  assert.equal(h.saves.at(-1).achievementStats.maxStreak,3,'the saved unlock includes the third completed hack');
  assert.equal(h.saves.at(-1).achievementStats.totalNodesValidated,1,'the same hack completed a node before its unlock was saved');
  h.run('checkAchievements();checkAchievements();hack(3)');assert.equal(awards(h,'leeroyJenkins'),1);
  await h.run('saveWritePromise');assert.equal(h.saves.at(-1).achievements.leeroyJenkins.unlocked,true);
});

test('the fallback achievement view hides each new secret until that secret is unlocked',()=>{
  const h=harness();h.run('renderAchievementsList()');
  const text=()=>h.elements.get('achievements-list').children.map(card=>card.innerHTML).join('\n');
  assert.equal(text().includes('LEEROY JENKINS'),false);assert.equal(text().includes('HEARTHSTONE'),false);
  h.run('hack(3);hack(3);hack(3)');assert.ok(text().includes('LEEROY JENKINS'));assert.equal(text().includes('HEARTHSTONE'),false);
  arm(h);h.run('transfer()');assert.ok(text().includes('HEARTHSTONE'));
});

test('a later three-Brute streak cannot replace the first three successful hacks',()=>{
  for(const sequence of [[1,3,3,3],[3,1,3,3,3],[3,3,1,3,3,3]]){
    const h=harness();for(const level of sequence)h.run('hack('+level+')');
    assert.equal(earned(h,'leeroyJenkins'),false,sequence.join(','));
  }
});

test('each accepted bonus disqualifies the Leeroy opener',()=>{
  for(let id=1;id<=6;id++){
    const rolls=[],h=harness(false,rolls);h.run('pUpgrades.ram.lvl=50;document.getElementById("screen-persistent").style.display="flex";startGame();hack(3)');
    if(id===3)rolls.push(.8);h.run('buyBonus('+id+');hack(3);hack(3)');
    assert.ok(h.snapshot().achievementStats.bonusesBoughtThisSession.includes(id));
    assert.equal(h.run('sessionHackCount'),3);assert.equal(earned(h,'leeroyJenkins'),false,'bonus '+id);
  }
});

test('invalid, unaffordable and covered actions do not spoil the Leeroy opener',()=>{
  const h=harness();h.run('buyBonus(4);hack(0);hack("3");hack(3);buyBonus(4);buyBonus(99)');
  h.run('document.getElementById("screen-settings").style.display="flex";hack(1);buyBonus(1);transfer();document.getElementById("screen-settings").style.display="none"');
  assert.equal(h.run('sessionHackCount'),1);assert.deepEqual(h.snapshot().achievementStats.bonusesBoughtThisSession,[]);
  h.run('hack(3);hack(3)');assert.equal(earned(h,'leeroyJenkins'),true);
});

test('an automatic protocol between Brutes does not change which hacks opened the run',()=>{
  const h=harness();h.run('hack(3);startTypingProtocol()');finishProtocol(h,'typing');
  h.run('hack(3);hack(3)');assert.equal(earned(h,'leeroyJenkins'),true);
});

test('a fatal third attempt does not award Leeroy and a fresh run can qualify normally',()=>{
  const rolls=[],h=harness(false,rolls);h.run('hack(3);hack(3)');rolls.push(.99,0);h.run('hack(3)');
  assert.equal(h.run('currentPresentationScreen()'),'busted');assert.equal(earned(h,'leeroyJenkins'),false);
  startAgain(h);h.run('hack(3);hack(3);hack(3)');assert.equal(earned(h,'leeroyJenkins'),true);
});

test('Hearthstone uses the risk before Proxy, inclusive at 80, and awards only on extraction',()=>{
  for(const [risk,expected] of [[79.999,false],[80,true],[100,true]]){
    const h=harness();arm(h,{risk});const money=h.run('money'),currentRisk=h.run('risk');
    assert.ok(Math.abs(currentRisk-risk*.6)<1e-9);assert.equal(earned(h,'hearthstone'),false);
    h.run('checkAchievements()');assert.equal(earned(h,'hearthstone'),false);
    h.run('transfer()');assert.equal(earned(h,'hearthstone'),expected);
    assert.equal(h.run('totalMoney'),money);assert.equal(h.run('currentPresentationScreen()'),'success');
    h.run('transfer();checkAchievements()');assert.equal(awards(h,'hearthstone'),expected?1:0);
  }
});

test('Hearthstone has a normal base-game Brute-to-Proxy extraction route',()=>{
  const h=harness();for(let i=0;i<7;i++)h.run('hack(3)');
  assert.ok(h.run('risk')>=80);assert.equal(h.run('sessionHackCount'),7);
  h.run('buyBonus(5)');const haul=h.run('money');h.run('transfer()');
  assert.equal(earned(h,'hearthstone'),true);assert.equal(h.run('totalMoney'),haul);
});

test('another accepted hack or any bonus cancels the next-action Hearthstone window',()=>{
  for(const action of ['hack(1)','hack(2)','hack(3)',...Array.from({length:6},(_,i)=>`buyBonus(${i+1})`)]){
    const rolls=[],h=harness(false,rolls);arm(h);if(action==='buyBonus(3)')rolls.push(.8);
    const before=h.snapshot();h.run(action);assert.notDeepEqual(h.snapshot(),before,'accepted '+action);
    h.run('transfer()');assert.equal(earned(h,'hearthstone'),false,action);
  }
});

test('accepted Injection, Memory and Bypass activation cancel Hearthstone',()=>{
  for(const [game,start] of [['typing','startTypingProtocol()'],['backdoor','startBackdoorProtocol()'],['bypass','bypassCharge=15;bypass()']]){
    const h=harness();arm(h);h.run(start);assert.equal(h.run('activeMiniGame.game'),game);
    finishProtocol(h,game);h.run('transfer()');assert.equal(earned(h,'hearthstone'),false,game);
  }
});

test('rejected actions and Settings preserve the pending Hearthstone transfer',()=>{
  const h=harness();h.run('insuranceTurns=5');arm(h);
  const before=h.snapshot(),calls=h.calls();h.run('hack(0);buyBonus(99);buyBonus(2);bypass()');
  assert.deepEqual(h.snapshot(),before);assert.equal(h.calls(),calls);
  h.run('document.getElementById("screen-settings").style.display="flex";hack(1);buyBonus(1);startTypingProtocol();startBackdoorProtocol();transfer();document.getElementById("screen-settings").style.display="none"');
  assert.deepEqual(h.snapshot(),before);assert.equal(h.calls(),calls);
  h.run('transfer()');assert.equal(earned(h,'hearthstone'),true);
});

test('an ordinary lower-risk Proxy cannot unlock Hearthstone without a new qualifying Proxy',()=>{
  const h=harness();arm(h);h.run('buyBonus(5);transfer()');assert.equal(earned(h,'hearthstone'),false);
  const again=harness();arm(again);again.run('buyBonus(6)');assert.ok(again.run('risk')<80);
  again.run('buyBonus(5);transfer()');assert.equal(earned(again,'hearthstone'),false);
});

test('a qualifying later Proxy creates its own new next-action opportunity',()=>{
  const h=harness();arm(h,{risk:100});h.run('buyBonus(6)');assert.equal(h.run('risk'),90);
  h.run('buyBonus(5);transfer()');assert.equal(earned(h,'hearthstone'),true);
});

test('a blocked grant-only transfer does not award Hearthstone and the needed hack cancels it',()=>{
  const h=harness();arm(h,{hacks:0});h.run('transfer()');
  assert.equal(h.run('currentPresentationScreen()'),'game');assert.equal(h.run('totalMoney'),0);assert.equal(earned(h,'hearthstone'),false);
  h.run('hack(1);transfer()');assert.equal(earned(h,'hearthstone'),false);
});

test('a bust or run restart cannot leak Hearthstone arming into another run',()=>{
  const h=harness();arm(h);h.run('showBusted()');assert.equal(earned(h,'hearthstone'),false);
  startAgain(h);h.run('hack(1);transfer()');assert.equal(earned(h,'hearthstone'),false);
});

test('loading a different save clears a pending Hearthstone action and defaults missing IDs locked',async()=>{
  const h=harness();arm(h);h.context.electronAPI.loadGame=async()=>({money:500,totalMoney:200,achievementStats:{maxStreak:100,bruteForceOnly:true}});
  await h.run('loadSavedGame()');for(const key of keys)assert.equal(earned(h,key),false);
  h.run('transfer()');assert.equal(earned(h,'hearthstone'),false,'the old accepted Proxy is not evidence in the loaded save');
});

test('older saves preserve all32 prior unlocks without fabricating either new secret',async()=>{
  const h=harness(),previous=Object.fromEntries(Object.keys(h.snapshot().achievements).filter(id=>!keys.includes(id)).map(id=>[id,{unlocked:true}]));
  assert.equal(Object.keys(previous).length,32);
  h.context.electronAPI.loadGame=async()=>({totalMoney:12345,achievements:previous,achievementStats:{maxStreak:100,bruteForceOnly:true,bonusesBoughtThisSession:[]}});
  await h.run('loadSavedGame()');
  for(const key of Object.keys(previous))assert.equal(earned(h,key),true,key);
  for(const key of keys)assert.equal(earned(h,key),false,key);
});

test('both new secret unlocks round-trip through the schema without serializing pending actions',async()=>{
  const h=harness();h.run('hack(3);hack(3);hack(3)');arm(h);h.run('transfer()');
  await h.run('saveWritePromise');const saved=h.saves.at(-1);
  for(const key of keys)assert.equal(saved.achievements[key].unlocked,true);
  assert.equal(Object.hasOwn(saved,'hearthstoneReady'),false);assert.equal(Object.hasOwn(saved.achievementStats,'hearthstoneReady'),false);
  const loaded=harness();loaded.context.electronAPI.loadGame=async()=>saved;await loaded.run('loadSavedGame()');
  for(const key of keys)assert.equal(earned(loaded,key),true);
  assert.equal(loaded.run('totalMoney'),saved.totalMoney);
  const malformed=loaded.run('RiskSaveSchema.normalize({totalMoney:1,achievements:{leeroyJenkins:{unlocked:"true"},hearthstone:{unlocked:1}}})');
  for(const key of keys)assert.equal(malformed.achievements[key].unlocked,false);
});

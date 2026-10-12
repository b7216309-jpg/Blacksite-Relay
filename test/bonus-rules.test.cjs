'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {harness}=require('./harness.cjs');

const data=(h,expression)=>JSON.parse(h.run('JSON.stringify('+expression+')'));
const near=(actual,expected,label)=>assert.ok(Math.abs(actual-expected)<=Math.max(1,Math.abs(expected))*1e-12,`${label||'value'}: ${actual} !== ${expected}`);
const turns=h=>data(h,'({insuranceTurns,ghostCooldown,overclockCooldown,overclockBonusTurns,gambleCooldown})');
function survive(h,level=1){h.run(`risk=0;nodesHacked=0;hack(${level});`);}
function detect(h,level=1){let index=0;h.context.Math.random=()=>[.99,0][index++]??.99;h.run(`risk=100;hack(${level});`);}
function denied(h,id){const before=h.snapshot(),calls=h.calls();h.run(`buyBonus(${id})`);assert.deepEqual(h.snapshot(),before);assert.equal(h.calls(),calls);}

test('all six prices follow current funds, upgrade discount, purchase escalation and node count',()=>{
 const h=harness();h.run('money=1000;');assert.deepEqual(data(h,'getBonusCosts()'),[10,200,200,150,15,150]);
 h.run('pUpgrades.fan.lvl=40;coolerPurchases=3;ghostPurchases=2;proxyPurchases=2;nodesValidated=4;money=123.45;');
 const prices=data(h,'getBonusCosts()');[48,24.69,24.69,1350,120,18.5175].forEach((n,i)=>near(prices[i],n,'price '+(i+1)));
 h.run('nodesValidated=8;');assert.equal(h.run('getBonusCosts()[4]'),180);
});

test('flat-price bonuses accept exact funds and reject below-price purchases without credit',()=>{
 for(const [id,cost] of [[1,10],[4,150],[5,15]]){
  const h=harness();h.run(`money=${cost-.001};risk=50;`);denied(h,id);
  h.run(`money=${cost};buyBonus(${id});`);assert.equal(h.run('money'),0);
  assert.deepEqual(h.snapshot().achievementStats.bonusesBoughtThisSession,[id]);
 }
});

test('zero funds and nonfinite escalating prices never award a bonus or consume a roll',()=>{
 for(let id=1;id<=6;id++){const h=harness();h.run('risk=50;');denied(h,id);}
 for(const [id,setup] of [[1,'coolerPurchases=1024'],[4,'ghostPurchases=1024'],[5,'proxyPurchases=1024']]){
  const h=harness();h.run(`money=Number.MAX_VALUE;risk=50;${setup};`);denied(h,id);
 }
});

test('Cooler removes ten points while Proxy removes forty percent, with intentional order differences',()=>{
 const a=harness();a.run('money=1000;risk=12;buyBonus(1);buyBonus(5);');near(a.run('risk'),1.2);
 const b=harness();b.run('money=1000;risk=12;buyBonus(5);buyBonus(1);');assert.equal(b.run('risk'),0);
 assert.equal(a.run('money'),975);assert.equal(b.run('money'),975);
 const c=harness();c.run('money=1000;risk=100;buyBonus(1);buyBonus(1);');assert.equal(c.run('money'),970);assert.equal(c.run('risk'),80);assert.equal(c.run('getBonusCosts()[0]'),40);
 const d=harness();d.run('money=1000;risk=100;nodesValidated=4;buyBonus(5);buyBonus(5);');assert.equal(d.run('money'),910);assert.equal(d.run('risk'),36);assert.equal(d.run('getBonusCosts()[4]'),120);
});

test('clear-risk Cooler and Proxy are inert and do not raise their next price',()=>{
 for(const id of [1,5]){
  const h=harness();h.run('money=1000;risk=0;');assert.equal(h.run(`presentationBonusState()[${id-1}].status`),'CLEAR');denied(h,id);
  h.run('risk=.001;');assert.equal(h.run(`presentationBonusState()[${id-1}].available`),true);
 }
});

test('large-balance Cooler and Proxy report a completed purchase even when subtraction rounds unchanged',()=>{
 for(const [id,expectedRisk] of [[1,40],[5,30]]){
  const h=harness();h.run(`money=1e20;risk=50;buyBonus(${id});`);assert.equal(h.run('money'),1e20);assert.equal(h.run('risk'),expectedRisk);
  const events=h.events.filter(e=>e.type==='risk:event'&&['bonus','denied'].includes(e.detail.type));
  assert.equal(events.length,1);assert.equal(events[0].detail.type,'bonus');assert.equal(events[0].detail.bonusId,id);
  assert.equal(h.run(id===1?'coolerPurchases':'proxyPurchases'),1);
 }
});

test('tiny positive percentage fees retain full mathematical precision and cannot be bought when they underflow',()=>{
 for(const id of [2,3,6]){
 const h=harness(false,[.8]);h.run(`money=.0001;risk=20;sessionHackCount=1;buyBonus(${id});`);
  near(h.run('money'),.0001*(id===6?.85:.8));assert.deepEqual(h.snapshot().achievementStats.bonusesBoughtThisSession,[id]);
  for(const n of [2,3,6]){assert.equal(h.elements.get('price-'+n).textContent,'<$0.01');assert.equal(h.elements.get('price-'+n).title,'Less than 0.01 dollars');}
  assert.equal(h.run('displayMoney(.04)'),'$0.04');assert.equal(h.run('displayMoney(0)'),'$0');
  const tiny=harness();tiny.run('money=Number.MIN_VALUE;risk=50;sessionHackCount=1;');denied(tiny,id);
 }
});

test('percentage fees use pre-purchase funds and immediately refresh every quoted price',()=>{
 for(const [id,fraction] of [[2,.2],[3,.2],[6,.15]]){
  const h=harness(false,[.8]);h.run(`money=123.45;risk=20;sessionHackCount=1;buyBonus(${id});`);near(h.run('money'),123.45*(1-fraction));
  const prices=data(h,'getBonusCosts()');near(prices[1],h.run('money')*.2);near(prices[2],h.run('money')*.2);near(prices[5],h.run('money')*.15);
  for(const index of [1,2,5])assert.equal(h.elements.get('price-'+(index+1)).textContent,h.run(`displayMoney(getBonusCosts()[${index}])`));
 }
});

test('Insure is not stackable, covers the fifth attempted hack and pays half of remaining funds',()=>{
 const h=harness();h.run('money=1000;buyBonus(2);');assert.equal(h.run('money'),800);assert.equal(h.run('insuranceTurns'),5);denied(h,2);
 for(let n=0;n<4;n++)survive(h);
 assert.equal(h.run('insuranceTurns'),1);const covered=h.run('money');detect(h);
 near(h.run('totalMoney'),covered*.5);assert.equal(h.run('currentPresentationScreen()'),'busted');assert.equal(h.run('insuranceTurns'),0);
});

test('insurance expires after five surviving hacks and does not cover the sixth detection',()=>{
 const h=harness();h.run('money=1000;buyBonus(2);');for(let n=0;n<5;n++)survive(h);
 assert.equal(h.run('insuranceTurns'),0);detect(h);assert.equal(h.run('totalMoney'),0);
});

test('first attempted hack still receives purchased insurance protection',()=>{
 const h=harness();h.run('pUpgrades.ram.lvl=10;document.getElementById("screen-persistent").style.display="flex";startGame();buyBonus(2);');
 detect(h);assert.equal(h.run('totalMoney'),40);assert.equal(h.run('currentPresentationScreen()'),'busted');
});

test('Gamble requires a successful hack and cannot extract an untouched startup grant',()=>{
 const h=harness();h.run('pUpgrades.ram.lvl=10;document.getElementById("screen-persistent").style.display="flex";startGame();buyBonus(2);');
 assert.equal(h.run('presentationBonusState()[2].status'),'HACK FIRST');denied(h,3);
 assert.equal(h.run('money'),80);assert.equal(h.run('totalMoney'),0);assert.equal(h.run('currentPresentationScreen()'),'game');
 survive(h);assert.equal(h.run('presentationBonusState()[2].available'),true);
 h.context.Math.random=()=>.99;const before=h.run('money');h.run('buyBonus(3);');near(h.run('totalMoney'),before*.8*.5);
 assert.equal(h.run('achievementStats.successfulSessions'),0);
});

test('insured fatal Gamble after a legitimate hack banks half the post-fee balance once',()=>{
 const h=harness();h.run('money=1000;');survive(h);h.run('buyBonus(2);');const before=h.run('money');
 h.context.Math.random=()=>.99;h.run('buyBonus(3);');near(h.run('totalMoney'),before*.8*.5);
 const bank=h.run('totalMoney');h.run('buyBonus(3);showBusted();');assert.equal(h.run('totalMoney'),bank);
 const event=h.events.filter(e=>e.type==='risk:event'&&e.detail.type==='bust').at(-1);near(event.detail.recovered,bank);
});

test('Ghost lasts until one detection and its repurchase cooldown counts only surviving hacks',()=>{
 const h=harness();h.run('money=10000;buyBonus(4);');assert.equal(h.run('ghostCooldown'),5);denied(h,4);
 for(let n=0;n<5;n++)survive(h);assert.equal(h.run('ghostCooldown'),0);assert.equal(h.run('ghostShieldActive'),true);denied(h,4);
 const before=h.run('money');detect(h);assert.equal(h.run('ghostShieldActive'),false);assert.equal(h.run('risk'),3);assert.ok(h.run('money')>before);
 assert.equal(h.run('achievementStats.ghostShieldSaves'),1);assert.equal(h.run('getBonusCosts()[3]'),450);
 h.run('buyBonus(4);');
 assert.equal(h.run('achievementStats.ghostShieldUses'),2);assert.equal(h.run('ghostCooldown'),5);assert.equal(h.run('getBonusCosts()[3]'),1350);
});

test('a Ghost save on the first hack consumes one cooldown step, while a Gamble save consumes none',()=>{
 const hack=harness();hack.run('money=10000;buyBonus(4);');detect(hack);assert.equal(hack.run('ghostCooldown'),4);
 const gamble=harness(false,[.99]);gamble.run('money=10000;risk=50;sessionHackCount=1;buyBonus(4);buyBonus(3);');
 assert.equal(gamble.run('ghostCooldown'),5);assert.equal(gamble.run('gambleCooldown'),5);assert.equal(gamble.run('ghostShieldActive'),false);assert.equal(gamble.run('risk'),0);
 assert.equal(gamble.run('achievementStats.ghostShieldSaves'),1);assert.equal(gamble.run('currentPresentationScreen()'),'game');
});

test('Ghost takes precedence over insurance on fatal Gamble without spending coverage or banking funds',()=>{
 const h=harness(false,[.99]);h.run('money=1000;risk=50;sessionHackCount=1;buyBonus(4);buyBonus(2);buyBonus(3);');
 near(h.run('money'),544);assert.equal(h.run('totalMoney'),0);assert.equal(h.run('insuranceTurns'),5);
 assert.equal(h.run('ghostShieldActive'),false);assert.equal(h.run('ghostCooldown'),5);assert.equal(h.run('currentPresentationScreen()'),'game');
 assert.equal(h.events.filter(e=>e.type==='risk:event'&&e.detail.type==='bust').length,0);
});

test('Ghost and Overclock cannot coexist in either purchase order, but Ghost can follow two boosted hacks',()=>{
 for(const [first,second] of [[4,6],[6,4]]){
  const h=harness();h.run(`money=10000;risk=40;buyBonus(${first});`);assert.equal(h.run(`presentationBonusState()[${second-1}].available`),false);denied(h,second);
 }
 const h=harness();h.run('money=10000;risk=40;buyBonus(6);');assert.equal(h.run('presentationBonusState()[5].status'),'ACTIVE');
 survive(h);denied(h,4);survive(h);assert.equal(h.run('overclockBonusTurns'),0);assert.equal(h.run('overclockCooldown'),5);
 assert.equal(h.run('presentationBonusState()[3].available'),true);h.run('buyBonus(4);');assert.equal(h.run('ghostShieldActive'),true);
});

test('Overclock doubles exactly two hack payouts with miner and prestige, then retains a seven-hack cooldown',()=>{
 const h=harness();h.run('money=1000;risk=80;pUpgrades.miner.lvl=2;prestigePoints=3;buyBonus(6);');
 assert.equal(h.run('money'),850);assert.equal(h.run('risk'),100);assert.equal(h.run('overclockBonusTurns'),2);assert.equal(h.run('overclockCooldown'),7);
 const gains=[];for(let i=0;i<3;i++){h.run('multiplier=3;streakCounter=0;');const before=h.run('money');survive(h,2);gains.push(h.run('money')-before);}
 near(gains[0],20*3*2*1.4*1.3);near(gains[1],gains[0]);near(gains[2],gains[0]/2);
 assert.equal(h.run('overclockBonusTurns'),0);assert.equal(h.run('overclockCooldown'),4);denied(h,6);
 for(let i=0;i<4;i++)survive(h);assert.equal(h.run('overclockCooldown'),0);assert.equal(h.run('presentationBonusState()[5].available'),true);
});

test('bonus purchases and packets do not spend buff durations or hack cooldowns',()=>{
 const h=harness(false,[.8]);h.run('money=10000;risk=50;insuranceTurns=4;ghostCooldown=3;overclockCooldown=6;overclockBonusTurns=1;gambleCooldown=2;');const before=turns(h);
 h.run('buyBonus(1);buyBonus(5);triggerRandomEvent();');assert.deepEqual(turns(h),before);
 const gamble=harness(false,[0]);gamble.run('money=1000;risk=50;sessionHackCount=1;buyBonus(6);buyBonus(2);');const prior=turns(gamble),funds=gamble.run('money');
 gamble.run('buyBonus(3);');const after=turns(gamble);delete prior.gambleCooldown;delete after.gambleCooldown;
 assert.deepEqual(after,prior);near(gamble.run('money'),funds*1.6);assert.equal(gamble.run('gambleCooldown'),5);
});

test('each minigame outcome preserves bonus clocks, shield and Overclock charges',()=>{
 for(const [game,success] of [['typing',true],['typing',false],['backdoor',true],['backdoor',false],['bypass',true],['bypass',false]]){
  const h=harness();h.run('money=1000;risk=60;multiplier=8;insuranceTurns=4;ghostShieldActive=true;ghostCooldown=3;overclockCooldown=6;overclockBonusTurns=1;gambleCooldown=2;');const before=turns(h);
  if(game==='typing'){h.run('startTypingProtocol();');h.advance(3000);h.run('startTypingGame();'+(success?'successTypingProtocol();':'failTypingProtocol();'));}
  else if(game==='backdoor'){h.run('startBackdoorProtocol();');h.advance(3000);h.run('startBackdoorGame();endBackdoor('+success+');');if(success)assert.equal(h.run('money'),1024,'Memory reward is not Overclock-doubled');}
  else h.run('bypassCharge=15;bypass();bypassLevel=3;exitBypassGame('+(!success)+');');
  assert.deepEqual(turns(h),before,game+'/'+success);assert.equal(h.run('ghostShieldActive'),true);
 }
});

test('Gamble odds partition every Deep Learning level and its exact bucket boundaries',()=>{
 for(let level=0;level<=4;level++){
  const ui=harness();ui.run(`pUpgrades.algo.lvl=${level};updatePersistentUI();`);
  assert.ok(ui.elements.get('btn-p-5').innerHTML.includes(`Jackpot: ${1+level}% / Bust: ${9-level}%`));
  const edges=[1+level,39+level,62+level,90+level,91+level];
  const probes=[0,...edges.flatMap(edge=>[edge-.00001,edge,edge+.00001]),99.99999];
  for(const percent of probes){
   const h=harness(false,[percent/100]);h.run(`money=1000;risk=50;sessionHackCount=1;pUpgrades.algo.lvl=${level};buyBonus(3);`);
   const bucket=edges.findIndex(edge=>percent<edge),expected=bucket<0?5:bucket;
   const outcomes=[[1600,35],[800,30],[800,60],[800,50],[800,0],[0,0]];
   near(h.run('money'),outcomes[expected][0],`money at L${level}/${percent}`);near(h.run('risk'),outcomes[expected][1]);
   assert.equal(h.run('currentPresentationScreen()'),expected===5?'busted':'game');
   assert.equal(h.run('achievementStats.jackpotsWon'),expected===0?1:0);
   assert.equal(h.calls(),1,'each Gamble resolves with exactly one gameplay roll');
  }
 }
});

test('Gamble clamps reductions and penalties, preserves jackpot accounting and saturates finite funds',()=>{
 for(const [roll,risk,expected] of [[0,2,0],[.2,3,0],[.5,95,100],[.905,99,0]]){
  const h=harness(false,[roll]);h.run(`money=1000;risk=${risk};sessionHackCount=1;buyBonus(3);`);assert.equal(h.run('risk'),expected);
 }
 const h=harness(false,[0]);h.run('money=Number.MAX_VALUE;risk=10;sessionHackCount=1;buyBonus(3);');assert.equal(h.run('money'),Number.MAX_VALUE);
 assert.equal(h.run('achievementStats.jackpotsWon'),1);
});

test('Gamble repurchase is denied until five hacks, and only completed purchases count toward YOLO',()=>{
 const h=harness(false,[.8]);h.run('money=10000;risk=40;sessionHackCount=1;buyBonus(3);');assert.equal(h.run('gambleCooldown'),5);denied(h,3);
 for(let n=0;n<4;n++)survive(h);assert.equal(h.run('gambleCooldown'),1);denied(h,3);survive(h);
 h.context.Math.random=()=>.8;h.run('buyBonus(3);');assert.equal(h.run('achievementStats.gambleStreak'),2);
 const y=harness(false,[.99]);y.run('money=1000;risk=50;sessionHackCount=1;achievementStats.gambleStreak=9;buyBonus(3);');
 assert.equal(y.run('achievements.yoloMode.unlocked'),false,'All In requires a completed transfer, so a fatal Gamble cannot grant it');assert.equal(y.run('achievementStats.maxGambleStreak'),10);assert.equal(y.run('achievementStats.gambleStreak'),0);
});

test('the sixth completed purchase earns Full Arsenal even when Gamble immediately ends the run',async()=>{
 const h=harness(false,[.99]);h.run('money=1000;risk=50;sessionHackCount=1;achievementStats.bonusesBoughtThisSession=[1,2,4,5,6];buyBonus(3);');
 assert.equal(h.run('achievements.fullArsenal.unlocked'),true);assert.equal(h.run('currentPresentationScreen()'),'busted');
 assert.deepEqual(h.snapshot().achievementStats.bonusesBoughtThisSession,[]);assert.equal(h.run('achievementStats.boughtAllBonusesThisSession'),false);
 const events=h.events.filter(e=>e.type==='risk:event'&&['bonus','bust'].includes(e.detail.type));
 assert.deepEqual(events.map(e=>e.detail.type),['bonus','bust']);assert.equal(events[0].detail.money,800);
 await h.run('saveGameState()');assert.equal(h.saves.at(-1).achievements.fullArsenal.unlocked,true);assert.deepEqual(h.saves.at(-1).achievementStats.bonusesBoughtThisSession,[]);
});

test('bonus purchase and save achievements count completed uses and shield saves exactly once',async()=>{
 const h=harness();h.run('money=10000;achievementStats.ghostShieldUses=9;achievementStats.ghostShieldSaves=4;buyBonus(4);');
 assert.equal(h.run('achievements.ghostProto.unlocked'),true);denied(h,4);detect(h);assert.equal(h.run('achievements.closeCall.unlocked'),true);
 assert.equal(h.run('achievementStats.ghostShieldUses'),10);assert.equal(h.run('achievementStats.ghostShieldSaves'),5);
 await h.run('saveGameState()');assert.equal(h.saves.at(-1).achievementStats.ghostShieldSaves,5);assert.equal(h.saves.at(-1).achievements.closeCall.unlocked,true);
 const j=harness(false,[0]);j.run('money=1000;risk=10;sessionHackCount=1;achievementStats.jackpotsWon=9;buyBonus(3);');assert.equal(j.run('achievements.luckyGambler.unlocked'),true);
});

test('all bonus input paths are inert behind every overlay and during save gates',()=>{
 for(const screen of ['main-menu','screen-persistent','screen-settings','screen-intro','screen-tutorial','screen-success','screen-busted','screen-achievements','screen-leaderboard','screen-bypass','typing-container','backdoor-container']){
  const h=harness();h.run(`money=1000;risk=50;document.getElementById('${screen}').style.display='flex';`);for(let id=1;id<=6;id++)denied(h,id);
 }
 for(const flag of ['RiskSaveLoading','RiskSaveReadBlocked']){const h=harness();h.run(`money=1000;risk=50;window.${flag}=true;`);for(let id=1;id<=6;id++)denied(h,id);}
});

test('transfer, bust and fresh-run resets clear all temporary bonus counters without erasing lifetime achievements',()=>{
 for(const terminal of ['transfer();','showBusted();']){
  const h=harness();h.run('money=1000;risk=20;sessionHackCount=1;insuranceTurns=3;ghostShieldActive=true;ghostCooldown=2;overclockCooldown=4;overclockBonusTurns=1;gambleCooldown=3;coolerPurchases=4;proxyPurchases=3;ghostPurchases=2;achievementStats.ghostShieldUses=12;achievements.ghostProto.unlocked=true;');
  h.run(terminal);assert.deepEqual(turns(h),{insuranceTurns:0,ghostCooldown:0,overclockCooldown:0,overclockBonusTurns:0,gambleCooldown:0});
  assert.equal(h.run('ghostShieldActive'),false);assert.equal(h.run('coolerPurchases+proxyPurchases+ghostPurchases'),0);assert.equal(h.run('achievementStats.ghostShieldUses'),12);assert.equal(h.run('achievements.ghostProto.unlocked'),true);
  h.run('closeOverlays();startGame();');assert.equal(h.run('currentPresentationScreen()'),'game');assert.equal(h.run('risk'),0);assert.equal(h.run('ghostShieldActive'),false);
 }
});

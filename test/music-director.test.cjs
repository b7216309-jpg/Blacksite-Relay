'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { create } = require('../src/relay-music-director.js');

function setup({ runId=1, startMoney=0, earningScale=20, totalMoney=0 }={}) {
  let now=0;
  const director=create({now:()=>now});
  let snapshot={screen:'game',runId,startMoney,earningScale,money:startMoney,totalMoney};
  director.setRunning(true);
  director.onEvent({type:'run-start',runId,startMoney,earningScale});
  director.setState(snapshot);
  return {
    director,
    state:()=>director.getState(),
    elapse(ms) {now+=ms;},
    advance(ms) { while(ms>0) { const step=Math.min(1000,ms);now+=step;ms-=step;director.tick(); } },
    jump(ms) {now+=ms;director.tick();},
    screen(screen,extra={}) {snapshot={...snapshot,...extra,screen};director.setState(snapshot);},
    set(extra) {snapshot={...snapshot,...extra};director.setState(snapshot);},
    earn(gain) {snapshot={...snapshot,money:snapshot.money+gain};director.onEvent({type:'hack',runId:snapshot.runId,gain,money:snapshot.money});director.setState(snapshot);},
    begin(nextId) {snapshot={...snapshot,runId:nextId,money:startMoney,screen:'game'};director.onEvent({type:'run-start',runId:nextId,startMoney,earningScale});director.setState(snapshot);}
  };
}

test('menu begins on the 96 BPM track without an active run',()=>{
  const d=create({now:()=>0}),s=d.getState();
  assert.equal(s.track,'neon-standby');assert.equal(s.runActive,false);assert.equal(s.activeSeconds,0);assert.equal(s.scoreUnits,0);
});

test('initial runId zero cannot create a phantom run during startup discovery',()=>{
  const d=create({now:()=>0});d.setRunning(true);
  d.setState({screen:'game',runId:0,money:1000,startMoney:0,earningScale:20});
  d.onEvent({type:'run-start',runId:0,startMoney:0,earningScale:20});
  assert.equal(d.getState().runActive,false);assert.equal(d.getState().scoreUnits,0);assert.equal(d.getState().track,'neon-standby');
});

test('earning the score early cannot skip the first 60 seconds',()=>{
  const h=setup();h.earn(1000);assert.equal(h.state().scoreUnits,50);
  h.advance(59999);assert.equal(h.state().stage,0);assert.equal(h.state().track,'backstreet-signal');
  h.advance(1);assert.equal(h.state().stage,1);assert.equal(h.state().track,'chrome-pursuit');
});

test('the high track requires 150 seconds and the score threshold',()=>{
  const h=setup();h.earn(10000);h.advance(60000);assert.equal(h.state().stage,1);
  h.advance(89999);assert.equal(h.state().stage,1);
  h.advance(1);assert.equal(h.state().stage,2);assert.equal(h.state().track,'redline-protocol');
});

test('slow-run fallbacks promote at 120 and 240 active seconds',()=>{
  const h=setup();h.advance(119999);assert.equal(h.state().stage,0);
  h.advance(1);assert.equal(h.state().stage,1);assert.equal(h.state().scoreUnits,0);
  h.advance(119999);assert.equal(h.state().stage,1);
  h.advance(1);assert.equal(h.state().stage,2);
});

test('a late middle-track entry still receives its full 60-second residence',()=>{
  const h=setup();h.advance(120000);assert.equal(h.state().stage,1);
  h.earn(10000);h.advance(59999);assert.equal(h.state().stage,1);
  h.advance(1);assert.equal(h.state().stage,2);
});

test('spending, score loss and multiplier/risk changes never demote the run',()=>{
  const h=setup();h.earn(10000);h.advance(150000);assert.equal(h.state().stage,2);
  h.set({money:0,multiplier:1,risk:0});h.advance(1000);
  assert.equal(h.state().stage,2);assert.equal(h.state().scoreUnits,500);
});

test('starting grants and lifetime bank do not satisfy any score gate',()=>{
  const h=setup({startMoney:9e16,totalMoney:Number.MAX_VALUE});
  h.advance(60000);assert.equal(h.state().scoreUnits,0);assert.equal(h.state().stage,0);
});

test('equivalent earned runs normalize equally at extreme miner and prestige levels',()=>{
  const scale=20*(1+Number.MAX_SAFE_INTEGER*.2)*(1+Number.MAX_SAFE_INTEGER*.1);
  const beginner=setup(),advanced=setup({startMoney:9e16,earningScale:scale,totalMoney:Number.MAX_VALUE});
  for(const units of [.25,1,2.5,5,15,30]) {beginner.earn(units*20);advanced.earn(units*scale);}
  assert.ok(Math.abs(beginner.state().scoreUnits-advanced.state().scoreUnits)<1e-10);
  beginner.advance(60000);advanced.advance(60000);
  assert.equal(beginner.state().stage,1);assert.equal(advanced.state().stage,1);
});

test('earned score still progresses when a tiny gain rounds away beside a huge grant',()=>{
  const h=setup({startMoney:9e16});h.earn(5);
  assert.equal(h.state().scoreUnits,.25);
});

test('retained funds above the grant can raise the score, but spending cannot erase its peak',()=>{
  const h=setup({startMoney:100});h.set({money:1100});assert.equal(h.state().scoreUnits,50);
  h.set({money:100});assert.equal(h.state().scoreUnits,50);
});

test('gross earnings and retained funds are alternatives, not double-counted',()=>{
  const h=setup();h.earn(1000);assert.equal(h.state().scoreUnits,50);
  h.set({money:1200});assert.equal(h.state().scoreUnits,60);
  h.earn(200);assert.equal(h.state().scoreUnits,70);
});

test('huge and malformed values remain finite and bounded',()=>{
  const h=setup();h.earn(Number.MAX_VALUE);
  assert.equal(h.state().scoreUnits,1e6);
  h.director.onEvent({type:'hack',runId:1,gain:NaN});h.set({money:Infinity});h.advance(1000);
  assert.equal(h.state().scoreUnits,1e6);assert.ok(Number.isFinite(h.state().activeSeconds));
});

test('all three mini-game views count as active gameplay time',()=>{
  const h=setup();
  for(const screen of ['typing','backdoor','bypass']) {h.screen(screen);h.advance(10000);}
  assert.equal(h.state().activeSeconds,30);assert.equal(h.state().runActive,true);
});

test('settings and intro preserve stage but contribute no time',()=>{
  const h=setup();h.earn(1000);h.advance(60000);
  for(const screen of ['settings','intro']) {h.screen(screen);h.advance(90000);assert.equal(h.state().activeSeconds,60);assert.equal(h.state().stage,1);}
  h.screen('game');h.advance(1000);assert.equal(h.state().activeSeconds,61);assert.equal(h.state().stage,1);
});

test('hidden, blocked and non-running audio pause the clock without accumulating a resume gap',()=>{
  const h=setup();h.advance(10000);
  for(const setter of ['setHidden','setBlocked']) {
    h.director[setter](true);h.advance(90000);assert.equal(h.state().activeSeconds,10);
    h.director[setter](false);
  }
  h.director.setRunning(false);h.advance(90000);assert.equal(h.state().activeSeconds,10);
  h.director.setRunning(true);h.advance(1000);assert.equal(h.state().activeSeconds,11);
});

test('muting music leaves pacing active while the context is running',()=>{
  const h=setup();h.set({musicVolume:0});h.advance(10000);assert.equal(h.state().activeSeconds,10);
});

test('sleep/stall gaps over five seconds are discarded rather than skipping music',()=>{
  const h=setup();h.jump(5000);assert.equal(h.state().activeSeconds,5);
  h.jump(5001);assert.equal(h.state().activeSeconds,5);
  h.advance(1000);assert.equal(h.state().activeSeconds,6);
});

for(const terminal of ['transfer','bust']) test(terminal+' ends the run and stale snapshots cannot reopen it',()=>{
  const h=setup();h.earn(1000);h.advance(60000);
  h.director.onEvent({type:terminal,runId:1,money:1000});assert.equal(h.state().runActive,false);
  h.screen('game');h.advance(1000);assert.equal(h.state().runActive,false);
  h.begin(2);assert.equal(h.state().runId,2);assert.equal(h.state().runActive,true);assert.equal(h.state().stage,0);assert.equal(h.state().activeSeconds,0);assert.equal(h.state().scoreUnits,0);
});

test('menu and persistent screens cancel rather than pause the active run',()=>{
  for(const screen of ['menu','persistent']) {
    const h=setup();h.advance(10000);h.screen(screen);assert.equal(h.state().runActive,false);
    h.screen('game');assert.equal(h.state().runActive,false);
    h.begin(2);assert.equal(h.state().activeSeconds,0);assert.equal(h.state().runActive,true);
  }
});

test('fallback discovery starts a run once, and repeated run-start events are idempotent',()=>{
  let now=0;const d=create({now:()=>now});d.setRunning(true);
  const state={screen:'game',runId:7,startMoney:50,earningScale:20,money:50};d.setState(state);
  assert.equal(d.getState().runActive,true);assert.equal(d.getState().runId,7);
  now=1000;d.tick();d.onEvent({type:'run-start',runId:7,startMoney:50,earningScale:20});d.setState(state);
  assert.equal(d.getState().activeSeconds,1);
});

test('rejected actions and unrelated effects cannot add earned score',()=>{
  const h=setup();
  for(const type of ['denied','ghost-save','node','achievement','minigame-fail']) h.director.onEvent({type,runId:1,gain:10000});
  assert.equal(h.state().scoreUnits,0);
});

test('late previous-run gains and terminal events cannot affect a newer run',()=>{
  const h=setup();h.director.onEvent({type:'transfer',runId:1});h.begin(2);
  h.director.onEvent({type:'hack',runId:1,gain:10000});h.director.onEvent({type:'bust',runId:1});
  assert.equal(h.state().runActive,true);assert.equal(h.state().runId,2);assert.equal(h.state().scoreUnits,0);
});

test('eligibility changes between ticks settle only the preceding active interval',()=>{
  const h=setup();h.elapse(1500);h.director.setHidden(true);assert.equal(h.state().activeSeconds,1.5);
  h.elapse(360000);h.director.setHidden(false);assert.equal(h.state().activeSeconds,1.5);
  h.elapse(1500);h.director.setBlocked(true);assert.equal(h.state().activeSeconds,3);
  h.elapse(3500);h.director.setBlocked(false);assert.equal(h.state().activeSeconds,3);
  h.elapse(1000);h.screen('settings');assert.equal(h.state().activeSeconds,4);
  h.elapse(5000);h.screen('game');assert.equal(h.state().activeSeconds,4);
  h.elapse(1000);h.director.setRunning(false);assert.equal(h.state().activeSeconds,5);
  h.elapse(3000);h.director.setRunning(true);assert.equal(h.state().activeSeconds,5);
  h.advance(1000);assert.equal(h.state().activeSeconds,6);
});

test('actual gameplay publishes run epochs without changing rewards, random draws or save fields',()=>{
  const {harness}=require('./harness.cjs');const observed=harness(),control=harness();
  const director=create({now:()=>observed.run('performance.now()')});director.setRunning(true);
  observed.context.document.addEventListener('risk:event',event=>director.onEvent(event.detail));
  observed.context.document.addEventListener('risk:state',event=>director.setState(event.detail));
  const begin='mainMenu.style.display="flex";pUpgrades.ram.lvl=7;pUpgrades.miner.lvl=5;prestigePoints=3;totalMoney=1e100;showPersistentUpgrades();startGame();';
  observed.run(begin);control.run(begin);
  const started=observed.events.filter(event=>event.type==='risk:event'&&event.detail.type==='run-start');
  assert.equal(started.length,1);assert.equal(started[0].detail.runId,1);assert.equal(started[0].detail.startMoney,220);assert.equal(started[0].detail.earningScale,52);
  assert.equal(director.getState().runActive,true);assert.equal(director.getState().scoreUnits,0);
  observed.run('startGame()');assert.equal(observed.events.filter(event=>event.type==='risk:event'&&event.detail.type==='run-start').length,1,'blocked start does not invent a run');
  observed.run('hack(2)');control.run('hack(2)');
  assert.equal(director.getState().scoreUnits,1);assert.equal(observed.calls(),control.calls());assert.deepEqual(observed.snapshot(),control.snapshot());
  observed.run('document.getElementById("screen-settings").style.display="flex";publishPresentation()');
  observed.advance(2000);director.tick();assert.equal(director.getState().activeSeconds,0);
  observed.run('document.getElementById("screen-settings").style.display="none";publishPresentation()');
  observed.run('transfer()');control.run('transfer()');
  assert.equal(director.getState().runActive,false);assert.equal(observed.calls(),control.calls());assert.deepEqual(observed.snapshot(),control.snapshot());
  const saved=observed.saves.at(-1);
  for(const name of ['runId','startMoney','earningScale']) {assert.equal(Object.hasOwn(saved,name),false);assert.equal(Object.hasOwn(saved.presentation,name),false);}
  observed.run('closeOverlays();startGame()');
  assert.equal(director.getState().runId,2);assert.equal(director.getState().runActive,true);assert.equal(director.getState().stage,0);assert.equal(director.getState().scoreUnits,0);
  observed.run('risk=100;hack(3)');
  assert.equal(director.getState().runActive,false);assert.equal(director.getState().scoreUnits,0,'a detected fatal hack earns no musical score');
});

'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { create } = require('../src/quit-flow');
const { harness } = require('./harness.cjs');
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const turn = () => new Promise(resolve => setImmediate(resolve));
function fixture(overrides = {}) {
  const calls = [], timers = new Map(); let next = 1, blocked = false;
  const deps = {context:()=>({runActive:false,unsecured:0,challenge:false}),loading:()=>false,
    waitForLoad:async()=>true,flushRecords:async retry=>{calls.push(['records',retry]);return true;},
    save:async()=>{calls.push(['save']);return true;},finish:async discard=>{calls.push(['finish',discard]);return true;},
    beginNative:()=>calls.push(['begin']),cancelNative:()=>calls.push(['cancel-native']),
    block:value=>{blocked=value;},render:state=>calls.push(['render',state.phase]),
    setTimeout:fn=>{const id=next++;timers.set(id,fn);return id;},clearTimeout:id=>timers.delete(id),...overrides};
  return {flow:create(deps),deps,calls,timers,blocked:()=>blocked,expire(){for(const fn of [...timers.values()])fn();}};
}
test('active run asks first and cancellation changes no save or game state', async()=>{
  const f=fixture({context:()=>({runActive:true,unsecured:1280,challenge:true})});
  await f.flow.request();assert.equal(f.flow.getState().phase,'confirm');assert.equal(f.blocked(),true);
  assert.equal(f.calls.some(c=>c[0]==='save'),false);assert.equal(f.flow.cancel(),true);
  assert.equal(f.flow.getState().phase,'idle');assert.equal(f.blocked(),false);assert.equal(f.timers.size,0);
});
test('menu quit waits for local records and a successful game save before finishing',async()=>{
  const f=fixture();assert.equal(await f.flow.request(),true);
  assert.deepEqual(f.calls.filter(c=>c[0]!=='render'),[['begin'],['records',true],['save'],['finish',false]]);
  assert.equal(f.flow.getState().phase,'closed');assert.equal(f.timers.size,0);
});
test('failed write remains open and retry makes exactly one fresh save',async()=>{
  let writes=0;const f=fixture({save:async()=>++writes>1});
  assert.equal(await f.flow.request(),false);assert.equal(f.flow.getState().phase,'error');
  assert.equal(f.calls.some(c=>c[0]==='finish'),false);
  assert.equal(await f.flow.retry(),true);assert.equal(writes,2);
});
test('local record failure blocks normal quit and can be retried',async()=>{
  let records=0;const f=fixture({flushRecords:async()=>++records>1});
  await f.flow.request();assert.match(f.flow.getState().problem,/local record/);
  assert.equal(f.calls.filter(c=>c[0]==='save').length,1);assert.equal(await f.flow.retry(),true);
});
test('duplicate quit, confirm and retry calls cannot start parallel writes',async()=>{
  const pending=deferred();let saves=0;const f=fixture({save:()=>{saves++;return pending.promise;}});
  const first=f.flow.request();await turn();f.flow.request();f.flow.confirm();f.flow.retry();
  assert.equal(saves,1);assert.equal(f.flow.cancel(),false);
  pending.resolve(true);assert.equal(await first,true);
  assert.equal(f.calls.filter(c=>c[0]==='finish').length,1);
});
test('slow startup waits for loading and protects a failed existing save',async()=>{
  const loaded=deferred();const f=fixture({loading:()=>true,waitForLoad:()=>loaded.promise});
  const first=f.flow.request();assert.equal(f.flow.getState().phase,'loading');
  loaded.resolve(false);await first;assert.equal(f.flow.getState().phase,'error');
  assert.equal(f.calls.some(c=>['save','finish'].includes(c[0])),false);
});
test('native finish refusal stays open instead of treating an attempt as success',async()=>{
  const f=fixture({finish:async()=>false});assert.equal(await f.flow.request(),false);
  assert.equal(f.flow.getState().phase,'error');assert.equal(f.flow.cancel(),true);
});
test('explicit discard is available only after failure and never starts another save',async()=>{
  const f=fixture({save:async()=>false});assert.equal(await f.flow.discard(),false);
  await f.flow.request();const before=f.calls.filter(c=>c[0]==='records').length;
  assert.equal(await f.flow.discard(),true);assert.equal(f.flow.getState().discarding,true);
  assert.equal(f.calls.filter(c=>c[0]==='records').length,before);
  assert.deepEqual(f.calls.filter(c=>c[0]==='finish'),[['finish',true]]);
});
test('save timeout invalidates late completion, then permits a new attempt',async()=>{
  const late=deferred();let writes=0;const f=fixture({save:()=>++writes===1?late.promise:Promise.resolve(true)});
  const first=f.flow.request();await turn();f.expire();assert.equal(await first,false);
  assert.equal(f.flow.getState().phase,'error');assert.equal(f.flow.cancel(),true);
  late.resolve(true);await turn();assert.equal(f.calls.some(c=>c[0]==='finish'),false);
  assert.equal(await f.flow.request(),true);assert.equal(f.calls.filter(c=>c[0]==='finish').length,1);
});
test('rejected save promises become an actionable failure and release the timer',async()=>{
  const f=fixture({save:async()=>{throw new Error('disk');}});
  assert.equal(await f.flow.request(),false);assert.equal(f.flow.getState().phase,'error');assert.equal(f.timers.size,0);
});
test('renderer cancellation blocks actions without ending or rewarding the run',async()=>{
  const h=harness();h.run('money=1280;risk=65;sessionHackCount=3;bypassCharge=15;');
  const before=h.snapshot(),random=h.calls();await h.run('RiskQuit.request()');
  h.run('hack(3);transfer();buyBonus(5);bypass();startTypingProtocol();startGame();');
  assert.deepEqual(h.snapshot(),before);assert.equal(h.calls(),random);assert.equal(h.saves.length,0);
  assert.equal(h.run('RiskQuit.cancel()'),true);assert.deepEqual(h.snapshot(),before);
});
test('Bypass keeps moving behind confirmation and Escape cancellation cannot cash it out',async()=>{
  const h=harness();h.run('money=500;risk=70;sessionHackCount=1;bypassCharge=15;bypass();');
  h.frame(0);const risk=h.run('risk'),rng=h.calls();await h.run('RiskQuit.request()');
  h.frame(200);assert.notEqual(h.run('bypassGauge'),0);
  h.run('attemptBypass();exitBypassGame();');assert.equal(h.run('bypassLevel'),1);assert.equal(h.run('risk'),risk);
  assert.equal(h.run('currentPresentationScreen()'), 'bypass');h.run('RiskQuit.cancel()');
  const gauge=h.run('bypassGauge');h.frame(400);assert.notEqual(h.run('bypassGauge'),gauge);assert.equal(h.calls(),rng);
});
test('an Injection deadline outcome during saving is included in the latest snapshot',async()=>{
  const h=harness();h.run('money=100;risk=30;startTypingProtocol();');h.now(3000);h.run('startTypingGame();');
  const firstWrite=deferred();let writes=0,closed=0;
  h.context.electronAPI.saveGame=data=>{h.saves.push(JSON.parse(JSON.stringify(data)));return ++writes===1?firstWrite.promise:Promise.resolve(true);};
  h.context.electronAPI.closeApp=()=>{closed++;};
  await h.run('RiskQuit.request()');const saving=h.run('RiskQuit.confirm()');await turn();
  assert.equal(writes,1);h.now(10001);h.run('failTypingProtocol();');firstWrite.resolve(true);await saving;
  assert.equal(closed,1);assert.equal(h.saves.at(-1).risk,40);assert.ok(writes>=2);
  assert.equal(h.run('typingActive'),false);
});

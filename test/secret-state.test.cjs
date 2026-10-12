const test=require('node:test'),assert=require('node:assert/strict');
const {create,durations}=require('../src/relay-secret-state.js');
const initialized=()=>{const m=create();m.advance('scene',0);m.advance('guide',0);return m;};
test('five cosmetic discoveries have bounded lifetimes and no gameplay dependencies',()=>{
  const m=initialized();assert.deepEqual(Object.keys(durations),['ratUnion','rootAccess','snailMail','locker','room404']);
  assert.equal(m.act('hack'),null);assert.equal(m.act('transfer'),null);assert.deepEqual(m.diagnostics().active,[]);
  assert.equal(m.diagnostics().ownTimers,0);assert.equal(m.diagnostics().ownAnimationFrames,0);
});
test('Rat Union needs two distinct rats within12 seconds, only once per scene reveal',()=>{
  const m=initialized();assert.equal(m.act('cable-rat'),null);assert.equal(m.act('cable-rat'),null);
  m.advance('scene',12);const origins=[{id:'cable-rat',x:410,y:713,facing:1}];assert.equal(m.act('rack-rat',{origins}),'ratUnion');
  origins[0].x=999;assert.equal(m.snapshot('scene').ratUnion.origins[0].x,410);
  assert.equal(m.act('server-cat'),null);assert.equal(m.act('coil-snail',{feelers:true}),null);
  m.advance('scene',26);assert.equal(m.snapshot('scene').ratUnion.active,false);assert.deepEqual(m.diagnostics().discovered,['ratUnion']);
});
test('rat and cat pending sequences expire without adding timers',()=>{
  const m=initialized();m.act('cable-rat');m.advance('scene',12.01);assert.equal(m.act('rack-rat'),null);
  m.act('server-cat');m.advance('scene',21);m.act('server-cat');m.act('server-cat');assert.equal(m.snapshot('scene').rootAccess.active,false);
  assert.equal(m.act('server-cat'),'rootAccess');
});
test('snail requires visible feelers except in the static scene fallback',()=>{
  const m=initialized();assert.equal(m.act('coil-snail'),null);assert.equal(m.act('coil-snail',{feelers:true}),'snailMail');
  m.reset('scene');m.advance('scene',2,true);assert.equal(m.act('coil-snail'),'snailMail');assert.equal(m.snapshot('scene').snailMail.elapsed,2);
});
test('locker accepts short short long, invalid input and wrong sequences do not reveal',()=>{
  const m=initialized();assert.equal(m.act('locker',{knock:'long'}),null);m.act('locker',{knock:'short'});m.act('locker',{knock:'invalid'});
  assert.equal(m.snapshot('scene').knockProgress,1);m.act('locker',{knock:'short'});assert.equal(m.act('locker',{knock:'long'}),'locker');
  m.reset('scene');m.advance('scene',0);m.act('locker',{knock:'short'});m.advance('scene',4);m.act('locker',{knock:'short'});assert.equal(m.act('locker',{knock:'long'}),null);
});
test('Room404 LEDs follow their cable order and can restart after a wrong choice',()=>{
  const m=initialized();m.act('led-0');m.act('led-2');assert.equal(m.snapshot('guide').ledProgress,0);
  for(let i=0;i<3;i++)assert.equal(m.act('led-'+i),null);assert.equal(m.act('led-3'),'room404');assert.equal(m.snapshot('guide').ledProgress,4);
  m.advance('guide',10);assert.equal(m.snapshot('guide').room404.active,false);assert.equal(m.snapshot('guide').ledProgress,0);
});
test('rebasing pauses discoveries across another screen without elapsed-time jumps',()=>{
  const m=initialized();m.act('server-cat');m.act('server-cat');m.act('server-cat');m.advance('scene',2);
  m.rebase('scene');m.advance('scene',999);assert.equal(m.snapshot('scene').rootAccess.elapsed,2);
  m.advance('scene',1000);assert.equal(m.snapshot('scene').rootAccess.elapsed,3);
  m.advance('scene',1002);assert.equal(m.snapshot('scene').rootAccess.active,false);
});
test('static reveals stay at a readable pose until explicit cleanup and never run an animation clock',()=>{
  const m=initialized();m.advance('scene',2,true);m.act('server-cat');m.act('server-cat');m.act('server-cat');m.advance('scene',200,true);
  assert.equal(m.snapshot('scene').rootAccess.elapsed,2);assert.equal(m.diagnostics().clocks.scene,0);
  m.finish('rootAccess');assert.equal(m.snapshot('scene').rootAccess.active,false);
});
test('reset cancels only its own surface, snapshots and discovery arrays are immutable',()=>{
  const m=initialized();m.act('coil-snail',{feelers:true});for(let i=0;i<4;i++)m.act('led-'+i);
  m.reset('scene');assert.equal(m.snapshot('scene').snailMail.active,false);assert.equal(m.snapshot('guide').room404.active,true);
  assert.ok(Object.isFrozen(m.snapshot('guide')));assert.ok(Object.isFrozen(m.snapshot('guide').room404));assert.ok(Object.isFrozen(m.diagnostics().discovered));
  m.reset('guide');assert.deepEqual(m.diagnostics().active,[]);assert.equal(m.diagnostics().discovered.length,2);
});

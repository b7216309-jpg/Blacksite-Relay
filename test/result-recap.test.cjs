'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {harness}=require('./harness.cjs');

test('bust receipt retains actual loss and recovery after reset without replaying settlement',()=>{
  for(const insured of [false,true]) {
    const h=harness();
    h.run(`totalMoney=250;money=1280.5;risk=89;insuranceTurns=${insured?3:0};showBusted();`);
    const result=h.run('JSON.stringify(lastGameResult)');
    assert.deepEqual(JSON.parse(result),{kind:'busted',money:1280.5,risk:89,recovered:insured?640.25:0,lost:insured?640.25:1280.5,maxRisk:0,maxNodes:0,maxMultiplier:1});
    assert.equal(h.run('totalMoney'),insured?890.25:250);
    assert.equal(h.run('money'),0);
    const receipt=h.elements.get('screen-bustedp');
    assert.ok(receipt.innerHTML.includes(insured?'Lost $640.25':'Lost $1,280.50'));
    assert.equal(receipt.innerHTML.includes('Recovered $640.25'),insured);
    const before=h.snapshot(),draws=h.calls(),events=h.events.length;
    h.run('renderGameRecap();renderGameRecap();');
    assert.deepEqual(h.snapshot(),before);
    assert.equal(h.calls(),draws);assert.equal(h.events.length,events);
  }
});

test('saturated balances never claim insurance credited more than the bank actually received',()=>{
  const h=harness();
  h.run('totalMoney=Number.MAX_VALUE;money=1e10;risk=90;insuranceTurns=1;showBusted();');
  assert.equal(h.run('lastGameResult.recovered'),0);
  assert.equal(h.run('lastGameResult.lost'),1e10);
  assert.equal(h.run('totalMoney'),Number.MAX_VALUE);
  const event=h.events.find(e=>e.type==='risk:event'&&e.detail.type==='bust');
  assert.equal(event.detail.recovered,0);assert.equal(event.detail.lost,1e10);
  assert.ok(!h.elements.get('screen-bustedp').innerHTML.includes('Recovered'));
});

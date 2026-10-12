/* Contract and resource lifecycle tests; run: node art-source/audio/test-mixer.cjs */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

async function main() {
  let milliseconds = 0, createdContexts = 0;
  const listeners = new Map(), fetches = [];
  class Param {
    constructor(value = 0) { this.value = value; this.targets = []; }
    cancelAndHoldAtTime() {}
    cancelScheduledValues() {}
    setValueAtTime(value, time) { this.value = value; this.targets.push({ value, time }); }
    linearRampToValueAtTime(value, time) { this.setValueAtTime(value, time); }
  }
  class Node {
    constructor() { this.connections = []; this.disconnected = false; }
    connect(node) { this.connections.push(node); return node; }
    disconnect() { this.disconnected = true; this.connections = []; }
  }
  class Gain extends Node { constructor() { super(); this.gain = new Param(); } }
  class Source extends Node {
    start(when = 0, offset = 0) { this.started = { when, offset }; }
    stop() { this.stopped = true; if (this.onended) this.onended(); }
  }
  class Context {
    constructor() { createdContexts++; this.currentTime = 0; this.state = 'suspended'; this.destination = new Node(); this.sources = []; this.gains = []; }
    createGain() { const node = new Gain(); this.gains.push(node); return node; }
    createBufferSource() { const node = new Source(); this.sources.push(node); return node; }
    createDynamicsCompressor() {
      const node = new Node();
      for (const key of ['threshold', 'knee', 'ratio', 'attack', 'release']) node[key] = new Param();
      return node;
    }
    createStereoPanner() { const node = new Node(); node.pan = new Param(); return node; }
    createWaveShaper() { return new Node(); }
    async resume() { this.state = 'running'; }
    async suspend() { this.state = 'suspended'; }
    async close() { this.state = 'closed'; }
    async decodeAudioData(data) {
      const url = new TextDecoder().decode(data);
      const duration = url.includes('music-ambience') ? 20 : url.includes('music-original') ? 225 : 1;
      return { duration, length: duration * 44100, numberOfChannels: 2, tag: path.basename(url) };
    }
  }
  let context;
  const document = {
    currentScript: { src: 'http://localhost:8000/src/relay-audio.js' }, baseURI: 'http://localhost:8000/', hidden: false,
    addEventListener(type, listener) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(listener); },
    removeEventListener(type, listener) { listeners.get(type)?.delete(listener); }
  };
  const sandbox = {
    window: { AudioContext: class extends Context { constructor() { super(); context = this; } } }, document, URL, Map, Set,
    performance: { now: () => milliseconds },
    fetch: async url => { fetches.push(url); return { ok: true, arrayBuffer: async () => new TextEncoder().encode(url).buffer }; },
  };
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../../src/relay-audio.js'), 'utf8'), sandbox);
  const api = sandbox.window.RelayAudio;
  const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
  const emit = (type, detail) => { for (const listener of listeners.get(type) || []) listener({ detail }); };
  const check = (label, action) => { action(); console.log('PASS', label); };

  check('No AudioContext or asset requests before interaction', () => { assert.equal(createdContexts, 0); assert.equal(fetches.length, 0); assert.equal(api.getDiagnostics().state, 'locked'); });
  api.setVolumes(0, .25);
  await api.unlock(); await flush();
  check('Old-save zero music volume is retained during unlock', () => { assert.equal(api.getDiagnostics().musicVolume, 0); assert.equal(context.gains[1].gain.value, 0); });
  check('First menu use loads only the original soundtrack and ambience', () => {
    const music = fetches.filter(url => url.includes('music-'));
    assert.equal(music.length, 2); assert.ok(music.every(url => /music-(original|ambience)/.test(url)));
  });
  check('Original opening plays once before its baked tail loops to7.5 seconds', () => {
    const loops = context.sources.filter(source => source.loop);
    assert.equal(loops.length, 2);
    for (const loop of loops) assert.ok(loop.started.offset >= 0 && loop.started.offset < loop.buffer.duration);
    const original = loops.find(loop => loop.buffer.tag === 'music-original.ogg');
    const ambience = loops.find(loop => loop.buffer.tag === 'music-ambience.ogg');
    assert.equal(original.started.offset, 0); assert.equal(original.loopStart, 7.5); assert.equal(original.loopEnd, 225);
    assert.equal(ambience.started.offset, 0);
  });
  context.currentTime = 23.79;
  emit('risk:state', { screen: 'game', risk: 90 }); await flush();
  check('Entering gameplay neither restarts the track nor loads generated score stems', () => {
    const loops = context.sources.filter(source => source.loop);
    assert.equal(loops.length, 2);
    assert.equal(fetches.filter(url => url.includes('music-')).length, 2);
    assert.equal(loops.find(loop => loop.buffer.tag === 'music-original.ogg').started.offset, 0);
  });
  check('Music stays original at high risk and is quieter in menus/results', () => {
    const gainOf = name => context.sources.find(source => source.buffer?.tag === 'music-' + name + '.ogg').connections[0].gain.value;
    assert.equal(gainOf('original'), .82);
    api.setState({screen:'success',risk:0}); assert.equal(gainOf('original'), .33);
    api.setState({screen:'persistent',risk:0}); assert.equal(gainOf('original'), .50);
    api.setState({screen:'game',risk:95}); assert.equal(gainOf('original'), .82);
  });
  api.setVolumes(2, -.2);
  check('Invalid volume range clamps and muted SFX create no source', () => { assert.equal(api.getDiagnostics().musicVolume, 1); assert.equal(api.getDiagnostics().sfxVolume, 0); });
  const before = context.sources.length;
  assert.equal(await api.play('hack-1'), false);
  assert.equal(context.sources.length, before);
  api.setVolumes(.5, .5);
  emit('risk:event', { type: 'bonus', bonusId: 6 }); await flush();
  check('Semantic bonus routes to its dedicated sound', () => assert.ok(context.sources.some(source => source.buffer?.tag === 'sfx-overclock.ogg')));
  emit('risk:event', { type: 'hack', hackType: 3 }); await flush();
  check('Hack variants remain distinct', () => assert.ok(context.sources.some(source => source.buffer?.tag === 'sfx-hack-3.ogg')));
  const pendingIntro = api.play('intro');
  api.stop('intro');
  assert.equal(await pendingIntro, false);
  check('Skipping during decode cancels the pending intro cue', () => assert.ok(!context.sources.some(source => source.buffer?.tag === 'sfx-intro.ogg')));
  milliseconds += 150;
  const otherVoices = api.getDiagnostics().activeVoices;
  assert.equal(await api.play('intro'), true);
  assert.equal(api.stop('intro'), 1);
  check('Stopping an intro releases only its matching voice', () => assert.equal(api.getDiagnostics().activeVoices, otherVoices));
  for (let i = 0; i < 50; i++) { milliseconds += 120; await api.play('click', { pan: .3 }); }
  check('Rapid inputs cannot exceed sixteen active SFX sources', () => { assert.equal(api.getDiagnostics().activeVoices, 16); assert.equal(context.sources.filter(source => !source.loop && !source.stopped).length, 16); });
  const activeBefore = api.getDiagnostics().activeVoices;
  assert.equal(await api.play('hover'), false);
  check('Hovers cannot evict semantic audio at the voice limit', () => assert.equal(api.getDiagnostics().activeVoices, activeBefore));
  document.hidden = true;
  emit('visibilitychange'); await flush();
  check('Hidden window suspends the audio transport', () => assert.equal(context.state, 'suspended'));
  assert.equal(await api.play('transfer'), false);
  document.hidden = false;
  emit('visibilitychange'); await flush();
  check('Visible window resumes without creating another context', () => { assert.equal(context.state, 'running'); assert.equal(createdContexts, 1); });
  api.dispose(); await flush();
  check('Disposal stops every source and removes every listener', () => {
    assert.equal(api.getDiagnostics().state, 'disposed'); assert.equal(api.getDiagnostics().activeVoices, 0); assert.equal(api.getDiagnostics().cachedAssets, 0);
    assert.ok(context.sources.every(source => source.stopped && source.disconnected));
    assert.ok([...listeners.values()].every(set => set.size === 0));
  });
  assert.equal(await api.unlock(), false);
  console.log('Mixer contract and lifecycle: all checks passed.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });

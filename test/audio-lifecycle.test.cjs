'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { create, tracks } = require('../src/relay-music-director.js');

// Control only the platform's asynchronous suspend/resume acknowledgements.
// The production mixer, director, event handlers and scheduler run unchanged.
function harness() {
  const listeners = new Map(), timers = new Set(), operations = [];
  const param = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, cancelAndHoldAtTime() {} });
  const node = () => ({ connect() { return this; }, disconnect() {} });
  let audioContext;
  class AudioContext {
    constructor() { audioContext = this; this.state = 'running'; this.currentTime = 0; this.sampleRate = 44100; this.destination = node(); }
    addEventListener(type, fn) { if (type === 'statechange') this.onstate = fn; }
    removeEventListener() { this.onstate = null; }
    createGain() { return { ...node(), gain: param() }; }
    createDynamicsCompressor() { return { ...node(), threshold: param(), knee: param(), ratio: param(), attack: param(), release: param() }; }
    createWaveShaper() { return node(); }
    createBufferSource() { return { ...node(), start() {}, stop() {} }; }
    decodeAudioData() { return Promise.resolve({ duration: 60, length: 2646000, numberOfChannels: 2 }); }
    suspend() { return this.defer('suspended'); }
    resume() { return this.state === 'running' ? Promise.resolve() : this.defer('running'); }
    defer(state) { return new Promise((resolve, reject) => operations.push({ state, finish: () => { this.state = state; this.onstate?.(); resolve(); }, reject })); }
    close() { this.state = 'closed'; return Promise.resolve(); }
  }
  const document = {
    hidden: false, currentScript: { src: 'file:///risk/src/relay-audio.js' },
    addEventListener(type, fn) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(fn); },
    removeEventListener(type, fn) { listeners.get(type)?.delete(fn); }
  };
  const window = { AudioContext, RelayMusicDirector: { create, tracks } };
  const scope = { window, document, URL, Float32Array, performance: { now: () => audioContext?.currentTime * 1000 || 0 },
    fetch: async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(1) }),
    setInterval(fn) { timers.add(fn); return fn; }, clearInterval(fn) { timers.delete(fn); } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/relay-audio.js'), 'utf8'), scope);
  const flush = async () => { for (let i = 0; i < 16; i++) await Promise.resolve(); };
  return { audio: window.RelayAudio, timers, operations, flush,
    visibility(hidden) { document.hidden = hidden; for (const fn of listeners.get('visibilitychange') || []) fn(); },
    async finish(state) { const index = operations.findIndex(op => op.state === state); assert.ok(index >= 0, 'pending platform operation: ' + state); operations.splice(index, 1)[0].finish(); await flush(); },
    context: () => audioContext
  };
}

test('a quick restore while suspend is pending recovers music without another gesture', async () => {
  const h = harness(); await h.audio.unlock(); await h.flush();
  assert.equal(h.timers.size, 1);
  h.visibility(true); await h.flush();
  assert.equal(h.timers.size, 0);
  h.visibility(false); await h.flush();
  await h.finish('suspended');
  assert.equal(h.operations.filter(op => op.state === 'running').length, 1, 'restore waits for the outstanding suspend');
  await h.finish('running');
  assert.equal(h.audio.getDiagnostics().state, 'running');
  assert.equal(h.timers.size, 1);
  h.audio.dispose(); assert.equal(h.timers.size, 0);
});

test('a hide during pending resume settles suspended with no background scheduler', async () => {
  const h = harness(); await h.audio.unlock(); await h.flush();
  h.visibility(true); await h.flush(); await h.finish('suspended');
  h.visibility(false); await h.flush();
  h.visibility(true); await h.flush();
  await h.finish('running'); await h.finish('suspended');
  assert.equal(h.audio.getDiagnostics().state, 'suspended'); assert.equal(h.timers.size, 0);
  h.visibility(false); await h.flush(); await h.finish('running');
  assert.equal(h.timers.size, 1); h.audio.dispose();
});

test('disposing during a visibility change cannot resume sources or recreate timers', async () => {
  const h = harness(); await h.audio.unlock(); await h.flush();
  h.visibility(true); await h.flush(); h.visibility(false); h.audio.dispose();
  await h.finish('suspended');
  assert.equal(h.audio.getDiagnostics().state, 'disposed'); assert.equal(h.timers.size, 0);
  assert.equal(h.operations.length, 0);
  assert.equal(h.audio.getDiagnostics().musicTrackVoices, 0);
});

'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { pathToFileURL } = require('node:url');
const { harness } = require('./harness.cjs');
const schema = require('../src/save-schema');
const { createSaveStore } = require('../src/save-store');
const root = path.resolve(__dirname, '..');
const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
const state = (values = {}) => schema.normalize({ totalMoney: 500, money: 90, playerName: 'SAVE_TEST', ...values });
function fixture() {
  const base = path.resolve(root, '..', 'save-audit-fixtures');
  fs.mkdirSync(base, { recursive: true });
  return fs.mkdtempSync(path.join(base, 'isolated-'));
}

test('save schema preserves finite legacy progression and muted preferences', () => {
  const data = schema.normalize({ money: 1e100, totalMoney: 2e100, prestigeLevel: 12, prestigePoints: 19,
    pUpgrades: { ram: { lvl: 150 }, miner: { lvl: 88 }, vpn: { lvl: 30 } },
    achievements: { whaleStatus: { unlocked: true } }, musicVolume: 0, sfxVolume: .37,
    presentation: { reducedMotion: true, effectsLevel: 'low', introSeen: true }, tutorialSeen: true });
  assert.equal(data.money, 1e100); assert.equal(data.totalMoney, 2e100);
  assert.equal(data.pUpgrades.ram.lvl, 150); assert.equal(data.pUpgrades.miner.lvl, 88);
  assert.equal(data.achievements.whaleStatus.unlocked, true);
  assert.equal(data.prestigeLevel, 12); assert.equal(data.prestigePoints, 19);
  assert.equal(data.musicVolume, 0); assert.equal(data.sfxVolume, .37);
  assert.deepEqual(data.presentation, { version: 1, reducedMotion: true, introSeen: true, effectsLevel: 'low' });
});

test('malformed and prototype save fields cannot alter definitions or poison arithmetic', () => {
  const raw = JSON.parse('{"totalMoney":-3,"money":"99","playerName":"\\u0000AGENT","pUpgrades":{"__proto__":{"lvl":999},"constructor":{"lvl":999},"vpn":{"lvl":999},"ram":{"lvl":-4},"miner":{"lvl":2.7}},"achievements":{"firstBlood":{"unlocked":"false"},"__proto__":{"unlocked":true}},"achievementStats":{"__proto__":{"polluted":true},"bonusesBoughtThisSession":[1,1,2,7,"3",null],"perfectRunActive":"false"}}');
  raw.prestigeLevel = Infinity; raw.prestigePoints = NaN; raw.musicVolume = Infinity;
  raw.sfxVolume = -4; raw.achievementStats.jackpotsWon = NaN;
  const cleaned = schema.normalize(raw);
  assert.equal(cleaned.totalMoney, 0); assert.equal(cleaned.money, 0);
  assert.equal(cleaned.playerName, 'AGENT'); assert.equal(cleaned.pUpgrades.vpn.lvl, 30);
  assert.equal(cleaned.pUpgrades.ram.lvl, 0); assert.equal(cleaned.pUpgrades.miner.lvl, 2);
  assert.equal(cleaned.prestigeLevel, 0); assert.equal(cleaned.prestigePoints, 0);
  assert.equal(cleaned.musicVolume, .5); assert.equal(cleaned.sfxVolume, 0);
  assert.equal(cleaned.achievements.firstBlood.unlocked, false);
  assert.deepEqual(cleaned.achievementStats.bonusesBoughtThisSession, [1, 2]);
  assert.equal(cleaned.achievementStats.jackpotsWon, 0);
  assert.equal(Object.hasOwn(cleaned.pUpgrades, '__proto__'), false);
  assert.equal(Object.hasOwn(cleaned.achievementStats, 'polluted'), false);
  assert.equal({}.polluted, undefined);
  assert.equal(schema.normalize(Object.create({ totalMoney: 123 })), null);
});

test('live nonfinite, incomplete or out-of-range saves are refused instead of writing zeroes', () => {
  for (const change of [{ money: NaN }, { totalMoney: Infinity }, { risk: -1 }, { prestigePoints: 1.5 }]) assert.equal(schema.normalizeForWrite({ ...state(), ...change }), null);
  assert.equal(schema.normalizeForWrite({ totalMoney: 0 }), null);
  const invalid = state(); invalid.pUpgrades.vpn.lvl = 999;
  assert.equal(schema.normalizeForWrite(invalid), null);
  assert.ok(schema.normalizeForWrite(state()));
});

test('save store refuses startup overwrite and round-trips a complete atomic snapshot', () => {
  const file = path.join(fixture(), 'user_data.json'), store = createSaveStore(file);
  assert.equal(store.save(state()), false); assert.equal(fs.existsSync(file), false);
  assert.equal(store.load(), null); assert.equal(store.save(state()), true);
  assert.equal(store.save(state({ totalMoney: 650 })), true);
  assert.equal(store.load().totalMoney, 650);
  assert.equal(JSON.parse(fs.readFileSync(file + '.bak', 'utf8')).totalMoney, 500);
  assert.equal(fs.existsSync(file + '.tmp'), false);
  assert.equal(store.save({ ...state(), totalMoney: Infinity }), false);
  assert.equal(store.load().totalMoney, 650);
});

test('truncated primary recovers the previous snapshot without replacing the healthy backup', () => {
  const file = path.join(fixture(), 'user_data.json');
  fs.writeFileSync(file, '{'); fs.writeFileSync(file + '.bak', JSON.stringify(state({ totalMoney: 777 })));
  const store = createSaveStore(file); assert.equal(store.load().totalMoney, 777);
  assert.equal(store.save(state({ totalMoney: 800 })), true);
  assert.equal(JSON.parse(fs.readFileSync(file + '.bak', 'utf8')).totalMoney, 777);
  assert.equal(store.load().totalMoney, 800);
});

test('unreadable or oversized saves remain untouched and block all writes', () => {
  for (const contents of ['broken-json', ' '.repeat(schema.MAX_BYTES + 1)]) {
    const file = path.join(fixture(), 'user_data.json'); fs.writeFileSync(file, contents);
    const store = createSaveStore(file); assert.throws(() => store.load(), /preserved/);
    assert.equal(store.save(state()), false); assert.equal(fs.readFileSync(file, 'utf8'), contents);
  }
});

test('interrupted rename preserves the primary and allows recovery of a first complete temporary save', () => {
  const file = path.join(fixture(), 'user_data.json'); fs.writeFileSync(file, JSON.stringify(state({ totalMoney: 300 })));
  const io = Object.create(fs); io.renameSync = () => { throw new Error('simulated disk failure'); };
  const store = createSaveStore(file, io); store.load(); assert.equal(store.save(state({ totalMoney: 999 })), false);
  assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).totalMoney, 300);
  const first = path.join(fixture(), 'user_data.json'); fs.writeFileSync(first + '.tmp', JSON.stringify(state({ totalMoney: 123 })));
  assert.equal(createSaveStore(first).load().totalMoney, 123);
});

test('delayed load blocks input and writes, then restores the legacy balance', async () => {
  const h = harness(); let resolve;
  h.context.electronAPI.loadGame = () => new Promise(done => { resolve = done; });
  const loading = h.run('loadSavedGame()'); await flush();
  assert.equal(h.context.RiskSaveLoading, true); assert.equal(h.context.document.body.inert, true);
  const event = { type: 'click', prevented: false, stopped: false, preventDefault() { this.prevented = true; }, stopImmediatePropagation() { this.stopped = true; } };
  h.context.document.dispatchEvent(event); assert.equal(event.prevented, true); assert.equal(event.stopped, true);
  assert.equal(await h.run('saveGameState()'), false); assert.equal(h.saves.length, 0);
  resolve({ totalMoney: 42000, musicVolume: 0 }); assert.equal(await loading, true);
  assert.equal(h.run('totalMoney'), 42000); assert.equal(h.context.RiskSaveLoading, false);
  assert.equal(h.context.document.body.inert, false); assert.equal(h.run('musicVolume'), 0);
});

test('load exceptions settle startup, preserve the save and permit an explicit later retry', async () => {
  const h = harness(); h.context.electronAPI.loadGame = () => { throw new Error('simulated read failure'); };
  assert.equal(await h.run('loadSavedGame()'), false);
  assert.equal(h.context.RiskSaveLoading, false); assert.equal(h.context.RiskSaveReadBlocked, true);
  assert.equal(await h.run('saveGameState()'), false); assert.equal(h.saves.length, 0);
  h.context.electronAPI.loadGame = async () => ({ totalMoney: 750, tutorialSeen: true });
  assert.equal(await h.run('loadSavedGame()'), true);
  assert.equal(h.run('totalMoney'), 750); assert.equal(h.context.RiskSaveReadBlocked, false);
});

test('window.onload leaves the menu usable on load failure without starting onboarding', async () => {
  const h = harness(); let intros = 0;
  h.context.RelayUI = { notify() {}, showIntro() { intros++; } };
  h.context.electronAPI.loadGame = async () => { throw new Error('read failure'); };
  h.run('document.getElementById("main-menu").style.display="flex";');
  await h.context.onload();
  assert.equal(intros, 0); assert.equal(h.run('currentPresentationScreen()'), 'menu');
  assert.equal(h.context.RiskSaveLoading, false); assert.equal(h.context.RiskSaveReadBlocked, true);
});

test('queued writes snapshot values and coalesce to the newest state', async () => {
  const h = harness(); const snapshots = []; let release;
  h.context.electronAPI.saveGame = data => { snapshots.push(data); return snapshots.length === 1 ? new Promise(done => { release = done; }) : Promise.resolve(true); };
  h.run('totalMoney=100;'); const first = h.run('saveGameState()');
  h.run('totalMoney=200;pUpgrades.ram.lvl=7;saveGameState();totalMoney=300;pUpgrades.ram.lvl=8;saveGameState();');
  assert.equal(snapshots.length, 1); assert.equal(snapshots[0].totalMoney, 100); assert.equal(snapshots[0].pUpgrades.ram.lvl, 0);
  release(true); assert.equal(await first, true);
  assert.equal(snapshots.length, 2); assert.equal(snapshots[1].totalMoney, 300); assert.equal(snapshots[1].pUpgrades.ram.lvl, 8);
});

test('a save arriving at the drain-completion microtask boundary is not stranded', async () => {
  const h = harness(); const snapshots = [];
  h.context.electronAPI.saveGame = data => { snapshots.push(data); return Promise.resolve(true); };
  h.run('totalMoney=1;'); const first = h.run('saveGameState()');
  // The first await continuation finishes its loop before this queued callback,
  // but its completion continuation has not yet cleared the active promise.
  await Promise.resolve();
  h.run('totalMoney=2;'); const second = h.run('saveGameState()');
  await Promise.all([first, second]); await flush();
  assert.deepEqual(snapshots.map(s => s.totalMoney), [1, 2]);
  assert.equal(h.run('pendingSaveState'), null);
});

test('write rejection is handled and the next save can retry successfully', async () => {
  const h = harness(); let calls = 0;
  h.context.electronAPI.saveGame = () => { calls++; if (calls === 1) throw new Error('disk failure'); return Promise.resolve(true); };
  assert.equal(await h.run('saveGameState()'), false);
  assert.equal(h.context.document.body.dataset.saveState, 'save-error');
  assert.equal(await h.run('saveGameState()'), true); assert.equal(calls, 2);
  assert.equal(h.context.document.body.dataset.saveState, 'saved');
});

test('Exit requests the native quit coordinator without directly saving or closing', async () => {
  const h = harness(); let requests = 0, saves = 0;
  h.context.electronAPI.onQuitRequested = () => () => {};
  h.context.electronAPI.saveGame = () => { saves++; return Promise.resolve(true); };
  h.context.electronAPI.closeApp = () => { requests++; };
  await h.run('quitGame()');
  assert.equal(requests, 1); assert.equal(saves, 0);
});

async function mainHarness({ isolated = true, fetch, directory, gameStore, localStore } = {}) {
  const handlers = new Map(), listeners = new Map(), appEvents = new Map(), timers = new Set();
  const folder = directory || fixture(); let win, quitCount = 0, fetchCount = 0; const sent = [];
  const app = { getPath: () => folder, setPath() {}, requestSingleInstanceLock: () => true,
    quit() { quitCount++; }, whenReady: () => Promise.resolve(), on: (name, fn) => appEvents.set(name, fn) };
  class BrowserWindow {
    constructor(options) {
      this.options = options; this.events = new Map(); win = this;
      this.webContents = { mainFrame: { url: pathToFileURL(path.join(root, 'index.html')).href }, isDestroyed: () => false, send: (...args) => sent.push(args),
        setWindowOpenHandler(fn) { this.openHandler = fn; }, on(name, fn) { this[name] = fn; },
        session: { setPermissionRequestHandler() {}, setPermissionCheckHandler() {} } };
    }
    loadFile(file) { this.file = file; } on(name, fn) { this.events.set(name, fn); } once(name, fn) { this.events.set(name, fn); }
    isDestroyed() { return false; } isMinimized() { return false; } focus() {} show() {}
  }
  const electron = { app, BrowserWindow, ipcMain: { handle: (name, fn) => handlers.set(name, fn), on: (name, fn) => listeners.set(name, fn) },
    net: { fetch: async (...args) => { fetchCount++; return fetch ? fetch(...args) : { ok: true, text: async () => '{}' }; } } };
  const context = { __dirname: root, Buffer, URL, AbortController, Date, console: { error() {}, log() {} },
    process: { platform: 'win32', env: isolated ? { RISK_V2_TEST_MODE: '1', RISK_V2_USER_DATA_DIR: folder } : {} },
    fetch: (...args) => { fetchCount++; if (fetch) return fetch(...args); throw new Error('Unexpected global network request'); },
    setTimeout(fn) { const timer = { fn, unref() {} }; timers.add(timer); return timer; }, clearTimeout: timer => timers.delete(timer),
    require(name) { if (name === 'electron') return electron; if (name === './src/save-store') return { createSaveStore: gameStore ? () => gameStore : createSaveStore }; if (name === './src/local-leaderboard-store') return { ...require('../src/local-leaderboard-store'), ...(localStore ? { createLocalLeaderboardStore: () => localStore } : {}) }; return require(name); } };
  vm.createContext(context);
  // Contents are evaluated only in this isolated VM, never emitted or executed as Electron.
  vm.runInContext(fs.readFileSync(path.join(root, 'main.js'), 'utf8'), context, { filename: 'main-under-test.js' });
  await flush();
  const event = { sender: win.webContents, senderFrame: win.webContents.mainFrame };
  return { handlers, listeners, event, win, timers, folder, sent, appEvents, fetches: () => fetchCount, quits: () => quitCount };
}

test('IPC rejects non-game frames, foreign windows and navigated documents', async () => {
  const h = await mainHarness();
  for (const bad of [{ ...h.event, sender: {} }, { ...h.event, senderFrame: { url: h.event.senderFrame.url } }]) {
    assert.throws(() => h.handlers.get('load-game')(bad), /Untrusted/);
    await assert.rejects(h.handlers.get('get-leaderboard')(bad), /Untrusted/);
    await assert.rejects(h.handlers.get('submit-score')(bad, { name: 'AGENT', score: 42 }), /Untrusted/);
    assert.throws(() => h.handlers.get('save-game')(bad, state()), /Untrusted/);
    h.listeners.get('close-app')(bad); assert.equal(h.quits(), 0);
  }
  h.event.senderFrame.url = 'https://example.invalid/';
  assert.throws(() => h.handlers.get('load-game')(h.event), /Untrusted/);
  assert.equal(h.fetches(), 0);
});

test('isolated IPC validates input and uses the real local leaderboard file', async () => {
  const h = await mainHarness();
  assert.equal(h.win.options.webPreferences.sandbox, true);
  assert.equal(await h.handlers.get('save-game')(h.event, state()), false);
  assert.equal(h.handlers.get('load-game')(h.event), null);
  assert.equal(await h.handlers.get('save-game')(h.event, state()), true);
  for (const data of [undefined, {}, { name: '', score: 2 }, { name: 'A', score: Infinity }, { name: 'A', score: -1 }, { name: 'A', score: '42' }]) await assert.rejects(h.handlers.get('submit-score')(h.event, data), /Invalid/);
  assert.equal(await h.handlers.get('submit-score')(h.event, { name: 'AGENT', score: 42 }), 'OK');
  const board = JSON.parse(await h.handlers.get('get-leaderboard')(h.event));
  assert.deepEqual(board, { scope: 'local', metric: 'best-bank-balance', limit: 10, entries: [{ name: 'AGENT', score: 42 }] });
  assert.equal(JSON.parse(fs.readFileSync(path.join(h.folder, 'local_leaderboard.json'), 'utf8')).entries[0].score, 42);
  assert.equal(h.fetches(), 0);
  let prevented = false; h.win.webContents['will-navigate']({ preventDefault() { prevented = true; } }); assert.equal(prevented, true);
});

test('local leaderboard IPC persists across relaunch in production and isolated modes with zero network', async () => {
  for (const isolated of [false, true]) {
    const h = await mainHarness({ isolated, fetch: () => { throw new Error('Network must never be used'); } });
    for (const data of [null, {}, { name: 'A', score: NaN }, { name: 'A', score: -1 }]) await assert.rejects(h.handlers.get('submit-score')(h.event, data), /Invalid/);
    await h.handlers.get('submit-score')(h.event, { name: ' Agent ', score: 42.9 });
    await h.handlers.get('submit-score')(h.event, { name: 'agent', score: 21 });
    await h.handlers.get('submit-score')(h.event, { name: 'HUGE', score: 1e200 });
    const fresh = await mainHarness({ isolated, directory: h.folder });
    const board = JSON.parse(await fresh.handlers.get('get-leaderboard')(fresh.event));
    assert.deepEqual(board.entries, [{ name: 'HUGE', score: 1e200 }, { name: 'Agent', score: 42.9 }]);
    assert.equal(h.fetches(), 0); assert.equal(fresh.fetches(), 0); assert.equal(h.timers.size, 0);
  }
});

test('local storage errors preserve existing files and expose no filesystem details through IPC', async () => {
  const h = await mainHarness({ isolated: false });
  const file = path.join(h.folder, 'local_leaderboard.json'), broken = 'corrupt fixture';
  fs.writeFileSync(file, broken);
  await assert.rejects(h.handlers.get('get-leaderboard')(h.event), error => error.message === 'Leaderboard unavailable. Try again shortly.');
  await assert.rejects(h.handlers.get('submit-score')(h.event, { name: 'AGENT', score: 99 }), error => error.message === 'Local score could not be saved. Try again.');
  assert.equal(fs.readFileSync(file, 'utf8'), broken); assert.equal(h.fetches(), 0); assert.equal(h.timers.size, 0);
});

test('local score bursts merge deterministically without timers, HTTP paths or provider credentials', async () => {
  const h = await mainHarness({ isolated: false });
  await Promise.all(Array.from({ length: 50 }, (_, i) => h.handlers.get('submit-score')(h.event, { name: 'AGENT', score: i })));
  const board = JSON.parse(await h.handlers.get('get-leaderboard')(h.event));
  assert.deepEqual(board.entries, [{ name: 'AGENT', score: 49 }]); assert.equal(h.fetches(), 0); assert.equal(h.timers.size, 0);
  const currentMain = fs.readFileSync(path.join(root, 'main.js'), 'utf8');
  const currentStore = fs.readFileSync(path.join(root, 'src/local-leaderboard-store.js'), 'utf8');
  assert.equal(/dreamlo|https?:\/\/|\bfetch\s*\(|boundedFetch|require\(['"](?:node:)?(?:http|https|net)['"]\)/i.test(currentMain + currentStore), false, 'the current main process and local provider have no remote leaderboard path');
});

const preventable = () => ({ prevented: false, preventDefault() { this.prevented = true; } });
const requestQuit = h => h.listeners.get('close-app')(h.event);
const saveForQuit = h => h.handlers.get('save-game')(h.event, state());
const finishQuit = (h, options = {}) => h.handlers.get('finish-quit')(h.event, options);

test('native close and app quit queue one request until the renderer listener is ready', async () => {
  const h = await mainHarness();
  const close = preventable(), quit = preventable();
  h.win.events.get('close')(close); h.appEvents.get('before-quit')(quit); requestQuit(h);
  assert.equal(close.prevented, true); assert.equal(quit.prevented, true);
  assert.equal(h.quits(), 0); assert.equal(h.sent.length, 0);
  h.listeners.get('quit-listener-ready')(h.event, true);
  requestQuit(h); h.win.events.get('close')(preventable());
  assert.deepEqual(h.sent, [['quit-requested']]); assert.equal(h.quits(), 0);
  h.listeners.get('quit-cancelled')(h.event); requestQuit(h);
  assert.equal(h.sent.length, 2, 'a cancelled attempt permits a later independent request');
});

test('normal finish requires a fresh successful save and does not close after a failed save', async () => {
  const h = await mainHarness(); h.handlers.get('load-game')(h.event);
  await saveForQuit(h); requestQuit(h);
  assert.equal(await finishQuit(h), false, 'a save from before this request is insufficient');
  assert.equal(await h.handlers.get('save-game')(h.event, {}), false);
  assert.equal(await finishQuit(h), false); assert.equal(h.quits(), 0);
  assert.equal(await saveForQuit(h), true);
  assert.equal(await finishQuit(h), true); assert.equal(h.quits(), 1);
  const closing = preventable(); h.win.events.get('close')(closing);
  const quitting = preventable(); h.appEvents.get('before-quit')(quitting);
  assert.equal(closing.prevented, false); assert.equal(quitting.prevented, false);
  assert.equal(await finishQuit(h), false); assert.equal(h.quits(), 1);
});

test('a changed game-save version during local draining refuses exit even when the newer write succeeds', async () => {
  let release;
  const h = await mainHarness({ localStore: { flush: () => new Promise(done => { release = done; }) } });
  h.handlers.get('load-game')(h.event); requestQuit(h); await saveForQuit(h);
  const finishing = finishQuit(h); await flush();
  await h.handlers.get('save-game')(h.event, state({ totalMoney: 800 }));
  release(true); assert.equal(await finishing, false); assert.equal(h.quits(), 0);
});

test('a pre-request game save finishing late cannot satisfy the fresh-save gate', async () => {
  let release;
  const h = await mainHarness({ gameStore: { save: () => new Promise(done => { release = done; }), load: () => null } });
  const saving = saveForQuit(h); requestQuit(h); release(true); await saving;
  assert.equal(await finishQuit(h), false); assert.equal(h.quits(), 0);
});

test('cancel while finish is waiting invalidates that attempt instead of closing later', async () => {
  let release;
  const h = await mainHarness({ localStore: { flush: () => new Promise(done => { release = done; }) } });
  h.handlers.get('load-game')(h.event); requestQuit(h); await saveForQuit(h);
  const finishing = finishQuit(h); await flush();
  h.listeners.get('quit-cancelled')(h.event); release(true);
  assert.equal(await finishing, false); assert.equal(h.quits(), 0);
});

test('local-record failures block normal finish until explicit retry succeeds', async () => {
  let failed = true; const retries = [];
  const h = await mainHarness({ localStore: { flush: async ({ retry }) => { retries.push(retry); if (retry) failed = false; return !failed; } } });
  h.handlers.get('load-game')(h.event); requestQuit(h); await saveForQuit(h);
  assert.equal(await finishQuit(h), false); assert.equal(h.quits(), 0);
  assert.deepEqual(retries, [false], 'normal finish never starts retries');
  assert.equal(await h.handlers.get('flush-local-scores')(h.event, { retry: true }), true);
  assert.equal(await finishQuit(h), true); assert.deepEqual(retries, [false, true, false]);
});

test('explicit discard waits for existing game and local writes, closes once, and never retries', async () => {
  let releaseGame, releaseLocal; const retries = [];
  const h = await mainHarness({ gameStore: { save: () => new Promise(done => { releaseGame = done; }), load: () => null },
    localStore: { flush: ({ retry }) => { retries.push(retry); return new Promise(done => { releaseLocal = done; }); } } });
  requestQuit(h); const saving = saveForQuit(h);
  const finishing = finishQuit(h, { discard: true }), repeated = finishQuit(h, { discard: true });
  await flush(); assert.equal(h.quits(), 0); assert.equal(releaseLocal, undefined);
  releaseGame(false); await saving; await flush(); assert.equal(h.quits(), 0);
  releaseLocal(false);
  assert.equal(await finishing, true); assert.equal(await repeated, true);
  assert.equal(h.quits(), 1); assert.deepEqual(retries, [false]);
});

test('failed startup load can exit only through explicit discard without overwriting its save', async () => {
  const h = await mainHarness(), file = path.join(h.folder, 'user_data.json');
  fs.writeFileSync(file, 'broken save'); assert.throws(() => h.handlers.get('load-game')(h.event), /preserved/);
  requestQuit(h); assert.equal(await saveForQuit(h), false); assert.equal(await finishQuit(h), false);
  assert.equal(await finishQuit(h, { discard: true }), true);
  assert.equal(fs.readFileSync(file, 'utf8'), 'broken save');
});

test('new quit and flush IPC reject untrusted senders and malformed discard/retry options', async () => {
  const h = await mainHarness(), bad = { ...h.event, sender: {} };
  assert.throws(() => h.handlers.get('finish-quit')(bad, { discard: true }), /Untrusted/);
  await assert.rejects(h.handlers.get('flush-local-scores')(bad, { retry: true }), /Untrusted/);
  h.listeners.get('quit-listener-ready')(bad, true); h.listeners.get('quit-cancelled')(bad); requestQuit(h);
  assert.equal(h.sent.length, 0); assert.equal(await finishQuit(h, { discard: 'true' }), false);
  assert.equal(await h.handlers.get('flush-local-scores')(h.event, { retry: 'true' }), false);
  assert.equal(h.quits(), 0); assert.equal(h.fetches(), 0);
});

test('a second interrupted game save preserves its only recovered temporary snapshot', () => {
  const file = path.join(fixture(), 'user_data.json'), previous = JSON.stringify(state({ totalMoney: 321 }));
  fs.writeFileSync(file + '.tmp', previous);
  const io = Object.create(fs);
  io.writeFileSync = (descriptor, _data, encoding) => { fs.writeFileSync(descriptor, '{', encoding); throw new Error('interrupted'); };
  const store = createSaveStore(file, io); assert.equal(store.load().totalMoney, 321);
  assert.equal(store.save(state({ totalMoney: 900 })), false);
  assert.equal(fs.readFileSync(file + '.bak', 'utf8'), previous);
  assert.equal(createSaveStore(file).load().totalMoney, 321);
});

test('preload quit subscriptions never expose IPC events and unsubscribe independently', async () => {
  const callbacks = new Map(), sent = [], invoked = []; let bridge;
  const electron = { contextBridge: { exposeInMainWorld: (_name, api) => { bridge = api; } },
    ipcRenderer: { on: (channel, callback) => callbacks.set(channel, callback), send: (...args) => sent.push(args), invoke: (...args) => { invoked.push(args); return Promise.resolve(true); } } };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'preload.js'), 'utf8'), { require: () => electron });
  let calls = 0; const handler = (...args) => { assert.equal(args.length, 0); calls++; };
  const first = bridge.onQuitRequested(handler), second = bridge.onQuitRequested(handler);
  first(); callbacks.get('quit-requested')({ sender: 'private native event' }); assert.equal(calls, 1);
  second(); second(); callbacks.get('quit-requested')({}); assert.equal(calls, 1);
  assert.deepEqual(sent, [['quit-listener-ready', true], ['quit-listener-ready', true], ['quit-listener-ready', false]]);
  bridge.closeApp(); bridge.quitCancelled(); await bridge.finishQuit({ discard: true }); await bridge.flushLocalScores({ retry: true });
  assert.deepEqual(sent.slice(-2), [['close-app'], ['quit-cancelled']]);
  assert.deepEqual(invoked, [['finish-quit', { discard: true }], ['flush-local-scores', { retry: true }]]);
  assert.throws(() => bridge.onQuitRequested(null), /callback/);
});

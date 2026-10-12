'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createLocalLeaderboardStore, normalizeEntry, LIMIT, MAX_BYTES } = require('../src/local-leaderboard-store');

function fixture() {
  const base = path.resolve(__dirname, '..', '..', 'local-board-fixtures');
  fs.mkdirSync(base, { recursive: true });
  return path.join(fs.mkdtempSync(path.join(base, 'isolated-')), 'local_leaderboard.json');
}
const snapshot = entries => JSON.stringify({ version: 1, entries });
const disk = file => JSON.parse(fs.readFileSync(file, 'utf8'));

test('an empty local board is read-only and never touches the separate progression save', async () => {
  const file = fixture(), save = path.join(path.dirname(file), 'user_data.json');
  const original = '{"totalMoney":123.45,"achievements":{"firstBlood":{"unlocked":true}}}';
  fs.writeFileSync(save, original);
  const store = createLocalLeaderboardStore(file);
  assert.deepEqual(await store.read(), []); assert.equal(fs.existsSync(file), false);
  await store.submit('AGENT', 0.25);
  assert.equal(fs.readFileSync(save, 'utf8'), original);
  assert.deepEqual(disk(file), { version: 1, entries: [{ name: 'AGENT', score: 0.25 }] });
});

test('finite fractional, sub-cent and very large bank balances round-trip without score rounding', async () => {
  const file = fixture(), store = createLocalLeaderboardStore(file);
  for (const [name, score] of [['CENT', .25], ['SUBCENT', .000001], ['MIN', Number.MIN_VALUE], ['MAX', Number.MAX_VALUE], ['ZERO', -0]]) await store.submit(name, score);
  assert.deepEqual(await createLocalLeaderboardStore(file).read(), [
    { name: 'MAX', score: Number.MAX_VALUE }, { name: 'CENT', score: .25 },
    { name: 'SUBCENT', score: .000001 }, { name: 'MIN', score: Number.MIN_VALUE }, { name: 'ZERO', score: 0 }
  ]);
  await store.submit('cent', .250001);
  assert.equal((await store.read()).find(row => row.name === 'cent').score, .250001);
});

test('normalized agent aliases share their best record and cannot lower it', async () => {
  const file = fixture(), store = createLocalLeaderboardStore(file);
  await store.submit('  Ａgent   One\u202e\u0000  ', 10.75);
  const first = fs.readFileSync(file, 'utf8');
  await store.submit('agent one', 9); await store.submit('AGENT ONE', 10.75);
  assert.equal(fs.readFileSync(file, 'utf8'), first, 'lower and tied submissions do not rewrite a record');
  await store.submit('agent one', 11.1);
  assert.deepEqual(await createLocalLeaderboardStore(file).read(), [{ name: 'agent one', score: 11.1 }]);
});

test('Unicode truncation is bounded and idempotent, and reserved object names are safe', async () => {
  const value = normalizeEntry('🙂'.repeat(31), 1);
  assert.equal(Array.from(value.name).length, 30);
  const edge = normalizeEntry('A'.repeat(29) + ' B', 1);
  assert.equal(edge.name, 'A'.repeat(29)); assert.deepEqual(normalizeEntry(edge.name, 1), edge);
  const store = createLocalLeaderboardStore(fixture());
  await store.submit('__proto__', 12); await store.submit('constructor', 11);
  assert.deepEqual(await store.read(), [{ name: '__proto__', score: 12 }, { name: 'constructor', score: 11 }]);
  assert.equal({}.score, undefined);
});

test('invalid inputs are rejected before disk writes and do not poison the next valid operation', async () => {
  const file = fixture(), store = createLocalLeaderboardStore(file);
  for (const [name, score] of [[null, 1], ['', 1], ['  \u0000 ', 1], ['A'.repeat(1025), 1], ['A', -1], ['A', NaN], ['A', Infinity], ['A', '2'], ['A', null]]) {
    await assert.rejects(store.submit(name, score), error => error.code === 'INVALID_RECORD');
  }
  assert.equal(fs.existsSync(file), false);
  assert.equal(await store.submit('VALID', 2), true);
  assert.deepEqual(await store.read(), [{ name: 'VALID', score: 2 }]);
});

test('only the best ten are persisted with deterministic name ordering for tied balances', async () => {
  const file = fixture(), store = createLocalLeaderboardStore(file);
  for (let i = 14; i >= 0; i--) await store.submit('AGENT_' + String(i).padStart(2, '0'), i < 3 ? 1 : i);
  const rows = await store.read();
  assert.equal(rows.length, LIMIT); assert.deepEqual(rows.map(row => row.score), [14, 13, 12, 11, 10, 9, 8, 7, 6, 5]);
  const before = fs.readFileSync(file, 'utf8'); await store.submit('OUTSIDE', 2);
  assert.equal(fs.readFileSync(file, 'utf8'), before);
  const tied = createLocalLeaderboardStore(fixture());
  await tied.submit('zeta', 1); await tied.submit('Alpha', 1); await tied.submit('beta', 1);
  assert.deepEqual((await tied.read()).map(row => row.name), ['Alpha', 'beta', 'zeta']);
});

test('overlapping writes and a following read are serialized without losing a higher score', async () => {
  const file = fixture(), store = createLocalLeaderboardStore(file);
  const writes = Array.from({ length: 100 }, (_, i) => store.submit(i % 2 ? 'a' : 'A', (i * 37) % 100 + .01));
  const readAfterAllQueuedWrites = store.read();
  await Promise.all(writes);
  assert.equal((await readAfterAllQueuedWrites)[0].score, 99.01);
  assert.deepEqual(await createLocalLeaderboardStore(file).read(), await store.read());
  const rows = await store.read(); rows[0].score = -1; rows.push({ name: 'BAD', score: 999 });
  assert.equal((await store.read()).length, 1); assert.equal((await store.read())[0].score, 99.01);
});

test('a valid primary has priority over recovery files and loading merges duplicate aliases', async () => {
  const file = fixture();
  fs.writeFileSync(file, snapshot([{ name: ' Agent ', score: 3.5 }, { name: 'agent', score: 4.2 }]));
  fs.writeFileSync(file + '.bak', snapshot([{ name: 'BACKUP', score: 100 }]));
  fs.writeFileSync(file + '.tmp', snapshot([{ name: 'TEMP', score: 200 }]));
  assert.deepEqual(await createLocalLeaderboardStore(file).read(), [{ name: 'agent', score: 4.2 }]);
});

test('a corrupted primary recovers its backup without overwriting it with damaged bytes', async () => {
  const file = fixture(), healthy = snapshot([{ name: 'RECOVERED', score: 12.5 }]);
  fs.writeFileSync(file, '{'); fs.writeFileSync(file + '.bak', healthy);
  const store = createLocalLeaderboardStore(file);
  assert.deepEqual(await store.read(), [{ name: 'RECOVERED', score: 12.5 }]);
  await store.submit('NEW', 13);
  assert.equal(fs.readFileSync(file + '.bak', 'utf8'), healthy);
  assert.deepEqual(disk(file).entries, [{ name: 'NEW', score: 13 }, { name: 'RECOVERED', score: 12.5 }]);
  assert.equal(fs.existsSync(file + '.tmp'), false);
});

test('a complete first temporary snapshot is recoverable, but invalid existing snapshots are preserved', async () => {
  const first = fixture(); fs.writeFileSync(first + '.tmp', snapshot([{ name: 'TEMP', score: 1.25 }]));
  assert.deepEqual(await createLocalLeaderboardStore(first).read(), [{ name: 'TEMP', score: 1.25 }]);
  const cases = ['{', snapshot([{ name: 'A', score: -1 }]), '{"version":2,"entries":[]}', snapshot(new Array(1001).fill({ name: 'A', score: 1 })), ' '.repeat(MAX_BYTES + 1)];
  for (const bad of cases) {
    const file = fixture(); fs.writeFileSync(file, bad);
    const store = createLocalLeaderboardStore(file);
    await assert.rejects(store.read(), /preserved/); await assert.rejects(store.submit('NEW', 9), /preserved/);
    assert.equal(fs.readFileSync(file, 'utf8'), bad); assert.equal(fs.existsSync(file + '.tmp'), false);
  }
});

test('a failed atomic replacement does not publish new scores and the same queue permits retry', async () => {
  const file = fixture(), original = snapshot([{ name: 'BEFORE', score: 3 }]); fs.writeFileSync(file, original);
  let fail = true; const io = Object.create(fs);
  io.renameSync = (...args) => { if (fail) throw new Error('simulated locked primary'); return fs.renameSync(...args); };
  const store = createLocalLeaderboardStore(file, io);
  await assert.rejects(store.submit('NEW', 9), /locked primary/);
  assert.equal(fs.readFileSync(file, 'utf8'), original);
  assert.deepEqual(await store.read(), [{ name: 'BEFORE', score: 3 }]);
  fail = false; await store.submit('NEW', 9);
  assert.deepEqual(await createLocalLeaderboardStore(file).read(), [{ name: 'NEW', score: 9 }, { name: 'BEFORE', score: 3 }]);
  assert.equal(fs.readFileSync(file + '.bak', 'utf8'), original); assert.equal(fs.existsSync(file + '.tmp'), false);
});

test('a failed flush closes its descriptor and does not change a complete primary', async () => {
  const file = fixture(), original = snapshot([{ name: 'BEFORE', score: 3 }]); fs.writeFileSync(file, original);
  let closed = 0; const io = Object.create(fs);
  io.fsyncSync = () => { throw new Error('simulated disk flush failure'); };
  io.closeSync = descriptor => { closed++; return fs.closeSync(descriptor); };
  await assert.rejects(createLocalLeaderboardStore(file, io).submit('NEW', 9), /flush failure/);
  assert.equal(closed, 1); assert.equal(fs.readFileSync(file, 'utf8'), original);
});

test('a second interrupted write cannot destroy the sole recovered temporary snapshot', async () => {
  const file = fixture(), original = snapshot([{ name: 'RECOVERED', score: 3.5 }]);
  fs.writeFileSync(file + '.tmp', original);
  const io = Object.create(fs);
  io.writeFileSync = (descriptor, _data, encoding) => {
    fs.writeFileSync(descriptor, '{', encoding);
    throw new Error('simulated interrupted write');
  };
  const store = createLocalLeaderboardStore(file, io);
  assert.deepEqual(await store.read(), [{ name: 'RECOVERED', score: 3.5 }]);
  await assert.rejects(store.submit('NEW', 9), /interrupted write/);
  assert.equal(fs.readFileSync(file + '.bak', 'utf8'), original);
  assert.deepEqual(await createLocalLeaderboardStore(file).read(), [{ name: 'RECOVERED', score: 3.5 }]);
});

test('flush drains queued submissions and checks failures without silently retrying them', async () => {
  const file = fixture(); let failed = true, writes = 0; const io = Object.create(fs);
  io.renameSync = (...args) => { writes++; if (failed) throw new Error('disk locked'); return fs.renameSync(...args); };
  const store = createLocalLeaderboardStore(file, io);
  const submission = store.submit('AGENT', 10.5); const failure = assert.rejects(submission, /disk locked/);
  const check = store.flush(); await failure;
  assert.equal(await check, false); assert.equal(writes, 1);
  failed = false; assert.equal(await store.flush(), false); assert.equal(writes, 1);
  assert.equal(await store.flush({ retry: true }), true); assert.equal(writes, 2);
  assert.deepEqual(await createLocalLeaderboardStore(file).read(), [{ name: 'AGENT', score: 10.5 }]);
  assert.equal(await store.flush(), true);
});

test('explicit retry preserves the highest failed score per normalized name with bounded top-ten records', async () => {
  const file = fixture(); let failed = true; const io = Object.create(fs);
  io.renameSync = (...args) => { if (failed) throw new Error('disk locked'); return fs.renameSync(...args); };
  const store = createLocalLeaderboardStore(file, io);
  await assert.rejects(store.submit(' Best ', 100.25), /locked/);
  await assert.rejects(store.submit('best', 1), /locked/);
  for (let i = 0; i < 30; i++) await assert.rejects(store.submit('AGENT_' + i, i), /locked/);
  assert.equal(await store.flush({ retry: true }), false);
  failed = false; assert.equal(await store.flush({ retry: true }), true);
  const rows = await store.read(); assert.equal(rows.length, 10);
  assert.deepEqual(rows[0], { name: 'Best', score: 100.25 });
  assert.deepEqual(rows.slice(1).map(row => row.score), [29, 28, 27, 26, 25, 24, 23, 22, 21]);
});

test('later successful submissions satisfy earlier pending records without downgrades or phantom quit failures', async () => {
  const file = fixture(); let failed = true; const io = Object.create(fs);
  io.renameSync = (...args) => { if (failed) throw new Error('disk locked'); return fs.renameSync(...args); };
  const store = createLocalLeaderboardStore(file, io);
  await assert.rejects(store.submit('A', 10), /locked/);
  failed = false; await store.submit('a', 5);
  assert.equal(await store.flush(), false, 'lower committed value does not erase the missing high record');
  await store.submit('a', 11); assert.equal(await store.flush(), true);
  assert.deepEqual(await store.read(), [{ name: 'a', score: 11 }]);
  await assert.rejects(store.submit('', 99), /Invalid/);
  assert.equal(await store.flush(), true, 'rejected invalid input does not become a retryable record');
});

'use strict';
const fs = require('node:fs');
const path = require('node:path');
const LIMIT = 10, MAX_BYTES = 64 * 1024, MAX_RECORDS = 1000;

function normalizeEntry(name, score) {
  if (typeof name !== 'string' || name.length > 1024 || typeof score !== 'number' || !Number.isFinite(score) || score < 0) {
    const error = new Error('Invalid score submission.'); error.code = 'INVALID_RECORD'; throw error;
  }
  const clean = Array.from(name.normalize('NFKC').replace(/[\u0000-\u001f\u007f\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, '').replace(/\s+/gu, ' ').trim()).slice(0, 30).join('').trim();
  if (!clean) { const error = new Error('Invalid score submission.'); error.code = 'INVALID_RECORD'; throw error; }
  return { name: clean, score: Math.max(0, score) };
}
const keyOf = entry => entry.name.toLowerCase();
function rank(entries) {
  const best = new Map();
  for (const entry of entries) {
    const key = keyOf(entry), previous = best.get(key);
    if (!previous || entry.score > previous.score) best.set(key, entry);
  }
  return [...best.values()].sort((a, b) => {
    if (a.score !== b.score) return a.score > b.score ? -1 : 1;
    const x = keyOf(a), y = keyOf(b); return x < y ? -1 : x > y ? 1 : 0;
  }).slice(0, LIMIT);
}

function createLocalLeaderboardStore(filename, io = fs) {
  let records = null, recoveredFrom = null, queue = Promise.resolve(), pending = [];
  const serialize = operation => {
    const result = queue.then(operation);
    queue = result.catch(() => {}); // A failed disk operation must not poison later retries.
    return result;
  };
  function readFile(file) {
    if (io.statSync(file).size > MAX_BYTES) throw new Error('Local records exceed supported size.');
    const data = JSON.parse(io.readFileSync(file, 'utf8'));
    if (!data || data.version !== 1 || !Array.isArray(data.entries) || data.entries.length > MAX_RECORDS) throw new Error('Invalid local records.');
    return rank(data.entries.map(row => {
      if (!row || typeof row !== 'object' || Array.isArray(row)) throw new Error('Invalid local record.');
      return normalizeEntry(row.name, row.score);
    }));
  }
  function load() {
    if (records !== null) return records;
    let found = false;
    for (const candidate of [filename, filename + '.bak', filename + '.tmp']) {
      if (!io.existsSync(candidate)) continue;
      found = true;
      try { records = readFile(candidate); recoveredFrom = candidate; return records; } catch (_) { /* Keep the first readable complete snapshot. */ }
    }
    if (found) throw new Error('Local records could not be read; existing files were preserved.');
    records = []; return records;
  }
  function write(next) {
    const serialized = JSON.stringify({ version: 1, entries: next });
    if (Buffer.byteLength(serialized, 'utf8') > MAX_BYTES) throw new Error('Local records exceed supported size.');
    io.mkdirSync(path.dirname(filename), { recursive: true });
    const temporary = filename + '.tmp'; let descriptor;
    try {
      // A recovered temporary file may be the only complete copy left. Preserve
      // it before reusing the temporary path for another atomic replacement.
      if (recoveredFrom === temporary) {
        io.copyFileSync(temporary, filename + '.bak');
        recoveredFrom = filename + '.bak';
      }
      descriptor = io.openSync(temporary, 'w', 0o600);
      io.writeFileSync(descriptor, serialized, 'utf8'); io.fsyncSync(descriptor);
      io.closeSync(descriptor); descriptor = undefined;
      if (io.existsSync(filename)) {
        let valid = false;
        try { readFile(filename); valid = true; } catch (_) { /* Never replace a good backup with a damaged primary. */ }
        if (valid) io.copyFileSync(filename, filename + '.bak');
      }
      io.renameSync(temporary, filename);
      records = next; // Publish only after the atomic replacement succeeds.
      recoveredFrom = filename;
    } finally {
      if (descriptor !== undefined) { try { io.closeSync(descriptor); } catch (_) {} }
    }
  }
  function discardSatisfiedPending() {
    const wanted = rank([...(records || []), ...pending]);
    pending = wanted.filter(entry => !(records || []).some(saved => keyOf(saved) === keyOf(entry) && saved.score >= entry.score));
  }
  return Object.freeze({
    submit(name, score) {
      let entry;
      try { entry = normalizeEntry(name, score); } catch (error) { return Promise.reject(error); }
      return serialize(() => {
        try {
          const previous = load(), next = rank([...previous, entry]);
          if (JSON.stringify(previous) !== JSON.stringify(next)) write(next);
          discardSatisfiedPending();
          return true;
        } catch (error) {
          pending = rank([...pending, entry]);
          throw error;
        }
      });
    },
    read() { return serialize(() => load().map(entry => ({ ...entry }))); },
    flush({ retry = false } = {}) {
      return serialize(() => {
        if (!pending.length) return true;
        if (!retry) return false; // Discard/normal close never silently starts retries.
        try {
          const previous = load(), next = rank([...previous, ...pending]);
          if (JSON.stringify(previous) !== JSON.stringify(next)) write(next);
          pending = [];
          return true;
        } catch (_) { return false; }
      });
    }
  });
}
module.exports = { createLocalLeaderboardStore, normalizeEntry, LIMIT, MAX_BYTES };

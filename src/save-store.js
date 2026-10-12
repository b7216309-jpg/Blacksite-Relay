'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { normalize, normalizeForWrite, MAX_BYTES } = require('./save-schema');

function createSaveStore(filename, io = fs) {
  let readable = false, recoveredFrom = null;
  function read(file) {
    if (io.statSync(file).size > MAX_BYTES) throw new Error('Save exceeds supported size.');
    const state = normalize(JSON.parse(io.readFileSync(file, 'utf8')));
    if (!state) throw new Error('Save has no recognized fields.');
    return state;
  }
  function load() {
    readable = false;
    recoveredFrom = null;
    let found = false;
    for (const candidate of [filename, filename + '.bak', filename + '.tmp']) {
      if (!io.existsSync(candidate)) continue;
      found = true;
      try { const state = read(candidate); readable = true; recoveredFrom = candidate; return state; } catch (_) { /* Try the previous complete snapshot. */ }
    }
    readable = !found;
    if (found) throw new Error('Saved data could not be read. Existing files were preserved.');
    return null;
  }
  function save(input) {
    // A slow/failed startup read must never be replaced by the renderer defaults.
    if (!readable) return false;
    let descriptor;
    try {
      const state = normalizeForWrite(input);
      if (!state) return false;
      const serialized = JSON.stringify(state);
      if (Buffer.byteLength(serialized, 'utf8') > MAX_BYTES) return false;
      io.mkdirSync(path.dirname(filename), { recursive: true });
      const temporary = filename + '.tmp';
      if (recoveredFrom === temporary) {
        io.copyFileSync(temporary, filename + '.bak');
        recoveredFrom = filename + '.bak';
      }
      descriptor = io.openSync(temporary, 'w', 0o600);
      io.writeFileSync(descriptor, serialized, 'utf8');
      io.fsyncSync(descriptor);
      io.closeSync(descriptor); descriptor = undefined;
      if (io.existsSync(filename)) {
        let valid = false;
        try { read(filename); valid = true; } catch (_) { /* Preserve a good existing backup. */ }
        if (valid) io.copyFileSync(filename, filename + '.bak');
      }
      io.renameSync(temporary, filename);
      recoveredFrom = filename;
      return true;
    } catch (_) {
      if (descriptor !== undefined) { try { io.closeSync(descriptor); } catch (_) {} }
      return false;
    }
  }
  return Object.freeze({ load, save });
}
module.exports = { createSaveStore };

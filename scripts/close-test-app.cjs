'use strict';
const path = require('node:path');
const assert = require('node:assert/strict');

// Fixture teardown only. Native quit behavior is exercised by verify-safe-quit.
module.exports = async function closeTestApp(app) {
  const child = app.process();
  if (child.exitCode !== null) return;
  const context = await app.evaluate(({ app }) => ({
    testMode: process.env.RISK_V2_TEST_MODE,
    requested: process.env.RISK_V2_USER_DATA_DIR,
    actual: app.getPath('userData')
  }));
  assert.equal(context.testMode, '1', 'Refuse forced teardown outside test mode');
  assert(context.requested && path.isAbsolute(context.requested), 'Isolated profile required');
  assert.equal(path.resolve(context.actual).toLowerCase(), path.resolve(context.requested).toLowerCase());
  let timer;
  const exited = new Promise(resolve => child.once('exit', resolve));
  try {
    await app.evaluate(({ app }) => { setImmediate(() => app.exit(0)); });
    await Promise.race([exited, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('Test process did not exit')), 10000);
    })]);
  } finally { clearTimeout(timer); }
};

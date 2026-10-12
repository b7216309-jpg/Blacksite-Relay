const test = require('node:test');
const { findChromium, chromium, cases } = require('../scripts/protocol-environment-audit.cjs');
const executablePath = findChromium();
test('minigame device environments preserve native interaction and timing', {
  skip: executablePath ? false : 'Chromium unavailable; set CHROMIUM_EXECUTABLE.', timeout:120000
}, async t => {
  const browser=await chromium.launch({executablePath,headless:true,args:['--allow-file-access-from-files']});
  t.after(()=>browser.close());
  for(const [name,run] of cases) await t.test(name,()=>run(browser,{}));
});

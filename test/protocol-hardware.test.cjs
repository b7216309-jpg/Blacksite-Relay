const test=require('node:test');
const {findChromium,chromium}=require('../scripts/protocol-environment-audit.cjs');
const {hardwareCases}=require('../scripts/protocol-hardware-audit.cjs');
const executablePath=findChromium();
test('protocol hardware effects protect timing, targets and resource bounds',{skip:executablePath?false:'Set CHROMIUM_EXECUTABLE.',timeout:90000},async t=>{
 const browser=await chromium.launch({executablePath,headless:true,args:['--allow-file-access-from-files']});t.after(()=>browser.close());
 for(const [name,run]of hardwareCases)await t.test(name,()=>run(browser,{}));
});

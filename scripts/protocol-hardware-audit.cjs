const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {findChromium,chromium,withGame,start}=require('./protocol-environment-audit.cjs');
const games=['bypass','typing','backdoor'];
const state=page=>page.evaluate(()=>({money,totalMoney,risk,multiplier,nodesHacked,nodesValidated,bypassCharge}));
const diag=page=>page.evaluate(()=>RelayProtocolLife.getDiagnostics());
function limits(d){assert.ok(d.ready);assert.ok(d.ownedRAF<=1);assert.equal(d.ownedTimers,0);assert.ok(d.canvasCount<=4);assert.ok(d.devices.filter(x=>x.visible).length<=1);}
async function pixels(page){return page.evaluate(()=>{
 const game=RiskPresentation.currentScreen(),device=document.querySelector(`[data-protocol-device="${game}"]`),canvas=device.querySelector('.protocol-life-canvas');
 const data=canvas.getContext('2d').getImageData(0,0,420,650).data,origin=canvas.getBoundingClientRect();
 const selectors=['.protocol-heading','.calibration-console','.calibration-reward','.protocol-actions','.terminal-console','#typing-errors','#typing-error-slots','#typing-error-help','.protocol-payout','.patch-phase','#backdoor-grid','.patch-column-labels','.patch-row-labels','.patch-status','.protocol-foot'];
 const regions=[...device.querySelectorAll(selectors.join(','))].filter(e=>e.getClientRects().length).map(e=>{const b=e.getBoundingClientRect();return {label:e.id||e.className,x:Math.floor(b.x-origin.x),y:Math.floor(b.y-origin.y),r:Math.ceil(b.right-origin.x),b:Math.ceil(b.bottom-origin.y)};});
 let painted=0,protectedPaint=0,hash=2166136261,maxAlpha=0;for(let y=0;y<650;y++)for(let x=0;x<420;x++){const a=data[(y*420+x)*4+3];if(!a)continue;painted++;maxAlpha=Math.max(maxAlpha,a);if(regions.some(r=>x>=r.x&&x<r.r&&y>=r.y&&y<r.b))protectedPaint++;hash=Math.imul(hash^((x+1)*3+(y+1)*7+a),16777619);}
 return {game,painted,protectedPaint,maxAlpha,hash:hash>>>0,regions,pointer:getComputedStyle(canvas).pointerEvents,hidden:canvas.hidden,diagnostics:RelayProtocolLife.getDiagnostics()};
});}

const hardwareCases=[
 ['exported hardware pixels protect controls and vary only within bounded phase/quality effects',async(browser,options={})=>withGame(browser,async(page)=>{
  await page.waitForFunction(()=>RelayProtocolLife?.getDiagnostics().ready);
  const before=await diag(page),beforeState=await state(page);
  const result=await page.evaluate(async()=>{
   const originalRandom=Math.random;Math.random=()=>{throw Error('Hardware export consumed gameplay RNG');};
   const definition=RelayProtocolLife.getDefinition(),frames=[],probe=document.createElement('canvas');probe.width=420;probe.height=650;const ctx=probe.getContext('2d',{willReadFrequently:true});
   try{for(const game of ['bypass','typing','backdoor']){
    const image=document.querySelector(`[data-protocol-device="${game}"] .protocol-art`),def=definition.devices[game];
    if(def.sourceSize[0]!==image.naturalWidth||def.sourceSize[1]!==image.naturalHeight)throw Error('Source dimensions differ: '+game);
    for(const phase of ['countdown','active','result'])for(const quality of ['full','low'])for(const time of [0,.12,.3,.75,1.4,2.1,3.2]){
     const exported=RelayProtocolLife.exportFrame(time,{game,phase,effectsLevel:quality,phaseTime:time,success:false}),img=new Image();img.src=exported.image;await img.decode();ctx.clearRect(0,0,420,650);ctx.drawImage(img,0,0);
     const rgba=ctx.getImageData(0,0,420,650).data;let count=0,escaped=0,alpha=0,hash=2166136261;
     for(let y=0;y<650;y++)for(let x=0;x<420;x++){const a=rgba[(y*420+x)*4+3];if(!a)continue;count++;alpha+=a;hash=Math.imul(hash^((x+1)*3+(y+1)*7+a),16777619);if(def.protected.some(r=>x>=r[0]&&x<r[0]+r[2]&&y>=r[1]&&y<r[1]+r[3]))escaped++;}
     frames.push({game,phase,quality,time,count,escaped,alpha,hash:hash>>>0,leds:exported.leds,modulation:exported.modulation,sparks:exported.sparks,sweeps:exported.sweeps,emissions:exported.emissions});
    }
    const a=RelayProtocolLife.exportFrame(.12,{game,phase:'countdown',phaseTime:.12}),b=RelayProtocolLife.exportFrame(.12,{game,phase:'countdown',phaseTime:.12});if(a.image!==b.image)throw Error('Non-repeatable export');
    for(const o of [{effectsLevel:'off'},{reducedMotion:true}]){const e=RelayProtocolLife.exportFrame(.12,{game,phase:'countdown',...o});if(e.pixels||e.emissions.length)throw Error('Disabled export paints pixels');}
   }}finally{Math.random=originalRandom;}
   const stop=RelayProtocolLife.exportFrame(.12,{game:'bypass',phase:'active',stopAge:.12});
   const stopExpired=RelayProtocolLife.exportFrame(.5,{game:'bypass',phase:'active',stopAge:.5});
   const stopLow=RelayProtocolLife.exportFrame(.12,{game:'bypass',phase:'active',stopAge:.12,effectsLevel:'low'});
   return {definition,frames,stop:{sparks:stop.sparks,sweeps:stop.sweeps},stopExpired:{sparks:stopExpired.sparks,sweeps:stopExpired.sweeps},stopLow:{sparks:stopLow.sparks,sweeps:stopLow.sweeps},diagnostics:RelayProtocolLife.getDiagnostics()};
  });
  assert.equal(result.frames.length,126);assert.ok(result.frames.every(f=>f.escaped===0),'transparent protected regions');
  assert.deepEqual(result.stop,{sparks:1,sweeps:0},'a resolved bypass stop has one bounded contact spark');assert.deepEqual(result.stopExpired,{sparks:0,sweeps:0});assert.deepEqual(result.stopLow,{sparks:0,sweeps:0});
  for(const f of result.frames){assert.ok(f.count>0&&f.count<1200);assert.ok(f.emissions.length<=32);assert.ok(f.leds<=8);assert.ok(f.sparks<=1&&f.sweeps<=1);assert.ok(f.emissions.every(e=>e.bounds.every(Number.isInteger)&&e.opacity<=.75));if(f.phase==='active'||f.quality==='low'){assert.equal(f.sparks,0);assert.equal(f.sweeps,0);}if(f.quality==='low')assert.ok(f.leds<=4);}
  for(const game of games){const active=result.frames.filter(f=>f.game===game&&f.phase==='active'&&f.quality==='full');assert.ok(new Set(active.map(f=>f.hash)).size>=3,game+' hardware visibly changes');for(const low of result.frames.filter(f=>f.game===game&&f.quality==='low')){const full=result.frames.find(f=>f.game===game&&f.quality==='full'&&f.phase===low.phase&&f.time===low.time);assert.ok(low.count<full.count&&low.alpha<full.alpha,'low has fewer and dimmer pixels');}}
  assert.deepEqual(await state(page),beforeState);assert.deepEqual(result.diagnostics.devices,before.devices,'export does not advance live animation');assert.equal(result.diagnostics.exportCanvasCount,1);limits(result.diagnostics);
  options.records?.push({check:'exports',...result});
 },options)],
 ['all three live devices preserve protected DOM pixels, RNG and native input while LEDs run',async(browser,options={})=>{
  for(const game of games)await withGame(browser,async(page,capture)=>{
   await start(page,game);await page.waitForFunction(()=>RiskPresentation.protocol()?.phase==='active'&&RelayProtocolLife?.getDiagnostics().visibleDevice===RiskPresentation.currentScreen());
   const beforeState=await state(page);await page.evaluate(()=>{window.hardwareRandom=0;window.hardwareOldRandom=Math.random;Math.random=()=>{hardwareRandom++;return hardwareOldRandom();};});
   const samples=[];for(let i=0;i<8;i++){await page.waitForTimeout(130);const sample=await pixels(page);limits(sample.diagnostics);assert.equal(sample.protectedPaint,0,game+' effects do not touch DOM-derived protected areas');assert.equal(sample.pointer,'none');assert.ok(sample.painted>0);const device=sample.diagnostics.devices.find(d=>d.game===game);assert.equal(device.sparks,0);assert.equal(device.sweeps,0);assert.ok(device.leds>0&&device.leds<=8);samples.push(sample);}
   assert.ok(new Set(samples.map(s=>s.hash)).size>1,game+' LEDs vary in actual canvas pixels');assert.deepEqual(await state(page),beforeState);assert.equal(await page.evaluate(()=>{Math.random=hardwareOldRandom;return hardwareRandom;}),0);
   const first=samples[0].diagnostics.devices.find(d=>d.game===game),last=samples.at(-1).diagnostics.devices.find(d=>d.game===game);assert.ok(last.draws-first.draws<=Math.ceil((last.time-first.time)*24)+2,'live draw rate is capped');
   await capture(game+'-active-hardware');options.records?.push({check:'live',game,samples});
   if(game==='bypass'){
    await page.evaluate(()=>{bypassGauge=bypassTarget;});await page.keyboard.press('Space');
    const stop=await page.evaluate(async()=>{const begin=performance.now();let maxSparks=0,maxSweeps=0;while(performance.now()-begin<430){const d=RelayProtocolLife.getDiagnostics().devices.find(d=>d.game==='bypass');maxSparks=Math.max(maxSparks,d.sparks);maxSweeps=Math.max(maxSweeps,d.sweeps);await new Promise(requestAnimationFrame);}return {maxSparks,maxSweeps,stops:RiskPresentation.protocol().stops,end:RelayProtocolLife.getDiagnostics().devices.find(d=>d.game==='bypass').sparks};});
    assert.deepEqual(stop,{maxSparks:1,maxSweeps:0,stops:1,end:0});assert.equal((await pixels(page)).protectedPaint,0);options.records?.push({check:'trusted-stop-feedback',...stop});
   }
  },options);
 }],
 ['hidden, reduced, off and inactive views clear effects and disposal releases the single loop',async(browser,options={})=>withGame(browser,async(page,capture)=>{
  await start(page,'bypass');await page.waitForTimeout(160);assert.equal((await diag(page)).ownedRAF,1);
  for(const mode of ['reduced','off','hidden','system']){
   if(mode==='system')await page.emulateMedia({reducedMotion:'reduce'});
   else await page.evaluate(mode=>{if(mode==='hidden'){Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));}else RiskPresentation.setPreferences(mode==='off'?{effectsLevel:'off'}:{reducedMotion:true});},mode);
   await page.waitForTimeout(80);const a=await diag(page);await page.waitForTimeout(180);const b=await diag(page);assert.equal(b.ownedRAF,0);assert.equal(b.visibleDevice,null);assert.equal(b.frames,a.frames);assert.deepEqual(b.devices,a.devices);assert.ok(b.devices.every(d=>d.pixels===0&&d.emissions.length===0));assert.equal(await page.locator('.protocol-life-canvas:not([hidden])').count(),0);
   options.records?.push({check:'paused',mode,diagnostics:b});
   if(mode==='system')await page.emulateMedia({reducedMotion:'no-preference'});else await page.evaluate(mode=>{if(mode==='hidden'){delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));}else RiskPresentation.setPreferences({effectsLevel:'full',reducedMotion:false});},mode);
   await page.waitForTimeout(100);assert.equal((await diag(page)).ownedRAF,1);
  }
  await page.keyboard.press('Escape');await page.waitForTimeout(80);const off=await diag(page);assert.equal(off.visibleDevice,null);assert.equal(off.ownedRAF,0);assert.equal(off.canvasCount,3);assert.ok(off.devices.every(d=>d.pixels===0));
  await page.evaluate(()=>{RelayProtocolLife.exportFrame(.12,{game:'bypass',phase:'result'});RelayProtocolLife.dispose();RelayProtocolLife.dispose();});const disposed=await diag(page);assert.equal(disposed.disposed,true);assert.equal(disposed.canvasCount,0);assert.equal(disposed.ownedRAF,0);assert.equal(disposed.ownedTimers,0);assert.equal(await page.locator('.protocol-life-canvas').count(),0);options.records?.push({check:'disposed',diagnostics:disposed});
 },options)]
];
module.exports={hardwareCases};
if(require.main===module)(async()=>{
 const out=path.resolve(process.env.RISK_V2_HARDWARE_QA_DIR||path.join(__dirname,'..','dist','qa','hardware'));fs.mkdirSync(out,{recursive:true});
 const report={version:'1.3.1',passed:false,checks:[],captures:[],records:[]};const browser=await chromium.launch({executablePath:findChromium(),headless:true,args:['--allow-file-access-from-files']});
 try{for(const [name,run]of hardwareCases){await run(browser,{captureDir:out,captures:report.captures,records:report.records});report.checks.push(name);}report.passed=true;}catch(e){report.failure=e.stack;process.exitCode=1;}finally{await browser.close();fs.writeFileSync(path.join(out,'hardware-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,checks:report.checks,captures:report.captures.length,failure:report.failure},null,2));}
})();

const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const http=require('node:http'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const chrome=process.env.CHROMIUM_EXECUTABLE||[chromium.executablePath(),path.join(process.env.LOCALAPPDATA||'','ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-win64/chrome-headless-shell.exe')].find(p=>fs.existsSync(p));

test('registered lighting preserves artwork and shares the decorative lifecycle',{skip:!chrome,timeout:30000},async t=>{
 const server=http.createServer((req,res)=>{
  if(req.url==='/'){res.setHeader('Content-Type','text/html');res.end('<style>body{margin:0}canvas{width:420px;height:150px}</style><canvas id="relay-scene" data-relay-scene></canvas><script src="src/relay-lighting.js"></script><script src="src/relay-life.js"></script><script src="src/relay-pets.js"></script><script src="src/relay-scene.js"></script>');return;}
  const file=path.resolve(root,'.'+new URL(req.url,'http://x').pathname);if(!file.startsWith(root+path.sep)||!fs.existsSync(file))return res.writeHead(404).end();res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':'image/png');res.end(fs.readFileSync(file));
 });
 let browser;
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 // Close the client before waiting for the server. A surviving Chromium HTTP
 // connection must not keep the test's teardown hook pending indefinitely.
 t.after(async()=>{if(browser)await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));});
 browser=await chromium.launch({headless:true,executablePath:chrome});const page=await browser.newPage({viewport:{width:420,height:150}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>RelayLighting.getDiagnostics().ready&&RelayPets.getDiagnostics().ready&&RelayLife.getDiagnostics().ready);
 await page.evaluate(()=>{Math.random=()=>{throw Error('Lighting consumed gameplay randomness');};BlacksiteScene.setState({screen:'game',risk:20});BlacksiteScene.setCaptureTime(2);});await page.waitForTimeout(40);
 const inspect=()=>page.evaluate(()=>RelayLighting.getDiagnostics());
 const capture=async time=>{await page.evaluate(t=>BlacksiteScene.setCaptureTime(t),time);await page.waitForTimeout(25);return inspect();};

 await t.test('surface multiplication preserves exact black and caller canvas state',async()=>{
  const result=await page.evaluate(()=>{
   const canvas=window.lightingProbe=document.createElement('canvas');canvas.width=420;canvas.height=280;const c=canvas.getContext('2d',{willReadFrequently:true});c.fillStyle='#000';c.fillRect(0,0,420,280);c.setTransform(420/1536,0,0,280/1024,0,0);c.globalAlpha=.43;c.globalCompositeOperation='source-atop';c.imageSmoothingEnabled=true;
   const state=()=>({matrix:Array.from(c.getTransform().toFloat64Array()),alpha:c.globalAlpha,operation:c.globalCompositeOperation,smoothing:c.imageSmoothingEnabled});const before=state();RelayLighting.draw(c,2,{risk:.96,signal:{activity:1,brute:1},isStatic:true});const after=state(),black=c.getImageData(0,0,420,280).data;let litBlack=0;for(let i=0;i<black.length;i+=4)if(black[i]||black[i+1]||black[i+2])litBlack++;
   c.setTransform(1,0,0,1,0,0);c.globalAlpha=1;c.globalCompositeOperation='source-over';c.fillStyle='#203040';c.fillRect(0,0,420,280);c.setTransform(420/1536,0,0,280/1024,0,0);RelayLighting.draw(c,2,{risk:.2,isStatic:true});const rgb=Array.from(c.getImageData(195,105,1,1).data);return {before,after,litBlack,rgb};
  });assert.deepEqual(result.after,result.before);assert.equal(result.litBlack,0);assert.ok(result.rgb[1]>48||result.rgb[2]>64,'the CRT receiver changes albedo without adding gray to black');
 });

 await t.test('static exports are repeatable and risk/outcome fields are local',async()=>{
  const result=await page.evaluate(async()=>{
   const a=RelayLighting.exportMaps(2,{isStatic:true,risk:.2}),before=RelayLighting.getDiagnostics();const b=RelayLighting.exportMaps(99,{isStatic:true,risk:.2}),after=RelayLighting.getDiagnostics();
   const critical=RelayLighting.exportMaps(99,{isStatic:true,risk:.96});
   const read=async url=>{const image=new Image();image.src=url;await image.decode();const c=document.createElement('canvas');c.width=image.width;c.height=image.height;const ctx=c.getContext('2d');ctx.drawImage(image,0,0);return ctx.getImageData(0,0,c.width,c.height).data;};
   const calm=await read(a.irradiance),alarm=await read(critical.irradiance);let changed=0,outside=0;for(let y=0;y<280;y++)for(let x=0;x<420;x++){const k=(y*420+x)*4;if(calm[k]!==alarm[k]||calm[k+1]!==alarm[k+1]||calm[k+2]!==alarm[k+2]){changed++;if(x<340||y>120)outside++;}}
   const lower=await read(RelayLighting.exportMaps(2,{risk:.2,signal:{activity:.5,brute:1}}).irradiance),higher=await read(RelayLighting.exportMaps(2,{risk:.2,signal:{activity:1,brute:1}}).irradiance);const active=RelayLighting.getDiagnostics().levels;RelayLighting.exportMaps(2,{risk:.2,screen:'busted',signal:{power:.08}});const busted=RelayLighting.getDiagnostics().levels;
   const core=(155*420+195)*4;return {same:JSON.stringify(a)===JSON.stringify(b),buildDelta:after.mapBuilds-before.mapBuilds,size:[a.width,a.height],changed,outside,aboveOne:[lower[core],higher[core]],active,busted,definition:RelayLighting.getDefinition()};
  });assert.equal(result.same,true);assert.equal(result.buildDelta,0);assert.deepEqual(result.size,[420,280]);assert.ok(result.changed>0);assert.equal(result.outside,0);assert.ok(result.active.core>1);assert.ok(result.aboveOne[1]>result.aboveOne[0],'two core levels above one must still produce distinct irradiance');assert.ok(result.busted.core<.1);assert.ok(result.busted.west>.7,'practical lamps stay powered after electronics fail');assert.equal(result.definition.fields.length,8);
 });

 await t.test('24fps samples and four reusable view buffers bound allocations',async()=>{
  const first=await capture(6.1),next=await capture(6.11);assert.equal(next.mapBuilds,first.mapBuilds);
  const result=await page.evaluate(()=>{
   const probes=[];for(let i=0;i<6;i++){const canvas=document.createElement('canvas');canvas.width=420;canvas.height=150;const ctx=canvas.getContext('2d');ctx.fillStyle='#203040';ctx.fillRect(0,0,420,150);ctx.setTransform(420/1536,0,0,420/1536,0,-62.4);probes.push(ctx);RelayLighting.draw(ctx,6.1,{risk:.2});}
   let allocations=0;const create=document.createElement.bind(document);document.createElement=function(name,...args){if(String(name).toLowerCase()==='canvas')allocations++;return create(name,...args);};for(let i=0;i<80;i++){RelayLighting.draw(probes[0],30+i*.17,{risk:.94,signal:{activity:.8}});RelayLighting.draw(probes[5],30+i*.17,{risk:.94});}
   document.createElement=create;return {allocations,diagnostics:RelayLighting.getDiagnostics()};
  });assert.equal(result.allocations,0);assert.equal(result.diagnostics.viewBuffers,4);assert.equal(result.diagnostics.viewBufferLimit,4);assert.equal(result.diagnostics.mapCount,11);assert.equal(result.diagnostics.ownTimers,0);assert.equal(result.diagnostics.ownAnimationFrames,0);
 });

 await t.test('reduced motion, effects-off, protocols and hidden windows stop updates',async()=>{
  await page.evaluate(()=>BlacksiteScene.setCaptureTime(null));
  for(const mode of ['reduced','off','typing','backdoor','bypass']){
   await page.evaluate(mode=>BlacksiteScene.setState({screen:['reduced','off'].includes(mode)?'game':mode,reducedMotion:mode==='reduced',effectsLevel:mode==='off'?'off':'full'}),mode);await page.waitForTimeout(40);const before=await inspect();await page.waitForTimeout(100);const after=await inspect();assert.equal(after.draws,before.draws,mode);assert.equal(after.mapBuilds,before.mapBuilds,mode);
  }
  await page.evaluate(()=>{BlacksiteScene.setState({screen:'game',reducedMotion:false,effectsLevel:'full'});Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});await page.waitForTimeout(30);const before=await inspect();await page.waitForTimeout(100);assert.equal((await inspect()).draws,before.draws);
 });

 await t.test('scene disposal releases all lightmaps and scratch buffers',async()=>{
  await page.evaluate(()=>BlacksiteScene.dispose());const d=await inspect();assert.equal(d.disposed,true);assert.equal(d.ready,false);assert.equal(d.mapCount,0);assert.equal(d.viewBuffers,0);assert.equal(await page.evaluate(()=>RelayLighting.exportMaps()),null);await page.evaluate(()=>{RelayLighting.dispose();RelayLighting.draw(lightingProbe.getContext('2d'),1000,{});});assert.equal((await inspect()).draws,d.draws);assert.deepEqual(errors,[]);
 });
});

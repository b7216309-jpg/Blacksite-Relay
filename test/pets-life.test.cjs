const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const http=require('node:http'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const chrome=process.env.CHROMIUM_EXECUTABLE||[chromium.executablePath(),path.join(process.env.LOCALAPPDATA||'','ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-win64/chrome-headless-shell.exe')].find(p=>fs.existsSync(p));

test('room pets stay grounded, bounded and independent of gameplay', {skip:!chrome,timeout:30000},async t=>{
 const server=http.createServer((req,res)=>{
  if(req.url==='/'){res.setHeader('Content-Type','text/html');res.end('<style>body{margin:0}canvas{width:420px;height:150px}</style><canvas id="relay-scene" data-relay-scene></canvas><script src="src/relay-life.js"></script><script src="src/relay-pets.js"></script><script src="src/relay-scene.js"></script>');return;}
  const file=path.resolve(root,'.'+new URL(req.url,'http://x').pathname);
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.writeHead(404).end();return;}
  res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':'image/png');res.end(fs.readFileSync(file));
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));
 const browser=await chromium.launch({executablePath:chrome,headless:true});t.after(()=>browser.close());
 const page=await browser.newPage({viewport:{width:420,height:150}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',route=>route.request().url().startsWith('http://127.0.0.1:')?route.continue():route.abort());
 await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>RelayPets.getDiagnostics().ready&&RelayLife.getDiagnostics().ready&&BlacksiteScene.getDiagnostics().artLoaded);
 await page.evaluate(()=>{Math.random=()=>{throw Error('Pets consumed gameplay randomness');};BlacksiteScene.setState({screen:'game',risk:20});BlacksiteScene.setCaptureTime(2);});await page.waitForTimeout(50);
 const inspect=()=>page.evaluate(()=>RelayPets.getDiagnostics());
 const capture=async time=>{await page.evaluate(t=>BlacksiteScene.setCaptureTime(t),time);await page.waitForTimeout(25);return inspect();};
 const counts=d=>Object.fromEntries(Object.entries(d.textures).map(([id,tx])=>[id,tx.generatedFrames]));

 await t.test('all four animals fit their authored floor or roof routes',async()=>{
  const metadata=JSON.parse(fs.readFileSync(path.join(root,'assets/scene/relay-pets.json'),'utf8'));
  for(const time of [0,5,6.5,8.3,17.7,19.5,22.3,29.9,34.5,55,82.9,125]){
   const d=await capture(time);assert.equal(d.residents.length,4);assert.equal(d.residentLimit,4);assert.equal(d.error,false);assert.equal(d.ratLimit,2);assert.equal(d.ratCount,2);assert.equal(d.residents.filter(p=>p.kind==='rat').length,2);
   assert.equal(new Set(d.residents.map(p=>p.id)).size,4);
   for(const animal of d.residents){
    const spec=metadata.residents.find(p=>p.id===animal.id);assert.ok(spec);
    if(spec.foot){assert.deepEqual([animal.x,animal.y],spec.foot);}
    else {for(const [axis,i]of [['x',0],['y',1]])assert.ok(animal[axis]>=Math.min(...spec.route.map(p=>p[i]))-.001&&animal[axis]<=Math.max(...spec.route.map(p=>p[i]))+.001,animal.id+' remains on its visible support');}
    assert.ok(animal.y<777,'feet stay inside the native gameplay camera');
   }
  }
  const d=await inspect();for(const [kind,spec]of Object.entries(metadata.designs))assert.deepEqual(d.textures[kind].pixelSize,spec.canvas);
 });

 await t.test('the smaller snail always faces left with a fixed foot and crisp native pixels',async()=>{
  const metadata=JSON.parse(fs.readFileSync(path.join(root,'assets/scene/relay-pets.json'),'utf8')),spec=metadata.residents.find(p=>p.id==='coil-snail');assert.equal(metadata.ratLimit,2);assert.equal(metadata.designs.snail.renderScale,.65);
  for(const time of [0,2,12,34.4,34.6,55,76,83,125,8300]){
   const d=await capture(time),snail=d.residents.find(p=>p.id==='coil-snail');assert.equal(snail.facing,-1);assert.equal(snail.moving,false);assert.deepEqual([snail.x,snail.y],spec.foot);assert.equal(d.textures.snail.renderScale,.65);
  }
  const result=await page.evaluate(()=>{
   const canvas=document.createElement('canvas');canvas.width=420;canvas.height=280;const c=canvas.getContext('2d',{willReadFrequently:true});c.setTransform(420/1536,0,0,420/1536,0,0);RelayPets.draw(c,2,{isStatic:true});const p=c.getImageData(318,90,26,22).data;let left=26,right=-1,top=22,bottom=-1,partialColor=0;
   for(let y=0;y<22;y++)for(let x=0;x<26;x++){const k=(y*26+x)*4;if(!p[k+3])continue;if(p[k]+p[k+1]+p[k+2]>30){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);if(p[k+3]!==255)partialColor++;}}
   const frame=t=>{c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,420,280);c.setTransform(420/1536,0,0,420/1536,0,0);RelayPets.draw(c,t,{});return c.getImageData(318,90,26,22).data;};
   const rest=frame(0),held=frame(2),reach=frame(4.8),returned=frame(5.8),changed=[];for(let y=0;y<22;y++)for(let x=0;x<26;x++){const i=(y*26+x)*4;if([0,1,2,3].some(k=>rest[i+k]!==reach[i+k]))changed.push([x+318,y+90]);}
   return {width:right-left+1,height:bottom-top+1,partialColor,held:Array.from(rest).every((v,i)=>v===held[i]),returned:Array.from(rest).every((v,i)=>v===returned[i]),changed};
  });assert.ok(result.width>=9&&result.width<=12);assert.ok(result.height>=6&&result.height<=9);assert.equal(result.partialColor,0,'snail pixels stay hard-edged instead of acquiring a scaled alpha fringe');assert.equal(result.held,true);assert.equal(result.returned,true);assert.ok(result.changed.length>0,'the brief feeler reach remains visible at native size');assert.ok(result.changed.every(([x,y])=>x<=326&&y<=100),'only the outer feeler moves; shell and foot pixels stay exact');
 });

 await t.test('rats reverse while stopped and without moving their foot anchor',async()=>{
  for(const [id,a,b]of [['cable-rat',17.59,17.61],['cable-rat',29.79,29.81],['rack-rat',4.69,4.71],['rack-rat',16.89,16.91]]){
   const before=(await capture(a)).residents.find(p=>p.id===id),after=(await capture(b)).residents.find(p=>p.id===id);
   assert.equal(before.moving,false);assert.equal(after.moving,false);assert.deepEqual([before.x,before.y],[after.x,after.y]);assert.notEqual(before.facing,after.facing);
  }
 });

 await t.test('same12fps frame reuses cached art and extended drawing allocates no new canvases',async()=>{
  const before=await capture(6.1);await capture(6.11);const after=await inspect();assert.deepEqual(counts(after),counts(before),'subframe redraw must reuse the existing pet frames');
  await page.evaluate(()=>{window.petCanvasAllocations=0;const create=document.createElement.bind(document);document.createElement=function(name,...args){if(String(name).toLowerCase()==='canvas')window.petCanvasAllocations++;return create(name,...args);};});
  for(let i=0;i<32;i++)await capture(90+i*3.3);
  assert.equal(await page.evaluate(()=>window.petCanvasAllocations),0,'four resident caches must be reused instead of growing with time');
  const d=await inspect();assert.equal(d.residents.length,4);assert.equal(d.ownTimers,0);assert.equal(d.ownAnimationFrames,0);
 });

 await t.test('reduced motion, effects-off, protocols and hidden windows freeze all residents',async()=>{
  await page.evaluate(()=>BlacksiteScene.setCaptureTime(null));
  for(const mode of ['reduced','off','typing','backdoor','bypass']){
   await page.evaluate(mode=>BlacksiteScene.setState({screen:['reduced','off'].includes(mode)?'game':mode,reducedMotion:mode==='reduced',effectsLevel:mode==='off'?'off':'full'}),mode);await page.waitForTimeout(40);
   const before=await inspect();await page.waitForTimeout(100);const after=await inspect();assert.equal(after.draws,before.draws,mode);assert.deepEqual(after.residents,before.residents,mode);assert.deepEqual(counts(after),counts(before),mode);
  }
  await page.evaluate(()=>{BlacksiteScene.setState({screen:'game',reducedMotion:false,effectsLevel:'full'});Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});await page.waitForTimeout(30);
  const hidden=await inspect();await page.waitForTimeout(100);assert.equal((await inspect()).draws,hidden.draws);
 });

 await t.test('scene disposal releases every pet image and cached frame',async()=>{
  await page.evaluate(()=>BlacksiteScene.dispose());const d=await inspect();assert.equal(d.disposed,true);assert.equal(d.ready,false);assert.deepEqual(d.residents,[]);
  assert.deepEqual(await page.evaluate(()=>['rat','cat','snail'].map(id=>RelayPets.exportFrame(id))),[null,null,null]);
  await page.evaluate(()=>{RelayPets.dispose();RelayPets.draw(document.getElementById('relay-scene').getContext('2d'),1000,{});});assert.equal((await inspect()).draws,d.draws);assert.deepEqual(errors,[]);
 });
});

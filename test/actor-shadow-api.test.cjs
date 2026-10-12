const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const http=require('node:http'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const chrome=process.env.CHROMIUM_EXECUTABLE||[chromium.executablePath(),path.join(process.env.LOCALAPPDATA||'','ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-win64/chrome-headless-shell.exe')].find(p=>fs.existsSync(p));

test('actor shadow queries reuse current silhouettes without displaying or advancing actors',{skip:!chrome,timeout:30000},async t=>{
 const server=http.createServer((req,res)=>{
  if(req.url==='/'){res.setHeader('Content-Type','text/html');res.end('<script src="src/relay-life.js"></script><script src="src/relay-pets.js"></script>');return;}
  const file=path.resolve(root,'.'+new URL(req.url,'http://x').pathname);if(!file.startsWith(root+path.sep)||!fs.existsSync(file))return res.writeHead(404).end();res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':'image/png');res.end(fs.readFileSync(file));
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));
 const browser=await chromium.launch({headless:true,executablePath:chrome});t.after(()=>browser.close());const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>RelayLife.getDiagnostics().ready&&RelayPets.getDiagnostics().ready);await page.evaluate(()=>{Math.random=()=>{throw Error('Shadow query consumed gameplay randomness');};});

 await t.test('five correctly registered descriptors leave the displayed actor state untouched',async()=>{
  const r=await page.evaluate(()=>{
   const observed=()=>{const life=RelayLife.getDiagnostics(),pets=RelayPets.getDiagnostics();return {life:{draws:life.draws,time:life.time,pose:life.pose,screen:life.screen},pets:{draws:pets.draws,time:pets.time,residents:pets.residents,screen:pets.screen}};};
   const before=observed(),casters=[...RelayLife.getShadowCasters(18.5,{signal:{activity:1}}),...RelayPets.getShadowCasters(18.5)],after=observed();
   const shape=c=>({id:c.id,kind:c.kind,pivot:c.pivot,foot:c.foot,facing:c.facing,nativeSize:c.nativeSize,actualSize:[c.frame.width,c.frame.height],frozen:Object.isFrozen(c)&&Object.isFrozen(c.foot)&&Object.isFrozen(c.pivot),opaquePixels:Array.from(c.frame.getContext('2d').getImageData(0,0,c.frame.width,c.frame.height).data).filter((v,i)=>i%4===3&&v>0).length});
   const result=casters.map(shape);try{casters[0].foot[0]=0;}catch{}return {before,after,casters:result,protectedFoot:RelayLife.getShadowCasters(18.5)[0].foot};
  });assert.deepEqual(r.after,r.before);assert.equal(r.casters.length,5);assert.equal(r.casters.filter(c=>c.kind==='rat').length,2);
  for(const c of r.casters){assert.deepEqual(c.actualSize,c.nativeSize);assert.equal(c.frozen,true);assert.ok(c.opaquePixels>0);}
  const operator=r.casters.find(c=>c.kind==='operator');assert.equal(operator.id,'relay-operator');assert.deepEqual(operator.nativeSize,[36,72]);assert.deepEqual(operator.pivot,[16,64]);assert.deepEqual(operator.foot,[574,707]);assert.deepEqual(r.protectedFoot,[574,707]);
  const snail=r.casters.find(c=>c.kind==='snail');assert.deepEqual(snail.nativeSize,[14,12]);assert.deepEqual(snail.pivot,[7,9]);assert.deepEqual(snail.foot,[1206,389]);assert.equal(snail.facing,-1);
 });

 await t.test('queries and drawing share bounded frame caches and static silhouettes',async()=>{
  const r=await page.evaluate(()=>{
   const get=(t,o={})=>[...RelayLife.getShadowCasters(t,o),...RelayPets.getShadowCasters(t,o)];
   const a=get(6.1),before=[RelayLife.getDiagnostics().generatedFrames,Object.fromEntries(Object.entries(RelayPets.getDiagnostics().textures).map(([id,v])=>[id,v.generatedFrames]))],b=get(6.11),after=[RelayLife.getDiagnostics().generatedFrames,Object.fromEntries(Object.entries(RelayPets.getDiagnostics().textures).map(([id,v])=>[id,v.generatedFrames]))];
   const same=a.every((c,i)=>c.frame===b[i].frame),hash=c=>{const p=c.frame.getContext('2d').getImageData(0,0,c.frame.width,c.frame.height).data;let h=2166136261;for(const v of p)h=Math.imul(h^v,16777619);return h>>>0;};
   const first=get(1,{isStatic:true}).map(c=>({id:c.id,foot:c.foot,facing:c.facing,hash:hash(c)})),last=get(999,{isStatic:true}).map(c=>({id:c.id,foot:c.foot,facing:c.facing,hash:hash(c)}));
   let allocations=0;const create=document.createElement.bind(document);document.createElement=function(name,...args){if(String(name).toLowerCase()==='canvas')allocations++;return create(name,...args);};for(let i=0;i<80;i++)get(i*17.1);document.createElement=create;
   const life=RelayLife.getDiagnostics(),pets=RelayPets.getDiagnostics();return {before,after,same,first,last,allocations,draws:[life.draws,pets.draws],time:[life.time,pets.time],ratCaches:pets.textures.rat.cachedFrames};
  });assert.deepEqual(r.after,r.before);assert.equal(r.same,true);assert.deepEqual(r.first,r.last);assert.equal(r.allocations,0);assert.deepEqual(r.draws,[0,0]);assert.deepEqual(r.time,[0,0]);assert.equal(r.ratCaches,2);
 });

 await t.test('actors suppress only their old contact shapes when the shared shadow pass exists',async()=>{
  const r=await page.evaluate(()=>{
   const canvas=document.createElement('canvas');canvas.width=420;canvas.height=280;const ctx=canvas.getContext('2d',{willReadFrequently:true});
   const render=shared=>{if(shared)window.RelayShadows={};else delete window.RelayShadows;ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,420,280);ctx.setTransform(420/1536,0,0,420/1536,0,0);RelayPets.draw(ctx,2,{isStatic:true});RelayLife.draw(ctx,2,{isStatic:true});return ctx.getImageData(0,0,420,280).data;};
   const legacy=render(false),shared=render(true);delete window.RelayShadows;let removed=0,changedOpaque=0,added=0;for(let i=0;i<legacy.length;i+=4){if(legacy[i+3]>shared[i+3])removed++;if(legacy[i+3]<shared[i+3])added++;if(shared[i+3]===255&&[0,1,2,3].some(k=>legacy[i+k]!==shared[i+k]))changedOpaque++;}
   return {removed,added,changedOpaque};
  });assert.ok(r.removed>0,'legacy contact-only pixels disappear');assert.equal(r.added,0);assert.equal(r.changedOpaque,0,'actor artwork stays identical when the global shadow pass takes over');
 });

 await t.test('disposed actors expose no retained shadow canvases',async()=>{
  const r=await page.evaluate(()=>{RelayLife.dispose();RelayPets.dispose();return {life:RelayLife.getShadowCasters(100),pets:RelayPets.getShadowCasters(100)};});assert.deepEqual(r,{life:[],pets:[]});assert.deepEqual(errors,[]);
 });
});

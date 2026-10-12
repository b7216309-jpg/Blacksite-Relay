const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright'),repo=path.resolve(__dirname,'..');
const chrome=process.env.CHROMIUM_EXECUTABLE||[chromium.executablePath(),path.join(process.env.LOCALAPPDATA||'','ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-win64/chrome-headless-shell.exe')].find(p=>fs.existsSync(p));
test('pet discoveries preserve grounded actors and deterministic shared frames',{skip:!chrome,timeout:30000},async t=>{
 const server=http.createServer((req,res)=>{
  if(req.url==='/'){res.setHeader('Content-Type','text/html');return res.end('<script>window.secretState={};window.RelayEasterEggs={getSceneState:()=>secretState};</script><script src="src/relay-pet-secrets.js"></script><script src="src/relay-pets.js"></script>');}
  const f=path.resolve(repo,'.'+new URL(req.url,'http://x').pathname);if(!f.startsWith(repo+path.sep)||!fs.existsSync(f))return res.writeHead(404).end();res.setHeader('Content-Type',f.endsWith('.js')?'text/javascript':'image/png');res.end(fs.readFileSync(f));
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
  browser=await chromium.launch({headless:true,executablePath:chrome});const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>RelayPets.getDiagnostics().ready&&Object.values(RelayPetSecrets.getDiagnostics().props).every(p=>p.ready));
  await page.evaluate(()=>{window.origins=RelayPets.getResidentPositions(2);window.actorCanvas=document.createElement('canvas');actorCanvas.width=420;actorCanvas.height=280;window.actorCtx=actorCanvas.getContext('2d',{willReadFrequently:true});window.RelayShadows={};Math.random=()=>{throw Error('Pet secret consumed gameplay randomness');};window.pixels=id=>{const c=RelayPets.getShadowCasters(2,{isStatic:true}).find(p=>p.id===id);return Array.from(c.frame.getContext('2d').getImageData(0,0,...c.nativeSize).data);};});
  await t.test('original separated props decode with no magenta matte or owned clock',async()=>{
   const r=await page.evaluate(()=>{secretState={ratUnion:{active:true,elapsed:6,origins}};actorCtx.setTransform(420/1536,0,0,420/1536,0,0);RelayPetSecrets.drawProps(actorCtx,8,{});const a=actorCtx.getImageData(0,0,420,280).data;let solid=0,magenta=0;for(let i=0;i<a.length;i+=4)if(a[i+3]){solid++;if(a[i]>a[i+1]+12&&a[i+2]>a[i+1]+12)magenta++;}return {solid,magenta,d:RelayPetSecrets.getDiagnostics()};});
   assert.ok(r.solid>200);assert.equal(r.magenta,0);assert.equal(r.d.ownTimers,0);assert.equal(r.d.ownAnimationFrames,0);assert.equal(Object.keys(r.d.props).length,4);assert.deepEqual(r.d.props.placard.crop,[146,122,750,976]);assert.deepEqual(r.d.props.pouch.crop,[83,345,638,495]);
  });
  await t.test('two rats walk continuously from captured feet and return to the live route',async()=>{
   const r=await page.evaluate(()=>{let previous,maxStep=0;const frames=[];for(let i=0;i<=168;i++){const e=i/12;secretState={ratUnion:{active:true,elapsed:e,origins}};const p=RelayPets.getResidentPositions(2+e).filter(p=>p.kind==='rat');if(previous)p.forEach((v,j)=>maxStep=Math.max(maxStep,Math.hypot(v.x-previous[j].x,v.y-previous[j].y)));previous=p;frames.push(p);}secretState={};return {maxStep,frames,ambient:RelayPets.getResidentPositions(16).filter(p=>p.kind==='rat'),origins:origins.filter(p=>p.kind==='rat')};});
   assert.ok(r.maxStep<18,'no foot teleport between 12fps frames');const floor=[[229,701],[482,641],[609,695],[723,737],[874,702],[1091,654],[1368,721],[1401,859],[1123,880],[930,803],[750,833],[547,938],[274,844]];
   const inside=p=>{let yes=false;for(let i=0,j=floor.length-1;i<floor.length;j=i++){const a=floor[i],b=floor[j];if((a[1]>p.y)!==(b[1]>p.y)&&p.x<(b[0]-a[0])*(p.y-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;};
   for(const row of r.frames){assert.equal(row.length,2);for(const p of row){assert.ok(inside(p),`${p.id} stays on the front service floor`);assert.ok(p.y<777);}}
   assert.deepEqual(r.frames[0].map(p=>[p.x,p.y]),r.origins.map(p=>[p.x,p.y]));assert.deepEqual(r.frames.at(-1).map(p=>[p.x,p.y]),r.ambient.map(p=>[p.x,p.y]));assert.deepEqual(r.frames[72].map(p=>[p.x,p.y,p.facing]),[[722,750,1],[806,748,-1]]);
  });
  await t.test('shadow queries and visible frames use exactly the same secret positions',async()=>{
   const r=await page.evaluate(()=>{const before=RelayPets.getDiagnostics(),rows=[];for(const [key,e]of [['ratUnion',2],['ratUnion',6],['ratUnion',12],['rootAccess',2],['snailMail',2]]){secretState={[key]:{active:true,elapsed:e,origins}};const cast=RelayPets.getShadowCasters(2+e);const query=RelayPets.getResidentPositions(2+e);rows.push({cast:cast.map(p=>({id:p.id,foot:p.foot,facing:p.facing,size:p.nativeSize})),query});}const after=RelayPets.getDiagnostics();return {before:{draws:before.draws,time:before.time,residents:before.residents},after:{draws:after.draws,time:after.time,residents:after.residents},rows};});
   assert.deepEqual(r.after,r.before);for(const row of r.rows)for(const caster of row.cast){const p=row.query.find(v=>v.id===caster.id);assert.deepEqual(caster.foot,[p.x,p.y]);assert.equal(caster.facing,p.facing);assert.deepEqual(caster.size,p.nativeSize);}
  });
  await t.test('cat tail connector moves only a few lower pixels, preserving body and paws',async()=>{
   const r=await page.evaluate(()=>{secretState={};const before=pixels('server-cat');secretState={rootAccess:{active:true,elapsed:2,isStatic:true}};const during=pixels('server-cat');secretState={rootAccess:{active:true,elapsed:4,isStatic:true}};const after=pixels('server-cat');const changed=[];for(let i=0;i<before.length;i+=4)if([0,1,2,3].some(c=>before[i+c]!==during[i+c]))changed.push([(i/4)%28,Math.floor(i/4/28)]);return {changed,returned:before.every((v,i)=>v===after[i])};});
   assert.ok(r.changed.length>0&&r.changed.length<15);assert.ok(r.changed.every(([x,y])=>x>=10&&x<=16&&y>=15&&y<=20));assert.equal(r.returned,true);
  });
  await t.test('small left-facing snail retains its face and foot while the courier kit opens',async()=>{
   const r=await page.evaluate(()=>{secretState={};const before=pixels('coil-snail'),frames=[];for(const e of [.3,.9,2,4.5,5.8,6]){secretState={snailMail:{active:true,elapsed:e,isStatic:true}};const current=pixels('coil-snail'),changed=[];for(let i=0;i<before.length;i+=4)if([0,1,2,3].some(c=>before[i+c]!==current[i+c]))changed.push([(i/4)%14,Math.floor(i/4/14)]);frames.push({e,changed,descriptor:RelayPets.getResidentPositions(2,{isStatic:true}).find(p=>p.kind==='snail')});}return frames;});
   assert.ok(r.find(p=>p.e===2).changed.length>5);for(const p of r){assert.deepEqual(p.descriptor.nativeSize,[14,12]);assert.equal(p.descriptor.facing,-1);assert.deepEqual([p.descriptor.x,p.descriptor.y],[1206,389]);assert.ok(p.changed.every(([x,y])=>x<9&&y<9),'shell attachment stays above the foot and behind the face');}assert.deepEqual(r.at(-1).changed,[]);
  });
  await t.test('shared subframes reuse caches and static reveals stay byte-identical',async()=>{
   const r=await page.evaluate(()=>{secretState={ratUnion:{active:true,elapsed:6,origins}};const a=RelayPets.getShadowCasters(8.01),first=RelayPets.getDiagnostics().textures,b=RelayPets.getShadowCasters(8.02),second=RelayPets.getDiagnostics().textures;const bytes=()=>RelayPets.getShadowCasters(300,{isStatic:true}).map(p=>Array.from(p.frame.getContext('2d').getImageData(0,0,...p.nativeSize).data));const x=bytes(),y=bytes();let allocations=0;const create=document.createElement.bind(document);document.createElement=function(n,...args){if(n==='canvas')allocations++;return create(n,...args);};for(let i=0;i<60;i++){secretState={ratUnion:{active:true,elapsed:i/5,origins}};RelayPets.getShadowCasters(20+i/5);}document.createElement=create;return {first,second,same:a.every((p,i)=>p.frame===b[i].frame),staticSame:JSON.stringify(x)===JSON.stringify(y),allocations,cache:RelayPets.getDiagnostics().textures};});
   assert.equal(r.same,true);assert.deepEqual(r.first,r.second);assert.equal(r.staticSame,true);assert.equal(r.allocations,0);assert.equal(r.cache.rat.cachedFrames,2);assert.equal(r.cache.cat.cachedFrames,1);assert.equal(r.cache.snail.cachedFrames,1);
  });
  await t.test('gesture threshold pixels are deterministic regardless of query order within one12fps bucket',async()=>{
   const rows=await page.evaluate(()=>[['rootAccess','server-cat',.79,.81],['snailMail','coil-snail',1.26,1.31]].map(([key,id,a,b])=>{
    secretState={};pixels(id);secretState={[key]:{active:true,elapsed:a,isStatic:true}};const first=pixels(id);
    secretState={};pixels(id);secretState={[key]:{active:true,elapsed:b,isStatic:true}};const second=pixels(id);
    return {key,equal:first.every((v,i)=>v===second[i])};
   }));for(const row of rows)assert.equal(row.equal,true,row.key+' shares one stable authored pose');
  });
  await t.test('disposal releases both prop sheets and all resident frames without late redraws',async()=>{
   const r=await page.evaluate(()=>{RelayPets.dispose();const a=RelayPetSecrets.getDiagnostics();RelayPets.dispose();RelayPetSecrets.drawProps(actorCtx,999,{});return {a,positions:RelayPets.getResidentPositions(999),casters:RelayPets.getShadowCasters(999)};});assert.equal(r.a.disposed,true);assert.ok(Object.values(r.a.props).every(p=>!p.ready));assert.deepEqual(r.positions,[]);assert.deepEqual(r.casters,[]);assert.deepEqual(errors,[]);
  });
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
});

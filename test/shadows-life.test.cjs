const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const chrome=process.env.CHROMIUM_EXECUTABLE||[chromium.executablePath(),path.join(process.env.LOCALAPPDATA||'','ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-win64/chrome-headless-shell.exe')].find(p=>fs.existsSync(p));
const out=process.env.RISK_SHADOW_QA_DIR;
if(out)fs.mkdirSync(out,{recursive:true});

test('resident shadows ground current poses without changing gameplay',{skip:!chrome,timeout:90000},async t=>{
 const browser=await chromium.launch({executablePath:chrome,headless:true,args:['--allow-file-access-from-files']});
 const errors=[],captures=[];
 t.after(async()=>{await browser.close();if(out)fs.writeFileSync(path.join(out,'phase-report.json'),JSON.stringify({captures,errors},null,2));});
 async function make(){
  const context=await browser.newContext({viewport:{width:420,height:650}});await context.route(/^https?:/,r=>r.abort());
  await context.addInitScript(()=>{
   Date.now=()=>1700000000000;
   window.electronAPI={loadGame:async()=>({playerName:'SHADOW_QA',tutorialSeen:true,musicVolume:0,sfxVolume:0,presentation:{introSeen:true,effectsLevel:'full',reducedMotion:false}}),saveGame:async()=>true,getLeaderboard:async()=>JSON.stringify({scope:'local',metric:'best-bank-balance',limit:10,entries:[]}),submitScore:async()=>'OK',closeApp:()=>{}};
   window.shadowCanvasAllocations=0;const create=document.createElement.bind(document);document.createElement=(tag,...args)=>{if(tag==='canvas')shadowCanvasAllocations++;return create(tag,...args);};
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(pathToFileURL(path.join(root,'index.html')).href);
  await page.waitForFunction(()=>!window.RiskSaveLoading&&RiskPresentation?.snapshot().playerName==='SHADOW_QA'&&RelayLife?.getDiagnostics().ready&&RelayPets?.getDiagnostics().ready&&RelayShadows?.getDiagnostics().ready);
  await page.evaluate(()=>{Object.values(achievements).forEach(a=>a.unlocked=true);showPersistentUpgrades();startGame();money=5000;risk=24;updateUI();window.shadowRolls=0;Math.random=()=>{shadowRolls++;return .99999;};window.actualShadows=RelayShadows;});
  await at(page,2);return {page,close:()=>context.close()};
 }
 async function at(page,time){const before=await page.evaluate(()=>BlacksiteScene.getDiagnostics().frames);await page.evaluate(time=>BlacksiteScene.setCaptureTime(time),time);await page.waitForFunction(n=>BlacksiteScene.getDiagnostics().frames>n,before);}
 const stats=page=>page.evaluate(()=>({scene:BlacksiteScene.getDiagnostics(),shadows:RelayShadows.getDiagnostics(),pets:RelayPets.getDiagnostics(),lighting:RelayLighting.getDiagnostics(),allocations:shadowCanvasAllocations}));
 const state=page=>page.evaluate(()=>JSON.parse(JSON.stringify({money,totalMoney,risk,multiplier,nodesHacked,nodesValidated,bypassCharge,sessionHackCount,ghostShieldActive,insuranceTurns,overclockBonusTurns,sessionStats,achievementStats,screen:RiskPresentation.currentScreen(),rolls:shadowRolls})));
 async function record(page,name){
  captures.push({name,...await stats(page)});if(!out)return;
  await page.evaluate(()=>document.getAnimations().filter(a=>a.animationName==='panelIn').forEach(a=>a.finish()));
  await page.screenshot({path:path.join(out,name+'-native.png')});
  const frame=await page.evaluate(()=>RelayShadows.exportFrame(BlacksiteScene.getDiagnostics().captureTime??2,{isStatic:true}));
  if(frame)fs.writeFileSync(path.join(out,name+'-static-alpha.png'),Buffer.from(frame.image.split(',')[1],'base64'));
 }

 await t.test('native alpha is soft black, receiver-clipped and darkens only the scene',async()=>{
  const h=await make(),page=h.page;
  const alpha=await page.evaluate(async()=>{
   const result=RelayShadows.exportFrame(2),img=new Image();img.src=result.image;await img.decode();
   const c=document.createElement('canvas');c.width=result.width;c.height=result.height;const x=c.getContext('2d');x.drawImage(img,0,0);const data=x.getImageData(0,0,c.width,c.height).data,def=RelayShadows.getDefinition();
   const inside=(x,y,p)=>{let hit=false;for(let i=0,j=p.length-1;i<p.length;j=i++){const a=p[i],b=p[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])hit=!hit;}return hit;};
   let pixels=0,escaped=0,colored=0,maxAlpha=0;const levels=new Set();
   for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){const i=(y*c.width+x)*4;if(!data[i+3])continue;pixels++;maxAlpha=Math.max(maxAlpha,data[i+3]);levels.add(data[i+3]);if(data[i]||data[i+1]||data[i+2])colored++;if(!Object.values(def.receivers).some(p=>inside((x+.5)*1536/420,(y+.5)*1024/280,p)))escaped++;}
   x.setTransform(.5,0,0,.5,11,17);x.globalAlpha=.31;x.globalCompositeOperation='source-atop';x.imageSmoothingEnabled=true;
   const state=()=>({matrix:Array.from(x.getTransform().toFloat64Array()),alpha:x.globalAlpha,mode:x.globalCompositeOperation,smooth:x.imageSmoothingEnabled});const before=state();RelayShadows.draw(x,2);return {width:c.width,height:c.height,pixels,escaped,colored,maxAlpha,levels:levels.size,before,after:state()};
  });
  assert.equal(alpha.width,420);assert.equal(alpha.height,280);assert.ok(alpha.pixels>100&&alpha.pixels<4000,JSON.stringify(alpha));assert.equal(alpha.escaped,0);assert.equal(alpha.colored,0);assert.ok(alpha.maxAlpha<230&&alpha.levels>10);assert.deepEqual(alpha.before,alpha.after);
  await page.evaluate(()=>{window.RelayShadows={...actualShadows,draw(){}};});await at(page,2);
  await page.evaluate(()=>{window.shadowBefore=document.getElementById('relay-scene').getContext('2d').getImageData(0,0,420,150).data;window.RelayShadows=actualShadows;});await at(page,2);
  const delta=await page.evaluate(()=>{const after=document.getElementById('relay-scene').getContext('2d').getImageData(0,0,420,150).data;let dark=0,bright=0,maxChange=0;for(let i=0;i<after.length;i+=4){let difference=0;for(let k=0;k<3;k++)difference+=after[i+k]-shadowBefore[i+k];if(difference<0){dark++;maxChange=Math.max(maxChange,-difference);}if(difference>3)bright++;}return {dark,bright,maxChange};});
  assert.ok(delta.dark>80,JSON.stringify(delta));assert.equal(delta.bright,0);assert.ok(delta.maxChange>8);await record(page,'registered-shadow');await h.close();
 });

 await t.test('moving residents retain visible contact and shadows point away from local lights',async()=>{
  const h=await make(),page=h.page,positions=[];
  for(const time of [2,6,13,21,29,45]){
   const result=await page.evaluate(async time=>{
    const frame=RelayShadows.exportFrame(time),img=new Image();img.src=frame.image;await img.decode();const c=document.createElement('canvas');c.width=420;c.height=280;const x=c.getContext('2d');x.drawImage(img,0,0);const data=x.getImageData(0,0,420,280).data;
    const d=RelayShadows.getDiagnostics(),def=RelayShadows.getDefinition();return d.casters.map(a=>{const light=def.profiles[a.kind].light,tip=[a.tip[0]-a.nativeFoot[0],a.tip[1]-a.nativeFoot[1]],away=[a.foot[0]-light[0],a.foot[1]-light[1]];let nearby=0;for(let y=a.nativeFoot[1]-4;y<=a.nativeFoot[1]+4;y++)for(let z=a.nativeFoot[0]-9;z<=a.nativeFoot[0]+9;z++)if(y>=0&&y<280&&z>=0&&z<420&&data[(y*420+z)*4+3]>20)nearby++;return {...a,nearby,awayDot:tip[0]*away[0]+tip[1]*away[1]};});
   },time);
   assert.equal(result.length,5);assert.equal(result.filter(a=>a.kind==='rat').length,2);
   for(const a of result){assert.ok(a.nearby>0,JSON.stringify({time,a}));assert.ok(a.awayDot>0,JSON.stringify({time,a}));}
   positions.push(result);
  }
  const first=positions[0];assert.ok(positions.some(p=>p.filter(a=>a.kind==='rat').some(a=>JSON.stringify(a.foot)!==JSON.stringify(first.find(b=>b.id===a.id).foot))));
  for(const p of positions){const snail=p.find(a=>a.kind==='snail');assert.equal(snail.facing,-1);assert.deepEqual(snail.nativeSize,[14,12]);assert.deepEqual(snail.foot,[1206,389]);}
  await at(page,21);await record(page,'moving-residents');await h.close();
 });

 await t.test('real hacks and result transitions keep identical resolved state and RNG',async()=>{
  const a=await make(),b=await make();await b.page.evaluate(()=>{window.RelayShadows={...actualShadows,draw(){}};});
  for(const [name,action] of [['safe',()=>hack(1)],['standard',()=>hack(2)],['brute',()=>hack(3)],['transfer',()=>transfer()],['restart',()=>{closeOverlays();startGame();money=500;risk=100;updateUI();}],['busted',()=>hack(3)]]){
   await a.page.evaluate(action);await b.page.evaluate(action);await at(a.page,10);await at(b.page,10);assert.deepEqual(await state(a.page),await state(b.page),name);assert.equal((await stats(a.page)).shadows.error,false);
  }
  await record(a.page,'busted-contact');await a.close();await b.close();
 });

 await t.test('bursts and repeated poses retain bounded caches with no canvas growth',async()=>{
  const h=await make(),page=h.page;const result=await page.evaluate(()=>{
   const before=shadowCanvasAllocations,start=RelayShadows.getDiagnostics().builds,game=JSON.stringify(RiskPresentation.snapshot()),rolls=shadowRolls;
   for(let i=0;i<100;i++)RelayShadows.exportFrame(200+i/12,{signal:{power:1,activity:i%2,warning:i%3/2}});
   const d=RelayShadows.getDiagnostics();for(let i=0;i<40;i++)RelayShadows.exportFrame(299,{isStatic:true,signal:{power:1}});
   const stable=RelayShadows.getDiagnostics().builds;for(let i=0;i<40;i++)RelayShadows.exportFrame(399,{isStatic:true,signal:{power:1}});
   return {before,after:shadowCanvasAllocations,start,d,stable,final:RelayShadows.getDiagnostics(),sameGame:game===JSON.stringify(RiskPresentation.snapshot()),sameRolls:rolls===shadowRolls};
  });
  assert.equal(result.before,result.after);assert.equal(result.sameGame,true);assert.equal(result.sameRolls,true);assert.equal(result.d.canvasCount,1);assert.equal(result.d.receiverMasks,3);assert.ok(result.d.sourceCaches<=5);assert.equal(result.d.casterLimit,5);assert.equal(result.final.builds,result.stable);assert.equal(result.final.ownTimers,0);assert.equal(result.final.ownAnimationFrames,0);assert.ok(result.d.builds>result.start);await h.close();
 });

 await t.test('reduced/static, actual bypass and hidden windows keep shadow time still',async()=>{
  const h=await make(),page=h.page;
  for(const prefs of [{reducedMotion:true,effectsLevel:'full'},{reducedMotion:false,effectsLevel:'off'}]){
   await page.evaluate(p=>{BlacksiteScene.setCaptureTime(null);RiskPresentation.setPreferences(p);},prefs);await page.waitForTimeout(150);
   const before=await page.evaluate(()=>({image:document.getElementById('relay-scene').toDataURL(),time:RelayShadows.getDiagnostics().time,builds:RelayShadows.getDiagnostics().builds}));await page.waitForTimeout(150);
   assert.deepEqual(await page.evaluate(()=>({image:document.getElementById('relay-scene').toDataURL(),time:RelayShadows.getDiagnostics().time,builds:RelayShadows.getDiagnostics().builds})),before);assert.equal((await stats(page)).scene.rafActive,false);
  }
  await page.evaluate(()=>{RiskPresentation.setPreferences({reducedMotion:false,effectsLevel:'full'});});await page.waitForTimeout(150);await page.evaluate(()=>{bypassCharge=15;bypass();});await page.waitForTimeout(80);
  const paused=await page.evaluate(()=>RelayShadows.getDiagnostics());await page.waitForTimeout(150);assert.deepEqual(await page.evaluate(()=>RelayShadows.getDiagnostics()),paused);await page.keyboard.press('Escape');await page.waitForTimeout(100);
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});await page.waitForTimeout(60);const hidden=await page.evaluate(()=>RelayShadows.getDiagnostics());await page.waitForTimeout(150);assert.deepEqual(await page.evaluate(()=>RelayShadows.getDiagnostics()),hidden);await h.close();
 });

 await t.test('empty casters draw nothing and disposal releases all shadow resources',async()=>{
  const h=await make(),page=h.page;
  const result=await page.evaluate(()=>{
   const life=RelayLife,pets=RelayPets;window.RelayLife={...life,getShadowCasters:()=>[]};window.RelayPets={...pets,getShadowCasters:()=>[]};const c=document.createElement('canvas');c.width=420;c.height=280;const x=c.getContext('2d');x.fillStyle='#31577a';x.fillRect(0,0,420,280);const before=c.toDataURL();RelayShadows.draw(x,200);const frame=RelayShadows.exportFrame(201);const same=before===c.toDataURL();window.RelayLife=life;window.RelayPets=pets;BlacksiteScene.dispose();return {same,frame,shadows:RelayShadows.getDiagnostics(),pets:RelayPets.getDiagnostics(),lighting:RelayLighting.getDiagnostics()};
  });
  assert.equal(result.same,true);assert.equal(result.frame,null);assert.equal(result.shadows.disposed,true);assert.equal(result.shadows.ready,false);assert.equal(result.shadows.canvasCount,0);assert.equal(result.shadows.receiverMasks,0);assert.equal(result.shadows.sourceCaches,0);assert.equal(result.shadows.casters.length,0);assert.equal(result.pets.disposed,true);assert.equal(result.lighting.disposed,true);await h.close();
 });
 assert.deepEqual(errors,[]);
});

const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const chrome=process.env.CHROMIUM_EXECUTABLE||[chromium.executablePath(),path.join(process.env.LOCALAPPDATA||'','ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-win64/chrome-headless-shell.exe')].find(p=>fs.existsSync(p));
const out=process.env.RISK_REACTOR_QA_DIR;
const palette={idle:'#ffcb79',safe:'#56d9ff',standard:'#a68aff',brute:'#ff72bd',success:'#86f5a1',fail:'#ff555d'};
if(out)fs.mkdirSync(out,{recursive:true});

test('reactor colors follow resolved game actions without changing the game',{skip:!chrome,timeout:90000},async t=>{
 const browser=await chromium.launch({executablePath:chrome,headless:true,args:['--allow-file-access-from-files']});
 const captures=[],allErrors=[];
 t.after(async()=>{await browser.close();if(out)fs.writeFileSync(path.join(out,'phase-report.json'),JSON.stringify({captures,errors:allErrors},null,2));});
 async function pageForGame(){
  const context=await browser.newContext({viewport:{width:420,height:650}});
  await context.route(/^https?:/,route=>route.abort());
  await context.addInitScript(()=>{window.electronAPI={loadGame:async()=>({playerName:'REACTOR_QA',tutorialSeen:true,musicVolume:0,sfxVolume:0,presentation:{introSeen:true,reducedMotion:false,effectsLevel:'full'}}),saveGame:async()=>true,submitScore:async()=>'OK',getLeaderboard:async()=>JSON.stringify({scope:'local',metric:'best-bank-balance',limit:10,entries:[]}),closeApp:()=>{}};});
  const page=await context.newPage();page.on('pageerror',e=>allErrors.push(e.message));
  await page.goto(pathToFileURL(path.join(root,'index.html')).href);
  // Lighting and pets decode their own assets. The scene's separate room image
  // must also be ready before a captured core frame can be asserted.
  await page.waitForFunction(()=>!window.RiskSaveLoading&&RiskPresentation?.snapshot().playerName==='REACTOR_QA'&&RelayLighting?.getDiagnostics().ready&&RelayPets?.getDiagnostics().ready&&BlacksiteScene?.getDiagnostics().artLoaded);
  await page.evaluate(()=>{Object.values(achievements).forEach(a=>a.unlocked=true);showPersistentUpgrades();startGame();money=500;risk=0;window.reactorRolls=0;Math.random=()=>{reactorRolls++;return .99999;};window.reactorEvents=[];document.addEventListener('risk:event',e=>reactorEvents.push(JSON.parse(JSON.stringify(e.detail))));updateUI();});
  await at(page,10);return {page,close:()=>context.close()};
 }
 async function at(page,time){
  // Read the counter and request the capture in one browser task. An outcome
  // frame between two separate evaluate calls must not satisfy this wait.
  const before=await page.evaluate(t=>{const n=BlacksiteScene.getDiagnostics().frames;BlacksiteScene.setCaptureTime(t);return n;},time);
  await page.waitForFunction(n=>BlacksiteScene.getDiagnostics().frames>n,before);
 }
 const gameState=page=>page.evaluate(()=>JSON.parse(JSON.stringify({money,totalMoney,risk,multiplier,nodesHacked,nodesValidated,bypassCharge,sessionHackCount,ghostShieldActive,insuranceTurns,overclockBonusTurns,sessionStats,achievementStats})));
 const diagnostics=page=>page.evaluate(()=>({scene:BlacksiteScene.getDiagnostics(),lighting:RelayLighting.getDiagnostics(),pets:RelayPets.getDiagnostics(),screen:RiskPresentation.currentScreen()}));
 async function inspect(page,name){
  const result=await page.evaluate(()=>{
   const screen=RiskPresentation.currentScreen(),id=screen==='success'?'success-scene':screen==='busted'?'busted-scene':'relay-scene';
   const c=document.getElementById(id),ctx=c.getContext('2d'),data=ctx.getImageData(0,0,c.width,c.height).data;
   const scale=Math.max(c.width/1536,c.height/1024),ox=(c.width-1536*scale)*.5,oy=(c.height-1024*scale)*.48;
   const polygon=[[650,496],[791,531],[779,615],[648,579]].map(([x,y])=>[ox+x*scale,oy+y*scale]);
   const inside=(x,y)=>{let hit=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){const a=polygon[i],b=polygon[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])hit=!hit;}return hit;};
   const rgb=[0,0,0];let pixels=0,bright=0;for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++)if(inside(x+.5,y+.5)){const k=(y*c.width+x)*4;pixels++;if(Math.max(data[k],data[k+1],data[k+2])>45){bright++;for(let n=0;n<3;n++)rgb[n]+=data[k+n];}}
   const crop={x:Math.floor(Math.min(...polygon.map(p=>p[0])))-2,y:Math.floor(Math.min(...polygon.map(p=>p[1])))-2,width:Math.ceil(Math.max(...polygon.map(p=>p[0]))-Math.min(...polygon.map(p=>p[0])))+4,height:Math.ceil(Math.max(...polygon.map(p=>p[1]))-Math.min(...polygon.map(p=>p[1])))+4};
   return {screen,scene:BlacksiteScene.getDiagnostics(),lighting:RelayLighting.getDiagnostics(),pixels,bright,mean:rgb.map(v=>v/Math.max(1,bright)),crop,canvas:id};
  });
  captures.push({name,...result});
  if(out){
   await page.evaluate(()=>document.getAnimations().filter(a=>a.animationName==='panelIn').forEach(a=>a.finish()));
   await page.screenshot({path:path.join(out,name+'-native.png')});
   const url=await page.evaluate(({canvas,crop})=>{const source=document.getElementById(canvas),c=document.createElement('canvas');c.width=crop.width*8;c.height=crop.height*8;const ctx=c.getContext('2d');ctx.imageSmoothingEnabled=false;ctx.drawImage(source,crop.x,crop.y,crop.width,crop.height,0,0,c.width,c.height);return c.toDataURL('image/png');},result);
   fs.writeFileSync(path.join(out,name+'-core.png'),Buffer.from(url.split(',')[1],'base64'));
  }
  assert.ok(result.bright>15,name+' remains visibly lit');return result;
 }
 async function mode(page,name,expected){const d=await inspect(page,name);assert.equal(d.scene.core.mode,expected);assert.equal(d.scene.core.color,palette[expected]);assert.ok(d.scene.core.mix>.75);return d;}

 await t.test('real safe, standard and brute hacks have distinct visible core colors and identical gameplay/RNG',async()=>{
  const live=await pageForGame(),plain=await pageForGame();
  try{
   await plain.page.evaluate(()=>BlacksiteScene.dispose());const colors=[];
   for(const [level,expected] of [[1,'safe'],[2,'standard'],[3,'brute']]){
    await at(live.page,10+level);await live.page.evaluate(n=>hack(n),level);await plain.page.evaluate(n=>hack(n),level);
    assert.deepEqual(await gameState(live.page),await gameState(plain.page));assert.equal(await live.page.evaluate(()=>reactorRolls),await plain.page.evaluate(()=>reactorRolls));
    await at(live.page,10+level+.2);const d=await mode(live.page,'hack-'+expected,expected);colors.push(d.mean);
    const last=await live.page.evaluate(()=>reactorEvents.filter(e=>e.type==='hack').at(-1));assert.equal(last.hackType,level);assert.ok(last.gain>0);
   }
   assert.ok(colors[0][2]>colors[0][0],'safe core is visibly cool');assert.ok(colors[1][2]>colors[1][1],'standard core is visibly violet');assert.ok(colors[2][0]>colors[2][1],'brute core is visibly magenta');
   for(let a=0;a<3;a++)for(let b=a+1;b<3;b++)assert.ok(colors[a].reduce((n,v,i)=>n+Math.abs(v-colors[b][i]),0)>15,'hack colors differ in actual core pixels');
   await at(live.page,20);await live.page.evaluate(()=>{nodesHacked=99;hack(1);});await plain.page.evaluate(()=>{nodesHacked=99;hack(1);});await at(live.page,20.2);
   await mode(live.page,'node-success','success');assert.deepEqual(await gameState(live.page),await gameState(plain.page));
  }finally{await live.close();await plain.close();}
 });

 await t.test('actual transfer and detected hack keep terminal colors through reset and clear on the next run',async()=>{
  const g=await pageForGame();try{
   await g.page.evaluate(()=>{hack(1);transfer();});await at(g.page,10.2);const success=await mode(g.page,'transfer-success','success');assert.equal(success.screen,'success');assert.ok(success.mean[1]>success.mean[0]);
   const paid=await g.page.evaluate(()=>reactorEvents.filter(e=>e.type==='transfer'));assert.equal(paid.length,1);assert.ok(paid[0].money>500);assert.equal(await g.page.evaluate(()=>money),0);
   await at(g.page,15);assert.equal((await diagnostics(g.page)).scene.core.mode,'success');
   await g.page.evaluate(()=>{closeOverlays();startGame();});await at(g.page,16);assert.equal((await diagnostics(g.page)).scene.core.mode,'idle');
   await g.page.evaluate(()=>{risk=100;ghostShieldActive=false;insuranceTurns=0;updateUI();reactorEvents=[];hack(3);});await at(g.page,16.2);const failure=await mode(g.page,'detected-failure','fail');assert.equal(failure.screen,'busted');assert.ok(failure.mean[0]>failure.mean[1]*1.15,'failure remains visibly red despite electronic power down');
   const events=await g.page.evaluate(()=>reactorEvents);assert.equal(events.filter(e=>e.type==='bust').length,1);assert.equal(events.filter(e=>e.type==='hack').length,0);assert.equal(events.find(e=>e.type==='bust').risk,100);assert.equal(await g.page.evaluate(()=>risk),0);
   await g.page.evaluate(()=>{closeOverlays();startGame();});await at(g.page,18);const d=await diagnostics(g.page);assert.equal(d.scene.core.mode,'idle');assert.equal(d.scene.terminalType,null);assert.equal(d.scene.activeEffects,0);
  }finally{await g.close();}
 });

 await t.test('typing success/failure use real input and memory result survives its delayed handoff',async()=>{
  const g=await pageForGame();try{
   await g.page.evaluate(()=>startTypingProtocol());await g.page.waitForFunction(()=>typingStarted);const before=await g.page.evaluate(()=>multiplier);await g.page.locator('#typing-input').fill(await g.page.evaluate(()=>typingPhrase));await at(g.page,10.2);await mode(g.page,'typing-success','success');assert.equal(await g.page.evaluate(()=>multiplier),before+1);
   await at(g.page,12);await g.page.evaluate(()=>startTypingProtocol());await g.page.waitForFunction(()=>typingStarted);for(let n=1;n<=4;n++)await g.page.locator('#typing-input').fill('~'.repeat(n));await at(g.page,12.2);await mode(g.page,'typing-failure','fail');assert.equal(await g.page.evaluate(()=>risk),10);
   await at(g.page,14);await g.page.evaluate(()=>startBackdoorProtocol());await g.page.waitForFunction(()=>backdoorStarted);const targets=await g.page.evaluate(()=>backdoorTargetPositions.slice());for(const index of targets)await g.page.locator('.backdoor-cell[data-index="'+index+'"]').click();
   assert.equal(await g.page.evaluate(()=>RiskPresentation.currentScreen()),'backdoor');await g.page.waitForFunction(()=>RiskPresentation.currentScreen()==='game');await at(g.page,14.2);await mode(g.page,'memory-success-handoff','success');
  }finally{await g.close();}
 });

 await t.test('rapid outcomes replace older colors, settle to idle and stay bounded without gameplay RNG',async()=>{
  const g=await pageForGame();try{
   await g.page.evaluate(()=>{hack(1);hack(2);hack(3);});await at(g.page,10.2);await mode(g.page,'rapid-latest-brute','brute');
   const before=await gameState(g.page),rolls=await g.page.evaluate(()=>reactorRolls);
   await g.page.evaluate(()=>{Math.random=()=>{throw Error('Decorative reactor consumed gameplay RNG');};for(let i=0;i<200;i++)RiskPresentation.emit('hack',{hackType:i%3+1});});await at(g.page,10.4);
   let d=await diagnostics(g.page);assert.ok(d.scene.activeEffects<=12);assert.ok(d.scene.particles<=160);assert.equal(d.scene.coreSpriteCount,5);assert.equal(d.lighting.mapCount,11);assert.ok(d.lighting.viewBuffers<=4);assert.equal(d.lighting.ownTimers,0);assert.equal(d.lighting.ownAnimationFrames,0);assert.deepEqual(await gameState(g.page),before);assert.equal(await g.page.evaluate(()=>reactorRolls),rolls);
   const resources=await g.page.evaluate(async()=>{let allocations=0;const make=document.createElement.bind(document);document.createElement=(name,...a)=>{if(String(name).toLowerCase()==='canvas')allocations++;return make(name,...a);};for(let i=0;i<40;i++){const n=BlacksiteScene.getDiagnostics().frames;BlacksiteScene.setCaptureTime(20+i*.2);await new Promise(resolve=>{const check=()=>BlacksiteScene.getDiagnostics().frames>n?resolve():requestAnimationFrame(check);requestAnimationFrame(check);});}document.createElement=make;return {allocations,scene:BlacksiteScene.getDiagnostics(),lighting:RelayLighting.getDiagnostics()};});
   assert.equal(resources.allocations,0);assert.equal(resources.scene.core.mode,'idle');assert.equal(resources.scene.activeEffects,0);assert.equal(resources.scene.particles,0);assert.equal(resources.scene.coreSpriteCount,5);assert.equal(resources.lighting.mapCount,11);
  }finally{await g.close();}
 });

 await t.test('static/reduced outcomes stay readable and protocol/hidden lifecycle stops core and blink drawing',async()=>{
  const g=await pageForGame();try{
   await g.page.evaluate(()=>BlacksiteScene.setCaptureTime(null));
   for(const [name,preferences,level,expected] of [['reduced',{reducedMotion:true},1,'safe'],['static',{reducedMotion:false,effectsLevel:'off'},2,'standard']]){
    await g.page.evaluate(p=>RiskPresentation.setPreferences(p),preferences);await g.page.evaluate(n=>hack(n),level);await g.page.waitForTimeout(100);await mode(g.page,name+'-outcome',expected);
    const a=await diagnostics(g.page),pixels=await g.page.locator('#relay-scene').evaluate(c=>c.toDataURL());await g.page.waitForTimeout(150);const b=await diagnostics(g.page);assert.equal(await g.page.locator('#relay-scene').evaluate(c=>c.toDataURL()),pixels,'static room pixels remain identical through incidental UI redraws');assert.equal(b.lighting.mapBuilds,a.lighting.mapBuilds);assert.equal(b.lighting.time,a.lighting.time);assert.deepEqual(b.scene.core,a.scene.core);
    // Static scenes may briefly queue a one-shot redraw after an unrelated UI
    // class change. Require the loop to settle instead of sampling that queue
    // at an arbitrary wall-clock instant; a continuous RAF loop never settles.
    await g.page.waitForFunction(()=>!BlacksiteScene.getDiagnostics().rafActive,null,{timeout:5000});
   }
   await g.page.evaluate(()=>{RiskPresentation.setPreferences({effectsLevel:'full',reducedMotion:false});bypassCharge=15;bypass();});await g.page.waitForTimeout(60);const a=await diagnostics(g.page);await g.page.waitForTimeout(120);const b=await diagnostics(g.page);assert.equal(b.scene.frames,a.scene.frames);assert.equal(b.lighting.draws,a.lighting.draws);assert.deepEqual(b.scene.core,a.scene.core);await g.page.keyboard.press('Escape');
   await g.page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});await g.page.waitForTimeout(40);const hidden=await diagnostics(g.page);await g.page.waitForTimeout(120);assert.equal((await diagnostics(g.page)).scene.frames,hidden.scene.frames);
   await g.page.evaluate(()=>BlacksiteScene.dispose());const disposed=await diagnostics(g.page);assert.equal(disposed.scene.rafActive,false);assert.equal(disposed.lighting.mapCount,0);assert.equal(disposed.lighting.viewBuffers,0);assert.equal(disposed.pets.disposed,true);assert.deepEqual(allErrors,[]);
  }finally{await g.close();}
 });
});

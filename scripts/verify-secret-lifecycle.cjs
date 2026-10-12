/* Isolated browser checks for cosmetic pause, pointer input and decoded audio. */
const {chromium,findChromium}=require('./protocol-environment-audit.cjs');
const path=require('node:path'),fs=require('node:fs/promises'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const repo=path.resolve(__dirname,'..'),out=path.resolve(process.env.RISK_V2_QA_DIR||path.join(repo,'dist/qa'),'secret-lifecycle');
const report={checks:[],errors:[]};
(async()=>{
 const browser=await chromium.launch({executablePath:findChromium(),headless:true,args:['--allow-file-access-from-files']});
 try{
  const context=await browser.newContext({viewport:{width:420,height:650}});
  await context.route(/^https?:/,route=>route.abort());
  await context.addInitScript(()=>{window.electronAPI={loadGame:async()=>({playerName:'LIFECYCLE_QA',totalMoney:1000,musicVolume:0,sfxVolume:.5,tutorialSeen:true,presentation:{introSeen:true,reducedMotion:true,effectsLevel:'full'}}),saveGame:async()=>true,getLeaderboard:async()=>JSON.stringify({scope:'local',metric:'best-bank-balance',limit:10,entries:[]}),submitScore:async()=>'OK',closeApp:async()=>true};});
  const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
  await page.goto(pathToFileURL(path.join(repo,'index.html')).href);
  await page.waitForFunction(()=>!window.RiskSaveLoading&&window.RelaySecretRooms?.getDiagnostics().ready);
  await page.locator('#main-menu button[onclick="showPersistentUpgrades()"]').click();await page.locator('[onclick="startGame()"]').click();await page.waitForTimeout(350);
  const hit=id=>page.locator(`[data-secret-id="${id}"]`);
  const diag=()=>page.evaluate(()=>RelayEasterEggs.getDiagnostics());
  const pet=async()=>{for(let i=0;i<3;i++)await hit('server-cat').click();};
  await pet();await page.waitForTimeout(250);
  await page.evaluate(()=>{bypassCharge=15;bypass();});await page.waitForTimeout(120);
  assert.equal((await diag()).ownTimers,0);assert.equal((await diag()).pausedReveals,1);
  await page.evaluate(()=>document.querySelector('[data-secret-id="server-cat"]').click());
  await page.waitForTimeout(6100);assert.deepEqual((await diag()).active,['rootAccess']);
  await page.evaluate(()=>exitBypassGame());await page.waitForTimeout(180);assert.equal((await diag()).ownTimers,1);
  await page.waitForFunction(()=>RelayEasterEggs.getDiagnostics().active.length===0,{},{timeout:6500});
  report.checks.push('static reveal pauses through a minigame, rejects hidden clicks, resumes and cleans up');
  await pet();await page.waitForTimeout(200);
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});
  await page.waitForTimeout(6100);assert.equal((await diag()).ownTimers,0);assert.equal((await diag()).pausedReveals,1);assert.deepEqual((await diag()).active,['rootAccess']);
  await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});
  await page.waitForFunction(()=>RelayEasterEggs.getDiagnostics().active.length===0,{},{timeout:6500});
  report.checks.push('visibility lifecycle preserves the remaining static reveal time');
  const locker=await hit('locker').boundingBox();assert.ok(locker);
  await page.mouse.move(locker.x+locker.width/2,locker.y+locker.height/2);
  for(const hold of [90,90,750]){await page.mouse.down();await page.waitForTimeout(hold);await page.mouse.up();await page.waitForTimeout(90);}
  assert.deepEqual((await diag()).active,['locker']);report.checks.push('actual pointer short-short-long opens the locker once');
  await page.waitForFunction(()=>RelayEasterEggs.getDiagnostics().active.length===0,{},{timeout:6500});
  await page.evaluate(()=>RiskPresentation.setPreferences({reducedMotion:false}));
  let t=100;await page.evaluate(t=>BlacksiteScene.setCaptureTime(t),t);await page.waitForTimeout(60);
  for(let i=0;i<30;i++){
   await page.evaluate(()=>{const cat=document.querySelector('[data-secret-id="server-cat"]');cat.click();cat.click();cat.click();});
   assert.deepEqual((await diag()).active,['rootAccess']);
   t+=5.1;await page.evaluate(t=>BlacksiteScene.setCaptureTime(t),t);await page.waitForTimeout(25);
   assert.deepEqual((await diag()).active,[]);
  }
  assert.equal((await diag()).targets,9);assert.equal((await diag()).ownTimers,0);assert.equal((await diag()).ownAnimationFrames,0);
  report.checks.push('30 repeated reveals reuse nine targets with no accumulating timers or private RAF');
  await page.evaluate(()=>RelayAudio.setVolumes(0,.5));
  await hit('server-cat').focus();await page.keyboard.press('Tab');
  await page.waitForFunction(()=>RelayAudio.getDiagnostics().state==='running');
  report.audio=[];
  for(const name of ['rat','cat','snail','locker','arcade','knock']){
   await page.waitForTimeout(100);
   const started=await page.evaluate(name=>RelayAudio.play('egg-'+name),name);assert.equal(started,true,'decode/play egg-'+name);
   report.audio.push({cue:name,started});await page.evaluate(name=>RelayAudio.stop('egg-'+name),name);
  }
  await page.waitForTimeout(1900);report.audioDiagnostics=await page.evaluate(()=>RelayAudio.getDiagnostics());
  assert.deepEqual(report.audioDiagnostics.missingAssets,[]);assert.equal(report.audioDiagnostics.pendingAssets,0);assert.equal(report.audioDiagnostics.activeVoices,0);assert.ok(report.audioDiagnostics.cachedAssets<=40);
  report.checks.push('six original cues decode and play through keyboard-activated audio; stopped voices clear');
  await page.evaluate(()=>{RelayEasterEggs.dispose();RelayAudio.dispose();});assert.equal((await diag()).ownTimers,0);assert.equal((await diag()).targets,0);
  assert.deepEqual(report.errors,[]);report.passed=true;await context.close();
 }finally{await browser.close();}
})().catch(e=>{report.failure=e.stack;process.exitCode=1;}).finally(async()=>{await fs.mkdir(out,{recursive:true});await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));});

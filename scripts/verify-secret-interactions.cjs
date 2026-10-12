/* Real controls with mocked saves; no world-state grants or published scores. */
const {chromium,findChromium}=require('./protocol-environment-audit.cjs');
const path=require('node:path'),fs=require('node:fs/promises'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const repo=path.resolve(__dirname,'..'),out=path.resolve(process.env.RISK_V2_QA_DIR||path.join(repo,'dist/qa'),'secret-interactions');
const report={checks:[],captures:[],errors:[]};
(async()=>{
 await fs.mkdir(out,{recursive:true});
 const browser=await chromium.launch({executablePath:findChromium(),headless:true,args:['--allow-file-access-from-files']});
 try{
  const context=await browser.newContext({viewport:{width:420,height:650},deviceScaleFactor:1});
  await context.route(/^https?:/,route=>route.abort());
  await context.addInitScript(()=>{window.__saves=[];window.__randomCalls=0;const random=Math.random;Math.random=()=>{window.__randomCalls++;return random();};window.electronAPI={loadGame:async()=>({playerName:'SECRET_QA',totalMoney:4321,musicVolume:0,sfxVolume:0,tutorialSeen:true,presentation:{introSeen:true,reducedMotion:false,effectsLevel:'full'}}),saveGame:async data=>{window.__saves.push(data);return true;},getLeaderboard:async()=>JSON.stringify({scope:'local',metric:'best-bank-balance',limit:10,entries:[]}),submitScore:async()=>'OK',closeApp:async()=>true};});
  const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
  await page.goto(pathToFileURL(path.join(repo,'index.html')).href);
  await page.waitForFunction(()=>!window.RiskSaveLoading&&window.RelaySecretRooms?.getDiagnostics().ready&&Object.values(window.RelayPetSecrets?.getDiagnostics().props||{}).length===4&&Object.values(RelayPetSecrets.getDiagnostics().props).every(p=>p.ready));
  await page.locator('#main-menu button[onclick="showPersistentUpgrades()"]').click();await page.locator('[onclick="startGame()"]').click();
  const frame=async t=>{await page.evaluate(t=>BlacksiteScene.setCaptureTime(t),t);await page.waitForTimeout(100);};
  const hit=id=>page.locator(`[data-secret-id="${id}"]`);
  const capture=async name=>{await page.mouse.move(2,2);await page.waitForTimeout(80);await page.screenshot({path:path.join(out,name+'.png')});const data=await page.evaluate(()=>({secret:RelayEasterEggs.getDiagnostics(),pets:RelayPets.getDiagnostics().residents,scene:BlacksiteScene.getDiagnostics()}));report.captures.push({name,...data});};
  await frame(2);const baseline=await page.evaluate(()=>({snapshot:JSON.stringify(RiskPresentation.snapshot()),saves:__saves.length,random:__randomCalls}));
  await capture('00-idle');
  await hit('cable-rat').click();await hit('rack-rat').click();assert.deepEqual(await page.evaluate(()=>RelayEasterEggs.getDiagnostics().active),['ratUnion']);
  for(const [name,t] of [['01-union-start',2],['02-union-walk',4],['03-union-hold',8],['04-union-return',14],['05-union-done',16.1]]){await frame(t);await capture(name);}
  assert.equal(await page.evaluate(()=>RelayPets.getDiagnostics().ratCount),2);report.checks.push('two real rat targets trigger a bounded14-second performance');
  await hit('server-cat').focus();for(let i=0;i<3;i++)await page.keyboard.press('Space');
  assert.equal(await page.evaluate(()=>RiskPresentation.currentScreen()),'game');assert.deepEqual(await page.evaluate(()=>RelayEasterEggs.getDiagnostics().active),['rootAccess']);
  await frame(18.1);await capture('06-cat-key');await frame(21.2);report.checks.push('Space pets the focused cat without Transfer');
  await frame(24.5);await hit('coil-snail').click();assert.deepEqual(await page.evaluate(()=>RelayEasterEggs.getDiagnostics().active),['snailMail']);await frame(26.5);await capture('07-snail-mail');await frame(30.6);
  await hit('locker').focus();await page.keyboard.press('Enter');await page.keyboard.press('Enter');await page.keyboard.down('Enter');await page.waitForTimeout(750);await page.keyboard.up('Enter');
  assert.deepEqual(await page.evaluate(()=>RelayEasterEggs.getDiagnostics().active),['locker']);await frame(33.6);await capture('08-locker-open');await frame(37.7);report.checks.push('short short hold opens the locker through actual keyboard events');
  const after=await page.evaluate(()=>({snapshot:JSON.stringify(RiskPresentation.snapshot()),saves:__saves.length,random:__randomCalls}));assert.deepEqual(after,baseline,'all scenery interactions leave gameplay, saves and gameplay RNG unchanged');
  await page.evaluate(()=>{bypassCharge=15;bypass();});assert.equal(await page.locator('[data-secret-surface="scene"]').isVisible(),false);await page.evaluate(()=>exitBypassGame());report.checks.push('minigames hide and gate decorative inputs');
  await page.reload();await page.waitForFunction(()=>!window.RiskSaveLoading&&window.RelaySecretRooms?.getDiagnostics().ready);await page.locator('#menu-guide-trigger').click();await page.waitForTimeout(200);
  for(let i=0;i<4;i++)await hit('led-'+i).click();assert.deepEqual(await page.evaluate(()=>RelayEasterEggs.getDiagnostics().active),['room404']);
  await page.waitForTimeout(700);await capture('09-room404');await page.locator('[data-guide-topic="hacks"]').click();assert.equal(await page.locator('[data-secret-surface="guide"]').isVisible(),false);report.checks.push('four real guide LEDs reveal Room404; details hide the targets');
  await page.evaluate(()=>{closeTutorial();RiskPresentation.setPreferences({reducedMotion:true});});await page.locator('#main-menu button[onclick="showPersistentUpgrades()"]').click();await page.locator('[onclick="startGame()"]').click();await page.evaluate(()=>BlacksiteScene.setCaptureTime(null));await page.waitForTimeout(400);
  await hit('server-cat').click({clickCount:1});await hit('server-cat').click();await hit('server-cat').click();await page.waitForTimeout(250);
  const staticState=await page.evaluate(()=>({effects:RelayEasterEggs.getDiagnostics(),scene:BlacksiteScene.getDiagnostics()}));assert.equal(staticState.effects.ownAnimationFrames,0);assert.equal(staticState.effects.ownTimers,1);assert.equal(staticState.scene.rafActive,false);
  await capture('10-static-cat');await page.waitForTimeout(6100);assert.deepEqual(await page.evaluate(()=>RelayEasterEggs.getDiagnostics().active),[]);assert.equal(await page.evaluate(()=>RelayEasterEggs.getDiagnostics().ownTimers),0);report.checks.push('reduced motion uses a static pose, one bounded cleanup and no continuous RAF');
  await page.evaluate(()=>RelayEasterEggs.dispose());assert.equal(await page.locator('.secret-hit-layer').count(),0);assert.equal(await page.evaluate(()=>RelayEasterEggs.getDiagnostics().ownTimers),0);report.checks.push('disposal removes targets and timers');
  assert.deepEqual(report.errors,[]);report.passed=true;await context.close();
 }finally{await browser.close();}
})().catch(e=>{report.failure=e.stack;process.exitCode=1;}).finally(async()=>{await fs.mkdir(out,{recursive:true});await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,checks:report.checks,errors:report.errors,failure:report.failure},null,2));});

const closeTestApp = require('./close-test-app.cjs');
/* Actual Electron UI/UX review of each protocol phase, with isolated saves. */
const {_electron:electron}=require('playwright');
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),out=path.resolve(process.env.RISK_V2_QA_DIR||path.join(root,'dist','qa'),'protocols');
(async()=>{
 await fs.mkdir(out,{recursive:true});const dataDir=path.join(out,'profile');await fs.mkdir(dataDir,{recursive:true});
 await fs.writeFile(path.join(dataDir,'user_data.json'),JSON.stringify({playerName:'PROTOCOL_QA',musicVolume:0,sfxVolume:0,tutorialSeen:true,presentation:{introSeen:true,reducedMotion:false}}));
 const app=await electron.launch({executablePath:process.env.RISK_V2_EXECUTABLE||require('electron'),args:process.env.RISK_V2_EXECUTABLE?[]:[root],env:{...process.env,RISK_V2_TEST_MODE:'1',RISK_V2_USER_DATA_DIR:dataDir},timeout:120000});
 const report={createdAt:new Date().toISOString(),screens:[],checks:[],errors:[]};
 try{
  const page=await app.firstWindow();page.on('pageerror',e=>report.errors.push(e.message));await app.context().setOffline(true);await page.waitForFunction(()=>!window.RiskSaveLoading && window.RiskPresentation?.snapshot()?.playerName==='PROTOCOL_QA' && window.RelayPets?.getDiagnostics().ready && window.RelayLighting?.getDiagnostics().ready&&window.RelayShadows?.getDiagnostics().ready);
  await page.evaluate(()=>{showPersistentUpgrades();startGame();money=500;risk=50;multiplier=8;updateUI();updateBonusPrices();});
  const capture=async(name,expectedScreen)=>{await page.waitForTimeout(100);const data=await page.evaluate(()=>{const visible=e=>e.getClientRects().length&&!e.closest('[inert]');return {screen:RiskPresentation.currentScreen(),protocol:RiskPresentation.protocol(),scene:BlacksiteScene.getDiagnostics(),pets:window.RelayPets?.getDiagnostics(),lighting:window.RelayLighting?.getDiagnostics(),shadows:window.RelayShadows?.getDiagnostics(),controls:[...document.querySelectorAll('button,input,[role=button]')].filter(visible).map(e=>{const r=e.getBoundingClientRect();return {id:e.id,x:r.x,y:r.y,right:r.right,bottom:r.bottom};})};});assert.equal(data.screen,expectedScreen,name);assert.ok(data.controls.every(r=>r.x>=0&&r.y>=0&&r.right<=420.5&&r.bottom<=650.5),name+' visible controls contained');await page.screenshot({path:path.join(out,name+'.png')});const prior=report.screens.at(-1);if(['bypass','typing','backdoor'].includes(data.screen)&&prior?.screen===data.screen){assert.equal(data.lighting.time,prior.lighting.time,'lighting clock stays paused during protocol');assert.equal(data.lighting.draws,prior.lighting.draws,'lighting drawing stays paused during protocol');assert.equal(data.shadows.time,prior.shadows.time,'shadow clock stays paused during protocol');assert.equal(data.shadows.builds,prior.shadows.builds,'shadow masks stay paused during protocol');}report.screens.push({name,...data});};
  const protocol=()=>page.evaluate(()=>RiskPresentation.protocol());
  // Bypass: mouse stop, keyboard stop, actual earned reduction, miss.
  await page.evaluate(()=>{bypassCharge=15;bypass();});await capture('01-bypass-active','bypass');
  await page.evaluate(()=>{bypassGauge=bypassTarget;});await page.locator('#screen-bypass button[onclick="attemptBypass()"]').click();
  assert.equal((await protocol()).stops,1);assert.equal((await protocol()).rewardReduction,0);await capture('02-bypass-first-lock','bypass');
  await page.evaluate(()=>{bypassGauge=bypassTarget;});await page.keyboard.press('Space');assert.equal((await protocol()).stops,2);assert.equal((await protocol()).rewardReduction,4);await capture('03-bypass-earned','bypass');
  await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>risk),46);await capture('04-bypass-receipt','game');report.checks.push('two stops earn exactly four risk points; mouse/keyboard actions agree');
  await page.evaluate(()=>{bypassCharge=15;bypass();bypassGauge=0;});await page.keyboard.press('Space');await capture('05-bypass-failure','game');report.checks.push('miss resolves immediately with no unearned reduction');
  // Typing: true three-second prepare and seven-second input clock.
  await page.evaluate(()=>{startTypingProtocol();typingPhrase='mainframe overflow firewall';document.getElementById('typing-phrase').textContent=typingPhrase.toUpperCase();relayProtocol('typing','countdown',{phrase:typingPhrase,targetCount:typingPhrase.length});});await capture('06-typing-prepare','typing');
  await page.waitForFunction(()=>RiskPresentation.protocol()?.phase==='active');assert.equal((await protocol()).durationMs,7000);await capture('07-typing-active','typing');
  await page.locator('#typing-input').fill('mainframe x');await page.locator('#typing-input').dispatchEvent('input');assert.equal((await protocol()).errors,1);await capture('08-typing-correctable-error','typing');
  await page.locator('#typing-input').fill('mainframe over');await page.locator('#typing-input').dispatchEvent('input');assert.equal((await protocol()).errors,0);await capture('09-typing-corrected','typing');
  const mult=await page.evaluate(()=>multiplier);await page.locator('#typing-input').fill('MAINFRAME OVERFLOW FIREWALL');await page.locator('#typing-input').dispatchEvent('input');assert.equal(await page.evaluate(()=>multiplier),mult+1);await capture('10-typing-receipt','game');report.checks.push('long command, caret, correctable mismatch and case-insensitive success');
  await page.evaluate(()=>startTypingProtocol());await page.waitForFunction(()=>typingStarted);const deadline=(await protocol()).deadlineAt;await page.waitForTimeout(5500);await capture('11-typing-critical-time','typing');await page.waitForFunction(()=>RiskPresentation.protocol()?.phase==='result');const end=await page.evaluate(()=>performance.now());assert.ok(end>=deadline-100&&end<deadline+600);await capture('12-typing-timeout','game');report.checks.push('visible typing clock ends at original seven-second deadline');
  // Memory: targets must disappear from DOM presentation before recall.
  await page.evaluate(()=>startBackdoorProtocol());await capture('13-memory-memorize','backdoor');const targets=await page.evaluate(()=>backdoorTargetPositions.slice());assert.equal(await page.locator('.backdoor-cell[data-state="target"]').count(),5);
  await page.waitForFunction(()=>backdoorStarted);assert.equal(await page.locator('.backdoor-cell[data-state="target"]').count(),0);await capture('14-memory-recall','backdoor');
  await page.locator(`.backdoor-cell[data-index="${targets[0]}"]`).click();await page.locator(`.backdoor-cell[data-index="${targets[0]}"]`).click();assert.equal((await protocol()).correctCount,1);
  const wrong=Array.from({length:64},(_,n)=>n).find(n=>!targets.includes(n));await page.locator(`.backdoor-cell[data-index="${wrong}"]`).click();assert.equal((await protocol()).errors,1);await capture('15-memory-progress-error','backdoor');
  for(const n of targets.slice(1))await page.locator(`.backdoor-cell[data-index="${n}"]`).click();await capture('16-memory-result-phase','backdoor');assert.equal((await protocol()).success,true);await page.waitForFunction(()=>RiskPresentation.currentScreen()==='game');await capture('17-memory-receipt','game');report.checks.push('target reveal/recall, duplicate handling, error slots, immediate rewards and 500ms result');
  await page.evaluate(()=>startBackdoorProtocol());await page.waitForFunction(()=>backdoorStarted);const bad=await page.evaluate(()=>Array.from({length:64},(_,n)=>n).filter(n=>!backdoorTargetPositions.includes(n)).slice(0,3));
  for(const n of bad)await page.locator(`.backdoor-cell[data-index="${n}"]`).click();assert.equal((await protocol()).success,false);await capture('18-memory-failure-phase','backdoor');await page.waitForFunction(()=>RiskPresentation.currentScreen()==='game');await capture('19-memory-failure-receipt','game');report.checks.push('third wrong memory selection retains original failure rule');
  // Applied reward feedback must agree with the capped gameplay delta.
  await page.evaluate(()=>{risk=3;updateUI();bypassCharge=15;bypass();for(let i=0;i<3;i++){bypassGauge=bypassTarget;attemptBypass();}});
  assert.equal((await protocol()).rewardReduction,6);
  assert.match(await page.locator('#bypass-earned').innerText(),/−3/);
  assert.equal(await page.locator('#bypass-exit-label').innerText(),'EXIT & APPLY');
  await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>risk),0);
  report.checks.push('bypass displays the actual capped reduction at low risk');
  // A completed protocol receipt may decorate the relay, never a later modal.
  assert.equal(await page.locator('#protocol-outcome').evaluate(e=>e.hidden),false);
  await page.evaluate(()=>RelayUI.showSettings());
  assert.equal(await page.locator('#protocol-outcome').evaluate(e=>e.hidden),true);
  report.checks.push('protocol receipt clears before settings becomes visible');
  await page.waitForTimeout(3000);report.settled=await page.evaluate(()=>({state:RiskPresentation.snapshot(),scene:BlacksiteScene.getDiagnostics()}));assert.deepEqual(report.errors,[]);
 }catch(e){report.failure=e.stack;throw e;}finally{await fs.writeFile(path.join(out,'protocol-report.json'),JSON.stringify(report,null,2));await closeTestApp(app);console.log(JSON.stringify({screens:report.screens.length,checks:report.checks,errors:report.errors,failure:report.failure},null,2));}
})().catch(e=>{console.error(e);process.exitCode=1;});

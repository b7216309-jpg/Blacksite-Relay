const closeTestApp = require('./close-test-app.cjs');
/* Native Electron bonus-state and tooltip audit with isolated test profiles. */
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const repo=path.resolve(__dirname,'..'),{_electron:electron}=require(path.join(repo,'node_modules/playwright'));
// RISK_V2_QA_DIR overrides the parent QA directory; outputs are isolated under bonus-ui.
const out=path.resolve(process.env.RISK_V2_QA_DIR||path.join(repo,'dist','qa'),'bonus-ui');
const report={scales:[],states:[],checks:[],errors:[]};
(async()=>{
 await fs.mkdir(out,{recursive:true});
 for(const scale of [1,1.25,1.5,2]){
  const profile=path.join(out,'profile-'+scale);await fs.mkdir(profile,{recursive:true});
  await fs.writeFile(path.join(profile,'user_data.json'),JSON.stringify({playerName:'BONUS_UI_QA',musicVolume:0,sfxVolume:0,tutorialSeen:true,presentation:{introSeen:true,reducedMotion:true}}));
  const app=await electron.launch({executablePath:require(path.join(repo,'node_modules/electron')),args:[repo,'--force-device-scale-factor='+scale],env:{...process.env,RISK_V2_TEST_MODE:'1',RISK_V2_USER_DATA_DIR:profile},timeout:120000});
  try{
   const page=await app.firstWindow();page.on('pageerror',error=>report.errors.push(error.message));await app.context().setOffline(true);
   await page.waitForFunction(()=>!window.RiskSaveLoading&&window.RiskPresentation?.snapshot().playerName==='BONUS_UI_QA');
   const fresh=async(hackFirst=true)=>page.evaluate(hackFirst=>{if(RiskPresentation.currentScreen()==='persistent')backToMenu();else document.getElementById('main-menu').style.display='flex';showPersistentUpgrades();startGame();money=1000;risk=0;Math.random=()=>.99;if(hackFirst)hack(1);updateUI();},hackFirst);
   const states=()=>page.evaluate(()=>({money,risk,bonusCosts:RiskPresentation.snapshot().bonusCosts,statuses:RiskPresentation.snapshot().bonusStatuses,available:RiskPresentation.snapshot().bonusAvailable,
    buttons:[...document.querySelectorAll('.bonus-section .btn-bonus')].map(button=>({disabled:button.disabled,ariaDisabled:button.getAttribute('aria-disabled'),ariaLabel:button.getAttribute('aria-label'),status:button.querySelector('small').textContent,visibleStatus:getComputedStyle(button.querySelector('small')).opacity,price:button.querySelector('[id^=price]').textContent,dataset:{...button.dataset},small:button.querySelector('small').outerHTML}))}));
   const expect=async(name,expected)=>{await page.waitForTimeout(100);const value=await states();report.states.push({scale,name,...value});assert.deepEqual(value.statuses,expected,name);value.buttons.forEach((button,i)=>{assert.equal(button.disabled,false,'all bonuses stay keyboard inspectable');assert.equal(button.ariaDisabled,String(!value.available[i]));assert.equal(button.status,expected[i]);assert.ok(button.ariaLabel.includes(expected[i]));if(expected[i]!=='READY')assert.equal(button.visibleStatus,'1',name+' unavailable reason visible at '+(i+1));});return value;};
   const shot=async(name)=>{await page.mouse.move(2,2);await page.screenshot({path:path.join(out,scale+'-'+name+'.png')});};
   await fresh();await expect('ready',Array(6).fill('READY'));await shot('ready');
   const buttons=page.locator('.bonus-section .btn-bonus'),sc={scale,tooltips:[],mouseChecks:0};report.scales.push(sc);
   await page.clock.install();await page.clock.pauseAt(await page.evaluate(()=>Date.now()+100));
   await page.locator('.btn-transfer').focus();await page.keyboard.press('Tab');
   for(let i=0;i<6;i++){
    if(i)await page.keyboard.press('Tab');
    assert.equal(await buttons.nth(i).evaluate(e=>document.activeElement===e),true,'Tab follows bonus order');
    assert.equal(await page.locator('#relay-tooltip').evaluate(e=>e.hidden),true,'new keyboard target starts with a hidden tooltip');await page.clock.runFor(3000);
    const tooltip=await page.locator('#relay-tooltip').evaluate(e=>{const r=e.getBoundingClientRect();return {hidden:e.hidden,text:e.textContent,x:r.x,y:r.y,right:r.right,bottom:r.bottom,font:getComputedStyle(e).fontSize,scrollHeight:e.scrollHeight,height:r.height};});
    assert.equal(tooltip.hidden,false);assert.ok(tooltip.x>=0&&tooltip.y>=0&&tooltip.right<=420&&tooltip.bottom<=650);assert.ok(tooltip.scrollHeight<=tooltip.height);assert.equal(tooltip.font,'12px');
    assert.equal(await buttons.nth(i).getAttribute('aria-describedby'),'relay-tooltip');
    await page.screenshot({path:path.join(out,scale+'-tooltip-'+(i+1)+'.png')});sc.tooltips.push(tooltip);
   }
   await page.clock.resume();
   await fresh(false);await page.evaluate(()=>{buyBonus(2);buyBonus(6);});await expect('mixed-active-locks',['CLEAR','ACTIVE','HACK FIRST','LOCKED','CLEAR','ACTIVE']);await shot('mixed-states');
   await fresh();await page.evaluate(()=>{money=.004;risk=50;updateUI();});await expect('sub-cent',['LOW FUNDS','READY','READY','LOW FUNDS','LOW FUNDS','READY']);
   assert.equal(await page.locator('#money-text').innerText(),'<$0.01');
   for(const id of [2,3,6]){const price=page.locator('#price-'+id);assert.equal(await price.innerText(),'<$0.01');assert.equal(await price.getAttribute('title'),'Less than 0.01 dollars');assert.equal(await price.evaluate(e=>e.scrollWidth<=e.clientWidth),true,'sub-cent cost fits');}await shot('sub-cent');
   await page.evaluate(()=>{document.getElementById('main-menu').style.display='flex';showPersistentUpgrades();pUpgrades.algo.lvl=4;updatePersistentUI();});
   const upgrade=page.locator('#btn-p-5');assert.match(await upgrade.innerText(),/Jackpot: 5% \/ Bust: 5%/);assert.equal(await upgrade.evaluate(e=>[...e.querySelectorAll('span')].every(s=>s.scrollWidth<=s.clientWidth)),true,'Deep Learning effect text fits');await shot('deep-learning');
   await fresh();
   await page.clock.pauseAt(await page.evaluate(()=>Date.now()+100));await page.locator('.btn-transfer').focus();await page.keyboard.press('Tab');await page.clock.runFor(3000);assert.equal(await page.locator('#relay-tooltip').evaluate(e=>e.hidden),false);
   await page.keyboard.press('Escape');assert.equal(await page.locator('#relay-tooltip').evaluate(e=>e.hidden),true);
   for(let i=0;i<6;i++){await page.mouse.move(2,2);const box=await buttons.nth(i).boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);assert.equal(await page.locator('#relay-tooltip').evaluate(e=>e.hidden),true);await page.clock.runFor(3000);assert.equal(await page.locator('#relay-tooltip').evaluate(e=>e.hidden),false);assert.equal(await page.locator('.bonus-section [aria-describedby="relay-tooltip"]').count(),1);sc.mouseChecks++;}
   await page.clock.resume();
   await page.mouse.move(2,2);
   if(scale===1){
    await fresh(false);await expect('clear-and-first-hack',['CLEAR','READY','HACK FIRST','READY','CLEAR','READY']);await shot('clear-first-hack');
    await buttons.nth(2).focus();await page.keyboard.press('Enter');assert.equal((await states()).money,1000,'locked Gamble does not spend');await page.keyboard.press('Escape');
    await buttons.first().focus();await page.keyboard.press('Enter');assert.equal((await states()).money,1000,'clear Cooler does not spend');
    await fresh();await page.evaluate(()=>{money=5;risk=50;updateUI();});await expect('low-funds',['LOW FUNDS','READY','READY','LOW FUNDS','LOW FUNDS','READY']);await shot('low-funds');
    await page.evaluate(()=>{money=0;updateUI();});await expect('zero-funds',Array(6).fill('LOW FUNDS'));await buttons.first().focus();
    for(let i=1;i<6;i++){await page.keyboard.press('Tab');assert.equal(await buttons.nth(i).evaluate(e=>document.activeElement===e),true,'unavailable buttons remain in Tab order');}await shot('zero-funds-focus');
    await fresh();await page.evaluate(()=>buyBonus(2));await expect('insured',['READY','ACTIVE','READY','READY','READY','READY']);await shot('insured-active');
    await fresh();await page.evaluate(()=>buyBonus(4));await expect('ghost-active',['READY','READY','READY','ACTIVE','READY','LOCKED']);await shot('ghost-locks-overclock');
    await fresh();await page.evaluate(()=>buyBonus(6));await expect('overclock-active',['READY','READY','READY','LOCKED','READY','ACTIVE']);await shot('overclock-locks-ghost');
    await page.evaluate(()=>{hack(1);hack(1);});await expect('overclock-cooldown',['READY','READY','READY','READY','READY','5 HACKS']);await shot('overclock-cooldown');
    await fresh();await page.evaluate(()=>{buyBonus(4);risk=50;const rolls=[.99,0,.99,.99,.99];Math.random=()=>rolls.length?rolls.shift():.99;hack(1);});await expect('ghost-spent',['READY','READY','READY','4 HACKS','READY','READY']);await shot('ghost-cooldown');
    await fresh();await page.evaluate(()=>{Math.random=()=>.5;buyBonus(3);Math.random=()=>.99;});await expect('gamble-cooldown',['READY','READY','5 HACKS','READY','READY','READY']);await shot('gamble-cooldown');
    report.checks.push('Ready, low/zero funds, CLEAR, HACK FIRST, Insure/Ghost/Overclock active, mutual lock, and cooldown states agree with native buttons and guarded actions.');
   }
  }finally{await closeTestApp(app);}
 }
 report.checks.push('All six tooltip copies remain contained and readable at four native Electron scales; real Tab, mouse hover and Escape work.');
 assert.deepEqual(report.errors,[]);report.passed=true;
})().catch(error=>{report.failure=error.stack;process.exitCode=1;}).finally(async()=>{await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,scales:report.scales.map(s=>({scale:s.scale,tooltips:s.tooltips.length,mouse:s.mouseChecks})),states:report.states.length,errors:report.errors,failure:report.failure},null,2));});

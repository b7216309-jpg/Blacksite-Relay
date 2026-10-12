'use strict';
// Native Electron localization QA. Rare states below are injected only into a guarded isolated profile.
const { _electron: electron } = require('playwright');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const closeTestApp = require('./close-test-app.cjs');
const repo = path.resolve(__dirname, '..');
const output = path.resolve(process.env.RISK_V2_QA_DIR || path.join(repo, 'dist', 'qa', 'language'));
const executablePath = process.env.RISK_V2_EXECUTABLE || require('electron');
const scales = [1, 1.25, 1.5, 2];
const seed = { money:0,totalMoney:12500,playerName:'Zoé_Éclair_<NoScript>',pUpgrades:{ram:{lvl:4},vpn:{lvl:3},miner:{lvl:2},fan:{lvl:5},algo:{lvl:1},volt:{lvl:2}},achievements:{firstBlood:{unlocked:true}},prestigeLevel:2,prestigePoints:3,musicVolume:.21,sfxVolume:.37,tutorialSeen:true,presentation:{version:1,reducedMotion:false,effectsLevel:'full',introSeen:true,language:'en'} };
const report = { version:require('../package.json').version,target:process.env.RISK_V2_EXECUTABLE?'packaged':'source',createdAt:new Date().toISOString(),passed:false,errors:[],checks:[],scales,screens:[],offline:true,fixture:'Dedicated test profile. Rare balances, protocol outcomes, record rows and intro/quit states are injected only for presentation checks; deadlines and RNG invariance are checked separately.' };
let app, page, currentScale;
const check = async (name, fn) => { await fn(); report.checks.push({name,scale:currentScale,passed:true}); };
async function launch(profile, scale) {
  app = await electron.launch({executablePath,args:[...(process.env.RISK_V2_EXECUTABLE?[]:[repo]),'--force-device-scale-factor='+scale],env:{...process.env,RISK_V2_TEST_MODE:'1',RISK_V2_USER_DATA_DIR:profile},timeout:120000});
  page = await app.firstWindow();
  page.on('pageerror', error => report.errors.push(error.message));
  await app.context().setOffline(true);
  await app.evaluate(({BrowserWindow}) => BrowserWindow.getAllWindows().forEach(window => window.webContents.setAudioMuted(true)));
  await page.waitForFunction(() => window.RiskSaveLoading === false && window.RiskPresentation?.snapshot()?.playerName==='Zoé_Éclair_<NoScript>' && window.RiskI18n?.getDiagnostics().frenchKeys>300 && window.RelayMenuScenes?.getDiagnostics().ready && window.RelayPets?.getDiagnostics().ready);
  await page.waitForFunction(() => innerWidth===420 && innerHeight===650);
}
async function capture(name) {
  await page.waitForTimeout(250); // Inspect the settled panel after its 120ms entrance.
  const relative = 'screenshots/'+String(currentScale).replace('.','_')+'-'+name+'.png';
  await page.screenshot({path:path.join(output,relative)});
  const layout = await page.evaluate(() => {
    const active = RiskPresentation.currentScreen();
    const ids = {menu:'main-menu',persistent:'screen-persistent',tutorial:'screen-tutorial',achievements:'screen-achievements',leaderboard:'screen-leaderboard',settings:'screen-settings',typing:'typing-container',backdoor:'backdoor-container',bypass:'screen-bypass',busted:'screen-busted',success:'screen-success',intro:'screen-intro'};
    const scope = document.getElementById(ids[active]) || document.querySelector('.game-container') || document.body;
    const visible = node => {
      const rect=node.getBoundingClientRect();
      return rect.width>0 && rect.height>0 && rect.bottom>0 && rect.top<innerHeight && rect.right>0 && rect.left<innerWidth && !node.closest('[hidden],[inert]') && getComputedStyle(node).visibility!=='hidden';
    };
    const clipping=[];
    for (const node of scope.querySelectorAll('button,h1,h2,h3,p,th,td,dt,dd,strong,small,kbd,label,span')) {
      if (!visible(node) || node.closest('[aria-hidden="true"]')) continue;
      const style=getComputedStyle(node), rect=node.getBoundingClientRect();
      if (node.clientWidth>0 && node.scrollWidth>node.clientWidth+1 && !['auto','scroll'].includes(style.overflowX)) clipping.push({id:node.id,className:node.className,text:node.textContent.trim().slice(0,100),client:node.clientWidth,scroll:node.scrollWidth,rect:{x:rect.x,y:rect.y,width:rect.width,height:rect.height}});
      if (node.id==='multiplier-text' && rect.height>parseFloat(style.lineHeight)+1) clipping.push({id:node.id,text:node.textContent,problem:'multiplier wraps into adjacent risk/node rows',height:rect.height,lineHeight:style.lineHeight});
    }
    return {screen:active,width:innerWidth,height:innerHeight,devicePixelRatio,language:RiskI18n.language,htmlLanguage:document.documentElement.lang,clipping};
  });
  assert.equal(layout.width,420);assert.equal(layout.height,650);assert.equal(layout.language,'fr');
  report.screens.push({name,path:relative,scale:currentScale,...layout});
}
async function menu() {
  await page.evaluate(() => {
    for (const [,id] of relayScreenOrder) { const node=document.getElementById(id);if(node)node.style.display='none'; }
    document.getElementById('main-menu').style.display='flex';publishPresentation();
  });
}
async function switchInvariant() {
  return page.evaluate(() => {
    const raw = () => JSON.stringify({money,risk,totalMoney,multiplier,nodesHacked,nodesValidated,bypassCharge,bypassLevel,bypassSpeed,bypassTolerance,insuranceTurns,ghostShieldActive,ghostCooldown,overclockCooldown,overclockBonusTurns,gambleCooldown,pUpgrades,prestigeLevel,prestigePoints,musicVolume,sfxVolume,sessionHackCount,sessionStats,achievementStats,typingPhrase,typingErrors,typingDeadlineAt,backdoorDeadlineAt,backdoorTargetPositions,backdoorClicked,backdoorErrors,run:RiskPresentation.snapshot().runId,bonusAvailability:getBonusAvailability(),activeMiniGame:activeMiniGame&&{game:activeMiniGame.game,phase:activeMiniGame.phase,generation:activeMiniGame.generation},achievements:Object.fromEntries(Object.entries(achievements).map(([key,value])=>[key,{goal:value.goal,unlocked:value.unlocked}]))});
    const before=raw(), nativeRandom=Math.random, input=document.getElementById('typing-input'), focus=document.activeElement;let draws=0;
    const value=input.value;Math.random=()=>{draws++;return nativeRandom();};
    let after;
    try { RiskI18n.setLanguage('en',{persist:false});RiskI18n.setLanguage('fr',{persist:false});after=raw(); }
    finally { Math.random=nativeRandom; }
    return {same:before===after,draws,focusSame:document.activeElement===focus,inputSame:input.value===value};
  });
}
(async()=>{
  await fs.mkdir(path.join(output,'screenshots'),{recursive:true});
  for (const scale of scales) {
    currentScale=scale;
    const profile=path.join(output,'profiles','scale-'+String(scale).replace('.','_'));
    await fs.mkdir(profile,{recursive:true});
    await fs.writeFile(path.join(profile,'user_data.json'),JSON.stringify({...seed,presentation:{...seed.presentation,language:scale===1?'en':'fr'}}));
    try {
      await launch(profile,scale);
      if(scale===1){
        await check('settings selector swaps to French and preserves permanent progress and volume',async()=>{
          await page.locator('.menu-tertiary button').first().click();
          await page.locator('#language-select').selectOption('fr');
          await page.evaluate(()=>saveGameState());
          assert.equal(await page.locator('html').getAttribute('lang'),'fr');
          const data=JSON.parse(await fs.readFile(path.join(profile,'user_data.json'),'utf8'));
          assert.equal(data.presentation.language,'fr');assert.equal(data.totalMoney,seed.totalMoney);assert.equal(data.prestigePoints,seed.prestigePoints);assert.equal(data.musicVolume,.21);assert.equal(data.sfxVolume,.37);assert.equal(data.playerName,seed.playerName);
          for(const [key,value] of Object.entries(seed.pUpgrades))assert.equal(data.pUpgrades[key].lvl,value.lvl);
          assert.equal(data.achievements.firstBlood.unlocked,true);
        });
        await closeTestApp(app);app=null;await launch(profile,scale);
        await check('French survives native relaunch from the isolated save',async()=>{assert.equal(await page.evaluate(()=>RiskI18n.language),'fr');assert.equal(await page.locator('#language-select').inputValue(),'fr');});
      }
      await capture('01-menu');
      await page.evaluate(()=>RelayUI.showSettings());await capture('02-settings');await page.evaluate(()=>RelayUI.hideSettings());
      await page.locator('.initiate').click();await capture('03-upgrades');
      await page.locator('.upgrade-scroll').evaluate(node=>node.scrollTop=node.scrollHeight);await capture('04-prestige');await page.evaluate(()=>backToMenu());
      await page.locator('#menu-guide-trigger').click();await capture('05-guide-overview');
      for(const topic of ['hacks','bonuses','protocols','progression']){
        await page.locator('[data-guide-topic="'+topic+'"]').click();
        await capture('06-guide-'+topic);
        if(topic==='bonuses')await page.locator('#guide-bonuses details').evaluateAll(nodes=>nodes.forEach(node=>node.open=true));
        await page.locator('#guide-scroll').evaluate(node=>node.scrollTop=Math.min(80,node.scrollHeight-node.clientHeight));
        await check('guide '+topic+' keeps its page, expanded details and scroll on swap',async()=>{
          const before=await page.evaluate(()=>({page:RelayGuide.getDiagnostics().page,scroll:document.getElementById('guide-scroll').scrollTop,details:[...document.querySelectorAll('#guide-bonuses details')].map(node=>node.open)}));
          assert.deepEqual(await switchInvariant(),{same:true,draws:0,focusSame:true,inputSame:true});
          const after=await page.evaluate(()=>({page:RelayGuide.getDiagnostics().page,scroll:document.getElementById('guide-scroll').scrollTop,details:[...document.querySelectorAll('#guide-bonuses details')].map(node=>node.open)}));
          assert.deepEqual(after,before);
        });
        await page.locator('#guide-scroll').evaluate(node=>node.scrollTop=node.scrollHeight);await capture('07-guide-'+topic+'-end');
        await page.locator('#guide-back').click();
      }
      await page.locator('#guide-close').click();
      await page.evaluate(()=>showAchievements());await capture('08-achievements');
      await check('34 French achievements retain IDs, goals, unlocked status and hidden secrets',async()=>{
        const data=await page.evaluate(()=>({entries:getAchievementPresentation(),html:document.getElementById('achievements-list').textContent}));
        assert.equal(data.entries.length,34);assert.equal(data.entries.find(value=>value.id==='hearthstone').name,'PIERRE DE FOYER');assert.equal(data.entries.find(value=>value.id==='nodeRunner').name,'DE NŒUD EN NŒUD');
        assert.ok(data.entries.every(entry=>!/[{}]/.test(entry.description)));assert.ok(!data.html.includes('PIERRE DE FOYER'));assert.ok(!data.html.includes('LEEROY JENKINS'));
        assert.deepEqual(await switchInvariant(),{same:true,draws:0,focusSame:true,inputSame:true});
      });
      await page.locator('#achievements-list').evaluate(node=>node.scrollTop=node.scrollHeight);await capture('09-secret-achievements');await page.evaluate(()=>backToMenuFromAchievements());
      await page.evaluate(async()=>{await electronAPI.submitScore('Éloïse_LaTrèsLongueIdentité',1.25e12);await electronAPI.submitScore('Zoé <b>reste du texte</b>',12.75);await showLeaderboard();});
      await page.waitForFunction(()=>document.getElementById('leaderboard-list').getAttribute('aria-busy')==='false');await capture('10-local-leaderboard');
      await check('local record values and literal player identities survive language flips without record writes',async()=>{
        const before=await fs.stat(path.join(profile,'local_leaderboard.json'));
        assert.deepEqual(await switchInvariant(),{same:true,draws:0,focusSame:true,inputSame:true});
        const after=await fs.stat(path.join(profile,'local_leaderboard.json'));assert.equal(after.mtimeMs,before.mtimeMs);
        assert.equal(await page.locator('#leaderboard-list b').count(),0);assert.match(await page.locator('#leaderboard-list').innerText(),/Zoé <b>reste du texte<\/b>/);
      });
      await page.evaluate(()=>backToMenuFromLeaderboard());await page.locator('.initiate').click();await page.evaluate(()=>startGame());
      await page.evaluate(()=>{money=1280;risk=34;multiplier=8;nodesHacked=47;nodesValidated=4;bypassCharge=7;ghostShieldActive=true;insuranceTurns=3;gambleCooldown=3;coolerPurchases=2;ghostPurchases=1;sessionHackCount=4;updateUI();logGame('log.session','SESSION_START: {name}','info',{name:playerName});});
      await capture('11-gameplay');
      await check('running game and historical log translate without economy, RNG or deadline changes',async()=>{assert.deepEqual(await switchInvariant(),{same:true,draws:0,focusSame:true,inputSame:true});assert.match(await page.locator('#log-container').innerText(),/DÉBUT DE PARTIE/);});
      if(scale===1){
        for(let id=1;id<=6;id++){
          await page.locator('#price-'+id).locator('..').hover();
          await page.waitForTimeout(500);assert.equal(await page.locator('#relay-tooltip').isVisible(),false);
          await page.waitForTimeout(2700);assert.equal(await page.locator('#relay-tooltip').isVisible(),true);
          await capture('12-bonus-'+id+'-tooltip');
          const box=await page.locator('#relay-tooltip').boundingBox();assert.ok(box.x>=0&&box.y>=0&&box.x+box.width<=420.5&&box.y+box.height<=650.5);
          assert.ok((await page.locator('#relay-tooltip').innerText()).length>20);
          await page.mouse.move(410,645);
        }
        report.checks.push({name:'All six French bonus tooltips retain their three-second delay and viewport containment',scale,passed:true});
      }
      await page.evaluate(()=>{money=1.234567e15;multiplier=1e8;risk=89;ghostCooldown=5;overclockCooldown=7;prestigeLevel=150;updateUI();});await capture('13-high-values');
      await page.evaluate(()=>{money=1280;multiplier=8;risk=34;ghostCooldown=0;overclockCooldown=0;prestigeLevel=2;updateUI();bypassCharge=15;bypass();});await capture('14-bypass');
      await check('Dérivation gauge rules, focus and stages remain unchanged during swap',async()=>{assert.deepEqual(await switchInvariant(),{same:true,draws:0,focusSame:true,inputSame:true});});
      await page.evaluate(()=>{bypassLevel=4;exitBypassGame();});await capture('15-bypass-receipt');
      await check('a language swap keeps the current protocol receipt without duplicating its cleared log',async()=>{
        assert.equal(await page.locator('#protocol-outcome').isVisible(),true);
        assert.equal((await page.locator('#log-container').innerText()).trim(),'');
        assert.deepEqual(await switchInvariant(),{same:true,draws:0,focusSame:true,inputSame:true});
        assert.equal(await page.locator('#protocol-outcome').isVisible(),true);assert.equal((await page.locator('#log-container').innerText()).trim(),'');
        assert.match(await page.locator('#protocol-outcome-detail').innerText(),/Risque/);
      });
      await page.evaluate(()=>startTypingProtocol());await capture('16-injection-prepare');
      await page.waitForFunction(()=>typingStarted);await capture('17-injection-active');
      await check('Injection keeps the exact command, deadline, input and focus during a live swap',async()=>{assert.deepEqual(await switchInvariant(),{same:true,draws:0,focusSame:true,inputSame:true});});
      const phrase=await page.evaluate(()=>typingPhrase);await page.locator('#typing-input').fill(phrase);await page.locator('#typing-input').dispatchEvent('input');await capture('18-injection-receipt');
      await page.evaluate(()=>startBackdoorProtocol());await capture('19-memory-prepare');await page.waitForFunction(()=>backdoorStarted);await capture('20-memory-active');
      await check('Mémoire keeps hidden targets, deadline and error state during a live swap',async()=>{assert.deepEqual(await switchInvariant(),{same:true,draws:0,focusSame:true,inputSame:true});assert.match(await page.locator('.backdoor-cell').first().getAttribute('aria-label'),/Port/);});
      const positions=await page.evaluate(()=>backdoorTargetPositions.slice());for(const index of positions)await page.locator('.backdoor-cell[data-index="'+index+'"]').click();await capture('21-memory-result');
      await page.waitForFunction(()=>RiskPresentation.currentScreen()==='game');
      await page.evaluate(()=>{money=1280;risk=89;ghostShieldActive=false;insuranceTurns=3;showBusted();});await capture('22-busted');
      await check('pre-reset bust recap translates without replaying its outcome',async()=>{assert.deepEqual(await switchInvariant(),{same:true,draws:0,focusSame:true,inputSame:true});assert.match(await page.locator('#screen-busted').innerText(),/Risque/);});
      await page.evaluate(()=>closeOverlays());await page.evaluate(()=>startGame());
      await page.evaluate(()=>{money=2468.5;risk=21;sessionHackCount=5;sessionStats.maxRisk=63;sessionStats.maxNodes=3;sessionStats.maxMultiplier=8;transfer();});await capture('23-transfer');
      await check('transfer recap retains banked funds across a language swap',async()=>{assert.deepEqual(await switchInvariant(),{same:true,draws:0,focusSame:true,inputSame:true});assert.match(await page.locator('#screen-success').innerText(),/2[\s\u202f]468,5/);});
      await page.evaluate(()=>{lastGameResult={kind:'success',money:1.7e306,risk:99,maxRisk:100,maxNodes:12345,maxMultiplier:1.23e50};renderGameRecap();});
      await capture('24-extreme-result');
      await check('extreme saved result values retain a readable magnitude instead of hundreds of digits',async()=>{
        const text=await page.locator('#screen-success p').innerText();assert.match(text,/1,70e\+306/);assert.match(text,/1,23e\+50/);assert.ok(text.length<220);
      });
      await menu();await page.evaluate(()=>RelayUI.showSettings());
      await check('English can be restored with the actual settings selector',async()=>{await page.locator('#language-select').selectOption('en');assert.equal(await page.locator('html').getAttribute('lang'),'en');assert.match(await page.locator('#screen-settings').innerText(),/MUSIC/);await page.locator('#language-select').selectOption('fr');});
      const diagnostics=await page.evaluate(()=>RiskI18n.getDiagnostics());assert.deepEqual(diagnostics.missingFrench,[]);assert.deepEqual(diagnostics.missingEnglish,[]);assert.equal(diagnostics.ownTimers,0);
      report.catalog=diagnostics;
    } finally {if(app){await closeTestApp(app);app=null;}}
  }
  assert.deepEqual(report.errors,[]);
  report.clipping=report.screens.filter(screen=>screen.clipping.length).map(({name,scale,clipping})=>({name,scale,clipping}));
  assert.deepEqual(report.clipping,[],'Visible text must fit; intentional scrolling does not excuse clipped labels, numbers or units.');
  report.passed=true;
})().catch(error=>{report.failure=error.stack;process.exitCode=1;}).finally(async()=>{
  if(app){try{await closeTestApp(app);}catch(error){report.errors.push(error.message);}}
  await fs.mkdir(output,{recursive:true});await fs.writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({passed:report.passed,checks:report.checks.length,screens:report.screens.length,errors:report.errors,failure:report.failure,report:path.join(output,'report.json')},null,2));
});

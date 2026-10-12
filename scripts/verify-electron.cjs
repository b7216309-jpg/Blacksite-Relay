const closeTestApp = require('./close-test-app.cjs');
const { _electron: electron } = require('playwright');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const output=path.resolve(process.env.RISK_V2_QA_DIR || path.join(root,'dist','qa'));
const seed={money:0,totalMoney:12500,playerName:'QA_AGENT',pUpgrades:{ram:{lvl:2},miner:{lvl:1}},achievements:{firstBlood:{unlocked:true}},prestigeLevel:1,prestigePoints:1,musicVolume:0,sfxVolume:0,tutorialSeen:true,presentation:{version:1,reducedMotion:false,effectsLevel:'full',introSeen:true}};
const overlayIds=['main-menu','screen-persistent','screen-tutorial','screen-achievements','screen-leaderboard','screen-busted','screen-success','screen-bypass','typing-container','backdoor-container','screen-settings','screen-intro'];
(async()=>{
  await fs.mkdir(path.join(output,'screenshots'),{recursive:true});
  const dataDir=path.join(output,'user-data');await fs.mkdir(dataDir,{recursive:true});await fs.writeFile(path.join(dataDir,'user_data.json'),JSON.stringify(seed));
  const app=await electron.launch({executablePath:process.env.RISK_V2_EXECUTABLE || require('electron'),args:process.env.RISK_V2_EXECUTABLE?[]:[root],env:{...process.env,RISK_V2_TEST_MODE:'1',RISK_V2_USER_DATA_DIR:dataDir},timeout:120000});
  const report={createdAt:new Date().toISOString(),screens:[],checks:[],errors:[]};
  try {
    const page=await app.firstWindow();page.on('pageerror',e=>report.errors.push(e.message));
    await app.context().setOffline(true);report.offline=true;
    await page.waitForFunction(()=>window.RiskPresentation?.snapshot()?.playerName==='QA_AGENT'&&window.RelayPets?.getDiagnostics().ready&&window.RelayLighting?.getDiagnostics().ready&&window.RelayShadows?.getDiagnostics().ready&&window.RelayProtocolLife?.getDiagnostics().ready);
    await page.waitForTimeout(300);
    report.versions=await app.evaluate(()=>process.versions);
    const check=async(name,fn)=>{await fn();report.checks.push(name);};
    const capture=async(name)=>{
      await page.waitForTimeout(200);
      await page.screenshot({path:path.join(output,'screenshots',name+'.png')});
      const layout=await page.evaluate(()=>{
        const visible=e=>e.getClientRects().length>0 && getComputedStyle(e).visibility!=='hidden';
        const controls=[...document.querySelectorAll('button,input,select')].filter(visible);
        return {width:innerWidth,height:innerHeight,screen:window.RiskPresentation.currentScreen(),overflow:controls.filter(e=>{const r=e.getBoundingClientRect();return r.x<-.5||r.y<-.5||r.right>innerWidth+.5||r.bottom>innerHeight+.5;}).map(e=>({id:e.id,text:e.textContent.trim().slice(0,45)})),scene:window.BlacksiteScene?.getDiagnostics(),pets:window.RelayPets?.getDiagnostics(),lighting:window.RelayLighting?.getDiagnostics(),shadows:window.RelayShadows?.getDiagnostics(),hardware:window.RelayProtocolLife?.getDiagnostics()};
      });
      report.screens.push({name,...layout});
      assert.equal(layout.width,420);assert.equal(layout.height,650);
      const expected={'01-menu':'menu','02-upgrades':'persistent','03-game-start':'game','04-extraction':'success','05-gameplay':'game','06-high-risk':'game','07-stress-values':'game','08-tutorial':'tutorial','08-achievements':'achievements','08-leaderboard':'leaderboard','09-bypass':'bypass','10-typing-countdown':'typing','11-backdoor-memory':'backdoor','12-backdoor-active':'backdoor','13-busted':'busted','14-settings':'settings','15-intro':'intro','16-reduced-scene':'game','17-static-scene':'game'}[name];
      assert.equal(layout.screen,expected,name+' must show its intended screen');
      const menus=await page.evaluate(()=>RelayMenuScenes.getDiagnostics());
      layout.menuScenes=menus;
      assert.equal(menus.ready,true);assert.equal(menus.error,false);assert.equal(menus.canvasCount,5);assert.equal(menus.ownedTimers,0);
      const submenuRooms={persistent:'workbench',tutorial:'briefing',achievements:'records',leaderboard:'signal',settings:'controls'};
      assert.equal(menus.activeRoom,submenuRooms[layout.screen]||null,'only current submenu owns its artwork');
      if(!submenuRooms[layout.screen])assert.equal(menus.ownedRAF,0,'outside submenus has no menu animation loop');
      assert.ok(layout.hardware.ready);assert.equal(layout.hardware.ownedTimers,0);assert.equal(layout.hardware.canvasCount,3);
      if(['bypass','typing','backdoor'].includes(layout.screen)){
        assert.equal(layout.hardware.visibleDevice,layout.screen);assert.equal(layout.hardware.ownedRAF,1);
        const device=layout.hardware.devices.find(item=>item.game===layout.screen);assert.ok(device.leds>0&&device.leds<=8);assert.ok(device.sparks<=1);if(device.phase==='active')assert.equal(device.sweeps,0);
      }else{assert.equal(layout.hardware.visibleDevice,null);assert.equal(layout.hardware.ownedRAF,0);assert.ok(layout.hardware.devices.every(item=>item.pixels===0));}
    };
    await capture('01-menu');
    await check('three pet designs populate four residents without own timers or frame loops',async()=>{const p=await page.evaluate(()=>RelayPets.getDiagnostics());assert.equal(p.ready,true);assert.equal(p.error,false);assert.equal(p.residentLimit,4);assert.deepEqual(Object.keys(p.textures).sort(),['cat','rat','snail']);assert.deepEqual(p.residents.map(r=>r.kind).sort(),['cat','rat','rat','snail']);assert.equal(p.ownTimers,0);assert.equal(p.ownAnimationFrames,0);});
    await check('lighting initializes eleven maps with bounded view buffers and no own loops',async()=>{const l=await page.evaluate(()=>RelayLighting.getDiagnostics());assert.equal(l.ready,true);assert.equal(l.error,false);assert.equal(l.mapCount,11);assert.ok(l.viewBuffers>0&&l.viewBuffers<=4);assert.equal(l.ownTimers,0);assert.equal(l.ownAnimationFrames,0);});
    await check('five resident shadows stay within fixed receiver and cache limits',async()=>{const s=await page.evaluate(()=>RelayShadows.getDiagnostics());assert.equal(s.ready,true);assert.equal(s.error,false);assert.equal(s.canvasCount,1);assert.equal(s.receiverMasks,3);assert.equal(s.casterLimit,5);assert.equal(s.casters.length,5);assert.ok(s.sourceCaches<=5);assert.ok(s.shadowPixels>0&&s.shadowPixels<4000);assert.equal(s.ownTimers,0);assert.equal(s.ownAnimationFrames,0);});
    await check('legacy save and mute settings restored',async()=>{const s=await page.evaluate(()=>RiskPresentation.snapshot());assert.equal(s.totalMoney,12500);assert.equal(s.musicVolume,0);assert.equal(s.sfxVolume,0);assert.equal(s.prestigeLevel,1);});
    await page.evaluate(()=>showPersistentUpgrades());await capture('02-upgrades');
    await page.evaluate(()=>startGame());await capture('03-game-start');
    await check('mouse hack and Space transfer do not double-hack',async()=>{
      await page.evaluate(()=>{Math.random=()=>.99;});
      await page.locator('.btn-hack').first().click();
      const before=await page.evaluate(()=>RiskPresentation.snapshot());
      assert.ok(before.money>70);await page.keyboard.press('Space');
      const after=await page.evaluate(()=>RiskPresentation.snapshot());assert.equal(after.screen,'success');assert.equal(after.money,0);assert.equal(after.totalMoney,before.totalMoney+before.money);
    });
    await capture('04-extraction');
    await page.evaluate(()=>closeOverlays());await page.evaluate(()=>startGame());
    await page.evaluate(()=>{money=1280;risk=34;multiplier=8;nodesHacked=47;nodesValidated=4;bypassCharge=7;ghostShieldActive=true;insuranceTurns=3;gambleCooldown=3;coolerPurchases=2;ghostPurchases=1;updateUI();updateBonusPrices();});
    await capture('05-gameplay');
    await page.evaluate(()=>{risk=89;updateUI();});await capture('06-high-risk');
    await check('decorative events do not change the game state',async()=>{
      const before=await page.evaluate(()=>JSON.stringify(RiskPresentation.snapshot()));
      await page.evaluate(()=>{for(let i=0;i<20;i++)RiskPresentation.emit('hack',{hackType:3});});await page.waitForTimeout(500);
      const after=await page.evaluate(()=>JSON.stringify(RiskPresentation.snapshot()));assert.equal(after,before);
    });
    await page.evaluate(()=>{money=1.234567e12;multiplier=123;ghostShieldActive=true;ghostCooldown=5;insuranceTurns=5;overclockCooldown=7;overclockBonusTurns=0;prestigeLevel=15;updateUI();updateBonusPrices();});await capture('07-stress-values');
    await page.evaluate(()=>{money=1280;multiplier=8;ghostCooldown=0;overclockCooldown=0;prestigeLevel=1;updateUI();updateBonusPrices();});
    for(const [name,fn] of [['tutorial','showTutorial'],['achievements','showAchievements'],['leaderboard','showLeaderboard']]) {
      await page.evaluate(({fn})=>{document.getElementById('main-menu').style.display='flex';window[fn]();},{fn});
      await capture('08-'+name);
      await check(name+' blocks game shortcuts',async()=>{const before=await page.evaluate(()=>[money,risk]);await page.keyboard.press('3');await page.keyboard.press('Space');assert.deepEqual(await page.evaluate(()=>[money,risk]),before);});
      await page.evaluate(ids=>{for(const id of ids){const e=document.getElementById(id);if(e)e.style.display='none';}RiskPresentation.refresh();},overlayIds);
    }
    await page.evaluate(()=>{bypassCharge=15;bypass();});await capture('09-bypass');
    await check('bypass uses Space while focused game button remains',async()=>{await page.evaluate(()=>{document.querySelector('.btn-hack').focus();bypassGauge=bypassTarget;});await page.keyboard.press('Space');assert.equal(await page.evaluate(()=>bypassLevel),2);});
    await page.keyboard.press('Escape');
    await page.evaluate(()=>startTypingProtocol());await capture('10-typing-countdown');await page.waitForTimeout(3100);
    await page.locator('#typing-input').fill(await page.evaluate(()=>typingPhrase));
    await page.locator('#typing-input').dispatchEvent('input');
    await check('typing challenge completes from real text input',async()=>{assert.equal(await page.evaluate(()=>typingActive),false);});
    await page.evaluate(()=>startBackdoorProtocol());await capture('11-backdoor-memory');await page.waitForTimeout(3100);
    await capture('12-backdoor-active');
    const targets=await page.evaluate(()=>backdoorTargetPositions.slice());
    await page.locator(`.backdoor-cell[data-index="${targets[0]}"]`).click();
    await page.locator(`.backdoor-cell[data-index="${targets[0]}"]`).click();
    assert.equal(await page.evaluate(()=>backdoorClicked),1);
    for(const n of targets.slice(1))await page.locator(`.backdoor-cell[data-index="${n}"]`).click();
    await check('backdoor target clicks complete and duplicates are ignored',async()=>{assert.equal(await page.evaluate(()=>backdoorActive),false);});
    await page.waitForFunction(()=>RiskPresentation.currentScreen()==='game');
    await page.evaluate(()=>{money=1280;risk=89;ghostShieldActive=false;insuranceTurns=3;showBusted();});await capture('13-busted');
    await page.evaluate(()=>closeOverlays());await page.evaluate(()=>startGame());
    await page.evaluate(()=>RelayUI.showSettings());await capture('14-settings');
    await check('settings preserve zero volume and block shortcuts',async()=>{const before=await page.evaluate(()=>[money,risk]);await page.keyboard.press('3');assert.deepEqual(await page.evaluate(()=>[money,risk]),before);});
    await page.evaluate(()=>RelayUI.hideSettings());
    await check('reduced motion freezes scene, pets and lighting',async()=>{await page.evaluate(()=>RiskPresentation.setPreferences({reducedMotion:true}));await page.waitForTimeout(150);const a=await page.evaluate(()=>({frames:BlacksiteScene.getDiagnostics().frames,pets:RelayPets.getDiagnostics().draws,time:RelayPets.getDiagnostics().time,lighting:RelayLighting.getDiagnostics().draws,lightingTime:RelayLighting.getDiagnostics().time,shadowTime:RelayShadows.getDiagnostics().time,shadowBuilds:RelayShadows.getDiagnostics().builds}));await page.waitForTimeout(400);assert.deepEqual(await page.evaluate(()=>({frames:BlacksiteScene.getDiagnostics().frames,pets:RelayPets.getDiagnostics().draws,time:RelayPets.getDiagnostics().time,lighting:RelayLighting.getDiagnostics().draws,lightingTime:RelayLighting.getDiagnostics().time,shadowTime:RelayShadows.getDiagnostics().time,shadowBuilds:RelayShadows.getDiagnostics().builds})),a);await page.evaluate(()=>RiskPresentation.setPreferences({reducedMotion:false}));});
    await page.evaluate(()=>RiskPresentation.setPreferences({reducedMotion:true}));await capture('16-reduced-scene');await page.evaluate(()=>RiskPresentation.setPreferences({reducedMotion:false,effectsLevel:'off'}));await capture('17-static-scene');
    await check('static scene freezes lighting while keeping controls available',async()=>{const a=await page.evaluate(()=>({frames:BlacksiteScene.getDiagnostics().frames,lighting:RelayLighting.getDiagnostics().draws,time:RelayLighting.getDiagnostics().time,shadowTime:RelayShadows.getDiagnostics().time,shadowBuilds:RelayShadows.getDiagnostics().builds}));await page.waitForTimeout(400);assert.deepEqual(await page.evaluate(()=>({frames:BlacksiteScene.getDiagnostics().frames,lighting:RelayLighting.getDiagnostics().draws,time:RelayLighting.getDiagnostics().time,shadowTime:RelayShadows.getDiagnostics().time,shadowBuilds:RelayShadows.getDiagnostics().builds})),a);assert.equal(await page.evaluate(()=>RiskPresentation.currentScreen()),'game');});await page.evaluate(()=>RiskPresentation.setPreferences({effectsLevel:'full'}));
    await check('intro can be replayed and skipped without leaking Space',async()=>{await page.evaluate(()=>{RelayUI.showIntro({replay:true});});await page.waitForTimeout(180);await capture('15-intro');const before=await page.evaluate(()=>money);await page.keyboard.press('Space');assert.notEqual(await page.evaluate(()=>RiskPresentation.currentScreen()),'intro');assert.equal(await page.evaluate(()=>money),before);});
    await check('unavailable intro media falls back without blocking the game',async()=>{
      const original=await page.locator('#relay-intro-video').getAttribute('src');
      await page.evaluate(()=>{const v=document.getElementById('relay-intro-video');v.src='assets/scene/qa-missing.webm';v.load();RelayUI.showIntro({replay:true});});
      await page.waitForFunction(()=>RiskPresentation.currentScreen()!=='intro',{},{timeout:7000});
      await page.locator('#relay-intro-video').evaluate((v,src)=>{v.src=src;v.load();},original);
    });
    await page.evaluate(()=>{RiskPresentation.setPreferences({effectsLevel:'low',reducedMotion:true});saveGameState();});
    await page.waitForTimeout(200);
    const saved=JSON.parse(await fs.readFile(path.join(dataDir,'user_data.json'),'utf8'));
    assert.equal(saved.presentation.effectsLevel,'low');assert.equal(saved.presentation.reducedMotion,true);assert.equal(saved.musicVolume,0);
    report.checks.push('presentation preferences persisted in isolated save');
    await page.evaluate(()=>{RiskPresentation.setPreferences({effectsLevel:'full',reducedMotion:false});});
    report.audio=await page.evaluate(()=>window.RelayAudio?.getDiagnostics());
    report.scene=await page.evaluate(()=>window.BlacksiteScene?.getDiagnostics());
    report.pets=await page.evaluate(()=>window.RelayPets?.getDiagnostics());
    report.lighting=await page.evaluate(()=>window.RelayLighting?.getDiagnostics());
    report.shadows=await page.evaluate(()=>window.RelayShadows?.getDiagnostics());
    assert.deepEqual(report.errors,[]);
  } catch(error) {report.failure=error.stack;throw error;}
  finally {await fs.writeFile(path.join(output,'electron-report.json'),JSON.stringify(report,null,2));await closeTestApp(app);console.log(JSON.stringify({checks:report.checks.length,screens:report.screens.length,errors:report.errors,failure:report.failure},null,2));}
})().catch(e=>{console.error(e);process.exitCode=1;});

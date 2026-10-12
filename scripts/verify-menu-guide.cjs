const closeTestApp = require('./close-test-app.cjs');
/* Native guide navigation and submenu layout audit. Isolated profiles; no live services. */
'use strict';
const { _electron: electron } = require('playwright');
const fs = require('node:fs/promises'), path = require('node:path'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const out = path.resolve(process.env.RISK_V2_QA_DIR || path.join(root, 'dist', 'qa'), 'menu-guide');
const scales = process.env.RISK_V2_MENU_QA_SCALES ? process.env.RISK_V2_MENU_QA_SCALES.split(',').map(Number) : [1, 1.25, 1.5, 2];
const topics = ['hacks', 'bonuses', 'protocols', 'progression'];
const backdropFor={persistent:'workbench',achievements:'records',leaderboard:'signal',settings:'controls',tutorial:'briefing'};
const seed = { totalMoney:987654321000, playerName:'MENU_GUIDE_QA', pUpgrades:{ram:{lvl:2}}, achievements:{firstBlood:{unlocked:true}}, prestigeLevel:15, prestigePoints:15, musicVolume:0, sfxVolume:0, tutorialSeen:true, presentation:{introSeen:true,reducedMotion:true,effectsLevel:'full'} };
const screenIds = {menu:'main-menu',tutorial:'screen-tutorial',persistent:'screen-persistent',achievements:'screen-achievements',leaderboard:'screen-leaderboard',settings:'screen-settings',success:'screen-success',busted:'screen-busted'};
const report = {createdAt:new Date().toISOString(),method:'Real Electron scaling; real guide click/keyboard navigation; isolated fixture save and mocked leaderboard',scales:[],checks:[],errors:[],passed:false};

async function runScale(scale) {
  const profile = await fs.mkdtemp(path.join(out,'profile-'+scale+'-'));
  await fs.writeFile(path.join(profile,'user_data.json'),JSON.stringify(seed));
  const executable = process.env.RISK_V2_EXECUTABLE || require('electron');
  const app = await electron.launch({executablePath:executable,args:[...(process.env.RISK_V2_EXECUTABLE?[]:[root]),'--force-device-scale-factor='+scale],env:{...process.env,RISK_V2_TEST_MODE:'1',RISK_V2_USER_DATA_DIR:profile},timeout:120000});
  const item={scale,screens:[],checks:[]};report.scales.push(item);
  try {
    const page=await app.firstWindow();page.on('pageerror',error=>report.errors.push(error.message));await app.context().setOffline(true);
    await page.waitForFunction(()=>!window.RiskSaveLoading&&window.RiskPresentation?.snapshot().playerName==='MENU_GUIDE_QA'&&window.RelayGuide&&window.RelayMenuScenes?.getDiagnostics().ready);
    const state=()=>page.evaluate(()=>{const s=RiskPresentation.snapshot();return {money:s.money,totalMoney:s.totalMoney,risk:s.risk,prestigeLevel:s.prestigeLevel,prestigePoints:s.prestigePoints};});
    const capture=async(name,screen,{overview=false}={})=>{
      await page.waitForTimeout(120);
      const data=await page.evaluate(({screenId})=>{
        const panel=document.getElementById(screenId);
        const visible=node=>node.getClientRects().length&&!node.closest('[inert],[hidden]')&&getComputedStyle(node).visibility!=='hidden';
        const controls=[...panel.querySelectorAll('button,input,select')].filter(visible).map(node=>{const r=node.getBoundingClientRect();return {id:node.id,text:node.textContent.trim().slice(0,45),x:r.x,y:r.y,right:r.right,bottom:r.bottom,scrollParent:!!node.closest('.panel-scroll,#guide-scroll')};});
        const overflow=[...panel.querySelectorAll('.panel-scroll,#guide-scroll')].filter(visible).map(node=>({id:node.id,class:node.className,clientWidth:node.clientWidth,scrollWidth:node.scrollWidth,clientHeight:node.clientHeight,scrollHeight:node.scrollHeight,scrollTop:node.scrollTop}));
        const assets=new Set();
        for(const node of [panel,...panel.querySelectorAll('*')]){
          if(!visible(node))continue;
          if(node.tagName==='IMG'&&node.currentSrc)assets.add(node.currentSrc);
          for(const pseudo of [null,'::before','::after']){
            const background=getComputedStyle(node,pseudo).backgroundImage;
            for(const match of background.matchAll(/url\(["']?([^"')]+)["']?\)/g))assets.add(new URL(match[1],document.baseURI).href);
          }
        }
        return {screen:RiskPresentation.currentScreen(),width:innerWidth,height:innerHeight,dpr:devicePixelRatio,documentScrollWidth:document.documentElement.scrollWidth,documentScrollHeight:document.documentElement.scrollHeight,controls,overflow,assets:[...assets],submenu:panel.dataset.submenuScene||null,menuScenes:RelayMenuScenes.getDiagnostics(),guide:RelayGuide.getDiagnostics(),focusedId:document.activeElement.id,focusedTag:document.activeElement.tagName};
      },{screenId:screenIds[screen]});
      assert.equal(data.screen,screen,name+' screen');assert.equal(data.width,420);assert.equal(data.height,650);assert.equal(data.dpr,scale);
      assert.equal(data.documentScrollWidth,420,name+' no horizontal document overflow');assert.equal(data.documentScrollHeight,650,name+' portrait document height');
      for(const control of data.controls){
        assert.ok(control.x>=-.5&&control.right<=420.5,name+' horizontal control bounds: '+control.id);
        if(overview||!control.scrollParent)assert.ok(control.y>=-.5&&control.bottom<=650.5,name+' fixed control bounds: '+control.id);
      }
      for(const scroll of data.overflow)assert.ok(scroll.scrollWidth<=scroll.clientWidth+1,name+' no sideways scroll');
      data.loadedAssets=await page.evaluate(async urls=>Promise.all(urls.map(url=>new Promise(resolve=>{const image=new Image();image.onload=()=>resolve({url,width:image.naturalWidth,height:image.naturalHeight,loaded:true});image.onerror=()=>resolve({url,loaded:false});image.src=url;}))),data.assets);
      assert.ok(data.loadedAssets.every(asset=>asset.loaded),name+' visible backdrop assets decode');
      assert.equal(data.menuScenes.ready,true);assert.equal(data.menuScenes.error,false);assert.equal(data.menuScenes.canvasCount,5);assert.equal(data.menuScenes.ownedTimers,0);assert.equal(data.menuScenes.ownedRAF,0,'reduced-motion menu has no frame loop');
      assert.equal(data.menuScenes.activeRoom,backdropFor[screen]||null,name+' only intended submenu is active');
      if(backdropFor[screen]){assert.equal(data.submenu,backdropFor[screen]);assert.ok(data.loadedAssets.some(asset=>asset.url.endsWith('/assets/menus/'+backdropFor[screen]+'.png')),name+' uses its selected room image');}
      await page.screenshot({path:path.join(out,scale+'-'+name+'.png')});item.screens.push({name,...data});
      return data;
    };
    const waitScreen=screen=>page.waitForFunction(screen=>RiskPresentation.currentScreen()===screen,screen);
    const waitPage=topic=>page.waitForFunction(topic=>RelayGuide.getDiagnostics().page===topic,topic);
    const opener=page.locator('#main-menu button[onclick="showTutorial()"]');
    const openGuide=async()=>{await opener.click();await waitScreen('tutorial');await waitPage('overview');};
    await capture('menu','menu');const before=await state();
    await openGuide();await capture('guide-overview','tutorial',{overview:true});
    if(scale===scales[0]){
      for(const [effectsLevel,reducedMotion,frames] of [['full',false,1],['low',false,1],['off',false,0],['full',true,0]]){
        await page.evaluate(preferences=>RiskPresentation.setPreferences(preferences),{effectsLevel,reducedMotion});
        await page.waitForFunction(frames=>RelayMenuScenes.getDiagnostics().ownedRAF===frames,frames);
        const life=await page.evaluate(()=>RelayMenuScenes.getDiagnostics());assert.equal(life.activeRoom,'briefing');assert.equal(life.ownedTimers,0);assert.equal(life.canvasCount,5);
      }
      item.checks.push('full/low menu animation owns one loop; static/reduced owns none');
    }
    assert.equal(await page.locator('#guide-overview [data-guide-topic]').count(),topics.length);
    for(const topic of topics){
      await page.locator('#guide-overview [data-guide-topic="'+topic+'"]').click();await waitPage(topic);
      const detail=await capture('guide-'+topic,'tutorial');
      assert.ok(['H1','H2','H3'].includes(detail.focusedTag),'detail heading receives focus');
      await page.keyboard.press('3');assert.deepEqual(await state(),before,'guide blocks hack shortcut');
      for(const disclosure of await page.locator('#guide-'+topic+' details').all()){
        assert.equal(await disclosure.evaluate(node=>node.open),false,'secondary detail starts collapsed');
        await disclosure.locator('summary').click();assert.equal(await disclosure.evaluate(node=>node.open),true,'secondary detail expands');
        await disclosure.evaluate(node=>node.scrollIntoView({block:'end'}));
        await capture('guide-'+topic+'-expanded','tutorial');
        await disclosure.locator('summary').click();assert.equal(await disclosure.evaluate(node=>node.open),false);
      }
      const scroll=page.locator('#guide-scroll');
      if(await scroll.evaluate(node=>node.scrollHeight>node.clientHeight+1)){
        await scroll.evaluate(node=>{node.scrollTop=node.scrollHeight;});await capture('guide-'+topic+'-bottom','tutorial');
      }
      await page.locator('#guide-back').click();await waitPage('overview');
      assert.equal(await page.locator('#guide-overview').isVisible(),true);
    }
    item.checks.push('all four topics open from overview and return using Back');
    await page.locator('#guide-overview [data-guide-topic="hacks"]').focus();await page.keyboard.press('Enter');await waitPage('hacks');
    await page.keyboard.press('Escape');await waitPage('overview');await page.keyboard.press('Escape');await waitScreen('menu');
    item.escapeFocus=await page.evaluate(()=>({id:document.activeElement.id,tag:document.activeElement.tagName,text:document.activeElement.textContent.trim().slice(0,60)}));
    assert.equal(await opener.evaluate(node=>document.activeElement===node),true,'Escape restores menu opener focus; actual '+JSON.stringify(item.escapeFocus));
    assert.deepEqual(await state(),before,'guide navigation leaves funds, risk and progression unchanged');
    item.checks.push('keyboard topic activation and two-stage Escape return with opener focus');
    await openGuide();await page.locator('#guide-close').click();await waitScreen('menu');
    assert.equal(await opener.evaluate(node=>document.activeElement===node),true,'Close restores menu opener focus');
    item.checks.push('reopening resets overview and Close returns safely');

    await page.locator('#main-menu button[onclick="showPersistentUpgrades()"]').click();await waitScreen('persistent');await capture('upgrades','persistent');
    await page.locator('.upgrade-scroll').evaluate(node=>{node.scrollTop=node.scrollHeight;});await capture('prestige','persistent');
    await page.locator('#screen-persistent button[onclick="backToMenu()"]').click();await waitScreen('menu');
    for(const [screen,open,close] of [['achievements','showAchievements()','backToMenuFromAchievements()'],['leaderboard','showLeaderboard()','backToMenuFromLeaderboard()']]){
      await page.locator('#main-menu button[onclick="'+open+'"]').click();await waitScreen(screen);await capture(screen,screen);
      await page.locator('#'+screenIds[screen]+' button[onclick="'+close+'"]').click();await waitScreen('menu');
    }
    await page.locator('#main-menu button[onclick="showSettings()"]').click();await waitScreen('settings');await capture('settings','settings');await page.keyboard.press('Escape');await waitScreen('menu');
    item.checks.push('upgrades/prestige, achievements, leaderboard and settings return to menu');
    await page.evaluate(()=>{showPersistentUpgrades();startGame();money=1280;risk=50;sessionHackCount=1;transfer();});await waitScreen('success');await capture('extraction','success');
    await page.evaluate(()=>{closeOverlays();startGame();money=1280;risk=89;showBusted();});await waitScreen('busted');await capture('busted','busted');
    item.checks.push('both result screens remain contained');
    if(scale===scales[0]){
      await page.evaluate(()=>{closeOverlays();RiskPresentation.setPreferences({effectsLevel:'full',reducedMotion:false});});await waitScreen('persistent');
      await page.locator('#screen-persistent button[onclick="backToMenu()"]').click();await waitScreen('menu');
      const lifecycleBefore=await state();
      const lifecycle=async(expected,frames)=>{
        await page.waitForFunction(({expected,frames})=>{const d=RelayMenuScenes.getDiagnostics();return d.activeRoom===expected&&d.ownedRAF===frames;},{expected,frames});
        const d=await page.evaluate(()=>RelayMenuScenes.getDiagnostics());assert.equal(d.canvasCount,5);assert.equal(d.ownedTimers,0);assert.equal(d.error,false);
      };
      for(let turn=0;turn<2;turn++){
        for(const [screen,open,close] of [['persistent','showPersistentUpgrades()','backToMenu()'],['achievements','showAchievements()','backToMenuFromAchievements()'],['leaderboard','showLeaderboard()','backToMenuFromLeaderboard()'],['settings','showSettings()','closeSettings()'],['tutorial','showTutorial()','closeTutorial()']]){
          await page.locator('#main-menu button[onclick="'+open+'"]').click();await waitScreen(screen);await lifecycle(backdropFor[screen],1);
          await page.locator('#'+screenIds[screen]+' button[onclick="'+close+'"]').click();await waitScreen('menu');await lifecycle(null,0);
        }
      }
      assert.deepEqual(await state(),lifecycleBefore,'repeated submenu switches do not mutate funds/risk/progression');
      await page.evaluate(()=>{showPersistentUpgrades();startGame();});await waitScreen('game');await lifecycle(null,0);
      await page.evaluate(()=>{bypassCharge=15;bypass();});await waitScreen('bypass');await lifecycle(null,0);
      await page.keyboard.press('Escape');await waitScreen('game');await lifecycle(null,0);
      item.checks.push('two full submenu cycles retain five canvases, zero timers and unchanged funds; main/game/Bypass own no menu loop');
    }
  } finally { await closeTestApp(app); }
}

(async()=>{
  await fs.mkdir(out,{recursive:true});
  try { for(const scale of scales)await runScale(scale);assert.deepEqual(report.errors,[]);report.passed=true; }
  catch(error){report.failure=error.stack;throw error;}
  finally{await fs.writeFile(path.join(out,'menu-guide-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,scales:report.scales.map(item=>({scale:item.scale,screens:item.screens.length,checks:item.checks.length})),errors:report.errors,failure:report.failure},null,2));}
})().catch(error=>{console.error(error.message);process.exitCode=1;});

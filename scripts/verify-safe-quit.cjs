const {_electron:electron}=require('playwright');
const path=require('node:path'),fs=require('node:fs/promises'),assert=require('node:assert/strict');
const closeTestApp=require('./close-test-app.cjs');
const repo=path.resolve(__dirname,'..'),out=path.resolve(process.env.RISK_V2_QA_DIR||path.join(repo,'dist','qa'),'safe-quit');
const scales=[...new Set((process.env.RISK_V2_QA_SCALES||'1,1.25,1.5,2').split(',').map(Number))];
const report={method:'Real Electron, actual quit coordinator/local save store, isolated profiles',target:process.env.RISK_V2_EXECUTABLE?'packaged':'source',version:null,scales:[],checks:[],errors:[]};
const seed={playerName:'SAFE_QUIT_QA',totalMoney:43.75,tutorialSeen:true,musicVolume:0,sfxVolume:0,presentation:{introSeen:true,reducedMotion:true}};
async function launch(label,existingProfile){
 const profile=existingProfile||path.join(out,label+'-'+Date.now());if(!existingProfile){await fs.mkdir(profile,{recursive:true});await fs.writeFile(path.join(profile,'user_data.json'),JSON.stringify(seed));}
 const scale=Number(label.split('-').at(-1))||1;
 const app=await electron.launch({executablePath:process.env.RISK_V2_EXECUTABLE||require('electron'),args:[...(process.env.RISK_V2_EXECUTABLE?[]:[repo]),'--force-device-scale-factor='+scale],env:{...process.env,RISK_V2_TEST_MODE:'1',RISK_V2_USER_DATA_DIR:profile},timeout:120000});
 report.version=await app.evaluate(({app})=>app.getVersion());const page=await app.firstWindow();page.on('pageerror',e=>report.errors.push(e.message));await page.waitForFunction(()=>window.RiskQuit&&!window.RiskSaveLoading&&window.RiskPresentation?.currentScreen()==='menu');
 return{app,page,profile};
}
async function cleanup(app){try{if(app.process().exitCode!==null)return;}catch(_){return;}await closeTestApp(app);}
async function start(page){await page.locator('#main-menu button[onclick="showPersistentUpgrades()"]').click();await page.locator('#screen-persistent button[onclick="startGame()"]').click();await page.evaluate(()=>{money=1280;risk=34;updateUI();});}
async function waitPhase(page,phase){await page.waitForFunction(phase=>RiskQuit.getState().phase===phase,phase);}
async function shot(page,name){await page.mouse.move(1,1);await page.waitForTimeout(220);await page.screenshot({path:path.join(out,name+'.png')});}
async function closeBy(app,button){const closed=app.waitForEvent('close',{timeout:20000});await Promise.all([closed,button.click().catch(error=>{if(!/closed|disposed/i.test(error.message))throw error;})]);}
(async()=>{
 await fs.mkdir(out,{recursive:true});assert(scales.length&&scales.every(scale=>[1,1.25,1.5,2].includes(scale)));
 for(const scale of scales){
  const {app,page,profile}=await launch('scale-'+scale);
  try{
   await start(page);await page.evaluate(()=>RelayUI.showSettings());await shot(page,`${scale}-settings`);
   await page.locator('#settings-save-quit').click();await waitPhase(page,'confirm');assert.equal(await page.evaluate(()=>document.activeElement.id),'relay-quit-cancel');
   const geometry=await page.evaluate(()=>{const d=document.getElementById('relay-quit-dialog'),r=d.getBoundingClientRect();return{width:innerWidth,height:innerHeight,dpr:devicePixelRatio,background:getComputedStyle(d).backgroundColor,rect:{x:r.x,y:r.y,width:r.width,height:r.height},screen:RiskPresentation.currentScreen(),controls:[...d.querySelectorAll('button')].filter(b=>!b.hidden).map(b=>{const r=b.getBoundingClientRect();return{id:b.id,x:r.x,y:r.y,right:r.right,bottom:r.bottom};})};});
   assert.equal(geometry.width,420);assert.equal(geometry.height,650);assert.equal(geometry.dpr,scale);assert.equal(geometry.rect.x,0);assert.equal(geometry.rect.y,0);assert(Math.abs(geometry.rect.width-420)<=1&&Math.abs(geometry.rect.height-650)<=1,'opaque viewport coverage allows device-pixel rounding');assert.equal(geometry.background,'rgb(9, 18, 27)');assert.equal(geometry.screen,'settings');assert(geometry.controls.every(b=>b.x>=0&&b.right<=420&&b.y>=0&&b.bottom<=650));
   await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.id),'relay-quit-confirm');await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.id),'relay-quit-cancel');await shot(page,`${scale}-confirm`);
   await page.keyboard.down('Escape');await waitPhase(page,'idle');await page.keyboard.up('Escape');assert.equal(await page.evaluate(()=>RiskPresentation.currentScreen()),'settings');assert.equal(await page.evaluate(()=>document.activeElement.id),'settings-save-quit');
   await page.evaluate(()=>saveGameState());await fs.mkdir(path.join(profile,'user_data.json.tmp'));
   await page.locator('#settings-save-quit').click();await waitPhase(page,'confirm');await page.locator('#relay-quit-confirm').click();await waitPhase(page,'error');await shot(page,`${scale}-error`);
   assert.equal(await page.locator('#relay-quit-discard').isVisible(),true);assert.equal(await page.locator('#relay-quit-retry').isVisible(),true);assert.equal(await page.evaluate(()=>money),1280);
   await page.keyboard.press('Escape');await waitPhase(page,'idle');assert.equal(await page.evaluate(()=>RiskPresentation.currentScreen()),'settings');
   await page.locator('#settings-save-quit').click();await waitPhase(page,'confirm');await page.locator('#relay-quit-confirm').click();await waitPhase(page,'error');
   await fs.rmdir(path.join(profile,'user_data.json.tmp'));await closeBy(app,page.locator('#relay-quit-retry'));
   const saved=JSON.parse(await fs.readFile(path.join(profile,'user_data.json'),'utf8'));assert.equal(saved.totalMoney,43.75);
   const restarted=await launch('restart-'+scale,profile);let newRunMoney;
   try{assert.equal(await restarted.page.evaluate(()=>RiskPresentation.currentScreen()),'menu');await restarted.page.locator('#main-menu button[onclick="showPersistentUpgrades()"]').click();await restarted.page.locator('#screen-persistent button[onclick="startGame()"]').click();newRunMoney=await restarted.page.evaluate(()=>money);assert.equal(newRunMoney,0);assert.equal(await restarted.page.evaluate(()=>totalMoney),43.75);}finally{await cleanup(restarted.app);}
   report.scales.push({scale,...geometry,savedBank:saved.totalMoney,newRunMoney});
  }finally{await cleanup(app);}
 }
 report.checks.push('Every requested DPI: Settings entry, opaque confirmation, safe default/Tab trap, Escape keyup isolation, real disk failure, cancel and retry. Restart opens the menu; a normal new run retains bank and does not resume lost unsecured funds.');
 const discard=await launch('discard-1');
 try{
  await start(discard.page);await discard.page.evaluate(()=>saveGameState());const before=await fs.readFile(path.join(discard.profile,'user_data.json'),'utf8');await fs.mkdir(path.join(discard.profile,'user_data.json.tmp'));
  await discard.app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].close());await waitPhase(discard.page,'confirm');await shot(discard.page,'native-close-confirm');await discard.page.locator('#relay-quit-confirm').click();await waitPhase(discard.page,'error');await closeBy(discard.app,discard.page.locator('#relay-quit-discard'));
  assert.equal(await fs.readFile(path.join(discard.profile,'user_data.json'),'utf8'),before);report.checks.push('Native window close enters confirmation; explicit unsaved exit closes after a real write failure without replacing the previous save.');
 }finally{await cleanup(discard.app);}
 const challenge=await launch('challenge-1');
 try{
  await start(challenge.page);await challenge.page.evaluate(()=>{bypassCharge=15;bypass();});await challenge.app.evaluate(({app})=>app.quit());await waitPhase(challenge.page,'confirm');await shot(challenge.page,'challenge-confirm');
  const before=await challenge.page.evaluate(()=>({screen:RiskPresentation.currentScreen(),level:bypassLevel,money,risk}));await challenge.page.keyboard.down('Escape');await waitPhase(challenge.page,'idle');await challenge.page.keyboard.up('Escape');assert.deepEqual(await challenge.page.evaluate(()=>({screen:RiskPresentation.currentScreen(),level:bypassLevel,money,risk})),before);
  await challenge.page.evaluate(()=>{exitBypassGame();startTypingProtocol();});await challenge.app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].close());await waitPhase(challenge.page,'confirm');
  await challenge.page.waitForTimeout(3200);assert.equal(await challenge.page.evaluate(()=>typingStarted),true);assert.equal(await challenge.page.evaluate(()=>document.getElementById('typing-container').inert),true);await shot(challenge.page,'typing-confirm');
  await challenge.page.keyboard.press('Escape');assert.equal(await challenge.page.evaluate(()=>RiskPresentation.currentScreen()),'typing');assert.equal(await challenge.page.evaluate(()=>document.activeElement.id),'typing-input');
  report.checks.push('Native app.quit and native window close are coordinated; cancelling never exits Bypass or consumes its stop, and Injection preparation/deadline keeps running under the opaque dialog.');
 }finally{await cleanup(challenge.app);}
 assert.deepEqual(report.errors,[]);report.passed=true;
})().catch(e=>{report.failure=e.stack;process.exitCode=1;}).finally(async()=>{await fs.mkdir(out,{recursive:true});await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));});

const path=require('node:path'),fs=require('node:fs/promises'),{execFileSync}=require('node:child_process'),assert=require('node:assert/strict');
const repo=path.resolve(__dirname,'..'),{_electron}=require(path.join(repo,'node_modules/playwright'));
const closeTestApp=require(path.join(repo,'scripts/close-test-app.cjs'));
const out=path.resolve(process.env.RISK_V2_QA_DIR||path.join(repo,'dist','qa'),'tooltip-drag');
const scales=(process.env.RISK_V2_QA_SCALES||'1,1.25,1.5,2').split(',').map(Number);
const report={target:process.env.RISK_V2_EXECUTABLE?'packaged':'source',version:null,method:'Real isolated Electron; read-only native WM_NCHITTEST and real elapsed-time tooltip input checks; no OS pointer/focus changes',checks:[],errors:[],scales:[],captures:[]};
(async()=>{
 await fs.mkdir(out,{recursive:true});
 for(const scale of scales){
 const profile=await fs.mkdtemp(path.join(out,'profile-'));await fs.writeFile(path.join(profile,'user_data.json'),JSON.stringify({playerName:'DRAG_QA',tutorialSeen:true,musicVolume:0,sfxVolume:0,presentation:{introSeen:true,reducedMotion:true}}));
 const app=await _electron.launch({executablePath:process.env.RISK_V2_EXECUTABLE||require(path.join(repo,'node_modules/electron')),args:[...(process.env.RISK_V2_EXECUTABLE?[]:[repo]),'--force-device-scale-factor='+scale],env:{...process.env,RISK_V2_TEST_MODE:'1',RISK_V2_HEADLESS:'1',RISK_V2_USER_DATA_DIR:profile}});
 const page=await app.firstWindow();page.on('pageerror',e=>report.errors.push(e.message));
 try{
 await page.waitForFunction(()=>window.RiskPresentation?.currentScreen()==='menu'&&!window.RiskSaveLoading);await page.waitForTimeout(180);
 report.version=await app.evaluate(({app})=>app.getVersion());const sample={scale,probes:[]};
 async function probe(name,points,controls){
 const w=await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];return {hwnd:w.getNativeWindowHandle().readBigUInt64LE().toString(),bounds:w.getBounds(),movable:w.isMovable(),maximizable:w.isMaximizable()}});assert.equal(w.movable,true);assert.equal(w.maximizable,false);
 if(controls)points.push(...await page.locator(controls).evaluateAll(nodes=>nodes.filter(e=>e.getClientRects().length&&!e.closest('[inert]')).map(e=>{const r=e.getBoundingClientRect();return {label:e.id||e.getAttribute('aria-label')||e.textContent.trim().slice(0,35),x:r.x+r.width/2,y:r.y+r.height/2,expected:1}})));
 const viewport=await page.evaluate(()=>[innerWidth,innerHeight]);assert.deepEqual(viewport,[420,650]);
 const native=JSON.parse(execFileSync(process.env.RISK_V2_PYTHON||'python',[path.join(__dirname,'native-hit-test.py'),w.hwnd,JSON.stringify(points),JSON.stringify(viewport)],{encoding:'utf8'}));
 for(const p of native)assert.equal(p.hit,p.expected,name+': '+p.label+' native hit target');
 sample.probes.push({name,movable:w.movable,maximizable:w.maximizable,native});const file=scale+'-'+name+'.png';await page.screenshot({path:path.join(out,file)});report.captures.push(file);
 }
 await probe('menu',[{label:'top-left',x:10,y:10,expected:2},{label:'top-center',x:200,y:25,expected:2},{label:'top-right',x:408,y:40,expected:2},{label:'large-title',x:180,y:175,expected:2},{label:'room-outside-title',x:210,y:310,expected:1}],'#main-menu button,#player-name');
 await page.locator('#main-menu button[onclick="showPersistentUpgrades()"]').click();await page.locator('#screen-persistent button[onclick="startGame()"]').click();
 await page.waitForFunction(()=>RelayEasterEggs.getDiagnostics().targets>=5);
 await probe('game',[{label:'logo',x:40,y:20,expected:2},{label:'header-center',x:200,y:20,expected:2},{label:'header-before-settings',x:350,y:20,expected:2},{label:'room',x:210,y:120,expected:1}],'.widget button');
 const settingsButton=page.locator('.header button');await settingsButton.click();await page.waitForFunction(()=>RiskPresentation.currentScreen()==='settings');await page.keyboard.press('Escape');await page.waitForFunction(()=>RiskPresentation.currentScreen()==='game');
 if(scale===1){
  const bonus=page.locator('.bonus-section button').first(),tip=page.locator('#relay-tooltip');await page.mouse.move(5,640);await bonus.hover();const start=Date.now();await page.waitForTimeout(2400);assert.equal(await tip.isVisible(),false);await tip.waitFor({state:'visible',timeout:1500});const elapsed=Date.now()-start;assert(elapsed>=2900&&elapsed<4100,'three-second wall clock tooltip delay');
  const file='1-tooltip-after-delay.png';await page.screenshot({path:path.join(out,file)});report.captures.push(file);await page.mouse.move(5,640);assert.equal(await tip.isVisible(),false);
  await bonus.hover();await page.waitForTimeout(300);await settingsButton.click();await page.waitForTimeout(3100);assert.equal(await tip.isVisible(),false);await page.keyboard.press('Escape');
  sample.tooltipDelayMs=elapsed;report.checks.push('Real Electron wall clock: tooltip remains hidden at2.4 seconds, appears after3 seconds, and cancels on leave or opening Settings');
 }
 report.scales.push(sample);report.checks.push('Scale '+scale+': native title regions are HTCAPTION; all visible menu/game buttons, name input, scenery hotspots and scene panels are HTCLIENT; Settings click/Escape works');
 }finally{await closeTestApp(app);}
 }
 assert.deepEqual(report.errors,[]);report.passed=true;
})().catch(e=>{report.failure=e.stack;report.passed=false;process.exitCode=1;}).finally(async()=>{await fs.mkdir(out,{recursive:true});await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));});

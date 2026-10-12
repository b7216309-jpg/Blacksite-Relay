/* Actual browser controls at real elapsed time. No secret-state assignments.
 * --record requires a prior root visual/runtime freeze; --prepare only validates inputs.
 */
'use strict';
const fs=require('node:fs'),fsp=require('node:fs/promises'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const REPO=path.resolve(__dirname,'../../..'),TASK=path.resolve(REPO,'../..'),WORK=__dirname;
const {chromium,findChromium}=require(path.join(REPO,'scripts/protocol-environment-audit.cjs'));
const version=require(path.join(REPO,'package.json')).version;
const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.ogg':'audio/ogg','.webm':'video/webm','.svg':'image/svg+xml'};
const now=()=>Number(process.hrtime.bigint())/1e9;
const only=process.argv.find(a=>a.startsWith('--only='))?.slice(7).split(',');
async function main(){
 await fsp.mkdir(path.join(WORK,'recordings'),{recursive:true});
 if(!process.argv.includes('--record')){console.log(JSON.stringify({ready:true,sourceVersion:version,action:'Prepared only; no game/recording started.'}));return;}
 assert.ok(process.argv.includes('--runtime-reviewed'),'Pass --runtime-reviewed only after inspecting the source runtime.');assert.equal(version,'1.6.0');
 const server=http.createServer(async(req,res)=>{try{const file=path.resolve(REPO,'.'+decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname));if(!file.startsWith(REPO+path.sep))return res.writeHead(403).end();res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'}).end(await fsp.readFile(file));}catch{res.writeHead(404).end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 const report=only?JSON.parse(fs.readFileSync(path.join(WORK,'capture-report.json'),'utf8')):{version,method:'Actual pointer/keyboard controls with real elapsed scene clocks; isolated saves and no gameplay actions.',audio:'Screen recording is silent. Original cue masters are synchronized in the edit using captured discovery/control timestamps.',width:420,height:650,recordings:[],errors:[]};
 if(only){report.recordings=report.recordings.filter(row=>!only.includes(row.id));report.passed=false;}
 try{
  browser=await chromium.launch({headless:true,executablePath:findChromium()});
  for(const id of (only||['ratUnion','rootAccess','snailMail','locker','room404'])){
   const row={id,events:[],screenshots:[],actions:[]};report.recordings.push(row);
   const context=await browser.newContext({viewport:{width:420,height:650},deviceScaleFactor:1,recordVideo:{dir:path.join(WORK,'recordings'),size:{width:420,height:650}}});
   await context.route('**/*',route=>route.request().url().startsWith('http://127.0.0.1:'+server.address().port+'/')?route.continue():route.abort());
   await context.exposeBinding('__recordDiscovery',(_source,event)=>row.events.push({...event,nodeTime:now()}));
   await context.addInitScript(()=>{window.__recordedSaves=[];window.electronAPI={loadGame:async()=>({playerName:'RELAY_VISITOR',totalMoney:4321,musicVolume:0,sfxVolume:0,tutorialSeen:true,presentation:{introSeen:true,reducedMotion:false,effectsLevel:'full'}}),saveGame:async d=>{__recordedSaves.push(d);return true;},getLeaderboard:async()=>JSON.stringify({dreamlo:{leaderboard:{entry:[]}}}),submitScore:async()=>true,closeApp:async()=>true};document.addEventListener('risk:discovery',e=>window.__recordDiscovery({id:e.detail.id,browserTime:performance.now()}));});
   row.startWall=now();const page=await context.newPage();const video=page.video();page.on('pageerror',e=>report.errors.push({id,message:e.message}));
   await page.goto('http://127.0.0.1:'+server.address().port+'/index.html');
   await page.waitForFunction(()=>!window.RiskSaveLoading&&window.RelaySecretRooms?.getDiagnostics().ready&&Object.keys(window.RelayPetSecrets?.getDiagnostics().props||{}).length===4&&Object.values(RelayPetSecrets.getDiagnostics().props).every(p=>p.ready));
   const hit=name=>page.locator('[data-secret-id="'+name+'"]');
   if(id==='room404')await page.locator('#menu-guide-trigger').click();else{await page.locator('#main-menu button[onclick="showPersistentUpgrades()"]').click();await page.locator('[onclick="startGame()"]').click();}
   await page.mouse.move(2,640);await page.evaluate(()=>document.activeElement?.blur());await page.waitForTimeout(650);
   row.baseline=await page.evaluate(()=>({snapshot:JSON.stringify(RiskPresentation.snapshot()),saves:__recordedSaves.length}));
   row.detailRect=await page.locator(id==='room404'?'.guide-hero':'.diorama').boundingBox();
   if(id==='snailMail')await page.waitForFunction(()=>{const p=RelayPets.getDiagnostics().residents.find(p=>p.id==='coil-snail');const phase=Math.floor(p.phase*12)/12%19.7;return phase>4.45&&phase<5.3;},{},{timeout:25000});
   row.actionStart=now();
   if(id==='ratUnion'){await hit('cable-rat').click();await hit('rack-rat').click();}
   if(id==='rootAccess'){for(let i=0;i<3;i++){await hit('server-cat').click();await page.waitForTimeout(120);}}
   if(id==='snailMail')await hit('coil-snail').click();
   if(id==='locker'){for(let i=0;i<2;i++){row.actions.push({kind:'knock',at:now()});await hit('locker').click();await page.waitForTimeout(250);}const target=await hit('locker').boundingBox();await page.mouse.move(target.x+target.width/2,target.y+target.height/2);await page.mouse.down();await page.waitForTimeout(750);await page.mouse.up();}
   if(id==='room404')for(let i=0;i<4;i++){await hit('led-'+i).click();await page.waitForTimeout(180);}
   await page.mouse.move(2,640);await page.evaluate(()=>document.activeElement?.blur());
   await page.waitForFunction(id=>RelayEasterEggs.getDiagnostics().active.includes(id),id);row.triggered=now();
   const samples=id==='ratUnion'?[.1,2.2,5.2,10.5,13.9]:id==='room404'?[.1,2.5,5.2,8.5]:[.1,2.2,4.8];let elapsed=0;
   for(const sec of samples){await page.waitForTimeout(Math.max(0,(sec-elapsed)*1000));const shot=id+'-'+sec.toFixed(1)+'s.png';await page.screenshot({path:path.join(WORK,shot)});row.screenshots.push({file:shot,time:now()});elapsed=sec;}
   const total=id==='ratUnion'?14.5:id==='room404'?9.5:id==='locker'?7.5:6.5;
   await page.waitForTimeout(Math.max(0,(total-elapsed)*1000));row.endWall=now();
   row.after=await page.evaluate(()=>({snapshot:JSON.stringify(RiskPresentation.snapshot()),saves:__recordedSaves.length}));assert.deepEqual(row.after,row.baseline,'Scenery must leave gameplay and saves unchanged');
   await context.close();const recorded=await video.path();row.file=path.join('recordings',id+'.webm');await fsp.rename(recorded,path.join(WORK,row.file));
   assert.equal(row.events.filter(e=>e.id===id).length,1,'Exactly one actual discovery trigger required');console.log(JSON.stringify({id,recorded:true,seconds:row.endWall-row.startWall,events:row.events.length}));
  }
  assert.deepEqual(report.errors,[]);report.passed=true;
 }finally{await browser?.close();await new Promise(r=>server.close(r));await fsp.writeFile(path.join(WORK,'capture-report.json'),JSON.stringify(report,null,2)+'\n');}
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});

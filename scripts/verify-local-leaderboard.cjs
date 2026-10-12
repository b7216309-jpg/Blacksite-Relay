const closeTestApp = require('./close-test-app.cjs');
const {_electron:electron}=require('playwright');
const path=require('node:path'),fs=require('node:fs/promises'),assert=require('node:assert/strict');
const repo=path.resolve(__dirname,'..'),out=path.resolve(process.env.RISK_V2_QA_DIR||path.join(repo,'dist','qa'),'local-leaderboard');
const requestedScales=[...new Set((process.env.RISK_V2_QA_SCALES||'1,1.25,1.5,2').split(',').map(value=>Number(value.trim())))];
const report={method:'Real Electron with actual local file provider, isolated profiles, no score service',target:process.env.RISK_V2_EXECUTABLE?'packaged':'source',version:null,scales:[],checks:[],errors:[],network:[]};
const seed={playerName:'LONG_LOCAL_OPERATOR_1234567890',totalMoney:4321.75,tutorialSeen:true,musicVolume:0,sfxVolume:0,presentation:{introSeen:true,reducedMotion:true}};
async function launch(profile,scale=1){
 const app=await electron.launch({executablePath:process.env.RISK_V2_EXECUTABLE||require('electron'),args:[...(process.env.RISK_V2_EXECUTABLE?[]:[repo]),'--force-device-scale-factor='+scale],env:{...process.env,RISK_V2_TEST_MODE:'1',RISK_V2_USER_DATA_DIR:profile},timeout:120000});
 report.version=await app.evaluate(({app})=>app.getVersion());
 const page=await app.firstWindow();page.on('pageerror',e=>report.errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))report.network.push(r.url());});
 await page.waitForFunction(()=>window.RiskPresentation?.currentScreen()==='menu'&&!window.RiskSaveLoading);
 return{app,page};
}
async function prepareProfile(name,data=seed){const profile=path.join(out,name+'-'+Date.now());await fs.mkdir(profile,{recursive:true});await fs.writeFile(path.join(profile,'user_data.json'),JSON.stringify(data));return profile;}
async function openBoard(page){await page.locator('#main-menu button[onclick="showLeaderboard()"]').click();await page.waitForFunction(()=>document.getElementById('leaderboard-list').getAttribute('aria-busy')==='false');}
async function capture(page,name){await page.mouse.move(2,2);await page.waitForTimeout(220);await page.screenshot({path:path.join(out,name+'.png')});}
(async()=>{
 await fs.mkdir(out,{recursive:true});let persistedProfile,persistedRecords;
 assert(requestedScales.length>0&&requestedScales.every(scale=>[1,1.25,1.5,2].includes(scale)),'RISK_V2_QA_SCALES must contain 1,1.25,1.5 and/or 2');
 for(const scale of requestedScales){
  const profile=await prepareProfile('profile-'+scale),{app,page}=await launch(profile,scale);
  try{
   await openBoard(page);
   const initial=JSON.parse(await page.evaluate(()=>electronAPI.getLeaderboard()));assert.equal(initial.scope,'local');assert.equal(initial.entries[0].score,seed.totalMoney);
   await capture(page,`${scale}-current-bank`);await page.locator('#screen-leaderboard button').click();
   const sample=[['VERY_LONG_LOCAL_OPERATOR_ALPHA',1e120],['CIRCUIT',1000000.125],['<script>alert(1)</script>',98000],['RACK_04',6000.5],['COPPER',3800.75],['NEON',2100.125],['TEAL',800.25],['SHADOW',200.5],['PORT_09',5.75],['SNAIL',.002],['RAT',.001],['NO_RECORD',0]];
   await page.evaluate(async rows=>{for(const [name,score]of rows)assertOK(await electronAPI.submitScore(name,score));function assertOK(value){if(value!=='OK')throw Error('record not saved');}},sample);
   await openBoard(page);assert.equal(await page.locator('#leaderboard-list [role="listitem"]').count(),10);assert.equal(await page.locator('#leaderboard-list script').count(),0);
   const geometry=await page.evaluate(()=>{const list=document.getElementById('leaderboard-list'),r=list.getBoundingClientRect(),button=document.querySelector('#screen-leaderboard>button').getBoundingClientRect();return{width:innerWidth,height:innerHeight,dpr:devicePixelRatio,scrollHeight:document.documentElement.scrollHeight,list:{x:r.x,y:r.y,right:r.right,bottom:r.bottom,scrollHeight:list.scrollHeight,clientHeight:list.clientHeight},button:{x:button.x,y:button.y,right:button.right,bottom:button.bottom},rows:[...list.children].map(row=>{const a=row.getBoundingClientRect();return{text:row.textContent,fullName:row.children[0].title,scoreTitle:row.children[1].title,x:a.x,y:a.y,right:a.right,bottom:a.bottom};})};});
   assert.equal(geometry.width,420);assert.equal(geometry.height,650);assert.equal(geometry.dpr,scale);assert(geometry.button.bottom<=650&&geometry.list.right<=420);assert(geometry.rows.every(r=>r.x>=0&&r.right<=420));
   await capture(page,`${scale}-populated`);await page.keyboard.press('Tab');await page.locator('#screen-leaderboard>button').focus();
   assert.equal(await page.locator('#screen-leaderboard>button').evaluate(button=>button.matches(':focus-visible')),true);await capture(page,`${scale}-keyboard-focus`);
   await page.keyboard.press('Enter');await page.waitForFunction(()=>RiskPresentation.currentScreen()==='menu');
   report.scales.push({scale,...geometry});
   if(!persistedProfile){persistedProfile=profile;persistedRecords=JSON.parse(await page.evaluate(()=>electronAPI.getLeaderboard())).entries;await fs.copyFile(path.join(out,`${scale}-populated.png`),path.join(out,'leaderboard-populated.png'));}
  }finally{await closeTestApp(app);}
 }
 report.checks.push('Current old-save bank is recorded exactly; top10 ranks, long/HTML-like names, large values and focus fit at every requested scale.');
 const restarted=await launch(persistedProfile);
 try{await openBoard(restarted.page);assert.deepEqual(JSON.parse(await restarted.page.evaluate(()=>electronAPI.getLeaderboard())).entries,persistedRecords);await capture(restarted.page,'persisted-after-restart');report.checks.push('Real local records persist after closing and reopening Electron.');}finally{await closeTestApp(restarted.app);}
 const emptyProfile=await prepareProfile('empty',{...seed,playerName:'ANONYMOUS',totalMoney:0});const empty=await launch(emptyProfile);
 try{await openBoard(empty.page);assert.match(await empty.page.locator('#leaderboard-list').innerText(),/No local scores yet/);await capture(empty.page,'empty-local-board');report.checks.push('A missing local records file shows an honest empty board.');}finally{await closeTestApp(empty.app);}
 const corruptProfile=await prepareProfile('corrupt');const corruptText='{broken local score file';await fs.writeFile(path.join(corruptProfile,'local_leaderboard.json'),corruptText);const broken=await launch(corruptProfile);
 try{await openBoard(broken.page);assert.match(await broken.page.locator('#leaderboard-list').innerText(),/Local scores unavailable/);await capture(broken.page,'storage-unavailable');assert.equal(await fs.readFile(path.join(corruptProfile,'local_leaderboard.json'),'utf8'),corruptText);report.checks.push('A corrupt local store shows unavailable copy and preserves the unreadable file.');}finally{await closeTestApp(broken.app);}
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.network,[]);report.passed=true;
})().catch(e=>{report.failure=e.stack;process.exitCode=1;}).finally(async()=>{await fs.mkdir(out,{recursive:true});await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));});

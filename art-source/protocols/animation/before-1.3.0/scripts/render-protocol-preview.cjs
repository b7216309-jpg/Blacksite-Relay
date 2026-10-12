// Portable browser lookup: environment override, then the Chromium installed by Playwright.
/* Real native protocol interfaces, isolated demonstration saves and actual outcomes.
 * node render-protocol-preview.cjs [--prepare] [--preview] [--output=PATH]
 */
'use strict';
const fs=require('node:fs'),fsp=require('node:fs/promises'),path=require('node:path'),http=require('node:http');
const {spawn}=require('node:child_process'),{once}=require('node:events'),crypto=require('node:crypto');
const option=(name,fallback)=>process.argv.find(a=>a.startsWith('--'+name+'='))?.slice(name.length+3)||fallback;
const ROOT=path.resolve(option('root',path.join(__dirname,'..')));
const {chromium}=require(path.join(ROOT,'node_modules/playwright')),ffmpeg=require(path.join(ROOT,'node_modules/ffmpeg-static'));
const version=require(path.join(ROOT,'package.json')).version;
const WORK=path.resolve(option('work',path.join(ROOT,'../protocol-environments/media/preview')));
const OUTPUT=path.resolve(option('output',path.join(ROOT,'../../outputs/Blacksite-Relay-'+version)));
const REHEARSE=process.argv.includes('--rehearse'),PREVIEW=process.argv.includes('--preview')||REHEARSE,FPS=24,DURATION=24;
const CHROME=process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||process.env.CHROMIUM_EXECUTABLE||chromium.executablePath();
const names=['typing','backdoor','bypass'];
const stage=`<!doctype html><html lang="en"><head><meta charset="utf-8"><base href="/"><title>Blacksite Relay / Protocol Preview</title><style>
*{box-sizing:border-box}html,body{margin:0;width:1920px;height:1080px;overflow:hidden;background:#071015;color:#dce8e2;font-family:Bahnschrift,'Segoe UI',sans-serif}.eyebrow{position:absolute;left:124px;top:54px;font:13px Consolas,monospace;letter-spacing:4px;color:#83b4ae}h1{position:absolute;left:120px;top:77px;margin:0;font-weight:500;font-size:58px;letter-spacing:-2px}.pass{position:absolute;right:124px;top:119px;font:15px Consolas,monospace;letter-spacing:2px;color:#ffca78}.column{position:absolute;top:204px;width:420px;height:650px;border:1px solid #729c9150;box-sizing:content-box;box-shadow:0 18px 70px #0006}.column iframe{position:absolute;inset:0;border:0;width:420px;height:650px;pointer-events:none}.label{position:absolute;top:-33px;left:0;font:13px Consolas,monospace;letter-spacing:2.2px;color:#a2c6bd}.status{position:absolute;top:674px;left:0;right:0;color:#99c0b7;font:14px Consolas,monospace;line-height:1.5;min-height:42px}.column:nth-of-type(1){left:180px}.column:nth-of-type(2){left:750px}.column:nth-of-type(3){left:1320px}.footer{position:absolute;left:124px;right:124px;bottom:48px;border-top:1px solid #7fa39948;padding-top:21px;display:flex;justify-content:space-between;font:12px Consolas,monospace;letter-spacing:2px;color:#83aaa1}#fade{position:absolute;inset:0;background:#02080b;opacity:1;pointer-events:none}
</style></head><body><div class="eyebrow">RISK_v2 / BLACKSITE RELAY</div><h1>Three protocols. One relay.</h1><div class="pass" id="pass">01 / FIND YOUR WAY THROUGH</div>
<section class="column"><div class="label">01 / INJECTION</div><iframe id="typing" src="index.html?film=typing" title="Actual Injection gameplay"></iframe><div class="status" id="typing-status"></div></section>
<section class="column"><div class="label">02 / MEMORY</div><iframe id="backdoor" src="index.html?film=backdoor" title="Actual Memory gameplay"></iframe><div class="status" id="backdoor-status"></div></section>
<section class="column"><div class="label">03 / BYPASS</div><iframe id="bypass" src="index.html?film=bypass" title="Actual Bypass gameplay"></iframe><div class="status" id="bypass-status"></div></section>
<footer class="footer"><span>ACTUAL GAMEPLAY / THREE NATIVE 420 × 650 WINDOWS</span><span>ORIGINAL MUSIC / ${version}</span></footer><div id="fade"></div>
<script>window.updateFilm=(t,states)=>{document.getElementById('pass').textContent=t<12?'01 / FIND YOUR WAY THROUGH':'02 / UNDER PRESSURE';document.getElementById('fade').style.opacity=t<.35?1-t/.35:t>23.4?(t-23.4)/.6:0;for(const [name,state] of Object.entries(states)){const p=state.protocol;let text='';if(p?.phase==='result')text=(p.success?'SECURED / ':'FAILED / ')+(p.rewardText||'');else if(p?.phase==='countdown')text=name==='backdoor'?'REMEMBER THE FIVE PORTS':'PREPARE THE COMMAND';else if(p?.phase==='active')text=name==='typing'?'LIVE INPUT / THE CLOCK IS RUNNING':name==='backdoor'?'RECALL / SELECT THE REMEMBERED PORTS':'TIMING / STOP INSIDE THE TARGET';document.getElementById(name+'-status').textContent=text;}};</script></body></html>`;
const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.webm':'video/webm','.mp4':'video/mp4','.wav':'audio/wav','.ogg':'audio/ogg','.json':'application/json','.svg':'image/svg+xml'};
function ff(args){return new Promise((resolve,reject)=>{const p=spawn(ffmpeg,args,{windowsHide:true,stdio:['ignore','ignore','pipe']});let log='';p.stderr.on('data',x=>log+=x);p.on('error',reject);p.on('exit',c=>c===0?resolve(log):reject(Error(log.slice(-6000))));});}
async function main(){
 await fsp.mkdir(WORK,{recursive:true});await fsp.mkdir(OUTPUT,{recursive:true});await fsp.writeFile(path.join(WORK,'stage.html'),stage);
 if(process.argv.includes('--prepare')){console.log('STAGE_PREPARED '+WORK);return;}
 const server=http.createServer(async(req,res)=>{try{const url=new URL(req.url,'http://127.0.0.1');const file=url.pathname==='/__protocol-preview.html'?path.join(WORK,'stage.html'):path.resolve(ROOT,'.'+decodeURIComponent(url.pathname));if(file!==path.join(WORK,'stage.html')&&!file.startsWith(ROOT+path.sep)){res.writeHead(403).end();return;}const data=await fsp.readFile(file);res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'}).end(data);}catch{res.writeHead(404).end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,executablePath:fs.existsSync(CHROME)?CHROME:undefined,args:['--hide-scrollbars']});let encoder=null;
 const report={version,durationSeconds:DURATION,width:1920,height:1080,fps:FPS,nativeFrames:[420,650],beforeReference:'art-source/protocols/before-1.2.5/provenance.json',description:'Actual shipped interfaces. Isolated advanced saves; 15 actual hacks charge bypass. Protocol triggers and subsequent inputs are scripted; timers, target locations, errors, rewards and outcomes use the real game.',samples:[],actions:[],errors:[],cues:[]};
 try{
  const context=await browser.newContext({viewport:{width:1920,height:1080},deviceScaleFactor:1});
  await context.addInitScript(()=>{window.electronAPI={loadGame:async()=>({totalMoney:18500,playerName:'PROTOCOL_06',pUpgrades:{ram:{lvl:15},miner:{lvl:7},vpn:{lvl:4},fan:{lvl:8}},prestigeLevel:2,prestigePoints:2,tutorialSeen:true,musicVolume:0,sfxVolume:0,presentation:{introSeen:true,reducedMotion:false,effectsLevel:'full'}}),saveGame:async()=>true,getLeaderboard:async()=>JSON.stringify({dreamlo:{leaderboard:{entry:[]}}}),submitScore:async()=>'OK',closeApp:()=>{}};Math.random=()=>.99999;window.__filmTime=0;window.__filmEvents=[];document.addEventListener('risk:event',e=>window.__filmEvents.push({time:window.__filmTime,...e.detail}));});
  const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));await page.goto('http://127.0.0.1:'+server.address().port+'/__protocol-preview.html',{waitUntil:'networkidle'});
  const games=Object.fromEntries(names.map(name=>[name,page.frames().find(f=>f.url().endsWith('?film='+name))]));
  for(const game of Object.values(games))await game.waitForFunction(()=>!window.RiskSaveLoading&&window.RiskPresentation&&window.RelayPets?.getDiagnostics().ready&&window.RelayShadows?.getDiagnostics().ready);
  await page.clock.install({time:new Date('2026-09-05T10:00:00Z')});await page.clock.pauseAt(new Date('2026-09-05T10:00:00Z'));
  for(const [i,name] of names.entries())await games[name].evaluate(seed=>{showPersistentUpgrades();startGame();for(let n=0;n<15;n++)hack(1+n%3);let state=seed;Math.random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};BlacksiteScene.setCaptureTime(0);document.activeElement?.blur();window.__filmEvents=[];},47000+i*127);
  const begin=async(t)=>{for(const name of names)await games[name].evaluate(name=>{if(name==='typing')startTypingProtocol();else if(name==='backdoor')startBackdoorProtocol();else{if(bypassCharge<15){Math.random=()=>.99999;for(let n=0;n<15;n++)hack(1);Math.random=()=>.43;}bypass();}},name);report.actions.push({time:t,action:'start three protocols'});};
  const picture=path.join(WORK,'picture-master.mp4');
  if(!PREVIEW){encoder=spawn(ffmpeg,['-hide_banner','-loglevel','error','-y','-f','image2pipe','-vcodec','mjpeg','-framerate',String(FPS),'-i','pipe:0','-an','-vf','scale=1920:1080:in_range=pc:out_range=tv:out_color_matrix=bt709','-c:v','libx264','-preset','fast','-crf','17','-g','48','-keyint_min','48','-sc_threshold','0','-bf','0','-pix_fmt','yuv420p','-colorspace','bt709','-color_primaries','bt709','-color_trc','bt709','-movflags','+faststart',picture],{windowsHide:true,stdio:['pipe','ignore','pipe']});encoder.stderr.on('data',d=>process.stderr.write(d));}
  const snapshots=new Set([0,1,2.5,3.5,4.5,6,8,9.5,11,12.5,14.5,16,18,20,22.5,23].map(t=>Math.round(t*FPS)));
  let first=false,second=false,phrase='',chars=-1,memoryCursor=0,bypassLast=-1,exitFirst=false,missSecond=false,typedError=false;
  for(let frame=0;frame<DURATION*FPS;frame++){
   const t=frame/FPS;for(const game of Object.values(games))await game.evaluate(t=>{window.__filmTime=t;BlacksiteScene.setCaptureTime(t);},t);
   if(!first){await begin(t);phrase=await games.typing.evaluate(()=>typingPhrase);first=true;}
   if(!second&&t>=12){await begin(t);phrase=await games.typing.evaluate(()=>typingPhrase);second=true;chars=-1;memoryCursor=0;}
   const local=t-(second?12:0);
   if(!second&&local>=3.65&&local<=8.7){const count=Math.min(phrase.length,Math.floor((local-3.65)/4.3*phrase.length)+1);if(count!==chars){chars=count;await games.typing.evaluate(value=>{const input=document.getElementById('typing-input');input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));},phrase.slice(0,count));}}
   if(second&&local>=3.6&&!typedError){typedError=true;await games.typing.evaluate(value=>{const input=document.getElementById('typing-input');input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));},phrase.slice(0,4)+'x');}
   if(second&&local>=4.25&&chars!==5){chars=5;await games.typing.evaluate(value=>{const input=document.getElementById('typing-input');input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));},phrase.slice(0,5));}
   const memoryTimes=second?[4.3,5.5,7.0]:[4.0,4.9,5.8,6.7,7.6];
   if(memoryCursor<memoryTimes.length&&local>=memoryTimes[memoryCursor]){const index=await games.backdoor.evaluate(({cursor,wrong})=>{const positions=wrong?Array.from({length:64},(_,n)=>n).filter(n=>!backdoorTargetPositions.includes(n)):backdoorTargetPositions;return positions[cursor];},{cursor:memoryCursor,wrong:second});await games.backdoor.locator('.backdoor-cell[data-index="'+index+'"]').dispatchEvent('click');report.actions.push({time:t,game:'backdoor',index,expected:second?'wrong':'correct'});memoryCursor++;}
   if(!second&&t<8.5){const hit=await games.bypass.evaluate(()=>RiskPresentation.currentScreen()==='bypass'&&bypassLevel<=3&&bypassGauge>=bypassTarget-2&&bypassGauge<=bypassTarget+2);if(hit&&t-bypassLast>.5){await games.bypass.evaluate(()=>attemptBypass());bypassLast=t;report.actions.push({time:t,game:'bypass',action:'stop at actual target'});}}
   if(!second&&t>=9&&!exitFirst){exitFirst=true;await games.bypass.evaluate(()=>exitBypassGame());}
   if(second&&local>=7&&!missSecond){const miss=await games.bypass.evaluate(()=>RiskPresentation.currentScreen()==='bypass'&&Math.abs(bypassGauge-bypassTarget)>bypassTolerance+5);if(miss){missSecond=true;await games.bypass.evaluate(()=>attemptBypass());report.actions.push({time:t,game:'bypass',action:'miss outside actual target'});}}
   await page.clock.runFor(1000/FPS);
   const states={};for(const name of names)states[name]=await games[name].evaluate(()=>({screen:RiskPresentation.currentScreen(),protocol:RiskPresentation.protocol(),snapshot:RiskPresentation.snapshot()}));
   await page.evaluate(({t,states})=>updateFilm(t,states),{t,states});
   if(snapshots.has(frame)){report.samples.push({time:t,states});if(!REHEARSE)await page.screenshot({path:path.join(WORK,'review-'+String(frame).padStart(4,'0')+'.png')});}
   if(!PREVIEW){const bytes=await page.screenshot({type:'jpeg',quality:97});if(!encoder.stdin.write(bytes))await once(encoder.stdin,'drain');}
   if(frame%120===0)console.log(JSON.stringify({frame,total:DURATION*FPS,seconds:t,screens:Object.fromEntries(names.map(n=>[n,states[n].screen]))}));
  }
  for(const name of names)report.cues.push(...(await games[name].evaluate(()=>window.__filmEvents)).map(e=>({source:name,...e})));
  if(report.errors.length)throw Error('Browser errors: '+report.errors.join('; '));
  for(const name of names)for(const kind of ['minigame-success','minigame-fail'])if(!report.cues.some(e=>e.source===name&&e.type===kind))throw Error('Missing real '+name+' '+kind+' outcome');
  if(encoder){encoder.stdin.end();const [code]=await once(encoder,'exit');if(code!==0)throw Error('Picture encoding failed '+code);encoder=null;}
  if(!PREVIEW){const output=path.join(OUTPUT,'Protocol-Preview.mp4'),music=path.join(ROOT,'art-source/audio/masters/music-original.wav');await ff(['-hide_banner','-loglevel','error','-y','-i',picture,'-i',music,'-filter_complex','[1:a]volume=0.65,afade=t=in:st=0:d=1,afade=t=out:st=22.5:d=1.5,atrim=duration=24[a]','-map','0:v:0','-map','[a]','-c:v','copy','-c:a','aac','-b:a','256k','-ar','48000','-t','24','-movflags','+faststart',output]);report.decode=await ff(['-hide_banner','-i',output,'-f','null','-']);report.audioMeasurement=await ff(['-hide_banner','-nostats','-i',output,'-vn','-af','loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json','-f','null','-']);report.file={name:path.basename(output),bytes:fs.statSync(output).size,sha256:crypto.createHash('sha256').update(fs.readFileSync(output)).digest('hex')};await fsp.copyFile(path.join(WORK,'review-0108.png'),path.join(OUTPUT,'Protocol-Preview-Poster.png'));}
  await fsp.writeFile(path.join(WORK,'preview-report.json'),JSON.stringify(report,null,2)+'\n');console.log((PREVIEW?'PREVIEW_READY ':'PROTOCOL_FILM_READY ')+WORK);
 }catch(error){report.failure=error.stack;await fsp.writeFile(path.join(WORK,'preview-report.json'),JSON.stringify(report,null,2)+'\n');throw error;}finally{if(encoder){encoder.stdin.destroy();encoder.kill();}await browser.close();await new Promise(r=>server.close(r));}
}
main().catch(e=>{console.error(e.stack||e);process.exitCode=1;});

// Portable browser lookup: environment override, then the Chromium installed by Playwright.
/* Reproducible 40-second Blacksite Relay trailer.
 * Uses the shipped game unchanged in an isolated browser, scripted actual actions,
 * an advanced local demonstration save, deterministic rolls, and original masters.
 * node scripts/render-trailer.cjs [--preview] [--fps=30] [--output=/path]
 * Intermediates: --work=/path; optional new Blender sequence: --intro-frames=/path.
 */
'use strict';
const fs=require('node:fs'),fsp=require('node:fs/promises'),path=require('node:path'),http=require('node:http');
const {spawn}=require('node:child_process');
const {once}=require('node:events');
const {createHash}=require('node:crypto');
const ROOT=path.resolve(__dirname,'..');
const {chromium}=require(path.join(ROOT,'node_modules/playwright'));
const VERSION=require(path.join(ROOT,'package.json')).version;
const SOURCE=path.join(ROOT,'art-source','trailer');
const WORK=path.resolve(process.env.RISK_TRAILER_WORK||process.argv.find(a=>a.startsWith('--work='))?.slice(7)||path.join(ROOT,'..','protocol-environments','media','trailer'));
const INTRO_SEQUENCE=process.argv.find(a=>a.startsWith('--intro-frames='))?.slice(15);
const INTRO_FRAMES=path.resolve(INTRO_SEQUENCE||path.join(WORK,'intro-frames'));
const OUTPUT=path.resolve(process.env.RISK_TRAILER_OUTPUT||process.argv.find(a=>a.startsWith('--output='))?.slice(9)||path.resolve(ROOT,'..','..','outputs','Blacksite-Relay-'+VERSION));
const FFMPEG=require(path.join(ROOT,'node_modules/ffmpeg-static'));
const FPS=Number(process.argv.find(a=>a.startsWith('--fps='))?.split('=')[1]||30);
const REHEARSE=process.argv.includes('--rehearse'),PREVIEW=process.argv.includes('--preview')||REHEARSE;
const TOTAL=40,FRAME_COUNT=TOTAL*FPS;
const CHROME=process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||process.env.CHROMIUM_EXECUTABLE||chromium.executablePath();

const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><base href="/"><title>Blacksite Relay — trailer stage</title><style>
*{box-sizing:border-box}html,body{width:1920px;height:1080px;margin:0;overflow:hidden;background:#060d12;color:#e9f0ee;font-family:Bahnschrift,'Segoe UI',Arial,sans-serif}body{position:relative}canvas{image-rendering:pixelated}#trailer-scene{position:absolute;inset:0;width:1920px;height:1080px;opacity:.28}#opening-art{position:absolute;inset:0;width:1920px;height:1080px;object-fit:cover;image-rendering:pixelated}#full-shade{position:absolute;inset:0;background:linear-gradient(90deg,#050c12ed 0%,#061015d6 32%,#07101552 76%,#040a1050 100%)}.frame-rule{position:absolute;left:56px;right:56px;height:1px;background:#71b1a92a;top:49px}.frame-rule.bottom{top:auto;bottom:40px}.brand{font-size:28px;font-weight:700;letter-spacing:-1.8px;display:flex;align-items:baseline;line-height:1}.brand b{font-weight:500;font-size:.46em;color:#ffcc7a;letter-spacing:-.05em}.brand i{display:inline-block;width:.08em;height:.08em;background:#ffcc7a;margin-left:.045em}.mast{position:absolute;left:84px;right:84px;top:74px;display:flex;align-items:center;justify-content:space-between;color:#95b6b4;font:13px Consolas,monospace;letter-spacing:2px}.mast .brand{color:#e9f0ee}.status-dot{display:inline-block;width:5px;height:5px;background:#ffcc7a;box-shadow:0 0 12px #ffcc7a7d;margin-right:10px}.mast-right{display:flex;align-items:center;gap:34px}.intro-copy{position:absolute;left:112px;top:360px}.intro-copy .eyebrow{font:15px Consolas,monospace;letter-spacing:5px;color:#9bbebb}.intro-copy .brand{font-size:194px;letter-spacing:-14px;margin-top:33px}.intro-copy h1{font-size:39px;letter-spacing:15px;font-weight:400;color:#ffcc7a;margin:21px 0 0}.intro-copy p{font:19px Consolas,monospace;letter-spacing:5px;margin:37px 0 0;color:#e5eee9}.intro-copy .line{margin-top:43px;width:90px;height:3px;background:#ffcc7a}.intro-meta{position:absolute;left:114px;bottom:98px;color:#829f9e;font:12px Consolas,monospace;letter-spacing:3px}.intro-meta span{color:#ddddd0;margin-left:32px}.game-layout{position:absolute;inset:0}.game-window{position:absolute;left:1206px;top:49px;width:630px;height:975px;border:1px solid #8fb7ab61;box-shadow:0 22px 80px #0009;overflow:hidden;background:#091217}.game-window iframe{display:block;position:absolute;top:0;left:0;width:420px;height:650px;border:0;transform:scale(1.5);transform-origin:0 0;pointer-events:none}.game-marker{position:absolute;top:1035px;left:1206px;width:630px;display:flex;justify-content:space-between;font:10px Consolas,monospace;letter-spacing:1.6px;color:#628781}.chapter{position:absolute;left:90px;top:157px;width:1060px}.chapter-index{font:14px Consolas,monospace;letter-spacing:3px;color:#73cdbb;display:flex;align-items:center;gap:15px}.chapter-index:before{content:'';width:30px;height:2px;background:#73cdbb}.chapter h2{font-size:91px;line-height:.99;font-weight:500;letter-spacing:-4px;margin:30px 0 0;white-space:pre-line}.chapter h2 em{font-style:normal;color:#ffcc7a}.scene-box{position:absolute;left:88px;top:430px;width:1038px;height:371px;border:1px solid #83bdad66;background:#081314;box-shadow:0 20px 80px #0005}.scene-box canvas{width:100%;height:100%;display:block}.scene-box:after{content:'';position:absolute;inset:0;box-shadow:inset 0 0 75px #0003;pointer-events:none}.scene-head{position:absolute;left:88px;top:400px;width:1038px;display:flex;justify-content:space-between;font:12px Consolas,monospace;letter-spacing:2px;color:#95b6b0}.scene-head .live{color:#ffcc7a}.scene-foot{position:absolute;left:88px;top:818px;width:1038px;display:flex;justify-content:space-between;font:11px Consolas,monospace;letter-spacing:1.2px;color:#668c87}.scene-foot span:last-child{color:#acd9cb}.detail-copy{position:absolute;left:90px;top:884px;width:1030px;display:flex;gap:42px;align-items:flex-start}.detail-copy>span{display:block;flex:1;padding-top:16px;border-top:1px solid #7da59238;font:13px Consolas,monospace;letter-spacing:1.4px;color:#a8bbb0;line-height:1.7}.detail-copy b{font-weight:400;color:#ffcc7a;display:block;font-size:11px;letter-spacing:2.1px;margin-bottom:5px}.detail-copy .descriptor{font-family:Bahnschrift,'Segoe UI',sans-serif;font-size:23px;letter-spacing:.1px;color:#e4e9dc}.film-strip{position:absolute;left:88px;bottom:24px;width:1040px;display:flex;align-items:center;gap:14px;font:10px Consolas,monospace;letter-spacing:1.3px;color:#436d65}.film-strip:before{content:'';height:2px;background:#6ca995;width:24px}.timecode{margin-left:auto;color:#98b3a9}#phase-line{position:absolute;left:0;bottom:0;height:2px;background:#ffcc7a;width:0;opacity:.7}.end-copy{position:absolute;left:110px;top:280px}.end-copy .eyebrow{font:16px Consolas,monospace;color:#91d6c4;letter-spacing:4px}.end-copy .brand{font-size:180px;letter-spacing:-12px;margin-top:31px}.end-copy h2{font-size:38px;font-weight:400;letter-spacing:13px;color:#ffcc7a;margin-top:26px}.end-copy .tagline{font-size:40px;font-weight:400;letter-spacing:-.9px;margin:42px 0 0}.end-copy .release{margin-top:33px;font:14px Consolas,monospace;letter-spacing:4px;color:#a4b8ad}.end-copy .release b{color:#ffcc7a;font-weight:400}.end-bottom{position:absolute;left:112px;bottom:102px;font:12px Consolas,monospace;letter-spacing:2px;color:#79a092}.end-bottom span{margin-left:35px;color:#b5c7bd}#cut-flash{position:absolute;inset:0;background:#fff0cc;pointer-events:none;opacity:0}#fade{position:absolute;inset:0;background:#02060a;opacity:1;pointer-events:none}.invisible{visibility:hidden!important}
</style></head><body>
<canvas id="trailer-scene" data-relay-scene></canvas><img id="opening-art" src="assets/scene/blacksite-relay.png"><div id="full-shade"></div><div class="frame-rule"></div><div class="frame-rule bottom"></div>
<header class="mast"><div class="brand">RISK<b>_v2</b><i></i></div><div class="mast-right"><span><i class="status-dot"></i>BLACKSITE RELAY</span><span>SUBLEVEL 06</span></div></header>
<div class="intro-copy" id="intro-copy"><div class="eyebrow">BENEATH THE CITY. ABOVE THE LAW.</div><div class="brand">RISK<b>_v2</b><i></i></div><h1>BLACKSITE RELAY</h1><p>BREACH. BUILD. GET OUT.</p><div class="line"></div></div><div class="intro-meta" id="intro-meta">HD–2D CYBERPUNK<span>A HIGH-STAKES HACKING GAME</span></div>
<div class="game-layout invisible" id="game-layout"><div class="game-window"><iframe id="game" src="index.html" title="Actual Risk_v2 gameplay"></iframe></div><div class="game-marker"><span>ACTUAL GAMEPLAY / PORTRAIT EDITION</span><span>420 × 650</span></div>
<div class="chapter"><div class="chapter-index" id="chapter-index">01 / ESTABLISH CONNECTION</div><h2 id="chapter-title">Every gain.\n<em>A greater risk.</em></h2></div>
<div class="scene-head"><span>CCTV_06 / RELAY CORE</span><span class="live"><i class="status-dot"></i><span id="scene-mode">LIVE SIGNAL</span></span></div><div class="scene-box"><canvas id="scene-detail" width="1038" height="371"></canvas></div><div class="scene-foot"><span>LIVE DETAIL / ANIMATED GAME ENVIRONMENT</span><span id="detail-status">ENCRYPTION ACTIVE</span></div>
<div class="detail-copy"><span><b id="detail-one-label">BREACH</b><span class="descriptor" id="detail-one">Choose your exposure.</span></span><span><b id="detail-two-label">BUILD</b><span class="descriptor" id="detail-two">Push the multiplier.</span></span><span><b id="detail-three-label">GET OUT</b><span class="descriptor" id="detail-three">Keep what you secure.</span></span></div><div class="film-strip"><span>BLACKSITE RELAY / PRIVATE NETWORK</span><span class="timecode" id="timecode">00:05:00</span></div></div>
<div class="end-copy invisible" id="end-copy"><div class="eyebrow">YOUR NEXT BREACH IS WAITING.</div><div class="brand">RISK<b>_v2</b><i></i></div><h2>BLACKSITE RELAY</h2><p class="tagline">How long will you stay?</p><div class="release"><b>WINDOWS</b> / HD–2D EDITION</div></div><div class="end-bottom invisible" id="end-bottom">A GAME BY b7216309-jpg<span>ORIGINAL ART. ORIGINAL SOUND.</span></div>
<div id="phase-line"></div><div id="cut-flash"></div><div id="fade"></div><script src="src/relay-life.js"></script><script src="src/relay-pets.js"></script><script src="src/relay-shadows.js"></script><script src="src/relay-lighting.js"></script><script src="src/relay-scene.js"></script>
<script>
const $=id=>document.getElementById(id), child=$('game'), detail=$('scene-detail'), dc=detail.getContext('2d');
window.trailerUpdate=async function(t,shot){
const intro=t<5,end=t>=35,game=!intro&&!end;['game-layout'].forEach(id=>$(id).classList.toggle('invisible',!game));['intro-copy','intro-meta'].forEach(id=>$(id).classList.toggle('invisible',!intro));['end-copy','end-bottom'].forEach(id=>$(id).classList.toggle('invisible',!end));
$('opening-art').style.opacity=intro?1:0;$('trailer-scene').style.opacity=intro?0:end?.88:.24;
$('full-shade').style.background=intro||end?'linear-gradient(90deg,#030b12f0 0%,#041015c8 33%,#05101537 81%,#020a1244 100%)':'linear-gradient(90deg,#061013ca,#07131594 52%,#061116d9 100%)';
$('fade').style.opacity=String(t<.6?1-t/.6:t>39.3?(t-39.3)/.7:0);
const cut=[5,10.7,18.2,25.6,31.8,35].reduce((max,at)=>Math.max(max,t>=at&&t<at+.18?(.18-(t-at))/.18*.085:0),0);$('cut-flash').style.opacity=String(cut);
$('phase-line').style.width=(t/40*1920)+'px';
if(intro){const frame=Math.max(1,Math.min(144,1+Math.floor(t/5*143)));const next='/__intro/relay_'+String(frame).padStart(4,'0')+'.png';if(!$('opening-art').src.endsWith(next)){$('opening-art').src=next;await $('opening-art').decode();}const e=Math.min(1,Math.max(0,(t-.45)/.9));$('intro-copy').style.opacity=String(e);$('intro-copy').style.transform='translateY('+((1-e)*14)+'px)';}
if(end){const e=Math.min(1,(t-35)/.55);$('end-copy').style.opacity=String(e);$('end-copy').style.transform='translateY('+((1-e)*12)+'px)';}
if(game){
$('chapter-index').textContent=shot.index;$('chapter-title').innerHTML=shot.title;$('scene-mode').textContent=shot.mode;$('detail-status').textContent=shot.status;
['one','two','three'].forEach((key,i)=>{$('detail-'+key+'-label').textContent=shot.details[i][0];$('detail-'+key).textContent=shot.details[i][1]});
const gameDoc=child.contentDocument, screen=child.contentWindow.RiskPresentation.currentScreen();let source=gameDoc.getElementById(screen==='success'?'success-scene':screen==='busted'?'busted-scene':'relay-scene');
dc.imageSmoothingEnabled=false;dc.fillStyle='#071112';dc.fillRect(0,0,1038,371);
if(source&&source.width){if(screen==='success'||screen==='busted'){const sh=source.width*371/1038;dc.drawImage(source,0,source.height*.31,source.width,sh,0,0,1038,371)}else dc.drawImage(source,0,0,1038,371);}
const sec=Math.floor(t),f=Math.floor((t-sec)*30);$('timecode').textContent='00:'+String(sec).padStart(2,'0')+':'+String(f).padStart(2,'0');
}
};
</script></body></html>`;

const shots=[
  {at:5,index:'01 / ESTABLISH CONNECTION',title:'Every gain.\n<em>A greater risk.</em>',mode:'LIVE SIGNAL',status:'ENCRYPTION ACTIVE',details:[['BREACH','Choose your exposure.'],['BUILD','Push the multiplier.'],['GET OUT','Keep what you secure.']]},
  {at:10.7,index:'02 / INJECTION',title:'Command\n<em>the connection.</em>',mode:'PROTOCOL FOCUS',status:'INJECTION TERMINAL',details:[['READ','Prepare the command.'],['TYPE','Beat the deadline.'],['GAIN','Raise the multiplier.']]},
  {at:18.2,index:'03 / MEMORY',title:'Remember\n<em>the way through.</em>',mode:'PROTOCOL FOCUS',status:'MEMORY PATCHBAY',details:[['WATCH','Five ports light up.'],['RECALL','Find them again.'],['ESCAPE','Erase part of the trace.']]},
  {at:25.6,index:'04 / BYPASS',title:'Find\n<em>your opening.</em>',mode:'PROTOCOL FOCUS',status:'BYPASS SEQUENCER',details:[['FOCUS','Stop in the target.'],['ADVANCE','Each lock gets harder.'],['ESCAPE','Reduce your exposure.']]},
  {at:31.8,index:'05 / DISAPPEAR',title:'Make it out.\n<em>Make it yours.</em>',mode:'SECURE UPLINK',status:'TRANSFER COMPLETE',details:[['EXTRACT','Bank your funds.'],['UPGRADE','Build your edge.'],['RETURN','Risk it all again.']]}
];
const shotAt=t=>[...shots].reverse().find(s=>t>=s.at)||shots[0];
const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.png':'image/png','.webm':'video/webm','.wav':'audio/wav','.ogg':'audio/ogg','.json':'application/json','.svg':'image/svg+xml'};
function processRun(args,quiet=false){return new Promise((resolve,reject)=>{const proc=spawn(FFMPEG,args,{windowsHide:true,stdio:['ignore','ignore','pipe']});let error='';proc.stderr.on('data',d=>{error+=d;if(!quiet&&error.length<8000)process.stderr.write(d)});proc.on('error',reject);proc.on('exit',code=>code===0?resolve(error):reject(new Error('FFmpeg '+code+'\n'+error.slice(-6000))))})}

async function main(){
await fsp.mkdir(WORK,{recursive:true});await fsp.mkdir(OUTPUT,{recursive:true});
await fsp.writeFile(path.join(WORK,'stage.html'),html);
if(INTRO_SEQUENCE){
 if(![1,144].every(n=>fs.existsSync(path.join(INTRO_FRAMES,'relay_'+String(n).padStart(4,'0')+'.png'))))throw new Error('The selected Blender intro sequence must contain frames1through144.');
}else{
 const intro=path.join(ROOT,'assets/scene/intro.webm'),hash=createHash('sha256').update(fs.readFileSync(intro)).digest('hex');
 const marker=path.join(INTRO_FRAMES,'source-video.json');let previous=null;try{previous=JSON.parse(fs.readFileSync(marker,'utf8'))}catch{}
 if(previous?.sha256!==hash||!fs.existsSync(path.join(INTRO_FRAMES,'relay_0144.png'))){
  await fsp.mkdir(INTRO_FRAMES,{recursive:true});await processRun(['-hide_banner','-loglevel','error','-y','-i',intro,'-vf','fps=24',path.join(INTRO_FRAMES,'relay_%04d.png')]);
  await fsp.writeFile(marker,JSON.stringify({source:'assets/scene/intro.webm',sha256:hash},null,2));
 }
}
const server=http.createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://127.0.0.1'),rel=decodeURIComponent(url.pathname);let file,allowedRoot;
 if(rel==='/__trailer-stage.html'){file=path.join(WORK,'stage.html');allowedRoot=WORK;}
 else if(rel.startsWith('/__intro/')){file=path.resolve(INTRO_FRAMES,rel.slice(9));allowedRoot=INTRO_FRAMES;}
 else{file=path.resolve(ROOT,'.'+rel);allowedRoot=ROOT;}
 if(!file.startsWith(allowedRoot+path.sep)){res.writeHead(403).end();return;}
 const data=await fsp.readFile(file);res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Content-Length':data.length,'Cache-Control':'no-cache'});res.end(data)
}catch{res.writeHead(404).end('not found')}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,executablePath:fs.existsSync(CHROME)?CHROME:undefined,args:['--hide-scrollbars']});
let ff=null;
try{
const context=await browser.newContext({viewport:{width:1920,height:1080},deviceScaleFactor:1});
await context.addInitScript(()=>{
window.electronAPI={loadGame:async()=>({totalMoney:18500,playerName:'AGENT_06',pUpgrades:{ram:{lvl:15},miner:{lvl:7},vpn:{lvl:4},fan:{lvl:8}},prestigeLevel:2,prestigePoints:2,tutorialSeen:true,musicVolume:0,sfxVolume:0,presentation:{version:1,introSeen:true,reducedMotion:false,effectsLevel:'full'}}),saveGame:async()=>true,getLeaderboard:async()=>JSON.stringify({dreamlo:{leaderboard:{entry:[]}}}),submitScore:async()=> 'OK',closeApp:()=>{}};
window.__trailerTime=0;window.__trailerRecord=false;window.__trailerSounds=[];
window.Math.random=()=>.99999;
document.addEventListener('risk:event',e=>{if(window.__trailerRecord)window.__trailerSounds.push({time:window.__trailerTime,...e.detail});});
window.addEventListener('risk:ready',()=>window.__trailerReady=true);
});
const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto(base+'/__trailer-stage.html',{waitUntil:'load'});
const game=page.frames().find(f=>f.url().endsWith('/index.html'));
await game.waitForFunction(()=>window.__trailerReady&&window.BlacksiteScene?.getDiagnostics().artLoaded&&window.RelayLife?.getDiagnostics().ready&&window.RelayPets?.getDiagnostics().ready&&window.RelayLighting?.getDiagnostics().ready);
await page.waitForFunction(()=>window.BlacksiteScene?.getDiagnostics().artLoaded&&window.RelayLife?.getDiagnostics().ready&&window.RelayPets?.getDiagnostics().ready&&window.RelayLighting?.getDiagnostics().ready);
await page.clock.install({time:new Date('2026-09-05T10:00:00Z')});await page.clock.pauseAt(new Date('2026-09-05T10:00:00Z'));
const preroll=await game.evaluate(()=>{window.showPersistentUpgrades();window.startGame();for(let n=0;n<9;n++)hack(1+n%3);window.BlacksiteScene.setCaptureTime(0);document.activeElement?.blur();return RiskPresentation.snapshot();});
await page.evaluate(()=>BlacksiteScene.setCaptureTime(0));
const actions=[
 [5.55,'hack',1],[6.20,'hack',2],[6.90,'hack',3],[7.6,'bonus',5],[8.05,'hack',2],[8.8,'hack',1],[9.55,'hack',3],
 [10.7,'typing'],[18.2,'backdoor'],[25.6,'bypass'],[31.0,'exit-bypass'],[31.8,'transfer']
];
let cursor=0,lastBypassAttempt=-1,lastState=null,typingPhraseForFilm='',typingChars=-1,memoryCursor=0;
const snapshots=[],sfxExtra=[],operatorFrames=[],petFrames=[],lightingFrames=[],shadowFrames=[],protocolFrames=[];
const silent=path.join(WORK,'picture-master.mp4');
if(!PREVIEW){
ff=spawn(FFMPEG,['-hide_banner','-loglevel','error','-y','-f','image2pipe','-vcodec','mjpeg','-framerate',String(FPS),'-i','pipe:0','-an','-vf','scale=1920:1080:in_range=pc:out_range=tv:out_color_matrix=bt709','-c:v','libx264','-preset','fast','-crf','17','-g',String(FPS*2),'-keyint_min',String(FPS*2),'-sc_threshold','0','-bf','0','-pix_fmt','yuv420p','-colorspace','bt709','-color_primaries','bt709','-color_trc','bt709','-movflags','+faststart',silent],{windowsHide:true,stdio:['pipe','ignore','pipe']});
ff.stderr.on('data',d=>process.stderr.write(d));ff.on('error',e=>{throw e});
}
const previewFrames=new Set([0,60,149,180,285,345,435,495,570,660,720,810,900,960,1080,1128,1143,1180].map(n=>Math.round(n*FPS/30)));
for(let frame=0;frame<FRAME_COUNT;frame++){
 const t=frame/FPS;
 await game.evaluate(t=>{window.__trailerTime=t;window.__trailerRecord=t>=5;BlacksiteScene.setCaptureTime(t);},t);
 while(cursor<actions.length&&actions[cursor][0]<=t+1e-7){
   const action=actions[cursor++];
   const result=await game.evaluate(([at,type,value])=>{
     if(type==='hack')window.hack(value);else if(type==='bonus')window.buyBonus(value);else if(type==='bypass')window.bypass();else if(type==='exit-bypass')window.exitBypassGame();else if(type==='transfer')window.transfer();
     else if(type==='typing'||type==='backdoor'){const original=Math.random;let seed=type==='typing'?47001:47128;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};try{if(type==='typing')startTypingProtocol();else startBackdoorProtocol();}finally{Math.random=original;}}
     return RiskPresentation.snapshot();
   },action);
   snapshots.push({time:t,action:action.slice(1),screen:result.screen,money:result.money,risk:result.risk,multiplier:result.multiplier,charge:result.bypassCharge});
   if(action[1]==='typing')typingPhraseForFilm=await game.evaluate(()=>typingPhrase);
 }
 if(t>=14.1&&t<=17.5&&typingPhraseForFilm){const count=Math.min(typingPhraseForFilm.length,Math.floor((t-14.1)/3.05*typingPhraseForFilm.length)+1);if(count!==typingChars){typingChars=count;await game.evaluate(value=>{const input=document.getElementById('typing-input');input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));},typingPhraseForFilm.slice(0,count));}}
 if(memoryCursor<5&&t>=[21.6,22.4,23.2,24,24.8][memoryCursor]){const index=await game.evaluate(cursor=>backdoorTargetPositions[cursor],memoryCursor);await game.locator('.backdoor-cell[data-index="'+index+'"]').dispatchEvent('click');snapshots.push({time:t,action:['memory-selection',index]});memoryCursor++;}
 if(t>=25.6&&t<30.85){
   const hit=await game.evaluate(()=>{if(RiskPresentation.currentScreen()!=='bypass')return false;return bypassGauge>=bypassTarget-2&&bypassGauge<=bypassTarget+2;});
   if(hit&&t-lastBypassAttempt>.5){await game.evaluate(()=>window.attemptBypass());lastBypassAttempt=t;sfxExtra.push({time:t,type:'click'});}
 }
 lastState=await game.evaluate(()=>RiskPresentation.snapshot());
 await page.evaluate(({t,state})=>{BlacksiteScene.setState({...state,screen:'game'});BlacksiteScene.setCaptureTime(t)}, {t,state:lastState});
 await page.clock.runFor(1000/FPS);
 await page.evaluate(({t,shot})=>window.trailerUpdate(t,shot),{t,shot:shotAt(t)});
 if(previewFrames.has(frame))lightingFrames.push({time:t,game:await game.evaluate(()=>RelayLighting.getDiagnostics()),stage:await page.evaluate(()=>RelayLighting.getDiagnostics())});
 if(previewFrames.has(frame))shadowFrames.push({time:t,game:await game.evaluate(()=>RelayShadows.getDiagnostics()),stage:await page.evaluate(()=>RelayShadows.getDiagnostics())});
 if(previewFrames.has(frame))petFrames.push({time:t,game:await game.evaluate(()=>RelayPets.getDiagnostics()),stage:await page.evaluate(()=>RelayPets.getDiagnostics())});
 if(previewFrames.has(frame))operatorFrames.push({time:t,game:await game.evaluate(()=>RelayLife.getDiagnostics()),stage:await page.evaluate(()=>RelayLife.getDiagnostics())});
 if(previewFrames.has(frame))protocolFrames.push({time:t,screen:lastState.screen,protocol:await game.evaluate(()=>RiskPresentation.protocol())});
 if(!REHEARSE&&(!PREVIEW||previewFrames.has(frame))){
   if(PREVIEW)await page.screenshot({path:path.join(WORK,'preview-'+String(frame).padStart(4,'0')+'.png')});
   else {const bytes=await page.screenshot({type:'jpeg',quality:96});if(!ff.stdin.write(bytes))await once(ff.stdin,'drain');}
 }
 if(!REHEARSE&&(frame===180||frame===660||frame===1080))await page.screenshot({path:path.join(WORK,'poster-'+frame+'.png')});
 if(frame%(FPS*5)===0)console.log(JSON.stringify({frame,total:FRAME_COUNT,t,screen:lastState.screen,money:lastState.money,risk:lastState.risk}));
}
const cues=await game.evaluate(()=>window.__trailerSounds);
await fsp.writeFile(path.join(WORK,'capture-log.json'),JSON.stringify({duration:TOTAL,fps:FPS,scripted:true,save:'Isolated advanced demonstration loadout; nine real hacks before the opening shot.',preroll,random:'Hack rolls fixed .99999; seeded real Injection phrase and Memory target generation. Actual input handlers/timers/targets/rewards resolve every outcome; protocol appearances are explicitly triggered for filming.',snapshots,cues,operatorFrames,petFrames,lightingFrames,shadowFrames,protocolFrames,errors},null,2));
if(errors.length)throw new Error('Game capture errors: '+errors.join('; '));
if(!snapshots.some(s=>s.action[0]==='transfer'&&s.screen==='success'))throw new Error('Trailer demonstration did not reach extraction. Inspect capture-log.json.');
for(const name of ['typing','backdoor','bypass'])if(!cues.some(e=>e.type==='minigame-success'&&e.game===name))throw Error('Trailer did not resolve real '+name+' success.');
if(ff){ff.stdin.end();const [code]=await once(ff,'exit');if(code!==0)throw new Error('Picture encoder failed '+code);ff=null;}
if(PREVIEW){console.log('PREVIEW_READY '+WORK);return;}

const master=path.join(ROOT,'art-source/audio/masters'),music=path.join(master,'trailer-original-music-40s.wav');
const map={'hack':e=>'hack-'+e.hackType,'bonus':e=>({1:'cooler',2:'insure',3:'gamble',4:'ghost',5:'proxy',6:'overclock'}[e.bonusId]),'ghost-save':()=> 'ghost'};
// Preserve the repository's original musical arrangement; no replacement score or tonal intro layer.
const eventCues=[...cues,...sfxExtra].map(e=>({time:e.time,name:map[e.type]?map[e.type](e):e.type})).filter(e=>fs.existsSync(path.join(master,'sfx-'+e.name+'.wav'))&&e.time<TOTAL);
const args=['-hide_banner','-loglevel','error','-y','-i',silent,'-i',music], filters=['[1:a]volume=1.0[music]'];let index=2;
for(const cue of eventCues){args.push('-i',path.join(master,'sfx-'+cue.name+'.wav'));filters.push('['+index+':a]volume=0.28,adelay='+Math.round(cue.time*1000)+'|'+Math.round(cue.time*1000)+'[s'+index+']');index++;}
const mix='[music]'+eventCues.map((_,i)=>'[s'+(i+2)+']').join('');filters.push(mix+'amix=inputs='+(eventCues.length+1)+':duration=first:normalize=0,alimiter=limit=0.94,atrim=duration=40[audio]');
const filterPath=path.join(WORK,'audio-filter.txt');await fsp.writeFile(filterPath,filters.join(';\n'));
args.push('-filter_complex_script',filterPath,'-map','0:v:0','-map','[audio]','-c:v','copy','-c:a','aac','-b:a','256k','-ar','48000','-t','40','-movflags','+faststart',path.join(OUTPUT,'Blacksite-Relay-Trailer.mp4'));
await processRun(args,true);
await fsp.copyFile(path.join(WORK,'poster-1080.png'),path.join(OUTPUT,'Blacksite-Relay-Trailer-Poster.png'));
const verification=await processRun(['-hide_banner','-i',path.join(OUTPUT,'Blacksite-Relay-Trailer.mp4'),'-f','null','-'],true);
await fsp.writeFile(path.join(WORK,'ffmpeg-verification.txt'),verification);
const audioVerification=await processRun(['-hide_banner','-nostats','-i',path.join(OUTPUT,'Blacksite-Relay-Trailer.mp4'),'-vn','-af','loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json','-f','null','-'],true);
await fsp.writeFile(path.join(WORK,'audio-verification.txt'),audioVerification);
await fsp.mkdir(SOURCE,{recursive:true});
for(const name of ['stage.html','capture-log.json','audio-filter.txt','ffmpeg-verification.txt','audio-verification.txt','picture-master.mp4'])await fsp.copyFile(path.join(WORK,name),path.join(SOURCE,name));
console.log('TRAILER_READY '+path.join(OUTPUT,'Blacksite-Relay-Trailer.mp4'));
}finally{if(ff){ff.stdin.destroy();ff.kill();}await browser.close();await new Promise(r=>server.close(r));}
}
main().catch(e=>{console.error(e.stack||e);process.exitCode=1});

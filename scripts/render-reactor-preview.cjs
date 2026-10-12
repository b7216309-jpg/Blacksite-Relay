// Portable browser lookup: environment override, then the Chromium installed by Playwright.
/* Film the actual game renderer with isolated saves and explicit staged outcome cues. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto');
const {spawn}=require('node:child_process'),{once}=require('node:events');
const {chromium}=require('playwright'),ffmpeg=require('ffmpeg-static');
const root=path.resolve(__dirname,'..'),version=require('../package.json').version;
const out=path.resolve(process.env.RISK_REACTOR_PREVIEW_DIR||path.join(root,'../../outputs','Blacksite-Relay-'+version));
const work=path.resolve(process.env.RISK_REACTOR_PREVIEW_WORK||path.join(root,'../relay-reactor/preview'));
const fps=24,duration=24,preview=process.argv.includes('--preview');
const cues=[
  {frame:72,key:'safe',label:'SAFE ENTRY',color:'#56d9ff',hack:1},
  {frame:168,key:'standard',label:'STANDARD HACK',color:'#a68aff',hack:2},
  {frame:264,key:'brute',label:'BRUTE FORCE',color:'#ff72bd',hack:3},
  {frame:360,key:'success',label:'SUCCESS',color:'#86f5a1',event:'minigame-success'},
  {frame:456,key:'failure',label:'FAILURE',color:'#ff555d',event:'minigame-fail'}
];
const reviewFrames=[0,48,82,100,178,196,274,292,370,388,466,484,552];
const html=`<!doctype html><html><head><meta charset="utf-8"><style>
*{box-sizing:border-box}body{margin:0;width:1440px;height:760px;background:#070f14;color:#d7e5dd;font-family:Bahnschrift,'Segoe UI',sans-serif;overflow:hidden}iframe{position:absolute;left:32px;top:66px;width:420px;height:650px;border:0;outline:1px solid #354440}canvas{image-rendering:pixelated}#room{position:absolute;left:550px;top:198px;width:840px;height:300px;outline:1px solid #34413c}.eyebrow{position:absolute;left:550px;top:48px;font:12px Consolas,monospace;letter-spacing:3px;color:#8da59e}h1{position:absolute;left:550px;top:65px;font-size:49px;letter-spacing:-1.5px;font-weight:500}.label{font:11px Consolas,monospace;letter-spacing:1px;color:#8da59e}.native{position:absolute;left:32px;top:36px}.detail{position:absolute;left:550px;top:175px}.cue{position:absolute;left:550px;top:529px;width:840px;display:flex;align-items:center;gap:13px;font:16px Consolas,monospace;letter-spacing:2px;color:#ffcb79}.dot{width:8px;height:8px;background:currentColor}.keys{position:absolute;left:550px;top:587px;width:840px;display:flex;gap:18px}.keys span{font:11px Consolas,monospace;letter-spacing:1px;flex:1;border-top:2px solid currentColor;padding-top:12px}.line{position:absolute;left:550px;right:50px;bottom:40px;border-top:1px solid #354440;padding-top:13px;display:flex;justify-content:space-between}
</style></head><body><div class="label native">ACTUAL GAME / 420 × 650</div><iframe id="game" src="index.html"></iframe><div class="eyebrow">RISK_v2 / BLACKSITE RELAY</div><h1>The relay responds.</h1><div class="label detail">LIVE ROOM / 2×</div><canvas id="room" width="840" height="300"></canvas><div id="cue" class="cue"><i class="dot"></i><span>ON STANDBY</span></div><div class="keys">${cues.map(c=>`<span style="color:${c.color}">${c.label}</span>`).join('')}</div><div class="line label"><span>REACTOR / COMPUTER ACTIVITY / QUIET RESIDENTS</span><span>${version}</span></div></body></html>`;
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.ogg':'audio/ogg','.json':'application/json','.webm':'video/webm','.mp4':'video/mp4'};
const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
async function main(){
  fs.mkdirSync(out,{recursive:true});fs.mkdirSync(work,{recursive:true});fs.writeFileSync(path.join(work,'stage.html'),html);
  const server=http.createServer((req,res)=>{
    try{
      const url=new URL(req.url,'http://x');
      if(url.pathname==='/__preview'){res.setHeader('Content-Type','text/html');return res.end(html);}
      const file=path.resolve(root,'.'+decodeURIComponent(url.pathname));
      if(!file.startsWith(root+path.sep)||!fs.existsSync(file))return res.writeHead(404).end();
      res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));
    }catch{res.writeHead(404).end();}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||process.env.CHROMIUM_EXECUTABLE||chromium.executablePath()});
  let proc;
  try{
    const page=await browser.newPage({viewport:{width:1440,height:760},deviceScaleFactor:1}),errors=[],samples=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(()=>{
      window.electronAPI={loadGame:async()=>({totalMoney:12500,playerName:'AGENT_06',pUpgrades:{ram:{lvl:2},miner:{lvl:1}},prestigeLevel:1,prestigePoints:1,tutorialSeen:true,musicVolume:0,sfxVolume:0,presentation:{version:1,introSeen:true,reducedMotion:false,effectsLevel:'full'}}),saveGame:async()=>true,getLeaderboard:async()=>JSON.stringify({scope:'local',metric:'best-bank-balance',limit:10,entries:[]}),submitScore:async()=>'OK',closeApp:()=>{}};
      Math.random=()=>.9999;
    });
    await page.goto('http://127.0.0.1:'+server.address().port+'/__preview');
    const frame=page.frames().find(f=>f.url().endsWith('/index.html'));
    await frame.waitForFunction(()=>window.RelayPets?.getDiagnostics().ready&&window.RelayLife?.getDiagnostics().ready&&window.RelayLighting?.getDiagnostics().ready&&window.RiskPresentation?.snapshot()?.playerName==='AGENT_06');
    await frame.evaluate(()=>showPersistentUpgrades());
    await frame.waitForFunction(()=>RiskPresentation.currentScreen()==='persistent');
    await frame.evaluate(()=>{
      for(const a of Object.values(achievements))a.unlocked=true;
      startGame();money=1280;risk=12;multiplier=8;nodesHacked=0;nodesValidated=0;bypassCharge=7;updateUI();updateBonusPrices();BlacksiteScene.setCaptureTime(0);
      window.__previewEvents=[];document.addEventListener('risk:event',e=>window.__previewEvents.push({...e.detail}));
    });
    await frame.waitForFunction(()=>RiskPresentation.currentScreen()==='game'&&document.getElementById('relay-scene').width>0);
    const output=path.join(out,'Reactor-Preview.mp4'),music=path.join(root,'assets/audio/music-neon-standby.ogg');
    let stderr='',completion;
    if(!preview){
      proc=spawn(ffmpeg,['-hide_banner','-loglevel','error','-y','-f','image2pipe','-framerate',String(fps),'-vcodec','png','-i','pipe:0','-i',music,'-t',String(duration),'-map','0:v','-map','1:a','-vf','format=yuv420p','-c:v','libx264','-preset','fast','-crf','18','-g','48','-bf','0','-af','volume=0.65,afade=t=in:d=1,afade=t=out:st=22.5:d=1.5','-c:a','aac','-b:a','192k','-movflags','+faststart',output],{windowsHide:true,stdio:['pipe','ignore','pipe']});
      proc.stderr.on('data',d=>stderr+=d);completion=once(proc,'exit');
    }
    const frames=preview?[...new Set([0,...reviewFrames,...cues.map(c=>c.frame),duration*fps-1])].sort((a,b)=>a-b):Array.from({length:duration*fps},(_,i)=>i);
    for(const i of frames){
      const cue=cues.find(c=>c.frame===i);
      await page.evaluate(async({t,cue})=>{
        const game=document.getElementById('game').contentWindow;game.BlacksiteScene.setCaptureTime(t);
        if(cue){
          document.querySelector('#cue span').textContent=cue.label;document.getElementById('cue').style.color=cue.color;
          if(cue.hack)game.hack(cue.hack);
          else game.BlacksiteScene.emit({type:cue.event,game:'typing'});
        }
        await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
        const source=game.document.getElementById('relay-scene'),room=document.getElementById('room').getContext('2d');
        room.imageSmoothingEnabled=false;room.fillStyle='#070f14';room.fillRect(0,0,840,300);room.drawImage(source,Math.round((840-source.width*2)/2),Math.round((300-source.height*2)/2),source.width*2,source.height*2);
      },{t:i/fps,cue});
      if(!preview||reviewFrames.includes(i)){
        const png=await page.screenshot();if(proc&&!proc.stdin.write(png))await once(proc.stdin,'drain');
        if(reviewFrames.includes(i))fs.writeFileSync(path.join(work,'review-'+i+'.png'),png);
        if(!preview&&i===274)fs.writeFileSync(path.join(out,'Reactor-Preview-Poster.png'),png);
      }
      if(reviewFrames.includes(i))samples.push({seconds:i/fps,...await frame.evaluate(()=>({lighting:RelayLighting.getDiagnostics(),pets:RelayPets.getDiagnostics(),scene:BlacksiteScene.getDiagnostics()}))});
      if(i%144===0)console.log('reactor preview frame '+i+'/'+duration*fps);
    }
    if(proc){proc.stdin.end();const [code]=await completion;if(code)throw Error(stderr);}
    const report={version,duration,fps,frames:duration*fps,size:[1440,760],previewOnly:preview,actualGameRenderer:true,isolatedMockSave:true,liveLeaderboard:false,staging:'Three real hack function calls with deterministic rolls. Success/failure are explicit presentation-only mini-game outcome cues, without changing game rewards.',cues,gameEvents:await frame.evaluate(()=>window.__previewEvents),errors,samples,music:{file:path.relative(root,music).replaceAll('\\','/'),sha256:sha(music),gain:.65,fadeInSeconds:1,fadeOutSeconds:1.5},sources:['src/relay-scene.js','src/relay-lighting.js','src/relay-pets.js','src/relay-life.js'].map(relative=>({path:relative,sha256:sha(path.join(root,relative))})),output:preview?null:output};
    fs.writeFileSync(path.join(work,'preview-report.json'),JSON.stringify(report,null,2)+'\n');
    if(errors.length)throw Error(errors.join('\n'));
    console.log(preview?work:output);
  }finally{if(proc?.exitCode===null)proc.kill();await browser.close();await new Promise(resolve=>server.close(resolve));}
}
main().catch(e=>{console.error(e);process.exitCode=1;});

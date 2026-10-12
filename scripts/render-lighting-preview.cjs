// Portable browser lookup: environment override, then the Chromium installed by Playwright.
/* Capture the lighting revision with actual game actions and a registered prior renderer, with isolated mock saves. */
'use strict';
const fs=require('fs'),path=require('path'),http=require('http'),{spawn}=require('child_process'),{once}=require('events');
const {chromium}=require('playwright'),ffmpeg=require('ffmpeg-static');
const root=path.resolve(__dirname,'..'),version=require('../package.json').version;
const out=path.resolve(process.env.RISK_LIGHTING_PREVIEW_DIR||path.join(root,'../../outputs','Blacksite-Relay-'+version));
const work=path.resolve(process.env.RISK_LIGHTING_PREVIEW_WORK||path.join(root,'../relay-lighting/preview'));
const fps=24,duration=20;
const html=`<!doctype html><html><head><meta charset="utf-8"><style>
*{box-sizing:border-box}body{margin:0;width:1440px;height:760px;background:#070f14;color:#d7e5dd;font-family:Bahnschrift,'Segoe UI',sans-serif;overflow:hidden}iframe{position:absolute;left:32px;top:66px;width:420px;height:650px;border:0;outline:1px solid #354440}canvas{image-rendering:pixelated}#room{position:absolute;left:550px;top:198px;width:840px;height:300px;outline:1px solid #34413c}.eyebrow{position:absolute;left:550px;top:48px;font:12px Consolas,monospace;letter-spacing:3px;color:#8da59e}h1{position:absolute;left:550px;top:65px;font-size:49px;letter-spacing:-1.5px;font-weight:500}.label{font:11px Consolas,monospace;letter-spacing:1px;color:#8da59e}.native{position:absolute;left:32px;top:36px}.detail{position:absolute;left:550px;top:175px}.line{position:absolute;left:550px;right:50px;bottom:40px;border-top:1px solid #354440;padding-top:13px;display:flex;justify-content:space-between}.pet{position:absolute;top:527px;width:250px;height:137px;border-top:1px solid #354440;padding-top:16px}.pet:nth-of-type(1){left:550px}.pet:nth-of-type(2){left:845px}.pet:nth-of-type(3){left:1140px}.pet canvas{position:absolute;left:5px;top:37px;width:200px;height:100px}.pet b{font:12px Consolas,monospace;letter-spacing:1px;color:#deba7c;font-weight:400}

#before{left:550px;top:546px;width:420px;height:150px;outline:0}#after{position:absolute;left:970px;top:546px;width:420px;height:150px}.compare-label{position:absolute;top:524px}.old{left:550px}.new{left:970px}
</style></head><body><div class="label native">ACTUAL GAME / 420 × 650</div><iframe id="game" src="index.html"></iframe><div class="eyebrow">RISK_V2 / BLACKSITE RELAY</div><h1>Light from the source.</h1><div class="label detail">THE RELAY, UP CLOSE / 2×</div><canvas id="room" width="840" height="300"></canvas><div class="compare-label old label">1.2.2 / BEFORE</div><div class="compare-label new label">1.2.3 / LIGHTING</div><iframe id="before" src="/__before"></iframe><canvas id="after" width="420" height="150"></canvas><div class="line label"><span>PRACTICALS / PHOSPHOR / WET METAL</span><span>1.2.3</span></div></body></html>`;
const beforeHtml='<style>body{margin:0;background:#070f14}canvas{width:420px;height:150px;image-rendering:pixelated}</style><canvas id="relay-scene" data-relay-scene></canvas><script src="src/relay-life.js"></script><script src="src/relay-pets.js"></script><script src="art-source/lighting/relay-scene-1.2.2.cjs"></script>';
const mime={'.cjs':'text/javascript','.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.ogg':'audio/ogg','.json':'application/json','.webm':'video/webm'};
async function main(){
  fs.mkdirSync(out,{recursive:true});fs.mkdirSync(work,{recursive:true});fs.writeFileSync(path.join(work,'stage.html'),html);
  const server=http.createServer((req,res)=>{const url=new URL(req.url,'http://x');if(url.pathname==='/__before'){res.setHeader('Content-Type','text/html');return res.end(beforeHtml);}if(url.pathname==='/__preview'){res.setHeader('Content-Type','text/html');return res.end(html);}const file=path.resolve(root,'.'+decodeURIComponent(url.pathname));if(!file.startsWith(root+path.sep)||!fs.existsSync(file))return res.writeHead(404).end();res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||process.env.CHROMIUM_EXECUTABLE||chromium.executablePath()});
  let proc;
  try{
    const page=await browser.newPage({viewport:{width:1440,height:760},deviceScaleFactor:1}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(()=>{window.electronAPI={loadGame:async()=>({totalMoney:12500,playerName:'AGENT_06',pUpgrades:{ram:{lvl:2},miner:{lvl:1}},prestigeLevel:1,prestigePoints:1,tutorialSeen:true,musicVolume:0,sfxVolume:0,presentation:{version:1,introSeen:true,reducedMotion:false,effectsLevel:'full'}}),saveGame:async()=>true,getLeaderboard:async()=>JSON.stringify({scope:'local',metric:'best-bank-balance',limit:10,entries:[]}),submitScore:async()=>'OK',closeApp:()=>{}};Math.random=()=>.9999;});
    await page.goto('http://127.0.0.1:'+server.address().port+'/__preview');
    const frame=page.frames().find(f=>f.url().endsWith('/index.html'));
    await frame.waitForFunction(()=>window.RelayPets?.getDiagnostics().ready&&window.RelayLife?.getDiagnostics().ready&&window.RiskPresentation?.snapshot()?.playerName==='AGENT_06');
    await frame.evaluate(()=>showPersistentUpgrades());
    await frame.waitForFunction(()=>RiskPresentation.currentScreen()==='persistent');
    await frame.evaluate(()=>{for(const a of Object.values(achievements))a.unlocked=true;startGame();money=1280;risk=34;multiplier=8;nodesHacked=47;nodesValidated=4;bypassCharge=7;ghostShieldActive=true;insuranceTurns=3;gambleCooldown=3;updateUI();updateBonusPrices();BlacksiteScene.setCaptureTime(0);});
    await frame.waitForFunction(()=>RiskPresentation.currentScreen()==='game'&&document.getElementById('relay-scene').width>0);
    const before=page.frames().find(f=>f.url().endsWith('/__before'));
    await before.waitForFunction(()=>RelayPets.getDiagnostics().ready&&RelayLife.getDiagnostics().ready&&BlacksiteScene.getDiagnostics().artLoaded);
    await page.evaluate(()=>{const game=document.getElementById('game').contentWindow,old=document.getElementById('before').contentWindow;const a=game.document.getElementById('relay-scene'),b=old.document.getElementById('relay-scene');b.style.width=a.width+'px';b.style.height=a.height+'px';game.document.addEventListener('risk:event',e=>old.BlacksiteScene.emit(e.detail||{}));});
    const output=path.join(out,'Lighting-Preview.mp4');
    proc=spawn(ffmpeg,['-hide_banner','-loglevel','error','-y','-f','image2pipe','-framerate',String(fps),'-vcodec','png','-i','pipe:0','-i',path.join(root,'assets/audio/music-neon-standby.ogg'),'-t',String(duration),'-map','0:v','-map','1:a','-vf','format=yuv420p','-c:v','libx264','-preset','fast','-crf','18','-g','48','-bf','0','-af','volume=0.65,afade=t=in:d=1,afade=t=out:st=18.5:d=1.5','-c:a','aac','-b:a','192k','-movflags','+faststart',output],{windowsHide:true,stdio:['pipe','ignore','pipe']});
    let stderr='';proc.stderr.on('data',d=>stderr+=d);const completion=once(proc,'exit');
    for(let i=0;i<duration*fps;i++){
      await page.evaluate(async({t,i})=>{const game=document.getElementById('game').contentWindow,old=document.getElementById('before').contentWindow;old.BlacksiteScene.setState({...game.RiskPresentation.snapshot(),screen:'game'});old.BlacksiteScene.setCaptureTime(t);game.BlacksiteScene.setCaptureTime(t);if(i===144||i===288)game.hack(3);if(i===240)game.buyBonus(6);await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));},{t:i/fps,i});
      await page.evaluate(async()=>{const w=document.getElementById('game').contentWindow,room=document.getElementById('room').getContext('2d');room.imageSmoothingEnabled=false;const source=w.document.getElementById('relay-scene');room.fillStyle='#070f14';room.fillRect(0,0,840,300);room.drawImage(source,Math.round((840-source.width*2)/2),Math.round((300-source.height*2)/2),source.width*2,source.height*2);const after=document.getElementById('after').getContext('2d');after.fillStyle='#070f14';after.fillRect(0,0,420,150);after.drawImage(source,0,0);});
      const png=await page.screenshot();if(!proc.stdin.write(png))await once(proc.stdin,'drain');
      if([0,156,204,300,456].includes(i))fs.writeFileSync(path.join(work,'review-'+i+'.png'),png);
      if(i===156)fs.writeFileSync(path.join(out,'Lighting-Preview-Poster.png'),png);
      if(i%144===0)console.log('preview frame '+i+'/'+duration*fps);
    }
    proc.stdin.end();const [code]=await completion;if(code)throw Error(stderr);
    const report={version,duration,fps,frames:duration*fps,size:[1440,760],actualGame:true,isolatedMockSave:true,liveLeaderboard:false,errors,lighting:await frame.evaluate(()=>RelayLighting.getDiagnostics()),pets:await frame.evaluate(()=>RelayPets.getDiagnostics()),beforeRenderer:'art-source/lighting/relay-scene-1.2.2.cjs',output};
    fs.writeFileSync(path.join(work,'preview-report.json'),JSON.stringify(report,null,2));if(errors.length)throw Error(errors.join('\n'));console.log(output);
  }finally{if(proc?.exitCode===null)proc.kill();await browser.close();server.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});

// Portable browser lookup: environment override, then the Chromium installed by Playwright.
/* Matched-clock comparison of the shipped 1.2.4 room and current shadow renderer. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto');
const {spawn}=require('node:child_process'),{once}=require('node:events');
const root=path.resolve(__dirname,'..'),version=require(path.join(root,'package.json')).version;
const {chromium}=require(path.join(root,'node_modules/playwright')),ffmpeg=require(path.join(root,'node_modules/ffmpeg-static'));
const out=path.resolve(process.env.RISK_SHADOW_PREVIEW_DIR||path.join(root,'../../outputs','Blacksite-Relay-'+version));
const work=path.resolve(process.env.RISK_SHADOW_PREVIEW_WORK||path.join(root,'../relay-shadows/preview'));
const fps=24,duration=24,preview=process.argv.includes('--preview');
const reviewFrames=[0,48,120,192,288,384,480,552];
const html=`<!doctype html><html><head><meta charset="utf-8"><style>
*{box-sizing:border-box}body{margin:0;width:1920px;height:960px;background:#070f14;color:#d7e5dd;font-family:Bahnschrift,'Segoe UI',sans-serif;overflow:hidden}iframe{position:absolute;left:-1000px;top:0;width:420px;height:150px;border:0}canvas{image-rendering:pixelated;position:absolute;outline:1px solid #34413c}.eyebrow{position:absolute;left:72px;top:42px;font:12px Consolas,monospace;letter-spacing:3px;color:#8da59e}h1{position:absolute;left:72px;top:64px;margin:0;font-size:49px;letter-spacing:-1.5px;font-weight:500}.label{font:12px Consolas,monospace;letter-spacing:2px;color:#8da59e}.before-label{position:absolute;left:72px;top:175px}.after-label{position:absolute;left:1008px;top:175px;color:#d5b97b}#native-before{left:282px;top:218px}#native-after{left:1218px;top:218px}.scale{position:absolute;left:72px;top:410px}.scale.after{left:1008px}#room-before{left:72px;top:442px}#room-after{left:1008px;top:442px}.caption{position:absolute;left:72px;top:795px;font-size:25px;color:#b3c7bc;letter-spacing:.1px}.line{position:absolute;left:72px;right:72px;bottom:40px;border-top:1px solid #354440;padding-top:18px;display:flex;justify-content:space-between}
</style></head><body><iframe id="before" src="/__before"></iframe><iframe id="after" src="/__after"></iframe><div class="eyebrow">RISK_V2 / BLACKSITE RELAY</div><h1>Grounded in the relay.</h1><div class="label before-label">BEFORE / 1.2.4 / NATIVE 420 × 150</div><div class="label after-label">SHADOWS / ${version} / NATIVE 420 × 150</div><canvas id="native-before" width="420" height="150"></canvas><canvas id="native-after" width="420" height="150"></canvas><div class="label scale">ROOM DETAIL / 2×</div><div class="label scale after">ROOM DETAIL / 2×</div><canvas id="room-before" width="840" height="300"></canvas><canvas id="room-after" width="840" height="300"></canvas><div class="caption">Small movements. Shared light. A place for every resident.</div><div class="line label"><span>OPERATOR / TWO RATS / SERVER CAT / COIL SNAIL</span><span>ORIGINAL MUSIC / ${version}</span></div></body></html>`;
const roomHtml=before=>`<!doctype html><html><head><style>body{margin:0;background:#070f14}canvas{display:block;width:420px;height:150px;image-rendering:pixelated}</style></head><body><canvas id="relay-scene" data-relay-scene></canvas>${['relay-life','relay-pets',...(before?[]:['relay-shadows']),'relay-lighting','relay-scene'].map(name=>'<script src="'+(before?'art-source/shadows/before-1.2.4/':'src/')+name+'.js"></script>').join('')}</body></html>`;
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.json':'application/json'};
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
async function main(){
  fs.mkdirSync(out,{recursive:true});fs.mkdirSync(work,{recursive:true});fs.writeFileSync(path.join(work,'stage.html'),html);
  const server=http.createServer((req,res)=>{try{
    const url=new URL(req.url,'http://x');
    if(url.pathname==='/__preview'){res.setHeader('Content-Type','text/html');return res.end(html);}
    if(url.pathname==='/__before'||url.pathname==='/__after'){res.setHeader('Content-Type','text/html');return res.end(roomHtml(url.pathname==='/__before'));}
    const file=path.resolve(root,'.'+decodeURIComponent(url.pathname));if(!file.startsWith(root+path.sep)||!fs.existsSync(file))return res.writeHead(404).end();
    res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));
  }catch{res.writeHead(404).end();}});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||process.env.CHROMIUM_EXECUTABLE||chromium.executablePath()});
  let proc;
  try{
    const page=await browser.newPage({viewport:{width:1920,height:960},deviceScaleFactor:1}),errors=[],samples=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto('http://127.0.0.1:'+server.address().port+'/__preview');
    for(const suffix of ['/__before','/__after']){
      const frame=page.frames().find(item=>item.url().endsWith(suffix));
      await frame.waitForFunction(()=>RelayLife.getDiagnostics().ready&&RelayPets.getDiagnostics().ready&&RelayLighting.getDiagnostics().ready&&BlacksiteScene.getDiagnostics().artLoaded);
      await frame.evaluate(()=>{BlacksiteScene.setState({screen:'game',risk:18,reducedMotion:false,effectsLevel:'full'});BlacksiteScene.setCaptureTime(0);});
    }
    const output=path.join(out,'Shadow-Preview.mp4'),music=path.join(root,'assets/audio/music-neon-standby.ogg');
    let stderr='',completion;
    if(!preview){
      proc=spawn(ffmpeg,['-hide_banner','-loglevel','error','-y','-f','image2pipe','-framerate',String(fps),'-vcodec','png','-i','pipe:0','-i',music,'-t',String(duration),'-map','0:v','-map','1:a','-vf','format=yuv420p','-c:v','libx264','-preset','fast','-crf','18','-g','48','-bf','0','-af','volume=0.65,afade=t=in:d=1,afade=t=out:st=22.5:d=1.5','-c:a','aac','-b:a','192k','-movflags','+faststart',output],{windowsHide:true,stdio:['pipe','ignore','pipe']});
      proc.stderr.on('data',data=>stderr+=data);completion=once(proc,'exit');
    }
    const frames=preview?reviewFrames:Array.from({length:duration*fps},(_,index)=>index);
    for(const index of frames){
      const sample=await page.evaluate(async time=>{
        for(const id of ['before','after'])document.getElementById(id).contentWindow.BlacksiteScene.setCaptureTime(time);
        await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
        const sample={};
        for(const id of ['before','after']){
          const room=document.getElementById(id).contentWindow,source=room.document.getElementById('relay-scene');
          for(const [prefix,scale]of [['native',1],['room',2]]){
            const canvas=document.getElementById(prefix+'-'+id),context=canvas.getContext('2d');context.imageSmoothingEnabled=false;context.fillStyle='#070f14';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(source,0,0,420*scale,150*scale);
          }
          sample[id]={scene:room.BlacksiteScene.getDiagnostics(),pets:room.RelayPets.getDiagnostics(),operator:room.RelayLife.getDiagnostics(),shadows:room.RelayShadows?.getDiagnostics?.()||null};
        }
        return sample;
      },index/fps);
      const png=await page.screenshot();if(proc&&!proc.stdin.write(png))await once(proc.stdin,'drain');
      if(reviewFrames.includes(index)){fs.writeFileSync(path.join(work,'review-'+index+'.png'),png);samples.push({seconds:index/fps,...sample});}
      if(!preview&&index===192)fs.writeFileSync(path.join(out,'Shadow-Preview-Poster.png'),png);
      if(index%144===0)console.log('shadow preview frame '+index+'/'+duration*fps);
    }
    if(proc){proc.stdin.end();const [code]=await completion;if(code)throw Error(stderr);}
    const report={version,duration,fps,frames:duration*fps,size:[1920,960],nativeSize:[420,150],enlargement:2,previewOnly:preview,matchedClock:true,gameplay:'Read-only room renderer comparison; no saves, game actions or leaderboard.',baseline:'art-source/shadows/before-1.2.4/provenance.json',samples,errors,music:{file:path.relative(root,music).replaceAll('\\','/'),sha256:hash(music),gain:.65,fadeInSeconds:1,fadeOutSeconds:1.5},sources:['src/relay-scene.js','src/relay-lighting.js','src/relay-pets.js','src/relay-life.js','src/relay-shadows.js'].map(relative=>({path:relative,sha256:hash(path.join(root,relative))})),output:preview?null:output};
    fs.writeFileSync(path.join(work,'preview-report.json'),JSON.stringify(report,null,2)+'\n');if(errors.length)throw Error(errors.join('\n'));
    console.log(preview?work:output);
  }finally{if(proc?.exitCode===null)proc.kill();await browser.close();await new Promise(resolve=>server.close(resolve));}
}
main().catch(error=>{console.error(error.stack);process.exitCode=1;});

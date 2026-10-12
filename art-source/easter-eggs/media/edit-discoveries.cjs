/* Offline edit of actual native recordings; no raster/source-game changes. */
'use strict';
const fs=require('node:fs'),fsp=require('node:fs/promises'),path=require('node:path'),{spawn}=require('node:child_process'),crypto=require('node:crypto');
const WORK=__dirname,REPO=path.resolve(WORK,'../../..'),TASK=path.resolve(REPO,'../..');
const ffmpeg=require(path.join(REPO,'node_modules/ffmpeg-static')),{chromium,findChromium}=require(path.join(REPO,'scripts/protocol-environment-audit.cjs'));
const OUT=path.join(WORK,'final'),FPS=30;
const ff=args=>new Promise((resolve,reject)=>{const p=spawn(ffmpeg,args,{windowsHide:true,stdio:['ignore','ignore','pipe']});let text='';p.stderr.on('data',v=>text+=v);p.on('error',reject);p.on('exit',code=>code===0?resolve(text):reject(Error(text.slice(-8000))));});
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const title={ratUnion:'Rat Union',rootAccess:'Root Access',snailMail:'Snail Mail',locker:'The Missing Technician',room404:'Room 404'};
const edit=[{id:'ratUnion',relative:-.35,duration:6},{id:'ratUnion',relative:10,duration:4},{id:'rootAccess',relative:-.35,duration:5.5},{id:'snailMail',relative:-.35,duration:6},{id:'locker',fromKnock:true,relative:-.1,duration:8.5},{id:'room404',relative:-.35,duration:8}];
async function main(){
 await fsp.mkdir(OUT,{recursive:true});
 if(!process.argv.includes('--encode')){console.log(JSON.stringify({prepared:true,durationSeconds:edit.reduce((n,s)=>n+s.duration,0),action:'No recording or encoding started.'}));return;}
 const capture=JSON.parse(fs.readFileSync(path.join(WORK,'capture-report.json'),'utf8'));if(!capture.passed||capture.version!=='1.6.0')throw Error('Final current control recordings required.');
 const report={version:'1.6.0',width:1920,height:1080,fps:FPS,durationSeconds:38,sourceDimensions:[420,650],sourceMethod:capture.method,segments:[],cues:[],mix:{music:'art-source/audio/masters/music-original.wav',musicGain:.32,cueGain:1.5,recordingContainsAudio:false,method:'Original unchanged music and original discovery PCM masters; cues aligned to actual recorded control/discovery timestamps. Approximate recording alignment is checked on decoded frames.'},sources:[],errors:[]};
 const browser=await chromium.launch({headless:true,executablePath:findChromium()});
 try{
  const stage=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1});
  let offset=0;
  for(const [index,cut] of edit.entries()){
   const source=capture.recordings.find(r=>r.id===cut.id),event=source.events.find(e=>e.id===cut.id);
   const at=(cut.fromKnock?source.actions[0].at:event.nodeTime)-source.startWall+cut.relative;
   const box=source.detailRect,crop={x:Math.round(box.x),y:Math.round(box.y),w:Math.round(box.width),h:Math.round(box.height)};
   const detail={x:Math.round(625+(1215-crop.w*3)/2),y:Math.round(250+(650-crop.h*3)/2)};
   const layout=path.join(WORK,'stage-'+cut.id+'.png');
   await stage.setContent('<!doctype html><html><head><style>*{box-sizing:border-box}body{margin:0;background:#071015;color:#dce8e2;font-family:Bahnschrift,"Segoe UI",sans-serif}.brand{position:absolute;left:120px;top:63px;font:14px Consolas,monospace;letter-spacing:3px;color:#8fb8af}h1{position:absolute;left:117px;top:86px;font-size:61px;font-weight:500;letter-spacing:-1.4px;margin:0}.native-label{position:absolute;left:120px;top:215px}.detail-label{position:absolute;left:'+detail.x+'px;top:'+(detail.y-35)+'px}.native-label,.detail-label{font:13px Consolas,monospace;color:#a7c7bf;letter-spacing:1.5px}.native{position:absolute;left:119px;top:249px;width:422px;height:652px;border:1px solid #527067}.detail{position:absolute;left:'+(detail.x-1)+'px;top:'+(detail.y-1)+'px;width:'+(crop.w*3+2)+'px;height:'+(crop.h*3+2)+'px;border:1px solid #527067}.footer{position:absolute;left:120px;right:90px;top:968px;padding-top:21px;border-top:1px solid #35514c;display:flex;justify-content:space-between;font:12px Consolas,monospace;letter-spacing:1.3px;color:#7ea69b}</style></head><body><div class=brand>RISK_v2 / BLACKSITE RELAY</div><h1>'+title[cut.id]+'</h1><div class=native-label>420 × 650 GAME</div><div class=detail-label>3× / SCENE DETAIL</div><div class=native></div><div class=detail></div><div class=footer><span>FIVE SMALL DISCOVERIES / SPOILER PREVIEW</span><span>ORIGINAL MUSIC + NEW SCENE CUES / 1.6.0</span></div></body></html>');
   await stage.evaluate(()=>document.fonts.ready);await stage.screenshot({path:layout});
   const file=path.join(OUT,'segment-'+index+'.mp4');
   await ff(['-hide_banner','-loglevel','error','-y','-loop','1','-framerate',String(FPS),'-i',layout,'-ss',String(Math.max(0,at)),'-i',path.join(WORK,source.file),'-filter_complex',`[1:v]fps=${FPS},split=2[n][d];[d]crop=${crop.w}:${crop.h}:${crop.x}:${crop.y},scale=iw*3:ih*3:flags=neighbor[detail];[0:v][n]overlay=120:250:shortest=1[b];[b][detail]overlay=${detail.x}:${detail.y}:shortest=1,setsar=1[v]`,'-map','[v]','-an','-t',String(cut.duration),'-c:v','libx264','-crf','17','-preset','fast','-pix_fmt','yuv420p','-r',String(FPS),'-g','60','-keyint_min','60','-sc_threshold','0','-bf','0','-movflags','+faststart',file]);
   const row={...cut,source:source.file,sourceStart:at,outputStart:offset,crop,detail,file:path.basename(file)};report.segments.push(row);
   const events=source.events.map(e=>({id:e.id,sourceTime:e.nodeTime-source.startWall}));
   if(cut.id==='locker')events.push(...source.actions.map(e=>({id:'knock',sourceTime:e.at-source.startWall})));
   for(const e of events)if(e.sourceTime>=at&&e.sourceTime<at+cut.duration){const cue={ratUnion:'rat',rootAccess:'cat',snailMail:'snail',locker:'locker',room404:'arcade',knock:'knock'}[e.id];report.cues.push({name:'egg-'+cue,time:offset+e.sourceTime-at,gain:e.id==='knock'?.825:1.5});}
   offset+=cut.duration;console.log(JSON.stringify({encoded:index+1,total:edit.length,id:cut.id,duration:cut.duration}));
  }
 }finally{await browser.close();}
 const concat=path.join(OUT,'concat.txt');await fsp.writeFile(concat,report.segments.map(r=>"file '"+r.file+"'").join('\n'));
 const picture=path.join(OUT,'picture-master.mp4');await ff(['-hide_banner','-loglevel','error','-y','-f','concat','-safe','0','-i',concat,'-c','copy',picture]);
 const music=path.join(REPO,report.mix.music),inputs=['-i',picture,'-stream_loop','-1','-i',music];
 const filters=['[1:a]volume=0.32,atrim=duration=38,asetpts=PTS-STARTPTS,afade=t=in:st=0:d=0.6,afade=t=out:st=36:d=2[music]'];
 for(const [i,cue] of report.cues.entries()){const file=path.join(REPO,'art-source/audio/easter-egg-masters',cue.name+'.wav');inputs.push('-i',file);filters.push(`[${i+2}:a]volume=${cue.gain},adelay=${Math.round(cue.time*1000)}|${Math.round(cue.time*1000)}[cue${i}]`);report.sources.push({file:path.relative(REPO,file).split(path.sep).join('/'),sha256:hash(file)});}
 filters.push('[music]'+report.cues.map((_,i)=>'[cue'+i+']').join('')+`amix=inputs=${report.cues.length+1}:normalize=0:duration=longest,alimiter=limit=0.9:level=false,atrim=duration=38[a]`);
 filters.push('[0:v]fade=t=in:st=0:d=0.3,fade=t=out:st=37.5:d=0.5[v]');
 const final=path.join(OUT,'Living-Secrets-Preview.mp4');
 await ff(['-hide_banner','-loglevel','error','-y',...inputs,'-filter_complex',filters.join(';'),'-map','[v]','-map','[a]','-t','38','-c:v','libx264','-preset','fast','-crf','17','-pix_fmt','yuv420p','-r',String(FPS),'-g','60','-keyint_min','60','-sc_threshold','0','-bf','0','-c:a','aac','-b:a','256k','-ar','48000','-movflags','+faststart',final]);
 report.sources.push({file:report.mix.music,sha256:hash(music)});report.decode=await ff(['-hide_banner','-i',final,'-f','null','-']);
 report.audioMeasurement=await ff(['-hide_banner','-nostats','-i',final,'-vn','-af','loudnorm=I=-20:TP=-1.5:LRA=11:print_format=json','-f','null','-']);
 const samples=[.5,3,5.5,6.1,9.8,10.2,12.5,15.2,15.7,18,21.2,21.7,24.5,29.7,30.2,33,37.4];report.reviewFrames=[];
 for(const t of samples){const name='decoded-'+t.toFixed(1)+'s.png';await ff(['-hide_banner','-loglevel','error','-y','-ss',String(t),'-i',final,'-frames:v','1',path.join(OUT,name)]);report.reviewFrames.push(name);}
 await fsp.copyFile(path.join(OUT,'decoded-5.5s.png'),path.join(OUT,'Living-Secrets-Preview-Poster.png'));
 await ff(['-hide_banner','-loglevel','error','-y','-i',final,'-vn','-c:a','libvorbis','-q:a','5',path.join(OUT,'preview-audition.ogg')]);
 report.file={name:path.basename(final),bytes:fs.statSync(final).size,sha256:hash(final)};report.visualReviewPending=true;report.listeningReviewPending=true;report.passed=false;
 await fsp.writeFile(path.join(OUT,'preview-verification.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({encoded:true,file:final,durationSeconds:38,reviewPending:true}));
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});

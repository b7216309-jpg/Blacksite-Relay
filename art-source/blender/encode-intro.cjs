// Reproduce the bundled silent intro after build_blacksite.py --resolution 960 --render.
'use strict';
const path=require('node:path'),fs=require('node:fs'),{spawnSync}=require('node:child_process'),{createHash}=require('node:crypto');
const ROOT=path.resolve(__dirname,'../..'),ffmpeg=require(path.join(ROOT,'node_modules/ffmpeg-static'));
const option=(name,fallback)=>process.argv.find(value=>value.startsWith('--'+name+'='))?.slice(name.length+3)||fallback;
const version=require(path.join(ROOT,'package.json')).version;
const framesDir=path.resolve(option('frames',path.join(ROOT,'../relay-shadows/media/intro-frames')));
const output=path.resolve(option('output',path.join(ROOT,'../../outputs/Blacksite-Relay-'+version)));
const review=path.resolve(option('review',path.join(ROOT,'../relay-shadows/media/intro-encoded-review')));
function run(args){const result=spawnSync(ffmpeg,args,{encoding:'utf8',windowsHide:true});if(result.status!==0)throw Error(result.stderr);return result.stderr;}
for(let frame=1;frame<=144;frame++)if(!fs.existsSync(path.join(framesDir,'relay_'+String(frame).padStart(4,'0')+'.png')))throw Error('Missing intro frame '+frame);
fs.mkdirSync(output,{recursive:true});fs.mkdirSync(review,{recursive:true});
const frames=path.join(framesDir,'relay_%04d.png'),webm=path.join(ROOT,'assets/scene/intro.webm'),mp4=path.join(ROOT,'assets/scene/intro.mp4');
const filter='scale=960:540:flags=neighbor:out_color_matrix=bt709,fade=t=in:st=0:d=0.35,fade=t=out:st=5.45:d=0.55';
const common=['-hide_banner','-loglevel','error','-y','-framerate','24','-i',frames,'-frames:v','144','-vf',filter];
const color=['-pix_fmt','yuv420p','-colorspace','bt709','-color_primaries','bt709','-color_trc','bt709','-an'];
run([...common,'-c:v','libvpx-vp9','-crf','22','-b:v','0',...color,webm]);
// Encode both deliverables from the lossless render sequence, never transcode the WebM.
run([...common,'-c:v','libx264','-preset','slow','-crf','16',...color,'-movflags','+faststart',mp4]);
const logs={};for(const file of [webm,mp4])logs[path.basename(file)]=run(['-hide_banner','-i',file,'-f','null','-']);
fs.writeFileSync(path.join(__dirname,'intro-verification.txt'),Object.entries(logs).map(([name,log])=>name+'\n'+log).join('\n'));
for(const sec of [1,2,3,4,5])run(['-hide_banner','-loglevel','error','-y','-ss',String(sec),'-i',webm,'-frames:v','1',path.join(review,'intro-'+sec+'s.png')]);
fs.copyFileSync(mp4,path.join(output,'Blacksite-Relay-Intro.mp4'));
const hash=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const report={version,durationSeconds:6,width:960,height:540,fps:24,frames:144,audio:'Silent; game music and cues remain independent.',operator:{metadata:'art-source/life/intro-operator.json',atlasSha256:hash(path.join(ROOT,'art-source/life/intro-atlas.png')),sourceImageSha256:hash(path.join(ROOT,'assets/scene/relay-operator-design.png')),matte:'True alpha from accepted runtime import; no Blender color key.',pixelStep:1,connectedFrames:72,sourceFrameSize:[36,72],sourceFps:12,bakedMotion:true,extraScaleBreathing:false},files:[webm,mp4].map(file=>({file:path.relative(ROOT,file).replaceAll('\\','/'),bytes:fs.statSync(file).size,sha256:hash(file)})),verification:'Both complete files decoded by FFmpeg; frame review is separate from codec verification.'};
const petMetadata=path.join(ROOT,'art-source/pets/intro-pets.json');
if(fs.existsSync(petMetadata)){
 const pets=JSON.parse(fs.readFileSync(petMetadata,'utf8'));
 report.pets={metadata:'art-source/pets/intro-pets.json',atlasSha256:hash(path.join(ROOT,'art-source/pets',pets.image)),rendererSha256:hash(path.join(ROOT,'src/relay-pets.js')),frameCount:pets.frames.length,nativeFrame:[pets.frameWidth,pets.frameHeight],room:[pets.roomWidth,pets.roomHeight],sourceFps:pets.source.fps,sourceStart:pets.source.startSeconds,bakedMotion:true,registration:'The exact native-grid runtime RGBA frame is projected onto the original room. No independently animated or redrawn cinematic pet.'};
}
const lightingMetadata=path.join(ROOT,'art-source/lighting/intro-lighting.json');
if(fs.existsSync(lightingMetadata)){
 const lighting=JSON.parse(fs.readFileSync(lightingMetadata,'utf8'));
 report.lighting={metadata:'art-source/lighting/intro-lighting.json',shadeSha256:hash(path.join(ROOT,'art-source/lighting',lighting.shade)),irradianceAtlasSha256:hash(path.join(ROOT,'art-source/lighting',lighting.irradianceAtlas)),rendererSha256:hash(path.join(ROOT,'src/relay-lighting.js')),frameCount:lighting.frameCount,nativeFrame:[lighting.frameWidth,lighting.frameHeight],sourceFps:lighting.source.fps,sourceStart:lighting.source.startSeconds,formula:lighting.formula,registration:'Separate Non-Color data passes through the same cinematic camera; piecewise sRGB factor applied after the unchanged beauty render.'};
}
const electronicsMetadata=path.join(ROOT,'art-source/electronics/intro-electronics.json');
if(fs.existsSync(electronicsMetadata)){
 const electronics=JSON.parse(fs.readFileSync(electronicsMetadata,'utf8'));
 report.electronics={metadata:'art-source/electronics/intro-electronics.json',atlasSha256:hash(path.join(ROOT,'art-source/electronics',electronics.image)),rendererSha256:hash(path.join(ROOT,'src/relay-scene.js')),frameCount:electronics.frames.length,nativeFrame:[electronics.frameWidth,electronics.frameHeight],sourceFps:electronics.source.fps,sourceStart:electronics.source.startSeconds,bakedMotion:true,registration:'The exact source-backed runtime CRT, reactor and server patches replace the earlier independent Blender display animations.'};
}
const shadowMetadata=path.join(ROOT,'art-source/shadows/intro-shadows.json');
if(fs.existsSync(shadowMetadata)){
 const shadows=JSON.parse(fs.readFileSync(shadowMetadata,'utf8'));
 report.shadows={metadata:'art-source/shadows/intro-shadows.json',atlasSha256:hash(path.join(ROOT,'art-source/shadows',shadows.image)),rendererSha256:hash(path.join(ROOT,'src/relay-shadows.js')),frameCount:shadows.frameCount,nativeFrame:[shadows.frameWidth,shadows.frameHeight],sourceFps:shadows.source.fps,sourceStart:shadows.source.startSeconds,formula:shadows.formula,registration:'Continuous runtime alpha applied once in sRGB before actors and lighting; legacy contacts removed.'};
 report.operator.sourceStart=JSON.parse(fs.readFileSync(path.join(ROOT,'art-source/life/intro-operator.json'),'utf8')).source.startSeconds;
 report.operator.separateShadows=true;
}
fs.writeFileSync(path.join(__dirname,'intro-verification.json'),JSON.stringify(report,null,2)+'\n');
console.log('INTRO_READY '+webm);

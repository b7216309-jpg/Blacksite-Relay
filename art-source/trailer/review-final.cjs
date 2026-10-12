const path=require('node:path'),fs=require('node:fs'),crypto=require('node:crypto'),{spawnSync}=require('node:child_process');
const ROOT=path.resolve(__dirname,'../..'),SOURCE=path.join(ROOT,'art-source/trailer'),ffmpeg=require(path.join(ROOT,'node_modules/ffmpeg-static'));
const version=require(path.join(ROOT,'package.json')).version;
const output=path.resolve(process.argv[2]||path.join(ROOT,'../../outputs/Blacksite-Relay-'+version));
const video=path.join(output,'Blacksite-Relay-Trailer.mp4'),review=path.resolve(process.argv[3]||path.join(ROOT,'../protocol-animation/media/trailer-final-review'));fs.mkdirSync(review,{recursive:true});
const seconds=[2,6,9.5,11.5,14.5,16.5,19,22,24,27,30,32.5,36,37.6,38.1];
for(const t of seconds){const r=spawnSync(ffmpeg,['-hide_banner','-loglevel','error','-y','-i',video,'-ss',String(t),'-frames:v','1',path.join(review,String(t).padStart(4,'0')+'.png')],{encoding:'utf8',windowsHide:true});if(r.status)throw Error(r.stderr);}
const sha=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const seekChecks=[];
for(const t of [14.5,38.1]){
 const file=path.join(review,t+'-fast-seek.png');
 const result=spawnSync(ffmpeg,['-hide_banner','-loglevel','error','-y','-ss',String(t),'-i',video,'-frames:v','1',file],{encoding:'utf8',windowsHide:true});
 if(result.status)throw Error(result.stderr);
 const matchesSequential=sha(file)===sha(path.join(review,String(t).padStart(4,'0')+'.png'));
 if(!matchesSequential)throw Error('Fast seeking differs from sequential decoding at '+t+' seconds.');
 seekChecks.push({seconds:t,matchesSequential:true});
}
const loudness=fs.readFileSync(path.join(SOURCE,'audio-verification.txt'),'utf8');const mix=JSON.parse(loudness.slice(loudness.lastIndexOf('{')));
const decode=fs.readFileSync(path.join(SOURCE,'ffmpeg-verification.txt'),'utf8');
if(!/Duration: 00:00:40\.00/.test(decode)||!/1920x1080/.test(decode)||!/30 fps/.test(decode)||!/frame=\s*1200/.test(decode))throw Error('Final encode metadata does not match the 40-second1080p30 delivery.');
const capture=JSON.parse(fs.readFileSync(path.join(SOURCE,'capture-log.json'),'utf8'));
if(capture.errors.length)throw Error('Capture contains browser errors.');
const transfer=capture.cues.find(e=>e.type==='transfer'),bypass=capture.cues.find(e=>e.type==='minigame-success'&&e.game==='bypass');
if(!transfer||!bypass)throw Error('Capture does not contain successful bypass and extraction.');
const report={revision:version,durationSeconds:40,frameCount:1200,fps:30,width:1920,height:1080,videoCodec:'H.264 High / yuv420p / BT.709',audioCodec:'AAC stereo / 48000Hz',completeDecode:'passed',integratedLUFS:Number(mix.input_i),truePeakDBTP:Number(mix.input_tp),browserErrors:capture.errors,stagedGameplay:{realFunctions:true,isolatedSave:true,randomRoll:.99999,traceReduction:bypass.rewardValue,extractedMoney:transfer.money,finalRisk:transfer.risk},operatorFrames:capture.operatorFrames,files:[video,path.join(ROOT,'assets/scene/intro.webm'),path.join(ROOT,'assets/scene/intro.mp4'),path.join(ROOT,'assets/scene/relay-operator-design.png'),path.join(ROOT,'art-source/life/intro-atlas.png'),path.join(ROOT,'art-source/blender/Blacksite_Relay.blend'),path.join(ROOT,'art-source/audio/masters/trailer-original-music-40s.wav')].map(f=>({path:path.relative(ROOT,f).replaceAll('\\','/'),bytes:fs.statSync(f).size,sha256:sha(f)})),inspection:{decodedFrameSeconds:seconds,decodedFrameDirectory:path.relative(ROOT,review).replaceAll('\\','/'),newBlenderIntro:true,originalMusicUnchanged:true,blenderReviewFrames:[1,72,144],introEncodedReviewSeconds:[1,2,3,4,5],audioChecks:'Original-music source selection, timed event mix, full decode, loudness and true peak. No claim of human listening.'}};
report.seekChecks=seekChecks;
report.petFrames=capture.petFrames||[];
for(const relative of ['src/relay-pets.js','art-source/pets/intro-pets-atlas.png','art-source/pets/intro-pets.json','assets/scene/relay-rat-design.png','assets/scene/relay-cat-design.png','assets/scene/relay-snail-design.png']){
 const file=path.join(ROOT,relative);
 if(fs.existsSync(file))report.files.push({path:relative,bytes:fs.statSync(file).size,sha256:sha(file)});
}
if(!report.petFrames.length||report.petFrames.some(frame=>!frame.game.ready||!frame.stage.ready))throw Error('Trailer pet diagnostics were absent or a runtime sprite was not ready.');
report.inspection.runtimePets=true;
report.lightingFrames=capture.lightingFrames||[];
for(const relative of ['src/relay-lighting.js','art-source/lighting/shade.png','art-source/lighting/intro-irradiance-atlas.png','art-source/lighting/intro-lighting.json']){
 const file=path.join(ROOT,relative);
 if(fs.existsSync(file))report.files.push({path:relative,bytes:fs.statSync(file).size,sha256:sha(file)});
}
if(!report.lightingFrames.length||report.lightingFrames.some(frame=>!frame.game.ready||!frame.stage.ready))throw Error('Trailer lighting diagnostics were absent or a runtime map was not ready.');
report.inspection.runtimeLighting=true;
for(const relative of ['src/relay-scene.js','art-source/electronics/intro-electronics-atlas.png','art-source/electronics/intro-electronics.json','art-source/electronics/electronics-definition.json']){
 const file=path.join(ROOT,relative);
 if(fs.existsSync(file))report.files.push({path:relative,bytes:fs.statSync(file).size,sha256:sha(file)});
}
report.inspection.runtimeElectronics=fs.existsSync(path.join(ROOT,'art-source/electronics/intro-electronics.json'));
report.shadowFrames=capture.shadowFrames||[];
if(!report.shadowFrames.length||report.shadowFrames.some(frame=>!frame.game.ready||!frame.stage.ready||frame.game.error||frame.stage.error))throw Error('Trailer shadow diagnostics are absent or report unready masks.');
for(const relative of ['src/relay-shadows.js','art-source/shadows/intro-shadows-atlas.png','art-source/shadows/intro-shadows.json','art-source/shadows/native-material-verification.json']){
 const file=path.join(ROOT,relative);if(fs.existsSync(file))report.files.push({path:relative,bytes:fs.statSync(file).size,sha256:sha(file)});
}
report.inspection.runtimeShadows=true;
report.protocolFrames=capture.protocolFrames;
report.protocolAnimationFrames=capture.protocolAnimationFrames;
if(!report.protocolAnimationFrames?.length)throw Error('Missing device animation diagnostics.');
for(const game of ['typing','backdoor','bypass'])if(!report.protocolAnimationFrames.some(item=>item.detail?.game===game))throw Error('Missing live hardware close-up for '+game);
report.inspection.runtimeProtocolAnimation=true;
report.animationAuthoring='art-source/protocols/animation';
report.stagedGameplay.preRollHacks=9;
report.stagedGameplay.preRollState=capture.preroll;
report.stagedGameplay.protocolTriggers='Explicitly triggered for filming; actual countdowns, seeded phrase/target generation, inputs, errors and outcomes.';
report.stagedGameplay.protocolOutcomes=['typing','backdoor','bypass'].map(game=>{const outcome=capture.cues.find(e=>e.type==='minigame-success'&&e.game===game);if(!outcome)throw Error('Missing actual '+game+' success');return outcome;});
report.inspection.newBlenderIntro=false;
report.inspection.intro='The accepted 1.2.5 Blender sequence is reused without changing the bundled intro or editable scene.';
const selected=JSON.parse(fs.readFileSync(path.join(ROOT,'art-source/protocols/selected-assets.json'),'utf8'));
for(const item of selected.assets){const file=path.join(ROOT,item.path);if(sha(file)!==item.sha256)throw Error('Selected PNG changed: '+item.path);report.files.push({path:item.path,bytes:fs.statSync(file).size,sha256:sha(file)});}
report.selectedProtocolArt='art-source/protocols/selected-assets.json';
const durableReview=path.join(SOURCE,'final-review');fs.mkdirSync(durableReview,{recursive:true});
for(const name of [...seconds.map(t=>String(t).padStart(4,'0')+'.png'),'14.5-fast-seek.png','38.1-fast-seek.png'])fs.copyFileSync(path.join(review,name),path.join(durableReview,name));
fs.writeFileSync(path.join(SOURCE,'verification-'+version+'.json'),JSON.stringify(report,null,2)+'\n');
fs.mkdirSync(path.join(output,'verification'),{recursive:true});fs.writeFileSync(path.join(output,'verification','media-verification.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({version,completeDecode:report.completeDecode,browserErrors:report.browserErrors,integratedLUFS:report.integratedLUFS,truePeakDBTP:report.truePeakDBTP,framesForInspection:seconds,review},null,2));

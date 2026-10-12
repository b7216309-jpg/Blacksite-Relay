// Portable browser lookup: environment override, then the Chromium installed by Playwright.
/* Native-grid lighting factor export. This never modifies source artwork. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto');
const arg=(name,fallback)=>process.argv.find(v=>v.startsWith('--'+name+'='))?.slice(name.length+3)||fallback;
const ROOT=path.resolve(arg('root',path.resolve(__dirname,'../..')));
const OUTPUT=path.resolve(arg('output',__dirname));
const START=Number(arg('start','0')),FPS=12,COUNT=72,COLS=12,ROWS=6,WIDTH=420,HEIGHT=280;
const {chromium}=require(path.join(ROOT,'node_modules/playwright'));
const CHROME=process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||process.env.CHROMIUM_EXECUTABLE||chromium.executablePath();
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const html='<!doctype html><html><head><meta charset="utf-8"></head><body><script src="src/relay-lighting.js"></script></body></html>';
async function main(){
 fs.mkdirSync(OUTPUT,{recursive:true});
 const server=http.createServer((req,res)=>{try{
  const pathname=new URL(req.url,'http://127.0.0.1').pathname;
  if(pathname==='/'){res.setHeader('Content-Type','text/html');res.end(html);return;}
  const file=path.resolve(ROOT,'.'+decodeURIComponent(pathname));
  if(!file.startsWith(ROOT+path.sep)){res.writeHead(403).end();return;}
  res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.png')?'image/png':'application/octet-stream');res.end(fs.readFileSync(file));
 }catch{res.writeHead(404).end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,executablePath:CHROME});
 try{
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:'+server.address().port+'/');
  await page.evaluate(async()=>{const art=new Image();art.src='assets/scene/blacksite-relay.png';await art.decode();window.__lightingArt=art;await window.RelayLighting.prepare(art);});
  await page.waitForFunction(()=>window.RelayLighting?.getDiagnostics().ready);
  const output=await page.evaluate(async({START,FPS,COUNT,COLS,ROWS,WIDTH,HEIGHT})=>{
   const atlas=document.createElement('canvas');atlas.width=WIDTH*COLS;atlas.height=HEIGHT*ROWS;const ac=atlas.getContext('2d');ac.imageSmoothingEnabled=false;
   const frames=[],shades=[],diagnostics=[];
   const options={risk:0,signal:{},low:false,isStatic:false,terminal:false,screen:'game'};
   for(let i=0;i<COUNT;i++){
    const maps=await window.RelayLighting.exportMaps(START+i/FPS,options);
    if(maps.width!==WIDTH||maps.height!==HEIGHT)throw Error('Lighting maps must preserve the420×280 native full-room grid.');
    const image=new Image();image.src=maps.irradiance;await image.decode();
    if(image.width!==WIDTH||image.height!==HEIGHT)throw Error('Irradiance map dimensions disagree with metadata.');
    ac.drawImage(image,(i%COLS)*WIDTH,Math.floor(i/COLS)*HEIGHT);
    frames.push(maps.irradiance);shades.push(maps.shade);diagnostics.push(window.RelayLighting.getDiagnostics());
   }
   if(new Set(shades).size!==1)throw Error('Shade changes over time; export a shade atlas before rendering this runtime.');
   const shade=new Image();shade.src=shades[0];await shade.decode();
   if(shade.width!==WIDTH||shade.height!==HEIGHT)throw Error('Shade map dimensions disagree with metadata.');
   const referenceMaps=await window.RelayLighting.exportMaps(2,options);
   const reference=document.createElement('canvas');reference.width=WIDTH;reference.height=HEIGHT;
   const rc=reference.getContext('2d');rc.imageSmoothingEnabled=false;rc.drawImage(window.__lightingArt,0,0,WIDTH,HEIGHT);
   const referenceInput=reference.toDataURL('image/png');
   rc.save();rc.scale(WIDTH/1536,WIDTH/1536);window.RelayLighting.draw(rc,2,options);rc.restore();
   return {shade:shades[0],irradianceAtlas:atlas.toDataURL('image/png'),frames,diagnostics,referenceInput,referenceRuntime:reference.toDataURL('image/png'),referenceIrradiance:referenceMaps.irradiance};
  },{START,FPS,COUNT,COLS,ROWS,WIDTH,HEIGHT});
  if(errors.length)throw Error(errors.join('; '));
  const bytes=url=>Buffer.from(url.split(',')[1],'base64');
  fs.writeFileSync(path.join(OUTPUT,'shade.png'),bytes(output.shade));
  fs.writeFileSync(path.join(OUTPUT,'intro-irradiance-atlas.png'),bytes(output.irradianceAtlas));
  for(const [key,name] of [['referenceInput','reference-input.png'],['referenceRuntime','reference-runtime-lit.png'],['referenceIrradiance','reference-irradiance.png']])fs.writeFileSync(path.join(OUTPUT,name),bytes(output[key]));
  const metadata={version:1,formula:'clamp(sRGB(C) * shade * (1 + irradiance), 0, 1)',colorSpace:'Non-Color RGB data; formula evaluates in sRGB.',shade:'shade.png',irradianceAtlas:'intro-irradiance-atlas.png',width:WIDTH*COLS,height:HEIGHT*ROWS,frameWidth:WIDTH,frameHeight:HEIGHT,columns:COLS,rows:ROWS,frameCount:COUNT,roomWidth:1536,roomHeight:1024,depth:0,holdSeconds:1/FPS,animationBaked:true,source:{renderer:'src/relay-lighting.js',rendererSha256:hash(path.join(ROOT,'src/relay-lighting.js')),art:'assets/scene/blacksite-relay.png',artSha256:hash(path.join(ROOT,'assets/scene/blacksite-relay.png')),startSeconds:START,endExclusiveSeconds:START+COUNT/FPS,fps:FPS,options:{risk:0,signal:{},low:false,isStatic:false,terminal:false,screen:'game'}}};
  fs.writeFileSync(path.join(OUTPUT,'intro-lighting.json'),JSON.stringify(metadata,null,2)+'\n');
  const report={version:require(path.join(ROOT,'package.json')).version,frameCount:COUNT,uniqueIrradianceFrames:new Set(output.frames).size,shadeSha256:hash(path.join(OUTPUT,'shade.png')),irradianceAtlasSha256:hash(path.join(OUTPUT,'intro-irradiance-atlas.png')),errors,diagnostics:output.diagnostics};
  fs.writeFileSync(path.join(OUTPUT,'intro-export-verification.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({ready:true,output:OUTPUT,uniqueIrradianceFrames:report.uniqueIrradianceFrames,errors}));
 }finally{await browser.close();await new Promise(r=>server.close(r));}
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});

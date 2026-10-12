// Portable browser lookup: environment override, then the Chromium installed by Playwright.
/* Export the accepted connected runtime operator without changing its artwork. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto');
const {chromium}=require('playwright');
const option=(name,fallback)=>process.argv.find(value=>value.startsWith('--'+name+'='))?.slice(name.length+3)||fallback;
const ROOT=path.resolve(option('root',path.resolve(__dirname,'../..')));
const OUTPUT=path.resolve(option('output',__dirname));
const WORK=path.resolve(option('frames',path.join(ROOT,'../relay-shadows/media/operator-export')));
const START=Number(option('start','0'));
const CHROME=process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||process.env.CHROMIUM_EXECUTABLE||chromium.executablePath();
const html='<!doctype html><html><head><style>body{margin:0}canvas{width:420px;height:150px;image-rendering:pixelated}</style></head><body><canvas id="relay-scene" data-relay-scene width="420" height="150"></canvas><script src="src/relay-life.js"></script><script src="src/relay-pets.js"></script><script src="src/relay-shadows.js"></script><script src="src/relay-lighting.js"></script><script src="src/relay-scene.js"></script></body></html>';
async function main(){
 fs.mkdirSync(WORK,{recursive:true});fs.mkdirSync(OUTPUT,{recursive:true});
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
  const page=await browser.newPage({viewport:{width:420,height:150}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:'+server.address().port+'/');
  await page.waitForFunction(()=>RelayLife.getDiagnostics().ready&&BlacksiteScene.getDiagnostics().artLoaded);
  const output=await page.evaluate(async START=>{
   const tick=async t=>{BlacksiteScene.setState({screen:'game',risk:0,reducedMotion:false,effectsLevel:'full'});BlacksiteScene.setCaptureTime(t);await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));};
   await tick(6); // Warm the actual scene before the first read-only export.
   const atlas=document.createElement('canvas');atlas.width=432;atlas.height=432;const c=atlas.getContext('2d');c.imageSmoothingEnabled=false;
   const frames=[],diagnostics=[];
   for(let i=0;i<72;i++){
    await tick(START+i/12);const url=RelayLife.exportFrame();if(!url)throw Error('Runtime frame was not ready.');
    const img=new Image();img.src=url;await img.decode();if(img.width!==36||img.height!==72)throw Error('Unexpected operator dimensions.');
    c.drawImage(img,(i%12)*36,Math.floor(i/12)*72);frames.push(url);diagnostics.push(RelayLife.getDiagnostics());
   }
   return {atlas:atlas.toDataURL('image/png'),frames,diagnostics};
  },START);
  if(errors.length)throw Error(errors.join('; '));
  const bytes=url=>Buffer.from(url.split(',')[1],'base64');
  fs.writeFileSync(path.join(OUTPUT,'intro-atlas.png'),bytes(output.atlas));
  output.frames.forEach((url,i)=>fs.writeFileSync(path.join(WORK,'operator-'+String(i).padStart(3,'0')+'.png'),bytes(url)));
  const frames=Array.from({length:72},(_,i)=>({name:'connected-'+String(i).padStart(3,'0'),x:(i%12)*36,y:Math.floor(i/12)*72,w:36,h:72,pivotX:16,pivotY:64}));
  const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  const metadata={version:2,image:'intro-atlas.png',width:432,height:432,pixelStep:1,alphaCutoff:.5,foot:{x:574,y:707},scale:1536/420,tint:[1,1,1],animationBaked:true,frames,introAnimation:{sequence:frames.map(f=>f.name),holdSeconds:1/12},source:{image:'assets/scene/relay-operator-design.png',sha256:hash(path.join(ROOT,'assets/scene/relay-operator-design.png')),renderer:'src/relay-life.js',rendererSha256:hash(path.join(ROOT,'src/relay-life.js')),startSeconds:START,endExclusiveSeconds:START+6,fps:12,warmRender:true,separateShadows:true}};
  fs.writeFileSync(path.join(OUTPUT,'intro-operator.json'),JSON.stringify(metadata,null,2)+'\n');
  fs.writeFileSync(path.join(OUTPUT,'intro-export-verification.json'),JSON.stringify({version:require(path.join(ROOT,'package.json')).version,frameCount:72,atlas:[432,432],frame:[36,72],errors,atlasSha256:hash(path.join(OUTPUT,'intro-atlas.png')),startSeconds:START,separateShadows:true,diagnostics:output.diagnostics},null,2)+'\n');
  console.log('CONNECTED_ATLAS_READY '+path.join(OUTPUT,'intro-atlas.png'));
 }finally{await browser.close();await new Promise(r=>server.close(r));}
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});

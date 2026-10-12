// Portable browser lookup: environment override, then the Chromium installed by Playwright.
/* Bake the accepted runtime pets without inventing another animation in Blender.
 * node export-runtime-pets.cjs --root=.../Risk_V2 --output=.../art-source/pets
 * Default capture is the first six seconds at 12 fps on the native pixel grid.
 */
'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto');
const arg=(name,fallback)=>process.argv.find(v=>v.startsWith('--'+name+'='))?.slice(name.length+3)||fallback;
const ROOT=path.resolve(arg('root',path.resolve(__dirname,'../..')));
const OUTPUT=path.resolve(arg('output',__dirname));
const START=Number(arg('start','0')),FPS=12,COUNT=72,COLS=12,ROWS=6;
const WIDTH=420,HEIGHT=280,ROOM_WIDTH=1536,ROOM_HEIGHT=1024;
const {chromium}=require(path.join(ROOT,'node_modules/playwright'));
const CHROME=process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||process.env.CHROMIUM_EXECUTABLE||chromium.executablePath();
const html='<!doctype html><html><head><style>body{margin:0}canvas{width:420px;height:280px;image-rendering:pixelated}</style></head><body><canvas id="pet-export" width="420" height="280"></canvas><script src="src/relay-life.js"></script><script src="src/relay-pets.js"></script><script src="src/relay-shadows.js"></script></body></html>';
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
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
  const page=await browser.newPage({viewport:{width:WIDTH,height:HEIGHT}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:'+server.address().port+'/');
  await page.waitForFunction(()=>window.RelayPets?.getDiagnostics().ready);
  const output=await page.evaluate(({START,FPS,COUNT,COLS,ROWS,WIDTH,HEIGHT,ROOM_WIDTH})=>{
   const canvas=document.getElementById('pet-export'),ctx=canvas.getContext('2d');
   const atlas=document.createElement('canvas');atlas.width=WIDTH*COLS;atlas.height=HEIGHT*ROWS;const ac=atlas.getContext('2d');ac.imageSmoothingEnabled=false;
   const frames=[],diagnostics=[];
   const options={risk:0,signal:{activity:0,warning:0,success:0,failure:0},low:false,isStatic:false,terminal:false,screen:'game'};
   window.RelayPets.setState?.({screen:'game',risk:0,reducedMotion:false,effectsLevel:'full'});
   for(let i=0;i<COUNT;i++){
    ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,WIDTH,HEIGHT);ctx.imageSmoothingEnabled=false;
    ctx.save();ctx.scale(WIDTH/ROOM_WIDTH,WIDTH/ROOM_WIDTH);window.RelayPets.draw(ctx,START+i/FPS,options);ctx.restore();
    ac.drawImage(canvas,(i%COLS)*WIDTH,Math.floor(i/COLS)*HEIGHT);
    frames.push(canvas.toDataURL('image/png'));diagnostics.push(window.RelayPets.getDiagnostics());
   }
   return {atlas:atlas.toDataURL('image/png'),frames,diagnostics};
  },{START,FPS,COUNT,COLS,ROWS,WIDTH,HEIGHT,ROOM_WIDTH});
  if(errors.length)throw Error(errors.join('; '));
  const bytes=url=>Buffer.from(url.split(',')[1],'base64');
  fs.writeFileSync(path.join(OUTPUT,'intro-pets-atlas.png'),bytes(output.atlas));
  fs.mkdirSync(path.join(OUTPUT,'intro-export-frames'),{recursive:true});
  output.frames.forEach((url,i)=>fs.writeFileSync(path.join(OUTPUT,'intro-export-frames','pets-'+String(i).padStart(3,'0')+'.png'),bytes(url)));
  const frames=Array.from({length:COUNT},(_,i)=>({name:'pets-'+String(i).padStart(3,'0'),x:(i%COLS)*WIDTH,y:Math.floor(i/COLS)*HEIGHT,w:WIDTH,h:HEIGHT}));
  const metadata={version:1,image:'intro-pets-atlas.png',width:WIDTH*COLS,height:HEIGHT*ROWS,frameWidth:WIDTH,frameHeight:HEIGHT,roomWidth:ROOM_WIDTH,roomHeight:ROOM_HEIGHT,pixelStep:1,depth:.04,alpha:'Runtime RGBA with fallback contacts omitted; shadows use their own registered atlas.',animationBaked:true,frames,introAnimation:{sequence:frames.map(f=>f.name),holdSeconds:1/FPS},source:{renderer:'src/relay-pets.js',rendererSha256:hash(path.join(ROOT,'src/relay-pets.js')),startSeconds:START,endExclusiveSeconds:START+COUNT/FPS,fps:FPS,nativeCanvas:[WIDTH,HEIGHT],separateShadows:true}};
  fs.writeFileSync(path.join(OUTPUT,'intro-pets.json'),JSON.stringify(metadata,null,2)+'\n');
  const report={version:require(path.join(ROOT,'package.json')).version,frameCount:COUNT,atlas:[WIDTH*COLS,HEIGHT*ROWS],frame:[WIDTH,HEIGHT],errors,uniqueFrames:new Set(output.frames).size,atlasSha256:hash(path.join(OUTPUT,'intro-pets-atlas.png')),diagnostics:output.diagnostics};
  fs.writeFileSync(path.join(OUTPUT,'intro-export-verification.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({ready:true,output:OUTPUT,uniqueFrames:report.uniqueFrames,atlas:report.atlas,errors}));
 }finally{await browser.close();await new Promise(r=>server.close(r));}
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});

// Portable browser lookup: environment override, then the Chromium installed by Playwright.
/* Export the final registered runtime electronics without duplicating their animation. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto');
const option=(name,fallback)=>process.argv.find(value=>value.startsWith('--'+name+'='))?.slice(name.length+3)||fallback;
const ROOT=path.resolve(option('root',path.resolve(__dirname,'../..')));
const OUTPUT=path.resolve(option('output',__dirname));
const {chromium}=require(path.join(ROOT,'node_modules/playwright'));
const CHROME=process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||process.env.CHROMIUM_EXECUTABLE||chromium.executablePath();
const START=Number(option('start','0')),FPS=12,COUNT=72,COLS=12,ROWS=6,WIDTH=420,HEIGHT=280;
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const html='<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0}canvas{width:420px;height:150px}</style></head><body><canvas data-relay-scene></canvas><script src="src/relay-life.js"></script><script src="src/relay-pets.js"></script><script src="src/relay-lighting.js"></script><script src="src/relay-scene.js"></script></body></html>';
async function main(){
  fs.mkdirSync(OUTPUT,{recursive:true});
  const server=http.createServer((req,res)=>{try{
    const pathname=new URL(req.url,'http://127.0.0.1').pathname;
    if(pathname==='/'){res.setHeader('Content-Type','text/html');return res.end(html);}
    const file=path.resolve(ROOT,'.'+decodeURIComponent(pathname));
    if(!file.startsWith(ROOT+path.sep)){res.writeHead(403).end();return;}
    res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.png')?'image/png':'application/octet-stream');res.end(fs.readFileSync(file));
  }catch{res.writeHead(404).end();}});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser=await chromium.launch({headless:true,executablePath:CHROME});
  try{
    const page=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto('http://127.0.0.1:'+server.address().port+'/');
    await page.waitForFunction(()=>window.BlacksiteScene?.getDiagnostics().artLoaded&&typeof BlacksiteScene.exportElectronicsFrame==='function');
    const output=await page.evaluate(async({START,FPS,COUNT,COLS,ROWS,WIDTH,HEIGHT})=>{
      BlacksiteScene.setState({screen:'game',risk:0,effectsLevel:'full',reducedMotion:false});BlacksiteScene.setCaptureTime(0);
      const atlas=document.createElement('canvas');atlas.width=WIDTH*COLS;atlas.height=HEIGHT*ROWS;
      const context=atlas.getContext('2d');context.imageSmoothingEnabled=false;
      const frames=[],samples=[];
      for(let index=0;index<COUNT;index++){
        const time=START+index/FPS,frame=await BlacksiteScene.exportElectronicsFrame(time,{}),url=frame.image;
        if(frame.width!==WIDTH||frame.height!==HEIGHT)throw Error('Electronics metadata dimensions differ from the native grid.');
        if(typeof url!=='string'||!url.startsWith('data:image/png;base64,'))throw Error('Expected a PNG data URL from exportElectronicsFrame.');
        const image=new Image();image.src=url;await image.decode();
        if(image.width!==WIDTH||image.height!==HEIGHT)throw Error('Runtime electronics must use the native 420×280 full-room grid.');
        context.drawImage(image,index%COLS*WIDTH,Math.floor(index/COLS)*HEIGHT);
        frames.push(url);samples.push({index,time});
      }
      return {atlas:atlas.toDataURL('image/png'),frames,samples,definition:BlacksiteScene.getElectronicsDefinition()};
    },{START,FPS,COUNT,COLS,ROWS,WIDTH,HEIGHT});
    if(errors.length)throw Error(errors.join('; '));
    const atlasFile=path.join(OUTPUT,'intro-electronics-atlas.png');fs.writeFileSync(atlasFile,Buffer.from(output.atlas.split(',')[1],'base64'));
    const metadata={version:1,image:path.basename(atlasFile),width:WIDTH*COLS,height:HEIGHT*ROWS,frameWidth:WIDTH,frameHeight:HEIGHT,roomWidth:1536,roomHeight:1024,pixelStep:1,depth:.038,animationBaked:true,alpha:'Source-backed registered electronics patches from the runtime; preserved room pixels inside original display masks.',frames:output.samples.map(({index})=>({name:'electronics-'+String(index).padStart(3,'0'),x:index%COLS*WIDTH,y:Math.floor(index/COLS)*HEIGHT,w:WIDTH,h:HEIGHT})),introAnimation:{sequence:output.samples.map(({index})=>'electronics-'+String(index).padStart(3,'0')),holdSeconds:1/FPS},source:{renderer:'src/relay-scene.js',rendererSha256:hash(path.join(ROOT,'src/relay-scene.js')),art:'assets/scene/blacksite-relay.png',artSha256:hash(path.join(ROOT,'assets/scene/blacksite-relay.png')),startSeconds:START,endExclusiveSeconds:START+COUNT/FPS,fps:FPS,options:{screen:'game',risk:0,effectsLevel:'full',reducedMotion:false}}};
    fs.writeFileSync(path.join(OUTPUT,'intro-electronics.json'),JSON.stringify(metadata,null,2)+'\n');
    fs.writeFileSync(path.join(OUTPUT,'electronics-definition.json'),JSON.stringify(output.definition,null,2)+'\n');
    const report={version:require(path.join(ROOT,'package.json')).version,frameCount:COUNT,uniqueFrames:new Set(output.frames).size,atlasSha256:hash(atlasFile),source:metadata.source,samples:output.samples,errors};
    fs.writeFileSync(path.join(OUTPUT,'intro-export-verification.json'),JSON.stringify(report,null,2)+'\n');
    console.log(JSON.stringify({output:OUTPUT,frames:COUNT,uniqueFrames:report.uniqueFrames,errors}));
  }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
}
main().catch(error=>{console.error(error.stack);process.exitCode=1;});

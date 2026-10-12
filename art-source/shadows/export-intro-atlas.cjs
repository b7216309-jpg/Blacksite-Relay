// Portable browser lookup: environment override, then the Chromium installed by Playwright.
/* Bake one shared-clock shadow mask and native Canvas reference without modifying art. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto');
const option=(name,fallback)=>process.argv.find(value=>value.startsWith('--'+name+'='))?.slice(name.length+3)||fallback;
const ROOT=path.resolve(option('root',path.resolve(__dirname,'../..'))),OUTPUT=path.resolve(option('output',__dirname));
const {chromium}=require(path.join(ROOT,'node_modules/playwright'));
const CHROME=process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||process.env.CHROMIUM_EXECUTABLE||chromium.executablePath();
const START=Number(option('start','0')),FPS=12,COUNT=72,COLS=12,ROWS=6,WIDTH=420,HEIGHT=280;
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const html='<!doctype html><html><head><meta charset="utf-8"></head><body><script src="src/relay-life.js"></script><script src="src/relay-pets.js"></script><script src="src/relay-shadows.js"></script></body></html>';
async function main(){
  fs.mkdirSync(OUTPUT,{recursive:true});
  const server=http.createServer((req,res)=>{try{
    const pathname=new URL(req.url,'http://127.0.0.1').pathname;
    if(pathname==='/'){res.setHeader('Content-Type','text/html');return res.end(html);}
    const file=path.resolve(ROOT,'.'+decodeURIComponent(pathname));if(!file.startsWith(ROOT+path.sep))return res.writeHead(403).end();
    res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.png')?'image/png':'application/octet-stream');res.end(fs.readFileSync(file));
  }catch{res.writeHead(404).end();}});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser=await chromium.launch({headless:true,executablePath:CHROME});
  try{
    const page=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto('http://127.0.0.1:'+server.address().port+'/');
    await page.waitForFunction(()=>RelayLife.getDiagnostics().ready&&RelayPets.getDiagnostics().ready&&typeof RelayShadows.exportFrame==='function');
    const output=await page.evaluate(async({START,FPS,COUNT,COLS,ROWS,WIDTH,HEIGHT})=>{
      const options={screen:'game',risk:0,isStatic:false,signal:{power:1,activity:0,warning:0}};
      RelayLife.setState({screen:'game'});RelayPets.setState({screen:'game'});
      const atlas=document.createElement('canvas');atlas.width=WIDTH*COLS;atlas.height=HEIGHT*ROWS;
      const context=atlas.getContext('2d');context.imageSmoothingEnabled=false;
      const frames=[],samples=[];
      for(let index=0;index<COUNT;index++){
        const time=START+index/FPS,frame=RelayShadows.exportFrame(time,options);
        if(!frame||frame.width!==WIDTH||frame.height!==HEIGHT)throw Error('Shadow export must preserve the 420×280 room grid.');
        const image=new Image();image.src=frame.image;await image.decode();
        context.drawImage(image,index%COLS*WIDTH,Math.floor(index/COLS)*HEIGHT);
        const diagnostics=RelayShadows.getDiagnostics();if(diagnostics.error||diagnostics.casters.length!==5)throw Error('All five caster silhouettes must export without errors.');
        frames.push(frame.image);samples.push({index,time,diagnostics});
      }
      const art=new Image();art.src='assets/scene/blacksite-relay.png';await art.decode();
      const reference=document.createElement('canvas');reference.width=WIDTH;reference.height=HEIGHT;
      const rc=reference.getContext('2d');rc.imageSmoothingEnabled=false;rc.drawImage(art,0,0,WIDTH,HEIGHT);
      const input=reference.toDataURL('image/png'),mask=RelayShadows.exportFrame(2,options);
      rc.save();rc.scale(WIDTH/1536,HEIGHT/1024);RelayShadows.draw(rc,2,options);rc.restore();
      return {atlas:atlas.toDataURL('image/png'),frames,samples,definition:RelayShadows.getDefinition(),referenceInput:input,referenceMask:mask.image,referenceRuntime:reference.toDataURL('image/png'),options};
    },{START,FPS,COUNT,COLS,ROWS,WIDTH,HEIGHT});
    if(errors.length)throw Error(errors.join('; '));
    const bytes=url=>Buffer.from(url.split(',')[1],'base64');
    for(const [key,name]of [['atlas','intro-shadows-atlas.png'],['referenceInput','reference-input.png'],['referenceMask','reference-mask.png'],['referenceRuntime','reference-runtime-shadowed.png']])fs.writeFileSync(path.join(OUTPUT,name),bytes(output[key]));
    const metadata={version:1,image:'intro-shadows-atlas.png',width:WIDTH*COLS,height:HEIGHT*ROWS,frameWidth:WIDTH,frameHeight:HEIGHT,columns:COLS,rows:ROWS,frameCount:COUNT,roomWidth:1536,roomHeight:1024,depth:.036,pixelStep:1,animationBaked:true,alpha:'Unmodified continuous native shadow opacity; black RGB.',formula:'sRGB(C) * (1 - alpha)',holdSeconds:1/FPS,source:{renderer:'src/relay-shadows.js',rendererSha256:hash(path.join(ROOT,'src/relay-shadows.js')),operatorSha256:hash(path.join(ROOT,'src/relay-life.js')),petsSha256:hash(path.join(ROOT,'src/relay-pets.js')),art:'assets/scene/blacksite-relay.png',artSha256:hash(path.join(ROOT,'assets/scene/blacksite-relay.png')),startSeconds:START,endExclusiveSeconds:START+COUNT/FPS,fps:FPS,options:output.options}};
    fs.writeFileSync(path.join(OUTPUT,'intro-shadows.json'),JSON.stringify(metadata,null,2)+'\n');
    fs.writeFileSync(path.join(OUTPUT,'shadow-definition.json'),JSON.stringify(output.definition,null,2)+'\n');
    const report={version:require(path.join(ROOT,'package.json')).version,frameCount:COUNT,uniqueFrames:new Set(output.frames).size,atlasSha256:hash(path.join(OUTPUT,metadata.image)),source:metadata.source,samples:output.samples,errors};
    fs.writeFileSync(path.join(OUTPUT,'intro-export-verification.json'),JSON.stringify(report,null,2)+'\n');
    console.log(JSON.stringify({output:OUTPUT,frames:COUNT,uniqueFrames:report.uniqueFrames,errors}));
  }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
}
main().catch(error=>{console.error(error.stack);process.exitCode=1;});

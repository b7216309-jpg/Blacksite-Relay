// Authoring UI renders immutable PNGs through the same runtime key and crop path.
const fs=require('node:fs'),path=require('node:path');
const repo=path.resolve(__dirname,'../..');
const {chromium}=require(path.join(repo,'node_modules/playwright'));
const registration=JSON.parse(fs.readFileSync(path.join(__dirname,'registration.json'),'utf8'));
const images=registration.assets.map(a=>({...a,url:'data:image/png;base64,'+fs.readFileSync(path.join(repo,a.file)).toString('base64')}));
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE});
 try{
  const page=await browser.newPage({viewport:{width:1100,height:900},deviceScaleFactor:1});
  await page.setContent('<html><head><style>body{margin:0;background:#0b171a;color:#c6d2ca;font:14px monospace;padding:24px}h1{font-size:22px;color:#edc685}main{display:grid;grid-template-columns:repeat(4,250px);gap:12px}article{border:1px solid #35504d;padding:8px}h2{font-size:13px}canvas{display:block;background:#142325;image-rendering:pixelated}p{font-size:11px;color:#98b5b0}</style></head><body><h1>Original props — runtime key + native-size review</h1><p>Generated PNGs are unchanged. Upper views show actual native size. Lower views enlarge those same pixels.</p><main></main></body></html>');
  const diagnostics=await page.evaluate(async assets=>{
   const stats=[];
   for(const a of assets){
    const img=new Image();img.src=a.url;await img.decode();const keyed=document.createElement('canvas');keyed.width=img.width;keyed.height=img.height;const k=keyed.getContext('2d');k.drawImage(img,0,0);const pixels=k.getImageData(0,0,keyed.width,keyed.height);let removed=0;
    for(let i=0;i<pixels.data.length;i+=4){const r=pixels.data[i],g=pixels.data[i+1],b=pixels.data[i+2];if(r>g+12&&b>g+12){pixels.data[i+3]=0;removed++;}}
    k.putImageData(pixels,0,0);const article=document.createElement('article');article.innerHTML='<h2>'+a.id+'</h2>';document.querySelector('main').append(article);
    const native=document.createElement('canvas');native.width=232;native.height=130;const c=native.getContext('2d');c.imageSmoothingEnabled=false;const [w,h]=a.previewNative;c.drawImage(keyed,...a.crop,12,12,w,h);
    let second=null;if(a.crumbCrop)second=[a.crumbCrop,a.crumbNative];if(a.envelopeCrop)second=[a.envelopeCrop,a.envelopeNative];if(a.noteCrop)second=[a.noteCrop,a.noteNative];if(second)c.drawImage(keyed,...second[0],12+w+12,12+h-second[1][1],...second[1]);article.append(native);
    const label=document.createElement('p');label.textContent=w+'×'+h+' native pixels';article.append(label);
    const detail=document.createElement('canvas');detail.width=232;detail.height=540;const d=detail.getContext('2d');d.imageSmoothingEnabled=false;const totalWidth=w+(second?12+second[1][0]:0),scale=Math.min(6,Math.floor(220/totalWidth),Math.floor(530/h));d.drawImage(native,12,12,totalWidth,h,6,6,totalWidth*scale,h*scale);article.append(detail);
    const retained=c.getImageData(0,0,native.width,native.height).data;let magenta=0;for(let i=0;i<retained.length;i+=4)if(retained[i+3]&&retained[i]>retained[i+1]+12&&retained[i+2]>retained[i+1]+12)magenta++;
    stats.push({id:a.id,removedMattePixels:removed,nativeSize:[w,h],remainingMattePixels:magenta});
   }return stats;
  },images);
  await page.screenshot({path:path.join(__dirname,'native-keyed-preview.png'),fullPage:true});
  fs.writeFileSync(path.join(__dirname,'native-keyed-preview.json'),JSON.stringify({method:'Browser runtime chroma-key/crop rendering; original PNGs unchanged',assets:diagnostics},null,2));console.log(JSON.stringify(diagnostics));
 }finally{await browser.close();}
})().catch(error=>{console.error(error.message);process.exitCode=1;});

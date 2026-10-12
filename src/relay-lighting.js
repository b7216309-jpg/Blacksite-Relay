/* Surface lighting: authored receivers, native pixel maps, shared presentation clock. */
(() => {
  'use strict';
  const W=420,H=280,ART_W=1536,ART_H=1024;
  const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,n));
  const smooth=n=>{n=clamp(n);return n*n*(3-2*n);};
  const warm=[1,.65,.28],cool=[.22,.78,.83];
  const surfaces={
    leftWall:[[33,268],[225,199],[244,346],[219,459],[218,575],[32,510]],
    middleWall:[[239,174],[573,83],[629,180],[617,350],[486,437],[480,345],[358,310],[234,346]],
    rightWall:[[988,132],[1288,220],[1374,333],[1341,395],[1231,329],[1091,379],[1072,481],[995,438]],
    farWall:[[1383,302],[1536,378],[1536,755],[1346,710],[1357,382]],
    leftRoof:[[233,378],[362,316],[482,360],[349,419]],
    rightRoof:[[1090,386],[1231,328],[1358,372],[1217,433]],
    console:[[563,356],[663,288],[791,330],[837,368],[830,468],[737,508],[598,453]],
    workspace:[[490,421],[625,400],[667,459],[650,543],[632,649],[558,713],[497,655]],
    core:[[566,450],[749,477],[886,554],[853,664],[725,735],[526,638]],
    floor:[[229,701],[482,641],[609,695],[723,737],[874,702],[1091,654],[1368,721],[1401,859],[1123,880],[930,803],[750,833],[547,938],[274,844]],
    leftRack:[[339,411],[468,367],[466,645],[351,693]],
    rightRack:[[1108,422],[1220,455],[1217,713],[1103,674]],
    warning:[[1261,168],[1497,234],[1536,412],[1409,418],[1363,332],[1287,276]]
  };
  const fields=[
    {id:'west-lamp',channel:'west',color:warm,parts:[{x:163,y:332,rx:145,ry:210,gain:.95,surface:'leftWall'}]},
    {id:'aisle-lamp',channel:'aisle',color:warm,parts:[{x:474,y:278,rx:183,ry:205,gain:1.15,surface:'middleWall'},{x:456,y:341,rx:206,ry:114,gain:.52,surface:'leftRoof'},{x:507,y:682,rx:144,ry:99,gain:.68,surface:'floor',wet:true}]},
    {id:'east-lamp',channel:'east',color:warm,parts:[{x:1114,y:290,rx:187,ry:216,gain:.85,surface:'rightWall'},{x:1127,y:352,rx:238,ry:127,gain:.56,surface:'rightRoof'}]},
    {id:'far-lamp',channel:'far',color:warm,parts:[{x:1440,y:516,rx:153,ry:207,gain:.82,surface:'farWall'},{x:1306,y:794,rx:151,ry:153,gain:.47,surface:'floor',wet:true}]},
    {id:'crt-bounce',channel:'crt',color:cool,parts:[{x:714,y:377,rx:205,ry:180,gain:.84,surface:'console'},{x:620,y:508,rx:167,ry:204,gain:.79,surface:'workspace'}]},
    {id:'core-bounce',channel:'core',color:warm,parts:[{x:716,y:568,rx:215,ry:177,gain:.75,surface:'core'},{x:593,y:733,rx:256,ry:178,gain:.86,surface:'floor',wet:true}]},
    {id:'rack-bounce',channel:'racks',color:cool,parts:[{x:398,y:518,rx:98,ry:240,gain:.52,surface:'leftRack'},{x:1164,y:563,rx:89,ry:227,gain:.48,surface:'rightRack'},{x:1126,y:747,rx:185,ry:100,gain:.30,surface:'floor'}]},
    {id:'alarm-spill',channel:'alarm',color:[1,.20,.09],parts:[{x:1374,y:195,rx:187,ry:269,gain:.55,surface:'warning'}]}
  ];
  let ready=false,error=false,disposed=false,draws=0,mapBuilds=0,lastTime=0,lastKey='',lastLevels={},maps=[];
  const make=()=>{const c=document.createElement('canvas');c.width=W;c.height=H;return c;};
  const shade=make(),irradiance=make(),ic=irradiance.getContext('2d',{alpha:false});
  const coreTint=make(),ct=coreTint.getContext('2d',{alpha:false});
  const buffers=new Map(),MAX_VIEWS=4;
  function inside(x,y,poly){let hit=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){
    const a=poly[i],b=poly[j];if(((a[1]>y)!==(b[1]>y))&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])hit=!hit;
  }return hit;}
  function falloff(x,y,p){return Math.max(0,1-((x-p.x)/p.rx)**2-((y-p.y)/p.ry)**2)**1.6;}
  function prepare(art){
    if(ready||disposed||!art?.naturalWidth)return;
    try{
      const sample=make(),sc=sample.getContext('2d',{willReadFrequently:true});sc.imageSmoothingEnabled=false;sc.drawImage(art,0,0,W,H);
      const original=sc.getImageData(0,0,W,H).data;
      const sh=shade.getContext('2d'),sd=sh.createImageData(W,H);
      for(let y=0;y<H;y++)for(let x=0;x<W;x++){
        const ax=(x+.5)*ART_W/W,ay=(y+.5)*ART_H/H,k=(y*W+x)*4;
        // Cool the unlit ceiling and recesses; preserve the visible floor instead of crushing it.
        const ceiling=1-smooth((ay-110)/330),edge=smooth(Math.abs(ax-768)/768)*.05;
        const recess=(inside(ax,ay,[[235,392],[329,429],[340,687],[237,631]])||inside(ax,ay,[[1231,454],[1339,402],[1338,643],[1231,711]]))?.075:0;
        const depth=ceiling*.10+edge+recess;
        sd.data[k]=Math.round(255*(1-depth*.97));sd.data[k+1]=Math.round(255*(1-depth*.56));sd.data[k+2]=Math.round(255*(1-depth*.34));sd.data[k+3]=255;
      }
      sh.putImageData(sd,0,0);
      maps=fields.map(field=>{
        const canvas=make(),ctx=canvas.getContext('2d',{alpha:false}),data=ctx.createImageData(W,H);
        for(let y=0;y<H;y++)for(let x=0;x<W;x++){
          const ax=(x+.5)*ART_W/W,ay=(y+.5)*ART_H/H,k=(y*W+x)*4;
          const r=original[k],g=original[k+1],b=original[k+2],luma=(r*.2126+g*.7152+b*.0722)/255;
          let amount=0;
          for(const p of field.parts){
            if(!inside(ax,ay,surfaces[p.surface]))continue;
            const material=p.wet?.40+.60*smooth(luma*5):1;
            amount+=falloff(ax,ay,p)*p.gain*material;
          }
          // Emissive glass/cage pixels retain their colored highlights and internal texture.
          const protection=1-.60*smooth((Math.max(r,g,b)/255-.57)/.39);
          amount*=protection;
          for(let i=0;i<3;i++)data.data[k+i]=Math.round(clamp(amount*(field.channel==='core'?1:field.color[i]))*255);
          data.data[k+3]=255;
        }
        ctx.putImageData(data,0,0);return {id:field.id,channel:field.channel,canvas};
      });
      sample.width=0;sample.height=0;ready=true;lastKey='';
    }catch(_){error=true;}
  }
  function levels(t,o){
    const s=o.signal||{},power=clamp(s.power??(o.screen==='busted'?.08:1)),risk=clamp(o.risk||0);
    if(o.isStatic)t=2;
    // Small independent voltage drift. A single old ballast gives a soft, rare double dip.
    const age=t%29.3,dip=o.isStatic?0:(age>12.2&&age<12.65?Math.sin((age-12.2)/.45*Math.PI)*.075:age>12.9&&age<13.12?Math.sin((age-12.9)/.22*Math.PI)*.04:0);
    const breathe=(period,offset)=>o.isStatic?1:1+.022*Math.sin(t*2*Math.PI/period+offset);
    const activity=clamp(s.activity||0),alarm=smooth((risk-.65)/.35);
    return {
      west:.83*breathe(7.7,0),aisle:1.05*breathe(9.1,1.4),east:.87*breathe(8.3,2.5),far:.91*breathe(11.3,3.7)-dip,
      crt:(.84+activity*.24+(s.node||0)*.20+(s.ghost||0)*.13+(s.transfer||0)*.34)*power,
      core:(.85+activity*.34+(s.brute||0)*.14+(s.overclock||0)*.28+(s.transfer||0)*.20)*power,
      racks:(.8+(s.node||0)*.30+(s.proxy||0)*.18+(s.transfer||0)*.20)*power,
      alarm:alarm*(o.isStatic?.55:.55+.12*Math.sin(t*2.2))+(s.warning||0)*.24+(s.bust||0)*.24
    };
  }
  function update(t,o={}){
    if(!ready||disposed)return false;
    const tick=Math.floor((o.isStatic?2:t)*24),value=Object.fromEntries(Object.entries(levels(tick/24,o)).map(([k,v])=>[k,Math.round(v*255)/255]));
    const mix=clamp(o.signal?.coreMix||0),target=o.signal?.coreRgb||warm;
    const tint=warm.map((v,i)=>Math.round(clamp(v+(target[i]-v)*mix)*255));
    const key=Object.values(value).map(v=>Math.round(v*255)).concat(tint).join(':');lastTime=t;lastLevels={...value,coreColor:tint};
    if(key===lastKey)return true;lastKey=key;mapBuilds++;
    ic.globalCompositeOperation='source-over';ic.globalAlpha=1;ic.fillStyle='#000';ic.fillRect(0,0,W,H);
    ic.globalCompositeOperation='lighter';
    for(const map of maps){
      const amount=clamp(value[map.channel],0,2);
      let source=map.canvas;
      if(map.channel==='core'){
        ct.globalCompositeOperation='copy';ct.drawImage(source,0,0);ct.globalCompositeOperation='multiply';ct.fillStyle='rgb('+tint.join(',')+')';ct.fillRect(0,0,W,H);source=coreTint;
      }
      ic.globalAlpha=Math.min(1,amount);ic.drawImage(source,0,0);
      if(amount>1){ic.globalAlpha=amount-1;ic.drawImage(source,0,0);}
    }
    ic.globalAlpha=1;ic.globalCompositeOperation='source-over';return true;
  }
  function draw(c,t,o={}){
    if(!update(t,o))return;draws++;
    let scratch=buffers.get(c.canvas);
    if(!scratch){if(buffers.size>=MAX_VIEWS)return;const canvas=document.createElement('canvas');scratch={canvas,ctx:canvas.getContext('2d',{alpha:false})};buffers.set(c.canvas,scratch);}
    const {canvas,ctx}=scratch,m=c.getTransform(),w=c.canvas.width,h=c.canvas.height;
    if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
    c.save();c.globalAlpha=1;c.imageSmoothingEnabled=false;c.globalCompositeOperation='multiply';c.drawImage(shade,0,0,ART_W,ART_H);
    ctx.setTransform(1,0,0,1,0,0);ctx.globalAlpha=1;ctx.globalCompositeOperation='copy';ctx.drawImage(c.canvas,0,0);
    ctx.setTransform(m);ctx.imageSmoothingEnabled=false;ctx.globalCompositeOperation='multiply';ctx.drawImage(irradiance,0,0,ART_W,ART_H);
    // Add albedo-scaled incident light: black stays black and scratches/pet pixels stay sharp.
    c.setTransform(1,0,0,1,0,0);c.globalCompositeOperation='lighter';c.drawImage(canvas,0,0);c.restore();
  }
  window.RelayLighting=Object.freeze({
    prepare,draw,
    getDefinition:()=>JSON.parse(JSON.stringify({version:2,sourceArt:'assets/scene/blacksite-relay.png',sourceSize:[ART_W,ART_H],mapSize:[W,H],sampleFps:24,formula:'clamp(C * shade * (1 + irradiance))',dynamicCoreColor:'signal.coreRgb mixed with warm by signal.coreMix',surfaces,fields})),
    exportMaps(t=2,o={}){if(!update(t,o))return null;return {shade:shade.toDataURL('image/png'),irradiance:irradiance.toDataURL('image/png'),width:W,height:H};},
    getDiagnostics:()=>Object.freeze({ready,error,disposed,draws,mapBuilds,time:lastTime,mapCount:ready?maps.length+3:0,mapSize:[W,H],viewBuffers:buffers.size,viewBufferLimit:MAX_VIEWS,ownTimers:0,ownAnimationFrames:0,levels:{...lastLevels,coreColor:lastLevels.coreColor?.slice()}}),
    dispose(){disposed=true;ready=false;for(const map of maps){map.canvas.width=0;map.canvas.height=0;}maps=[];shade.width=irradiance.width=coreTint.width=0;for(const s of buffers.values()){s.canvas.width=0;s.canvas.height=0;}buffers.clear();}
  });
})();

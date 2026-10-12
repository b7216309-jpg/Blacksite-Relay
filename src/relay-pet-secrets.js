/* Small resident performances. The controller owns state; this module owns no clock or RNG. */
(() => {
  'use strict';
  const UNIT=1536/420;
  const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,n));
  const ease=n=>{n=clamp(n);return n*n*(3-2*n);};
  const routes=Object.freeze({
    'cable-rat':Object.freeze([[556,744],[650,758],[722,750]].map(Object.freeze)),
    'rack-rat':Object.freeze([[1090,755],[1010,755],[910,754],[806,748]].map(Object.freeze))
  });
  const props={};let disposed=false,revision=0;
  const nativeSizes={placard:[28,36],crumb:[3,2],pouch:[7,5],envelope:[5,3]};
  const glyphs={B:['110','101','110','101','110'],R:['110','101','110','101','101'],E:['111','100','110','100','111'],A:['010','101','111','101','101'],K:['101','101','110','101','101'],T:['111','010','010','010','010'],I:['111','010','010','010','111'],M:['101','111','111','101','101'],N:['101','111','111','111','101'],P:['110','101','110','100','100'],U:['101','101','101','101','111'],S:['111','100','111','001','111']};
  function signText(c){
    c.fillStyle='#272b23';
    const words=window.RiskI18n?.language==='fr'?[['EN',11,7],['PAUSE',5,14]]:[['BREAK',5,7],['TIME',7,14]];
    for(const [word,x,y]of words)for(let i=0;i<word.length;i++){
      const px=x+i*4,py=y+Math.floor((px-4)*.16);
      glyphs[word[i]].forEach((row,dy)=>[...row].forEach((v,dx)=>{if(v==='1')c.fillRect(px+dx,py+dy,1,1);}));
    }
  }
  function repaintPlacard(){
    const prop=props.placard;
    if(disposed||!prop?.ready)return;
    const c=prop.native.getContext('2d');
    c.clearRect(0,0,...nativeSizes.placard);c.imageSmoothingEnabled=false;
    c.drawImage(prop.canvas,...prop.crop,0,0,...nativeSizes.placard);signText(c);
    revision++;window.BlacksiteScene?.setState?.({});
  }
  document.addEventListener('risk:language',repaintPlacard);
  function scene(t,o){return disposed?{}:window.RelayEasterEggs?.getSceneState?.(t,o)||{};}
  function pathPoint(points,u){
    const lengths=points.slice(1).map((p,i)=>Math.hypot(p[0]-points[i][0],p[1]-points[i][1]));
    let distance=clamp(u)*lengths.reduce((a,b)=>a+b,0);
    for(let i=0;i<lengths.length;i++){
      if(distance<=lengths[i]||i===lengths.length-1){const f=lengths[i]?clamp(distance/lengths[i]):1;return [points[i][0]+(points[i+1][0]-points[i][0])*f,points[i][1]+(points[i+1][1]-points[i][1])*f];}
      distance-=lengths[i];
    }
    return points.at(-1);
  }
  function residents(base,t,o={}){
    const state=scene(t,o);
    return base.map(p=>{
      if(p.kind==='rat'&&state.ratUnion?.active){
        const event=state.ratUnion,e=clamp(event.elapsed,0,14),origin=event.origins?.find(v=>v.id===p.id)||p;
        const route=routes[p.id];if(!route)return p;
        const destination=route.at(-1),hold=e>=4&&e<10;
        let point,facing=p.id==='cable-rat'?1:-1;
        if(e<4)point=pathPoint([[origin.x,origin.y],...route],ease(e/4));
        else if(hold)point=destination;
        else {
          point=pathPoint([...route].reverse().concat([[p.x,p.y]]),ease((e-10)/4));
          facing*=-1;
          if(e>13.6)facing=p.facing;
        }
        return {...p,x:point[0],y:point[1],facing,moving:!hold&&!o.isStatic,
          pose:hold?'sniff':'scurry',secret:'ratUnion',secretElapsed:e,phase:t+(p.id==='rack-rat'?1.7:0)};
      }
      if(p.kind==='cat'&&state.rootAccess?.active)return {...p,pose:'tail-press',secret:'rootAccess',secretElapsed:clamp(state.rootAccess.elapsed,0,5)};
      if(p.kind==='snail'&&state.snailMail?.active){
        const e=clamp(state.snailMail.elapsed,0,6);
        return {...p,facing:-1,moving:false,pose:'mail',secret:'snailMail',secretElapsed:e,phase:4.4+Math.min(e*.25,1.19)};
      }
      return p;
    });
  }
  function decoratePixels(p,pixels){
    if(p.secret!=='rootAccess')return;
    const e=Math.floor(p.secretElapsed*12)/12,press=e>=.8&&e<3.25?1:0;
    if(!press)return;
    const {width:w,height:h,data:a}=pixels,source=new Uint8ClampedArray(a);
    // The small copper tail connector moves as a connected piece. Fur, head,
    // paws and silhouette stay on the original pixel grid without body warping.
    const piece=[];
    for(let y=15;y<Math.min(h,20);y++)for(let x=10;x<Math.min(w,17);x++){
      const k=(y*w+x)*4;
      if(source[k+3]&&source[k]>source[k+1]*1.28&&source[k+1]>source[k+2]*1.2&&source[k]>65){
        piece.push([x,y]);a[k+3]=0;
      }
    }
    for(const [x,y] of piece){
      const ny=y+(x>=12?press:0);if(ny>=h)continue;
      const from=(y*w+x)*4,to=(ny*w+x)*4;
      for(let c=0;c<4;c++)a[to+c]=source[from+c];
    }
  }
  function stamp(c,id,x,y,w,h,alpha=1){
    const prop=props[id];if(!prop?.ready||alpha<=0)return;
    c.save();c.globalAlpha=alpha;c.imageSmoothingEnabled=false;
    c.drawImage(prop.native,Math.round(x),Math.round(y),w,h);c.restore();
  }
  function decorateNative(p,frame){
    if(p.secret!=='snailMail')return;
    const e=Math.floor(p.secretElapsed*12)/12,c=frame.getContext('2d'),visible=Math.min(clamp((e-.2)/.25),clamp((6-e)/.5));
    if(visible<=0)return;
    const slide=Math.round(2*(1-ease((e-.2)/.8)))+Math.round(2*ease((e-5)/.8));
    const letterLift=Math.round(2*Math.min(ease((e-1)/.8),1-ease((e-4.2)/.8)));
    // Composite within the existing final14×12 frame so lighting and the same
    // shadow caster include the attachment. The left-facing foot never moves.
    stamp(c,'envelope',3-slide,3-letterLift,5,3,visible);
    stamp(c,'pouch',2-slide,4,7,5,visible);
  }
  function drawProps(c,t,o={},base=[]){
    const state=scene(t,o),m=c.getTransform(),scale=m.a*UNIT;
    c.save();c.setTransform(1,0,0,1,0,0);c.globalCompositeOperation='source-over';c.globalAlpha=1;c.imageSmoothingEnabled=false;
    const world=(id,x,y,w,h,alpha)=>stamp(c,id,m.a*x+m.e-w*scale/2,m.d*y+m.f-h*scale,Math.round(w*scale),Math.round(h*scale),alpha);
    if(state.ratUnion?.active){
      const e=state.ratUnion.elapsed,show=Math.min(ease((e-3.4)/.6),1-ease((e-9.4)/.6));
      world('crumb',764,754,3,2,show);
      if(show>0){c.globalAlpha=show*.28;c.fillStyle='#050a09';c.fillRect(Math.round(m.a*764+m.e-12*scale),Math.round(m.d*750+m.f-scale),Math.round(24*scale),Math.max(1,Math.round(2*scale)));c.globalAlpha=1;}
      world('placard',764,750,28,36,show);
    }
    if(state.rootAccess?.active){
      const p=base.find(p=>p.kind==='cat'),e=state.rootAccess.elapsed;
      if(p&&e>=.8&&e<3.25){
        // A two-pixel indicator at the connector's point of contact, not a glow
        // painted over the cat or an unregistered floating screen effect.
        c.fillStyle='#337a70';c.fillRect(Math.round(m.a*(p.x-UNIT)+m.e),Math.round(m.d*(p.y+UNIT)+m.f),Math.max(1,Math.round(scale)),Math.max(1,Math.round(scale)));
      }
    }
    c.restore();
  }
  function importSheet(id,path,crops){
    const image=new Image(),sheet=document.createElement('canvas');
    const entries=Object.entries(crops).map(([key,crop])=>{const p=props[key]={id:key,ready:false,error:false,canvas:sheet,native:document.createElement('canvas'),crop:Object.freeze(crop),image};return p;});
    const load=()=>{
      if(disposed)return;
      try{
        sheet.width=image.naturalWidth;sheet.height=image.naturalHeight;
        const c=sheet.getContext('2d',{willReadFrequently:true});c.drawImage(image,0,0);
        const pixels=c.getImageData(0,0,sheet.width,sheet.height),a=pixels.data;
        // Original magenta-matte ImageGen pixels stay unmodified on disk.
        for(let i=0;i<a.length;i+=4){
          const r=a[i],g=a[i+1],b=a[i+2];
          if(r>g+12&&b>g+12)a[i+3]=0;
          else if(r>g*1.25&&b>g*.95)a[i+2]=Math.round(g*.85);
        }
        c.putImageData(pixels,0,0);entries.forEach(p=>{
          const size=nativeSizes[p.id];p.native.width=size[0];p.native.height=size[1];
          const nc=p.native.getContext('2d');nc.imageSmoothingEnabled=false;nc.drawImage(sheet,...p.crop,0,0,...size);
          if(p.id==='placard')signText(nc);p.ready=true;
        });revision++;window.BlacksiteScene?.setState?.({});
      }catch(_){entries.forEach(p=>p.error=true);}
    };
    const fail=()=>entries.forEach(p=>p.error=true);
    entries.forEach(p=>{p.load=load;p.fail=fail;});image.addEventListener('load',load,{once:true});image.addEventListener('error',fail,{once:true});image.src=path;
  }
  window.RelayPetSecrets=Object.freeze({
    residents,decoratePixels,decorateNative,drawProps,
    getDefinition:()=>Object.freeze({durations:Object.freeze({ratUnion:14,rootAccess:5,snailMail:6}),routes,meeting:Object.freeze([[722,750],[806,748]].map(Object.freeze)),ratLimit:2}),
    getRevision:()=>revision,
    getDiagnostics:()=>Object.freeze({disposed,ownTimers:0,ownAnimationFrames:0,revision,props:Object.fromEntries(Object.entries(props).map(([id,p])=>[id,{ready:p.ready,error:p.error,crop:p.crop,nativeSize:nativeSizes[id]}]))}),
    dispose(){disposed=true;document.removeEventListener('risk:language',repaintPlacard);const seen=new Set();for(const p of Object.values(props)){p.ready=false;p.native.width=0;p.native.height=0;if(seen.has(p.image))continue;seen.add(p.image);p.image.removeEventListener('load',p.load);p.image.removeEventListener('error',p.fail);p.image.removeAttribute('src');p.canvas.width=0;p.canvas.height=0;}}
  });
  importSheet('union','assets/easter-eggs/break-time-placard.png',{placard:[146,122,750,976],crumb:[992,964,114,95]});
  importSheet('courier','assets/easter-eggs/snail-courier-kit.png',{pouch:[83,345,638,495],envelope:[784,577,386,263]});
})();

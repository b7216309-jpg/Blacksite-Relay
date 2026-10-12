/* Relay residents: original sprites, one shared scene clock, no gameplay state or RNG. */
(() => {
  'use strict';
  const UNIT=1536/420, TAU=Math.PI*2, RAT_LIMIT=2;
  const specs={
    rat:{width:30,height:16,content:[2,2,26,10],pivot:[18,12]},
    cat:{width:28,height:22,content:[2,2,24,16],pivot:[15,18]},
    snail:{width:21,height:18,content:[2,2,17,12],pivot:[11,14],renderScale:.65}
  };
  const textures={};let disposed=false,draws=0,lastTime=0,lastResidents=[],state={screen:'menu'};
  const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
  const smooth=v=>{v=clamp(v);return v*v*(3-2*v);};
  function importSprite(id,spec){
    const image=new Image(),frame=document.createElement('canvas');frame.width=spec.width;frame.height=spec.height;
    const ctx=frame.getContext('2d',{willReadFrequently:true});
    const texture=textures[id]={image,frame,ctx,spec,ready:false,error:false,pixels:null,cache:new Map(),generated:0};
    texture.load=()=>{
      if(disposed)return;
      try{
        const source=document.createElement('canvas');source.width=image.naturalWidth;source.height=image.naturalHeight;
        const sc=source.getContext('2d',{willReadFrequently:true});sc.drawImage(image,0,0);
        const data=sc.getImageData(0,0,source.width,source.height),p=data.data;
        let left=source.width,top=source.height,right=0,bottom=0;
        // Import the supplied pale matte once. Original ImageGen sources stay intact.
        for(let y=0;y<source.height;y++)for(let x=0;x<source.width;x++){
          const i=(y*source.width+x)*4;
          if(Math.min(p[i],p[i+1],p[i+2])>=190)p[i+3]=0;
          if(p[i+3]){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
        }
        if(right<=left||bottom<=top)throw Error('Empty pet sprite');
        sc.putImageData(data,0,0);ctx.imageSmoothingEnabled=false;
        ctx.drawImage(source,left,top,right-left+1,bottom-top+1,...spec.content);
        texture.pixels=ctx.getImageData(0,0,spec.width,spec.height);
        // Strip only outside-connected neutral fringe, preserving fur and metal colors.
        const a=texture.pixels.data,seen=new Uint8Array(spec.width*spec.height),queue=[];
        const visit=(x,y)=>{
          if(x<0||x>=spec.width||y<0||y>=spec.height)return;
          const n=y*spec.width+x,k=n*4;if(seen[n])return;seen[n]=1;
          const lo=Math.min(a[k],a[k+1],a[k+2]),hi=Math.max(a[k],a[k+1],a[k+2]);
          if(a[k+3]===0||(lo>120&&hi-lo<18)){a[k+3]=0;queue.push(n);}
        };
        for(let x=0;x<spec.width;x++){visit(x,0);visit(x,spec.height-1);}
        for(let y=0;y<spec.height;y++){visit(0,y);visit(spec.width-1,y);}
        for(let i=0;i<queue.length;i++){const n=queue[i],x=n%spec.width,y=Math.floor(n/spec.width);visit(x-1,y);visit(x+1,y);visit(x,y-1);visit(x,y+1);}
        texture.crop=[left,top,right-left+1,bottom-top+1];texture.ready=true;source.width=0;source.height=0;
        window.BlacksiteScene?.setState({});
      }catch(_){texture.error=true;}
    };
    texture.fail=()=>{if(!disposed)texture.error=true;};
    image.addEventListener('load',texture.load,{once:true});image.addEventListener('error',texture.fail,{once:true});
    image.src='assets/scene/relay-'+id+'-design.png';
  }
  Object.entries(specs).forEach(([id,spec])=>importSprite(id,spec));

  function ratRoute(t,offset,start,end){
    const q=(t+offset)%31.7;
    let progress=0,moving=false,facing=1,pose='sniff';
    // Long pauses and two short trips. Turning happens while the rat is still.
    if(q>=5&&q<8.2){progress=smooth((q-5)/3.2);moving=true;pose='scurry';}
    else if(q>=8.2&&q<19){progress=1;facing=q<17.6?1:-1;pose=q<11?'sniff':'rest';}
    else if(q>=19&&q<22.2){progress=1-smooth((q-19)/3.2);moving=true;facing=-1;pose='scurry';}
    else if(q>=22.2){facing=q<29.8?-1:1;pose='rest';}
    return {x:start[0]+(end[0]-start[0])*progress,y:start[1]+(end[1]-start[1])*progress,facing,moving,pose,phase:t+offset};
  }
  function residents(t,isStatic=false,o={}){
    const sceneTime=t;
    if(isStatic)t=2;
    const left=ratRoute(t,0,[410,713],[490,748]);
    const right=ratRoute(t,12.9,[1180,722],[1280,754]);
    const base=[
      {id:'server-cat',kind:'cat',x:363,y:370,facing:1,pose:isStatic?'rest':(t%17.3<.24?'blink':t%23.9>22.9?'ear-flick':'rest'),phase:t},
      // The smaller snail rests facing the console; only its feelers explore.
      // A fixed foot avoids a permanently left-facing animal gliding backwards.
      {id:'coil-snail',kind:'snail',x:1206,y:389,facing:-1,moving:false,pose:isStatic?'rest':'feelers',phase:t},
      {id:'cable-rat',kind:'rat',...left},
      {id:'rack-rat',kind:'rat',...right}
    ].map(p=>isStatic?{...p,moving:false,pose:'rest'}:p);
    return window.RelayPetSecrets?.residents?.(base,sceneTime,{...o,isStatic})||base;
  }
  function renderSprite(p,isStatic){
    const tx=textures[p.kind];if(!tx.ready)return null;
    const {width:w,height:h}=tx.spec,tick=Math.floor(p.phase*12),t=tick/12;
    const key=[isStatic?0:tick,p.pose,p.moving,isStatic,p.secret||'',Math.floor((p.secretElapsed||0)*12),window.RelayPetSecrets?.getRevision?.()||0].join(':');
    let cached=tx.cache.get(p.id);
    if(cached?.key===key)return cached.frame;
    if(!cached){const frame=document.createElement('canvas');frame.width=Math.round(w*(tx.spec.renderScale||1));frame.height=Math.round(h*(tx.spec.renderScale||1));cached={frame,ctx:frame.getContext('2d'),key:''};tx.cache.set(p.id,cached);}
    cached.key=key;tx.generated++;
    const src=tx.pixels.data,out=tx.ctx.createImageData(w,h),a=out.data;
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      let sx=x,sy=y;
      if(!isStatic){
        if(p.kind==='rat'){
          if(x<11)sy-=Math.round(Math.sin(t*5+x*.35)*.8*(11-x)/9);
          if(p.moving&&y>=10&&x>11)sx-=Math.round(Math.sin(t*TAU*3+(x<20?0:Math.PI))*.8);
          if(!p.moving&&p.pose==='sniff'&&x>23)sy-=Math.round(Math.sin(t*TAU*1.4)*.58*(x-23)/5);
        }else if(p.kind==='cat'&&p.pose==='ear-flick'&&y<7&&x>16){
          sx-=Math.round(Math.sin((t%23.9-22.9)*TAU)*.8*(7-y)/5);
        }else if(p.kind==='snail'&&x>14&&y<10){
          sx-=Math.round(Math.sin(t*1.7+(x>17?.7:0))*.65*(10-y)/7);
        }
      }
      sx=Math.round(sx);sy=Math.round(sy);if(sx<0||sx>=w||sy<0||sy>=h)continue;
      const k=(sy*w+sx)*4,i=(y*w+x)*4;
      // The room is dim; highlights remain readable without a bright sticker outline.
      const light=p.kind==='snail'?.67:p.kind==='cat'?.83:.78;
      const blink=p.kind==='cat'&&p.pose==='blink'&&x>18&&y>8&&y<12&&src[k]>src[k+1]*1.1&&src[k]>100;
      a[i]=blink?30:Math.round(src[k]*light);a[i+1]=blink?32:Math.round(src[k+1]*light);a[i+2]=blink?28:Math.round(src[k+2]*light);a[i+3]=src[k+3];
    }
    window.RelayPetSecrets?.decoratePixels?.(p,out);
    if(cached.frame.width!==w||cached.frame.height!==h){
      // Fix the small sprite to one authored pixel grid before rendering, including
      // its one-pixel feeler gesture. The original imported artwork stays intact.
      const dw=cached.frame.width,dh=cached.frame.height,small=cached.ctx.createImageData(dw,dh);
      for(let y=0;y<dh;y++)for(let x=0;x<dw;x++){
        const from=(Math.floor((y+.5)*h/dh)*w+Math.floor((x+.5)*w/dw))*4,to=(y*dw+x)*4;
        for(let i=0;i<4;i++)small.data[to+i]=a[from+i];
      }
      if(p.kind==='snail'&&!isStatic&&t%19.7>4.4&&t%19.7<5.6){
        // A brief upward reach of the outer feeler; the stem remains connected.
        // The shell and foot never move, and the gesture survives at native size.
        for(let x=10;x<=12;x++)for(let i=0;i<4;i++){
          small.data[(2*dw+x)*4+i]=small.data[(3*dw+x)*4+i];
          small.data[(3*dw+x)*4+i]=small.data[(4*dw+x)*4+i];
        }
      }
      cached.ctx.putImageData(small,0,0);
    }else cached.ctx.putImageData(out,0,0);
    window.RelayPetSecrets?.decorateNative?.(p,cached.frame);
    tx.ctx.putImageData(out,0,0);return cached.frame;
  }
  function draw(c,t,o={}){
    if(disposed)return;
    lastTime=t;draws++;let rats=0;
    lastResidents=residents(t,!!o.isStatic,o).filter(p=>p.kind!=='rat'||rats++<RAT_LIMIT);
    window.RelayPetSecrets?.drawProps?.(c,t,o,lastResidents);
    const m=c.getTransform(),baseScale=m.a*UNIT;
    for(const p of lastResidents){
      const sprite=renderSprite(p,!!o.isStatic);if(!sprite)continue;
      const spec=specs[p.kind],size=spec.renderScale||1,scale=baseScale*size,footX=Math.round(m.a*p.x+m.e),footY=Math.round(m.d*p.y+m.f);
      c.save();c.setTransform(1,0,0,1,0,0);c.globalAlpha=1;c.globalCompositeOperation='source-over';c.imageSmoothingEnabled=false;
      if(!window.RelayShadows){c.fillStyle='rgba(0,5,6,.48)';c.fillRect(footX-Math.round((p.kind==='cat'?10:6)*scale),footY-Math.round(scale),Math.round((p.kind==='cat'?20:12)*scale),Math.max(1,Math.round(scale)));}
      c.translate(footX,footY);c.scale(p.facing,1);
      c.drawImage(sprite,-Math.round(Math.round(spec.pivot[0]*size)*baseScale),-Math.round(Math.round(spec.pivot[1]*size)*baseScale),Math.round(sprite.width*baseScale),Math.round(sprite.height*baseScale));c.restore();
    }
  }
  window.RelayPets=Object.freeze({
    draw,setState(next={}){state={...state,...next};},
    getResidentPositions(t,o={}){
      if(disposed)return Object.freeze([]);
      return Object.freeze(residents(t,!!o.isStatic,o).map(p=>{
        const spec=specs[p.kind],size=spec.renderScale||1,pivot=spec.pivot.map(v=>Math.round(v*size)),nativeSize=[Math.round(spec.width*size),Math.round(spec.height*size)];
        const left=p.facing<0?p.x-(nativeSize[0]-pivot[0])*UNIT:p.x-pivot[0]*UNIT;
        return Object.freeze({id:p.id,kind:p.kind,x:p.x,y:p.y,facing:p.facing,pose:p.pose,pivot:Object.freeze(pivot),nativeSize:Object.freeze(nativeSize),bounds:Object.freeze([left,p.y-pivot[1]*UNIT,nativeSize[0]*UNIT,nativeSize[1]*UNIT])});
      }));
    },
    // Frame references are read-only and reused by the actor renderer on the same tick.
    // Queries prepare private caches without moving the displayed residents or clock.
    getShadowCasters(t,o={}){
      if(disposed)return [];
      let rats=0;
      return residents(t,!!o.isStatic,o).filter(p=>p.kind!=='rat'||rats++<RAT_LIMIT).flatMap(p=>{
        const frame=renderSprite(p,!!o.isStatic);if(!frame)return [];
        const spec=specs[p.kind],size=spec.renderScale||1;
        return [Object.freeze({id:p.id,kind:p.kind,frame,pivot:Object.freeze(spec.pivot.map(v=>Math.round(v*size))),foot:Object.freeze([p.x,p.y]),facing:p.facing,nativeSize:Object.freeze([frame.width,frame.height])})];
      });
    },
    exportFrame(id){const tx=textures[id];return tx?.ready?tx.frame.toDataURL('image/png'):null;},
    getDiagnostics:()=>Object.freeze({ready:Object.values(textures).every(t=>t.ready),error:Object.values(textures).some(t=>t.error),disposed,draws,time:lastTime,ownTimers:0,ownAnimationFrames:0,residentLimit:4,ratLimit:RAT_LIMIT,ratCount:lastResidents.filter(p=>p.kind==='rat').length,screen:state.screen,residents:lastResidents.map(p=>({...p})),textures:Object.fromEntries(Object.entries(textures).map(([id,t])=>[id,{ready:t.ready,crop:t.crop,pixelSize:[t.spec.width,t.spec.height],renderScale:t.spec.renderScale||1,generatedFrames:t.generated,cachedFrames:t.cache.size}]))}),
    dispose(){disposed=true;lastResidents=[];window.RelayPetSecrets?.dispose?.();for(const tx of Object.values(textures)){tx.ready=false;tx.pixels=null;for(const c of tx.cache.values()){c.frame.width=0;c.frame.height=0;}tx.cache.clear();tx.frame.width=0;tx.frame.height=0;tx.image.removeEventListener('load',tx.load);tx.image.removeEventListener('error',tx.fail);tx.image.removeAttribute('src');}}
  });
})();

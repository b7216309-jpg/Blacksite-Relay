/* Blacksite Relay operator — one original drawing, connected motion, native pixel grid. */
(() => {
  'use strict';
  const W=36,H=72,PIVOT={x:16,y:64},FOOT={x:574,y:707};
  const image=new Image(), frame=document.createElement('canvas');
  frame.width=W;frame.height=H;
  const fc=frame.getContext('2d',{willReadFrequently:true});
  let pixels=null,ready=false,error=false,disposed=false,lastKey='',draws=0,lastTime=0,pose='idle',generated=0;
  let state={screen:'menu'};
  const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,n));
  const smooth=n=>{n=clamp(n);return n*n*(3-2*n);};
  function load(){
    if(disposed)return;
    try{
      const source=document.createElement('canvas');source.width=image.naturalWidth;source.height=image.naturalHeight;
      const c=source.getContext('2d',{willReadFrequently:true});c.drawImage(image,0,0);
      const data=c.getImageData(0,0,source.width,source.height);
      for(let i=0;i<data.data.length;i+=4)if(Math.min(data.data[i],data.data[i+1],data.data[i+2])>=190)data.data[i+3]=0;
      c.putImageData(data,0,0);
      fc.imageSmoothingEnabled=false;
      fc.drawImage(source,303,182,466,1129,6,8,24,56);
      pixels=fc.getImageData(0,0,W,H);
      // Despill only neutral matte pixels connected to the transparent outside.
      // Interior colors are never globally replaced by a lower threshold.
      const seen=new Uint8Array(W*H),queue=new Int32Array(W*H);let first=0,last=0;
      const enqueue=(x,y)=>{
        if(x<0||x>=W||y<0||y>=H)return;
        const n=y*W+x;if(seen[n])return;seen[n]=1;
        const k=n*4,a=pixels.data,min=Math.min(a[k],a[k+1],a[k+2]),max=Math.max(a[k],a[k+1],a[k+2]);
        if(a[k+3]===0||(min>120&&max-min<18)){a[k+3]=0;queue[last++]=n;}
      };
      for(let x=0;x<W;x++){enqueue(x,0);enqueue(x,H-1);}
      for(let y=0;y<H;y++){enqueue(0,y);enqueue(W-1,y);}
      while(first<last){const n=queue[first++],x=n%W,y=Math.floor(n/W);enqueue(x-1,y);enqueue(x+1,y);enqueue(x,y-1);enqueue(x,y+1);}
      ready=true;
      window.BlacksiteScene?.setState({});
    }catch(_){error=true;}
  }
  image.addEventListener('load',load,{once:true});
  const fail=()=>{if(!disposed)error=true;};
  image.addEventListener('error',fail,{once:true});
  image.src='assets/scene/relay-operator-design.png';

  function parameters(t,o){
    if(o.isStatic)return {breath:0,look:0,tap:0,active:false,pose:'idle'};
    const s=o.signal||{},q=t%27.6;
    const glance=q>17&&q<20?Math.sin((q-17)/3*Math.PI):0;
    const working=(q>7.5&&q<10.5)||s.activity>.08;
    return {
      breath:.035*(.5-.5*Math.cos(t*Math.PI*2/5.8)),
      look:glance*.075+(s.warning||0)*.035,
      tap:working?.62*(.5-.5*Math.cos(t*Math.PI*2*2.2)):0,
      active:working,
      pose:glance>.1?'glance':working?'diagnostics':'idle'
    };
  }
  function warp(x,y,p){
    const head=smooth((25-y)/9);
    const neckX=18,neckY=23,angle=p.look*head;
    const co=Math.cos(angle),si=Math.sin(angle);
    const dx=(x-neckX)*(co-1)-(y-neckY)*si;
    const dy=(x-neckX)*si+(y-neckY)*(co-1);
    // The wrist and supported pad move together, without redrawing the arm.
    const wrist=Math.exp(-(((x-25)/5)**2+((y-29)/5)**2))*smooth((39-y)/7);
    return [x+dx,y+dy+p.tap*wrist];
  }
  function render(t,o){
    const tick=Math.floor(t*12),p=parameters(tick/12,o);
    const key=[tick,!!o.isStatic,Math.round((o.signal?.activity||0)*10),Math.round((o.signal?.warning||0)*10)].join(':');
    if(key===lastKey)return p.pose;
    lastKey=key;generated++;
    const result=fc.createImageData(W,H),out=result.data,src=pixels.data;
    for(let y=0;y<H;y++)for(let x=0;x<W;x++){
      let sx=x,sy=y;
      if(y<40){
        // Inverse-map the connected image, preserving filled joints and alpha.
        for(let j=0;j<3;j++){const point=warp(sx,sy,p);sx+=x-point[0];sy+=y-point[1];}
      }
      sx=Math.round(sx);sy=Math.round(sy);
      if(sx<0||sx>=W||sy<0||sy>=H)continue;
      const a=(y*W+x)*4,b=(sy*W+sx)*4;
      const coat=x>8&&x<22&&y>23&&y<37&&src[b+1]>src[b]*1.05;
      const light=coat?1+p.breath*smooth((y-23)/4)*smooth((37-y)/4):1;
      out[a]=Math.round(src[b]*light);out[a+1]=Math.round(src[b+1]*light);out[a+2]=Math.round(src[b+2]*light);out[a+3]=src[b+3];
    }
    fc.putImageData(result,0,0);
    // Cool diagnostic marks sit inside the supported pad, following its wrist.
    for(const [x,y,color] of [[24,25,'#172d2c'],[25,25,'#80aa95'],[25,26,'#172d2c'],[26,26,'#598b7a'],[25,27,p.active&&tick%8<3?'#aac5a6':'#436d60']]){
      const point=warp(x,y,p);fc.fillStyle=color;fc.fillRect(Math.round(point[0]),Math.round(point[1]),1,1);
    }
    return p.pose;
  }
  function draw(c,t,o={}){
    if(!ready||disposed)return;
    pose=render(t,o);lastTime=t;draws++;
    const m=c.getTransform(),scale=m.a*(1536/420);
    const footX=Math.round(m.a*FOOT.x+m.e),footY=Math.round(m.d*FOOT.y+m.f);
    const width=Math.round(W*scale),height=Math.round(H*scale);
    const x=footX-Math.round(PIVOT.x*scale),y=footY-Math.round(PIVOT.y*scale);
    c.save();c.setTransform(1,0,0,1,0,0);c.globalAlpha=1;c.globalCompositeOperation='source-over';c.imageSmoothingEnabled=false;
    if(!window.RelayShadows){c.fillStyle='rgba(0,6,8,.34)';c.beginPath();c.ellipse(footX,footY-2*scale,7*scale,2*scale,-.22,0,Math.PI*2);c.fill();}
    c.drawImage(frame,x,y,width,height);c.restore();
  }
  window.RelayLife=Object.freeze({
    draw,emit(){},setState(next={}){state={...state,...next};},
    // The frame is a private read-only reference, valid until another pose is prepared.
    // Preparing a shadow silhouette does not count as displaying the actor.
    getShadowCasters(t,o={}){
      if(!ready||disposed)return [];
      render(t,o);
      return [Object.freeze({id:'relay-operator',kind:'operator',frame,pivot:Object.freeze([PIVOT.x,PIVOT.y]),foot:Object.freeze([FOOT.x,FOOT.y]),facing:1,nativeSize:Object.freeze([W,H])})];
    },
    exportFrame:()=>ready?frame.toDataURL('image/png'):null,
    getDiagnostics:()=>Object.freeze({ready,error,disposed,pose,draws,time:lastTime,frameCount:ready?1:0,generatedFrames:generated,ownTimers:0,ownAnimationFrames:0,foot:Object.freeze({...FOOT}),pixelSize:{width:W,height:H},screen:state.screen}),
    dispose(){disposed=true;ready=false;pixels=null;frame.width=0;frame.height=0;image.removeEventListener('load',load);image.removeEventListener('error',fail);image.removeAttribute('src');}
  });
})();

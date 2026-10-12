/* Registered resident shadows: native alpha silhouettes, receiving surfaces and shared clock. */
(() => {
  'use strict';
  const W=420,H=280,ART_W=1536,ART_H=1024,UNIT=ART_W/W,MAX_CASTERS=5;
  const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,n));
  const receivers={
    floor:[[229,701],[482,641],[609,695],[723,737],[874,702],[1091,654],[1368,721],[1401,859],[1123,880],[930,803],[750,833],[547,938],[274,844]],
    leftRoof:[[233,378],[362,316],[482,360],[349,419]],
    rightRoof:[[1090,386],[1231,328],[1358,372],[1217,433]]
  };
  const profiles={
    operator:{receiver:'floor',light:[716,553],length:28,width:.86,cast:.32,contact:[6.6,2.0,-1],contactAlpha:.48},
    rat:{receiver:'floor',light:[716,553],length:12,width:.94,cast:.29,contact:[9.2,1.55,-3],contactAlpha:.43},
    cat:{receiver:'leftRoof',light:[474,278],length:9,width:.88,cast:.24,contact:[9.5,1.8,-1],contactAlpha:.42},
    snail:{receiver:'rightRoof',light:[1114,290],length:5,width:.9,cast:.20,contact:[4.2,.9,0],contactAlpha:.40}
  };
  const canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;
  const ctx=canvas.getContext('2d');
  let image=ctx.createImageData(W,H),cast=new Uint8Array(W*H),ink=new Uint8Array(W*H),masks={};
  let ready=false,disposed=false,error=false,draws=0,builds=0,lastKey='',lastTime=0,lastCasters=[],shadowPixels=0;
  const sources=new Map();
  function inside(x,y,p){let hit=false;for(let i=0,j=p.length-1;i<p.length;j=i++){
    const a=p[i],b=p[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])hit=!hit;
  }return hit;}
  for(const [name,polygon] of Object.entries(receivers)){
    const mask=masks[name]=new Uint8Array(W*H);
    for(let y=0;y<H;y++)for(let x=0;x<W;x++)mask[y*W+x]=inside((x+.5)*UNIT,(y+.5)*UNIT,polygon)?1:0;
  }
  function add(x,y,amount,mask){
    if(x<0||x>=W||y<0||y>=H)return;
    const i=y*W+x;if(!mask[i])return;
    ink[i]=Math.round(255-(255-ink[i])*(1-clamp(amount)));
  }
  function update(t,o={}){
    if(disposed)return false;
    try{
      const time=o.isStatic?2:t;
      const actors=[...(window.RelayPets?.getShadowCasters?.(time,o)||[]),...(window.RelayLife?.getShadowCasters?.(time,o)||[])].slice(0,MAX_CASTERS);
      if(!actors.length)return false;
      const power=Math.round(clamp(o.signal?.power??(o.screen==='busted'?.08:1))*20)/20;
      const key=[Math.floor(time*12),!!o.isStatic,power,Math.round((o.signal?.activity||0)*10),Math.round((o.signal?.warning||0)*10),...actors.flatMap(a=>[a.id,Math.round(a.foot[0]/UNIT),Math.round(a.foot[1]/UNIT),a.facing])].join(':');
      lastTime=time;if(key===lastKey)return true;lastKey=key;builds++;ink.fill(0);lastCasters=[];
      for(const actor of actors){
        const p=profiles[actor.kind];if(!p)continue;
        const [sw,sh]=actor.nativeSize,foot=actor.foot.map(v=>Math.round(v/UNIT));
        let source=sources.get(actor.id);
        if(!source){if(sources.size>=MAX_CASTERS)continue;source={};sources.set(actor.id,source);}
        source.data=actor.frame.getContext('2d').getImageData(0,0,sw,sh).data;
        const dx=actor.foot[0]-p.light[0],dy=actor.foot[1]-p.light[1],distance=Math.max(1,Math.hypot(dx,dy));
        const tip=[Math.round(dx/distance*p.length),Math.round(dy/distance*p.length*.62)];
        const mask=masks[p.receiver],maxHeight=Math.max(1,actor.pivot[1]-2);
        let x0=W,y0=H,x1=0,y1=0;cast.fill(0);
        for(let y=0;y<sh;y++)for(let x=0;x<sw;x++){
          const alpha=source.data[(y*sw+x)*4+3]/255;if(!alpha)continue;
          const height=clamp((actor.pivot[1]-y-.5)/maxHeight),u=(x+.5-actor.pivot[0])*actor.facing;
          const px=Math.round(foot[0]+u*p.width+height*tip[0]),py=Math.round(foot[1]+u*.16+height*tip[1]);
          if(px<0||px>=W||py<0||py>=H)continue;
          const i=py*W+px;
          const strength=p.cast*(actor.kind==='operator'||actor.kind==='rat'?.58+.42*power:1)*(1-height*.18);
          cast[i]=Math.max(cast[i],Math.round(alpha*strength*255));
          x0=Math.min(x0,px);x1=Math.max(x1,px);y0=Math.min(y0,py);y1=Math.max(y1,py);
        }
        // A one-pixel penumbra keeps the cast soft without blurring the artwork.
        // Reapply the receiving surface after filtering so no shadow crosses an edge.
        for(let y=Math.max(0,y0-1);y<=Math.min(H-1,y1+1);y++)for(let x=Math.max(0,x0-1);x<=Math.min(W-1,x1+1);x++){
          let value=0;
          for(let oy=-1;oy<=1;oy++)for(let ox=-1;ox<=1;ox++){
            const sx=x+ox,sy=y+oy;if(sx<0||sx>=W||sy<0||sy>=H)continue;
            value+=cast[sy*W+sx]*(ox===0&&oy===0?.52:ox===0||oy===0?.08:.04);
          }
          if(value>0)add(x,y,value/255,mask);
        }
        // Tight occlusion under feet/belly joins the silhouette to its surface.
        const [rx,ry,offset]=p.contact,cx=foot[0]+offset*actor.facing,cy=foot[1]-.3;
        for(let y=Math.floor(cy-ry-1);y<=Math.ceil(cy+ry+1);y++)for(let x=Math.floor(cx-rx-1);x<=Math.ceil(cx+rx+1);x++){
          const r=((x+.5-cx)/rx)**2+((y+.5-cy-(x+.5-cx)*.10)/ry)**2;
          if(r<1)add(x,y,p.contactAlpha*Math.pow(1-r,.65),mask);
        }
        lastCasters.push({id:actor.id,kind:actor.kind,foot:actor.foot.slice(),nativeFoot:foot,pivot:actor.pivot.slice(),facing:actor.facing,receiver:p.receiver,tip:[foot[0]+tip[0],foot[1]+tip[1]],nativeSize:actor.nativeSize.slice()});
      }
      shadowPixels=0;
      for(let i=0;i<ink.length;i++){image.data[i*4]=image.data[i*4+1]=image.data[i*4+2]=0;image.data[i*4+3]=ink[i];if(ink[i])shadowPixels++;}
      ctx.putImageData(image,0,0);ready=true;return true;
    }catch(_){error=true;return false;}
  }
  function draw(c,t,o={}){
    if(!update(t,o))return;draws++;
    c.save();c.globalAlpha=1;c.globalCompositeOperation='source-over';c.imageSmoothingEnabled=false;c.drawImage(canvas,0,0,ART_W,ART_H);c.restore();
  }
  window.RelayShadows=Object.freeze({
    draw,
    exportFrame(t=2,o={}){return update(t,o)?{image:canvas.toDataURL('image/png'),width:W,height:H}:null;},
    getDefinition:()=>JSON.parse(JSON.stringify({version:1,sourceArtSize:[ART_W,ART_H],nativeSize:[W,H],sampleFps:12,casterLimit:MAX_CASTERS,color:'#000000',receivers,profiles})),
    getDiagnostics:()=>JSON.parse(JSON.stringify({ready,error,disposed,draws,builds,time:lastTime,shadowPixels,canvasCount:disposed?0:1,receiverMasks:disposed?0:Object.keys(masks).length,sourceCaches:sources.size,casterLimit:MAX_CASTERS,casters:lastCasters,ownTimers:0,ownAnimationFrames:0})),
    dispose(){disposed=true;ready=false;canvas.width=0;image=cast=ink=null;masks={};sources.clear();lastCasters=[];shadowPixels=0;lastKey='';}
  });
})();

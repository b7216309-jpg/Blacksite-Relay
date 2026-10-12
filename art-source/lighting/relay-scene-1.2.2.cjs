/* Blacksite Relay — original art, registered motion, independent presentation clock.
 * Coordinates are authored against the 1536 × 1024 original diorama.
 * No animation consumes Math.random or writes to game state. */
(() => {
  'use strict';
  const W = 1536, H = 1024, TAU = Math.PI * 2, MAX_PARTICLES = 160;
  const AMBER = '#ffcb79', TEAL = '#72f0ce', RED = '#ff6960';
  let state = {screen:'menu',risk:0,ghost:false,overclockTurns:0,reducedMotion:false,effectsLevel:'full'};
  let visualState = state, terminalSnapshot = null;
  let views = [], particles = [], pulses = [], raf = 0, previous = 0, clock = 0, captureTime = null;
  let seed = 0x6b1ac517, frames = 0, measuredFrames = 0, sampleStart = 0, fps = 0, disposed = false;
  const art = new Image();
  // This path is relative to index.html, also valid in packaged Electron file URLs.
  art.src = 'assets/scene/blacksite-relay.png';
  const rng = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) / 4294967296; };
  const hash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453123; return s - Math.floor(s); };
  const clamp = (n,a,b) => Math.max(a,Math.min(b,n));
  const miniScreens = new Set(['bypass','typing','backdoor']);
  const terminalScreens = new Set(['success','busted']);
  function pixel(ctx,x,y,s,color,alpha=1) {
    ctx.globalAlpha = alpha; ctx.fillStyle = color; ctx.fillRect(Math.round(x),Math.round(y),s,s);
  }
  function glow(ctx,x,y,r,color,alpha) {
    if(alpha <= 0) return;
    const g = ctx.createRadialGradient(x,y,0,x,y,r);
    g.addColorStop(0,color); g.addColorStop(1,'transparent');
    ctx.globalAlpha = alpha; ctx.fillStyle = g; ctx.fillRect(x-r,y-r,r*2,r*2);
  }
  function polygon(ctx,points) {
    ctx.beginPath(); points.forEach((p,i) => i ? ctx.lineTo(p[0],p[1]) : ctx.moveTo(p[0],p[1])); ctx.closePath();
  }
  // Revision 2: animation is confined to visible glass, vents, conductors and lamps.
  // No floating geometry is painted over the room; the lower circular fitting is a pipe cap.
  const GLASS = [[684,324],[771,346],[771,412],[684,390]];
  const COIL = [[691,533],[757,550],[751,574],[685,557]];
  const CONTACTS = [
    [[632,352],[613,359],[587,373],[573,389],[568,407],[575,429],[592,448]],
    [[955,393],[976,400],[995,417],[1004,439],[1001,461],[984,475],[963,475]],
    [[899,417],[917,429],[934,445],[944,465],[936,485],[916,497],[899,483]],
  ];
  const EMISSION_REGIONS = [
    [356,426,94,218], [1124,449,95,221], [1266,461,40,143],
    [856,378,24,37], [897,391,18,15], [898,548,21,50], [706,91,63,31]
  ];
  // These amber floor flecks are painted reflections underneath actual practical lights.
  // Sampling the original pixels prevents a glint from inventing a puddle on dry metal.
  const REFLECTION_REGIONS = [[475,641,96,90],[511,753,108,80],[1235,825,80,100]];
  let emissiveRuns = [], reflectionRuns = [], signal = {};
  function registerEmissions() {
    if(!art.naturalWidth)return;
    const sample=document.createElement('canvas');sample.width=W;sample.height=H;
    const sc=sample.getContext('2d',{willReadFrequently:true});sc.drawImage(art,0,0);
    const pixels=sc.getImageData(0,0,W,H).data;
    emissiveRuns=[];
    EMISSION_REGIONS.forEach(([x,y,w,h],region)=>{
      for(let py=y;py<y+h;py++) {
        let begin=-1;
        for(let px=x;px<=x+w;px++) {
          const k=(py*W+px)*4,r=pixels[k],g=pixels[k+1],b=pixels[k+2];
          const lit=px<x+w&&g>84&&b>68&&g>r*1.22&&b>r*1.1;
          if(lit&&begin<0)begin=px;
          if(!lit&&begin>=0){emissiveRuns.push({x:begin,y:py,w:px-begin,region,row:Math.floor((py-y)/18)});begin=-1;}
        }
      }
    });
    reflectionRuns=[];
    REFLECTION_REGIONS.forEach(([x,y,w,h],region)=>{
      for(let py=y;py<y+h;py+=3) {
        let begin=-1;
        for(let px=x;px<=x+w;px++) {
          const k=(py*W+px)*4,r=pixels[k],g=pixels[k+1],b=pixels[k+2];
          const lit=px<x+w&&r>135&&g>80&&r>g*1.13&&g>b*1.4;
          if(lit&&begin<0)begin=px;
          if(!lit&&begin>=0){if(px-begin>=2&&hash(begin+py*2)>.56)reflectionRuns.push({x:begin,y:py,w:Math.min(6,px-begin),region});begin=-1;}
        }
      }
    });
  }
  function readEffects(t) {
    const s={activity:0,brute:0,node:0,ghost:visualState.ghost?.28:0,overclock:visualState.overclockTurns?.5:0,cooler:0,proxy:0,insured:visualState.insuranceTurns?.22:0,transfer:0,bust:0,warning:0,power:state.screen==='busted'?.08:1};
    for(const fx of pulses) {
      const age=t-fx.start,p=age/fx.life;if(p<0||p>=1)continue;
      const amount=Math.min(1,age/.065)*Math.pow(1-p,1.2);
      if(fx.type==='hack'){s.activity=Math.max(s.activity,amount*(fx.hackType===3?1:fx.hackType===2?.65:.35));if(fx.hackType===3)s.brute=Math.max(s.brute,amount);}
      else if(fx.type==='node'||fx.type==='achievement'||fx.type==='prestige'||fx.type==='minigame-success')s.node=Math.max(s.node,amount);
      else if(fx.type==='ghost'||fx.type==='ghost-save')s.ghost=Math.max(s.ghost,amount);
      else if(fx.type==='cooler')s.cooler=Math.max(s.cooler,amount);
      else if(fx.type==='bonus'){
        if(fx.bonusId===6)s.overclock=Math.max(s.overclock,amount);
        else if(fx.bonusId===5)s.proxy=Math.max(s.proxy,amount);
        else if(fx.bonusId===2)s.insured=Math.max(s.insured,amount);
        else s.activity=Math.max(s.activity,amount*.55);
      } else if(fx.type==='transfer')s.transfer=Math.max(s.transfer,amount);
      else if(fx.type==='bust'){s.bust=1;s.power=Math.min(s.power,1-clamp(age/.85,0,1)*.92);}
      else if(fx.type==='minigame-fail')s.warning=Math.max(s.warning,amount);
    }
    return s;
  }
  function glassRect(ctx,u,v,w,h,color,alpha) {
    const p=(a,b)=>[684+87*a,324+22*a+66*b];
    ctx.globalAlpha=alpha;ctx.fillStyle=color;
    polygon(ctx,[p(u,v),p(u+w,v),p(u+w,v+h),p(u,v+h)]);ctx.fill();
  }
  // Unrelated prime-ish periods keep small maintenance actions from moving in unison.
  // The common presentation clock freezes these with reduced motion and mini-games.
  function maintenancePhase(t,period,offset,duration) {
    const phase=(t+offset)%period;return phase<duration?phase/duration:-1;
  }
  function fan(ctx,t) {
    // Animate behind the actual wall fan's rim/hub/grille. Two-pixel clusters only.
    const x=1426,y=271,rx=27,ry=35,angle=t*(2.1+signal.overclock*3.1)*signal.power;
    ctx.save();
    for(let py=-ry;py<=ry;py+=2)for(let px=-rx;px<=rx;px+=2){
      const nx=px/rx,ny=py/ry,r=Math.hypot(nx,ny);if(r<.23||r>.91)continue;
      const a=Math.atan2(ny,nx);
      if(Math.abs(Math.sin(a*4))<.16)continue; // Original stationary radial grille remains visible.
      const blade=Math.cos(a*6-angle*6-r*.6);
      if(blade>.32)pixel(ctx,x+px,y+py,2,'#4c7260',(.08+.11*blade)*signal.power);
      else pixel(ctx,x+px,y+py,2,'#010a0a',.20+Math.abs(blade)*.15);
    }
    ctx.restore();
  }
  function crt(ctx,t) {
    ctx.save();polygon(ctx,GLASS);ctx.clip();
    // Keep original phosphor text and curvature. A narrow rolling refresh crosses the glass.
    const scan=(t*.18)%1;
    glassRect(ctx,0,scan,1,.026,'#bcffe0',.12*signal.power);
    glassRect(ctx,0,(scan+.03)%1,1,.022,'#021b15',.23);
    const load=Math.max(signal.activity,signal.overclock*.8,signal.node,signal.transfer);
    const diagnostic=maintenancePhase(t,13.7,2.8,1.7);
    if(diagnostic>=0&&load<.18&&signal.power>.5){
      // One line of the existing monitor performs a quiet parity check, then releases.
      const envelope=Math.sin(diagnostic*Math.PI)*.55;
      glassRect(ctx,.31,.76,.61,.043,'#03221b',envelope*.8);
      const checked=Math.floor(diagnostic*12);
      for(let i=0;i<12;i++)if(i<=checked)glassRect(ctx,.32+i*.046,.772,.026,.016,TEAL,envelope);
    }
    if(load>.01){
      // Exposure rises on the original phosphor pixels, preserving its text and dark glass.
      ctx.globalCompositeOperation='screen';ctx.globalAlpha=load*.32;ctx.drawImage(art,0,0,W,H);ctx.globalCompositeOperation='source-over';
      // Two status rows sit within the existing display, never on its bezel.
      glassRect(ctx,.28,.69,.67,.085,'#03221b',load*.74);
      const count=Math.floor((t*(signal.transfer?27:12))%14);
      for(let i=0;i<14;i++)if(i<=count)glassRect(ctx,.30+i*.043,.718,.027,.024,TEAL,Math.min(1,load*1.25));
      for(let i=0;i<8;i++){
        const row=(i+Math.floor(t*9))%8;
        glassRect(ctx,.33+i*.072,.19+row*.034,.047,.018,signal.brute?AMBER:TEAL,load*.58);
      }
    }
    if(signal.ghost>.02){
      glassRect(ctx,.075,.14,.10,.02,TEAL,signal.ghost*.8);
      glassRect(ctx,.075,.16,.018,.08,TEAL,signal.ghost*.8);
      glassRect(ctx,.157,.16,.018,.08,TEAL,signal.ghost*.8);
      glassRect(ctx,.09,.235,.067,.015,TEAL,signal.ghost*.8);
    }
    const risk=Number(visualState.risk||0)/100;
    if(risk>.6||signal.warning||signal.bust){
      const level=signal.bust?1:Math.max((risk-.6)*1.4,signal.warning);
      glassRect(ctx,.29,.065,.62,.035,signal.bust?RED:AMBER,level*(.38+.15*Math.sin(t*3)));
    }
    if(signal.transfer>.02){
      glassRect(ctx,.075,.85,.84,.035,'#032b22',.8);
      glassRect(ctx,.075,.85,.84*Math.min(1,((t*1.1)%1+.15)),.035,TEAL,signal.transfer*.85);
    }
    if(signal.bust){
      const row=Math.floor(t*5)%6;glassRect(ctx,0,.14*row,1,.022,RED,.30*signal.power);
    }
    if(signal.power<1){glassRect(ctx,0,0,1,1,'#020b0a',(1-signal.power)*.96);}
    ctx.restore();
    glow(ctx,729,365,48,TEAL,(.022+load*.075)*signal.power);
  }
  function lamps(ctx,t,risk) {
    [[163,332,49],[474,278,55],[1114,290,56],[1440,516,51]].forEach(([x,y,r],i)=>{
      const breath=.75+.1*Math.sin(t*.9+i*1.7)+.025*Math.sin(t*3.4+i);
      glow(ctx,x,y,r,AMBER,.06*breath);
    });
    const load=Math.max(signal.activity,signal.overclock,signal.node*.8,signal.transfer*.5);
    ctx.save();polygon(ctx,COIL);ctx.clip();
    if(load>.01){ctx.globalCompositeOperation='screen';ctx.globalAlpha=load*.24*signal.power;ctx.drawImage(art,0,0,W,H);ctx.globalCompositeOperation='source-over';}
    for(let i=0;i<11;i++){
      const alpha=(.025+load*.23)*(.5+.5*Math.sin(t*(4+signal.overclock*5)-i*.55));
      ctx.globalAlpha=alpha*signal.power;ctx.fillStyle='#ffe3a8';ctx.fillRect(688+i*6,523,2,64);
    }
    if(signal.cooler){ctx.globalAlpha=signal.cooler*.08;ctx.fillStyle=TEAL;ctx.fill();}
    if(signal.power<1){ctx.globalAlpha=(1-signal.power)*.92;ctx.fillStyle='#100c07';ctx.fillRect(680,525,85,56);}
    ctx.restore();
    glow(ctx,723,553,60,AMBER,(.025+load*.20)*signal.power);
    // The real camera lens is the warning emitter; no unmotivated spotlight cone.
    const alarm=risk>.55?(.4+.6*(.5+.5*Math.sin(t*2.6)))*(risk-.35):.12;
    glow(ctx,1374,122,38,RED,alarm*.13);pixel(ctx,1372,119,3,RED,.25+alarm*.3);
  }
  function cablePackets(ctx,t) {
    const activity=Math.max(signal.activity,signal.overclock*.65,signal.node,signal.transfer,signal.proxy);
    CONTACTS.forEach((contacts,route)=>contacts.forEach(([x,y],i)=>{
      // Coupling highlights run along the actual cable. Nothing flies across open space.
      const phase=(t*(.55+activity*.75)+route*.31)%1,focus=phase*(contacts.length+2)-1;
      const a=Math.max(0,1-Math.abs(i-focus))* (.12+activity*.5)*signal.power;
      if(a>.01){pixel(ctx,x,y,2,route===0?AMBER:TEAL,a);pixel(ctx,x+2,y-1,1,route===0?AMBER:TEAL,a*.7);}
    }));
  }
  function serverLights(ctx,t,risk) {
    const load=Math.max(signal.activity,signal.overclock,signal.node,signal.proxy,signal.transfer);
    const selfTests=EMISSION_REGIONS.map((_,i)=>i<3?maintenancePhase(t,17.9+i*3.7,3.1+i*8.3,1.8):-1);
    for(const run of emissiveRuns){
      const rate=signal.transfer?11:1.3+load*3.3;
      const cycle=.5+.5*Math.sin(t*rate+run.region*2.9+run.row*.8);
      const dim=.12+.33*(1-cycle);
      ctx.fillStyle='#021713';ctx.globalAlpha=signal.power<1?.96*(1-signal.power):dim;ctx.fillRect(run.x,run.y,run.w,1);
      const sweep=signal.node?Math.max(0,1-Math.abs(run.row-((t*6)%13)))*signal.node:0;
      let color=TEAL,alpha=(cycle*.10+load*.22+sweep*.32)*signal.power;
      const test=selfTests[run.region];
      if(test>=0&&load<.35){
        // An individual rack acknowledges rows in sequence on its original LED pixels.
        const rowCount=run.region===2?8:13;
        const rowPass=Math.max(0,1-Math.abs(run.row-test*(rowCount+1)));
        alpha=Math.max(alpha,rowPass*.56*signal.power);
      }
      if(run.region===4&&signal.ghost){alpha=.22+signal.ghost*.50;}
      if(run.region===3&&risk>.7&&run.row===0){color=RED;alpha=.2+.24*(.5+.5*Math.sin(t*3));}
      if(run.region===6&&signal.transfer){alpha=.30+signal.transfer*.48;}
      if(signal.bust){color=RED;alpha=.3*signal.power;}
      ctx.fillStyle=color;ctx.globalAlpha=alpha;ctx.fillRect(run.x,run.y,run.w,1);
    }
  }
  function serviceDetails(ctx,t,low) {
    if(signal.power>.5){
      // A tiny double contact spark remains on the real right-hand cable connector.
      const arc=maintenancePhase(t,19.7,12.3,.31);
      if(arc>=0&&((arc<.19)||(arc>.43&&arc<.64))){
        const a=arc<.19?.55:.34;
        pixel(ctx,962,474,2,'#d0ffe1',a);pixel(ctx,964,476,2,TEAL,a*.65);
        if(!low)pixel(ctx,962,477,1,AMBER,a*.55);
      }
    }
    for(let i=0;i<reflectionRuns.length;i++){
      if(low&&i%2)continue;
      const run=reflectionRuns[i];
      const phase=maintenancePhase(t,8.9+run.region*2.6,hash(i+431)*14,1.9);
      if(phase<0)continue;
      const a=Math.pow(Math.sin(phase*Math.PI),3)*.16;
      ctx.fillStyle=AMBER;ctx.globalAlpha=a;ctx.fillRect(run.x,run.y,run.w,1);
    }
  }
  function steam(ctx,t,low) {
    // Only the clearly visible floor vent in the original source emits vapor.
    const count=low?7:15,x=252,y=735,boost=signal.cooler||0;
    for(let i=0;i<count;i++){
      const age=(t*(.19+boost*.08)+i/count)%1;
      const px=x+Math.sin(age*4+i*.83)*5+age*5,py=y-age*(92+boost*19);
      const size=Math.round(2+age*7),alpha=Math.sin(age*Math.PI)*(.055+boost*.085);
      pixel(ctx,Math.round(px/2)*2,Math.round(py/2)*2,size,'#b6c5b4',alpha);
      pixel(ctx,Math.round(px-size*.4),Math.round(py+size*.35),Math.max(2,size-2),'#a7b9ad',alpha*.55);
    }
  }
  function dust(ctx,t,low) {
    for(let i=0;i<(low?8:20);i++){
      const x=hash(i*2)*W+Math.sin(t*.12+i)*7,y=(hash(i*2+1)*H-t*(1+hash(i)*2)+H*100)%H;
      pixel(ctx,x,y,1,AMBER,.06+.06*(.5+.5*Math.sin(t*.65+i)));
    }
  }
  function activeViews() {
    return views.filter(v => {
      if(!v.canvas.isConnected || !v.canvas.getClientRects().length)return false;
      const s=getComputedStyle(v.canvas);if(s.visibility==='hidden'||s.display==='none')return false;
      if(v.canvas.id==='menu-scene' && !['menu','intro'].includes(state.screen))return false;
      if(v.canvas.id==='relay-scene' && state.screen!=='game')return false;
      if(v.canvas.id==='success-scene' && state.screen!=='success')return false;
      if(v.canvas.id==='busted-scene' && state.screen!=='busted')return false;
      return true;
    });
  }
  function animateAllowed() {return !document.hidden&&!miniScreens.has(state.screen)&&!state.reducedMotion&&state.effectsLevel!=='off'&&captureTime===null;}
  function draw(view,t,isStatic=false) {
    const c=view.ctx,canvas=view.canvas,rect=canvas.getBoundingClientRect();
    const width=Math.max(1,Math.round(rect.width||Number(canvas.getAttribute('width'))||420));
    const height=Math.max(1,Math.round(rect.height||Number(canvas.getAttribute('height'))||150));
    // Native canvas pixels deliberately stay constant at 100–200% Windows scale.
    if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
    c.setTransform(1,0,0,1,0,0);c.globalAlpha=1;c.globalCompositeOperation='source-over';c.fillStyle='#071112';c.fillRect(0,0,width,height);
    if(!art.complete || !art.naturalWidth)return;
    const scale=Math.max(width/W,height/H),ox=(width-W*scale)*.5,oy=(height-H*scale)*.48;
    c.save();c.translate(ox,oy);c.scale(scale,scale);c.imageSmoothingEnabled=false;c.drawImage(art,0,0,W,H);
    const terminal=terminalScreens.has(state.screen);
    visualState=terminal&&terminalSnapshot?terminalSnapshot:state;
    const risk=clamp(Number(visualState.risk||0)/100,0,1), low=state.effectsLevel==='low';
    const ambientTime=terminal?t*.42:t;
    signal=readEffects(t);
    // Art, masks and effects share one transform: no crop jitter or drifting registration.
    c.globalCompositeOperation='source-over';
    lamps(c,ambientTime,risk);crt(c,ambientTime);fan(c,ambientTime);serverLights(c,ambientTime,risk);
    if(!isStatic){
      cablePackets(c,ambientTime);steam(c,ambientTime,low);dust(c,ambientTime,low);serviceDetails(c,ambientTime,low);
    }
    c.save();c.globalAlpha=1;
    window.RelayPets?.draw?.(c,ambientTime,{risk,signal,low,isStatic,terminal,screen:state.screen});
    window.RelayLife?.draw?.(c,ambientTime,{risk,signal,low,isStatic,terminal,screen:state.screen});
    c.restore();
    if(!isStatic){
      for(const p of particles){const age=t-p.born,f=1-age/p.life;if(f<=0||age<0)continue;pixel(c,p.x+p.vx*age,p.y+p.vy*age+age*age*p.gravity,p.size,p.color,clamp(f,0,1)*.9);}
    }
    c.restore();c.globalAlpha=1;c.globalCompositeOperation='source-over';
    const shade=c.createLinearGradient(0,0,0,height);shade.addColorStop(0,'rgba(0,6,10,.12)');shade.addColorStop(.45,'transparent');shade.addColorStop(1,'rgba(0,6,10,.35)');
    c.fillStyle=shade;c.fillRect(0,0,width,height);
  }
  function render(time) {
    raf=0;if(disposed)return;
    const active=activeViews();if(!active.length||document.hidden||miniScreens.has(state.screen)){previous=0;fps=0;sampleStart=0;measuredFrames=0;return;}
    const staticFrame=!animateAllowed();
    if(!staticFrame){clock+=previous?Math.min(.05,(time-previous)/1000):0;previous=time;}else previous=0;
    const t=captureTime===null?(staticFrame?2:clock):captureTime;
    if(!staticFrame||captureTime!==null){particles=particles.filter(p=>t-p.born<p.life);pulses=pulses.filter(p=>t-p.start<p.life);}
    active.forEach(v=>draw(v,t,staticFrame&&captureTime===null));frames++;
    if(staticFrame){fps=0;measuredFrames=0;sampleStart=0;}
    else {
      if(!sampleStart)sampleStart=time;
      measuredFrames++;
      if(time-sampleStart>=1000){fps=Math.round(measuredFrames*1000/(time-sampleStart));measuredFrames=0;sampleStart=time;}
    }
    if(!staticFrame)raf=requestAnimationFrame(render);
  }
  function requestFrame(){if(!disposed&&!raf)raf=requestAnimationFrame(render);}
  function burst(color,count=3){
    const now=captureTime===null?clock:captureTime;
    for(let i=0;i<count&&particles.length<MAX_PARTICLES;i++){
      const a=rng()*TAU, speed=9+rng()*18;
      particles.push({x:764+(rng()-.5)*3,y:568+(rng()-.5)*3,vx:Math.cos(a)*speed,vy:-9-rng()*15,life:.12+rng()*.24,born:now,size:1+rng()*.8,color,gravity:30});
    }
  }
  function emit(event={}) {
    if(disposed)return;
    window.RelayLife?.emit?.(event);
    if(event.type==='transfer'||event.type==='bust') {
      terminalSnapshot={...state,...event};
      // A terminal animation belongs to its own result scene, never the next run.
      particles=[];pulses=[];
    }
    if(disposed||state.reducedMotion||state.effectsLevel==='off')return;
    const now=captureTime===null?clock:captureTime, type=event.type;
    let effectType=type,color=TEAL,life=1.1,count=0;
    if(type==='hack'){color=event.hackType===3?AMBER:TEAL;count=event.hackType===3?3:0;life=.8;}
    else if(type==='bonus'){
      effectType=event.bonusId===1?'cooler':event.bonusId===4?'ghost':'bonus';
      color=event.bonusId===1?'#bcffff':event.bonusId===6?TEAL:AMBER;life=1.5;
    } else if(type==='node'||type==='prestige'){color=AMBER;life=1.8;}
    else if(type==='transfer'){life=2.3;}
    else if(type==='bust'){color=RED;life=2.6;count=4;}
    else if(type==='ghost-save'){life=1.7;}
    else if(type==='minigame-fail'){color=RED;life=1.1;}
    else if(type==='achievement'){color=AMBER;life=1.7;}
    else if(type!=='minigame-success')return;
    if(pulses.length>=12)pulses.shift();pulses.push({type:effectType,start:now,life,color,hackType:event.hackType,bonusId:event.bonusId});
    if(count)burst(color,state.effectsLevel==='low'?Math.ceil(count*.35):count);requestFrame();
  }
  function setState(next={}) {
    if(terminalScreens.has(state.screen)&&next.screen&&!terminalScreens.has(next.screen)) {
      particles=[];pulses=[];terminalSnapshot=null;
    }
    state={...state,...next};
    window.RelayLife?.setState?.(state);
    window.RelayPets?.setState?.(state);
    if(state.reducedMotion||state.effectsLevel==='off'){particles=[];pulses=[];}
    if(!animateAllowed()&&raf){cancelAnimationFrame(raf);raf=0;previous=0;}
    requestFrame();
  }
  const onState=e=>setState(e.detail||{}),onEvent=e=>emit(e.detail||{});
  const onVisibility=()=> {previous=0;if(document.hidden&&raf){cancelAnimationFrame(raf);raf=0;fps=0;sampleStart=0;measuredFrames=0;}else requestFrame();};
  const onResize=()=>requestFrame();
  let observer=null;
  function init() {
    if(disposed)return;
    views=Array.from(document.querySelectorAll('[data-relay-scene]')).map(canvas=>({canvas,ctx:canvas.getContext('2d',{alpha:false})})).filter(v=>v.ctx);
    views.forEach(v=>{v.canvas.setAttribute('aria-hidden','true');v.canvas.style.imageRendering='pixelated';});
    observer=new MutationObserver(()=>requestFrame());observer.observe(document.body,{attributes:true,subtree:true,attributeFilter:['class','hidden']});
    requestFrame();
  }
  window.BlacksiteScene={
    setState,emit,setReducedMotion:value=>setState({reducedMotion:Boolean(value)}),
    setQuality:value=>setState({effectsLevel:['full','low','off'].includes(value)?value:'full'}),
    setCaptureTime:value=>{captureTime=value===null?null:Math.max(0,Number(value)||0);previous=0;requestFrame();},
    getDiagnostics:()=>Object.freeze({fps,frames,particles:particles.length,particleLimit:MAX_PARTICLES,activeEffects:pulses.length,registeredLightRuns:emissiveRuns.length,registeredReflectionRuns:reflectionRuns.length,canvases:views.length,activeCanvases:activeViews().length,rafActive:Boolean(raf),time:clock,captureTime,reducedMotion:state.reducedMotion,quality:state.effectsLevel,screen:state.screen,terminalType:terminalSnapshot?.type||null,artLoaded:art.complete&&Boolean(art.naturalWidth)}),
    dispose:()=>{disposed=true;if(raf)cancelAnimationFrame(raf);raf=0;observer?.disconnect();particles=[];pulses=[];views=[];window.RelayLife?.dispose?.();window.RelayPets?.dispose?.();document.removeEventListener('risk:state',onState);document.removeEventListener('risk:event',onEvent);document.removeEventListener('visibilitychange',onVisibility);window.removeEventListener('resize',onResize);}
  };
  document.addEventListener('risk:state',onState);document.addEventListener('risk:event',onEvent);document.addEventListener('visibilitychange',onVisibility);window.addEventListener('resize',onResize);
  art.addEventListener('load',()=>{registerEmissions();requestFrame();});art.addEventListener('error',requestFrame);
  if(art.complete&&art.naturalWidth)registerEmissions();
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();


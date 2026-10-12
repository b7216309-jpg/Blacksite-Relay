/* Original secret props. Read-only drawing; game and puzzle timing belong to RelayEasterEggs. */
(() => {
  'use strict';
  if (window.RelaySecretRooms) return;
  const W = 1536, H = 1024;
  const layout = Object.freeze({
    locker: Object.freeze({ x: 1350, y: 416, w: 64, h: 248 }),
    guideHostSelector: '.guide-hero',
    guideLEDs: Object.freeze([232, 250, 268, 286].map(x => Object.freeze({ x, y: 100, w: 16, h: 18 }))),
    guideArcade: Object.freeze({ x: 342, y: 35, w: 48, h: 87 })
  });
  const definitions = {
    locker: { path: 'assets/easter-eggs/hidden-locker.png', crop:[272,67,361,1406], nativeSize: [19, 71], noteCrop:[724,1226,176,224], noteSize:[8,10], door: [[337,188],[523,188],[523,1361],[337,1361]].map(([x,y])=>[(x-272)/361,(y-67)/1406]) },
    arcade: { path: 'assets/easter-eggs/room404-arcade.png', crop:[211,57,700,1281], nativeSize: [48, 87], screen: [[443,428],[661,526],[617,737],[386,634]].map(([x,y])=>[(x-211)/700,(y-57)/1281]) }
  };
  const assets = {}, exporters = new Map();
  const guide = document.createElement('canvas'); guide.width = 420; guide.height = 124; guide.className = 'secret-guide-canvas'; guide.setAttribute('aria-hidden', 'true');
  document.getElementById('guide-art')?.append(guide);
  const guideCtx = guide.getContext('2d'); if (guideCtx) guideCtx.imageSmoothingEnabled = false;
  // The locker is composed and graded off-screen so its tint stays inside its own silhouette.
  const lockerLayer = document.createElement('canvas'); lockerLayer.width = layout.locker.w; lockerLayer.height = layout.locker.h;
  const lockerCtx = lockerLayer.getContext('2d'); if (lockerCtx) lockerCtx.imageSmoothingEnabled = false;
  // Scene-space anchors: the wall lantern right of the locker, and the floor line it stands on.
  const LANTERN = Object.freeze({ x: 1436, y: 506, r: 150 });
  const mini = document.createElement('canvas'); mini.width = 32; mini.height = 24;
  const miniCtx = mini.getContext('2d'); if (miniCtx) miniCtx.imageSmoothingEnabled = false;
  let disposed = false, lockerDraws = 0, guideDraws = 0, guideActive = false, lockerActive = false, lastGuideTime = 0;
  const clamp = value => Math.max(0, Math.min(1, value));
  const smooth = value => { const n = clamp(value); return n * n * (3 - 2 * n); };
  const immutable = value => { if (value && typeof value === 'object') { Object.values(value).forEach(immutable); Object.freeze(value); } return value; };
  const polygon = (c, points) => { c.beginPath(); points.forEach(([x,y], i) => i ? c.lineTo(x,y) : c.moveTo(x,y)); c.closePath(); };
  const scalePoints = (points, width, height) => points.map(([x,y]) => [Math.round(x * width), Math.round(y * height)]);

  function importAsset(asset) {
    // Uniform magenta is an import matte, never modified on disk. Key once, then cache native pixels.
    const raw = document.createElement('canvas'); raw.width = asset.image.naturalWidth; raw.height = asset.image.naturalHeight;
    const c = raw.getContext('2d', { willReadFrequently: true });
    if (!c) throw new Error('2D import context unavailable');
    c.drawImage(asset.image, 0, 0);
    const pixels = c.getImageData(0, 0, raw.width, raw.height), bytes = pixels.data;
    let left = raw.width, top = raw.height, right = -1, bottom = -1, keyed = 0;
    for (let y = 0; y < raw.height; y++) for (let x = 0; x < raw.width; x++) {
      const i = (y * raw.width + x) * 4, r = bytes[i], g = bytes[i+1], b = bytes[i+2];
      if (r > g + 12 && b > g + 12) { bytes[i+3] = 0; keyed++; }
      if (bytes[i+3] > 16) { left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y); }
    }
    if (right < left || bottom < top) throw new Error('No visible prop pixels');
    c.putImageData(pixels, 0, 0);
    const texture = document.createElement('canvas'); [texture.width, texture.height] = asset.definition.nativeSize;
    const target = texture.getContext('2d'); if (!target) throw new Error('2D texture context unavailable');
    target.imageSmoothingEnabled = false;
    asset.crop = asset.definition.crop.slice();
    target.drawImage(raw, ...asset.crop, 0, 0, texture.width, texture.height);
    if (asset.definition.noteCrop) {
      const note = document.createElement('canvas'); [note.width,note.height] = asset.definition.noteSize;
      const nc = note.getContext('2d'); if (nc) { nc.imageSmoothingEnabled = false; nc.drawImage(raw,...asset.definition.noteCrop,0,0,note.width,note.height); asset.noteTexture = note; }
    }
    asset.texture = texture; asset.keyedPixels = keyed; asset.ready = true;
  }
  for (const [name, definition] of Object.entries(definitions)) {
    const image = new Image(), asset = { definition, image, ready: false, error: null, crop: null, texture: null, keyedPixels: 0 };
    assets[name] = asset;
    image.onload = () => {
      if (disposed) return;
      try { importAsset(asset); } catch (error) { asset.error = String(error.message || error); }
      window.RiskPresentation?.refresh?.();
    };
    image.onerror = () => { asset.error = 'Asset could not load'; };
    image.src = definition.path;
  }

  function drawLocker(c, time = 0, options = {}, secret = {}) {
    if (disposed || !c || !lockerCtx || !assets.locker.ready || (options.screen && options.screen !== 'game')) return;
    const asset = assets.locker, { x,y,w,h } = layout.locker, l = lockerCtx;
    const isStatic = !!(options.isStatic || secret.isStatic), elapsed = Math.max(0, Number(secret.elapsed) || 0);
    const opening = secret.active ? isStatic ? 1 : smooth((elapsed-.15)/.65) * smooth(((secret.duration || 7)-elapsed)/.65) : 0;
    if (options.record !== false) { lockerActive = !!secret.active; lockerDraws++; }
    l.setTransform(1,0,0,1,0,0); l.globalAlpha = 1; l.globalCompositeOperation = 'source-over'; l.clearRect(0,0,w,h);
    l.drawImage(asset.texture, 0, 0, w, h);
    // The frame never moves: a shallow brushed-metal cover opens inside the registered door well.
    const door = scalePoints(asset.definition.door, w, h);
    l.save(); polygon(l, door); l.clip();
    const minX = Math.min(...door.map(point=>point[0])), maxX = Math.max(...door.map(point=>point[0]));
    const coverWidth = Math.ceil(minX + (maxX-minX) * (1-opening));
    if (coverWidth > minX) {
      const metal = l.createLinearGradient(minX, 0, coverWidth, 0);
      metal.addColorStop(0, '#16201f'); metal.addColorStop(.55, '#1f2a27'); metal.addColorStop(1, '#141b1a');
      l.fillStyle = metal; l.fillRect(minX, 0, coverWidth-minX, h);
      l.fillStyle = '#0a1110'; for (const seam of [.18,.47,.79]) l.fillRect(minX, Math.round(h*seam), coverWidth-minX, 1);
      l.fillStyle = '#34413a'; for (const seam of [.18,.47,.79]) l.fillRect(minX, Math.round(h*seam)+1, coverWidth-minX, 1);
      l.fillStyle = '#0d1514'; for (let vy = Math.round(h*.06); vy < h*.14; vy += 3) l.fillRect(minX+3, vy, Math.max(0,coverWidth-minX-6), 1);
      l.fillStyle = '#3b453c'; l.fillRect(Math.max(minX,coverWidth-3), 0, 2, h);
      l.fillStyle = '#9b8558'; l.fillRect(Math.max(minX,coverWidth-9), Math.round(h*.54), 3, 15);
    }
    l.restore();
    // Three worn lens marks hint at short / short / long; they stay on the existing light bank.
    const px = w/19, py = h/71; l.fillStyle = '#baa26b'; l.globalAlpha = .65;
    l.fillRect(px,py*32,px,py); l.fillRect(px,py*34,px,py); l.fillRect(px,py*36,px*2,py); l.globalAlpha = 1;
    // Grade into the room: sink the cold paint into the ambient, occlude the base,
    // then let the neighbouring lantern warm the near edge. Pixels outside the prop stay untouched.
    l.globalCompositeOperation = 'source-atop';
    l.fillStyle = 'rgba(12,10,8,.38)'; l.fillRect(0,0,w,h);
    const occlusion = l.createLinearGradient(0,0,0,h);
    occlusion.addColorStop(0,'rgba(4,6,6,.28)'); occlusion.addColorStop(.25,'rgba(4,6,6,0)'); occlusion.addColorStop(.78,'rgba(4,6,6,0)'); occlusion.addColorStop(1,'rgba(4,6,6,.5)');
    l.fillStyle = occlusion; l.fillRect(0,0,w,h);
    const flicker = isStatic ? 1 : .94 + .06 * Math.sin(time * 7.3) * Math.sin(time * 2.1 + 1);
    const warm = l.createRadialGradient(LANTERN.x-x, LANTERN.y-y, 4, LANTERN.x-x, LANTERN.y-y, LANTERN.r);
    warm.addColorStop(0,`rgba(255,168,74,${(.27*flicker).toFixed(3)})`); warm.addColorStop(.45,`rgba(214,120,48,${(.11*flicker).toFixed(3)})`); warm.addColorStop(1,'rgba(214,120,48,0)');
    l.fillStyle = warm; l.fillRect(0,0,w,h);
    l.fillStyle = `rgba(255,186,104,${(.22*flicker).toFixed(3)})`; l.fillRect(w-Math.ceil(px*2),Math.round(h*.12),Math.ceil(px),Math.round(h*.62));
    // The left jamb sits in the rack's shadow; keep it dark so the two silhouettes stay separate.
    l.fillStyle = 'rgba(2,4,4,.45)'; l.fillRect(0,0,Math.ceil(px*1.5),h);
    l.globalCompositeOperation = 'source-over';
    c.save(); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; c.imageSmoothingEnabled = false;
    // Contact shadow on the floor so the cabinet stands on the room instead of floating over it.
    const contact = c.createRadialGradient(x+w*.46, y+h-3, 2, x+w*.46, y+h-3, w*.85);
    contact.addColorStop(0,'rgba(2,4,4,.62)'); contact.addColorStop(.6,'rgba(2,4,4,.28)'); contact.addColorStop(1,'rgba(2,4,4,0)');
    c.save(); c.translate(0, (y+h-3)*(1-.22)); c.scale(1,.22); c.fillStyle = contact; c.fillRect(x-w*.5, y+h-3-w, w*2, w*2); c.restore();
    c.drawImage(lockerLayer, x, y);
    if (secret.active && asset.noteTexture) {
      const slip = isStatic ? 1 : smooth((elapsed-1.5)/.55) * smooth(((secret.duration||7)-elapsed)/.65);
      if (slip > 0) { c.save(); c.translate(x,y); c.beginPath(); c.rect(0,h*.92,w,h*.3); c.clip(); c.drawImage(asset.noteTexture,w*.2,h*(.86+slip*.1),8*px,10*py); c.restore(); }
    }
    c.restore();
  }
  function paintMini(time, isStatic) {
    if (!miniCtx) return;
    const c = miniCtx; c.clearRect(0,0,32,24); c.fillStyle = '#051518'; c.fillRect(0,0,32,24);
    c.fillStyle = '#21413d'; c.fillRect(3,7,5,13); c.fillRect(24,7,5,13); c.fillRect(11,4,10,17);
    c.fillStyle = '#4d8c79'; c.fillRect(12,5,8,1); c.fillRect(4,8,3,1); c.fillRect(25,8,3,1);
    c.fillStyle = '#8cdbbd'; c.fillRect(13,7,6,5);
    c.fillStyle = '#183e38'; c.fillRect(14,8,4,1); c.fillRect(14,10,2,1);
    c.fillStyle = '#c79956'; c.fillRect(13,15,6,3); c.fillStyle = '#f0c47b'; c.fillRect(15,15,2,3);
    c.fillStyle = '#568f7f';
    for (let y=11;y<19;y+=3) { c.fillRect(4,y,2,1); c.fillRect(25,y,2,1); }
    c.fillRect(7,21,18,1); c.fillRect(8,19,1,3); c.fillRect(23,19,1,3);
    if (!isStatic) { const x = 8 + Math.floor(time*3)%16; c.fillStyle = '#a8cfaa'; c.fillRect(x,21,1,1); }
  }
  function paintGuide(c, time, options, state) {
    c.clearRect(0,0,420,124);
    if (disposed) return;
    const isStatic = !!options.isStatic, progress = Math.max(0, Math.min(4, state.ledProgress || 0));
    c.save(); c.imageSmoothingEnabled = false;
    // A short plugged cable and four small lenses sit under the existing briefing monitor.
    c.strokeStyle = '#061214'; c.lineWidth = 4; c.beginPath(); c.moveTo(255,103); c.lineTo(255,111); c.lineTo(326,111); c.lineTo(330,107); c.stroke();
    c.strokeStyle = '#38504a'; c.lineWidth = 1; c.beginPath(); c.moveTo(255,103); c.lineTo(255,110); c.lineTo(325,110); c.lineTo(329,106); c.stroke();
    for (let i=0;i<4;i++) {
      const x = layout.guideLEDs[i].x + 23 + 6;
      c.fillStyle = '#142a2c'; c.fillRect(x-2,104,8,8); c.fillStyle = '#55756a'; c.fillRect(x-1,105,6,1);
      const lit = progress > i || (state.lastLed === i && progress > 0);
      c.fillStyle = lit ? '#dfbd75' : '#52867a'; c.fillRect(x,107,4,2);
    }
    const room = state.room404 || {};
    if (room.active && assets.arcade.ready) {
      const {x,y,w,h} = layout.guideArcade;
      const elapsed = Math.max(0, Number(room.elapsed)||0), reveal = isStatic || room.isStatic ? 1 : smooth(elapsed/.5);
      c.save(); c.beginPath(); c.rect(x-1,y-1,w+2,Math.ceil((h+2)*reveal)); c.clip();
      c.drawImage(assets.arcade.texture,x,y,w,h);
      paintMini(time, isStatic || room.isStatic);
      const points = assets.arcade.definition.screen.map(([px,py]) => [Math.round(x+px*w),Math.round(y+py*h)]);
      if (miniCtx) { c.save(); polygon(c,points); c.clip(); const [a,b,,d] = points; c.transform((b[0]-a[0])/32,(b[1]-a[1])/32,(d[0]-a[0])/24,(d[1]-a[1])/24,a[0],a[1]); c.drawImage(mini,0,0); c.restore(); }
      c.fillStyle = '#08171b'; c.fillRect(x+20,y+h-12,28,10); c.fillStyle = '#d8cc9f'; c.font = '8px Consolas,monospace'; c.fillText('404',x+25,y+h-4);
      c.restore();
    }
    c.restore();
  }
  function drawGuide(time = 0, options = {}) {
    if (disposed) return;
    const active = !document.hidden && document.getElementById('screen-tutorial')?.style.display === 'flex' && document.getElementById('screen-tutorial')?.dataset.guideCurrent === 'overview';
    guideActive = active; lastGuideTime = time;
    if (!active) { guideCtx?.clearRect(0,0,420,124); return; }
    window.RelayEasterEggs?.guideFrame?.(time, options);
    const state = window.RelayEasterEggs?.getGuideState?.(time, !!options.isStatic) || {};
    if (guideCtx) { paintGuide(guideCtx,time,options,state); guideDraws++; }
  }
  function getDefinition() { return immutable({ sourceSize: [W,H], layout, matteKey:'r > g + 12 && b > g + 12', assets: Object.fromEntries(Object.entries(assets).map(([name,asset]) => [name,{ path:asset.definition.path, sourceCrop:asset.crop?.slice() || null, nativeSize:asset.definition.nativeSize.slice(), noteCrop:asset.definition.noteCrop?.slice(), noteSize:asset.definition.noteSize?.slice(), door:asset.definition.door?.map(point=>point.slice()), screen:asset.definition.screen?.map(point=>point.slice()) }])) }); }
  function exportFrame(kind, time = 2, options = {}) {
    if (!['locker','guide'].includes(kind) || disposed) return null;
    if (!exporters.has(kind)) { const canvas = document.createElement('canvas'); canvas.width = kind === 'locker' ? W : 420; canvas.height = kind === 'locker' ? H : 124; exporters.set(kind,canvas); }
    const canvas = exporters.get(kind), c = canvas.getContext('2d'); if (!c) return null;
    c.clearRect(0,0,canvas.width,canvas.height);
    if (kind === 'locker') drawLocker(c,time,{screen:'game',...options,record:false},options.secret || {active:true,elapsed:2,duration:7});
    else paintGuide(c,time,options,options.state || {room404:{active:true,elapsed:2,duration:10},ledProgress:4});
    try { return { image:canvas.toDataURL('image/png'),width:canvas.width,height:canvas.height }; } catch (error) { return { error:String(error.message||error) }; }
  }
  function dispose() { if (disposed) return; disposed = true; guide.remove(); guide.width = guide.height = mini.width = mini.height = lockerLayer.width = lockerLayer.height = 0; exporters.clear(); Object.values(assets).forEach(asset => { asset.image.onload = null; asset.image.onerror = null; asset.texture = null; asset.noteTexture = null; }); window.removeEventListener('beforeunload',dispose); }
  window.addEventListener('beforeunload',dispose);
  window.RelaySecretRooms = Object.freeze({ drawLocker, drawGuide, getLayout:()=>layout, getDefinition, exportFrame, dispose,
    getDiagnostics:()=>Object.freeze({ ready:!disposed&&Object.values(assets).every(asset=>asset.ready),disposed,lockerActive:!disposed&&!document.hidden&&window.RiskPresentation?.currentScreen?.()==='game'&&lockerActive,guideActive:!disposed&&!document.hidden&&window.RiskPresentation?.currentScreen?.()==='tutorial'&&document.getElementById('screen-tutorial')?.dataset.guideCurrent==='overview',lastGuideTime,lockerDraws,guideDraws,ownedRAF:0,ownedTimers:0,canvasCount:disposed?0:3+Object.values(assets).filter(asset=>asset.texture).length+Object.values(assets).filter(asset=>asset.noteTexture).length+exporters.size,assets:Object.fromEntries(Object.entries(assets).map(([name,asset])=>[name,{ready:asset.ready,error:asset.error,sourceCrop:asset.crop,keyedPixels:asset.keyedPixels}])) })
  });
})();

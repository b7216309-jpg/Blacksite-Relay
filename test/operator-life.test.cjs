const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const http=require('node:http'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const chrome=process.env.CHROMIUM_EXECUTABLE||[
  chromium.executablePath(),
  path.join(process.env.LOCALAPPDATA||'', 'ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-win64/chrome-headless-shell.exe')
].find(p=>fs.existsSync(p));

test('single-design operator is registered and shares the decorative lifecycle', {skip:!chrome,timeout:30000},async t=>{
  const server=http.createServer((req,res)=>{
    if(req.url==='/'){res.setHeader('Content-Type','text/html');res.end('<style>body{margin:0}canvas{width:420px;height:150px}</style><canvas id="relay-scene" data-relay-scene></canvas><script src="src/relay-life.js"></script><script src="src/relay-scene.js"></script>');return;}
    const file=path.resolve(root,'.'+new URL(req.url,'http://x').pathname);
    if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.writeHead(404).end();return;}
    res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':'image/png');res.end(fs.readFileSync(file));
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));
  const browser=await chromium.launch({executablePath:chrome,headless:true});t.after(()=>browser.close());
  const page=await browser.newPage({viewport:{width:420,height:150}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>RelayLife.getDiagnostics().ready&&BlacksiteScene.getDiagnostics().artLoaded);
  await page.evaluate(()=>{Math.random=()=>{throw Error('Decorative RNG used the game generator');};BlacksiteScene.setState({screen:'game',risk:20});});

  async function inspectSprite(){
    return page.evaluate(async()=>{
      const image=new Image();image.src=RelayLife.exportFrame();await image.decode();
      const c=document.createElement('canvas');c.width=image.width;c.height=image.height;
      const ctx=c.getContext('2d');ctx.drawImage(image,0,0);const p=ctx.getImageData(0,0,c.width,c.height).data;
      const hash=values=>{let h=2166136261;for(const v of values)h=Math.imul(h^v,16777619);return h>>>0;};
      const alphas=[];for(let i=3;i<p.length;i+=4)alphas.push(p[i]);
      return {width:c.width,height:c.height,all:hash(p),alpha:hash(alphas),legs:hash(p.slice(40*c.width*4)),matte:[[22,42],[21,49],[13,58]].map(([x,y])=>p[(y*c.width+x)*4+3])};
    });
  }
  await t.test('one coherent body has fixed legs, stable idle silhouette and a clean matte',async()=>{
    const meta=JSON.parse(fs.readFileSync(path.join(root,'assets/scene/relay-operator.json'),'utf8'));
    assert.equal(meta.frames.length,1);assert.equal(meta.version,2);
    let first;
    for(const [time,pose]of [[0,'idle'],[2.083333,'idle'],[3.75,'idle'],[8.1,'diagnostics'],[18.5,'glance'],[19.5,'glance']]){
      await page.evaluate(t=>BlacksiteScene.setCaptureTime(t),time);await page.waitForTimeout(30);
      const d=await page.evaluate(()=>RelayLife.getDiagnostics());assert.equal(d.pose,pose);assert.deepEqual(d.foot,meta.foot);
      const sprite=await inspectSprite();
      assert.deepEqual([sprite.width,sprite.height],[36,72]);assert.deepEqual(sprite.matte,[0,0,0]);
      if(!first)first=sprite;
      assert.equal(sprite.legs,first.legs,'hips, trousers and boots cannot be redrawn between gestures');
      if(pose==='idle')assert.equal(sprite.alpha,first.alpha,'idle shading cannot shift the silhouette');
      else assert.notEqual(sprite.all,first.all,'the selected gesture must have a visible change');
    }
    const before=await page.evaluate(()=>({image:RelayLife.exportFrame(),count:RelayLife.getDiagnostics().generatedFrames}));
    await page.evaluate(()=>BlacksiteScene.setCaptureTime(19.5));await page.waitForTimeout(30);
    assert.deepEqual(await page.evaluate(()=>({image:RelayLife.exportFrame(),count:RelayLife.getDiagnostics().generatedFrames})),before);
    assert.equal(await page.evaluate(()=>RelayLife.getDiagnostics().frameCount),1);
  });

  await t.test('reduced motion, static scenes and all protocols stop character animation',async()=>{
    await page.evaluate(()=>BlacksiteScene.setCaptureTime(null));
    for(const mode of ['reduced','off','typing','backdoor','bypass']){
      await page.evaluate(mode=>BlacksiteScene.setState({screen:['reduced','off'].includes(mode)?'game':mode,reducedMotion:mode==='reduced',effectsLevel:mode==='off'?'off':'full'}),mode);
      await page.waitForTimeout(40);const before=await page.evaluate(()=>RelayLife.getDiagnostics());await page.waitForTimeout(100);const after=await page.evaluate(()=>RelayLife.getDiagnostics());
      assert.equal(after.draws,before.draws,mode);assert.equal(after.ownTimers,0);assert.equal(after.ownAnimationFrames,0);
      if(['reduced','off'].includes(mode))assert.equal(after.pose,'idle');
    }
  });
  await t.test('disposing the scene releases character textures and stops drawing',async()=>{
    await page.evaluate(()=>BlacksiteScene.dispose());const d=await page.evaluate(()=>RelayLife.getDiagnostics());assert.equal(d.disposed,true);assert.equal(d.frameCount,0);assert.equal(d.ready,false);assert.deepEqual(errors,[]);
  });
});

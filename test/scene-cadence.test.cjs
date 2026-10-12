'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../src/relay-scene.js'),'utf8');

function fixture(){
 const callbacks=new Map(),listeners=new Map();let serial=0;
 const context={setTransform(){},fillRect(){}};
 const canvas={id:'relay-scene',isConnected:true,style:{},width:420,height:150,getClientRects:()=>[{}],getBoundingClientRect:()=>({width:420,height:150}),getContext:()=>context,setAttribute(){},getAttribute:()=>null};
 const document={readyState:'complete',hidden:false,body:{},querySelectorAll:()=>[canvas],addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:name=>listeners.delete(name)};
 const window={addEventListener(){},removeEventListener(){}};
 const sandbox={window,document,Image:class{complete=false;naturalWidth=0;addEventListener(){}},MutationObserver:class{observe(){}disconnect(){}},getComputedStyle:()=>({display:'block',visibility:'visible'}),requestAnimationFrame:fn=>{callbacks.set(++serial,fn);return serial;},cancelAnimationFrame:id=>callbacks.delete(id),Math:Object.assign(Object.create(Math),{random(){throw Error('Decoration consumed gameplay randomness');}})};
 vm.runInNewContext(source,sandbox,{filename:'relay-scene.js'});
 window.BlacksiteScene.setState({screen:'game'});
 return {scene:window.BlacksiteScene,document,callbacks,visibility(){listeners.get('visibilitychange')();},tick(stamp){const pending=[...callbacks.values()];callbacks.clear();pending.forEach(fn=>fn(stamp));}};
}

test('decorative scene keeps a 60 fps ceiling and elapsed time at 60/120/144/240 Hz',()=>{
 for(const hz of [60,120,144,240]){
  const f=fixture(),duration=10;
  for(let i=0;i<=hz*duration;i++)f.tick(Math.round((1000+i*1000/hz)*10)/10);
  const stats=f.scene.getDiagnostics();
  assert.ok(stats.frames>=600&&stats.frames<=602,`${hz} Hz: ${stats.frames} paints`);
  assert.ok(Math.abs(stats.time-duration)<.002,`${hz} Hz elapsed time drifted: ${stats.time}`);
  assert.equal(stats.paintFrameLimit,60);assert.equal(f.callbacks.size,1);
  f.scene.dispose();assert.equal(f.callbacks.size,0);
 }
});

test('small refresh jitter does not halve cadence and slow refreshes do not accelerate time',()=>{
 for(const hz of [30,60,144]){
  const f=fixture();
  for(let i=0;i<=hz*10;i++)f.tick(1000+i*1000/hz+(i%2?.16:-.16));
  const stats=f.scene.getDiagnostics(),expected=Math.min(hz,60)*10;
  assert.ok(Math.abs(stats.frames-(expected+1))<=2,`${hz} Hz jitter: ${stats.frames} paints`);
  assert.ok(Math.abs(stats.time-10)<.002);f.scene.dispose();
 }
});

test('capture frames and screen changes bypass the paint deadline; static/hidden/protocol remain stopped',()=>{
 const f=fixture();f.tick(1000);assert.equal(f.scene.getDiagnostics().frames,1);
 f.tick(1004);assert.equal(f.scene.getDiagnostics().frames,1);
 f.scene.setCaptureTime(9);f.tick(1005);assert.equal(f.scene.getDiagnostics().frames,2);assert.equal(f.callbacks.size,0);
 f.scene.setCaptureTime(9.1);f.tick(1006);assert.equal(f.scene.getDiagnostics().frames,3);
 f.scene.setCaptureTime(null);f.tick(1007);
 f.scene.setState({screen:'bypass'});f.tick(1008);const paused=f.scene.getDiagnostics();assert.equal(f.callbacks.size,0);
 f.scene.setState({screen:'game'});f.tick(1009);assert.equal(f.scene.getDiagnostics().frames,paused.frames+1);
 for(const prefs of [{reducedMotion:true,effectsLevel:'full'},{reducedMotion:false,effectsLevel:'off'}]){
  f.scene.setState(prefs);f.tick(1010);const count=f.scene.getDiagnostics().frames;f.tick(2000);assert.equal(f.scene.getDiagnostics().frames,count);assert.equal(f.callbacks.size,0);
 }
 f.scene.setState({effectsLevel:'full'});f.tick(2100);f.document.hidden=true;f.visibility();assert.equal(f.callbacks.size,0);
 f.document.hidden=false;f.visibility();f.tick(9999);assert.equal(f.scene.getDiagnostics().time,paused.time);
 f.scene.dispose();
});

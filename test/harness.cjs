const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname,'..');
const reference = path.join(__dirname,'fixtures','baseline-renderer.js');
const current = path.join(root,'renderer.js');
const tracked = ['money','risk','totalMoney','multiplier','streakCounter','nodesHacked','nodesValidated','insuranceTurns','coolerPurchases','proxyPurchases','ghostPurchases','ghostShieldActive','ghostCooldown','overclockCooldown','overclockBonusTurns','gambleCooldown','bypassCharge','bypassLevel','bypassSpeed','bypassTolerance','typingActive','typingStarted','typingErrors','backdoorActive','backdoorStarted','backdoorClicked','backdoorErrors','prestigeLevel','prestigePoints','pUpgrades','achievements','achievementStats','sessionStats'];
function harness(baseline=false, random=[]) {
  const elements=new Map(), rafs=new Map(), timers=new Map(), events=[], saves=[];
  let serial=1, randomCalls=0, currentTime=0;
  function element(id='') {
    const classes=new Set();
    const e={id,tagName:'DIV',hidden:false,disabled:false,style:{display:'none'},dataset:{},children:[],textContent:'',value:'',_html:'',className:'',offsetHeight:650,
      classList:{add(...a){a.forEach(v=>classes.add(v));},remove(...a){a.forEach(v=>classes.delete(v));},toggle(k,v){const on=v??!classes.has(k);on?classes.add(k):classes.delete(k);return on;},contains:k=>classes.has(k)},
      addEventListener(){},removeEventListener(){},setAttribute(k,v){this[k]=v;},getAttribute(k){return this[k];},appendChild(child){this.children.push(child);child.parentElement=this;return child;},remove(){},focus(){document.activeElement=this;},querySelector:sel=>get(id+sel),querySelectorAll:()=>[],getBoundingClientRect:()=>({x:0,y:0,width:420,height:650}),
      get innerHTML(){return this._html;},set innerHTML(v){this._html=v;this.children=[];}
    };
    return e;
  }
  function get(id){if(!elements.has(id))elements.set(id,element(id));return elements.get(id);}
  const handlers={};
  const document={getElementById:get,querySelector:sel=>get(sel),querySelectorAll:sel=>sel==='#total-money-display'?[get('total-money-display')]:[],createElement:tag=>{const e=element();e.tagName=tag.toUpperCase();return e;},createTextNode:text=>({textContent:text}),activeElement:null,body:get('body'),addEventListener:(type,fn)=>{(handlers[type]??=[]).push(fn);},removeEventListener(){},dispatchEvent:e=>{events.push(e);(handlers[e.type]||[]).forEach(fn=>fn(e));}};
  for(let n=1;n<=6;n++)get('price-'+n).parentElement=element('bonus-'+n);
  const math=Object.create(Math);math.random=()=>{randomCalls++;return random.length?random.shift():.99;};
  class Audio {constructor(){this.volume=.5;this.paused=true;}cloneNode(){return new Audio();}addEventListener(){}play(){this.paused=false;return Promise.resolve();}}
  class FixedDate extends Date { static now(){return 1788594000000;} }
  const context={document,console,Audio,Math:math,Set,Map,Date,Promise,Object,Array,Number,String,JSON,Infinity,performance:{now:()=>currentTime},getComputedStyle:e=>({display:e.style.display}),CustomEvent:class{constructor(type,args={}){this.type=type;this.detail=args.detail;}},Event:class{constructor(type){this.type=type;}},MutationObserver:class{observe(){}disconnect(){}},setTimeout:fn=>{const id=serial++;timers.set(id,fn);return id;},clearTimeout:id=>timers.delete(id),setInterval:fn=>{const id=serial++;timers.set(id,fn);return id;},clearInterval:id=>timers.delete(id),requestAnimationFrame:fn=>{const id=serial++;rafs.set(id,fn);return id;},cancelAnimationFrame:id=>rafs.delete(id),addEventListener(){},dispatchEvent(){},matchMedia:()=>({matches:false}),electronAPI:{saveGame:data=>{saves.push(JSON.parse(JSON.stringify(data)));return Promise.resolve(true);},loadGame:async()=>null,submitScore:async()=>'OK',getLeaderboard:async()=>'{"scope":"local","metric":"best-bank-balance","limit":10,"entries":[]}',closeApp(){}}};
  context.Date=FixedDate;
  context.window=context;
  vm.createContext(context);
  if(!baseline)vm.runInContext(fs.readFileSync(path.join(root,'src/save-schema.js'),'utf8'),context);
  if(!baseline)vm.runInContext(fs.readFileSync(path.join(root,'src/quit-flow.js'),'utf8'),context);
  vm.runInContext(fs.readFileSync(baseline?reference:current,'utf8'),context);
  if(!baseline)vm.runInContext(fs.readFileSync(path.join(root,'src/presentation.js'),'utf8'),context);
  if(!baseline)vm.runInContext('window.RiskSaveLoading=false;document.body.inert=false;',context);
  vm.runInContext(`moneyFill=document.getElementById('money-fill');riskFill=document.getElementById('risk-fill');nodeFill=document.getElementById('node-fill');moneyText=document.getElementById('money-text');riskText=document.getElementById('risk-text');nodeText=document.getElementById('node-text');totalMoneyDisplays=[document.getElementById('total-money-display')];logEl=document.getElementById('log-container');screenBusted=document.getElementById('screen-busted');screenSuccess=document.getElementById('screen-success');screenPersistent=document.getElementById('screen-persistent');mainMenu=document.getElementById('main-menu');playerNameInput=document.getElementById('player-name');`,context);
  return {context,elements,events,saves,rafs,timers,now(ms){currentTime=ms;},advance(ms){currentTime+=ms;},run:s=>vm.runInContext(s,context),snapshot:()=>JSON.parse(vm.runInContext('JSON.stringify({'+tracked.join(',')+'})',context)),calls:()=>randomCalls,frame(time){const pending=[...rafs.values()];rafs.clear();pending.forEach(fn=>fn(time));}};
}
module.exports = {harness};

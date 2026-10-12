'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {harness}=require('../../test/harness.cjs');
const repoRoot=path.resolve(__dirname,'../..');
const outputDir=path.resolve(process.argv[2]||path.join(repoRoot,'work','achievement-audit'));
fs.mkdirSync(outputDir,{recursive:true});
function old(rolls=[]){
 const read=fs.readFileSync;
 const map=new Map([
  [path.join(repoRoot,'renderer.js'),path.join(__dirname,'before/renderer.js')],
  [path.join(repoRoot,'src/save-schema.js'),path.join(__dirname,'before/save-schema.js')],
  [path.join(repoRoot,'src/presentation.js'),path.join(__dirname,'before/presentation.js')]
 ]);
 fs.readFileSync=(file,...args)=>read(map.get(path.resolve(String(file)))||file,...args);
 try{return harness(false,rolls);}finally{fs.readFileSync=read;}
}
const json=(h,s)=>JSON.parse(h.run('JSON.stringify('+s+')'));
const report={version:'1.4.0',sourceHashes:['renderer.js','presentation.js'].map(file=>({file,sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,'before',file))).digest('hex')})),checks:[]};

const physics=old();
const levels=json(physics,`(()=>{
 const rows=[];
 for(let level=1;level<=50;level++){
  const blocked=[];let hitCount=0;
  for(let i=0;i<=120;i++){
   bypassLevel=level;bypassGauge=0;bypassDirection=1;bypassSpeed=.8*Math.pow(1.12,level-1);bypassTolerance=Math.max(5,18*Math.pow(.92,level-1));bypassTarget=20+i*.5;
   let hit=false,steps=0;const positions=[];
   do{updateBypassGauge(false);steps++;if(positions.length<10)positions.push(bypassGauge);if(Math.abs(bypassGauge-bypassTarget)<=bypassTolerance){hit=true;break;}}while(!(bypassGauge===0&&bypassDirection===1)&&steps<5000);
   if(hit)hitCount++;else blocked.push({target:bypassTarget,steps,positions});
  }
  rows.push({level,speed:bypassSpeed,tolerance:bypassTolerance,targets:121,hitCount,blockedExamples:blocked.slice(0,3)});
 }
 return rows;
})()`);
report.checks.push({name:'actual-bypass-update-target-reachability',levels});

for(const [name,risk] of [['missed80',70],['missed95',82],['missed99',92]]){
 const h=old();h.run(`money=1000;risk=${risk};nodesHacked=99;hack(3);`);
 report.checks.push({name,state:json(h,'({risk,peak:sessionStats.maxRisk,livingDanger:achievements.livingDanger.unlocked,onTheEdge:achievements.onTheEdge.unlocked,riskTaker:achievements.riskTaker.unlocked,maxRiskSurvived:achievementStats.maxRiskSurvived})')});
}
// Advance wall time without invoking any gameplay or achievement callback.
const n=old();let wall=1788594000000;n.context.Date.now=()=>wall;
n.run('money=1200;sessionHackCount=1;checkAchievements();');wall+=1800001;
report.checks.push({name:'negotiator-idle-deadline',unlocked:n.run('achievements.negotiator.unlocked'),ownedTimerCount:n.timers.size,start:n.run('achievementStats.negotiatorStartTime'),now:wall});
n.run('transfer();');report.checks.push({name:'negotiator-awards-on-later-transfer',unlocked:n.run('achievements.negotiator.unlocked'),bank:n.run('totalMoney')});

// A normal zero-upgrade integer-risk path; no direct risk edits after initialization.
let queue=[{risk:0,node:0,path:[]}],found=null;const seen=new Set();
while(queue.length&&!found){const s=queue.shift();if(s.path.length>=12)continue;
 for(const level of [1,2,3]){if(s.risk>=100)continue;let risk=Math.min(100,s.risk+[0,3,9,14][level]);let node=s.node+20+risk/2;if(node>=100){node=0;risk=Math.max(0,risk-5);}const path=[...s.path,level];if(risk===67){found=path;break;}const key=risk+','+node;if(!seen.has(key)){seen.add(key);queue.push({risk,node,path});}}
}
const balanced=old();for(const level of found)balanced.run('hack('+level+')');const prior=json(balanced,'({money,risk,sessionHackCount})');balanced.run('transfer();');
report.checks.push({name:'balanced-normal-path',hacks:found,beforeTransfer:prior,unlocked:balanced.run('achievements.balanced.unlocked')});

const maso=old();maso.run('hack(3);hack(3);hack(3);');
report.checks.push({name:'masochist-normal-path',beforeTransfer:json(maso,'({money,risk,sessionHackCount})')});maso.run('transfer();');report.checks.at(-1).unlocked=maso.run('achievements.masochist.unlocked');
const brain=old();brain.run('hack(1);hack(3);buyBonus(1);buyBonus(5);buyBonus(5);');
const beforeBust=json(brain,'({money,risk,sessionHackCount})');let turn=0;brain.context.Math.random=()=>[.99,0][turn++]??.99;brain.run('hack(1);');
report.checks.push({name:'brain404-normal-path',actions:['Safe Entry','Brute Force','Cooler','Proxy','Proxy','detected Safe Entry'],beforeBust,unlocked:brain.run('achievements.brain404.unlocked'),screen:brain.run('currentPresentationScreen()')});
const grant=old();grant.run('pUpgrades.ram.lvl=120;document.getElementById("screen-persistent").style.display="flex";startGame();');
report.checks.push({name:'negotiator-starting-grant-does-not-start-clock',state:json(grant,'({money,timer:achievementStats.negotiatorStartTime})')});

fs.writeFileSync(path.join(outputDir,'before-evidence.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({firstBlockedLevel:levels.find(row=>row.hitCount<121),firstFullyBlockedLevel:levels.find(row=>row.hitCount===0),otherChecks:report.checks.slice(1)},null,2));

// Isolated, read-only lifecycle witnesses. Does not access actual saves or services.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {harness: currentHarness} = require('../../test/harness.cjs');
const root = path.resolve(__dirname, '../..');
const historical = path.join(__dirname,'before-1.4.1');
function harness() {
  const read=fs.readFileSync;
  const sources=new Map([['renderer.js','renderer.js'],['src/presentation.js','presentation.js'],['src/save-schema.js','save-schema.js']].map(([live,old])=>[path.join(root,live),path.join(historical,old)]));
  fs.readFileSync=(file,...args)=>read(sources.get(path.resolve(String(file)))||file,...args);
  try { return currentHarness(); } finally { fs.readFileSync=read; }
}
const outputDir = path.resolve(process.argv[2] || path.join(root, 'work', 'achievement-audit'));
fs.mkdirSync(outputDir, {recursive:true});
const snap = h => JSON.parse(h.run('JSON.stringify({screen:currentPresentationScreen(),money,unlocked:achievements.negotiator.unlocked,clock:negotiatorClock,trackedMs:achievementStats.highMoneyTime})'));
function armed() { const h=harness(); h.run('money=1200;sessionHackCount=1;updateNegotiatorClock()'); return h; }
function fire(h) { const id=h.run('negotiatorClock.timer'); const callback=h.timers.get(id); h.timers.delete(id); callback(); }
(async()=>{
  const result={rendererSha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(historical,'renderer.js'))).digest('hex'),cases:{}};
  let h=armed(); h.now(1800000);fire(h);result.cases.idleAtDeadline=snap(h);
  h=armed();h.run("document.getElementById('screen-settings').style.display='flex'");h.now(1800000);fire(h);result.cases.settingsAtDeadline=snap(h);
  h=armed();h.run("document.getElementById('screen-settings').style.display='flex';document.getElementById('screen-intro').style.display='flex'");h.now(1800000);fire(h);result.cases.replayIntroAtDeadline=snap(h);
  h.run("document.getElementById('screen-intro').style.display='none';updateNegotiatorClock()");result.cases.afterReplay=snap(h);
  h=armed();const old=h.timers.get(h.run('negotiatorClock.timer'));h.run('money=999;updateNegotiatorClock();money=1200');h.now(10000);h.run('updateNegotiatorClock()');h.now(1800000);old();result.cases.staleCallbackAfterRestart=snap(h);
  h=armed();const previous=h.timers.get(h.run('negotiatorClock.timer'));await h.run('loadSavedGame()');h.now(1800000);previous();result.cases.callbackAfterLoad=snap(h);
  fs.writeFileSync(path.join(outputDir,'clock-review.json'),JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify(result,null,2));
})();

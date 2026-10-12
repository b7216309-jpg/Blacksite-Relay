/* Raw Electron witness: no Playwright/CDP or visibility overrides. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {app,BrowserWindow}=require('electron');
const repo=path.resolve(__dirname,'..');
const output=path.resolve(process.env.RISK_V2_QA_DIR || path.join(repo,'dist/qa/soundtrack'));
fs.mkdirSync(output,{recursive:true});
const profile=fs.mkdtempSync(path.join(output,'native-visibility-profile-'));
process.env.RISK_V2_TEST_MODE='1';process.env.RISK_V2_USER_DATA_DIR=profile;
fs.writeFileSync(path.join(profile,'user_data.json'),JSON.stringify({playerName:'RAW_VISIBILITY_QA',totalMoney:320,tutorialSeen:true,musicVolume:0,sfxVolume:0,presentation:{introSeen:true,reducedMotion:true,effectsLevel:'off'}}));
const report={passed:false,method:'Actual Electron main.js, raw child process; no Playwright/CDP attachment, document.hidden injection or focus emulation',
  profile:path.basename(profile),version:JSON.parse(fs.readFileSync(path.join(repo,'package.json'))).version,
  mixerSha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(repo,'src/relay-audio.js'))).digest('hex'),checks:[],samples:[],errors:[]};
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(fn,timeout=15000){const start=Date.now();for(;;){const value=await fn();if(value)return value;if(Date.now()-start>timeout)throw Error('Native visibility wait timed out');await delay(80);}}
const startup=app.whenReady();
require(path.join(repo,'main.js'));
let win;
(async()=>{
  await startup;
  win=await until(()=>BrowserWindow.getAllWindows()[0]);
  await until(()=>win.webContents.executeJavaScript('!window.RiskSaveLoading && window.RiskPresentation?.snapshot()?.playerName === "RAW_VISIBILITY_QA"').catch(()=>false));
  win.show();win.focus();
  await until(()=>win.webContents.executeJavaScript('!document.hidden'));
  await win.webContents.executeJavaScript('window.__visibilityAuditErrors=[];addEventListener("error",e=>__visibilityAuditErrors.push(e.message));addEventListener("unhandledrejection",e=>__visibilityAuditErrors.push(String(e.reason)));');
  win.webContents.sendInputEvent({type:'keyDown',keyCode:'F8'});win.webContents.sendInputEvent({type:'keyUp',keyCode:'F8'});
  await until(()=>win.webContents.executeJavaScript('window.RelayAudio?.getDiagnostics().state === "running" && RelayAudio.getDiagnostics().pendingAssets === 0 && !!RelayAudio.getDiagnostics().currentTrack'),25000);
  await win.webContents.executeJavaScript('showPersistentUpgrades();startGame();');
  await delay(1500);
  async function capture(name){const snapshot=await win.webContents.executeJavaScript('({hidden:document.hidden,visibility:document.visibilityState,screen:RiskPresentation.currentScreen(),audio:RelayAudio.getDiagnostics()})');const row={name,windowVisible:win.isVisible(),windowFocused:win.isFocused(),...snapshot};report.samples.push(row);return row;}
  const visible=await capture('visible-game');
  assert.equal(visible.hidden,false);assert.equal(visible.windowVisible,true);assert.equal(visible.audio.state,'running');assert.equal(visible.audio.ownTimers,1);assert.ok(visible.audio.pace.activeSeconds>0);
  report.checks.push('Native key input unlocks actual WebAudio; visible game time advances.');
  win.hide();
  await until(async()=>{const d=await win.webContents.executeJavaScript('({hidden:document.hidden,a:RelayAudio.getDiagnostics()})');return d.hidden&&d.a.state==='suspended'&&d.a.ownTimers===0;});
  const hidden=await capture('hidden-game');
  assert.equal(hidden.windowVisible,false);assert.equal(hidden.visibility,'hidden');
  await delay(2200);
  const held=await capture('hidden-held');
  assert.equal(held.audio.pace.activeSeconds,hidden.audio.pace.activeSeconds);assert.equal(held.audio.ownTimers,0);assert.equal(held.audio.state,'suspended');
  report.checks.push('Actual BrowserWindow.hide changes Chromium visibility, suspends audio, removes the scheduler and holds pacing for 2.2 seconds.');
  win.show();win.focus();
  await until(async()=>{const d=await win.webContents.executeJavaScript('({hidden:document.hidden,a:RelayAudio.getDiagnostics()})');return !d.hidden&&d.a.state==='running'&&d.a.ownTimers===1;});
  const resumed=await capture('resumed-game');
  await delay(1200);
  const advanced=await capture('resumed-advanced');
  assert.ok(advanced.audio.pace.activeSeconds>resumed.audio.pace.activeSeconds+.5);assert.ok(advanced.audio.pace.activeSeconds-hidden.audio.pace.activeSeconds<2);
  assert.equal(advanced.audio.currentTrack,visible.audio.currentTrack);assert.ok(advanced.audio.musicTrackVoices<=2);assert.equal(advanced.audio.ownTimers,1);
  report.checks.push('Actual BrowserWindow.show resumes one scheduler and the existing run track, without charging the hidden gap.');
  report.errors=await win.webContents.executeJavaScript('window.__visibilityAuditErrors');assert.deepEqual(report.errors,[]);
  report.passed=true;
})().catch(error=>{report.failure=error.stack;console.error(error.message);}).finally(()=>{
  fs.writeFileSync(path.join(output,'native-visibility.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({passed:report.passed,checks:report.checks.length,errors:report.errors,report:path.join(output,'native-visibility.json')}));
  // Guarded teardown of this helper's own isolated child, never another app.
  assert.equal(path.resolve(app.getPath('userData')),path.resolve(profile));
  app.exit(report.passed?0:1);
});

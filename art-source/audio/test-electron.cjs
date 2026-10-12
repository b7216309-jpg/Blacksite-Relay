/* Run with Electron: electron art-source/audio/test-electron.cjs
 * Real local-file audio test, isolated from the game and its save files.
 */
const { app, BrowserWindow } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const root = __dirname;
app.setPath('userData', path.join(root, '.validation-profile'));
app.commandLine.appendSwitch('disable-background-timer-throttling');
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
let win;

async function run() {
  await app.whenReady();
  const errors = [];
  win = new BrowserWindow({ show: false, width: 420, height: 650, opacity: 0, skipTaskbar: true,
    webPreferences: { nodeIntegration: false, contextIsolation: true, backgroundThrottling: false } });
  // Validation observes the real graph upstream of the device. Do not play test
  // bursts through the user's speakers while other agents work on the game.
  win.webContents.setAudioMuted(true);
  win.webContents.on('console-message', event => { if (['warning', 'error'].includes(event.level) && !/Electron Security Warning/.test(event.message)) errors.push(event.message); });
  win.webContents.on('render-process-gone', (_, details) => errors.push('Renderer gone: ' + details.reason));
  await win.loadFile(path.join(root, 'test-playback.html'));
  const evaluate = code => win.webContents.executeJavaScript(code, true);
  const before = await evaluate('RelayAudio.getDiagnostics()');
  assert.equal(before.state, 'locked');
  if (await evaluate('document.hidden')) win.showInactive();
  // A real keyboard input is sufficient; mouse activation is tested separately
  // below after a page reload with no preserved AudioContext or local state.
  win.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Enter' });
  win.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Enter' });
  let diagnostics;
  for (let i = 0; i < 80; i++) {
    await wait(100);
    diagnostics = await evaluate('RelayAudio.getDiagnostics()');
    if (diagnostics.loops.length === 2 && diagnostics.pendingAssets === 0) break;
  }
  assert.equal(diagnostics.state, 'running');
  assert.equal(diagnostics.missingAssets.length, 0);
  assert.equal(diagnostics.loops.length, 2);
  const observations = [];
  async function observe(label, milliseconds) {
    let peak = 0, rmsTotal = 0, samples = 0;
    const until = Date.now() + milliseconds;
    while (Date.now() < until) {
      const sample = await evaluate('audioTest.sample()');
      peak = Math.max(peak, sample.peak); rmsTotal += sample.rms; samples++;
      await wait(45);
    }
    assert.ok(peak < 1, label + ': output clipping');
    assert.ok(rmsTotal / samples > .0001, label + ': silent graph');
    observations.push({ label, measuredPeak: peak, averageRms: rmsTotal / samples, samples });
  }
  await observe('menu / keyboard gesture', 900);
  await evaluate("RelayAudio.setState({screen:'game',risk:15})");
  for (let i = 0; i < 100; i++) {
    await wait(100);
    diagnostics = await evaluate('RelayAudio.getDiagnostics()');
    if (diagnostics.loops.length === 2 && diagnostics.pendingAssets === 0) break;
  }
  assert.equal(diagnostics.loops.length, 2);
  assert.deepEqual(diagnostics.loops.sort(), ['ambience', 'original']);
  const originalLoop = await evaluate("(() => {const source=audioTest.sources.find(s=>s.loop&&s.buffer.duration>200);return {start:source.loopStart,end:source.loopEnd,rate:source.playbackRate.value,duration:source.buffer.duration};})()");
  assert.equal(originalLoop.start, 7.5); assert.equal(originalLoop.end, 225); assert.equal(originalLoop.rate, 1);
  await observe('original soundtrack / gameplay', 1100);
  await evaluate("RelayAudio.setState({screen:'game',risk:95})");
  await observe('high risk / same original track / no generated stems', 1500);
  const cueNames = ['click', 'hover', 'purchase', 'denied', 'hack-1', 'hack-2', 'hack-3', 'node', 'bypass-ready', 'minigame-success', 'minigame-fail', 'ghost', 'overclock', 'cooler', 'insure', 'gamble', 'proxy', 'transfer', 'bust', 'achievement', 'prestige', 'intro'];
  await evaluate('RelayAudio.setVolumes(1,1)');
  await evaluate('Promise.all(' + JSON.stringify(cueNames) + '.map(name => RelayAudio.play(name)))');
  diagnostics = await evaluate('RelayAudio.getDiagnostics()');
  assert.ok(diagnostics.activeVoices <= 16);
  assert.equal(diagnostics.missingAssets.length, 0);
  assert.equal(diagnostics.cachedAssets, 24);
  await observe('all cue decode / bounded burst / maximum volumes', 1700);
  await wait(4700);
  diagnostics = await evaluate('RelayAudio.getDiagnostics()');
  assert.equal(diagnostics.activeVoices, 0);
  await evaluate('RelayAudio.setVolumes(0,0)');
  await wait(150);
  const muted = await evaluate('audioTest.sample()');
  assert.ok(muted.peak < .000001, 'Muted buses should be silent');
  await evaluate("RelayAudio.setVolumes(.5,.5);RelayAudio.setState({screen:'persistent',risk:0})");
  await observe('persistent upgrades menu crossfade', 1100);
  const decodedBytes = diagnostics.decodedBytes;
  // Seek an isolated copy of the actual decoded music buffer just before its
  // boundary. It uses the production loop points at playbackRate1, allowing a
  // real225→7.5second transition test without waiting almost four minutes.
  await evaluate(`(() => {
    RelayAudio.setVolumes(0,0);
    const context=audioTest.contexts[0], original=audioTest.sources.find(s=>s.loop&&s.buffer.duration>200);
    const probe=context.createBufferSource(), gain=context.createGain(), analyser=context.createAnalyser();
    probe.buffer=original.buffer;probe.loop=true;probe.loopStart=original.loopStart;probe.loopEnd=original.loopEnd;
    gain.gain.value=.35;probe.connect(gain).connect(analyser).connect(context.destination);
    analyser.fftSize=2048;audioTest.seamProbe={probe,analyser,start:context.currentTime};probe.start(0,223.5);
  })()`);
  const seamObservations=[];
  for(let i=0;i<65;i++) {
    const sample=await evaluate(`(() => {const {analyser,start}=audioTest.seamProbe,a=new Float32Array(2048);analyser.getFloatTimeDomainData(a);return {time:audioTest.contexts[0].currentTime-start,rms:Math.sqrt(a.reduce((s,v)=>s+v*v,0)/a.length),peak:Math.max(...a.map(Math.abs))};})()`);
    seamObservations.push(sample);await wait(45);
  }
  const around=seamObservations.filter(s=>s.time>1.1&&s.time<1.9);
  assert.ok(around.length>=10);assert.ok(around.every(s=>s.rms>.001&&s.peak<1),'Original music boundary must remain audible without clipping');
  await evaluate('audioTest.seamProbe.probe.stop();audioTest.seamProbe.probe.disconnect();');
  await evaluate('RelayAudio.dispose()');
  assert.equal((await evaluate('RelayAudio.getDiagnostics()')).activeVoices, 0);
  await win.loadFile(path.join(root, 'test-playback.html'));
  // User-gesture execution of a DOM click goes through the actual click and
  // unlock handlers, without an autoplay-policy override command-line switch.
  await evaluate("document.getElementById('unlock').click()");
  for (let i = 0; i < 80; i++) {
    await wait(100);
    diagnostics = await evaluate('RelayAudio.getDiagnostics()');
    if (diagnostics.loops.length === 2 && diagnostics.pendingAssets === 0) break;
  }
  assert.equal(diagnostics.state, 'running');
  await observe('mouse handler gesture after reload', 850);
  await evaluate('RelayAudio.dispose()');
  const report = { status: 'passed', engine: 'Electron ' + process.versions.electron + ' / Chromium ' + process.versions.chrome,
    origin: 'file://', gameAndSaveStateLoaded: false, physicalOutputMuted: true,
    validation: 'Actual Ogg decoding and real Web Audio output graph measured with an AnalyserNode. No human listening review.',
    checkedRuntimeAssets: 24, decodedBufferBytesAtFullLoad: decodedBytes, voiceLimit: 16,
    originalLoop, seamTransition: {testedAtPlaybackRate:1,fromSeconds:225,toSeconds:7.5,minimumBoundaryRms:Math.min(...around.map(s=>s.rms)),samples:around.length},
    audioErrors: errors, observations };
  assert.equal(errors.length, 0, errors.join('\n'));
  fs.writeFileSync(path.join(root, 'electron-playback-validation.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  win.destroy();
  app.quit();
}
run().catch(error => { console.error(error); if (win && !win.isDestroyed()) win.destroy(); app.exit(1); });

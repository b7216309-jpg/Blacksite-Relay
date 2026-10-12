'use strict';
const closeTestApp = require('./close-test-app.cjs');
const { _electron: electron } = require('playwright');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const out = path.resolve(process.env.RISK_V2_QA_DIR || path.join(root, 'dist', 'qa', 'soak'));
const seconds = Number(process.env.RISK_V2_SOAK_SECONDS || 600);
const monotonic = () => Number(process.hrtime.bigint()) / 1e6;
assert(Number.isFinite(seconds) && seconds >= 1, 'The soak duration must be at least one real second');

(async () => {
  await fs.mkdir(out, { recursive: true });
  const dir = path.join(out, 'user-data');
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, 'user_data.json'), JSON.stringify({
    playerName: 'SOAK', totalMoney: 12500, musicVolume: .5, sfxVolume: .5,
    tutorialSeen: true, presentation: { introSeen: true, effectsLevel: 'full', reducedMotion: false }
  }));
  const report = {
    version: require('../package.json').version, target: process.env.RISK_V2_EXECUTABLE ? 'packaged' : 'source',
    executable: process.env.RISK_V2_EXECUTABLE || require('electron'), passed: false,
    requestedSeconds: seconds, seconds, elapsedSeconds: 0, actualElapsedSeconds: 0,
    startedAt: new Date().toISOString(), samples: [], bursts: [], errors: [],
    method: 'Real monotonic wall time. Dedicated offline test profile. Music/SFX gains remain nonzero; only the fixture webContents output is muted. Stress outcomes are presentation events, with game values injected solely in this profile. Main requestAnimationFrame timing and decorative scene paint cadence are reported separately. Retained heap is measured after GC before and after the soak; no forced GC runs during the timed stress.'
  };
  let app, cdp;
  try {
    app = await electron.launch({
      executablePath: report.executable, args: process.env.RISK_V2_EXECUTABLE ? [] : [root],
      env: { ...process.env, RISK_V2_TEST_MODE: '1', RISK_V2_USER_DATA_DIR: dir }, timeout: 120000
    });
    const page = await app.firstWindow();
    page.on('pageerror', error => report.errors.push(error.message));
    await app.context().setOffline(true);
    report.offline = true;
    report.actualVersion = await app.evaluate(({ app, BrowserWindow }) => {
      BrowserWindow.getAllWindows().forEach(window => window.webContents.setAudioMuted(true));
      return app.getVersion();
    });
    assert.equal(report.actualVersion, report.version);
    await page.addInitScript(() => {
      const timeouts = new Set(), intervals = new Set();
      const st = window.setTimeout, ct = window.clearTimeout, si = window.setInterval, ci = window.clearInterval;
      window.setTimeout = (fn, ms, ...args) => {
        let id;
        id = st(() => { timeouts.delete(id); typeof fn === 'function' ? fn(...args) : (0, eval)(fn); }, ms);
        timeouts.add(id); return id;
      };
      window.clearTimeout = id => { timeouts.delete(id); intervals.delete(id); ct(id); };
      window.setInterval = (fn, ms, ...args) => { const id = si(fn, ms, ...args); intervals.add(id); return id; };
      window.clearInterval = id => { intervals.delete(id); timeouts.delete(id); ci(id); };
      const deltas = [];
      let previous = 0;
      function sample(t) {
        if (previous && deltas.length < 200000) deltas.push(t - previous);
        previous = t; requestAnimationFrame(sample);
      }
      requestAnimationFrame(sample);
      window.soakDiagnostics = () => ({
        timeouts: timeouts.size, intervals: intervals.size, jsHeap: performance.memory?.usedJSHeapSize,
        observedAt: performance.now(), frameIntervals: deltas.splice(0)
      });
    });
    await page.reload();
    await page.waitForFunction(() => window.RiskSaveLoading === false && window.RiskPresentation?.snapshot()?.playerName === 'SOAK'
      && window.RelayPets?.getDiagnostics().ready && window.RelayLighting?.getDiagnostics().ready && window.RelayShadows?.getDiagnostics().ready);
    await page.keyboard.press('Shift');
    await page.evaluate(() => { showPersistentUpgrades(); startGame(); Math.random = () => .99; });
    await page.waitForFunction(() => RelayAudio.getDiagnostics().state === 'running' && RelayAudio.getDiagnostics().pendingAssets === 0);
    await page.waitForTimeout(2000);
    cdp = await app.context().newCDPSession(page);
    await cdp.send('HeapProfiler.collectGarbage');
    report.retainedHeapBefore = await cdp.send('Runtime.getHeapUsage');
    const snapshot = () => page.evaluate(() => ({
      scene: BlacksiteScene.getDiagnostics(), audio: RelayAudio.getDiagnostics(),
      operator: window.RelayLife?.getDiagnostics(), pets: window.RelayPets?.getDiagnostics(),
      lighting: window.RelayLighting?.getDiagnostics(), shadows: window.RelayShadows?.getDiagnostics(),
      screenLife: window.RelayScreenLife?.stats(), ...soakDiagnostics()
    }));
    function assertBounded(s) {
      assert.ok(s.scene.particles <= 160); assert.ok(s.scene.activeEffects <= 12); assert.equal(s.scene.coreSpriteCount, 5);
      assert.equal(s.scene.paintFrameLimit, 60);
      assert.ok(s.audio.activeVoices <= 16); assert.ok(s.audio.musicTrackVoices <= 2); assert.ok(s.audio.ambienceVoices <= 1);
      assert.equal(s.audio.ownTimers, 1); assert.equal(s.audio.state, 'running'); assert.deepEqual(s.audio.missingAssets, []);
      assert.ok(s.timeouts <= 32, 'Global timeouts remain bounded'); assert.ok(s.intervals <= 2, 'Global intervals remain bounded');
      if (s.operator) { assert.equal(s.operator.frameCount, 1); assert.equal(s.operator.ownTimers, 0); }
      if (s.pets) {
        assert.equal(s.pets.ready, true); assert.equal(s.pets.error, false); assert.equal(s.pets.residents.length, 4);
        assert.equal(s.pets.residentLimit, 4); assert.equal(s.pets.ratLimit, 2); assert.ok(s.pets.ratCount <= 2);
        assert.equal(s.pets.ownTimers, 0); assert.equal(s.pets.ownAnimationFrames, 0);
        assert.equal(Object.keys(s.pets.textures).length, 3);
        assert.equal(Object.values(s.pets.textures).reduce((n, x) => n + x.cachedFrames, 0), 4);
      }
      assert.equal(s.lighting.ready, true); assert.equal(s.lighting.error, false); assert.equal(s.lighting.mapCount, 11);
      assert.ok(s.lighting.viewBuffers <= 4); assert.equal(s.lighting.ownTimers, 0); assert.equal(s.lighting.ownAnimationFrames, 0);
      assert.equal(s.shadows.ready, true); assert.equal(s.shadows.error, false); assert.equal(s.shadows.canvasCount, 1);
      assert.equal(s.shadows.receiverMasks, 3); assert.ok(s.shadows.sourceCaches <= 5); assert.equal(s.shadows.casters.length, 5);
      assert.ok(s.shadows.shadowPixels > 0 && s.shadows.shadowPixels < 4000);
      assert.equal(s.shadows.ownTimers, 0); assert.equal(s.shadows.ownAnimationFrames, 0);
      if (s.screenLife) { assert.ok(s.screenLife.activeGlints <= 9); assert.equal(s.screenLife.timers, 0); }
    }
    const started = monotonic();
    let iteration = 0;
    while (true) {
      const s = await snapshot();
      s.elapsed = (monotonic() - started) / 1000;
      s.processes = await app.evaluate(({ app }) => app.getAppMetrics().map(p => ({ type: p.type, cpu: p.cpu.percentCPUUsage, memory: p.memory.workingSetSize })));
      const previous = report.samples.at(-1);
      if (previous) s.scenePaintFPS = (s.scene.frames - previous.scene.frames) * 1000 / (s.observedAt - previous.observedAt);
      report.samples.push(s); assertBounded(s);
      if (iteration % 6 === 0) console.log(JSON.stringify({ elapsedSeconds: s.elapsed, scenePaintFPS: s.scenePaintFPS, track: s.audio.currentTrack, particles: s.scene.particles, timeouts: s.timeouts, intervals: s.intervals }));
      if (s.elapsed >= seconds) break;
      await page.evaluate(n => {
        risk = [24, 57, 89][n % 3]; money = 50000; ghostShieldActive = n % 2 === 0; overclockBonusTurns = n % 2 ? 2 : 0; updateUI();
        for (let i = 0; i < 24; i++) RiskPresentation.emit(['hack', 'node', 'bonus', 'achievement'][i % 4], { hackType: i % 3 + 1, bonusId: i % 6 + 1 });
      }, iteration);
      await page.waitForTimeout(180);
      const burst = await snapshot();
      burst.elapsed = (monotonic() - started) / 1000;
      assertBounded(burst);
      // Burst samples drain the passive frame probe too; keep their intervals.
      report.bursts.push(burst);
      iteration++;
      const nextSample = Math.min(seconds * 1000, iteration * 10000);
      await page.waitForTimeout(Math.max(0, nextSample - (monotonic() - started)));
    }
    report.elapsedSeconds = report.actualElapsedSeconds = (monotonic() - started) / 1000;
    assert.ok(report.elapsedSeconds >= seconds, 'The actual soak must reach the requested duration');
    if (seconds >= 600) assert.ok(report.actualElapsedSeconds >= 600);
    await page.waitForTimeout(3000);
    report.settled = await snapshot(); assertBounded(report.settled);
    await cdp.send('HeapProfiler.collectGarbage');
    report.retainedHeapAfter = await cdp.send('Runtime.getHeapUsage');
    report.retainedHeapGrowthBytes = report.retainedHeapAfter.usedSize - report.retainedHeapBefore.usedSize;
    assert.ok(report.retainedHeapGrowthBytes < 32 * 1024 * 1024, 'Retained JS heap did not grow by 32 MiB during the soak');
    const warm = report.samples.find(s => s.elapsed >= Math.min(30, seconds));
    assert.equal(report.settled.audio.cachedAssets, warm.audio.cachedAssets, 'Decoded cache stops growing after warm-up');
    assert.equal(report.settled.audio.decodedBytes, warm.audio.decodedBytes);
    assert.equal(report.settled.audio.pendingAssets, 0);
    assert.ok(report.settled.timeouts <= report.samples[0].timeouts + 2, 'Transient timeouts settle');
    assert.equal(report.settled.intervals, report.samples[0].intervals, 'No interval accumulation');
    assert.ok(report.bursts.some(s => s.audio.activeVoices > 0), 'Non-muted SFX voices were actually exercised');
    report.observedGameTracks = [...new Set(report.samples.map(s => s.audio.currentTrack))];
    if (seconds >= 240) for (const track of ['backstreet-signal', 'chrome-pursuit', 'redline-protocol']) assert.ok(report.observedGameTracks.includes(track), 'Real-time progression reaches ' + track);
    await page.evaluate(() => { bypassCharge = 15; bypass(); });
    await page.waitForTimeout(250);
    const sceneMotion = () => page.evaluate(() => ({
      frames: BlacksiteScene.getDiagnostics().frames, pets: RelayPets.getDiagnostics().draws, time: RelayPets.getDiagnostics().time,
      lighting: RelayLighting.getDiagnostics().draws, lightingTime: RelayLighting.getDiagnostics().time,
      shadowTime: RelayShadows.getDiagnostics().time, shadowBuilds: RelayShadows.getDiagnostics().builds
    }));
    const frozen = await sceneMotion();
    await page.waitForTimeout(600); assert.deepEqual(await sceneMotion(), frozen);
    report.minigamePause = true; await page.keyboard.press('Escape');
    const dt = report.samples.slice(1).concat(report.bursts).flatMap(x => x.frameIntervals).sort((a, b) => a - b);
    const quant = p => dt[Math.floor((dt.length - 1) * p)];
    const first = report.samples[0], last = report.samples.at(-1);
    const paintRates = report.samples.slice(1).map(s => s.scenePaintFPS).sort((a, b) => a - b);
    report.performance = {
      mainRAF: { medianFrameMs: quant(.5), p95FrameMs: quant(.95), p99FrameMs: quant(.99), framesMeasured: dt.length, averageFPS: 1000 / (dt.reduce((a, b) => a + b, 0) / dt.length) },
      scenePaint: { frameLimit: 60, averageFPS: (last.scene.frames - first.scene.frames) * 1000 / (last.observedAt - first.observedAt), minimumSampleFPS: paintRates[0], medianSampleFPS: paintRates[Math.floor(paintRates.length / 2)], maximumSampleFPS: paintRates.at(-1) },
      maxTimeouts: Math.max(...report.samples.concat(report.bursts).map(s => s.timeouts)), maxIntervals: Math.max(...report.samples.concat(report.bursts).map(s => s.intervals)),
      maxSFXVoices: Math.max(...report.bursts.map(s => s.audio.activeVoices)), heapStart: first.jsHeap, heapEnd: report.settled.jsHeap,
      caveat: 'Main RAF follows the monitor (240 Hz on this machine). Heavy diorama painting is capped at 60 fps. CPU and memory are observations from this machine under a passive QA probe.'
    };
    report.samples.concat(report.bursts, [report.settled]).forEach(s => delete s.frameIntervals);
    assert.ok(report.performance.scenePaint.averageFPS >= 55, 'Sustained decorative painting meets the 60 fps target with timing tolerance');
    assert.ok(report.performance.scenePaint.averageFPS <= 61, 'Decorative painting respects its cap');
    assert.equal(report.settled.scene.particles, 0); assert.equal(report.settled.scene.activeEffects, 0); assert.equal(report.settled.audio.activeVoices, 0);
    if (report.settled.screenLife) assert.equal(report.settled.screenLife.activeGlints, 0);
    assert.deepEqual(report.errors, []);
    report.passed = true;
    console.log(JSON.stringify({ passed: report.passed, elapsedSeconds: report.elapsedSeconds, performance: report.performance, retainedHeapGrowthBytes: report.retainedHeapGrowthBytes, errors: report.errors, minigamePause: report.minigamePause }, null, 2));
  } catch (error) {
    report.failure = error.stack; throw error;
  } finally {
    if (cdp) await cdp.detach().catch(() => {});
    if (app) await closeTestApp(app).then(() => { report.windowsClosed = true; }).catch(error => { report.passed = false; process.exitCode = 1; report.errors.push('Teardown: ' + error.message); });
    await fs.writeFile(path.join(out, 'soak-report.json'), JSON.stringify(report, null, 2));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });

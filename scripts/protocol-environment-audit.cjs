/* Device presentation audit. Mocked bridge, no host saves or online leaderboard. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

function findChromium() {
  if (process.env.CHROMIUM_EXECUTABLE) return fs.existsSync(process.env.CHROMIUM_EXECUTABLE) ? process.env.CHROMIUM_EXECUTABLE : null;
  if (fs.existsSync(chromium.executablePath())) return chromium.executablePath();
  const cache = process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'ms-playwright');
  if (!cache || !fs.existsSync(cache)) return null;
  for (const folder of fs.readdirSync(cache).filter(n => /^chromium(?:_headless_shell)?-\d+$/.test(n)).reverse()) {
    for (const suffix of ['chrome-win64/chrome.exe', 'chrome-win/chrome.exe', 'chrome-headless-shell-win64/chrome-headless-shell.exe']) {
      const file = path.join(cache, folder, suffix); if (fs.existsSync(file)) return file;
    }
  }
  return null;
}

async function withGame(browser, run, { scale = 1, preferences = {}, captureDir, captures = [] } = {}) {
  const context = await browser.newContext({ viewport: { width: 420, height: 650 }, deviceScaleFactor: scale });
  const errors = [];
  try {
    await context.route(/^https?:/, route => route.abort());
    await context.addInitScript(preferences => {
      window.electronAPI = {
        loadGame: async () => ({ playerName: 'DEVICE_QA', tutorialSeen: true, musicVolume: 0, sfxVolume: 0,
          presentation: { introSeen: true, reducedMotion: false, effectsLevel: 'full', ...preferences } }),
        saveGame: async () => true, submitScore: async () => 'OK', getLeaderboard: async () => JSON.stringify({scope:'local',metric:'best-bank-balance',limit:10,entries:[]}), closeApp: () => {}
      };
      window.deviceKeyAudit = [];
      document.addEventListener('keydown', e => deviceKeyAudit.push({ key: e.key, trusted: e.isTrusted }), true);
    }, preferences);
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href);
    await page.waitForFunction(() => !window.RiskSaveLoading && window.RiskPresentation?.snapshot()?.playerName === 'DEVICE_QA' && window.RelayPets?.getDiagnostics().ready && window.RelayLighting?.getDiagnostics().ready && window.RelayShadows?.getDiagnostics().ready);
    await page.evaluate(() => { showPersistentUpgrades(); startGame(); money = 500; risk = 50; multiplier = 8; updateUI(); });
    const capture = async name => {
      const data = await presentationSnapshot(page);
      if (captureDir) { fs.mkdirSync(captureDir, { recursive: true }); await page.screenshot({ path: path.join(captureDir, `${scale}-${name}.png`) }); }
      captures.push({ name, scale, ...data }); return data;
    };
    await run(page, capture, context);
    assert.deepEqual(errors, [], 'no uncaught page errors');
  } finally { await context.close(); }
}

async function start(page, game) {
  await page.evaluate(game => {
    if (game === 'bypass') { bypassCharge = 15; bypass(); }
    else if (game === 'typing') startTypingProtocol();
    else startBackdoorProtocol();
  }, game);
}

async function presentationSnapshot(page) {
  return page.evaluate(() => {
    const screen = RiskPresentation.currentScreen();
    const device = document.querySelector(`[data-protocol-device="${screen}"]`);
    const bounds = e => { const r = e.getBoundingClientRect(); return { x:r.x, y:r.y, width:r.width, height:r.height, right:r.right, bottom:r.bottom }; };
    const images = device ? [...device.querySelectorAll('img')].map(img => ({ src: img.getAttribute('src'), ready:img.complete && img.naturalWidth > 0,
      width:img.naturalWidth, height:img.naturalHeight, ...bounds(img), transform:getComputedStyle(img).transform, opacity:getComputedStyle(img).opacity, pointerEvents:getComputedStyle(img).pointerEvents })) : [];
    const controls = [...document.querySelectorAll('button,input,[role="button"]')].filter(e => e.getClientRects().length && !e.closest('[inert]')).map(e => {
      const r = bounds(e), at = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      const phaseLocked = e.classList.contains('backdoor-cell') && RiskPresentation.protocol()?.phase !== 'active';
      return { id:e.id || e.dataset.index, disabled:!!e.disabled || phaseLocked, hit:!!at && (e === at || e.contains(at)), ...r };
    });
    const animations = document.getAnimations().filter(a => a.playState === 'running').map(a => ({ name:a.animationName || 'web-animation', target:a.effect?.target?.id || a.effect?.target?.className || '', device:!!a.effect?.target?.closest?.('[data-protocol-device]'), artwork:!!a.effect?.target?.closest?.('.protocol-artwork') }));
    return { screen, phase:RiskPresentation.protocol()?.phase, images, controls, animations,
      diagnostics:window.RelayUI?.getProtocolDiagnostics?.(), hardware:window.RelayProtocolLife?.getDiagnostics?.(), scene:BlacksiteScene.getDiagnostics(),
      pets:RelayPets.getDiagnostics(), lighting:RelayLighting.getDiagnostics(), shadows:RelayShadows.getDiagnostics(),
      viewport:{ width:innerWidth,height:innerHeight,scale:devicePixelRatio,scroll:document.documentElement.scrollWidth } };
  });
}

function checkDevice(data) {
  assert.ok(data.images.length >= 1, `${data.screen}: original device artwork present`);
  assert.ok(data.images.every(i => i.ready && i.width >= 420 && i.height > 0), `${data.screen}: original images decoded`);
  assert.ok(data.controls.every(r => r.x >= 0 && r.y >= 0 && r.right <= 420.5 && r.bottom <= 650.5), `${data.screen}: controls stay in portrait viewport`);
  assert.ok(data.controls.filter(r => !r.disabled).every(r => r.hit), `${data.screen}: artwork cannot intercept controls`);
  assert.equal(data.viewport.scroll, 420, 'no horizontal scrolling');
}

async function stableActive(page, capture, name) {
  await page.waitForFunction(() => RiskPresentation.protocol()?.phase === 'active');
  // Permit the final preparation frame to settle before comparing the active clock.
  await page.waitForTimeout(80);
  await page.evaluate(() => { window.deviceRngCalls = 0; window.deviceOldRandom = Math.random; Math.random = () => { deviceRngCalls++; return deviceOldRandom(); }; });
  const before = await capture(name + '-start');
  await page.waitForTimeout(650);
  const after = await capture(name + '-end');
  const randomCalls = await page.evaluate(() => { Math.random = deviceOldRandom; return deviceRngCalls; });
  assert.equal(randomCalls, 0, 'decorations consume no gameplay randomness');
  assert.deepEqual(after.images, before.images, 'original PNG backplates stay registered while separate hardware effects animate');
  assert.deepEqual(after.animations.filter(a => a.artwork), [], 'no whole-backplate CSS movement competes with timed input');
  assert.equal(after.diagnostics.ownArtworkTimers, 0); assert.equal(after.diagnostics.ownArtworkAnimationFrames, 0);
  assert.equal(after.hardware.ownedRAF,1);assert.equal(after.hardware.ownedTimers,0);
  const hardware=after.hardware.devices.find(device=>device.game===after.screen);
  assert.equal(hardware.sparks,0);assert.equal(hardware.sweeps,0);assert.ok(hardware.leds>0&&hardware.leds<=8);
  for (const [module, fields] of [['scene',['time']], ['pets',['time','draws']], ['lighting',['time','draws']], ['shadows',['time','builds']]]) {
    for (const field of fields) assert.equal(after[module][field], before[module][field], `${module} ${field} is suspended during protocol`);
  }
  checkDevice(after);
}

const cases = [
  ['timed bypass retains control geometry and native Space applies one resolved stop', async (browser, options) => withGame(browser, async (page, capture) => {
    await start(page, 'bypass'); await stableActive(page, capture, 'bypass-active');
    await page.evaluate(() => { bypassGauge = bypassTarget; }); await page.keyboard.press('Space');
    assert.equal(await page.evaluate(() => RiskPresentation.protocol().stops), 1);
    await capture('bypass-stop'); await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(() => RiskPresentation.currentScreen()), 'game');
    assert.equal(await page.evaluate(() => risk), 50, 'one stop has no unearned reduction');
  }, options)],
  ['command device preserves the preparation, active clock and trusted typing', async (browser, options) => withGame(browser, async (page, capture) => {
    await start(page, 'typing'); checkDevice(await capture('typing-prepare'));
    assert.equal(await page.locator('#typing-input').isDisabled(), true);
    const preparedAt = await page.evaluate(() => activeMiniGame.prepareDeadlineAt);
    await stableActive(page, capture, 'typing-active');
    const before = await page.evaluate(() => ({ phrase:typingPhrase, multiplier, now:performance.now(), protocol:RiskPresentation.protocol() }));
    assert.ok(before.now >= preparedAt); assert.equal(before.protocol.durationMs, 7000);
    await page.keyboard.type(before.phrase.toUpperCase(), { delay:10 });
    assert.equal(await page.evaluate(() => multiplier), before.multiplier + 1);
    assert.equal(await page.evaluate(() => RiskPresentation.protocol().success), true);
    assert.ok(await page.evaluate(() => deviceKeyAudit.some(e => e.trusted && e.key.length === 1)), 'real keyboard delivered the command');
    await capture('typing-receipt');
  }, options)],
  ['memory device retains readable targets and keyboard navigation through unchanged ports', async (browser, options) => withGame(browser, async (page, capture) => {
    await start(page, 'backdoor'); checkDevice(await capture('memory-memorize'));
    assert.equal(await page.locator('.backdoor-cell[data-state="target"]').count(), 5);
    const targets = await page.evaluate(() => backdoorTargetPositions.slice());
    const boxes = await page.locator('.backdoor-cell').evaluateAll(cells => cells.map(e => {const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};}));
    assert.equal(boxes.length, 64); assert.ok(boxes.every(r => r.w === 30 && r.h === 30));
    assert.deepEqual(boxes[0], {x:72.5,y:200,w:30,h:30}); assert.deepEqual(boxes[63], {x:317.5,y:445,w:30,h:30});
    const transitionDurations=await page.locator('.backdoor-cell').evaluateAll(cells=>cells.map(cell=>getComputedStyle(cell).transitionDuration));
    assert.ok(transitionDurations.every(value=>value.split(',').every(duration=>parseFloat(duration)===0)), 'ports must clear reveal colors immediately, without inherited target-color interpolation');
    await page.waitForFunction(()=>RiskPresentation.protocol()?.phase==='active');
    const recallPaint=await page.locator('.backdoor-cell').evaluateAll(cells=>cells.map(cell=>({state:cell.dataset.state,background:getComputedStyle(cell).backgroundColor,shadow:getComputedStyle(cell).boxShadow})));
    assert.ok(recallPaint.every(cell=>cell.state==='idle'), 'all reveal states clear at recall');
    assert.equal(new Set(recallPaint.map(cell=>cell.background+'|'+cell.shadow)).size,1,'previous targets have the same immediate background and shadow as other idle ports');
    await stableActive(page, capture, 'memory-recall');
    assert.equal(await page.locator('.backdoor-cell[data-state="target"]').count(), 0);
    let current = await page.evaluate(() => Number(document.activeElement.dataset.index));
    assert.equal(current, 0, 'recall places focus on first port');
    for (const target of targets) {
      while (Math.floor(current/8) !== Math.floor(target/8)) { const step=target>current?8:-8; await page.keyboard.press(step>0?'ArrowDown':'ArrowUp'); current+=step; }
      while (current !== target) { const step=target>current?1:-1; await page.keyboard.press(step>0?'ArrowRight':'ArrowLeft'); current+=step; }
      assert.equal(await page.evaluate(() => Number(document.activeElement.dataset.index)), target);
      await page.keyboard.press(target%2?'Enter':'Space');
    }
    assert.equal(await page.evaluate(() => RiskPresentation.protocol().success), true);
    assert.equal(await page.evaluate(() => RiskPresentation.protocol().correctCount), 5);
    await capture('memory-result');
  }, options)],
  ['reduced, static and hidden preferences suppress decorative preparation motion', async (browser, options) => {
    for (const mode of ['reduced','off','hidden']) await withGame(browser, async (page, capture) => {
      if (mode === 'hidden') await page.evaluate(() => { Object.defineProperty(document,'hidden',{ configurable:true,get:()=>true }); document.dispatchEvent(new Event('visibilitychange')); });
      await start(page, 'backdoor'); await page.waitForTimeout(80);
      const before = await capture('memory-' + mode); await page.waitForTimeout(250); const after = await presentationSnapshot(page);
      assert.deepEqual(after.animations.filter(a => a.artwork), [], `${mode}: no decorative device animation`);
      assert.equal(after.diagnostics.decorativeAnimationCount, 0);
      assert.equal(after.hardware.ownedRAF,0);assert.equal(after.hardware.visibleDevice,null);assert.equal(after.hardware.frames,before.hardware.frames);
      assert.deepEqual(after.images, before.images, `${mode}: artwork does not move`);
      assert.equal(after.phase, 'countdown', 'motion preference does not skip gameplay preparation');
    }, { ...options, preferences: mode === 'reduced' ? { reducedMotion:true } : mode === 'off' ? { effectsLevel:'off' } : {} });
  }],
  ['repeated device cycles settle without accumulating animated resources or stale phases', async (browser, options) => withGame(browser, async (page, capture) => {
    const samples = [];
    for (let round=0;round<3;round++) {
      for (const game of ['bypass','typing','backdoor']) {
        await start(page,game);
        if (game !== 'bypass') await page.waitForFunction(() => RiskPresentation.protocol()?.phase === 'active');
        if (game === 'bypass') { await page.evaluate(() => { bypassGauge=0; }); await page.keyboard.press('Space'); }
        else if (game === 'typing') { const phrase=await page.evaluate(() => typingPhrase); await page.keyboard.type(phrase,{delay:1}); }
        else {
          const wrong=await page.evaluate(() => Array.from({length:64},(_,i)=>i).filter(i=>!backdoorTargetPositions.includes(i)).slice(0,3));
          for (const index of wrong) await page.locator(`.backdoor-cell[data-index="${index}"]`).click();
        }
        await page.waitForFunction(() => RiskPresentation.currentScreen()==='game');
        await page.waitForTimeout(600);
        const sample=await page.evaluate(() => ({
          diagnostics:RelayUI.getProtocolDiagnostics(),
          hardware:RelayProtocolLife.getDiagnostics(),
          images:document.querySelectorAll('[data-protocol-device] img').length,
          memoryCells:document.querySelectorAll('.backdoor-cell').length,
          rails:RelayScreenLife.stats(),
          deviceAnimations:document.getAnimations().filter(a=>a.playState==='running'&&a.effect?.target?.closest?.('[data-protocol-device]')).map(a=>a.animationName||'web-animation'),
          protocol:RiskPresentation.protocol()?.game,
          phase:RiskPresentation.protocol()?.phase
        }));
        assert.deepEqual(sample.deviceAnimations,[],'departed device owns no running animation');
        assert.equal(sample.diagnostics.decorativeAnimationCount,0);
        assert.equal(sample.diagnostics.ownArtworkTimers,0); assert.equal(sample.diagnostics.ownArtworkAnimationFrames,0);
        assert.equal(sample.hardware.ownedRAF,0);assert.equal(sample.hardware.ownedTimers,0);assert.equal(sample.hardware.canvasCount,3);assert.equal(sample.hardware.visibleDevice,null);assert.ok(sample.hardware.devices.every(device=>device.pixels===0&&device.emissions.length===0));
        assert.equal(sample.images,3,'device image count remains fixed');
        assert.ok(sample.memoryCells===0||sample.memoryCells===64,'memory grid stays bounded');
        assert.equal(sample.rails.animationFrameLoops,0); assert.equal(sample.rails.timers,0); assert.equal(sample.rails.activeGlints,0);
        assert.equal(sample.protocol,game,'late previous phase cannot overwrite the latest outcome');
        assert.equal(sample.phase,'result'); samples.push({round,game,...sample});
      }
    }
    const settled=await capture('cycles-settled'); settled.lifecycle=samples;
  }, options)]
];

async function captureScales(browser, options) {
  for (const scale of [1,1.25,1.5,2]) for (const game of ['bypass','typing','backdoor']) {
    await withGame(browser, async (page, capture) => { await start(page,game); checkDevice(await capture(game+'-layout')); }, { ...options, scale });
  }
}

module.exports = { findChromium, chromium, cases, captureScales, withGame, start, presentationSnapshot };
if (require.main === module) (async () => {
  const captureDir = path.resolve(process.env.RISK_V2_PROTOCOL_QA_DIR || path.join(__dirname,'..','dist','qa','device-environments'));
  const report = { createdAt:new Date().toISOString(), passed:false, checks:[], captures:[], isolation:'Mocked bridge; external requests blocked; no real saves; simulated document.hidden for visibility contract.' };
  const browser = await chromium.launch({ executablePath:findChromium(), headless:true, args:['--allow-file-access-from-files'] });
  try {
    for (const [name, run] of cases) { await run(browser,{ captureDir,captures:report.captures }); report.checks.push(name); }
    await captureScales(browser,{ captureDir,captures:report.captures }); report.checks.push('Native 420x650 device containment at 100/125/150/200 percent scaling'); report.passed=true;
  } catch(e) { report.failure=e.stack; process.exitCode=1; }
  finally { await browser.close(); fs.mkdirSync(captureDir,{recursive:true}); fs.writeFileSync(path.join(captureDir,'report.json'),JSON.stringify(report,null,2)); console.log(JSON.stringify({passed:report.passed,checks:report.checks,captures:report.captures.length,failure:report.failure},null,2)); }
})();

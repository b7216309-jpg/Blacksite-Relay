const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

// These regressions need Chromium's native button defaults. A DOM-only harness
// cannot reproduce Enter auto-repeat or a Space-generated click on key release.
function findChromium() {
  if (process.env.CHROMIUM_EXECUTABLE) return fs.existsSync(process.env.CHROMIUM_EXECUTABLE) ? process.env.CHROMIUM_EXECUTABLE : null;
  if (fs.existsSync(chromium.executablePath())) return chromium.executablePath();
  const cache = process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'ms-playwright');
  if (!cache || !fs.existsSync(cache)) return null;
  for (const folder of fs.readdirSync(cache).filter(name => /^chromium-\d+$/.test(name)).sort((a, b) => Number(b.split('-')[1]) - Number(a.split('-')[1]))) {
    for (const relative of ['chrome-win64/chrome.exe', 'chrome-win/chrome.exe']) {
      const executable = path.join(cache, folder, relative);
      if (fs.existsSync(executable)) return executable;
    }
  }
  return null;
}

const executablePath = findChromium();
test('native keyboard and typing input regressions', {
  skip: executablePath ? false : 'Chromium unavailable; install Playwright Chromium or set CHROMIUM_EXECUTABLE.',
  timeout: 60000
}, async t => {
  const browser = await chromium.launch({ executablePath, headless: true, args: ['--allow-file-access-from-files'] });
  t.after(() => browser.close());

  async function withGame(run) {
    const context = await browser.newContext({ viewport: { width: 420, height: 650 } });
    const errors = [];
    try {
      // No real Electron bridge, save file, leaderboard, or external request.
      await context.route(/^https?:/, route => route.abort());
      await context.addInitScript(() => {
        window.electronAPI = {
          loadGame: async () => ({ playerName: 'NATIVE_INPUT_QA', tutorialSeen: true, musicVolume: 0, sfxVolume: 0, presentation: { introSeen: true, reducedMotion: true, effectsLevel: 'off' } }),
          saveGame: async () => true, submitScore: async () => 'OK', getLeaderboard: async () => JSON.stringify({scope:'local',metric:'best-bank-balance',limit:10,entries:[]}), closeApp: () => {}
        };
        window.nativeInputAudit = [];
        for (const type of ['keydown', 'keyup', 'click', 'drop', 'beforeinput', 'input']) {
          document.addEventListener(type, event => {
            const record = { type, code: event.code, repeat: event.repeat, inputType: event.inputType, trusted: event.isTrusted, target: event.target.id || event.target.className };
            // Native dispatch can run microtasks between listeners. Read the
            // final cancelled flag only when the completed event is inspected.
            Object.defineProperty(record, 'prevented', { enumerable: true, get: () => event.defaultPrevented });
            window.nativeInputAudit.push(record);
          }, true);
        }
      });
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href);
      await page.waitForFunction(() => window.RiskPresentation?.snapshot()?.playerName === 'NATIVE_INPUT_QA' && !window.RiskSaveLoading);
      await page.evaluate(() => {
        showPersistentUpgrades(); startGame();
        Math.random = () => 0.999; // No random trace or mini-game during a key test.
        money = 500; risk = 0; updateUI();
      });
      await run(page, context);
      assert.deepEqual(errors, [], 'page has no uncaught errors');
    } finally {
      await context.close();
    }
  }

  async function repeatedActivation(page, key) {
    await page.keyboard.down(key);
    await page.keyboard.down(key); // Playwright emits a native repeat:true event.
    await page.keyboard.up(key);
    const repeats = await page.evaluate(() => nativeInputAudit.filter(event => event.type === 'keydown' && event.repeat));
    assert.ok(repeats.length > 0, 'a real repeated keydown was delivered');
    assert.ok(repeats.every(event => event.prevented), 'native repeated activation defaults are cancelled');
  }

  await t.test('menu panels support Escape and return focus to their opener in both languages', () => withGame(async page => {
    await page.evaluate(() => { showBusted(); closeOverlays(); backToMenu(); });
    await page.waitForFunction(() => RiskPresentation.currentScreen() === 'menu');
    const gameState = () => page.evaluate(() => JSON.stringify({money,risk,totalMoney,multiplier,nodesHacked,nodesValidated,sessionHackCount,sessionStats,achievementStats,pUpgrades,prestigeLevel,prestigePoints}));
    const before = await gameState();
    const panels = [
      ['persistent', '.initiate', 'backToMenu()'],
      ['achievements', 'button[onclick="showAchievements()"]', 'backToMenuFromAchievements()'],
      ['leaderboard', 'button[onclick="showLeaderboard()"]', 'backToMenuFromLeaderboard()']
    ];
    for (const language of ['en', 'fr']) {
      await page.evaluate(language => RiskI18n.setLanguage(language), language);
      for (const [screen, selector, back] of panels) {
        const opener = page.locator(selector);
        await opener.focus(); await page.keyboard.press('Enter');
        await page.waitForFunction(screen => RiskPresentation.currentScreen() === screen, screen);
        await page.keyboard.press('Escape');
        await page.waitForFunction(() => RiskPresentation.currentScreen() === 'menu');
        assert.equal(await opener.evaluate(node => document.activeElement === node), true, screen + ' keyboard focus restored');
        await opener.click();
        await page.locator('button[onclick="' + back + '"]').click();
        assert.equal(await opener.evaluate(node => document.activeElement === node), true, screen + ' mouse return restores focus');
        assert.equal(await gameState(), before, 'navigation must not alter progress');
      }
    }
    // Escape during a run remains inert; it must not discard unsecured funds.
    await page.locator('.initiate').click(); await page.evaluate(() => startGame());
    const running = await gameState(); await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(() => RiskPresentation.currentScreen()), 'game');
    assert.equal(await gameState(), running);
  }));

  await t.test('held Enter makes exactly one hack', () => withGame(async page => {
    await page.locator('.btn-hack-safe').focus();
    await repeatedActivation(page, 'Enter');
    assert.deepEqual(await page.evaluate(() => ({ money, risk })), { money: 505, risk: 3 });
    assert.equal(await page.evaluate(() => nativeInputAudit.filter(event => event.type === 'click' && event.target.includes('btn-hack-safe')).length), 1);
  }));

  await t.test('held Enter stops bypass once without failing the next level', () => withGame(async page => {
    await page.evaluate(() => { risk = 50; bypassCharge = 15; bypass(); bypassGauge = bypassTarget; });
    await page.locator('#bypass-stop-button').focus();
    await repeatedActivation(page, 'Enter');
    assert.deepEqual(await page.evaluate(() => ({ screen: RiskPresentation.currentScreen(), stops: bypassLevel - 1, risk })), { screen: 'bypass', stops: 1, risk: 50 });
    assert.equal(await page.evaluate(() => nativeInputAudit.filter(event => event.type === 'click' && event.target === 'bypass-stop-button').length), 1);
  }));

  await t.test('held Enter cannot hack after closing Settings', () => withGame(async page => {
    await page.locator('.btn-hack-safe').focus();
    await page.evaluate(() => RelayUI.showSettings());
    await page.locator('#screen-settings button[onclick="closeSettings()"]').focus();
    await repeatedActivation(page, 'Enter');
    assert.deepEqual(await page.evaluate(() => ({ screen: RiskPresentation.currentScreen(), money, risk, focus: document.activeElement.className })), { screen: 'game', money: 500, risk: 0, focus: 'btn-hack btn-hack-safe' });
    assert.equal(await page.evaluate(() => nativeInputAudit.filter(event => event.type === 'click' && event.target.includes('btn-hack-safe')).length), 0);
  }));

  await t.test('held Space on an empty transfer cannot click the focused hack on release', () => withGame(async page => {
    await page.evaluate(() => { money = 0; updateUI(); });
    await page.locator('.btn-hack-safe').focus();
    await repeatedActivation(page, 'Space');
    assert.deepEqual(await page.evaluate(() => ({ screen: RiskPresentation.currentScreen(), money, risk })), { screen: 'game', money: 0, risk: 0 });
    assert.equal(await page.evaluate(() => nativeInputAudit.filter(event => event.type === 'click').length), 0);
  }));

  await t.test('Ctrl, Meta and Alt combinations never purchase a bonus', () => withGame(async page => {
    await page.evaluate(() => { risk = 50; updateUI(); });
    await page.locator('.btn-hack-safe').focus();
    for (const modifier of ['Control', 'Meta', 'Alt']) {
      await page.keyboard.press(modifier + '+a');
      assert.deepEqual(await page.evaluate(() => ({ money, risk })), { money: 500, risk: 50 }, modifier);
    }
    await page.keyboard.press('a');
    assert.deepEqual(await page.evaluate(() => ({ money, risk })), { money: 485, risk: 30 }, 'unmodified shortcut still works');
  }));

  await t.test('trusted text drop is blocked while ordinary case-insensitive typing succeeds', () => withGame(async (page, context) => {
    await page.evaluate(() => { nodesValidated = 2; startTypingProtocol(); });
    assert.equal(await page.locator('#typing-input').isDisabled(), true);
    const preparedAt = await page.evaluate(() => activeMiniGame.prepareDeadlineAt);
    await page.waitForFunction(() => typingStarted);
    assert.ok(await page.evaluate(deadline => performance.now() >= deadline, preparedAt), 'the actual three-second preparation elapsed');
    const phrase = await page.evaluate(() => typingPhrase);
    const multiplierBefore = await page.evaluate(() => multiplier);
    const box = await page.locator('#typing-input').boundingBox();
    const session = await context.newCDPSession(page);
    const data = { items: [{ mimeType: 'text/plain', data: phrase }], dragOperationsMask: 1 };
    for (const type of ['dragEnter', 'dragOver', 'drop']) {
      await session.send('Input.dispatchDragEvent', { type, x: box.x + 25, y: box.y + box.height / 2, data });
    }
    assert.equal(await page.locator('#typing-input').inputValue(), '');
    assert.equal(await page.evaluate(() => RiskPresentation.protocol().phase), 'active');
    const drops = await page.evaluate(() => nativeInputAudit.filter(event => event.type === 'drop'));
    assert.ok(drops.some(event => event.trusted && event.prevented), 'a trusted native drop was cancelled');
    // Exercise the paste fallback without reading or writing the host clipboard.
    assert.deepEqual(await page.locator('#typing-input').evaluate(input => [
      input.dispatchEvent(new InputEvent('beforeinput', { bubbles: true, cancelable: true, inputType: 'insertFromPaste', data: 'ignored' })),
      input.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true }))
    ]), [false, false]);
    await page.locator('#typing-input').focus();
    await page.keyboard.type(phrase.toUpperCase(), { delay: 10 });
    assert.deepEqual(await page.evaluate(() => ({ screen: RiskPresentation.currentScreen(), success: RiskPresentation.protocol().success, multiplier })), { screen: 'game', success: true, multiplier: multiplierBefore + 2 });
  }));

  await t.test('a new run clears old achievement toasts without losing a deferred memory achievement', () => withGame(async page => {
    const notification = page.locator('#relay-notification');
    await page.evaluate(() => { money = 0; updateUI(); });
    await page.locator('.btn-hack-safe').click();
    await page.locator('.btn-transfer').click();
    assert.equal(await page.evaluate(() => RiskPresentation.currentScreen()), 'success');
    assert.match(await notification.textContent(), /SURVIVOR/);
    assert.equal(await notification.evaluate(element => element.hidden), false, 'the completed run shows its earned achievement');
    await page.locator('#screen-success button[onclick="closeOverlays()"]').click();
    await page.locator('#screen-persistent button[onclick="startGame()"]').click();
    assert.equal(await page.evaluate(() => RiskPresentation.currentScreen()), 'game');
    assert.equal(await notification.evaluate(element => element.hidden), true, 'new gameplay clears the previous run toast');

    await page.evaluate(() => { bypassCharge = 15; updateUI(); });
    await page.locator('.btn-bypass').click();
    assert.equal(await page.evaluate(() => RiskPresentation.currentScreen()), 'bypass');
    await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(() => RiskPresentation.currentScreen()), 'game');
    assert.equal(await notification.evaluate(element => element.hidden), true, 'leaving a later protocol cannot replay a stale pending toast');

    // A genuine achievement earned inside a protocol must survive that protocol's
    // result delay. Set only the incoming run state, then select the actual ports.
    await page.evaluate(() => { sessionStats.maxRisk = 90; risk = 25; updateUI(); startBackdoorProtocol(); });
    await page.waitForFunction(() => backdoorStarted);
    const targets = await page.evaluate(() => backdoorTargetPositions.slice());
    for (const index of targets) await page.locator('.backdoor-cell[data-index="' + index + '"]').click();
    assert.equal(await page.evaluate(() => RiskPresentation.currentScreen()), 'backdoor');
    assert.equal(await page.evaluate(() => RiskPresentation.protocol().phase), 'result');
    assert.equal(await page.evaluate(() => achievements.comebackKing.unlocked), true);
    assert.equal(await notification.evaluate(element => element.hidden), true, 'the newly earned achievement stays deferred during the memory result');
    await page.waitForFunction(() => RiskPresentation.currentScreen() === 'game');
    assert.equal(await notification.evaluate(element => element.hidden), false);
    assert.match(await notification.textContent(), /COMEBACK KING/);
  }));
});

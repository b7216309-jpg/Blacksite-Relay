const closeTestApp = require('./close-test-app.cjs');
/* Bounded real Electron achievement review; isolated test profile and mocked services.
 * node scripts/verify-achievements-electron.cjs
 * RISK_V2_QA_DIR sets the output root; the normal player profile is never used.
 */
const path = require('node:path'), fs = require('node:fs/promises'), assert = require('node:assert/strict');
const repo = path.resolve(__dirname, '..'), { _electron: electron } = require('playwright');
const out = path.resolve(process.env.RISK_V2_QA_DIR || path.join(repo, 'dist', 'qa'), 'achievements-electron');
const profile = path.join(out, 'profile');
const report = { method: 'Real Electron, 420 x 650 at 100%, isolated save', captures: [], errors: [] };
(async () => {
  await fs.mkdir(profile, { recursive: true });
  await fs.writeFile(path.join(profile, 'user_data.json'), JSON.stringify({ totalMoney: 43, playerName: 'UNRANKED_UI_QA', achievements: { firstBlood: { unlocked: true }, cryptoMill: { unlocked: true } }, musicVolume: 0, sfxVolume: 0, tutorialSeen: true, presentation: { introSeen: true, reducedMotion: true } }));
  const app = await electron.launch({ executablePath: require('electron'), args: [repo, '--force-device-scale-factor=1'], env: { ...process.env, RISK_V2_TEST_MODE: '1', RISK_V2_USER_DATA_DIR: profile } });
  try {
    const page = await app.firstWindow(); page.on('pageerror', error => report.errors.push(error.message));
    await page.waitForFunction(() => !window.RiskSaveLoading && window.RiskPresentation?.snapshot().playerName === 'UNRANKED_UI_QA');
    await page.locator('#main-menu button[onclick="showAchievements()"]').click();
    await page.waitForFunction(() => document.activeElement.id === 'achievements-list');
    const catalog = await page.evaluate(() => getAchievementPresentation());
    assert.equal(catalog.length, 34);
    assert.equal(await page.locator('[data-achievement-filter],[data-difficulty],.challenge-tier,.achievement-filters').count(), 0);
    assert.deepEqual(await page.evaluate(() => RelayAchievements.getDiagnostics().visibleIds), catalog.map(row => row.id));
    const before = await page.evaluate(() => RiskPresentation.snapshot().totalMoney);
    const capture = async name => {
      await page.waitForTimeout(200);
      const state = await page.evaluate(() => ({ width: innerWidth, height: innerHeight, dpr: devicePixelRatio, focus: document.activeElement.id, count: document.querySelectorAll('.challenge-card').length, overflow: [...document.querySelectorAll('.challenge-card,.challenge-name,.challenge-description')].filter(node => node.scrollWidth > node.clientWidth + 1).map(node => node.textContent) }));
      assert.deepEqual(state.overflow, []); assert.equal(state.width, 420); assert.equal(state.height, 650); assert.equal(state.dpr, 1);
      await page.screenshot({ path: path.join(out, name + '.png') }); report.captures.push({ name, ...state });
    };
    await capture('catalog-top');
    await page.keyboard.press('End'); await page.waitForFunction(() => document.getElementById('achievements-list').scrollTop > 0);
    await capture('hidden-tail');
    for (const id of ['leeroyJenkins', 'hearthstone']) {
      assert.equal(await page.locator(`[data-achievement-id="${id}"] .challenge-name`).innerText(), 'HIDDEN CHALLENGE');
      assert.equal(await page.locator(`[data-achievement-id="${id}"] .challenge-progress`).count(), 0);
    }
    await page.keyboard.press('Tab'); assert.equal(await page.evaluate(() => document.activeElement.getAttribute('onclick')), 'backToMenuFromAchievements()');
    await page.keyboard.press('Shift+Tab'); assert.equal(await page.evaluate(() => document.activeElement.id), 'achievements-list');
    await page.evaluate(catalog => RelayAchievements.render(catalog.map(row => ({ ...row, unlocked: true }))), catalog);
    await page.locator('#achievements-list').evaluate(node => { node.scrollTop = node.scrollHeight; });
    await capture('completed-secrets');
    assert.equal(await page.locator('#achievement-progress').innerText(), '34/34 UNLOCKED');
    assert.equal(await page.evaluate(() => RiskPresentation.snapshot().totalMoney), before);
    assert.deepEqual(report.errors, []); report.passed = true;
  } finally { await closeTestApp(app); }
})().catch(error => { report.failure = error.stack; process.exitCode = 1; }).finally(async () => { await fs.writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 2)); });

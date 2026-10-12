/* Isolated actual-API browser checks; disposable mock saves and blocked HTTP.
 * node scripts/verify-achievements.cjs [--actual] [--native]
 * --actual is accepted for compatibility; the actual API is always the default.
 * --native is a compatibility flag for 1x headless browser capture only, not Electron.
 * Use verify-achievements-electron.cjs for the separate real Electron check.
 * RISK_V2_QA_DIR sets the report root; CHROMIUM_EXECUTABLE optionally selects Chromium.
 */
const path = require('node:path'), fs = require('node:fs/promises'), assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium, findChromium } = require('./protocol-environment-audit.cjs');
const repo = path.resolve(__dirname, '..'), nativeOnly = process.argv.includes('--native');
const out = path.resolve(process.env.RISK_V2_QA_DIR || path.join(repo, 'dist', 'qa'), nativeOnly ? 'achievements-native' : 'achievements');
const report = { source: 'Actual getAchievementPresentation API', checks: [], captures: [], errors: [] };
(async () => {
  await fs.mkdir(out, { recursive: true });
  const executablePath = findChromium();
  if (!executablePath) throw new Error('Chromium unavailable. Install it with npx playwright install chromium, or set CHROMIUM_EXECUTABLE.');
  const browser = await chromium.launch({ executablePath, headless: true, args: ['--allow-file-access-from-files'] });
  try {
    for (const scale of nativeOnly ? [1] : [1, 1.25, 1.5, 2]) {
      const context = await browser.newContext({ viewport: { width: 420, height: 650 }, deviceScaleFactor: scale });
      await context.route(/^https?:/, route => route.abort());
      await context.addInitScript(() => {
        window.__qaSaves = [];
        window.electronAPI = {
          loadGame: async () => ({ totalMoney: 43, playerName: 'ACHIEVEMENT_UI_QA', achievements: { firstBlood: { unlocked: true }, cryptoMill: { unlocked: true } }, achievementStats: { totalNodesValidated: 21, successfulSessions: 7, maxStreak: 8 }, musicVolume: 0, sfxVolume: 0, tutorialSeen: true, presentation: { introSeen: true, reducedMotion: true } }),
          saveGame: async data => { window.__qaSaves.push(data); return true; },
          getLeaderboard: async () => JSON.stringify({ dreamlo: { leaderboard: { entry: [] } } }), submitScore: async () => 'OK', closeApp: async () => true
        };
      });
      const page = await context.newPage();
      page.on('pageerror', error => report.errors.push(error.message));
      await page.goto(pathToFileURL(path.join(repo, 'index.html')).href);
      await page.waitForFunction(() => !window.RiskSaveLoading && window.RiskPresentation?.snapshot().playerName === 'ACHIEVEMENT_UI_QA');
      await page.locator('#main-menu button[onclick="showAchievements()"]').click();
      await page.waitForFunction(() => RiskPresentation.currentScreen() === 'achievements');
      assert.equal(await page.evaluate(() => typeof window.getAchievementPresentation), 'function');
      const initial = await page.evaluate(() => ({ bank: RiskPresentation.snapshot().totalMoney, saves: __qaSaves.length }));
      const capture = async name => {
        const geometry = await page.evaluate(() => {
          const panel = document.getElementById('screen-achievements'), list = document.getElementById('achievements-list');
          return { diagnostics: RelayAchievements.getDiagnostics(), heading: document.getElementById('achievement-progress').textContent, list: { height: list.clientHeight, scrollHeight: list.scrollHeight }, overflow: [...panel.querySelectorAll('.challenge-card,.challenge-name,.challenge-description')].filter(node => node.scrollWidth > node.clientWidth + 1).map(node => node.textContent), headingHeight: panel.querySelector('.panel-heading').getBoundingClientRect().height, focus: document.activeElement?.id };
        });
        assert.deepEqual(geometry.overflow, []);
        assert.equal(geometry.headingHeight, 105);
        const filename = `${String(scale).replace('.', '-')}-${name}.png`;
        await page.screenshot({ path: path.join(out, filename) });
        report.captures.push({ filename, scale, ...geometry });
      };
      const catalog = await page.evaluate(() => getAchievementPresentation());
      assert.equal(await page.locator('.challenge-card').count(), 34);
      assert.deepEqual(await page.evaluate(() => RelayAchievements.getDiagnostics().visibleIds), catalog.map(entry => entry.id));
      assert.equal(await page.locator('[data-achievement-filter],[data-difficulty],.challenge-tier,.achievement-filters').count(), 0);
      assert.equal(await page.locator('.challenge-card.secret:not(.unlocked) .challenge-progress').count(), 0);
      assert.equal(await page.locator('.challenge-card[data-achievement-id="cryptoMill"] .challenge-value').innerText(), 'COMPLETE');
      assert.equal(await page.evaluate(() => document.activeElement.id), 'achievements-list');
      for (const entry of catalog.filter(entry => entry.secret && !entry.unlocked)) {
        const text = await page.locator(`[data-achievement-id="${entry.id}"]`).innerText();
        assert.ok(!text.includes(entry.name) && !text.includes(entry.description), 'Secret condition is concealed');
      }
      await capture('catalog-top');
      await page.keyboard.press('End');
      await page.waitForFunction(() => document.getElementById('achievements-list').scrollTop > 0);
      await page.waitForTimeout(150);
      await capture('hidden-tail');
      await page.keyboard.press('Tab');
      assert.equal(await page.evaluate(() => document.activeElement.getAttribute('onclick')), 'backToMenuFromAchievements()');
      await page.keyboard.press('Shift+Tab');
      assert.equal(await page.evaluate(() => document.activeElement.id), 'achievements-list');
      for (const [name, id] of [['bypass', 'lockpickApp'], ['run-challenges', 'perfectRun']]) {
        await page.locator(`[data-achievement-id="${id}"]`).evaluate(node => node.scrollIntoView({ block: 'start' }));
        await capture(name);
      }
      const before = await page.locator('#achievements-list').evaluate(node => node.scrollTop);
      await page.evaluate(() => renderAchievementsList());
      assert.equal(await page.locator('#achievements-list').evaluate(node => node.scrollTop), before);
      await page.locator('#screen-achievements > button').click();
      await page.locator('#main-menu button[onclick="showAchievements()"]').click();
      await page.waitForFunction(() => RelayAchievements.getDiagnostics().screen === 'achievements');
      assert.equal(await page.locator('#achievements-list').evaluate(node => node.scrollTop), 0);
      assert.deepEqual(await page.evaluate(() => ({ bank: RiskPresentation.snapshot().totalMoney, saves: __qaSaves.length })), initial);
      report.checks.push({ scale, passed: true, checks: ['34 IDs in unmodified catalog order', 'no difficulty controls, labels or attributes', 'keyboard scroll, Tab and list focus', 'secret conditions/progress hidden', 'old unlocked milestone stays complete below target', 'no horizontal clipping', 'scroll retained during rerender; reopen at top', 'bank and save calls unchanged'] });
      await page.evaluate(data => RelayAchievements.render(data.map(entry => ({ ...entry, unlocked: true }))), catalog);
      await page.locator('#achievements-list').evaluate(node => { node.scrollTop = node.scrollHeight; });
      await capture('completed-secrets');
      assert.equal(await page.locator('#achievement-progress').innerText(), '34/34 UNLOCKED');
      assert.equal(await page.locator('.challenge-card.secret:not(.unlocked)').count(), 0);
      await context.close();
    }
    assert.deepEqual(report.errors, []); report.passed = true;
  } finally { await browser.close(); }
})().catch(error => { report.failure = error.stack; process.exitCode = 1; }).finally(async () => { await fs.writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 2)); });

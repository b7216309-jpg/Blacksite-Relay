const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs/promises'), path = require('node:path');
const { findChromium, chromium } = require('../scripts/protocol-environment-audit.cjs');
const executablePath = findChromium();

test('unranked achievement view preserves catalog order, truthful progress and keyboard access', {
  skip: executablePath ? false : 'Chromium unavailable; set CHROMIUM_EXECUTABLE.', timeout: 30000
}, async t => {
  const browser = await chromium.launch({ executablePath, headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 420, height: 650 } });
  const html = await fs.readFile(path.join(__dirname, '../index.html'), 'utf8');
  const panel = html.match(/<section id="screen-achievements"[\s\S]*?<\/section>/)[0].replace('display:none', 'display:flex');
  await page.setContent(`<span id="achievement-counter"></span>${panel}`);
  await page.addStyleTag({ path: path.join(__dirname, '../style.css') });
  await page.addStyleTag({ path: path.join(__dirname, '../src/relay-achievements.css') });
  await page.addScriptTag({ path: path.join(__dirname, '../src/relay-achievements.js') });
  const entries = [
    { id: 'hard-record', name: 'LONG RECORD', description: 'Complete 50 stops in one Bypass.', difficulty: 'hard', unlocked: false, secret: false, current: 12, target: 50, progressLabel: '12 / 50', scope: 'Best Bypass' },
    { id: 'secret', name: 'DO NOT REVEAL', description: 'Secret condition 719.', difficulty: 'medium', unlocked: false, secret: true, current: 13, target: 719, progressLabel: '13 / 719', scope: 'Hidden scope' },
    { id: 'retained', name: 'RETAINED BANK AWARD', description: 'Hold $10,000 in your bank.', difficulty: 'easy', unlocked: true, secret: false, current: 1, target: 10000, progressLabel: '$1 / $10,000', scope: 'Bank' },
    { id: 'binary', name: 'CLEAN SIGNAL', description: 'Complete Injection without a mistake.', difficulty: 'medium', unlocked: false, secret: false, current: 0, target: 1, progressLabel: '0 / 1', scope: 'One Injection' },
    { id: 'conditional', name: 'PERFECT RUN', description: 'Transfer $500 after 10 hacks below 50% risk.', difficulty: 'hard', unlocked: false, secret: false, current: null, target: null, progressLabel: '', scope: 'One run' }
  ];
  await page.evaluate(entries => {
    window.testEntries = Object.freeze(entries.map(entry => Object.freeze(entry)));
    window.getAchievementPresentation = () => testEntries;
    Math.random = () => { throw new Error('Achievement UI consumed gameplay randomness'); };
    document.dispatchEvent(new CustomEvent('risk:state', { detail: { screen: 'achievements' } }));
  }, entries);
  await t.test('secret conditions stay hidden and historical unlocks never show regressed progress', async () => {
    const secret = page.locator('[data-achievement-id="secret"]');
    assert.doesNotMatch(await secret.innerText(), /DO NOT REVEAL|719|13|Hidden scope/);
    assert.equal(await secret.locator('[role="progressbar"]').count(), 0);
    assert.equal(await page.locator('[data-achievement-id="binary"] [role="progressbar"]').count(), 0);
    assert.equal(await page.locator('[data-achievement-id="conditional"] [role="progressbar"]').count(), 0);
    const retained = page.locator('[data-achievement-id="retained"] [role="progressbar"]');
    assert.equal(await retained.getAttribute('aria-valuetext'), 'Complete');
    assert.equal(await retained.getAttribute('aria-valuenow'), await retained.getAttribute('aria-valuemax'));
    assert.equal(await page.locator('#achievement-counter').innerText(), '1/5');
  });
  await t.test('catalog order is untouched and no difficulty controls or labels are rendered', async () => {
    assert.deepEqual(await page.locator('.challenge-card').evaluateAll(nodes => nodes.map(node => node.dataset.achievementId)), entries.map(entry => entry.id));
    assert.equal(await page.locator('[data-achievement-filter],[data-difficulty],.challenge-tier,.achievement-filters').count(), 0);
    assert.equal(await page.evaluate(() => RelayAchievements.getDiagnostics().order), 'catalog');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'achievements-list');
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement.getAttribute('onclick')), 'backToMenuFromAchievements()');
    await page.keyboard.press('Shift+Tab');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'achievements-list');
  });
  await t.test('read-only rerender retains catalog and opening restores the top of the list', async () => {
    await page.evaluate(() => RelayAchievements.render(testEntries));
    assert.deepEqual(await page.evaluate(() => RelayAchievements.getDiagnostics().visibleIds), entries.map(entry => entry.id));
    assert.deepEqual(await page.evaluate(() => testEntries), entries);
    await page.evaluate(() => {
      document.dispatchEvent(new CustomEvent('risk:state', { detail: { screen: 'menu' } }));
      document.dispatchEvent(new CustomEvent('risk:state', { detail: { screen: 'achievements' } }));
    });
    assert.equal(await page.locator('.challenge-card').count(), 5);
    assert.equal(await page.locator('#achievements-list').evaluate(node => node.scrollTop), 0);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'achievements-list');
    const diagnostic = await page.evaluate(() => RelayAchievements.getDiagnostics());
    assert.equal(diagnostic.ownTimers, 0); assert.equal(diagnostic.ownAnimationFrames, 0);
  });
  await t.test('disposal removes state subscriptions without changing the data', async () => {
    await page.evaluate(() => RelayAchievements.dispose());
    await page.evaluate(() => document.dispatchEvent(new CustomEvent('risk:state', { detail: { screen: 'achievements' } })));
    assert.equal(await page.locator('.challenge-card').count(), 5);
    assert.equal(await page.evaluate(() => RelayAchievements.render(testEntries)), false);
    assert.equal(await page.evaluate(() => RelayAchievements.getDiagnostics().disposed), true);
    assert.deepEqual(await page.evaluate(() => testEntries), entries);
  });
});

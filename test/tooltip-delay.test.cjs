'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { findChromium, chromium, withGame } = require('../scripts/protocol-environment-audit.cjs');
const executablePath = findChromium();
const selector = '.bonus-section .btn-bonus';
const info = page => page.evaluate(() => ({ ...RelayUI.getTooltipDiagnostics(),
  text: document.getElementById('relay-tooltip').textContent,
  described: [...document.querySelectorAll('.bonus-section [aria-describedby="relay-tooltip"]')].map(e => [...e.parentElement.children].indexOf(e)) }));
async function point(page, index, dx = 0, dy = 0) {
  const box = await page.locator(selector).nth(index).boundingBox();
  await page.mouse.move(box.x + box.width / 2 + dx, box.y + box.height / 2 + dy);
}
async function setup(page) {
  await page.clock.install();
  await page.clock.pauseAt(new Date(Date.now() + 100));
  await page.mouse.move(2, 2);
}
async function focusFirst(page) {
  await page.locator('.btn-transfer').focus(); await page.keyboard.press('Tab');
  assert.equal(await page.locator(selector).first().evaluate(e => e === document.activeElement), true);
}
const cases = [
  ['hover waits exactly three seconds and keeps the visible tip contained', async page => {
    await point(page, 0); await page.clock.runFor(2999);
    assert.equal((await info(page)).visible, false); assert.equal((await info(page)).pending, true);
    await page.clock.runFor(1); assert.equal((await info(page)).visible, true);
    assert.equal(await page.locator(selector).first().getAttribute('aria-describedby'), 'relay-tooltip');
    const box = await page.locator('#relay-tooltip').boundingBox();
    assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.width <= 420 && box.y + box.height <= 650);
  }],
  ['movement and state refreshes within one hovered button never restart or bypass the delay', async page => {
    await point(page, 0); await page.clock.runFor(1000); await point(page, 0, 4);
    await page.evaluate(() => updateUI()); assert.equal((await info(page)).visible, false);
    await page.clock.runFor(1000); await point(page, 0, -4, 3);
    await page.clock.runFor(999); assert.equal((await info(page)).visible, false);
    await page.clock.runFor(1); assert.equal((await info(page)).visible, true);
  }],
  ['moving to another button cancels the first target and starts a fresh full delay', async page => {
    await point(page, 0); await page.clock.runFor(1999); await point(page, 1);
    await page.clock.runFor(1001); assert.equal((await info(page)).visible, false);
    assert.equal(await page.locator(selector).first().getAttribute('aria-describedby'), null);
    await page.clock.runFor(1998); assert.equal((await info(page)).visible, false);
    await page.clock.runFor(1); assert.equal((await info(page)).visible, true);
    assert.equal(await page.locator(selector).nth(1).getAttribute('aria-describedby'), 'relay-tooltip');
  }],
  ['real keyboard Tab focus uses the delay, and Escape dismisses without stale reopening', async page => {
    await focusFirst(page); await page.clock.runFor(2999); assert.equal((await info(page)).visible, false);
    await page.clock.runFor(1); assert.equal((await info(page)).visible, true);
    await page.keyboard.press('Escape'); assert.equal((await info(page)).visible, false);
    await page.evaluate(() => updateUI()); await page.clock.runFor(5000);
    assert.equal((await info(page)).pending, false); assert.equal((await info(page)).visible, false);
    await page.keyboard.press('Tab'); await page.clock.runFor(3000);
    assert.equal(await page.locator(selector).nth(1).getAttribute('aria-describedby'), 'relay-tooltip');
  }],
  ['click focus and resolved state updates do not reopen a dismissed tooltip', async page => {
    await point(page, 0); await page.clock.runFor(3000); assert.equal((await info(page)).visible, true);
    await page.mouse.down(); await page.mouse.up();
    assert.equal((await info(page)).visible, false); assert.equal((await info(page)).pending, false);
    await page.evaluate(() => { updateUI(); updateBonusPrices(); }); await page.clock.runFor(5000);
    assert.equal((await info(page)).visible, false); assert.equal((await info(page)).pending, false);
    await page.mouse.move(2, 2); await point(page, 0); await page.clock.runFor(3000);
    assert.equal((await info(page)).visible, true, 'a deliberate leave/re-entry can inspect the tooltip again');
  }],
  ['unavailable bonuses remain inspectable with delayed keyboard focus', async page => {
    await page.evaluate(() => { money = 0; updateUI(); }); await focusFirst(page);
    assert.equal(await page.locator(selector).first().getAttribute('aria-disabled'), 'true');
    await page.clock.runFor(3000); assert.equal((await info(page)).visible, true);
    await page.keyboard.press('Tab'); assert.equal((await info(page)).visible, false);
    await page.clock.runFor(2999); assert.equal((await info(page)).visible, false);
    await page.clock.runFor(1); assert.equal((await info(page)).visible, true);
  }]
];
for (const mode of ['leave', 'settings', 'minigame', 'quit', 'hidden', 'blur', 'resize']) {
  cases.push([`${mode} immediately cancels pending tooltip work with no delayed popup`, async page => {
    await point(page, 0); await page.clock.runFor(1000); assert.equal((await info(page)).pending, true);
    if (mode === 'leave') await page.mouse.move(2, 2);
    else await page.evaluate(mode => {
      if (mode === 'settings') RelayUI.showSettings();
      if (mode === 'minigame') { bypassCharge = 15; bypass(); }
      if (mode === 'quit') RiskQuit.request();
      if (mode === 'hidden') { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); }
      if (mode === 'blur') window.dispatchEvent(new Event('blur'));
      if (mode === 'resize') window.dispatchEvent(new Event('resize'));
    }, mode);
    assert.equal((await info(page)).pending, false); assert.equal((await info(page)).visible, false);
    await page.clock.runFor(5000); assert.equal((await info(page)).visible, false);
    assert.equal(await page.locator('.bonus-section [aria-describedby="relay-tooltip"]').count(), 0);
  }]);
}

test('bonus tooltip timing is deliberate and cancels stale interaction', {
  skip: executablePath ? false : 'Chromium unavailable; set CHROMIUM_EXECUTABLE.', timeout: 120000
}, async t => {
  const browser = await chromium.launch({ executablePath, headless: true, args: ['--allow-file-access-from-files'] });
  t.after(() => browser.close());
  for (const [name, run] of cases) await t.test(name, () => withGame(browser, async page => {
    await setup(page); await run(page);
  }, { preferences: { reducedMotion: true, effectsLevel: 'off' } }));
});

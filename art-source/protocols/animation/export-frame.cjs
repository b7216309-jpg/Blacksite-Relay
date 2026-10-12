#!/usr/bin/env node
/* Deterministic authoring export. No live save, leaderboard or gameplay action. */
const fs = require('node:fs/promises'), syncFS = require('node:fs'), path = require('node:path');
const { pathToFileURL } = require('node:url');
const repo = path.resolve(__dirname, '../../..');
const { chromium } = require(path.join(repo, 'node_modules/playwright'));
const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const key = process.argv[i].replace(/^--/, '');
  args[key] = process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[++i] : true;
}
function browserPath() {
  if (process.env.CHROMIUM_EXECUTABLE) return process.env.CHROMIUM_EXECUTABLE;
  if (syncFS.existsSync(chromium.executablePath())) return chromium.executablePath();
  const cache = path.join(process.env.LOCALAPPDATA || '', 'ms-playwright');
  if (syncFS.existsSync(cache)) for (const folder of syncFS.readdirSync(cache).filter(name => /^chromium-\d+$/.test(name)).sort((a, b) => Number(b.split('-')[1]) - Number(a.split('-')[1]))) {
    for (const suffix of ['chrome-win64/chrome.exe', 'chrome-win/chrome.exe']) {
      const file = path.join(cache, folder, suffix); if (syncFS.existsSync(file)) return file;
    }
  }
  throw new Error('Set CHROMIUM_EXECUTABLE to a local Chromium executable.');
}
(async () => {
  const game = String(args.game || 'bypass'), phase = String(args.phase || 'active');
  if (!['bypass', 'typing', 'backdoor'].includes(game)) throw new Error('game must be bypass, typing or backdoor');
  if (!['countdown', 'active', 'result'].includes(phase)) throw new Error('phase must be countdown, active or result');
  const time = Number(args.time ?? .12);
  if (!Number.isFinite(time) || time < 0) throw new Error('time must be a nonnegative number');
  const out = path.resolve(String(args.out || path.join(repo, '../protocol-animation/exports', game + '-' + phase + '.png')));
  await fs.mkdir(path.dirname(out), { recursive: true });
  const browser = await chromium.launch({ executablePath: browserPath(), headless: true, args: ['--allow-file-access-from-files'] });
  try {
    const page = await browser.newPage({ viewport: { width: 420, height: 650 } });
    await page.route(/^https?:/, route => route.abort());
    await page.addInitScript(() => { window.electronAPI = {
      loadGame: async () => ({ playerName: 'AUTHORING', tutorialSeen: true, musicVolume: 0, sfxVolume: 0, presentation: { introSeen: true } }),
      saveGame: async () => true, getLeaderboard: async () => [], submitScore: async () => {}, closeApp: () => {}
    }; });
    await page.goto(pathToFileURL(path.join(repo, 'index.html')).href);
    await page.waitForFunction(() => window.RelayProtocolLife?.getDiagnostics().ready);
    const options = { game, phase, effectsLevel: args.low ? 'low' : args.off ? 'off' : 'full',
      includeBackground: !!args.background, phaseTime: Number(args['phase-time'] ?? time),
      success: !args.failure, ...(args['stop-age'] !== undefined ? { stopAge: Number(args['stop-age']) } : {}) };
    const result = await page.evaluate(({ time, options }) => ({ definition: RelayProtocolLife.getDefinition(), frame: RelayProtocolLife.exportFrame(time, options) }), { time, options });
    if (!result.frame.image) throw new Error(result.frame.error || 'Frame export failed');
    await fs.writeFile(out, Buffer.from(result.frame.image.split(',')[1], 'base64'));
    const { image, ...frame } = result.frame;
    await fs.writeFile(out.replace(/\.png$/i, '') + '.json', JSON.stringify({ options, ...frame }, null, 2));
    if (args['write-definition']) await fs.writeFile(path.join(__dirname, 'hardware-definition.json'), JSON.stringify(result.definition, null, 2));
    console.log(JSON.stringify({ out, game, phase, time, pixels: frame.pixels, leds: frame.leds, sparks: frame.sparks }));
  } finally { await browser.close(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });

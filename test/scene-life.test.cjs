const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {chromium} = require('playwright');

function chromiumPath() {
  if (process.env.CHROMIUM_EXECUTABLE && fs.existsSync(process.env.CHROMIUM_EXECUTABLE)) return process.env.CHROMIUM_EXECUTABLE;
  if (fs.existsSync(chromium.executablePath())) return chromium.executablePath();
  const cache = path.join(process.env.LOCALAPPDATA || '', 'ms-playwright');
  if (!fs.existsSync(cache)) return null;
  for (const name of fs.readdirSync(cache).filter(name => /^chromium-\d+$/.test(name)).sort((a,b) => Number(b.split('-')[1])-Number(a.split('-')[1]))) {
    for (const suffix of ['chrome-win64/chrome.exe','chrome-win/chrome.exe']) {
      const candidate = path.join(cache,name,suffix);
      if (fs.existsSync(candidate)) return candidate;
    }
  }
  return null;
}
const executablePath = chromiumPath();
const captureDir = process.env.RISK_SCREEN_LIFE_QA_DIR;
if (captureDir) fs.mkdirSync(captureDir,{recursive:true});

test('screen hardware life stays decorative and quiet during challenges', {
  skip: executablePath ? false : 'Install Playwright Chromium or set CHROMIUM_EXECUTABLE.', timeout: 60000
}, async t => {
  const browser = await chromium.launch({executablePath,headless:true,args:['--allow-file-access-from-files']});
  t.after(() => browser.close());
  async function createPage() {
    const context = await browser.newContext({viewport:{width:420,height:650}});
    await context.route(/^https?:/, route => route.abort());
    await context.addInitScript(() => {
      window.electronAPI = {
        loadGame:async()=>({playerName:'HARDWARE_QA',tutorialSeen:true,musicVolume:0,sfxVolume:0,presentation:{introSeen:true,reducedMotion:false,effectsLevel:'full'}}),
        saveGame:async()=>true,submitScore:async()=>'OK',getLeaderboard:async()=>JSON.stringify({scope:'local',metric:'best-bank-balance',limit:10,entries:[]}),closeApp:()=>{}
      };
    });
    const page = await context.newPage(), errors = [];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(pathToFileURL(path.resolve(__dirname,'..','index.html')).href);
    await page.waitForFunction(()=>!window.RiskSaveLoading && window.RiskPresentation?.snapshot().playerName==='HARDWARE_QA');
    if (!await page.evaluate(()=>!!window.RelayScreenLife)) await page.addScriptTag({path:path.resolve(__dirname,'../src/relay-screen-life.js')});
    return {page,errors,close:()=>context.close()};
  }
  async function state(page) {
    return page.evaluate(()=>JSON.parse(JSON.stringify({money,totalMoney,risk,multiplier,nodesHacked,nodesValidated,bypassCharge,sessionHackCount,ghostShieldActive,insuranceTurns,overclockBonusTurns,achievements,achievementStats,sessionStats})));
  }
  async function prepareGame(page) {
    await page.evaluate(()=>{showPersistentUpgrades();startGame();money=500;risk=25;window.auditRandomCalls=0;Math.random=()=>{window.auditRandomCalls++;return .999;};updateUI();});
  }
  async function capture(page,name) {
    if(captureDir) {
      // Inspect the settled physical surface while retaining the selected lamp
      // moment. Finishing this cosmetic entry fade does not advance game time.
      await page.evaluate(()=>document.getAnimations().filter(animation=>animation.animationName==='panelIn').forEach(animation=>animation.finish()));
      await page.screenshot({path:path.join(captureDir,name+'.png'),animations:'allow'});
    }
  }
  async function contactMoment(page,time) {
    await page.evaluate(time=>{
      document.getAnimations().filter(animation=>animation.animationName==='screenLifeContact').forEach(animation=>{animation.pause();animation.currentTime=time;});
    },time);
  }

  await t.test('mounted lamps and action responses preserve resolved state and RNG consumption',async()=>{
    const live=await createPage(),baseline=await createPage();
    try {
      await contactMoment(live.page,310);await capture(live.page,'01-menu-contact-a');
      await contactMoment(live.page,630);await capture(live.page,'02-menu-contact-b');
      await baseline.page.evaluate(()=>RelayScreenLife.dispose());
      await prepareGame(live.page);await prepareGame(baseline.page);
      for(const action of ['hack(1)','hack(1)','buyBonus(1)','hack(2)','hack(3)']) {
        await live.page.evaluate(action);await baseline.page.evaluate(action);
        assert.deepEqual(await state(live.page),await state(baseline.page),action);
        assert.equal(await live.page.evaluate(()=>auditRandomCalls),await baseline.page.evaluate(()=>auditRandomCalls),action+' RNG');
      }
      await live.page.evaluate(()=>document.getAnimations().filter(animation=>animation.effect?.target?.closest?.('.screen-life-key-edge')).forEach(animation=>{animation.pause();animation.currentTime=140;}));
      await capture(live.page,'03-game-key-edge');
      const geometry=await live.page.locator('.screen-life-contacts,.screen-life-key-edge').evaluateAll(nodes=>nodes.filter(node=>node.getClientRects().length).map(node=>{
        const a=node.getBoundingClientRect(),b=node.parentElement.getBoundingClientRect();
        return {contained:a.left>=b.left&&a.right<=b.right&&a.top>=b.top&&a.bottom<=b.bottom,pointer:getComputedStyle(node).pointerEvents,hidden:node.getAttribute('aria-hidden')};
      }));
      assert.ok(geometry.length>0);assert.ok(geometry.every(node=>node.contained&&node.pointer==='none'&&node.hidden==='true'));
      assert.deepEqual(live.errors,[]);assert.deepEqual(baseline.errors,[]);
    } finally {await live.close();await baseline.close();}
  });

  await t.test('legacy interface contacts do not duplicate the dedicated protocol hardware pass',async()=>{
    const {page,errors,close}=await createPage();
    try {
      await prepareGame(page);
      // A deterministic shuffled target sample, independent from cosmetic lamps.
      await page.evaluate(()=>{let seed=41;Math.random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};startBackdoorProtocol();});
      const targets=await page.evaluate(()=>[...backdoorTargetPositions]);
      assert.equal(await page.evaluate(()=>RelayScreenLife.stats().movingContacts),0);
      await contactMoment(page,320);await capture(page,'04-memory-reveal-contacts');
      await page.waitForFunction(()=>backdoorStarted);
      assert.equal(await page.evaluate(()=>RelayScreenLife.stats().movingContacts),0);
      assert.deepEqual(await page.evaluate(()=>[...backdoorTargetPositions]),targets);
      assert.equal(await page.locator('#backdoor-grid [data-state="target"]').count(),0);
      await capture(page,'05-memory-recall-quiet');
      await page.evaluate(()=>backdoorTargetPositions.forEach(index=>document.getElementById('backdoor-grid').children[index].click()));
      assert.equal(await page.evaluate(()=>RelayScreenLife.stats().movingContacts),0);
      await contactMoment(page,350);await capture(page,'06-memory-result-contacts');
      await page.waitForFunction(()=>RiskPresentation.currentScreen()==='game');
      await page.evaluate(()=>startTypingProtocol());
      assert.equal(await page.evaluate(()=>RelayScreenLife.stats().movingContacts),0);
      await contactMoment(page,320);await capture(page,'07-typing-preparation-contacts');
      await page.waitForFunction(()=>typingStarted);
      assert.equal(await page.evaluate(()=>RelayScreenLife.stats().movingContacts),0);
      await capture(page,'08-typing-active-quiet');
      await page.evaluate(()=>{document.getElementById('typing-input').value=typingPhrase;checkTypingInput();bypassCharge=15;bypass();});
      assert.equal(await page.evaluate(()=>RelayScreenLife.stats().movingContacts),0);
      assert.equal(await page.evaluate(()=>RelayScreenLife.stats().activeGlints),0);
      await capture(page,'09-bypass-quiet');
      assert.deepEqual(errors,[]);
    } finally {await close();}
  });

  await t.test('event bursts stay bounded and reduced/static/background/disposal stop added motion',async()=>{
    const {page,errors,close}=await createPage();
    try {
      await prepareGame(page);const before=await state(page),calls=await page.evaluate(()=>auditRandomCalls);
      await page.evaluate(()=>{
        for(let i=0;i<100;i++) {
          document.dispatchEvent(new CustomEvent('risk:event',{detail:Object.freeze({type:'hack',hackType:i%3+1})}));
          document.dispatchEvent(new CustomEvent('risk:event',{detail:Object.freeze({type:'bonus',bonusId:i%6+1})}));
        }
      });
      assert.deepEqual(await state(page),before);assert.equal(await page.evaluate(()=>auditRandomCalls),calls);
      const burst=await page.evaluate(()=>RelayScreenLife.stats());
      assert.ok(burst.activeGlints<=9);assert.equal(burst.timers,0);assert.equal(burst.animationFrameLoops,0);
      for(const preferences of [{reducedMotion:true},{reducedMotion:false,effectsLevel:'off'}]) {
        await page.evaluate(preferences=>RiskPresentation.setPreferences(preferences),preferences);
        assert.equal(await page.evaluate(()=>RelayScreenLife.stats().activeGlints),0);
        assert.equal(await page.evaluate(()=>RelayScreenLife.stats().movingContacts),0);
      }
      await page.evaluate(()=>{RiskPresentation.setPreferences({effectsLevel:'full'});Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});
      assert.equal(await page.evaluate(()=>RelayScreenLife.stats().movingContacts),0);
      await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});
      assert.equal(await page.evaluate(()=>RelayScreenLife.stats().movingContacts),1);
      await page.evaluate(()=>{RelayScreenLife.dispose();RelayScreenLife.dispose();});
      assert.equal(await page.locator('.screen-life-contacts,.screen-life-key-edge').count(),0);
      assert.equal(await page.evaluate(()=>RelayScreenLife.stats().activeGlints),0);
      assert.equal(await page.evaluate(()=>RelayScreenLife.stats().disposed),true);
      assert.deepEqual(errors,[]);
    } finally {await close();}
  });
});

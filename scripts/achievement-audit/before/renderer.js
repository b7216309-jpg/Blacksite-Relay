// ==========================================
// --- SYSTEME DE COMMUNICATION (IPC) ---
// ==========================================

// Utilise le bridge sécurisé exposé par preload.js
// Plus de require('electron') - contextIsolation activé

window.RiskSaveLoading = true;
window.RiskSaveReadBlocked = false;
let saveLoadPromise = null;
let saveWritePromise = null;
let pendingSaveState = null;
let lastSaveProblem = '';
if (document.body) document.body.inert = true;
// The menu exists before window.onload and IPC may be slow. Capture input before
// inline handlers or UI listeners can start a run or save uninitialized defaults.
for (const type of ['pointerdown', 'click', 'keydown', 'input', 'change']) {
    document.addEventListener(type, event => {
        if (!window.RiskSaveLoading) return;
        event.preventDefault?.(); event.stopImmediatePropagation?.();
    }, true);
}

function saveStatus(state) {
    if (document.body) document.body.dataset.saveState = state;
    document.dispatchEvent(new CustomEvent('risk:save-state', { detail: { state } }));
    const message = state === 'load-error' ? 'Save unavailable. Your existing save is protected; restart to retry.'
        : state === 'save-error' ? 'Save failed. Your previous save is protected; changes will retry on the next save.' : '';
    if (message && message !== lastSaveProblem) window.RelayUI?.notify?.(message);
    lastSaveProblem = message;
}

window.quitGame = async function() {
    if (saveLoadPromise) await saveLoadPromise;
    await window.saveGameState();
    window.electronAPI.closeApp();
};

window.saveGameState = function() {
    if (window.RiskSaveLoading || window.RiskSaveReadBlocked) return Promise.resolve(false);
    try {
        pendingSaveState = window.RiskSaveSchema.normalizeForWrite({
            money, totalMoney, risk, playerName, pUpgrades, achievements,
            achievementStats, musicVolume, sfxVolume, prestigeLevel, prestigePoints,
            tutorialSeen, presentation: { ...presentationPreferences }
        });
    } catch (_) { saveStatus('save-error'); return Promise.resolve(false); }
    if (!pendingSaveState) { saveStatus('save-error'); return Promise.resolve(false); }
    if (saveWritePromise) return saveWritePromise;
    return drainPendingSaves();
};

function drainPendingSaves() {
    // One active write plus the newest immutable snapshot avoids stale overwrite
    // and unbounded pending IPC calls when sliders/achievements fire together.
    saveWritePromise = (async () => {
        let saved = false;
        while (pendingSaveState) {
            const snapshot = pendingSaveState; pendingSaveState = null;
            saveStatus('saving');
            try { saved = await window.electronAPI.saveGame(snapshot) === true; }
            catch (_) { saved = false; }
            saveStatus(saved ? 'saved' : 'save-error');
        }
        return saved;
    })().then(saved => {
        saveWritePromise = null;
        // A caller may enqueue in the microtask between the last await and this
        // continuation. Drain it before settling the shared save promise.
        return pendingSaveState ? drainPendingSaves() : saved;
    }, () => {
        saveWritePromise = null;
        saveStatus('save-error');
        return pendingSaveState ? drainPendingSaves() : false;
    });
    return saveWritePromise;
}

function loadSavedGame() {
    if (saveLoadPromise) return saveLoadPromise;
    window.RiskSaveLoading = true;
    if (document.body) document.body.inert = true;
    saveStatus('loading');
    saveLoadPromise = Promise.resolve().then(async () => {
        try {
            const raw = await window.electronAPI.loadGame();
            const data = raw == null ? null : window.RiskSaveSchema.normalize(raw);
            if (raw != null && !data) throw new Error('Unrecognized save');
            if (data) {
                money = data.money; totalMoney = data.totalMoney; playerName = data.playerName;
                for (const key of Object.keys(pUpgrades)) pUpgrades[key].lvl = data.pUpgrades[key].lvl;
                for (const key of Object.keys(achievements)) achievements[key].unlocked = data.achievements[key].unlocked;
                achievementStats = data.achievementStats;
                musicVolume = data.musicVolume; sfxVolume = data.sfxVolume;
                prestigeLevel = data.prestigeLevel; prestigePoints = data.prestigePoints;
                tutorialSeen = data.tutorialSeen;
                applyPresentationPreferences(data.presentation);
                window.RelayAudio?.setVolumes(musicVolume, sfxVolume);
                updateVolumeDisplays();
                const nameInput = document.getElementById('player-name');
                if (nameInput) nameInput.value = playerName;
                updateUI(); updatePersistentUI(); renderAchievementsList();
            }
            window.RiskSaveReadBlocked = false;
            saveStatus('ready');
            return true;
        } catch (_) {
            window.RiskSaveReadBlocked = true;
            saveStatus('load-error');
            return false;
        } finally {
            window.RiskSaveLoading = false;
            if (document.body) document.body.inert = false;
            saveLoadPromise = null;
        }
    });
    return saveLoadPromise;
}

// ==========================================
// --- FIN DU SYSTEME IPC ---
// ==========================================

let money = 0;
let risk = 0;
let totalMoney = 0;
let playerName = "ANONYMOUS";

// --- PRESTIGE SYSTEM ---
let prestigeLevel = 0;
let prestigePoints = 0;
let tutorialSeen = false;

function getPrestigeBonus() {
    return {
        gainMult: 1 + (prestigePoints * 0.10),
        riskReduction: Math.min(1, prestigePoints * 0.02),
        startMoney: prestigePoints * 50
    };
}

function getPrestigeCost() {
    return 200000 * Math.pow(5, prestigeLevel);
}
// -------------------------

const pUpgrades = {
    ram: { lvl: 0, max: Infinity },
    vpn: { lvl: 0, max: 30 },
    miner: { lvl: 0, max: Infinity },
    fan: { lvl: 0, max: 40 },
    algo: { lvl: 0, max: 4 },
    volt: { lvl: 0, max: 40 }
};

// --- SYSTEME D'ACHIEVEMENTS ---
let achievements = {
    // Progression
    firstBlood: { unlocked: false, name: "FIRST_BLOOD", desc: "Earn 100$", icon: "[$]" },
    cryptoMill: { unlocked: false, name: "CRYPTO_MILLIONAIRE", desc: "Reach 10,000$ total", icon: "[*]" },
    whaleStatus: { unlocked: false, name: "WHALE_STATUS", desc: "Reach 100,000$ total", icon: "[W]" },
    nodeRunner: { unlocked: false, name: "NODE_RUNNER", desc: "Validate 10 nodes", icon: "[#]" },
    networkMaster: { unlocked: false, name: "NETWORK_MASTER", desc: "Validate 100 nodes", icon: "[@]" },

    // Risk
    livingDanger: { unlocked: false, name: "LIVING_DANGEROUSLY", desc: "Survive 80%+ risk", icon: "[!]" },
    onTheEdge: { unlocked: false, name: "ON_THE_EDGE", desc: "Survive 95%+ risk", icon: "[~]" },
    comebackKing: { unlocked: false, name: "COMEBACK_KING", desc: "Drop from 90%+ to 0% risk", icon: "[K]" },
    riskTaker: { unlocked: false, name: "RISK_TAKER", desc: "Reach 99% risk", icon: "[X]" },
    untouchable: { unlocked: false, name: "UNTOUCHABLE", desc: "Finish with 0% risk and 500$+", icon: "[=]" },

    // Bypass
    lockpickApp: { unlocked: false, name: "LOCKPICK_APPRENTICE", desc: "Bypass level 5", icon: "[>]" },
    masterHacker: { unlocked: false, name: "MASTER_HACKER", desc: "Bypass level 20", icon: "[%]" },
    legendaryCrack: { unlocked: false, name: "LEGENDARY_CRACKER", desc: "Bypass level 50", icon: "[&]" },
    speedRunner: { unlocked: false, name: "SPEED_RUNNER", desc: "10 bypasses at level 10+", icon: "[/]" },
    bypassAddict: { unlocked: false, name: "BYPASS_ADDICT", desc: "Use bypass 50 times", icon: "[+]" },

    // Combat/Strategy
    comboSpec: { unlocked: false, name: "COMBO_SPECIALIST", desc: "Complete 10 hacks in one run", icon: "[)]" },
    multMadness: { unlocked: false, name: "MULTIPLIER_MADNESS", desc: "x20 multiplier", icon: "[^]" },
    ghostProto: { unlocked: false, name: "GHOST_PROTOCOL", desc: "Use ghost shield 10 times", icon: "[?]" },
    luckyGambler: { unlocked: false, name: "LUCKY_GAMBLER", desc: "Win 10 jackpots", icon: "[7]" },
    fullArsenal: { unlocked: false, name: "FULL_ARSENAL", desc: "Buy all bonuses in a single session", icon: "[A]" },

    // Survival
    survivor: { unlocked: false, name: "SURVIVOR", desc: "5 successful sessions", icon: "[v]" },
    veteran: { unlocked: false, name: "VETERAN", desc: "25 successful sessions", icon: "[V]" },
    immortal: { unlocked: false, name: "IMMORTAL", desc: "100 successful sessions", icon: "[8]" },
    closeCall: { unlocked: false, name: "CLOSE_CALL", desc: "Ghost shield saved you 5 times", icon: "[+]" },
    perfectRun: { unlocked: false, name: "PERFECT_RUN", desc: "Session without exceeding 50% risk", icon: "[*]" },

    // Secrets
    brain404: { unlocked: false, name: "404_BRAIN_NOT_FOUND", desc: "Get busted with 0$", icon: "[0]", secret: true },
    yoloMode: { unlocked: false, name: "YOLO_MODE_ACTIVATED", desc: "Gamble 10 times in one run", icon: "[Y]", secret: true },
    negotiator: { unlocked: false, name: "THE_NEGOTIATOR", desc: "Hold 1000$+ for 30 min without transfer", icon: "[N]", secret: true },
    masochist: { unlocked: false, name: "MASOCHIST", desc: "Full session using BRUTE_FORCE only", icon: "[M]", secret: true },
    balanced: { unlocked: false, name: "PERFECTLY_BALANCED", desc: "Finish with exactly 67% risk", icon: "[-]", secret: true },

    // Prestige
    ascended: { unlocked: false, name: "ASCENDED", desc: "Prestige for the first time", icon: "[P]" },
    transcended: { unlocked: false, name: "TRANSCENDED", desc: "Reach prestige level 3", icon: "[T]" }
};

let achievementStats = {
    totalNodesValidated: 0,
    successfulSessions: 0,
    bypassCount: 0,
    bypassLevel10Plus: 0,
    ghostShieldUses: 0,
    ghostShieldSaves: 0,
    jackpotsWon: 0,
    maxRiskSurvived: 0,
    gambleStreak: 0,
    maxGambleStreak: 0,
    highMoneyTime: 0,
    negotiatorStartTime: 0,
    bruteForceOnly: true,
    maxStreak: 0,
    boughtAllBonusesThisSession: false,
    bonusesBoughtThisSession: [],
    comebackAchieved: false,
    perfectRunActive: true
};
// ------------------------------

let multiplier = 1;
let streakCounter = 0;
// Successful hacks in this run; the multiplier's short streak resets every 2–3 hacks.
let sessionHackCount = 0;
let nodesHacked = 0;
const nodesPerLevel = 100;
let insuranceTurns = 0;
let coolerPurchases = 0;
let proxyPurchases = 0;
let ghostPurchases = 0;
let nodesValidated = 0;

let ghostShieldActive = false;
let ghostCooldown = 0;

let overclockCooldown = 0;
let overclockBonusTurns = 0;

let gambleCooldown = 0;

// --- STATISTIQUES DE SESSION ---
let sessionStats = {
    maxRisk: 0,
    maxNodes: 0,
    maxMultiplier: 1
};

function updateSessionStats() {
    if (risk > sessionStats.maxRisk) sessionStats.maxRisk = risk;
    if (risk > 50) achievementStats.perfectRunActive = false;
    if (nodesValidated > sessionStats.maxNodes) sessionStats.maxNodes = nodesValidated;
    if (multiplier > sessionStats.maxMultiplier) sessionStats.maxMultiplier = multiplier;
}

function resetSessionStats() {
    sessionStats = { maxRisk: 0, maxNodes: 0, maxMultiplier: 1 };
}
// ------------------------------

let bypassLevel = 1;
let bypassGauge = 0;
let bypassDirection = 1;
let bypassSpeed = 0.8;
let bypassTarget = 50;
let bypassTolerance = 18;
let bypassInterval = null;
let bypassCharge = 0;
const bypassChargeMax = 15;

// --- TYPING PROTOCOL MINI-GAME ---
let typingActive = false;
let typingPhrase = "";
let typingInput = "";
let typingErrors = 0;
const typingMaxErrors = 3;

let typingTimeout = null;
const typingTimeLimit = 5000;
let typingCountdown = 3;
let typingCountdownInterval = null;
let typingStarted = false;
let typingDeadlineAt = 0;

const typingWords = [
    "root", "admin", "access", "denied", "system", "hacked", "bypass", "proxy", "server",
    "node", "miner", "crypto", "token", "block", "chain", "secure", "login", "shell",
    "script", "exploit", "zero", "day", "virus", "trojan", "worm", "botnet", "ddos",
    "inject", "query", "stack", "trace", "patch", "update", "upload", "download", "kernel",
    "memory", "buffer", "overflow", "cipher", "encrypt", "decrypt", "key", "hash", "salt",
    "brute", "force", "scan", "port", "socket", "firewall", "mainframe", "data", "link",
    "breach", "target", "user", "pass", "bios", "cmos", "boot", "lan", "wan", "wifi"
];

// --- BACKDOOR PROTOCOL VARIABLES ---
let backdoorActive = false;
let backdoorStarted = false;
let backdoorClicked = 0;
let backdoorErrors = 0;
let backdoorCountdown = 3;
let backdoorTargetPositions = [];
let backdoorGridSize = 8;
let backdoorTargetCount = 5;
let backdoorCountdownInterval = null;
let backdoorTimer = null;
let backdoorTimeLeft = 8;
let backdoorDeadlineAt = 0;

// --- LOG SYSTEM (multi-line) ---
const logHistory = [];
const LOG_MAX = 3;

// Original audio is handled by the bounded Web Audio mixer.
function initAudioPool() { window.RelayAudio?.setVolumes(musicVolume, sfxVolume); }

function formatNumber(num) {
    if (!Number.isFinite(num)) return 'MAX';
    if (num >= 1e15) return num.toExponential(2);
    if (num >= 1e12) return (num / 1e12).toFixed(1) + 'T';
    if (num >= 1e9) return (num / 1e9).toFixed(1) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(1) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(1) + 'K';
    return num.toFixed(0);
}

// --- FONCTIONS ACHIEVEMENTS ---
function unlockAchievement(key) {
    if (!achievements[key] || achievements[key].unlocked) return;
    achievements[key].unlocked = true;
    relayEvent('achievement', {key,name:achievements[key].name});
    showAchievementPopup(achievements[key]);
    renderAchievementsList();
    window.saveGameState();
}

function showAchievementPopup(achievement) {
    if(window.RelayUI?.notify) {
        window.RelayUI.notify(achievement.name+' — '+achievement.desc);
        return;
    }
    const popup = document.createElement('div');
    popup.className = 'achievement-popup';
    popup.style.cssText = `
        position: fixed; top: 20px; right: 20px;
        background: rgba(0, 242, 255, 0.95); color: black;
        padding: 15px 20px; border-radius: 8px;
        font-size: 0.75rem; font-weight: bold;
        box-shadow: 0 0 20px rgba(0, 242, 255, 0.5);
        z-index: 10000; animation: slideIn 0.3s ease-out;
        pointer-events: none;
    `;
    popup.innerHTML = `<span style="font-family:monospace;">${achievement.icon}</span> ${achievement.name}<br><span style="font-size: 0.75rem; opacity: 0.8;">${achievement.desc}</span>`;
    document.body.appendChild(popup);

    setTimeout(() => {
        popup.style.animation = 'slideOut 0.3s ease-in';
        setTimeout(() => popup.remove(), 300);
    }, 2000);
}

function checkBankAchievements() {
    if (!achievements.firstBlood.unlocked && totalMoney >= 100) unlockAchievement('firstBlood');
    if (!achievements.cryptoMill.unlocked && totalMoney >= 10000) unlockAchievement('cryptoMill');
    if (!achievements.whaleStatus.unlocked && totalMoney >= 100000) unlockAchievement('whaleStatus');
}

function checkAchievements() {
    checkBankAchievements();
    if (!achievements.nodeRunner.unlocked && achievementStats.totalNodesValidated >= 10) unlockAchievement('nodeRunner');
    if (!achievements.networkMaster.unlocked && achievementStats.totalNodesValidated >= 100) unlockAchievement('networkMaster');

    if (!achievements.livingDanger.unlocked && risk >= 80) unlockAchievement('livingDanger');
    if (!achievements.onTheEdge.unlocked && risk >= 95) unlockAchievement('onTheEdge');
    if (!achievements.riskTaker.unlocked && risk >= 99) unlockAchievement('riskTaker');
    if (risk > achievementStats.maxRiskSurvived) achievementStats.maxRiskSurvived = risk;

    if (!achievements.comboSpec.unlocked && sessionHackCount >= 10) unlockAchievement('comboSpec');
    if (!achievements.multMadness.unlocked && multiplier >= 20) unlockAchievement('multMadness');
    if (!achievements.ghostProto.unlocked && achievementStats.ghostShieldUses >= 10) unlockAchievement('ghostProto');
    if (!achievements.luckyGambler.unlocked && achievementStats.jackpotsWon >= 10) unlockAchievement('luckyGambler');
    if (!achievements.closeCall.unlocked && achievementStats.ghostShieldSaves >= 5) unlockAchievement('closeCall');
    if (!achievements.fullArsenal.unlocked && achievementStats.boughtAllBonusesThisSession) unlockAchievement('fullArsenal');

    if (!achievements.lockpickApp.unlocked && bypassLevel - 1 >= 5) unlockAchievement('lockpickApp');
    if (!achievements.masterHacker.unlocked && bypassLevel - 1 >= 20) unlockAchievement('masterHacker');
    if (!achievements.legendaryCrack.unlocked && bypassLevel - 1 >= 50) unlockAchievement('legendaryCrack');
    if (!achievements.bypassAddict.unlocked && achievementStats.bypassCount >= 50) unlockAchievement('bypassAddict');
    if (!achievements.speedRunner.unlocked && achievementStats.bypassLevel10Plus >= 10) unlockAchievement('speedRunner');

    if (!achievements.survivor.unlocked && achievementStats.successfulSessions >= 5) unlockAchievement('survivor');
    if (!achievements.veteran.unlocked && achievementStats.successfulSessions >= 25) unlockAchievement('veteran');
    if (!achievements.immortal.unlocked && achievementStats.successfulSessions >= 100) unlockAchievement('immortal');

    if (sessionHackCount > achievementStats.maxStreak) achievementStats.maxStreak = sessionHackCount;
    if (!achievements.comebackKing.unlocked && sessionStats.maxRisk >= 90 && risk === 0) {
        achievementStats.comebackAchieved = true;
        unlockAchievement('comebackKing');
    }

    if (achievementStats.perfectRunActive && risk > 50) achievementStats.perfectRunActive = false;

    // Negotiator: track time with 1000$+ money
    if (money >= 1000) {
        if (achievementStats.negotiatorStartTime === 0) {
            achievementStats.negotiatorStartTime = Date.now();
        }
        if (!achievements.negotiator.unlocked &&
            (Date.now() - achievementStats.negotiatorStartTime) >= 30 * 60 * 1000) {
            unlockAchievement('negotiator');
        }
    } else {
        achievementStats.negotiatorStartTime = 0;
    }

    // Prestige achievements
    if (!achievements.ascended.unlocked && prestigeLevel >= 1) unlockAchievement('ascended');
    if (!achievements.transcended.unlocked && prestigeLevel >= 3) unlockAchievement('transcended');
}

function checkSessionEndAchievements() {
    if (sessionHackCount === 0) return;
    if (!achievements.untouchable.unlocked && risk === 0 && money >= 500) unlockAchievement('untouchable');
    if (!achievements.perfectRun.unlocked && achievementStats.perfectRunActive && money > 0) unlockAchievement('perfectRun');
    if (!achievements.balanced.unlocked && Math.abs(risk - 67) < 1e-9) unlockAchievement('balanced');
    if (!achievements.fullArsenal.unlocked && achievementStats.boughtAllBonusesThisSession) unlockAchievement('fullArsenal');
    if (!achievements.masochist.unlocked && achievementStats.bruteForceOnly && money > 100) unlockAchievement('masochist');
}

function resetSessionAchievementStats() {
    achievementStats.gambleStreak = 0;
    achievementStats.bruteForceOnly = true;
    achievementStats.comebackAchieved = false;
    achievementStats.perfectRunActive = true;
    achievementStats.boughtAllBonusesThisSession = false;
    achievementStats.bonusesBoughtThisSession = [];
    achievementStats.highMoneyTime = 0;
    achievementStats.negotiatorStartTime = 0;
}

// Configuration initiale Audio
let musicVolume = 0.5;
let sfxVolume = 0.5;
function playSfx(name) { window.RelayAudio?.play(name); }
function updateVolumeDisplays() {
    for (const [kind,volume] of [['music',musicVolume],['sfx',sfxVolume]]) {
        const value = document.getElementById(kind+'-vol-val');
        const slider = document.getElementById(kind+'-slider');
        if(value) value.textContent = Math.round(volume*100)+'%';
        if(slider) slider.value = volume;
    }
}
function updateMusicVolume(val) {
    musicVolume = Math.min(1, Math.max(0, Number(val) || 0));
    window.RelayAudio?.setVolumes(musicVolume,sfxVolume);
    updateVolumeDisplays(); window.saveGameState();
}
function updateSfxVolume(val) {
    sfxVolume = Math.min(1, Math.max(0, Number(val) || 0));
    window.RelayAudio?.setVolumes(musicVolume,sfxVolume);
    updateVolumeDisplays(); window.saveGameState();
}

// --- DOM CACHE ---
let moneyFill, riskFill, nodeFill, moneyText, riskText, nodeText, totalMoneyDisplays, logEl, screenBusted, screenSuccess, screenPersistent, screenLeaderboard, leaderboardList, successAmountText, mainMenu, playerNameInput;

window.onload = async () => {
    initAudioPool();



    const mSlider = document.getElementById('music-slider');
    if (mSlider) mSlider.addEventListener('input', (e) => updateMusicVolume(e.target.value));

    const sSlider = document.getElementById('sfx-slider');
    if (sSlider) sSlider.addEventListener('input', (e) => updateSfxVolume(e.target.value));

    const unlockAudio = () => window.RelayAudio?.unlock();
    document.addEventListener('pointerdown', unlockAudio, { once: true });
    document.addEventListener('keydown', unlockAudio, { once: true });


    moneyFill = document.getElementById('money-fill');
    riskFill = document.getElementById('risk-fill');
    nodeFill = document.getElementById('node-fill');
    moneyText = document.getElementById('money-text');
    riskText = document.getElementById('risk-text');
    nodeText = document.getElementById('node-text');
    totalMoneyDisplays = document.querySelectorAll('#total-money-display');
    logEl = document.getElementById('log-container');
    screenBusted = document.getElementById('screen-busted');
    screenSuccess = document.getElementById('screen-success');
    screenPersistent = document.getElementById('screen-persistent');
    screenLeaderboard = document.getElementById('screen-leaderboard');
    leaderboardList = document.getElementById('leaderboard-list');
    successAmountText = document.getElementById('success-amount');
    mainMenu = document.getElementById('main-menu');
    playerNameInput = document.getElementById('player-name');



    // One screen gate for mouse handlers and keyboard shortcuts.
    document.addEventListener('keydown', e => {
        if (e.defaultPrevented || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
        const active = document.activeElement;
        if (active && (['INPUT','TEXTAREA','SELECT'].includes(active.tagName) || active.isContentEditable)) return;
        const screen = currentPresentationScreen();
        if (['typing','backdoor','intro','settings'].includes(screen)) return;
        // Enter activates the focused button; Space retains the advertised game shortcut.
        if (active?.tagName === 'BUTTON' && e.code === 'Enter') return;
        if (screen === 'bypass') {
            if (e.code === 'Space') { e.preventDefault(); attemptBypass(); }
            if (e.code === 'Escape') { e.preventDefault(); exitBypassGame(); }
            return;
        }
        if (screen !== 'game') {
            if (['busted','success'].includes(screen) && ['Enter','Space'].includes(e.code)) { e.preventDefault(); closeOverlays(); }
            return;
        }
        const commands = { Digit1:()=>hack(1), Numpad1:()=>hack(1), Digit2:()=>hack(2), Numpad2:()=>hack(2), Digit3:()=>hack(3), Numpad3:()=>hack(3), Space:()=>transfer(), KeyB:()=>bypass(), KeyQ:()=>buyBonus(1), KeyW:()=>buyBonus(2), KeyE:()=>buyBonus(3), KeyR:()=>buyBonus(4), KeyA:()=>buyBonus(5), KeyS:()=>buyBonus(6) };
        if(commands[e.code]) { e.preventDefault(); commands[e.code](); }
    });


    updateUI();
    renderAchievementsList();
    const saveLoaded = await loadSavedGame();
    installPresentationObserver();
    publishPresentation();
    if (!saveLoaded) {
        // Leave Exit available on the menu. Do not open onboarding that cannot
        // persist while the existing save is protected from overwrite.
        window.dispatchEvent(new Event('risk:ready'));
        return;
    }
    if (!presentationPreferences.introSeen && window.RelayUI?.showIntro) {
        await window.RelayUI.showIntro({ replay: false });
    }
    if (!tutorialSeen) showTutorial();
    publishPresentation();
    window.dispatchEvent(new Event('risk:ready'));
};

// --- TUTORIAL / ONBOARDING ---
window.showTutorial = function() {
    if (window.RiskSaveLoading || !['menu','settings'].includes(currentPresentationScreen())) return;
    const overlay = document.getElementById('screen-tutorial');
    if (overlay) overlay.style.display = 'flex';
}

window.closeTutorial = function() {
    if (window.RiskSaveLoading || currentPresentationScreen() !== 'tutorial') return;
    const overlay = document.getElementById('screen-tutorial');
    if (overlay) overlay.style.display = 'none';
    if (window.RiskSaveReadBlocked) return;
    tutorialSeen = true;
    window.saveGameState();
}

// --- LEADERBOARD ---
async function submitScoreToDreamlo(score) {
    if (!playerName || playerName === "ANONYMOUS") return;
    try {
        await window.electronAPI.submitScore(playerName, Math.floor(score));
    } catch(e) {
        console.error("Submit Error:", e);
    }
}

let leaderboardRequest = 0;
window.showLeaderboard = async function() {
    if (window.RiskSaveLoading || window.RiskSaveReadBlocked || currentPresentationScreen() !== 'menu') return;
    const request = ++leaderboardRequest;
    if (mainMenu) mainMenu.style.display = 'none';
    if (screenLeaderboard) screenLeaderboard.style.display = 'flex';
    if (leaderboardList) leaderboardList.innerHTML = `<div style="opacity: 0.5; text-align: center; margin-top: 50px; font-family: monospace;">TUNNELING_INTO_GRID...</div>`;

    try {
        const rawData = await window.electronAPI.getLeaderboard();
        if (request !== leaderboardRequest) return;
        let data;
        try {
            data = JSON.parse(rawData.trim());
        } catch (parseError) {
            throw new Error("Invalid JSON data");
        }

        if (leaderboardList) {
            leaderboardList.innerHTML = "";
            if (data && data.dreamlo && data.dreamlo.leaderboard) {
                let entries = data.dreamlo.leaderboard.entry;
                if (entries && (!Array.isArray(entries) || entries.length)) {
                    if (!Array.isArray(entries)) entries = [entries];
                    entries = entries.filter(item => item && typeof item.name === 'string' &&
                        Number.isFinite(Number(item.score)) && Number(item.score) >= 0)
                        .sort((a,b) => Number(b.score)-Number(a.score)).slice(0,100);
                    entries.forEach((item, index) => {
                        const row = document.createElement('div');
                        row.style.display = "flex";
                        row.style.justifyContent = "space-between";
                        row.style.padding = "10px 5px";
                        row.style.borderBottom = "1px solid rgba(255,255,255,0.05)";
                        row.style.fontFamily = "monospace";
                        const isMe = item.name === playerName;
                        const nameText = document.createTextNode(`#${index + 1} ${item.name.slice(0,24)}`);
                        const nameSpan = document.createElement('span');
                        nameSpan.style.color = isMe ? 'var(--accent-blue)' : 'white';
                        nameSpan.style.minWidth = '0';
                        nameSpan.style.overflowWrap = 'anywhere';
                        nameSpan.style.paddingRight = '12px';
                        nameSpan.appendChild(nameText);

                        const scoreSpan = document.createElement('span');
                        scoreSpan.style.color = 'var(--accent-green)';
                        scoreSpan.style.flexShrink = '0';
                        scoreSpan.textContent = displayMoney(Math.floor(Number(item.score)));
                        scoreSpan.title = `${Math.floor(Number(item.score)).toLocaleString('en-US')} $`;

                        row.appendChild(nameSpan);
                        row.appendChild(scoreSpan);
                        leaderboardList.appendChild(row);
                    });
                    return;
                }
            }
            leaderboardList.innerHTML = `<div style="color: var(--text-muted); text-align: center; margin: 50px 20px; line-height: 1.8;">No scores yet.<br>Complete a run to leave your signal.</div>`;
        }
    } catch (e) {
        if (request !== leaderboardRequest) return;
        console.error("Leaderboard Error:", e);
        if (leaderboardList) leaderboardList.innerHTML = `<div style="color: var(--accent-red); text-align: center; margin-top: 50px; font-family: monospace;">UPLINK_DENIED</div>`;
    }
}

window.backToMenuFromLeaderboard = () => {
    if (currentPresentationScreen() !== 'leaderboard') return;
    leaderboardRequest++;
    if (screenLeaderboard) screenLeaderboard.style.display = 'none';
    if (mainMenu) mainMenu.style.display = 'flex';
}

window.showAchievements = function() {
    if (window.RiskSaveLoading || window.RiskSaveReadBlocked || currentPresentationScreen() !== 'menu') return;
    if (mainMenu) mainMenu.style.display = 'none';
    const screenAchievements = document.getElementById('screen-achievements');
    if (screenAchievements) screenAchievements.style.display = 'flex';
    renderAchievementsList();
}

window.backToMenuFromAchievements = () => {
    if (currentPresentationScreen() !== 'achievements') return;
    const screenAchievements = document.getElementById('screen-achievements');
    if (screenAchievements) screenAchievements.style.display = 'none';
    if (mainMenu) mainMenu.style.display = 'flex';
}

function renderAchievementsList() {
    const achievementsList = document.getElementById('achievements-list');
    if (!achievementsList) return;

    achievementsList.innerHTML = "";
    let unlockedCount = 0;
    const totalCount = Object.keys(achievements).length;

    Object.keys(achievements).forEach(key => {
        const ach = achievements[key];
        if (ach.unlocked) unlockedCount++;

        const card = document.createElement('div');
        card.className = `achievement-card ${ach.unlocked ? 'unlocked' : ''} ${ach.secret ? 'secret' : ''}`;

        const isSecret = ach.secret && !ach.unlocked;

        card.innerHTML = `
            <div style="font-size: 1.2rem; font-family: monospace; color: ${ach.unlocked ? 'var(--accent-green)' : 'rgba(255,255,255,0.4)'};">${isSecret ? '[?]' : ach.icon}</div>
            <div style="flex: 1;">
                <div style="font-size: 0.7rem; font-weight: bold; color: ${ach.unlocked ? 'var(--accent-green)' : 'rgba(255,255,255,0.5)'};">
                    ${isSecret ? '???_SECRET_???' : ach.name}
                </div>
                <div style="font-size: 0.75rem; opacity: 0.7; margin-top: 2px;">
                    ${isSecret ? 'Secret achievement' : ach.desc}
                </div>
            </div>
            <div style="font-size: 1rem; font-family: monospace; color: var(--accent-green);">${ach.unlocked ? '[OK]' : ''}</div>
        `;

        achievementsList.appendChild(card);
    });

    const progressText = document.getElementById('achievement-progress');
    if (progressText) progressText.textContent = `${unlockedCount}/${totalCount} UNLOCKED`;

    const counterInMenu = document.getElementById('achievement-counter');
    if (counterInMenu) counterInMenu.textContent = `${unlockedCount}/${totalCount}`;
}

// --- LOG SYSTEM (multi-line with fade) ---
function updateLog(msg, type = 'default') {
    const colorMap = { bad: 'var(--accent-red)', good: 'var(--accent-green)', info: 'var(--accent-blue)' };
    const color = colorMap[type] || 'var(--accent-green)';

    logHistory.unshift({ msg, color, time: Date.now() });
    if (logHistory.length > LOG_MAX) logHistory.pop();

    if (logEl) {
        logEl.innerHTML = logHistory.map((entry, i) => {
            const opacity = 1 - (i * 0.3);
            return `<div style="color:${entry.color}; opacity:${opacity}; text-shadow: 0 0 5px ${entry.color}; font-size: 0.75rem; line-height: 1.4;">${escapeDisplayText(entry.msg)}</div>`;
        }).join('');
    }
}

// --- CENTRALIZED COST CALCULATIONS ---
function addCurrency(balance, amount) {
    return Math.min(Number.MAX_VALUE, balance + amount);
}
function getBonusCosts() {
    return [
        (10 * (1.0 - (pUpgrades.fan.lvl * 0.01))) * Math.pow(2, coolerPurchases),
        money * 0.20,
        money * 0.2,
        150 * Math.pow(3, ghostPurchases),
        15 * Math.pow(2, proxyPurchases) * (1 + (nodesValidated * 0.25)),
        money * 0.15
    ];
}

// One read-only rule set drives both purchases and their visible availability.
function getBonusAvailability(costs = getBonusCosts()) {
    return costs.map((cost, index) => {
        let status = 'READY';
        if ((index === 0 || index === 4) && risk <= 0) status = 'CLEAR';
        if (index === 1 && insuranceTurns > 0) status = 'ACTIVE';
        if (index === 2) {
            if (gambleCooldown > 0) status = gambleCooldown + ' HACKS';
            else if (sessionHackCount === 0) status = 'HACK FIRST';
        }
        if (index === 3) {
            if (ghostShieldActive) status = 'ACTIVE';
            else if (overclockBonusTurns > 0) status = 'LOCKED';
            else if (ghostCooldown > 0) status = ghostCooldown + ' HACKS';
        }
        if (index === 5) {
            if (overclockBonusTurns > 0) status = 'ACTIVE';
            else if (ghostShieldActive) status = 'LOCKED';
            else if (overclockCooldown > 0) status = overclockCooldown + ' HACKS';
        }
        if (status === 'READY' && (!Number.isFinite(money) || money <= 0 ||
            !Number.isFinite(cost) || cost <= 0 || money < cost)) status = 'LOW FUNDS';
        return Object.freeze({ status, available: status === 'READY' });
    });
}

function updateUI() {
    updateSessionStats();
    if (moneyFill) moneyFill.style.width = `${Math.min((money / 1000000) * 100, 100)}%`;
    if (riskFill) riskFill.style.width = `${Math.min(risk, 100)}%`;
    if (nodeFill) nodeFill.style.width = `${Math.min(nodesHacked, 100)}%`;
    if (moneyText) {
        const newText = displayMoney(money);
        if (moneyText.textContent !== newText) {
            moneyText.textContent = newText;
            moneyText.classList.add('flash-good');
            setTimeout(() => moneyText.classList.remove('flash-good'), 300);
        }
    }
    if (riskText) {
        const newRisk = `${Math.floor(risk)}%`;
        if (riskText.textContent !== newRisk) {
            riskText.textContent = newRisk;
            if (risk > 50) {
                riskText.classList.add('flash-bad');
                setTimeout(() => riskText.classList.remove('flash-bad'), 300);
            }
        }
    }
    if (nodeText) nodeText.textContent = `${Math.floor(nodesHacked)}%`;
    if (totalMoneyDisplays) totalMoneyDisplays.forEach(d => d.textContent = displayMoney(totalMoney));

    const buffsContainer = document.getElementById('active-buffs');
    if (buffsContainer) {
        const buffs = [];
        if(ghostShieldActive) buffs.push(['GHOST 1 HIT','Protects the next detection']);
        if(insuranceTurns>0) buffs.push(['INS '+insuranceTurns+'T','Insurance: '+insuranceTurns+' hacks remaining']);
        if(overclockBonusTurns>0) buffs.push(['OVR '+overclockBonusTurns+'T','Double gains for '+overclockBonusTurns+' hacks']);
        if(ghostCooldown>0 && !ghostShieldActive) buffs.push(['G-CD '+ghostCooldown,'Ghost cooldown in hacks']);
        if(overclockCooldown>0) buffs.push(['O-CD '+overclockCooldown,'Overclock cooldown in hacks']);
        if(prestigeLevel>0) buffs.push(['P'+formatNumber(prestigeLevel),'Prestige level']);
        buffsContainer.innerHTML = buffs.map(([label,title])=>'<span title="'+title+'">'+label+'</span>').join('');
    }


    const bypassBtn = document.querySelector('.btn-bypass');
    if (bypassBtn) {
        bypassBtn.style.opacity = '';
        bypassBtn.classList.toggle('charging',bypassCharge < bypassChargeMax);
        bypassBtn.style.cursor = (bypassCharge < bypassChargeMax) ? 'not-allowed' : 'pointer';
        bypassBtn.disabled = bypassCharge < bypassChargeMax;
    }
    updateBonusPrices(false);
    publishPresentation();
}

function updateBonusPrices(publish = true) {
    const costs = getBonusCosts();

    costs.forEach((cost,index)=>{
        const label=document.getElementById('price-'+(index+1));
        if(label) {label.textContent=displayMoney(cost);label.title=cost>0 && cost<0.01 ? 'Less than 0.01 dollars' : cost.toFixed(2)+' dollars';}
    });
    const availability = presentationBonusState(costs);
    availability.forEach((state,index)=>{
        const label=document.getElementById('price-'+(index+1));
        const button=label?.parentElement;
        if(button) {button.disabled=false;button.setAttribute('aria-disabled',String(!state.available));button.classList.toggle('affordable',state.available);button.classList.toggle('cooling',!state.available);button.style.opacity='';button.style.cursor='';}
        const status=document.getElementById('bonus-status-'+(index+1));
        if(status) status.textContent=state.status;
    });
    if (publish) publishPresentation();
}

function showBusted() {
    if (window.RiskSaveLoading || window.RiskSaveReadBlocked || currentPresentationScreen() !== 'game') return;
    relayEvent('bust', { money, risk, recovered: insuranceTurns>0 ? money*0.5 : 0, recap:{...sessionStats} });
    if (!achievements.brain404.unlocked && money === 0) unlockAchievement('brain404');

    if (screenBusted) {
        const recap = screenBusted.querySelector('p');
        if (recap) {
            recap.style.fontSize = "0.65rem";
            recap.style.letterSpacing = "1px";
            recap.style.lineHeight = "1.4";
            recap.innerHTML = `
                <span style="color:white;opacity:0.6">Final risk</span> ${risk.toFixed(0)}%<br>
                <span style="color:white;opacity:0.6">Peak risk</span> ${sessionStats.maxRisk.toFixed(0)}%<br>
                <span style="color:white;opacity:0.6">Nodes</span> ${sessionStats.maxNodes}<br>
                <span style="color:white;opacity:0.6">Peak multiplier</span> ×${sessionStats.maxMultiplier.toFixed(0)}
            `;
        }
        screenBusted.style.display = 'flex';
    }
    if (insuranceTurns > 0) {
        totalMoney = addCurrency(totalMoney, money * 0.5);
    }
    checkBankAchievements();
    money = 0; risk = 0; nodesHacked = 0; multiplier = 1; streakCounter = 0; bypassCharge = 0;
    sessionHackCount = 0;
    resetTempBuffs(); resetSessionStats(); resetSessionAchievementStats(); updateUI();
    window.saveGameState();
}

function resetTempBuffs() {
    insuranceTurns = 0;
    coolerPurchases = 0;
    proxyPurchases = 0;
    ghostPurchases = 0;
    nodesValidated = 0;
    ghostShieldActive = false;
    ghostCooldown = 0;
    overclockCooldown = 0;
    overclockBonusTurns = 0;
    gambleCooldown = 0;
}

window.closeOverlays = function() {
    if (window.RiskSaveLoading || !['busted','success'].includes(currentPresentationScreen())) return;
    playSfx('click');
    if (screenBusted && screenBusted.style.display === 'flex') {
        screenBusted.style.display = 'none';
        if (screenPersistent) { screenPersistent.style.display = 'flex'; updatePersistentUI(); }
    }
    if (screenSuccess && screenSuccess.style.display === 'flex') {
        screenSuccess.style.display = 'none';
        if (screenPersistent) { screenPersistent.style.display = 'flex'; updatePersistentUI(); }
    }
}

window.showPersistentUpgrades = function() {
    if (window.RiskSaveLoading || window.RiskSaveReadBlocked || currentPresentationScreen() !== 'menu') return;
    playSfx('click');
    if (playerNameInput && playerNameInput.value.trim() !== "") playerName = playerNameInput.value.trim();
    if (mainMenu) mainMenu.style.display = 'none';
    if (screenPersistent) screenPersistent.style.display = 'flex';
    updatePersistentUI();
}

window.backToMenu = function() {
    if (currentPresentationScreen() !== 'persistent') return;
    playSfx('click');
    if (screenPersistent) screenPersistent.style.display = 'none';
    if (mainMenu) mainMenu.style.display = 'flex';
}

window.startGame = function() {
    if (window.RiskSaveLoading || window.RiskSaveReadBlocked || currentPresentationScreen() !== 'persistent') return;
    playSfx('click');
    if (screenPersistent) screenPersistent.style.display = 'none';
    const pBonus = getPrestigeBonus();
    money = (pUpgrades.ram.lvl * 10) + pBonus.startMoney;
    risk = 0; nodesHacked = 0; multiplier = 1; streakCounter = 0; bypassCharge = 0;
    sessionHackCount = 0;
    resetTempBuffs(); resetSessionStats(); resetSessionAchievementStats();
    logHistory.length = 0;
    updateLog(`SESSION_START: ${playerName.toUpperCase()}`, 'info');
    if (prestigeLevel > 0) updateLog(`PRESTIGE_BONUS: +${Math.round((pBonus.gainMult - 1) * 100)}% GAIN`, 'info');
    updateUI(); updateBonusPrices();
    window.saveGameState();
}

function updatePersistentUI() {
    if (totalMoneyDisplays) totalMoneyDisplays.forEach(d => d.textContent = displayMoney(totalMoney));

    // Update prestige button
    const prestigeBtn = document.getElementById('btn-prestige');
    if (prestigeBtn) {
        const pCost = getPrestigeCost();
        const canPrestige = Number.isFinite(pCost) && totalMoney >= pCost;
        prestigeBtn.disabled = !canPrestige;
        prestigeBtn.innerHTML = `
            <span style="font-weight:bold; color:#ffd700;">PRESTIGE_v${prestigeLevel}</span>
            <span style="font-size:0.75rem; color:var(--accent-blue);">PTS: ${prestigePoints}</span>
            <span style="font-size:0.75rem; opacity:0.8;">+10% gain, -2% risk, +50$ start</span>
            <span style="font-size:0.75rem; color:${canPrestige ? '#ffd700' : 'var(--accent-red)'}; margin-top:5px; font-weight:bold;">${canPrestige ? 'READY' : 'NEED: ' + formatNumber(pCost) + '$'}</span>
        `;
        if (canPrestige) prestigeBtn.classList.add('affordable');
        else prestigeBtn.classList.remove('affordable');
    }

    const upgs = [
        { id: '1', key: 'ram', name: 'RAM_INJECTION', desc: `Start: +${pUpgrades.ram.lvl * 10}$` },
        { id: '2', key: 'vpn', name: 'VPN_SHIELD', desc: `Risk: -${pUpgrades.vpn.lvl}%` },
        { id: '3', key: 'miner', name: 'MINER_V2', desc: `Gain: +${pUpgrades.miner.lvl * 20}%` },
        { id: '4', key: 'fan', name: 'COOLING_FAN', desc: `Cooler: -${pUpgrades.fan.lvl}%` },
        { id: '5', key: 'algo', name: 'DEEP_LEARNING', desc: `Jackpot: ${1 + pUpgrades.algo.lvl}% / Bust: ${9 - pUpgrades.algo.lvl}%` },
        { id: '6', key: 'volt', name: 'OVERVOLT', desc: `Stealth: ${pUpgrades.volt.lvl}%` }
    ];
    upgs.forEach(u => {
        const btn = document.getElementById(`btn-p-${u.id}`);
        if (btn) {
            const cost = Math.floor(100 * Math.pow(1.5, pUpgrades[u.key].lvl));
            const isMax = pUpgrades[u.key].lvl >= pUpgrades[u.key].max;
            btn.disabled = isMax || !Number.isFinite(cost) || totalMoney < cost;
            if (!isMax && totalMoney >= cost) btn.classList.add('affordable'); else btn.classList.remove('affordable');
            btn.innerHTML = `
                <span style="font-weight:bold;">${u.name}</span>
                <span style="font-size:0.75rem; color:var(--accent-blue);">LVL ${pUpgrades[u.key].lvl}</span>
                <span style="font-size:0.75rem; opacity:0.8;">${u.desc}</span>
                <span style="font-size:0.75rem; color:var(--accent-green); margin-top:5px; font-weight:bold;">${isMax ? 'MAX' : 'COST: ' + formatNumber(cost) + '$'}</span>
            `;
        }
    });
}

window.buyPersistent = function(key) {
    if (window.RiskSaveLoading || window.RiskSaveReadBlocked || currentPresentationScreen() !== 'persistent' || !Object.hasOwn(pUpgrades,key)) return;
    if (pUpgrades[key].lvl >= pUpgrades[key].max) return;
    const cost = Math.floor(100 * Math.pow(1.5, pUpgrades[key].lvl));
    if (Number.isFinite(cost) && totalMoney >= cost) {
        playSfx('bonus');
        totalMoney -= cost; pUpgrades[key].lvl++;
        updatePersistentUI();
        window.saveGameState();
    }
}

// --- PRESTIGE ---
window.doPrestige = function() {
    if (window.RiskSaveLoading || window.RiskSaveReadBlocked || currentPresentationScreen() !== 'persistent') return;
    const pCost = getPrestigeCost();
    if (!Number.isFinite(pCost) || totalMoney < pCost) return;

    prestigeLevel++;
    prestigePoints++;
    relayEvent('prestige',{level:prestigeLevel});
    totalMoney = 0;

    // Reset upgrades
    for (const key in pUpgrades) {
        pUpgrades[key].lvl = 0;
    }

    updateLog(`PRESTIGE_COMPLETE [LEVEL ${prestigeLevel}]`, 'good');
    checkAchievements();
    updatePersistentUI();
    window.saveGameState();
}

// --- HACK ---
window.hack = function(level) {
    if (window.RiskSaveLoading || window.RiskSaveReadBlocked || currentPresentationScreen() !== 'game' || ![1,2,3].includes(level)) return;

    if (level !== 3) achievementStats.bruteForceOnly = false;
    // YOLO_MODE fix: DON'T reset gambleStreak here - only reset on session end

    if (gambleCooldown > 0) gambleCooldown--;

    let bGain = (level === 1) ? 5 : (level === 2) ? 20 : 50;
    let bRisk = (level === 1) ? 3 : (level === 2) ? 9 : 14;
    let vpnMult = 1.0 - (pUpgrades.vpn.lvl * 0.01);
    let currentMult = multiplier;

    // Prestige bonus
    const pBonus = getPrestigeBonus();

    if (overclockBonusTurns > 0) {
        currentMult *= 2;
        updateLog(`OVERCLOCK_BONUS [${overclockBonusTurns} LEFT]`, 'info');
        overclockBonusTurns--;
    }

    let minerMult = 1 + (pUpgrades.miner.lvl * 0.2);
    let fGain = bGain * currentMult * minerMult * pBonus.gainMult;
    let aRisk = bRisk * vpnMult * (1 - pBonus.riskReduction);
    if (Math.random() < (pUpgrades.volt.lvl * 0.01)) { aRisk = 0; updateLog("STEALTH_CLICK", 'good'); }

    if (risk > 0) {
        let eRisk = risk < 20 ? risk * 0.7 : risk;
        if (Math.random() < (eRisk / 100)) {
            if (ghostShieldActive) {
                ghostShieldActive = false;
                risk = 0;
                achievementStats.ghostShieldSaves++;
                relayEvent('ghost-save');
                updateLog("GHOST_SHIELD_TRIGGERED", 'good');
            }
            else {
                showBusted();
                return;
            }
        }
    }

    money = addCurrency(money, fGain);
    risk = Math.min(100, risk + aRisk);
    updateSessionStats();
    relayEvent('hack', { hackType:level, gain:fGain, risk, money });
    nodesHacked += 20 + (risk / 2);

    streakCounter++;
    sessionHackCount++;

    // SAFE_ENTRY rebalance: mult every 2 clicks instead of 1
    if (level === 1) {
        if (streakCounter >= 2) {
            multiplier += 1;
            streakCounter = 0;
            updateLog("MULT_UP!", 'good');
        }
    } else if (level === 2) {
        if (streakCounter >= 2) {
            multiplier += 1;
            streakCounter = 0;
            updateLog("STREAK_UP!", 'good');
        }
    } else if (level === 3) {
        if (streakCounter >= 3) {
            multiplier += 1;
            streakCounter = 0;
            updateLog("STREAK_UP!", 'good');
        }
    }

    if(nodesHacked >= 100) {
        nodesValidated++;
        achievementStats.totalNodesValidated++;
        multiplier += 1; risk = Math.max(0, risk - 5); nodesHacked = 0;
        updateLog("NODE_VALIDATED", 'good');
        relayEvent('node');
    }
    if (ghostCooldown > 0) ghostCooldown--;
    if (overclockCooldown > 0) overclockCooldown--;
    if (insuranceTurns > 0) { insuranceTurns--; if (insuranceTurns === 0) updateLog("INSURANCE_EXPIRED", 'bad'); }
    if (bypassCharge < bypassChargeMax) { bypassCharge++; if(bypassCharge===bypassChargeMax) relayEvent('bypass-ready'); }

    if (!achievementStats.comebackAchieved && sessionStats.maxRisk >= 90 && risk === 0) {
        unlockAchievement('comebackKing');
        achievementStats.comebackAchieved = true;
    }

    updateUI();
    updateBonusPrices();
    checkAchievements();
    if (Math.random() < 0.15) triggerRandomEvent();

    // Typing Protocol: 2% chance (increased from 1%)
    if (Math.random() < 0.02 && !typingActive) {
        startTypingProtocol();
    }

    // Backdoor Protocol: 0.5% chance
    if (Math.random() < 0.005 && !backdoorActive && !typingActive) {
        startBackdoorProtocol();
    }
};

function triggerRandomEvent() {
    if (window.RiskSaveLoading || window.RiskSaveReadBlocked || currentPresentationScreen() !== 'game') return;
    const roll = Math.random() * 100;
    if (roll < 25) { risk = Math.min(100, risk + 15); updateLog("ANTIVIRUS_SCAN [+15% RISK]", 'bad'); }
    else if (roll < 50) { money = addCurrency(money, 50); updateLog("PACKET_SNIFFED [+50$]", 'good'); }
    else if (roll < 75) { multiplier += 2; updateLog("CPU_OVERCLOCK [+2 MULT]", 'good'); }
    else if (roll < 95) { risk = 0; updateLog("GHOST_PROXY [RISK 0]", 'good'); }
    else { multiplier = 1; streakCounter = 0; updateLog("BUFFER_OVERFLOW [STREAK RESET]", 'bad'); }
    updateUI();
    checkAchievements();
}

// --- TYPING PROTOCOL ---
// A run owns its callbacks through countdown, input and the memory result delay.
// Old timers and detached controls cannot settle or hide a later run.
let activeMiniGame = null;
let miniGameGeneration = 0;

function beginMiniGame(game) {
    if (window.RiskSaveLoading || window.RiskSaveReadBlocked || activeMiniGame || typingActive || backdoorActive || currentPresentationScreen() !== 'game') return null;
    const run = { game, generation: ++miniGameGeneration, phase: 'countdown', prepareDeadlineAt: performance.now() + 3000 };
    activeMiniGame = run;
    return run;
}

function ownsMiniGame(run, game, phase) {
    return !!run && activeMiniGame === run && run.game === game && run.phase === phase;
}

window.startTypingProtocol = function() {
    const container = document.getElementById('typing-container');
    const inputField = document.getElementById('typing-input');
    if (!container || !inputField) return;
    const run = beginMiniGame('typing');
    if (!run) return;
    typingActive = true;
    typingStarted = false;
    typingInput = "";
    typingErrors = 0;
    typingCountdown = 3;

    // Generate 2-3 word phrase for more challenge
    const wordCount = 2 + Math.floor(Math.random() * 2);
    const words = [];
    for (let i = 0; i < wordCount; i++) {
        words.push(typingWords[Math.floor(Math.random() * typingWords.length)]);
    }
    typingPhrase = words.join(' ');

    playSfx('bonus');
    updateLog("TYPING_PROTOCOL_DETECTED!", 'info');

    const phraseDisplay = document.getElementById('typing-phrase');
    const countdownEl = document.getElementById('typing-countdown');
    const errorsEl = document.getElementById('typing-errors');

    if (!container) return;

    container.style.display = 'flex';
    if (phraseDisplay) phraseDisplay.textContent = typingPhrase.toUpperCase();
    if (inputField) {
        inputField.value = "";
        inputField.disabled = true;
        inputField.style.opacity = '0.5';
    }
    if (errorsEl) errorsEl.textContent = `ERRORS: 0/${typingMaxErrors}`;

    if (countdownEl) {
        countdownEl.style.display = 'block';
        countdownEl.textContent = typingCountdown;
    }
    typingDeadlineAt = 0;
    relayProtocol('typing','countdown',{countdown:3,durationMs:typingTimeLimit+2000,deadlineAt:0,remainingMs:typingTimeLimit+2000,phrase:typingPhrase,input:'',errors:0,maxErrors:typingMaxErrors,correctCount:0,targetCount:typingPhrase.length,success:null,rewardText:''});

    typingCountdownInterval = setInterval(() => {
        if (!ownsMiniGame(run, 'typing', 'countdown')) return;
        typingCountdown = Math.max(0, Math.ceil((run.prepareDeadlineAt - performance.now()) / 1000));
        if (countdownEl) countdownEl.textContent = typingCountdown;
        playSfx('click');

        if (typingCountdown <= 0) {
            clearInterval(typingCountdownInterval);
            startTypingGame(run);
        } else relayProtocol('typing','countdown',{countdown:typingCountdown});
    }, 1000);
}

function startTypingGame(run = activeMiniGame) {
    if (!ownsMiniGame(run, 'typing', 'countdown') || performance.now() < run.prepareDeadlineAt) return;
    clearInterval(typingCountdownInterval);
    typingCountdownInterval = null;
    run.phase = 'active';
    typingStarted = true;
    const countdownEl = document.getElementById('typing-countdown');
    const inputField = document.getElementById('typing-input');

    if (countdownEl) countdownEl.style.display = 'none';

    if (inputField) {
        inputField.disabled = false;
        inputField.style.opacity = '1';
        inputField.focus();
    }

    typingDeadlineAt = run.prepareDeadlineAt + typingTimeLimit + 2000;
    const remainingMs = Math.max(0, typingDeadlineAt - performance.now());
    relayProtocol('typing','active',{countdown:0,deadlineAt:typingDeadlineAt,remainingMs});
    updateTypingDisplay();
    if (remainingMs === 0) { failTypingProtocol(run); return; }
    typingTimeout = setTimeout(() => {
        failTypingProtocol(run);
    }, remainingMs); // Seven real seconds after preparation, even if a callback is late.
}

window.checkTypingInput = function() {
    if (!typingStarted || !typingActive || !ownsMiniGame(activeMiniGame, 'typing', 'active') || currentPresentationScreen() !== 'typing') return;
    if (performance.now() >= typingDeadlineAt) { failTypingProtocol(); return; }

    const inputField = document.getElementById('typing-input');
    if (!inputField) return;

    const userInput = inputField.value.toLowerCase().trim();
    const targetPhrase = typingPhrase.toLowerCase();

    if (userInput === targetPhrase) {
        successTypingProtocol();
        return;
    }

    let errorCount = 0;
    for (let i = 0; i < userInput.length; i++) {
        if (i >= targetPhrase.length || userInput[i] !== targetPhrase[i]) {
            errorCount++;
        }
    }

    if (errorCount > typingMaxErrors) {
        relayProtocol('typing','active',{input:inputField.value,errors:errorCount,action:'mismatch'});
        failTypingProtocol();
        return;
    }

    typingErrors = errorCount;
    const errorsEl = document.getElementById('typing-errors');
    if (errorsEl) errorsEl.textContent = `ERRORS: ${typingErrors}/${typingMaxErrors}`;

    updateTypingDisplay();
}

function updateTypingDisplay() {
    const phraseDisplay = document.getElementById('typing-phrase');
    const inputField = document.getElementById('typing-input');
    if (!phraseDisplay || !inputField) return;

    const userInput = inputField.value.toLowerCase().trim();
    const targetPhrase = typingPhrase.toLowerCase();

    let displayHTML = '';
    let correctCount = 0;
    for (let i = 0; i < typingPhrase.length; i++) {
        const char = typingPhrase[i].toUpperCase();
        if (i < userInput.length) {
            if (userInput[i] === targetPhrase[i]) {
                correctCount++;
                displayHTML += `<span class="command-char is-correct">${escapeDisplayText(char)}</span>`;
            } else {
                displayHTML += `<span class="command-char is-wrong">${escapeDisplayText(char)}</span>`;
            }
        } else {
            displayHTML += `<span class="command-char${i===userInput.length?' is-current':''}">${escapeDisplayText(char)}</span>`;
        }
    }

    phraseDisplay.innerHTML = displayHTML;
    relayProtocol('typing',typingStarted?'active':'countdown',{phrase:typingPhrase,input:inputField.value,errors:typingErrors,maxErrors:typingMaxErrors,correctCount,targetCount:typingPhrase.length,deadlineAt:typingDeadlineAt,remainingMs:Math.max(0,typingDeadlineAt-performance.now())});
}

function successTypingProtocol(run = activeMiniGame) {
    if (!ownsMiniGame(run, 'typing', 'active') || !typingActive || !typingStarted) return;
    if (performance.now() >= typingDeadlineAt) { failTypingProtocol(run); return; }
    run.phase = 'result';
    clearTimeout(typingTimeout);
    clearInterval(typingCountdownInterval);
    typingTimeout = typingCountdownInterval = null;
    typingActive = false;
    typingStarted = false;
    const bonus = Math.max(nodesValidated, 1);
    multiplier += bonus;
    checkAchievements();
    updateLog(`TYPING_SUCCESS [+${bonus} MULT]`, 'good');
    relayProtocol('typing','result',{success:true,deadlineAt:0,remainingMs:0,correctCount:typingPhrase.length,rewardText:`Multiplier +${bonus}`,rewardValue:bonus});
    relayEvent('minigame-success',{game:'typing',rewardValue:bonus,rewardText:`Multiplier +${bonus}`});
    const container = document.getElementById('typing-container');
    if (container) container.style.display = 'none';
    activeMiniGame = null;
    updateUI();
}

function failTypingProtocol(run = activeMiniGame) {
    if (!ownsMiniGame(run, 'typing', 'active') || !typingActive || !typingStarted) return;
    run.phase = 'result';
    clearTimeout(typingTimeout);
    clearInterval(typingCountdownInterval);
    typingTimeout = typingCountdownInterval = null;
    typingActive = false;
    typingStarted = false;
    const previousRisk = risk;
    risk = Math.min(100, risk + 10);
    checkAchievements();
    updateLog("TYPING_FAILED [+10% RISK]", 'bad');
    relayProtocol('typing','result',{success:false,deadlineAt:0,remainingMs:0,rewardText:`Trace +${displayRiskPoints(risk-previousRisk)} points`,rewardValue:risk-previousRisk});
    relayEvent('minigame-fail',{game:'typing',rewardValue:risk-previousRisk,rewardText:`Trace +${displayRiskPoints(risk-previousRisk)} points`});
    const container = document.getElementById('typing-container');
    if (container) container.style.display = 'none';
    activeMiniGame = null;
    updateUI();
}

window.testTyping = function() {
    startTypingProtocol();
}

// --- BACKDOOR PROTOCOL (fully implemented) ---
window.startBackdoorProtocol = function() {
    const container = document.getElementById('backdoor-container');
    const grid = document.getElementById('backdoor-grid');
    if (!container || !grid) return;
    const run = beginMiniGame('backdoor');
    if (!run) return;

    backdoorActive = true;
    backdoorStarted = false;
    backdoorClicked = 0;
    backdoorErrors = 0;
    backdoorCountdown = 3;
    backdoorTargetPositions = [];
    backdoorTimeLeft = 8;

    playSfx('bonus');
    updateLog("BACKDOOR_PROTOCOL_DETECTED!", 'info');

    const countdownEl = document.getElementById('backdoor-countdown');
    const timerEl = document.getElementById('backdoor-timer');

    if (!container || !grid) return;

    container.style.display = 'flex';
    grid.innerHTML = '';
    grid.style.pointerEvents = 'none';

    if (countdownEl) {
        countdownEl.style.display = 'block';
        countdownEl.textContent = backdoorCountdown;
    }
    if (timerEl) timerEl.style.display = 'none';

    const totalCells = backdoorGridSize * backdoorGridSize;
    const allPositions = [];
    for (let i = 0; i < totalCells; i++) allPositions.push(i);

    for (let i = allPositions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [allPositions[i], allPositions[j]] = [allPositions[j], allPositions[i]];
    }
    backdoorTargetPositions = allPositions.slice(0, backdoorTargetCount);

    for (let i = 0; i < totalCells; i++) {
        const cell = document.createElement('div');
        cell.className = 'backdoor-cell';
        cell.dataset.index = i;
        cell.dataset.clicked = '0';
        cell.dataset.state = 'idle';
        cell.style.cssText = 'width: 30px; height: 30px; border-radius: 4px; cursor: pointer; transition: all 0.15s; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.03);';
        cell.addEventListener('click', () => handleBackdoorClick(i, cell, run));
        grid.appendChild(cell);
    }

    // Show targets for the three-second preparation window.
    backdoorTargetPositions.forEach(pos => {
        const cells = grid.children;
        if (cells[pos]) {
            cells[pos].dataset.state = 'target';
            cells[pos].style.background = 'rgba(0, 242, 255, 0.4)';
            cells[pos].style.borderColor = 'var(--accent-green)';
            cells[pos].style.boxShadow = '0 0 8px rgba(0, 242, 255, 0.5)';
        }
    });

    backdoorDeadlineAt = 0;
    relayProtocol('backdoor','countdown',{countdown:3,durationMs:8000,deadlineAt:0,remainingMs:8000,errors:0,maxErrors:3,correctCount:0,targetCount:backdoorTargetCount,success:null,rewardText:''});

    backdoorCountdownInterval = setInterval(() => {
        if (!ownsMiniGame(run, 'backdoor', 'countdown')) return;
        backdoorCountdown = Math.max(0, Math.ceil((run.prepareDeadlineAt - performance.now()) / 1000));
        if (countdownEl) countdownEl.textContent = backdoorCountdown;
        playSfx('click');

        if (backdoorCountdown <= 0) {
            clearInterval(backdoorCountdownInterval);
            startBackdoorGame(run);
        } else relayProtocol('backdoor','countdown',{countdown:backdoorCountdown});
    }, 1000);
}

function startBackdoorGame(run = activeMiniGame) {
    if (!ownsMiniGame(run, 'backdoor', 'countdown') || performance.now() < run.prepareDeadlineAt) return;
    clearInterval(backdoorCountdownInterval);
    backdoorCountdownInterval = null;
    run.phase = 'active';
    backdoorStarted = true;
    const grid = document.getElementById('backdoor-grid');
    const countdownEl = document.getElementById('backdoor-countdown');
    const timerEl = document.getElementById('backdoor-timer');

    if (countdownEl) countdownEl.style.display = 'none';
    if (timerEl) timerEl.style.display = 'block';

    // Hide all targets
    if (grid) {
        for (let i = 0; i < grid.children.length; i++) {
            grid.children[i].dataset.state = 'idle';
            grid.children[i].style.background = 'rgba(255,255,255,0.03)';
            grid.children[i].style.borderColor = 'rgba(255,255,255,0.1)';
            grid.children[i].style.boxShadow = 'none';
        }
        grid.style.pointerEvents = 'auto';
    }

    // Start timer
    backdoorDeadlineAt = run.prepareDeadlineAt + 8000;
    backdoorTimeLeft = Math.max(0, Math.ceil((backdoorDeadlineAt - performance.now()) / 1000));
    if (timerEl) timerEl.textContent = `${backdoorTimeLeft}s`;
    relayProtocol('backdoor','active',{countdown:0,deadlineAt:backdoorDeadlineAt,remainingMs:Math.max(0,backdoorDeadlineAt-performance.now())});
    if (backdoorTimeLeft === 0) { endBackdoor(false, run); return; }

    backdoorTimer = setInterval(() => {
        if (!ownsMiniGame(run, 'backdoor', 'active')) return;
        backdoorTimeLeft = Math.max(0, Math.ceil((backdoorDeadlineAt - performance.now()) / 1000));
        if (timerEl) timerEl.textContent = `${backdoorTimeLeft}s`;

        if (backdoorTimeLeft <= 0) {
            endBackdoor(false, run);
        } else {
            relayProtocol('backdoor','active',{deadlineAt:backdoorDeadlineAt,remainingMs:Math.max(0,backdoorDeadlineAt-performance.now())});
        }
    }, 1000);
}

function handleBackdoorClick(index, cell, run = activeMiniGame) {
    if (!ownsMiniGame(run, 'backdoor', 'active') || !backdoorActive || !backdoorStarted || currentPresentationScreen() !== 'backdoor') return;
    if (performance.now() >= backdoorDeadlineAt) { endBackdoor(false, run); return; }
    const grid = document.getElementById('backdoor-grid');
    if (!Number.isInteger(index) || !cell || grid?.children[index] !== cell || cell.dataset.clicked === '1') return;
    cell.dataset.clicked = '1';

    if (backdoorTargetPositions.includes(index)) {
        // Correct
        cell.dataset.state = 'correct';
        cell.style.background = 'rgba(0, 242, 255, 0.5)';
        cell.style.borderColor = 'var(--accent-green)';
        cell.style.boxShadow = '0 0 10px rgba(0, 242, 255, 0.6)';
        backdoorClicked++;
        relayProtocol('backdoor','active',{action:'correct',correctCount:backdoorClicked,errors:backdoorErrors});
        playSfx('click');

        if (backdoorClicked >= backdoorTargetCount) {
            endBackdoor(true, run);
        }
    } else {
        // Wrong
        cell.dataset.state = 'wrong';
        cell.style.background = 'rgba(255, 62, 108, 0.5)';
        cell.style.borderColor = 'var(--accent-red)';
        backdoorErrors++;
        relayProtocol('backdoor','active',{action:'wrong',correctCount:backdoorClicked,errors:backdoorErrors});
        playSfx('fail');

        if (backdoorErrors >= 3) {
            endBackdoor(false, run);
        }
    }
}

function endBackdoor(success, run = activeMiniGame) {
    if (!ownsMiniGame(run, 'backdoor', 'active') || !backdoorActive || !backdoorStarted) return;
    if (success && performance.now() >= backdoorDeadlineAt) success = false;
    run.phase = 'result';
    clearInterval(backdoorTimer);
    clearInterval(backdoorCountdownInterval);
    backdoorTimer = backdoorCountdownInterval = null;
    backdoorActive = false;
    backdoorStarted = false;

    const container = document.getElementById('backdoor-container');
    const grid = document.getElementById('backdoor-grid');
    if (grid) grid.style.pointerEvents = 'none';
    const previousMoney = money, previousRisk = risk;

    if (success) {
        const bonus = multiplier * 3;
        money = addCurrency(money, bonus);
        risk = Math.max(0, risk - 25);
        updateLog(`BACKDOOR_SUCCESS [+${bonus.toFixed(0)}$ -25% RISK]`, 'good');
    } else {
        risk = Math.min(100, risk + 15);
        updateLog("BACKDOOR_FAILED [+15% RISK]", 'bad');
    }
    checkAchievements();
    const rewardText = success ? `Funds +${displayMoney(money-previousMoney)} · Trace −${displayRiskPoints(previousRisk-risk)} points` : `Trace +${displayRiskPoints(risk-previousRisk)} points`;
    relayProtocol('backdoor','result',{success,deadlineAt:0,remainingMs:0,correctCount:backdoorClicked,errors:backdoorErrors,rewardText});
    relayEvent(success ? 'minigame-success' : 'minigame-fail',{game:'backdoor',rewardText});

    run.closeTimer = setTimeout(() => {
        if (!ownsMiniGame(run, 'backdoor', 'result')) return;
        if (container) container.style.display = 'none';
        run.phase = 'finished';
        activeMiniGame = null;
        updateBonusPrices();
        updateUI();
    }, 500);
}

// --- BYPASS ---
window.bypass = function() {
    if (currentPresentationScreen()!=='game' || bypassCharge < bypassChargeMax) return;
    const screenBypass = document.getElementById('screen-bypass');
    if (!screenBypass) return;
    const run = beginMiniGame('bypass');
    if (!run) return;
    run.phase = 'active';
    achievementStats.bypassCount++;
    if (screenBypass) screenBypass.style.display = 'flex';
    bypassLevel = 1;
    bypassSpeed = 0.8;
    bypassTolerance = 18;
    startBypassLevel(run);
}

function startBypassLevel(run = activeMiniGame) {
    if (!ownsMiniGame(run, 'bypass', 'active') || currentPresentationScreen() !== 'bypass') return;
    const levelGeneration = (run.levelGeneration || 0) + 1;
    run.levelGeneration = levelGeneration;
    bypassGauge = 0; bypassDirection = 1;
    bypassTarget = 20 + Math.random() * 60;
    const levelText = document.getElementById('bypass-level-text');
    if (levelText) levelText.textContent = String(bypassLevel);
    const targetEl = document.getElementById('bypass-target');
    if (targetEl) { targetEl.style.left = (bypassTarget - bypassTolerance) + "%"; targetEl.style.width = (bypassTolerance * 2) + "%"; }
    relayProtocol('bypass','active',{action:'ready',level:bypassLevel,stops:bypassLevel-1,rewardReduction:bypassLevel>2?(bypassLevel-1)*2:0,target:bypassTarget,tolerance:bypassTolerance,success:null,rewardText:''});
    if (bypassInterval) cancelAnimationFrame(bypassInterval);
    let previousTime = null;
    let accumulator = 0;
    function animateBypass(timestamp) {
        if (!ownsMiniGame(run, 'bypass', 'active') || run.levelGeneration !== levelGeneration || currentPresentationScreen() !== 'bypass') return;
        if(previousTime === null) previousTime = timestamp;
        accumulator += Math.max(0, timestamp-previousTime);
        previousTime = timestamp;
        // Fixed 60Hz steps preserve the old gauge curve on all display refresh rates.
        const steps = Math.floor((accumulator + 1e-7) / (1000/60));
        accumulator -= steps * (1000/60);
        let lastCycle = -1;
        for (let step = 0; step < steps; step++) {
            updateBypassGauge(false);
            // Every return to the left end has identical state. Skip whole
            // cycles after a long stall instead of doing unbounded DOM work.
            if (bypassGauge === 0 && bypassDirection === 1) {
                if (lastCycle >= 0) {
                    const cycleLength = step - lastCycle;
                    step += Math.floor((steps - step - 1) / cycleLength) * cycleLength;
                }
                lastCycle = step;
            }
        }
        paintBypassGauge();
        bypassInterval = requestAnimationFrame(animateBypass);
    }
    bypassInterval = requestAnimationFrame(animateBypass);
}

function updateBypassGauge(paint = true) {
    const distanceToTarget = Math.abs(bypassGauge - bypassTarget);
    const slowdownZone = bypassTolerance * 1.5;

    let currentSpeed = bypassSpeed;
    if (distanceToTarget < slowdownZone) {
        const slowdownFactor = Math.max(0.7, distanceToTarget / slowdownZone);
        currentSpeed = bypassSpeed * slowdownFactor;
    }

    bypassGauge += currentSpeed * bypassDirection;

    if (bypassGauge >= 100) { bypassGauge = 100; bypassDirection = -1; }
    if (bypassGauge <= 0) { bypassGauge = 0; bypassDirection = 1; }

    if (paint) paintBypassGauge();
}

function paintBypassGauge() {
    const slowdownZone = bypassTolerance * 1.5;
    const cursor = document.getElementById('bypass-cursor');
    if (cursor) {
        cursor.style.left = bypassGauge + "%";
        const displayedDistance = Math.abs(bypassGauge - bypassTarget);
        if (displayedDistance <= bypassTolerance) {
            cursor.dataset.proximity = 'inside';
        } else if (displayedDistance <= slowdownZone) {
            cursor.dataset.proximity = 'near';
        } else {
            cursor.dataset.proximity = 'far';
        }
    }
}

window.attemptBypass = function() {
    if (!ownsMiniGame(activeMiniGame, 'bypass', 'active') || currentPresentationScreen() !== 'bypass') return;
    const min = bypassTarget - bypassTolerance;
    const max = bypassTarget + bypassTolerance;

    if (bypassGauge >= min && bypassGauge <= max) {
        if (bypassLevel >= 50) {
            bypassLevel++; // Count the successful final stop before applying its reward.
            updateLog("MAX_BYPASS_REACHED", 'good');
            exitBypassGame(false);
            return;
        }
        playSfx('click');
        bypassLevel++;

        bypassSpeed *= 1.12;
        bypassTolerance *= 0.92;

        if (bypassTolerance < 5) bypassTolerance = 5;

        updateLog(`LOCKPICK_SUCCESS: LVL ${bypassLevel-1}`, 'good');
        relayProtocol('bypass','active',{action:'lock',level:bypassLevel,stops:bypassLevel-1,rewardReduction:bypassLevel>2?(bypassLevel-1)*2:0});
        startBypassLevel();
    } else {
        updateLog("BYPASS_FAILED", 'bad');
        exitBypassGame(true);
    }
}

window.exitBypassGame = function(isFail = false) {
    const run = activeMiniGame;
    if (!ownsMiniGame(run, 'bypass', 'active') || currentPresentationScreen() !== 'bypass') return;
    run.phase = 'result';
    cancelAnimationFrame(bypassInterval);
    bypassInterval = null;
    const screenBypass = document.getElementById('screen-bypass');
    if (screenBypass) screenBypass.style.display = 'none';

    if (bypassLevel - 1 >= 10) achievementStats.bypassLevel10Plus++;
    const previousRisk = risk;

    if (bypassLevel > 2) {
        const reduction = (bypassLevel - 1) * 2;
        risk = Math.max(0, risk - reduction);
        updateLog(`BYPASS_REWARD: -${reduction}% RISK`, 'good');
    } else if (isFail) {
        updateLog("BYPASS_FAILED: NO_REWARD", 'bad');
    }
    const reductionApplied = previousRisk-risk;
    const rewardText = reductionApplied>0 ? `Trace −${displayRiskPoints(reductionApplied)} points` : bypassLevel>2 ? 'Trace already clear · No reduction needed' : 'No reduction earned · 2 stops needed';
    relayProtocol('bypass','result',{success:!isFail,stops:bypassLevel-1,rewardReduction:reductionApplied,rewardText});
    relayEvent(isFail ? 'minigame-fail':'minigame-success',{game:'bypass',rewardText,rewardValue:reductionApplied});

    bypassCharge = 0;
    checkAchievements();
    activeMiniGame = null;
    updateUI();
}

// --- TRANSFER ---
window.transfer = function() {
    if(window.RiskSaveLoading || window.RiskSaveReadBlocked || currentPresentationScreen()!=='game') return;
    if (sessionHackCount === 0) {
        updateLog('Complete a hack before extraction.', 'info');
        return;
    }
    if (money > 0) {
        relayEvent('transfer',{money,risk,recap:{...sessionStats}});

        checkSessionEndAchievements();

        achievementStats.successfulSessions++;

        if (screenSuccess) {
            const recap = screenSuccess.querySelector('p');
            if (recap) {
                recap.style.fontSize = "0.65rem";
                recap.style.letterSpacing = "1px";
                recap.style.lineHeight = "1.4";
                recap.innerHTML = `
                    Banked $${money.toFixed(2)}<br><br>
                    <span style="color:white;opacity:0.6">Final risk</span> ${risk.toFixed(0)}%<br>
                    <span style="color:white;opacity:0.6">Peak risk</span> ${sessionStats.maxRisk.toFixed(0)}%<br>
                    <span style="color:white;opacity:0.6">Nodes</span> ${sessionStats.maxNodes}<br>
                    <span style="color:white;opacity:0.6">Peak multiplier</span> ×${sessionStats.maxMultiplier.toFixed(0)}
                `;
            }
            screenSuccess.style.display = 'flex';
        }

        totalMoney = addCurrency(totalMoney, money);
        submitScoreToDreamlo(totalMoney);
        checkAchievements();
        money = 0; risk = 0; nodesHacked = 0; multiplier = 1; streakCounter = 0; bypassCharge = 0;
        sessionHackCount = 0;
        resetTempBuffs(); resetSessionStats(); resetSessionAchievementStats(); updateUI();
        window.saveGameState();
    }
};

// --- BUY BONUS ---
window.buyBonus = function(id) {
    if(window.RiskSaveLoading || window.RiskSaveReadBlocked || currentPresentationScreen()!=='game' || ![1,2,3,4,5,6].includes(id)) return;
    const costs = getBonusCosts();
    if (!getBonusAvailability(costs)[id-1].available) { relayEvent('denied',{bonusId:id}); return; }
    // Charge once, then commit purchase credit before an outcome can reset the run.
    money -= costs[id-1];
    if (!achievementStats.bonusesBoughtThisSession.includes(id)) achievementStats.bonusesBoughtThisSession.push(id);
    achievementStats.boughtAllBonusesThisSession = achievementStats.bonusesBoughtThisSession.length === 6;
    if (achievementStats.boughtAllBonusesThisSession && !achievements.fullArsenal.unlocked) unlockAchievement('fullArsenal');
    if (id === 1) {
        risk = Math.max(0, risk - 10);
        coolerPurchases++;
        updateLog("COOLED", 'good');
    } else if (id === 2) {
        insuranceTurns = 5;
        updateLog("INSURED [5 TURNS]", 'info');
    } else if (id === 3) {
        gambleCooldown = 5;

        achievementStats.gambleStreak++;
        if (achievementStats.gambleStreak > achievementStats.maxGambleStreak) {
            achievementStats.maxGambleStreak = achievementStats.gambleStreak;
        }
        if (!achievements.yoloMode.unlocked && achievementStats.gambleStreak >= 10) {
            unlockAchievement('yoloMode');
        }

        const roll = Math.random() * 100;
        const algoBonus = Math.min(pUpgrades.algo.lvl, 4);
        const winC = 1 + algoBonus;
        if (roll < winC) {
            money = addCurrency(money, money); risk = Math.max(0, risk - 15);
            achievementStats.jackpotsWon++;
            updateLog("JACKPOT!", 'good');
        }
        else if (roll < winC + 38) {
            risk = Math.max(0, risk - 20);
            updateLog("RISK_REDUCED [-20 PTS]", 'good');
        }
        else if (roll < winC + 38 + 23) {
            risk = Math.min(100, risk + 10);
            updateLog("RISK_PENALTY [+10 PTS]", 'bad');
        }
        else if (roll < winC + 38 + 23 + 28) {
            updateLog("GAMBLE_LOSS", 'bad');
        }
        else if (roll < winC + 38 + 23 + 28 + 1) {
            risk = 0;
            updateLog("PURGED", 'good');
        }
        else {
            if (ghostShieldActive) {
                ghostShieldActive = false; risk = 0;
                achievementStats.ghostShieldSaves++;
                relayEvent('ghost-save');
                updateLog("GHOST_SAVED", 'good');
            }
            else { relayEvent('bonus',{bonusId:id}); showBusted(); return; }
        }
    } else if (id === 4) {
        ghostShieldActive = true; ghostCooldown = 5;
        ghostPurchases++;
        achievementStats.ghostShieldUses++;
        updateLog("GHOST_SHIELD_UP", 'good');
    } else if (id === 5) {
        risk *= 0.6;
        proxyPurchases++;
        updateLog("PROXY_UP", 'good');
    } else if (id === 6) {
        risk = Math.min(100, risk * 1.5);
        overclockCooldown = 7;
        overclockBonusTurns = 2;
        updateLog("OVRCLK ACTIVATED [2 TURNS]", 'good');
    }

    // A valid effect remains a purchase even when a tiny price is below the
    // representable precision of a very large balance.
    relayEvent('bonus',{bonusId:id});
    updateUI(); updateBonusPrices();
    checkAchievements();
};

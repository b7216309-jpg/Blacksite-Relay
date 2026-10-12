// Localization stays in the presentation layer; renderer-only fixtures keep English.
function gameText(key, english, params = {}) {
    if (window.RiskI18n) return window.RiskI18n.t('game.' + key, params, english);
    return english.replace(/\{(\w+)\}/g, (match, name) => Object.hasOwn(params, name) ? String(params[name]) : match);
}
function gameNumber(value, options = {}) {
    return window.RiskI18n?.number(value, options) ?? Number(value).toLocaleString('en-US', options);
}
function gameDollars(value, options = {}) {
    const number = gameNumber(value, options);
    return window.RiskI18n?.language === 'fr' ? number + ' $' : '$' + number;
}

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
let resolveInitialSave;
const initialSaveReady = new Promise(resolve => { resolveInitialSave = resolve; });
window.RiskQuitBlocking = false;
if (document.body) document.body.inert = true;
// The menu exists before window.onload and IPC may be slow. Capture input before
// inline handlers or UI listeners can start a run or save uninitialized defaults.
for (const type of ['pointerdown', 'click', 'keydown', 'input', 'change']) {
    document.addEventListener(type, event => {
        if (!window.RiskSaveLoading || event.target?.closest?.('#relay-quit-dialog')) return;
        event.preventDefault?.(); event.stopImmediatePropagation?.();
    }, true);
}

function saveStatus(state) {
    if (document.body) document.body.dataset.saveState = state;
    document.dispatchEvent(new CustomEvent('risk:save-state', { detail: { state } }));
    const message = state === 'load-error' ? gameText("save.loadError", "Save unavailable. Your existing save is protected; restart to retry.")
        : state === 'save-error' ? gameText("save.writeError", "Save failed. Your previous save is protected; changes will retry on the next save.") : '';
    if (message && message !== lastSaveProblem && !window.RiskQuitBlocking) window.RelayUI?.notify?.(() => state === 'load-error' ? gameText('save.loadError', 'Save unavailable. Your existing save is protected; restart to retry.') : gameText('save.writeError', 'Save failed. Your previous save is protected; changes will retry on the next save.'));
    lastSaveProblem = message;
}

window.quitGame = function() {
    if (typeof window.electronAPI.onQuitRequested === 'function') {
        window.electronAPI.closeApp();
        return;
    }
    return window.RiskQuit?.request();
};

window.saveGameState = function() {
    if (window.RiskQuit?.getState().discarding) return Promise.resolve(false);
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
    hearthstoneReady = false;
    window.RiskSaveLoading = true;
    if (document.body) document.body.inert = !window.RiskQuitBlocking;
    saveStatus('loading');
    saveLoadPromise = Promise.resolve().then(async () => {
        let reconciledAchievements = false;
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
                reconciledAchievements = checkAchievementMilestones(Object.keys(achievements), true);
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
            resolveInitialSave?.(!window.RiskSaveReadBlocked);
            resolveInitialSave = null;
            if (reconciledAchievements && !window.RiskSaveReadBlocked) window.saveGameState();
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

// Achievement goals are the single source for both rules and their displayed numbers.
function defineAchievement(id, englishName, icon, goal, englishDescription, secret = false) {
    return { unlocked: false, icon, goal: Object.freeze(goal), secret,
        get name() { return gameText('achievement.' + id + '.name', englishName); },
        get desc() {
            const values = Object.fromEntries(Object.entries(goal).filter(([, value]) => typeof value === 'number').map(([key, value]) => [key, gameNumber(value)]));
            return gameText('achievement.' + id + '.description', englishDescription, values);
        } };
}
let achievements = {
    firstBlood: defineAchievement("firstBlood", "FIRST BLOOD", "[$]", {"metric":"bank","target":100}, "Hold ${target} in your bank.", false),
    cryptoMill: defineAchievement("cryptoMill", "FIVE FIGURES", "[*]", {"metric":"bank","target":10000}, "Hold ${target} in your bank.", false),
    whaleStatus: defineAchievement("whaleStatus", "WHALE STATUS", "[W]", {"metric":"bank","target":100000}, "Hold ${target} in your bank.", false),
    nodeRunner: defineAchievement("nodeRunner", "NODE RUNNER", "[#]", {"metric":"nodes","target":3}, "Complete {target} nodes across your runs.", false),
    networkMaster: defineAchievement("networkMaster", "NETWORK MASTER", "[@]", {"metric":"nodes","target":50}, "Complete {target} nodes across your runs.", false),
    livingDanger: defineAchievement("livingDanger", "LIVING DANGEROUSLY", "[!]", {"metric":"peakRisk","target":80}, "Reach {target}% trace risk.", false),
    onTheEdge: defineAchievement("onTheEdge", "CLEAN SIGNAL", "[~]", {"metric":"cleanInjection","target":1}, "Complete Injection without a mistake.", false),
    comebackKing: defineAchievement("comebackKing", "COMEBACK KING", "[K]", {"peak":90,"risk":0}, "Reach {peak}% risk, then clear it in one run.", false),
    riskTaker: defineAchievement("riskTaker", "TOTAL RECALL", "[X]", {"metric":"cleanMemory","target":1}, "Complete Memory without a wrong port.", false),
    untouchable: defineAchievement("untouchable", "UNTOUCHABLE", "[=]", {"funds":500,"risk":0}, "Transfer ${funds}+ at {risk}% risk.", false),
    lockpickApp: defineAchievement("lockpickApp", "LOCKPICK APPRENTICE", "[>]", {"metric":"bypassStops","target":5}, "Complete {target} stops in one Bypass.", false),
    masterHacker: defineAchievement("masterHacker", "MASTER HACKER", "[%]", {"metric":"bypassStops","target":20}, "Complete {target} stops in one Bypass.", false),
    legendaryCrack: defineAchievement("legendaryCrack", "LEGENDARY CRACKER", "[&]", {"metric":"bypassStops","target":50}, "Complete {target} stops in one Bypass.", false),
    speedRunner: defineAchievement("speedRunner", "QUICK HANDS", "[/]", {"stops":10,"seconds":15}, "Complete {stops} Bypass stops within {seconds} seconds.", false),
    bypassAddict: defineAchievement("bypassAddict", "RELAY REGULAR", "[+]", {"metric":"bypasses10","target":5}, "Complete 10+ stops in {target} Bypasses.", false),
    comboSpec: defineAchievement("comboSpec", "COMBO SPECIALIST", "[)]", {"metric":"hacks","target":10}, "Complete {target} hacks in one run.", false),
    multMadness: defineAchievement("multMadness", "MULTIPLIER MADNESS", "[^]", {"metric":"multiplier","target":20}, "Reach a ×{target} multiplier.", false),
    ghostProto: defineAchievement("ghostProto", "GHOST PROTOCOL", "[?]", {"metric":"ghostBuys","target":1}, "Buy your first Ghost shield.", false),
    luckyGambler: defineAchievement("luckyGambler", "LUCKY BREAK", "[7]", {"metric":"usefulGambles","target":1}, "Gain funds or lower risk with Gamble.", false),
    fullArsenal: defineAchievement("fullArsenal", "FULL ARSENAL", "[A]", {"bonuses":6}, "Buy all {bonuses} bonuses in one run.", false),
    survivor: defineAchievement("survivor", "SURVIVOR", "[v]", {"metric":"transfers","target":1}, "Complete your first transfer.", false),
    veteran: defineAchievement("veteran", "VETERAN", "[V]", {"metric":"transfers","target":10}, "Complete {target} transfers.", false),
    immortal: defineAchievement("immortal", "IMMORTAL", "[8]", {"metric":"transfers","target":25}, "Complete {target} transfers.", false),
    closeCall: defineAchievement("closeCall", "CLOSE CALL", "[+]", {"metric":"ghostSaves","target":1}, "Have Ghost prevent a bust.", false),
    perfectRun: defineAchievement("perfectRun", "PERFECT RUN", "[*]", {"hacks":10,"funds":500,"risk":50}, "Transfer ${funds}+ after {hacks} hacks. Never exceed {risk}% risk.", false),
    brain404: defineAchievement("brain404", "FAILSAFE", "[0]", {"recovery":100}, "Recover ${recovery}+ from a bust with Insure.", false),
    yoloMode: defineAchievement("yoloMode", "ALL IN", "[Y]", {"gambles":3,"funds":500}, "Use Gamble {gambles} times, then transfer ${funds}+.", false),
    negotiator: defineAchievement("negotiator", "THE NEGOTIATOR", "[N]", {"hacks":10,"funds":1000,"bonuses":0}, "Transfer ${funds}+ after {hacks} hacks without buying bonuses.", false),
    masochist: defineAchievement("masochist", "MASOCHIST", "[M]", {"hacks":6,"funds":500}, "Transfer ${funds}+ after {hacks} hacks, using only Brute Force.", true),
    balanced: defineAchievement("balanced", "PERFECTLY BALANCED", "[-]", {"risk":67}, "Transfer when the risk meter shows {risk}%.", true),
    ascended: defineAchievement("ascended", "ASCENDED", "[P]", {"metric":"prestige","target":1}, "Prestige for the first time.", false),
    transcended: defineAchievement("transcended", "TRANSCENDED", "[T]", {"metric":"prestige","target":3}, "Reach Prestige {target}.", false),
    leeroyJenkins: defineAchievement("leeroyJenkins", "LEEROY JENKINS", "[!]", {"hacks":3}, "Open a run with {hacks} Brute Force hacks and no bonuses.", true),
    hearthstone: defineAchievement("hearthstone", "HEARTHSTONE", "[~]", {"risk":80}, "Use Proxy at {risk}%+ risk, then transfer as your next action.", true)
};

let achievementStats = {
    totalNodesValidated: 0,
    successfulSessions: 0,
    bypassCount: 0,
    bypassLevel10Plus: 0,
    ghostShieldUses: 0,
    ghostShieldSaves: 0,
    jackpotsWon: 0,
    usefulGambles: 0,
    cleanInjectionWins: 0,
    cleanMemoryWins: 0,
    bestBypassStops: 0,
    bestMultiplier: 1,
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
// A one-action escape sequence belongs only to the active run, never the save.
let hearthstoneReady = false;
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
    if (risk > achievements.perfectRun.goal.risk) achievementStats.perfectRunActive = false;
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
// Stay below the narrowest 10-point target width so every pass has a
// hittable 60Hz sample. The old exponential curve skipped entire targets.
const bypassMaxSpeed = 8;
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
    if (num >= 1e15) return window.RiskI18n?.language === 'fr' ? num.toExponential(2).replace('.', ',') : num.toExponential(2);
    if (num >= 1e12) return (window.RiskI18n?.language === 'fr' ? gameNumber(num / 1e12, {minimumFractionDigits:1,maximumFractionDigits:1}) + ' Bn' : (num / 1e12).toFixed(1) + 'T');
    if (num >= 1e9) return (window.RiskI18n?.language === 'fr' ? gameNumber(num / 1e9, {minimumFractionDigits:1,maximumFractionDigits:1}) + ' Md' : (num / 1e9).toFixed(1) + 'B');
    if (num >= 1e6) return (window.RiskI18n?.language === 'fr' ? gameNumber(num / 1e6, {minimumFractionDigits:1,maximumFractionDigits:1}) + ' M' : (num / 1e6).toFixed(1) + 'M');
    if (num >= 1e3) return (window.RiskI18n?.language === 'fr' ? gameNumber(num / 1e3, {minimumFractionDigits:1,maximumFractionDigits:1}) + ' k' : (num / 1e3).toFixed(1) + 'K');
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
        window.RelayUI.notify(() => achievement.name+' — '+achievement.desc);
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

function achievementMetricValues() {
    return {
        bank: totalMoney, nodes: achievementStats.totalNodesValidated,
        peakRisk: achievementStats.maxRiskSurvived, hacks: achievementStats.maxStreak,
        bypassStops: achievementStats.bestBypassStops, bypasses10: achievementStats.bypassLevel10Plus,
        multiplier: achievementStats.bestMultiplier, transfers: achievementStats.successfulSessions,
        ghostBuys: achievementStats.ghostShieldUses, ghostSaves: achievementStats.ghostShieldSaves,
        usefulGambles: achievementStats.usefulGambles,
        cleanInjection: achievementStats.cleanInjectionWins, cleanMemory: achievementStats.cleanMemoryWins,
        prestige: prestigeLevel
    };
}

function checkAchievementMilestones(keys = Object.keys(achievements), silent = false) {
    const metrics = achievementMetricValues();
    let changed = false;
    for (const key of keys) {
        const ach = achievements[key];
        if (ach.unlocked || !ach.goal.metric || !Number.isFinite(metrics[ach.goal.metric]) || metrics[ach.goal.metric] < ach.goal.target) continue;
        if (silent) ach.unlocked = true;
        else unlockAchievement(key);
        changed = true;
    }
    return changed;
}

function checkBankAchievements() {
    checkAchievementMilestones(['firstBlood', 'cryptoMill', 'whaleStatus']);
}

function checkAchievements() {
    updateSessionStats();
    achievementStats.maxRiskSurvived = Math.max(achievementStats.maxRiskSurvived, risk, sessionStats.maxRisk);
    achievementStats.maxStreak = Math.max(achievementStats.maxStreak, sessionHackCount);
    achievementStats.bestMultiplier = Math.max(achievementStats.bestMultiplier, multiplier);
    checkAchievementMilestones();
    if (!achievements.fullArsenal.unlocked && achievementStats.bonusesBoughtThisSession.length >= achievements.fullArsenal.goal.bonuses) unlockAchievement('fullArsenal');
    if (!achievements.comebackKing.unlocked && sessionStats.maxRisk >= achievements.comebackKing.goal.peak && risk === achievements.comebackKing.goal.risk) {
        achievementStats.comebackAchieved = true;
        unlockAchievement('comebackKing');
    }
}

function checkSessionEndAchievements() {
    if (sessionHackCount === 0 || money <= 0) return;
    if (hearthstoneReady) unlockAchievement('hearthstone');
    const g = key => achievements[key].goal;
    if (risk === g('untouchable').risk && money >= g('untouchable').funds) unlockAchievement('untouchable');
    if (sessionHackCount >= g('perfectRun').hacks && money >= g('perfectRun').funds && sessionStats.maxRisk <= g('perfectRun').risk && achievementStats.perfectRunActive) unlockAchievement('perfectRun');
    if (Math.floor(risk) === g('balanced').risk) unlockAchievement('balanced');
    if (achievementStats.gambleStreak >= g('yoloMode').gambles && money >= g('yoloMode').funds) unlockAchievement('yoloMode');
    if (sessionHackCount >= g('negotiator').hacks && money >= g('negotiator').funds && achievementStats.bonusesBoughtThisSession.length === g('negotiator').bonuses) unlockAchievement('negotiator');
    if (achievementStats.bruteForceOnly && sessionHackCount >= g('masochist').hacks && money >= g('masochist').funds) unlockAchievement('masochist');
}

function resetSessionAchievementStats() {
    hearthstoneReady = false;
    achievementStats.gambleStreak = 0;
    achievementStats.bruteForceOnly = true;
    achievementStats.comebackAchieved = false;
    achievementStats.perfectRunActive = true;
    achievementStats.boughtAllBonusesThisSession = false;
    achievementStats.bonusesBoughtThisSession = [];
    // Retired save fields remain compatible; there is no idle achievement timer.
    achievementStats.highMoneyTime = 0;
    achievementStats.negotiatorStartTime = 0;
}

function getAchievementPresentation() {
    const metrics = achievementMetricValues();
    const scopes = {bank:gameText("scope.bank", "Bank"),nodes:gameText("scope.all-runs", "All runs"),peakRisk:gameText("scope.best-run", "Best run"),hacks:gameText("scope.best-run", "Best run"),bypassStops:gameText("scope.best-bypass", "Best Bypass"),bypasses10:gameText("scope.all-runs", "All runs"),multiplier:gameText("scope.best-run", "Best run"),transfers:gameText("scope.all-runs", "All runs"),ghostBuys:gameText("scope.all-runs", "All runs"),ghostSaves:gameText("scope.all-runs", "All runs"),usefulGambles:gameText("scope.all-runs", "All runs"),cleanInjection:gameText("scope.one-injection", "One Injection"),cleanMemory:gameText("scope.one-memory", "One Memory"),prestige:gameText("scope.prestige", "Prestige")};
    return Object.freeze(Object.entries(achievements).map(([id, ach]) => {
        const target = ach.goal.metric ? ach.goal.target : null;
        const raw = target === null ? null : Math.max(0, Math.min(target, metrics[ach.goal.metric] || 0));
        const current = target === null ? null : ach.unlocked ? target : raw;
        const format = value => ach.goal.metric === 'bank' ? displayMoney(value) : gameNumber(value);
        return Object.freeze({id, name:ach.name, description:ach.desc,
            icon:ach.icon, unlocked:ach.unlocked, secret:ach.secret, current, target,
            progressLabel:target === null ? '' : `${format(current)} / ${format(target)}`,
            scope:scopes[ach.goal.metric] || gameText("scope.one-run", "One run")});
    }));
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
        if (window.RiskQuitBlocking || e.defaultPrevented || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
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
    if (window.RiskQuitBlocking) {
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
    if (window.RiskQuitBlocking) return;
    if (window.RiskSaveLoading || !['menu','settings'].includes(currentPresentationScreen())) return;
    const overlay = document.getElementById('screen-tutorial');
    if (overlay) overlay.style.display = 'flex';
}

window.closeTutorial = function() {
    if (window.RiskQuitBlocking) return;
    if (window.RiskSaveLoading || currentPresentationScreen() !== 'tutorial') return;
    const overlay = document.getElementById('screen-tutorial');
    if (overlay) overlay.style.display = 'none';
    if (window.RiskSaveReadBlocked) return;
    tutorialSeen = true;
    window.saveGameState();
}

// --- LEADERBOARD ---
async function submitLocalScore(score, notifyFailure = true) {
    if (!playerName || playerName === "ANONYMOUS" || !Number.isFinite(score) || score < 0) return false;
    try {
        const result = await window.electronAPI.submitScore(playerName, score);
        if (result !== 'OK') throw new Error('Local score was not saved');
        return true;
    } catch(e) {
        if (notifyFailure) window.RelayUI?.notify?.(() => gameText("leaderboard.saveError", "Local leaderboard unavailable. Score not recorded."));
        return false;
    }
}

let leaderboardRequest = 0;
let leaderboardSeed = '';
let leaderboardView = { message: null, error: false, entries: null };
function localAgentKey(name) {
    return Array.from(name.normalize('NFKC').replace(/[\u0000-\u001f\u007f\u200e\u200f\u202a-\u202e\u2066-\u2069]/g,'').replace(/\s+/gu,' ').trim()).slice(0,30).join('').toLowerCase();
}
function leaderboardMessage(key, english, isError = false) {
    leaderboardView = { message: { key, english }, error: isError, entries: null };
    renderLeaderboardMessage();
}
function renderLeaderboardMessage() {
    const { message, error: isError } = leaderboardView;
    if (!message) return;
    if (!leaderboardList) return;
    leaderboardList.innerHTML = '';
    const text = document.createElement('div');
    text.setAttribute('role', 'status');
    text.style.cssText = 'text-align:center;padding:32px 12px;line-height:1.8;';
    text.style.color = isError ? 'var(--accent-red)' : 'var(--text-muted)';
    text.textContent = gameText(message.key, message.english);
    leaderboardList.appendChild(text);
}
window.showLeaderboard = async function() {
    if (window.RiskQuitBlocking) return;
    if (window.RiskSaveLoading || window.RiskSaveReadBlocked || currentPresentationScreen() !== 'menu') return;
    const request = ++leaderboardRequest;
    if (mainMenu) mainMenu.style.display = 'none';
    if (screenLeaderboard) screenLeaderboard.style.display = 'flex';
    leaderboardList?.setAttribute('aria-busy', 'true');
    leaderboardMessage("leaderboard.loading", "Loading local scores...");

    try {
        // An old save can contribute its currently observed bank, never an invented historical peak.
        const seedKey = JSON.stringify([playerName, totalMoney]);
        if (playerName && playerName !== 'ANONYMOUS' && totalMoney > 0 && seedKey !== leaderboardSeed) {
            if (!await submitLocalScore(totalMoney, false)) throw new Error('Local score storage unavailable');
            leaderboardSeed = seedKey;
        }
        const rawData = await window.electronAPI.getLeaderboard();
        if (request !== leaderboardRequest) return;
        const data = JSON.parse(rawData);
        if (data?.scope !== 'local' || data.metric !== 'best-bank-balance' || !Array.isArray(data.entries)) throw new Error('Invalid local leaderboard');

        if (leaderboardList) {
            leaderboardList.innerHTML = "";
            const entries = data.entries.filter(item => item && typeof item.name === 'string' && item.name.trim() &&
                typeof item.score === 'number' && Number.isFinite(item.score) && item.score >= 0)
                .sort((a,b) => b.score-a.score).slice(0,10);
            leaderboardView = { entries, message: null, error: false };
            renderLeaderboardRows();
        }
    } catch (e) {
        if (request !== leaderboardRequest) return;
        leaderboardMessage("leaderboard.readError", "Local scores unavailable. Return and try again.", true);
    } finally {
        if (request === leaderboardRequest) leaderboardList?.setAttribute('aria-busy', 'false');
    }
}

// Language changes repaint the already fetched rows; they never seed or fetch scores.
function renderLeaderboardRows() {
    if (!leaderboardList) return;
    if (leaderboardView.message) { renderLeaderboardMessage(); return; }
    const entries = leaderboardView.entries;
    if (!entries) return;
    leaderboardList.innerHTML = '';
            entries.forEach((item, index) => {
                const row = document.createElement('div');
                row.setAttribute('role', 'listitem');
                row.style.display = 'flex';
                row.style.justifyContent = 'space-between';
                row.style.padding = '10px 5px';
                row.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
                row.style.fontFamily = 'monospace';
                const isMe = localAgentKey(item.name) === localAgentKey(playerName);
                const nameText = document.createTextNode(`${String(index + 1).padStart(2,'0')}  ${item.name}`);
                const nameSpan = document.createElement('span');
                nameSpan.title = item.name;
                nameSpan.style.color = isMe ? 'var(--accent-blue)' : 'white';
                nameSpan.style.minWidth = '0';
                nameSpan.style.overflowWrap = 'anywhere';
                nameSpan.style.paddingRight = '12px';
                nameSpan.appendChild(nameText);

                const scoreSpan = document.createElement('span');
                scoreSpan.style.color = 'var(--accent-green)';
                scoreSpan.style.flexShrink = '0';
                scoreSpan.textContent = item.score >= 1000 || (item.score > 0 && item.score < .01) ? displayMoney(item.score) : gameDollars(item.score, {maximumFractionDigits:2});
                scoreSpan.title = item.score > 0 && item.score < .01 ? gameText("money.tiny", "Less than $0.01") : gameDollars(item.score, {maximumFractionDigits:2});

                row.appendChild(nameSpan);
                row.appendChild(scoreSpan);
                leaderboardList.appendChild(row);
            });
            if (!entries.length) leaderboardMessage("leaderboard.empty", "No local scores yet. Complete a transfer to set your first record.");
}

window.backToMenuFromLeaderboard = () => {
    if (window.RiskQuitBlocking) return;
    if (currentPresentationScreen() !== 'leaderboard') return;
    leaderboardRequest++;
    if (screenLeaderboard) screenLeaderboard.style.display = 'none';
    if (mainMenu) mainMenu.style.display = 'flex';
}

window.showAchievements = function() {
    if (window.RiskQuitBlocking) return;
    if (window.RiskSaveLoading || window.RiskSaveReadBlocked || currentPresentationScreen() !== 'menu') return;
    if (mainMenu) mainMenu.style.display = 'none';
    const screenAchievements = document.getElementById('screen-achievements');
    if (screenAchievements) screenAchievements.style.display = 'flex';
    renderAchievementsList();
}

window.backToMenuFromAchievements = () => {
    if (window.RiskQuitBlocking) return;
    if (currentPresentationScreen() !== 'achievements') return;
    const screenAchievements = document.getElementById('screen-achievements');
    if (screenAchievements) screenAchievements.style.display = 'none';
    if (mainMenu) mainMenu.style.display = 'flex';
}

function renderAchievementsList() {
    if (window.RelayAchievements) { window.RelayAchievements.render(getAchievementPresentation()); return; }
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
                    ${isSecret ? gameText("achievement.secretName", "???_SECRET_???") : ach.name}
                </div>
                <div style="font-size: 0.75rem; opacity: 0.7; margin-top: 2px;">
                    ${isSecret ? gameText("achievement.secretDescription", "Secret achievement") : ach.desc}
                </div>
            </div>
            <div style="font-size: 1rem; font-family: monospace; color: var(--accent-green);">${ach.unlocked ? '[OK]' : ''}</div>
        `;

        achievementsList.appendChild(card);
    });

    const progressText = document.getElementById('achievement-progress');
    if (progressText) progressText.textContent = gameText("achievement.progress", "{unlocked}/{total} UNLOCKED", {unlocked:unlockedCount,total:totalCount});

    const counterInMenu = document.getElementById('achievement-counter');
    if (counterInMenu) counterInMenu.textContent = `${unlockedCount}/${totalCount}`;
}

// --- LOG SYSTEM (multi-line with fade) ---
function updateLog(msg, type = 'default', translation = null) {
    const colorMap = { bad: 'var(--accent-red)', good: 'var(--accent-green)', info: 'var(--accent-blue)' };
    const color = colorMap[type] || 'var(--accent-green)';

    logHistory.unshift({ msg, color, time: Date.now(), translation });
    if (logHistory.length > LOG_MAX) logHistory.pop();

    renderLogHistory();
}
function logGame(key, english, type = 'default', params = {}) {
    updateLog(english, type, { key, english, params });
}
function renderLogHistory() {
    if (logEl) {
        logEl.innerHTML = logHistory.map((entry, i) => {
            const opacity = 1 - (i * 0.3);
            return `<div style="color:${entry.color}; opacity:${opacity}; text-shadow: 0 0 5px ${entry.color}; font-size: 0.75rem; line-height: 1.4;">${escapeDisplayText(entry.translation ? gameText(entry.translation.key, entry.translation.english, entry.translation.params) : entry.msg)}</div>`;
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

function updateUI({presentationOnly = false} = {}) {
    if (!presentationOnly) updateSessionStats();
    if (moneyFill) moneyFill.style.width = `${Math.min((money / 1000000) * 100, 100)}%`;
    if (riskFill) riskFill.style.width = `${Math.min(risk, 100)}%`;
    if (nodeFill) nodeFill.style.width = `${Math.min(nodesHacked, 100)}%`;
    if (moneyText) {
        const newText = displayMoney(money);
        if (moneyText.textContent !== newText) {
            moneyText.textContent = newText;
            if (!presentationOnly) {
                moneyText.classList.add('flash-good');
                setTimeout(() => moneyText.classList.remove('flash-good'), 300);
            }
        }
    }
    if (riskText) {
        const newRisk = `${Math.floor(risk)}%`;
        if (riskText.textContent !== newRisk) {
            riskText.textContent = newRisk;
            if (risk > 50 && !presentationOnly) {
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
        if(ghostShieldActive) buffs.push([gameText("buff.ghost", "GHOST 1 HIT"),gameText("buff.ghostHint", "Protects the next detection")]);
        if(insuranceTurns>0) buffs.push([gameText("buff.insurance", "INS {turns}T", {turns:insuranceTurns}),gameText(insuranceTurns===1 ? "buff.insuranceHint.one" : "buff.insuranceHint", insuranceTurns===1 ? "Insurance: {turns} hack remaining" : "Insurance: {turns} hacks remaining", {turns:insuranceTurns})]);
        if(overclockBonusTurns>0) buffs.push([gameText("buff.overclock", "OVR {turns}T", {turns:overclockBonusTurns}),gameText(overclockBonusTurns===1 ? "buff.overclockHint.one" : "buff.overclockHint", overclockBonusTurns===1 ? "Double gains for {turns} hack" : "Double gains for {turns} hacks", {turns:overclockBonusTurns})]);
        if(ghostCooldown>0 && !ghostShieldActive) buffs.push([gameText("buff.ghostCooldown", "G-CD {turns}", {turns:ghostCooldown}),gameText("buff.ghostCooldownHint", "Ghost cooldown in hacks")]);
        if(overclockCooldown>0) buffs.push([gameText("buff.overclockCooldown", "O-CD {turns}", {turns:overclockCooldown}),gameText("buff.overclockCooldownHint", "Overclock cooldown in hacks")]);
        if(prestigeLevel>0) buffs.push(['P'+formatNumber(prestigeLevel),gameText("prestige.levelHint", "Prestige level")]);
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
        if(label) {label.textContent=displayMoney(cost);label.title=cost>0 && cost<0.01 ? gameText("money.tinyLong", "Less than 0.01 dollars") : gameText(cost===1 ? "money.dollars.one" : "money.dollars", cost===1 ? "{amount} dollar" : "{amount} dollars", {amount:gameNumber(cost,{minimumFractionDigits:2,maximumFractionDigits:2})});}
    });
    const availability = presentationBonusState(costs);
    availability.forEach((state,index)=>{
        const label=document.getElementById('price-'+(index+1));
        const button=label?.parentElement;
        if(button) {button.disabled=false;button.setAttribute('aria-disabled',String(!state.available));button.classList.toggle('affordable',state.available);button.classList.toggle('cooling',!state.available);button.style.opacity='';button.style.cursor='';}
        const status=document.getElementById('bonus-status-'+(index+1));
        if(status) status.textContent=window.RiskI18n?.bonusStatus?.(state.status) ?? state.status;
    });
    if (publish) publishPresentation();
}

// Result values survive the gameplay reset and can be translated without replaying it.
let lastGameResult = null;
function renderGameRecap() {
    if (!lastGameResult) return;
    const result = lastGameResult;
    const screen = result.kind === 'success' ? screenSuccess : screenBusted;
    const recap = screen?.querySelector('p');
    if (!recap) return;
    recap.style.fontSize = '0.65rem';
    recap.style.letterSpacing = '1px';
    recap.style.lineHeight = '1.4';
    const labels = [
        [gameText('result.finalRisk', 'Final risk'), gameNumber(Math.floor(result.risk)) + '%'],
        [gameText('result.peakRisk', 'Peak risk'), gameNumber(Math.floor(result.maxRisk)) + '%'],
        [gameText('result.nodes', 'Nodes'), gameNumber(result.maxNodes)],
        [gameText('result.multiplier', 'Peak multiplier'), '×' + formatNumber(result.maxMultiplier)]
    ];
    const amount = value => Math.abs(value)>=1e6 ? displayMoney(value) : gameDollars(value,{minimumFractionDigits:2,maximumFractionDigits:2});
    const outcome = result.kind === 'success'
        ? gameText('result.banked', 'Banked {amount}', {amount:amount(result.money)})
        : gameText('result.lost', 'Lost {amount}', {amount:amount(result.lost ?? result.money)})
            + (result.recovered > 0 ? '<br><span class="result-recovered">' + gameText('result.recovered', 'Recovered {amount}', {amount:amount(result.recovered)}) + '</span>' : '');
    recap.innerHTML = outcome + '<br><br>' + labels.map(([label,value]) => '<span style="color:white;opacity:0.6">' + label + '</span> ' + value).join('<br>');
}

function showBusted() {
    if (window.RiskSaveLoading || window.RiskSaveReadBlocked || currentPresentationScreen() !== 'game') return;
    // Describe the actual settled recovery, including currency saturation, before
    // the run is cleared. This is also the value used by the existing bank rules.
    const bankAfterRecovery = insuranceTurns > 0 ? addCurrency(totalMoney, money * 0.5) : totalMoney;
    const recovered = Math.max(0, bankAfterRecovery - totalMoney);
    const lost = Math.max(0, money - recovered);
    relayEvent('bust', { money, risk, recovered, lost, recap:{...sessionStats} });

    lastGameResult = {kind:'busted',money,risk,recovered,lost,...sessionStats};
    if (screenBusted) {
        renderGameRecap();
        screenBusted.style.display = 'flex';
    }
    if (insuranceTurns > 0) {
        totalMoney = bankAfterRecovery;
        if (recovered >= achievements.brain404.goal.recovery) unlockAchievement('brain404');
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
    if (window.RiskQuitBlocking) return;
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
    if (window.RiskQuitBlocking) return;
    if (window.RiskSaveLoading || window.RiskSaveReadBlocked || currentPresentationScreen() !== 'menu') return;
    playSfx('click');
    if (playerNameInput && playerNameInput.value.trim() !== "") playerName = playerNameInput.value.trim();
    if (mainMenu) mainMenu.style.display = 'none';
    if (screenPersistent) screenPersistent.style.display = 'flex';
    updatePersistentUI();
}

window.backToMenu = function() {
    if (window.RiskQuitBlocking) return;
    if (currentPresentationScreen() !== 'persistent') return;
    playSfx('click');
    if (screenPersistent) screenPersistent.style.display = 'none';
    if (mainMenu) mainMenu.style.display = 'flex';
}

window.startGame = function() {
    if (window.RiskQuitBlocking) return;
    if (window.RiskSaveLoading || window.RiskSaveReadBlocked || currentPresentationScreen() !== 'persistent') return;
    playSfx('click');
    if (screenPersistent) screenPersistent.style.display = 'none';
    const pBonus = getPrestigeBonus();
    money = (pUpgrades.ram.lvl * 10) + pBonus.startMoney;
    risk = 0; nodesHacked = 0; multiplier = 1; streakCounter = 0; bypassCharge = 0;
    sessionHackCount = 0;
    resetTempBuffs(); resetSessionStats(); resetSessionAchievementStats();
    logHistory.length = 0;
    logGame("log.session", "SESSION_START: {name}", 'info', {name:playerName.toUpperCase()});
    if (prestigeLevel > 0) logGame("log.prestigeBonus", "PRESTIGE_BONUS: +{gain}% GAIN", 'info', {gain:Math.round((pBonus.gainMult - 1) * 100)});
    window.RiskPresentation?.startRun();
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
            <span style="font-weight:bold; color:#ffd700;">${gameText("prestige.level", "PRESTIGE_v{level}", {level:gameNumber(prestigeLevel)})}</span>
            <span style="font-size:0.75rem; color:var(--accent-blue);">${gameText("prestige.points", "PTS: {points}", {points:gameNumber(prestigePoints)})}</span>
            <span style="font-size:0.75rem; opacity:0.8;">${gameText("prestige.effects", "+10% gain, -2% risk, +50$ start")}</span>
            <span style="font-size:0.75rem; color:${canPrestige ? '#ffd700' : 'var(--accent-red)'}; margin-top:5px; font-weight:bold;">${canPrestige ? gameText("prestige.ready", "READY") : gameText("prestige.need", "NEED: {amount}$", {amount:formatNumber(pCost)})}</span>
        `;
        if (canPrestige) prestigeBtn.classList.add('affordable');
        else prestigeBtn.classList.remove('affordable');
    }

    const upgs = [
        { id: '1', key: 'ram', name: gameText("upgrade.ram.name", "RAM_INJECTION"), desc: gameText("upgrade.ram.description", "Start: +{amount}$", {amount:gameNumber(pUpgrades.ram.lvl * 10)}) },
        { id: '2', key: 'vpn', name: gameText("upgrade.vpn.name", "VPN_SHIELD"), desc: gameText("upgrade.vpn.description", "Risk: -{amount}%", {amount:gameNumber(pUpgrades.vpn.lvl)}) },
        { id: '3', key: 'miner', name: gameText("upgrade.miner.name", "MINER_V2"), desc: gameText("upgrade.miner.description", "Gain: +{amount}%", {amount:gameNumber(pUpgrades.miner.lvl * 20)}) },
        { id: '4', key: 'fan', name: gameText("upgrade.fan.name", "COOLING_FAN"), desc: gameText("upgrade.fan.description", "Cooler: -{amount}%", {amount:gameNumber(pUpgrades.fan.lvl)}) },
        { id: '5', key: 'algo', name: gameText("upgrade.algo.name", "DEEP_LEARNING"), desc: gameText("upgrade.algo.description", "Jackpot: {win}% / Bust: {bust}%", {win:1+pUpgrades.algo.lvl,bust:9-pUpgrades.algo.lvl}) },
        { id: '6', key: 'volt', name: gameText("upgrade.volt.name", "OVERVOLT"), desc: gameText("upgrade.volt.description", "Stealth: {amount}%", {amount:gameNumber(pUpgrades.volt.lvl)}) }
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
                <span style="font-size:0.75rem; color:var(--accent-blue);">${gameText("upgrade.level", "LVL {level}", {level:gameNumber(pUpgrades[u.key].lvl)})}</span>
                <span style="font-size:0.75rem; opacity:0.8;">${u.desc}</span>
                <span style="font-size:0.75rem; color:var(--accent-green); margin-top:5px; font-weight:bold;">${isMax ? 'MAX' : gameText("upgrade.cost", "COST: {amount}$", {amount:formatNumber(cost)})}</span>
            `;
        }
    });
}

window.buyPersistent = function(key) {
    if (window.RiskQuitBlocking) return;
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
    if (window.RiskQuitBlocking) return;
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

    logGame("log.prestigeComplete", "PRESTIGE_COMPLETE [LEVEL {level}]", 'good', {level:prestigeLevel});
    checkAchievements();
    updatePersistentUI();
    window.saveGameState();
}

// --- HACK ---
window.hack = function(level) {
    if (window.RiskQuitBlocking) return;
    if (window.RiskSaveLoading || window.RiskSaveReadBlocked || currentPresentationScreen() !== 'game' || ![1,2,3].includes(level)) return;

    hearthstoneReady = false;
    if (level !== 3) achievementStats.bruteForceOnly = false;
    // Accepted Gamble purchases belong to the whole run, not the short hack streak.

    if (gambleCooldown > 0) gambleCooldown--;

    let bGain = (level === 1) ? 5 : (level === 2) ? 20 : 50;
    let bRisk = (level === 1) ? 3 : (level === 2) ? 9 : 14;
    let vpnMult = 1.0 - (pUpgrades.vpn.lvl * 0.01);
    let currentMult = multiplier;

    // Prestige bonus
    const pBonus = getPrestigeBonus();

    if (overclockBonusTurns > 0) {
        currentMult *= 2;
        logGame(overclockBonusTurns===1 ? "log.overclock.one" : "log.overclock", "OVERCLOCK_BONUS [{turns} LEFT]", 'info', {turns:overclockBonusTurns});
        overclockBonusTurns--;
    }

    let minerMult = 1 + (pUpgrades.miner.lvl * 0.2);
    let fGain = bGain * currentMult * minerMult * pBonus.gainMult;
    let aRisk = bRisk * vpnMult * (1 - pBonus.riskReduction);
    if (Math.random() < (pUpgrades.volt.lvl * 0.01)) { aRisk = 0; logGame("log.stealth", "STEALTH_CLICK", 'good'); }

    if (risk > 0) {
        let eRisk = risk < 20 ? risk * 0.7 : risk;
        if (Math.random() < (eRisk / 100)) {
            if (ghostShieldActive) {
                ghostShieldActive = false;
                risk = 0;
                achievementStats.ghostShieldSaves++;
                relayEvent('ghost-save');
                logGame("log.ghostTriggered", "GHOST_SHIELD_TRIGGERED", 'good');
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
            logGame("log.multUp", "MULT_UP!", 'good');
        }
    } else if (level === 2) {
        if (streakCounter >= 2) {
            multiplier += 1;
            streakCounter = 0;
            logGame("log.streakUp", "STREAK_UP!", 'good');
        }
    } else if (level === 3) {
        if (streakCounter >= 3) {
            multiplier += 1;
            streakCounter = 0;
            logGame("log.streakUp", "STREAK_UP!", 'good');
        }
    }

    if(nodesHacked >= 100) {
        nodesValidated++;
        achievementStats.totalNodesValidated++;
        multiplier += 1; risk = Math.max(0, risk - 5); nodesHacked = 0;
        logGame("log.node", "NODE_VALIDATED", 'good');
        relayEvent('node');
    }
    if (ghostCooldown > 0) ghostCooldown--;
    if (overclockCooldown > 0) overclockCooldown--;
    if (insuranceTurns > 0) { insuranceTurns--; if (insuranceTurns === 0) logGame("log.insuranceExpired", "INSURANCE_EXPIRED", 'bad'); }
    if (bypassCharge < bypassChargeMax) { bypassCharge++; if(bypassCharge===bypassChargeMax) relayEvent('bypass-ready'); }

    if (!achievementStats.comebackAchieved && sessionStats.maxRisk >= achievements.comebackKing.goal.peak && risk === achievements.comebackKing.goal.risk) {
        unlockAchievement('comebackKing');
        achievementStats.comebackAchieved = true;
    }

    updateUI();
    updateBonusPrices();
    checkAchievements();
    if (sessionHackCount === achievements.leeroyJenkins.goal.hacks && achievementStats.bruteForceOnly && achievementStats.bonusesBoughtThisSession.length === 0) unlockAchievement('leeroyJenkins');
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
    if (roll < 25) { risk = Math.min(100, risk + 15); logGame("log.antivirus", "ANTIVIRUS_SCAN [+15% RISK]", 'bad'); }
    else if (roll < 50) { money = addCurrency(money, 50); logGame("log.packet", "PACKET_SNIFFED [+50$]", 'good'); }
    else if (roll < 75) { multiplier += 2; logGame("log.cpu", "CPU_OVERCLOCK [+2 MULT]", 'good'); }
    else if (roll < 95) { risk = 0; logGame("log.randomProxy", "GHOST_PROXY [RISK 0]", 'good'); }
    else { multiplier = 1; streakCounter = 0; logGame("log.overflow", "BUFFER_OVERFLOW [STREAK RESET]", 'bad'); }
    updateUI();
    checkAchievements();
}


const gameRewardEnglish = {"multiplier": "Multiplier +{amount}", "traceGain": "Trace +{amount} points", "traceReduction": "Trace −{amount} points", "memory": "Funds +{funds} · Trace −{amount} points", "traceClear": "Trace already clear · No reduction needed", "noReduction": "No reduction earned · 2 stops needed"};
function gameReward(key, values = {}) {
    const params = { ...values };
    if (Object.hasOwn(params, 'amount')) params.amount = displayRiskPoints(params.amount);
    if (Object.hasOwn(params, 'funds')) params.funds = displayMoney(params.funds);
    return { rewardKey: key, rewardValues: { ...values }, rewardText: gameText('reward.' + key, gameRewardEnglish[key] || '', params) };
}
window.RiskGameText = Object.freeze({
    reward(data) { return data?.rewardKey ? gameReward(data.rewardKey, data.rewardValues).rewardText : (data?.rewardText || ''); }
});

// --- TYPING PROTOCOL ---
// A run owns its callbacks through countdown, input and the memory result delay.
// Old timers and detached controls cannot settle or hide a later run.
let activeMiniGame = null;
let miniGameGeneration = 0;

function beginMiniGame(game) {
    if (window.RiskQuitBlocking) return;
    if (window.RiskSaveLoading || window.RiskSaveReadBlocked || activeMiniGame || typingActive || backdoorActive || currentPresentationScreen() !== 'game') return null;
    hearthstoneReady = false;
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
    logGame("log.typingDetected", "TYPING_PROTOCOL_DETECTED!", 'info');

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
    if (errorsEl) errorsEl.textContent = gameText("typing.errors", "ERRORS: {count}/{max}", {count:0,max:typingMaxErrors});

    if (countdownEl) {
        countdownEl.style.display = 'block';
        countdownEl.textContent = typingCountdown;
    }
    typingDeadlineAt = 0;
    relayProtocol('typing','countdown',{countdown:3,durationMs:typingTimeLimit+2000,deadlineAt:0,remainingMs:typingTimeLimit+2000,phrase:typingPhrase,input:'',errors:0,maxErrors:typingMaxErrors,correctCount:0,targetCount:typingPhrase.length,success:null,rewardText:'',rewardKey:null,rewardValues:null});

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
    if (window.RiskQuitBlocking) return;
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

    if (errorCount > 0 && activeMiniGame) activeMiniGame.hadTypingMistake = true;
    if (errorCount > typingMaxErrors) {
        relayProtocol('typing','active',{input:inputField.value,errors:errorCount,action:'mismatch'});
        failTypingProtocol();
        return;
    }

    typingErrors = errorCount;
    const errorsEl = document.getElementById('typing-errors');
    if (errorsEl) errorsEl.textContent = gameText("typing.errors", "ERRORS: {count}/{max}", {count:typingErrors,max:typingMaxErrors});

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
    const cleanInput = document.getElementById('typing-input')?.value.toLowerCase().trim() === typingPhrase.toLowerCase();
    if (cleanInput && !run.hadTypingMistake) achievementStats.cleanInjectionWins++;
    const bonus = Math.max(nodesValidated, 1);
    multiplier += bonus;
    checkAchievements();
    logGame("log.typingSuccess", "TYPING_SUCCESS [+{bonus} MULT]", 'good', {bonus});
    relayProtocol('typing','result',{success:true,deadlineAt:0,remainingMs:0,correctCount:typingPhrase.length,...gameReward('multiplier',{amount:bonus}),rewardValue:bonus});
    relayEvent('minigame-success',{game:'typing',rewardValue:bonus,...gameReward('multiplier',{amount:bonus})});
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
    logGame("log.typingFailed", "TYPING_FAILED [+10% RISK]", 'bad');
    relayProtocol('typing','result',{success:false,deadlineAt:0,remainingMs:0,...gameReward('traceGain',{amount:risk-previousRisk}),rewardValue:risk-previousRisk});
    relayEvent('minigame-fail',{game:'typing',rewardValue:risk-previousRisk,...gameReward('traceGain',{amount:risk-previousRisk})});
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
    logGame("log.memoryDetected", "BACKDOOR_PROTOCOL_DETECTED!", 'info');

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
    relayProtocol('backdoor','countdown',{countdown:3,durationMs:8000,deadlineAt:0,remainingMs:8000,errors:0,maxErrors:3,correctCount:0,targetCount:backdoorTargetCount,success:null,rewardText:'',rewardKey:null,rewardValues:null});

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
    if (window.RiskQuitBlocking) return;
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
        if (backdoorClicked === backdoorTargetCount && backdoorErrors === 0) achievementStats.cleanMemoryWins++;
        const bonus = multiplier * 3;
        money = addCurrency(money, bonus);
        risk = Math.max(0, risk - 25);
        logGame("log.memorySuccess", "BACKDOOR_SUCCESS [+{bonus}$ -25% RISK]", 'good', {bonus:bonus.toFixed(0)});
    } else {
        risk = Math.min(100, risk + 15);
        logGame("log.memoryFailed", "BACKDOOR_FAILED [+15% RISK]", 'bad');
    }
    checkAchievements();
    const reward = success ? gameReward('memory',{funds:money-previousMoney,amount:previousRisk-risk}) : gameReward('traceGain',{amount:risk-previousRisk});
    relayProtocol('backdoor','result',{success,deadlineAt:0,remainingMs:0,correctCount:backdoorClicked,errors:backdoorErrors,...reward});
    relayEvent(success ? 'minigame-success' : 'minigame-fail',{game:'backdoor',...reward});

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
    if (window.RiskQuitBlocking) return;
    if (currentPresentationScreen()!=='game' || bypassCharge < bypassChargeMax) return;
    const screenBypass = document.getElementById('screen-bypass');
    if (!screenBypass) return;
    const run = beginMiniGame('bypass');
    if (!run) return;
    run.phase = 'active';
    run.achievementStartedAt = performance.now();
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
    relayProtocol('bypass','active',{action:'ready',level:bypassLevel,stops:bypassLevel-1,rewardReduction:bypassLevel>2?(bypassLevel-1)*2:0,target:bypassTarget,tolerance:bypassTolerance,success:null,rewardText:'',rewardKey:null,rewardValues:null});
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
    if (window.RiskQuitBlocking) return;
    if (!ownsMiniGame(activeMiniGame, 'bypass', 'active') || currentPresentationScreen() !== 'bypass') return;
    const min = bypassTarget - bypassTolerance;
    const max = bypassTarget + bypassTolerance;

    if (bypassGauge >= min && bypassGauge <= max) {
        achievementStats.bestBypassStops = Math.max(achievementStats.bestBypassStops, bypassLevel);
        const quick = achievements.speedRunner.goal;
        const elapsed = performance.now() - activeMiniGame.achievementStartedAt;
        if (bypassLevel === quick.stops && elapsed >= 0 && elapsed <= quick.seconds * 1000) unlockAchievement('speedRunner');
        checkAchievementMilestones(['lockpickApp', 'masterHacker', 'legendaryCrack']);
        if (bypassLevel >= 50) {
            bypassLevel++; // Count the successful final stop before applying its reward.
            logGame("log.bypassMax", "MAX_BYPASS_REACHED", 'good');
            exitBypassGame(false);
            return;
        }
        playSfx('click');
        bypassLevel++;

        bypassSpeed = Math.min(bypassMaxSpeed, bypassSpeed * 1.12);
        bypassTolerance *= 0.92;

        if (bypassTolerance < 5) bypassTolerance = 5;

        logGame("log.bypassStop", "LOCKPICK_SUCCESS: LVL {level}", 'good', {level:bypassLevel-1});
        relayProtocol('bypass','active',{action:'lock',level:bypassLevel,stops:bypassLevel-1,rewardReduction:bypassLevel>2?(bypassLevel-1)*2:0});
        startBypassLevel();
    } else {
        logGame("log.bypassFailed", "BYPASS_FAILED", 'bad');
        exitBypassGame(true);
    }
}

window.exitBypassGame = function(isFail = false) {
    if (window.RiskQuitBlocking) return;
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
        logGame("log.bypassReward", "BYPASS_REWARD: -{reduction}% RISK", 'good', {reduction});
    } else if (isFail) {
        logGame("log.bypassNoReward", "BYPASS_FAILED: NO_REWARD", 'bad');
    }
    const reductionApplied = previousRisk-risk;
    const reward = reductionApplied>0 ? gameReward('traceReduction',{amount:reductionApplied}) : gameReward(bypassLevel>2 ? 'traceClear' : 'noReduction');
    relayProtocol('bypass','result',{success:!isFail,stops:bypassLevel-1,rewardReduction:reductionApplied,...reward});
    relayEvent(isFail ? 'minigame-fail':'minigame-success',{game:'bypass',...reward,rewardValue:reductionApplied});

    bypassCharge = 0;
    checkAchievements();
    activeMiniGame = null;
    updateUI();
}

// --- TRANSFER ---
window.transfer = function() {
    if (window.RiskQuitBlocking) return;
    if(window.RiskSaveLoading || window.RiskSaveReadBlocked || currentPresentationScreen()!=='game') return;
    if (sessionHackCount === 0) {
        logGame("log.hackFirst", "Complete a hack before extraction.", 'info');
        return;
    }
    if (money > 0) {
        relayEvent('transfer',{money,risk,recap:{...sessionStats}});

        checkSessionEndAchievements();

        achievementStats.successfulSessions++;

        lastGameResult = {kind:'success',money,risk,...sessionStats};
        if (screenSuccess) {
            renderGameRecap();
            screenSuccess.style.display = 'flex';
        }

        totalMoney = addCurrency(totalMoney, money);
        submitLocalScore(totalMoney);
        checkAchievements();
        money = 0; risk = 0; nodesHacked = 0; multiplier = 1; streakCounter = 0; bypassCharge = 0;
        sessionHackCount = 0;
        resetTempBuffs(); resetSessionStats(); resetSessionAchievementStats(); updateUI();
        window.saveGameState();
    }
};

// --- BUY BONUS ---
window.buyBonus = function(id) {
    if (window.RiskQuitBlocking) return;
    if(window.RiskSaveLoading || window.RiskSaveReadBlocked || currentPresentationScreen()!=='game' || ![1,2,3,4,5,6].includes(id)) return;
    const costs = getBonusCosts();
    if (!getBonusAvailability(costs)[id-1].available) { relayEvent('denied',{bonusId:id}); return; }
    // Charge once, then commit purchase credit before an outcome can reset the run.
    const beforeBonusMoney = money, beforeBonusRisk = risk;
    hearthstoneReady = id === 5 && beforeBonusRisk >= achievements.hearthstone.goal.risk;
    money -= costs[id-1];
    if (!achievementStats.bonusesBoughtThisSession.includes(id)) achievementStats.bonusesBoughtThisSession.push(id);
    achievementStats.boughtAllBonusesThisSession = achievementStats.bonusesBoughtThisSession.length === achievements.fullArsenal.goal.bonuses;
    if (achievementStats.boughtAllBonusesThisSession && !achievements.fullArsenal.unlocked) unlockAchievement('fullArsenal');
    if (id === 1) {
        risk = Math.max(0, risk - 10);
        coolerPurchases++;
        logGame("log.cooled", "COOLED", 'good');
    } else if (id === 2) {
        insuranceTurns = 5;
        logGame("log.insured", "INSURED [5 TURNS]", 'info');
    } else if (id === 3) {
        gambleCooldown = 5;

        achievementStats.gambleStreak++;
        if (achievementStats.gambleStreak > achievementStats.maxGambleStreak) {
            achievementStats.maxGambleStreak = achievementStats.gambleStreak;
        }

        const roll = Math.random() * 100;
        const algoBonus = Math.min(pUpgrades.algo.lvl, 4);
        const winC = 1 + algoBonus;
        const favorableOutcome = roll < winC + 38 || (roll >= winC + 89 && roll < winC + 90);
        if (roll < winC) {
            money = addCurrency(money, money); risk = Math.max(0, risk - 15);
            achievementStats.jackpotsWon++;
            logGame("log.jackpot", "JACKPOT!", 'good');
        }
        else if (roll < winC + 38) {
            risk = Math.max(0, risk - 20);
            logGame("log.riskReduced", "RISK_REDUCED [-20 PTS]", 'good');
        }
        else if (roll < winC + 38 + 23) {
            risk = Math.min(100, risk + 10);
            logGame("log.riskPenalty", "RISK_PENALTY [+10 PTS]", 'bad');
        }
        else if (roll < winC + 38 + 23 + 28) {
            logGame("log.gambleLoss", "GAMBLE_LOSS", 'bad');
        }
        else if (roll < winC + 38 + 23 + 28 + 1) {
            risk = 0;
            logGame("log.purged", "PURGED", 'good');
        }
        else {
            if (ghostShieldActive) {
                ghostShieldActive = false; risk = 0;
                achievementStats.ghostShieldSaves++;
                relayEvent('ghost-save');
                logGame("log.ghostSaved", "GHOST_SAVED", 'good');
            }
            else { relayEvent('bonus',{bonusId:id}); showBusted(); return; }
        }
        if (favorableOutcome && (money > beforeBonusMoney || risk < beforeBonusRisk)) achievementStats.usefulGambles++;
    } else if (id === 4) {
        ghostShieldActive = true; ghostCooldown = 5;
        ghostPurchases++;
        achievementStats.ghostShieldUses++;
        logGame("log.ghostReady", "GHOST_SHIELD_UP", 'good');
    } else if (id === 5) {
        risk *= 0.6;
        proxyPurchases++;
        logGame("log.proxy", "PROXY_UP", 'good');
    } else if (id === 6) {
        risk = Math.min(100, risk * 1.5);
        overclockCooldown = 7;
        overclockBonusTurns = 2;
        logGame("log.overclockReady", "OVRCLK ACTIVATED [2 TURNS]", 'good');
    }

    // A valid effect remains a purchase even when a tiny price is below the
    // representable precision of a very large balance.
    relayEvent('bonus',{bonusId:id});
    updateUI(); updateBonusPrices();
    checkAchievements();
};


// Quit is a separate input layer: protocol identity and deadlines keep running.
function quitContext() {
    const order = typeof relayScreenOrder === 'undefined' ? [] : relayScreenOrder;
    let screen = 'game';
    for (const [name, id] of order) {
        if (name === 'settings' || name === 'intro') continue;
        const node = document.getElementById(id);
        if (node && !node.hidden && (node.style.display === 'flex' || (node.style.display !== 'none' && getComputedStyle(node).display !== 'none'))) { screen = name; break; }
    }
    return { runActive: ['game','typing','backdoor','bypass'].includes(screen),
        unsecured: Number.isFinite(money) ? money : 0,
        challenge: !!activeMiniGame && ['countdown','active'].includes(activeMiniGame.phase) };
}
if (window.RiskQuitFlow) {
    window.RiskQuit = window.RiskQuitFlow.create({
        context: quitContext,
        loading: () => window.RiskSaveLoading,
        waitForLoad: () => saveLoadPromise || (window.RiskSaveLoading ? initialSaveReady
            : window.RiskSaveReadBlocked ? loadSavedGame() : Promise.resolve(true)),
        block(value) {
            window.RiskQuitBlocking = value;
            document.dispatchEvent(new CustomEvent('risk:quit-state', { detail: { blocking: value } }));
            if (document.body) document.body.inert = value ? false : window.RiskSaveLoading;
        },
        render(state) {
            if (state.phase === 'idle') window.RelayQuitUI?.hide();
            else window.RelayQuitUI?.show({ ...state, phase: state.phase === 'closed' ? 'saving' : state.phase });
        },
        beginNative: () => { if (window.electronAPI.onQuitRequested) window.electronAPI.closeApp(); },
        cancelNative: () => window.electronAPI.quitCancelled?.(),
        flushRecords: retry => window.electronAPI.flushLocalScores ? window.electronAPI.flushLocalScores({ retry }) : Promise.resolve(true),
        save: () => window.saveGameState(),
        drainSaves: () => saveWritePromise || Promise.resolve(),
        finish: discard => window.electronAPI.finishQuit ? window.electronAPI.finishQuit({ discard })
            : Promise.resolve(window.electronAPI.closeApp()).then(() => true),
        setTimeout: (fn, ms) => window.setTimeout(fn, ms),
        clearTimeout: id => window.clearTimeout(id)
    });
    window.electronAPI.onQuitRequested?.(() => window.RiskQuit.request());
    for (const type of ['risk:state','risk:protocol']) {
        document.addEventListener(type, event => {
            // Deadlines still run behind the dialog. Persist a resolved outcome
            // even when it did not unlock an achievement (the normal autosave).
            if (type === 'risk:protocol' && event.detail?.phase === 'result' && window.RiskQuit.getState().phase === 'saving' && !window.RiskQuit.getState().discarding) window.saveGameState();
            window.RiskQuit.refresh();
        });
    }
}

// Only existing presentation is repainted: no new run, network call, timer, sound or notification.
document.addEventListener('risk:language', () => {
    updateUI({presentationOnly:true});
    updatePersistentUI();
    renderAchievementsList();
    const receipt = document.getElementById('protocol-outcome');
    if (!receipt || receipt.hidden || !receipt.classList.contains('protocol-outcome')) renderLogHistory();
    renderLeaderboardRows();
    renderGameRecap();
    const errors = document.getElementById('typing-errors');
    if (errors) errors.textContent = gameText('typing.errors', 'ERRORS: {count}/{max}', {count:typingErrors,max:typingMaxErrors});
});

// ==========================================
// --- SYSTEME DE COMMUNICATION (IPC) ---
// ==========================================

// Utilise le bridge sécurisé exposé par preload.js
// Plus de require('electron') - contextIsolation activé

window.quitGame = function() {
    window.electronAPI.closeApp();
};

window.saveGameState = function() {
    const gameState = {
        money: money,
        totalMoney: totalMoney,
        risk: risk,
        playerName: playerName,
        pUpgrades: pUpgrades,
        achievements: achievements,
        achievementStats: {
            ...achievementStats,
            bonusesBoughtThisSession: Array.from(achievementStats.bonusesBoughtThisSession)
        },
        musicVolume: musicVolume,
        sfxVolume: sfxVolume,
        prestigeLevel: prestigeLevel,
        prestigePoints: prestigePoints,
        tutorialSeen: tutorialSeen
    };
    window.electronAPI.saveGame(gameState);
};

async function loadSavedGame() {
    const data = await window.electronAPI.loadGame();
    if (data) {
        if (data.money !== undefined) money = data.money;
        if (data.totalMoney !== undefined) totalMoney = data.totalMoney;
        if (data.playerName) playerName = data.playerName;

        if (data.pUpgrades) {
            for (const key in data.pUpgrades) {
                if (pUpgrades[key]) {
                    pUpgrades[key].lvl = data.pUpgrades[key].lvl;
                }
            }
        }

        if (data.achievements) {
            for (const key in data.achievements) {
                if (achievements[key]) {
                    achievements[key].unlocked = data.achievements[key].unlocked;
                }
            }
        }

        if (data.achievementStats) {
            achievementStats = {
                ...achievementStats,
                ...data.achievementStats,
                bonusesBoughtThisSession: Array.isArray(data.achievementStats.bonusesBoughtThisSession)
                    ? [...data.achievementStats.bonusesBoughtThisSession]
                    : []
            };
        }

        if (data.musicVolume !== undefined) {
            musicVolume = data.musicVolume;
            const mSlider = document.getElementById('music-slider');
            if (mSlider) mSlider.value = musicVolume;
            sounds.bgm.volume = musicVolume;
        }
        if (data.sfxVolume !== undefined) {
            sfxVolume = data.sfxVolume;
            const sSlider = document.getElementById('sfx-slider');
            if (sSlider) sSlider.value = sfxVolume;
        }

        if (data.prestigeLevel !== undefined) prestigeLevel = data.prestigeLevel;
        if (data.prestigePoints !== undefined) prestigePoints = data.prestigePoints;
        if (data.tutorialSeen !== undefined) tutorialSeen = data.tutorialSeen;

        const nameInput = document.getElementById('player-name');
        if (nameInput) nameInput.value = playerName;

        updateUI();
        updatePersistentUI();
        renderAchievementsList();
    }
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
        riskReduction: prestigePoints * 0.02,
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
    comboSpec: { unlocked: false, name: "COMBO_SPECIALIST", desc: "Hit a 10 streak", icon: "[)]" },
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
    yoloMode: { unlocked: false, name: "YOLO_MODE_ACTIVATED", desc: "Gamble 10 times in a row", icon: "[Y]", secret: true },
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

// --- LOG SYSTEM (multi-line) ---
const logHistory = [];
const LOG_MAX = 3;

// --- SYSTEME AUDIO (avec pool) ---
const sounds = {
    click: new Audio('son/UIClick.wav'),
    bonus: new Audio('son/bonus & ui.wav'),
    fail: new Audio('son/fail.wav'),
    success: new Audio('son/sucess.mp3'),
    bgm: new Audio('son/backgroundloop.mp3')
};

// Audio pool pour eviter les fuites memoire
const audioPool = {};
const POOL_SIZE = 4;

function initAudioPool() {
    for (const name in sounds) {
        if (name === 'bgm') continue;
        audioPool[name] = [];
        for (let i = 0; i < POOL_SIZE; i++) {
            const clone = sounds[name].cloneNode();
            audioPool[name].push({ el: clone, playing: false });
            clone.addEventListener('ended', () => {
                const entry = audioPool[name].find(e => e.el === clone);
                if (entry) entry.playing = false;
            });
        }
    }
}

function formatNumber(num) {
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
    showAchievementPopup(achievements[key]);
    renderAchievementsList();
    playSfx('bonus');
    window.saveGameState();
}

function showAchievementPopup(achievement) {
    const popup = document.createElement('div');
    popup.style.cssText = `
        position: fixed; top: 20px; right: 20px;
        background: rgba(0, 242, 255, 0.95); color: black;
        padding: 15px 20px; border-radius: 8px;
        font-size: 0.75rem; font-weight: bold;
        box-shadow: 0 0 20px rgba(0, 242, 255, 0.5);
        z-index: 10000; animation: slideIn 0.3s ease-out;
        pointer-events: none;
    `;
    popup.innerHTML = `<span style="font-family:monospace;">${achievement.icon}</span> ${achievement.name}<br><span style="font-size: 0.65rem; opacity: 0.8;">${achievement.desc}</span>`;
    document.body.appendChild(popup);

    setTimeout(() => {
        popup.style.animation = 'slideOut 0.3s ease-in';
        setTimeout(() => popup.remove(), 300);
    }, 2000);
}

function checkAchievements() {
    if (!achievements.firstBlood.unlocked && totalMoney >= 100) unlockAchievement('firstBlood');
    if (!achievements.cryptoMill.unlocked && totalMoney >= 10000) unlockAchievement('cryptoMill');
    if (!achievements.whaleStatus.unlocked && totalMoney >= 100000) unlockAchievement('whaleStatus');
    if (!achievements.nodeRunner.unlocked && achievementStats.totalNodesValidated >= 10) unlockAchievement('nodeRunner');
    if (!achievements.networkMaster.unlocked && achievementStats.totalNodesValidated >= 100) unlockAchievement('networkMaster');

    if (!achievements.livingDanger.unlocked && risk >= 80) unlockAchievement('livingDanger');
    if (!achievements.onTheEdge.unlocked && risk >= 95) unlockAchievement('onTheEdge');
    if (!achievements.riskTaker.unlocked && risk >= 99) unlockAchievement('riskTaker');
    if (risk > achievementStats.maxRiskSurvived) achievementStats.maxRiskSurvived = risk;

    if (!achievements.comboSpec.unlocked && streakCounter >= 10) unlockAchievement('comboSpec');
    if (!achievements.multMadness.unlocked && multiplier >= 20) unlockAchievement('multMadness');
    if (!achievements.ghostProto.unlocked && achievementStats.ghostShieldUses >= 10) unlockAchievement('ghostProto');
    if (!achievements.luckyGambler.unlocked && achievementStats.jackpotsWon >= 10) unlockAchievement('luckyGambler');
    if (!achievements.closeCall.unlocked && achievementStats.ghostShieldSaves >= 5) unlockAchievement('closeCall');

    if (!achievements.lockpickApp.unlocked && bypassLevel >= 5) unlockAchievement('lockpickApp');
    if (!achievements.masterHacker.unlocked && bypassLevel >= 20) unlockAchievement('masterHacker');
    if (!achievements.legendaryCrack.unlocked && bypassLevel >= 50) unlockAchievement('legendaryCrack');
    if (!achievements.bypassAddict.unlocked && achievementStats.bypassCount >= 50) unlockAchievement('bypassAddict');
    if (!achievements.speedRunner.unlocked && achievementStats.bypassLevel10Plus >= 10) unlockAchievement('speedRunner');

    if (!achievements.survivor.unlocked && achievementStats.successfulSessions >= 5) unlockAchievement('survivor');
    if (!achievements.veteran.unlocked && achievementStats.successfulSessions >= 25) unlockAchievement('veteran');
    if (!achievements.immortal.unlocked && achievementStats.successfulSessions >= 100) unlockAchievement('immortal');

    if (streakCounter > achievementStats.maxStreak) achievementStats.maxStreak = streakCounter;

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
    if (!achievements.untouchable.unlocked && risk === 0 && money >= 500) unlockAchievement('untouchable');
    if (!achievements.perfectRun.unlocked && achievementStats.perfectRunActive && money > 0) unlockAchievement('perfectRun');
    if (!achievements.balanced.unlocked && Math.abs(risk - 67) < 0.5) unlockAchievement('balanced');
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
sounds.bgm.loop = true;
let musicVolume = 0.5;
let sfxVolume = 0.5;

function playSfx(name) {
    if (!audioPool[name]) return;
    const entry = audioPool[name].find(e => !e.playing);
    if (entry) {
        entry.el.volume = sfxVolume;
        entry.el.currentTime = 0;
        entry.playing = true;
        entry.el.play().catch(() => { entry.playing = false; });
    }
}

function updateMusicVolume(val) {
    musicVolume = parseFloat(val);
    sounds.bgm.volume = musicVolume;
    const volDisplay = document.getElementById('music-vol-val');
    if (volDisplay) volDisplay.textContent = `${Math.round(musicVolume * 100)}%`;
    window.saveGameState();
}

function updateSfxVolume(val) {
    sfxVolume = parseFloat(val);
    const volDisplay = document.getElementById('sfx-vol-val');
    if (volDisplay) volDisplay.textContent = `${Math.round(sfxVolume * 100)}%`;
    window.saveGameState();
}

sounds.bgm.addEventListener('timeupdate', () => {
    const buffer = 3;
    if (sounds.bgm.currentTime > sounds.bgm.duration - buffer) {
        const remaining = sounds.bgm.duration - sounds.bgm.currentTime;
        sounds.bgm.volume = (remaining / buffer) * musicVolume;
    } else if (sounds.bgm.currentTime < buffer) {
        sounds.bgm.volume = (sounds.bgm.currentTime / buffer) * musicVolume;
    } else {
        sounds.bgm.volume = musicVolume;
    }
});

// --- DOM CACHE ---
let moneyFill, riskFill, nodeFill, moneyText, riskText, nodeText, totalMoneyDisplays, logEl, screenBusted, screenSuccess, screenPersistent, screenLeaderboard, leaderboardList, successAmountText, mainMenu, playerNameInput;

window.onload = () => {
    initAudioPool();

    setTimeout(() => {
        document.body.style.display = 'none';
        document.body.offsetHeight;
        document.body.style.display = 'flex';
    }, 100);

    const mSlider = document.getElementById('music-slider');
    if (mSlider) mSlider.addEventListener('input', (e) => updateMusicVolume(e.target.value));

    const sSlider = document.getElementById('sfx-slider');
    if (sSlider) sSlider.addEventListener('input', (e) => updateSfxVolume(e.target.value));

    document.addEventListener('mousedown', () => {
        if (sounds.bgm.paused) sounds.bgm.play().catch(() => {});
    }, { once: true });

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

    const retryButtons = document.querySelectorAll('.btn-restart');
    retryButtons.forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            closeOverlays();
        }, true);
    });

    // --- KEYBOARD SHORTCUTS ---
    document.addEventListener('keydown', (e) => {
        if (typingActive || backdoorActive) return;
        if (document.activeElement && document.activeElement.tagName === 'INPUT') return;

        const isGameVisible = !(mainMenu && mainMenu.style.display === 'flex') &&
                              !(screenPersistent && screenPersistent.style.display === 'flex') &&
                              !(screenBusted && screenBusted.style.display === 'flex') &&
                              !(screenSuccess && screenSuccess.style.display === 'flex');

        const screenBypass = document.getElementById('screen-bypass');
        const isBypassVisible = screenBypass && screenBypass.style.display === 'flex';

        if (isBypassVisible) {
            if (e.code === 'Space') { e.preventDefault(); attemptBypass(); }
            if (e.code === 'Escape') { e.preventDefault(); exitBypassGame(); }
            return;
        }

        if (!isGameVisible) {
            if (e.code === 'Enter' || e.code === 'Space') {
                e.preventDefault();
                if (screenBusted && screenBusted.style.display === 'flex') closeOverlays();
                else if (screenSuccess && screenSuccess.style.display === 'flex') closeOverlays();
            }
            return;
        }

        switch (e.code) {
            case 'Digit1': case 'Numpad1': hack(1); break;
            case 'Digit2': case 'Numpad2': hack(2); break;
            case 'Digit3': case 'Numpad3': hack(3); break;
            case 'Space': e.preventDefault(); transfer(); break;
            case 'KeyB': bypass(); break;
            case 'KeyQ': buyBonus(1); break;
            case 'KeyW': buyBonus(2); break;
            case 'KeyE': buyBonus(3); break;
            case 'KeyR': buyBonus(4); break;
            case 'KeyA': buyBonus(5); break;
            case 'KeyS': buyBonus(6); break;
        }
    });

    updateUI();
    renderAchievementsList();
    loadSavedGame();

    // Show tutorial on first launch
    setTimeout(() => {
        if (!tutorialSeen) showTutorial();
    }, 500);
};

// --- TUTORIAL / ONBOARDING ---
window.showTutorial = function() {
    const overlay = document.getElementById('screen-tutorial');
    if (overlay) overlay.style.display = 'flex';
}

window.closeTutorial = function() {
    const overlay = document.getElementById('screen-tutorial');
    if (overlay) overlay.style.display = 'none';
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

window.showLeaderboard = async function() {
    if (mainMenu) mainMenu.style.display = 'none';
    if (screenLeaderboard) screenLeaderboard.style.display = 'flex';
    if (leaderboardList) leaderboardList.innerHTML = `<div style="opacity: 0.5; text-align: center; margin-top: 50px; font-family: monospace;">TUNNELING_INTO_GRID...</div>`;

    try {
        const rawData = await window.electronAPI.getLeaderboard();
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
                if (entries) {
                    if (!Array.isArray(entries)) entries = [entries];
                    entries.sort((a, b) => parseInt(b.score) - parseInt(a.score));
                    entries.forEach((item, index) => {
                        const row = document.createElement('div');
                        row.style.display = "flex";
                        row.style.justifyContent = "space-between";
                        row.style.padding = "10px 5px";
                        row.style.borderBottom = "1px solid rgba(255,255,255,0.05)";
                        row.style.fontFamily = "monospace";
                        const isMe = item.name === playerName;
                        const nameText = document.createTextNode(`#${index + 1} ${item.name}`);
                        const nameSpan = document.createElement('span');
                        nameSpan.style.color = isMe ? 'var(--accent-blue)' : 'white';
                        nameSpan.appendChild(nameText);

                        const scoreSpan = document.createElement('span');
                        scoreSpan.style.color = 'var(--accent-green)';
                        scoreSpan.textContent = `${parseInt(item.score).toLocaleString()} $`;

                        row.appendChild(nameSpan);
                        row.appendChild(scoreSpan);
                        leaderboardList.appendChild(row);
                    });
                    return;
                }
            }
            leaderboardList.innerHTML = `<div style="opacity: 0.3; text-align: center; margin-top: 50px; font-family: monospace;">GRID_VACANT</div>`;
        }
    } catch (e) {
        console.error("Leaderboard Error:", e);
        if (leaderboardList) leaderboardList.innerHTML = `<div style="color: var(--accent-red); text-align: center; margin-top: 50px; font-family: monospace;">UPLINK_DENIED</div>`;
    }
}

window.backToMenuFromLeaderboard = () => {
    if (screenLeaderboard) screenLeaderboard.style.display = 'none';
    if (mainMenu) mainMenu.style.display = 'flex';
}

window.showAchievements = function() {
    if (mainMenu) mainMenu.style.display = 'none';
    const screenAchievements = document.getElementById('screen-achievements');
    if (screenAchievements) screenAchievements.style.display = 'flex';
    renderAchievementsList();
}

window.backToMenuFromAchievements = () => {
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
                <div style="font-size: 0.65rem; opacity: 0.7; margin-top: 2px;">
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
            return `<div style="color:${entry.color}; opacity:${opacity}; text-shadow: 0 0 5px ${entry.color}; font-size: 0.65rem; line-height: 1.4;">${entry.msg}</div>`;
        }).join('');
    }
}

// --- CENTRALIZED COST CALCULATIONS ---
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

function updateUI() {
    updateSessionStats();
    if (moneyFill) moneyFill.style.width = `${Math.min((money / 1000000) * 100, 100)}%`;
    if (riskFill) riskFill.style.width = `${Math.min(risk, 100)}%`;
    if (nodeFill) nodeFill.style.width = `${Math.min(nodesHacked, 100)}%`;
    if (moneyText) {
        const newText = `${money.toFixed(2)} $`;
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
    if (totalMoneyDisplays) totalMoneyDisplays.forEach(d => d.textContent = `${totalMoney.toFixed(2)} $`);

    const buffsContainer = document.getElementById('active-buffs');
    if (buffsContainer) {
        buffsContainer.innerHTML = `<span style="color:var(--accent-green); border: 1px solid var(--accent-green); padding: 1px 4px; border-radius: 4px; font-weight:bold;">X${multiplier.toFixed(1)}</span>`;
        const bColor = bypassCharge >= bypassChargeMax ? 'var(--accent-blue)' : 'rgba(255,255,255,0.2)';
        buffsContainer.innerHTML += `<span style="color:${bColor}; border: 1px solid ${bColor}; padding: 1px 4px; border-radius: 4px;">BYP [${bypassCharge}/${bypassChargeMax}]</span>`;
        if (insuranceTurns > 0) buffsContainer.innerHTML += `<span style="color:var(--accent-blue); border: 1px solid var(--accent-blue); padding: 1px 4px; border-radius: 4px;">INSURED [${insuranceTurns}]</span>`;

        if (overclockBonusTurns > 0) buffsContainer.innerHTML += `<span style="color:var(--accent-red); border: 1px solid var(--accent-red); padding: 1px 4px; border-radius: 4px;">OVRCLK [${overclockBonusTurns}]</span>`;
        if (overclockCooldown > 0) buffsContainer.innerHTML += `<span style="color:rgba(255,62,108,0.5); border: 1px solid rgba(255,62,108,0.3); padding: 1px 4px; border-radius: 4px;">OVR_CD [${overclockCooldown}]</span>`;

        if (ghostShieldActive) buffsContainer.innerHTML += `<span style="color:white; border: 1px solid white; padding: 1px 4px; border-radius: 4px;">GHOST</span>`;
        if (ghostCooldown > 0) buffsContainer.innerHTML += `<span style="color:rgba(255,255,255,0.3); border: 1px solid rgba(255,255,255,0.1); padding: 1px 4px; border-radius: 4px;">G_CD [${ghostCooldown}]</span>`;

        if (prestigeLevel > 0) buffsContainer.innerHTML += `<span style="color:#ffd700; border: 1px solid #ffd700; padding: 1px 4px; border-radius: 4px;">P${prestigeLevel}</span>`;
    }

    const bypassBtn = document.querySelector('.btn-bypass');
    if (bypassBtn) {
        bypassBtn.style.opacity = (bypassCharge < bypassChargeMax) ? '0.3' : '1';
        bypassBtn.style.cursor = (bypassCharge < bypassChargeMax) ? 'not-allowed' : 'pointer';
    }
}

function updateBonusPrices() {
    const costs = getBonusCosts();
    const labels = ['price-1', 'price-2', 'price-3', 'price-4', 'price-5', 'price-6'];

    const el1 = document.getElementById('price-1');
    const el2 = document.getElementById('price-2');
    const el3 = document.getElementById('price-3');
    const el4 = document.getElementById('price-4');
    const el5 = document.getElementById('price-5');
    const el6 = document.getElementById('price-6');

    if (el1) el1.textContent = `${costs[0].toFixed(1)}$`;
    if (el2) el2.textContent = `${costs[1].toFixed(1)}$`;
    if (el3) {
        if (gambleCooldown > 0) el3.textContent = `${costs[2].toFixed(1)}$ [CD:${gambleCooldown}]`;
        else el3.textContent = `${costs[2].toFixed(1)}$ [READY]`;
    }
    if (el4) el4.textContent = `${costs[3].toFixed(1)}$`;
    if (el5) el5.textContent = `${costs[4].toFixed(1)}$`;
    if (el6) el6.textContent = `${costs[5].toFixed(1)}$`;

    for (let i = 1; i <= 6; i++) {
        const pEl = document.getElementById(`price-${i}`);
        if (!pEl) continue;
        const btn = pEl.parentElement;

        if (i === 6 && (ghostShieldActive || overclockCooldown > 0)) {
            btn.classList.remove('affordable');
            btn.style.opacity = '0.3';
            btn.style.cursor = 'not-allowed';
        } else if (i === 3 && gambleCooldown > 0) {
            btn.classList.remove('affordable');
            btn.style.opacity = '0.3';
            btn.style.cursor = 'not-allowed';
        } else {
            btn.style.opacity = '1';
            btn.style.cursor = 'pointer';
            if (money >= costs[i-1] && money > 0) btn.classList.add('affordable');
            else btn.classList.remove('affordable');
        }
    }
}

function showBusted() {
    playSfx('fail');
    if (!achievements.brain404.unlocked && money === 0) unlockAchievement('brain404');

    if (screenBusted) {
        const recap = screenBusted.querySelector('p');
        if (recap) {
            recap.style.fontSize = "0.65rem";
            recap.style.letterSpacing = "1px";
            recap.style.lineHeight = "1.4";
            recap.innerHTML = `
                TRACE_LEVEL_CRITICAL -- DETECTED AT ${risk.toFixed(0)}%<br><br>
                <span style="color:white;opacity:0.6">FINAL_RISK:</span> ${risk.toFixed(0)}%<br>
                <span style="color:white;opacity:0.6">MAX_RISK:</span> ${sessionStats.maxRisk.toFixed(0)}%<br>
                <span style="color:white;opacity:0.6">NODES_OWNED:</span> ${sessionStats.maxNodes}<br>
                <span style="color:white;opacity:0.6">PEAK_MULTI:</span> X${sessionStats.maxMultiplier.toFixed(0)}
            `;
        }
        screenBusted.style.display = 'flex';
    }
    if (insuranceTurns > 0) {
        totalMoney += (money * 0.5);
    }
    money = 0; risk = 0; nodesHacked = 0; multiplier = 1; streakCounter = 0; bypassCharge = 0;
    resetTempBuffs(); resetSessionStats(); resetSessionAchievementStats(); updateUI();
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
    playSfx('click');
    if (playerNameInput && playerNameInput.value.trim() !== "") playerName = playerNameInput.value.trim();
    if (mainMenu) mainMenu.style.display = 'none';
    if (screenPersistent) screenPersistent.style.display = 'flex';
    updatePersistentUI();
}

window.backToMenu = function() {
    playSfx('click');
    if (screenPersistent) screenPersistent.style.display = 'none';
    if (mainMenu) mainMenu.style.display = 'flex';
}

window.startGame = function() {
    playSfx('click');
    if (screenPersistent) screenPersistent.style.display = 'none';
    const pBonus = getPrestigeBonus();
    money = (pUpgrades.ram.lvl * 10) + pBonus.startMoney;
    risk = 0; nodesHacked = 0; multiplier = 1; streakCounter = 0; bypassCharge = 0;
    resetTempBuffs(); resetSessionStats();
    logHistory.length = 0;
    updateLog(`SESSION_START: ${playerName.toUpperCase()}`, 'info');
    if (prestigeLevel > 0) updateLog(`PRESTIGE_BONUS: +${(pBonus.gainMult - 1) * 100}% GAIN`, 'info');
    updateUI(); updateBonusPrices();
    window.saveGameState();
}

function updatePersistentUI() {
    if (totalMoneyDisplays) totalMoneyDisplays.forEach(d => d.textContent = `${totalMoney.toFixed(2)} $`);

    // Update prestige button
    const prestigeBtn = document.getElementById('btn-prestige');
    if (prestigeBtn) {
        const pCost = getPrestigeCost();
        const canPrestige = totalMoney >= pCost;
        prestigeBtn.innerHTML = `
            <span style="font-weight:bold; color:#ffd700;">PRESTIGE_v${prestigeLevel}</span>
            <span style="font-size:0.65rem; color:var(--accent-blue);">PTS: ${prestigePoints}</span>
            <span style="font-size:0.65rem; opacity:0.8;">+10% gain, -2% risk, +50$ start</span>
            <span style="font-size:0.65rem; color:${canPrestige ? '#ffd700' : 'var(--accent-red)'}; margin-top:5px; font-weight:bold;">${canPrestige ? 'READY' : 'NEED: ' + formatNumber(pCost) + '$'}</span>
        `;
        if (canPrestige) prestigeBtn.classList.add('affordable');
        else prestigeBtn.classList.remove('affordable');
    }

    const upgs = [
        { id: '1', key: 'ram', name: 'RAM_INJECTION', desc: `Start: +${pUpgrades.ram.lvl * 10}$` },
        { id: '2', key: 'vpn', name: 'VPN_SHIELD', desc: `Risk: -${pUpgrades.vpn.lvl}%` },
        { id: '3', key: 'miner', name: 'MINER_V2', desc: `Gain: +${pUpgrades.miner.lvl * 20}%` },
        { id: '4', key: 'fan', name: 'COOLING_FAN', desc: `Cooler: -${pUpgrades.fan.lvl}%` },
        { id: '5', key: 'algo', name: 'DEEP_LEARNING', desc: `Gamble: +${pUpgrades.algo.lvl}%` },
        { id: '6', key: 'volt', name: 'OVERVOLT', desc: `Stealth: ${pUpgrades.volt.lvl}%` }
    ];
    upgs.forEach(u => {
        const btn = document.getElementById(`btn-p-${u.id}`);
        if (btn) {
            const cost = Math.floor(100 * Math.pow(1.5, pUpgrades[u.key].lvl));
            const isMax = pUpgrades[u.key].lvl >= pUpgrades[u.key].max;
            if (!isMax && totalMoney >= cost) btn.classList.add('affordable'); else btn.classList.remove('affordable');
            btn.innerHTML = `
                <span style="font-weight:bold;">${u.name}</span>
                <span style="font-size:0.65rem; color:var(--accent-blue);">LVL ${pUpgrades[u.key].lvl}</span>
                <span style="font-size:0.65rem; opacity:0.8;">${u.desc}</span>
                <span style="font-size:0.65rem; color:var(--accent-green); margin-top:5px; font-weight:bold;">${isMax ? 'MAX' : 'COST: ' + formatNumber(cost) + '$'}</span>
            `;
        }
    });
}

window.buyPersistent = function(key) {
    if (pUpgrades[key].lvl >= pUpgrades[key].max) return;
    const cost = Math.floor(100 * Math.pow(1.5, pUpgrades[key].lvl));
    if (totalMoney >= cost) {
        playSfx('bonus');
        totalMoney -= cost; pUpgrades[key].lvl++;
        updatePersistentUI();
        window.saveGameState();
    }
}

// --- PRESTIGE ---
window.doPrestige = function() {
    const pCost = getPrestigeCost();
    if (totalMoney < pCost) return;

    playSfx('success');
    prestigeLevel++;
    prestigePoints++;
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
    if ((screenBusted && screenBusted.style.display === 'flex') || (mainMenu && mainMenu.style.display === 'flex')) return;

    if (level !== 3) achievementStats.bruteForceOnly = false;
    // YOLO_MODE fix: DON'T reset gambleStreak here - only reset on session end

    if (gambleCooldown > 0) gambleCooldown--;

    playSfx('click');
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
                playSfx('fail');
                ghostShieldActive = false;
                risk = 0;
                achievementStats.ghostShieldSaves++;
                updateLog("GHOST_SHIELD_TRIGGERED", 'good');
            }
            else {
                showBusted();
                return;
            }
        }
    }

    money += fGain;
    risk = Math.min(100, risk + aRisk);
    nodesHacked += 20 + (risk / 2);

    streakCounter++;

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
    }
    if (ghostCooldown > 0) ghostCooldown--;
    if (overclockCooldown > 0) overclockCooldown--;
    if (insuranceTurns > 0) { insuranceTurns--; if (insuranceTurns === 0) updateLog("INSURANCE_EXPIRED", 'bad'); }
    if (bypassCharge < bypassChargeMax) bypassCharge++;

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
    const roll = Math.random() * 100;
    if (roll < 25) { risk = Math.min(99, risk + 15); updateLog("ANTIVIRUS_SCAN [+15% RISK]", 'bad'); }
    else if (roll < 50) { money += 50; updateLog("PACKET_SNIFFED [+50$]", 'good'); }
    else if (roll < 75) { multiplier += 2; updateLog("CPU_OVERCLOCK [+2 MULT]", 'good'); }
    else if (roll < 95) { risk = 0; updateLog("GHOST_PROXY [RISK 0]", 'good'); }
    else { multiplier = 1; streakCounter = 0; updateLog("BUFFER_OVERFLOW [STREAK RESET]", 'bad'); }
    updateUI();
}

// --- TYPING PROTOCOL ---
window.startTypingProtocol = function() {
    if (typingActive) return;
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

    const container = document.getElementById('typing-container');
    const phraseDisplay = document.getElementById('typing-phrase');
    const inputField = document.getElementById('typing-input');
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

    typingCountdownInterval = setInterval(() => {
        typingCountdown--;
        if (countdownEl) countdownEl.textContent = typingCountdown;
        playSfx('click');

        if (typingCountdown <= 0) {
            clearInterval(typingCountdownInterval);
            startTypingGame();
        }
    }, 1000);
}

function startTypingGame() {
    typingStarted = true;
    const countdownEl = document.getElementById('typing-countdown');
    const inputField = document.getElementById('typing-input');

    if (countdownEl) countdownEl.style.display = 'none';

    if (inputField) {
        inputField.disabled = false;
        inputField.style.opacity = '1';
        inputField.focus();
    }

    typingTimeout = setTimeout(() => {
        failTypingProtocol();
    }, typingTimeLimit + 2000); // 7s for multi-word
}

window.checkTypingInput = function() {
    if (!typingStarted || !typingActive) return;

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

    const userInput = inputField.value.toLowerCase();
    const targetPhrase = typingPhrase.toLowerCase();

    let displayHTML = '';
    for (let i = 0; i < typingPhrase.length; i++) {
        const char = typingPhrase[i].toUpperCase();
        if (i < userInput.length) {
            if (userInput[i] === targetPhrase[i]) {
                displayHTML += `<span style="color: var(--accent-green);">${char}</span>`;
            } else {
                displayHTML += `<span style="color: var(--accent-red);">${char}</span>`;
            }
        } else {
            displayHTML += `<span style="color: rgba(255,255,255,0.4);">${char}</span>`;
        }
    }

    phraseDisplay.innerHTML = displayHTML;
}

function successTypingProtocol() {
    clearTimeout(typingTimeout);
    clearInterval(typingCountdownInterval);
    typingActive = false;
    typingStarted = false;
    const bonus = Math.max(nodesValidated, 1);
    multiplier += bonus;
    playSfx('success');
    updateLog(`TYPING_SUCCESS [+${bonus} MULT]`, 'good');
    const container = document.getElementById('typing-container');
    if (container) container.style.display = 'none';
    updateUI();
}

function failTypingProtocol() {
    clearTimeout(typingTimeout);
    clearInterval(typingCountdownInterval);
    typingActive = false;
    typingStarted = false;
    risk = Math.min(100, risk + 10);
    playSfx('fail');
    updateLog("TYPING_FAILED [+10% RISK]", 'bad');
    const container = document.getElementById('typing-container');
    if (container) container.style.display = 'none';
    updateUI();
}

window.testTyping = function() {
    startTypingProtocol();
}

// --- BACKDOOR PROTOCOL (fully implemented) ---
window.startBackdoorProtocol = function() {
    if (backdoorActive) return;

    backdoorActive = true;
    backdoorStarted = false;
    backdoorClicked = 0;
    backdoorErrors = 0;
    backdoorCountdown = 3;
    backdoorTargetPositions = [];
    backdoorTimeLeft = 8;

    playSfx('bonus');
    updateLog("BACKDOOR_PROTOCOL_DETECTED!", 'info');

    const container = document.getElementById('backdoor-container');
    const grid = document.getElementById('backdoor-grid');
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
        cell.style.cssText = 'width: 30px; height: 30px; border-radius: 4px; cursor: pointer; transition: all 0.15s; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.03);';
        cell.addEventListener('click', () => handleBackdoorClick(i, cell));
        grid.appendChild(cell);
    }

    // Show targets for 2 seconds
    backdoorTargetPositions.forEach(pos => {
        const cells = grid.children;
        if (cells[pos]) {
            cells[pos].style.background = 'rgba(0, 242, 255, 0.4)';
            cells[pos].style.borderColor = 'var(--accent-green)';
            cells[pos].style.boxShadow = '0 0 8px rgba(0, 242, 255, 0.5)';
        }
    });

    backdoorCountdownInterval = setInterval(() => {
        backdoorCountdown--;
        if (countdownEl) countdownEl.textContent = backdoorCountdown;
        playSfx('click');

        if (backdoorCountdown <= 0) {
            clearInterval(backdoorCountdownInterval);
            startBackdoorGame();
        }
    }, 1000);
}

function startBackdoorGame() {
    backdoorStarted = true;
    const grid = document.getElementById('backdoor-grid');
    const countdownEl = document.getElementById('backdoor-countdown');
    const timerEl = document.getElementById('backdoor-timer');

    if (countdownEl) countdownEl.style.display = 'none';
    if (timerEl) timerEl.style.display = 'block';

    // Hide all targets
    if (grid) {
        for (let i = 0; i < grid.children.length; i++) {
            grid.children[i].style.background = 'rgba(255,255,255,0.03)';
            grid.children[i].style.borderColor = 'rgba(255,255,255,0.1)';
            grid.children[i].style.boxShadow = 'none';
        }
        grid.style.pointerEvents = 'auto';
    }

    // Start timer
    backdoorTimeLeft = 8;
    if (timerEl) timerEl.textContent = `${backdoorTimeLeft}s`;

    backdoorTimer = setInterval(() => {
        backdoorTimeLeft--;
        if (timerEl) timerEl.textContent = `${backdoorTimeLeft}s`;

        if (backdoorTimeLeft <= 0) {
            endBackdoor(false);
        }
    }, 1000);
}

function handleBackdoorClick(index, cell) {
    if (!backdoorStarted || cell.dataset.clicked === '1') return;
    cell.dataset.clicked = '1';

    if (backdoorTargetPositions.includes(index)) {
        // Correct
        cell.style.background = 'rgba(0, 242, 255, 0.5)';
        cell.style.borderColor = 'var(--accent-green)';
        cell.style.boxShadow = '0 0 10px rgba(0, 242, 255, 0.6)';
        backdoorClicked++;
        playSfx('click');

        if (backdoorClicked >= backdoorTargetCount) {
            endBackdoor(true);
        }
    } else {
        // Wrong
        cell.style.background = 'rgba(255, 62, 108, 0.5)';
        cell.style.borderColor = 'var(--accent-red)';
        backdoorErrors++;
        playSfx('fail');

        if (backdoorErrors >= 3) {
            endBackdoor(false);
        }
    }
}

function endBackdoor(success) {
    clearInterval(backdoorTimer);
    backdoorActive = false;
    backdoorStarted = false;

    const container = document.getElementById('backdoor-container');

    if (success) {
        const bonus = multiplier * 3;
        money += bonus;
        risk = Math.max(0, risk - 25);
        playSfx('success');
        updateLog(`BACKDOOR_SUCCESS [+${bonus.toFixed(0)}$ -25% RISK]`, 'good');
    } else {
        risk = Math.min(100, risk + 15);
        playSfx('fail');
        updateLog("BACKDOOR_FAILED [+15% RISK]", 'bad');
    }

    setTimeout(() => {
        if (container) container.style.display = 'none';
        updateUI();
    }, 500);
}

// --- BYPASS ---
window.bypass = function() {
    if (bypassCharge < bypassChargeMax) return;
    achievementStats.bypassCount++;
    const screenBypass = document.getElementById('screen-bypass');
    if (screenBypass) screenBypass.style.display = 'flex';
    bypassLevel = 1;
    bypassSpeed = 0.8;
    bypassTolerance = 18;
    startBypassLevel();
}

function startBypassLevel() {
    bypassGauge = 0; bypassDirection = 1;
    bypassTarget = 20 + Math.random() * 60;
    const levelText = document.getElementById('bypass-level-text');
    if (levelText) levelText.textContent = `LVL ${bypassLevel}`;
    const targetEl = document.getElementById('bypass-target');
    if (targetEl) { targetEl.style.left = (bypassTarget - bypassTolerance) + "%"; targetEl.style.width = (bypassTolerance * 2) + "%"; }
    if (bypassInterval) cancelAnimationFrame(bypassInterval);
    function animateBypass() {
        updateBypassGauge();
        bypassInterval = requestAnimationFrame(animateBypass);
    }
    bypassInterval = requestAnimationFrame(animateBypass);
}

function updateBypassGauge() {
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

    const cursor = document.getElementById('bypass-cursor');
    if (cursor) {
        cursor.style.left = bypassGauge + "%";

        if (distanceToTarget <= bypassTolerance) {
            cursor.style.background = "#00ff00";
            cursor.style.boxShadow = "0 0 15px #00ff00";
        } else if (distanceToTarget <= slowdownZone) {
            cursor.style.background = "#ffff00";
            cursor.style.boxShadow = "0 0 15px #ffff00";
        } else {
            cursor.style.background = "#fff";
            cursor.style.boxShadow = "0 0 10px #fff";
        }
    }
}

window.attemptBypass = function() {
    const min = bypassTarget - bypassTolerance;
    const max = bypassTarget + bypassTolerance;

    if (bypassGauge >= min && bypassGauge <= max) {
        if (bypassLevel >= 50) {
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
        startBypassLevel();
    } else {
        updateLog("BYPASS_FAILED", 'bad');
        exitBypassGame(true);
    }
}

window.exitBypassGame = function(isFail = false) {
    cancelAnimationFrame(bypassInterval);
    const screenBypass = document.getElementById('screen-bypass');
    if (screenBypass) screenBypass.style.display = 'none';

    if (bypassLevel >= 10) achievementStats.bypassLevel10Plus++;

    if (bypassLevel > 2) {
        const reduction = (bypassLevel - 1) * 2;
        risk = Math.max(0, risk - reduction);
        updateLog(`BYPASS_REWARD: -${reduction}% RISK`, 'good');
    } else if (isFail) {
        updateLog("BYPASS_FAILED: NO_REWARD", 'bad');
    }

    bypassCharge = 0;
    checkAchievements();
    updateUI();
}

// --- TRANSFER ---
window.transfer = function() {
    if (money > 0) {
        playSfx('success');

        checkSessionEndAchievements();

        achievementStats.successfulSessions++;

        if (screenSuccess) {
            const recap = screenSuccess.querySelector('p');
            if (recap) {
                recap.style.fontSize = "0.65rem";
                recap.style.letterSpacing = "1px";
                recap.style.lineHeight = "1.4";
                recap.innerHTML = `
                    EXTRACTED: ${money.toFixed(2)} $<br><br>
                    <span style="color:white;opacity:0.6">FINAL_RISK:</span> ${risk.toFixed(0)}%<br>
                    <span style="color:white;opacity:0.6">MAX_RISK:</span> ${sessionStats.maxRisk.toFixed(0)}%<br>
                    <span style="color:white;opacity:0.6">NODES_OWNED:</span> ${sessionStats.maxNodes}<br>
                    <span style="color:white;opacity:0.6">PEAK_MULTI:</span> X${sessionStats.maxMultiplier.toFixed(0)}
                `;
            }
            screenSuccess.style.display = 'flex';
        }

        totalMoney += money;
        submitScoreToDreamlo(totalMoney);
        checkAchievements();
        money = 0; risk = 0; nodesHacked = 0; multiplier = 1; streakCounter = 0; bypassCharge = 0;
        resetTempBuffs(); resetSessionStats(); resetSessionAchievementStats(); updateUI();
        window.saveGameState();
    }
};

// --- BUY BONUS ---
window.buyBonus = function(id) {
    const costs = getBonusCosts();

    if (id >= 1 && id <= 6 && money >= costs[id-1]) {
        if (id !== 2 || insuranceTurns === 0) {
             playSfx('bonus');
        }
    }

    if (id === 1) {
        // COOLER: -10% RISK
        if (money >= costs[0]) { money -= costs[0]; risk = Math.max(0, risk - 10); coolerPurchases++; updateLog("COOLED", 'good'); }
    } else if (id === 2) {
        // INSURE: 20% cost, 5 turns (rebalanced)
        if (money >= costs[1] && insuranceTurns === 0) { money -= costs[1]; insuranceTurns = 5; updateLog("INSURED [5 TURNS]", 'info'); }
    } else if (id === 3) {
        // GAMBLE
        if (gambleCooldown > 0) {
            updateLog(`GAMBLE_COOLDOWN [${gambleCooldown} HACKS LEFT]`, 'bad');
            return;
        }

        if (money >= costs[2]) {
            money -= costs[2];
            gambleCooldown = 5;

            achievementStats.gambleStreak++;
            if (achievementStats.gambleStreak > achievementStats.maxGambleStreak) {
                achievementStats.maxGambleStreak = achievementStats.gambleStreak;
            }
            if (!achievements.yoloMode.unlocked && achievementStats.gambleStreak >= 10) {
                unlockAchievement('yoloMode');
            }

            let roll = Math.random() * 100;
            let algoBonus = Math.min(pUpgrades.algo.lvl, 4);
            let winC = 1 + algoBonus;
            if (roll < winC) {
                money *= 2; risk = Math.max(0, risk - 15);
                achievementStats.jackpotsWon++;
                updateLog("JACKPOT!", 'good');
            }
            else if (roll < winC + 38) {
                risk = Math.max(0, risk - 20);
                updateLog("RISK_REDUCED [-20%]", 'good');
            }
            else if (roll < winC + 38 + 23) {
                risk = Math.min(100, risk + 10);
                updateLog("RISK_PENALTY [+10%]", 'bad');
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
                    playSfx('fail');
                    ghostShieldActive = false; risk = 0;
                    achievementStats.ghostShieldSaves++;
                    updateLog("GHOST_SAVED", 'good');
                }
                else { showBusted(); }
            }
        }
    } else if (id === 4) {
        // GHOST SHIELD
        if (money >= costs[3] && !ghostShieldActive && ghostCooldown === 0) {
            money -= costs[3]; ghostShieldActive = true; ghostCooldown = 5;
            ghostPurchases++;
            achievementStats.ghostShieldUses++;
            updateLog("GHOST_SHIELD_UP", 'good');
        }
    } else if (id === 5) {
        // PROXY
        if (money >= costs[4]) {
            money -= costs[4];
            risk *= 0.6;
            proxyPurchases++;
            updateLog("PROXY_UP", 'good');
        } else {
            updateLog(`PROXY_COST: ${costs[4].toFixed(1)}$ [INSUFFICIENT]`, 'bad');
        }
    } else if (id === 6) {
        // OVERCLOCK
        if (money >= costs[5] && money > 0 && !ghostShieldActive && overclockCooldown === 0) {
            money -= costs[5];
            risk = Math.min(100, risk * 1.5);
            overclockCooldown = 7;
            overclockBonusTurns = 2;
            updateLog("OVRCLK ACTIVATED [2 TURNS]", 'good');
        } else if (ghostShieldActive) {
            updateLog("OVERCLOCK_BLOCKED [GHOST_ACTIVE]", 'bad');
        } else if (overclockCooldown > 0) {
            updateLog(`OVERCLOCK_COOLDOWN [${overclockCooldown}]`, 'bad');
        }
    }

    if (id >= 1 && id <= 6) {
        if (!achievementStats.bonusesBoughtThisSession.includes(id)) {
            achievementStats.bonusesBoughtThisSession.push(id);
        }
        if (achievementStats.bonusesBoughtThisSession.length === 6) {
            achievementStats.boughtAllBonusesThisSession = true;
        }
    }

    updateUI(); updateBonusPrices();
    checkAchievements();
};

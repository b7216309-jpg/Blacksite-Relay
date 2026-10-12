/* Shared legacy-compatible save whitelist. No inherited or arbitrary keys survive. */
(function (root, factory) {
  const schema = factory();
  if (typeof module === 'object' && module.exports) module.exports = schema;
  else root.RiskSaveSchema = schema;
})(typeof window === 'object' ? window : globalThis, function () {
  'use strict';
  const MAX_BYTES = 256 * 1024;
  const own = (obj, key) => !!obj && Object.prototype.hasOwnProperty.call(obj, key);
  const record = obj => !!obj && typeof obj === 'object' && !Array.isArray(obj);
  const number = (value, fallback = 0, max = Number.MAX_VALUE, integer = false) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
    const n = Math.min(max, Math.max(0, value));
    return integer ? Math.floor(n) : n;
  };
  const value = (obj, key) => own(obj, key) ? obj[key] : undefined;
  const bool = (v, fallback = false) => typeof v === 'boolean' ? v : fallback;
  const upgrades = { ram: Number.MAX_SAFE_INTEGER, vpn: 30, miner: Number.MAX_SAFE_INTEGER, fan: 40, algo: 4, volt: 40 };
  const achievementIds = ['firstBlood', 'cryptoMill', 'whaleStatus', 'nodeRunner', 'networkMaster', 'livingDanger', 'onTheEdge', 'comebackKing', 'riskTaker', 'untouchable', 'lockpickApp', 'masterHacker', 'legendaryCrack', 'speedRunner', 'bypassAddict', 'comboSpec', 'multMadness', 'ghostProto', 'luckyGambler', 'fullArsenal', 'survivor', 'veteran', 'immortal', 'closeCall', 'perfectRun', 'brain404', 'yoloMode', 'negotiator', 'masochist', 'balanced', 'ascended', 'transcended'];
  const counters = ['totalNodesValidated', 'successfulSessions', 'bypassCount', 'bypassLevel10Plus', 'ghostShieldUses', 'ghostShieldSaves', 'jackpotsWon', 'gambleStreak', 'maxGambleStreak', 'highMoneyTime', 'negotiatorStartTime', 'maxStreak'];

  function normalize(input) {
    if (!record(input) || !['money', 'totalMoney', 'playerName', 'pUpgrades', 'achievements', 'musicVolume', 'sfxVolume', 'prestigeLevel', 'tutorialSeen'].some(key => own(input, key))) return null;
    const result = {
      money: number(value(input, 'money')),
      totalMoney: number(value(input, 'totalMoney')),
      risk: number(value(input, 'risk'), 0, 100),
      playerName: typeof value(input, 'playerName') === 'string' ? input.playerName.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 30) || 'ANONYMOUS' : 'ANONYMOUS',
      pUpgrades: {}, achievements: {}, achievementStats: {},
      musicVolume: number(value(input, 'musicVolume'), .5, 1),
      sfxVolume: number(value(input, 'sfxVolume'), .5, 1),
      prestigeLevel: number(value(input, 'prestigeLevel'), 0, Number.MAX_SAFE_INTEGER, true),
      prestigePoints: number(value(input, 'prestigePoints'), 0, Number.MAX_SAFE_INTEGER, true),
      tutorialSeen: bool(value(input, 'tutorialSeen')),
      presentation: { version: 1 }
    };
    const savedUpgrades = record(value(input, 'pUpgrades')) ? input.pUpgrades : {};
    for (const [key, max] of Object.entries(upgrades)) {
      const upgrade = record(value(savedUpgrades, key)) ? savedUpgrades[key] : {};
      result.pUpgrades[key] = { lvl: number(value(upgrade, 'lvl'), 0, max, true) };
    }
    const savedAchievements = record(value(input, 'achievements')) ? input.achievements : {};
    for (const key of achievementIds) {
      const achievement = record(value(savedAchievements, key)) ? savedAchievements[key] : {};
      result.achievements[key] = { unlocked: bool(value(achievement, 'unlocked')) };
    }
    const stats = record(value(input, 'achievementStats')) ? input.achievementStats : {};
    for (const key of counters) result.achievementStats[key] = number(value(stats, key), 0, Number.MAX_SAFE_INTEGER, true);
    result.achievementStats.maxRiskSurvived = number(value(stats, 'maxRiskSurvived'), 0, 100);
    for (const [key, fallback] of [['bruteForceOnly', true], ['boughtAllBonusesThisSession', false], ['comebackAchieved', false], ['perfectRunActive', true]]) result.achievementStats[key] = bool(value(stats, key), fallback);
    const bonuses = value(stats, 'bonusesBoughtThisSession');
    result.achievementStats.bonusesBoughtThisSession = Array.isArray(bonuses) ? [...new Set(bonuses.slice(0, 64).filter(id => Number.isInteger(id) && id >= 1 && id <= 6))] : [];
    const prefs = record(value(input, 'presentation')) ? input.presentation : {};
    for (const key of ['reducedMotion', 'introSeen']) if (typeof value(prefs, key) === 'boolean') result.presentation[key] = prefs[key];
    if (['full', 'low', 'off'].includes(value(prefs, 'effectsLevel'))) result.presentation.effectsLevel = prefs.effectsLevel;
    return result;
  }
  function normalizeForWrite(input) {
    const state = normalize(input);
    if (!state) return null;
    // Loading may repair a legacy file; writing must not turn a broken live
    // balance/level into zero and silently replace a healthy saved game.
    for (const key of ['money', 'totalMoney', 'risk', 'prestigeLevel', 'prestigePoints', 'musicVolume', 'sfxVolume']) {
      if (value(input, key) !== state[key]) return null;
    }
    if (!record(value(input, 'pUpgrades')) || !record(value(input, 'achievements')) || !record(value(input, 'achievementStats'))) return null;
    for (const key of Object.keys(upgrades)) if (value(value(input.pUpgrades, key), 'lvl') !== state.pUpgrades[key].lvl) return null;
    for (const key of achievementIds) if (value(value(input.achievements, key), 'unlocked') !== state.achievements[key].unlocked) return null;
    for (const key of [...counters, 'maxRiskSurvived']) if (value(input.achievementStats, key) !== state.achievementStats[key]) return null;
    return state;
  }
  return Object.freeze({ normalize, normalizeForWrite, MAX_BYTES });
});

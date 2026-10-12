/* Presentation bridge: never rolls gameplay RNG or advances the game clock. */
'use strict';
const presentationPreferences = {
    version: 1,
    reducedMotion: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || false,
    effectsLevel: 'full',
    introSeen: false,
    language: 'en'
};
let presentationObserver = null;
let lastPresentation = null;
let lastProtocol = null;
let presentationPublishing = false;
let presentationRun = Object.freeze({runId:0,startMoney:0,earningScale:20});
const relayScreenOrder = [
    ['intro','screen-intro'], ['settings','screen-settings'],
    ['typing','typing-container'], ['backdoor','backdoor-container'], ['bypass','screen-bypass'],
    ['busted','screen-busted'], ['success','screen-success'], ['tutorial','screen-tutorial'],
    ['achievements','screen-achievements'], ['leaderboard','screen-leaderboard'],
    ['persistent','screen-persistent'], ['menu','main-menu']
];

function currentPresentationScreen() {
    for (const [name,id] of relayScreenOrder) {
        const el=document.getElementById(id);
        if(el && !el.hidden && (el.style.display==='flex' || (el.style.display!== 'none' && getComputedStyle(el).display!=='none'))) return name;
    }
    return 'game';
}
function escapeDisplayText(value) {
    return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function displayMoney(value) {
    const n = Number(value);
    if (window.RiskI18n?.language === 'fr') {
        if (!Number.isFinite(n)) return '—\u00a0$';
        if (n > 0 && n < 0.01) return '<0,01\u00a0$';
        const value = Math.abs(n) >= 1e6 ? formatNumber(n) : n.toLocaleString('fr-FR', {maximumFractionDigits:Math.abs(n)<1 ? 2 : Math.abs(n)<100 ? 1 : 0});
        return value+'\u00a0$';
    }
    if(!Number.isFinite(n)) return '$—';
    if(Math.abs(n)>=1e6) return '$'+formatNumber(n);
    if(n>0 && n<0.01) return '<$0.01';
    if(Math.abs(n)<1) return '$'+n.toLocaleString('en-US',{maximumFractionDigits:2});
    if(Math.abs(n)<100) return '$'+n.toLocaleString('en-US',{maximumFractionDigits:1});
    return '$'+n.toLocaleString('en-US',{maximumFractionDigits:0});
}
function displayRiskPoints(value) {
    return Number(value).toLocaleString(window.RiskI18n?.locale || 'en-US',{maximumFractionDigits:2});
}
function applyPresentationPreferences(next={}) {
    if (!next || typeof next !== 'object') return;
    if(typeof next.reducedMotion==='boolean') presentationPreferences.reducedMotion=next.reducedMotion;
    if(['full','low','off'].includes(next.effectsLevel)) presentationPreferences.effectsLevel=next.effectsLevel;
    if(typeof next.introSeen==='boolean') presentationPreferences.introSeen=next.introSeen;
    if (['en','fr'].includes(next.language)) {
        presentationPreferences.language=next.language;
        window.RiskI18n?.setLanguage(next.language,{persist:false});
    }
}
function presentationBonusState(costs=getBonusCosts()) {
    return getBonusAvailability(costs);
}
function presentationSnapshot() {
    const costs=getBonusCosts();
    const bonuses=presentationBonusState(costs);
    return Object.freeze({
        screen:currentPresentationScreen(), money, totalMoney, risk, multiplier,
        ...presentationRun,
        nodeProgress:nodesHacked, nodesValidated, bypassCharge, bypassChargeMax,
        ghost:ghostShieldActive, ghostCooldown, insuranceTurns,
        overclockTurns:overclockBonusTurns, overclockCooldown, gambleCooldown,
        prestigeLevel, prestigePoints, playerName, musicVolume, sfxVolume,
        bonusCosts:Object.freeze(costs), bonusStatuses:Object.freeze(bonuses.map(b=>b.status)),
        bonusAvailable:Object.freeze(bonuses.map(b=>b.available)),
        reducedMotion:presentationPreferences.reducedMotion, effectsLevel:presentationPreferences.effectsLevel,
        preferences:Object.freeze({...presentationPreferences}),
        protocol:lastProtocol
    });
}
function publishPresentation() {
    if(presentationPublishing) return lastPresentation;
    presentationPublishing=true;
    try {
        const state=presentationSnapshot();
        lastPresentation=state;
        const multiplierEl=document.getElementById('multiplier-text');
        if(multiplierEl) {
            multiplierEl.textContent='×'+formatNumber(multiplier);
            multiplierEl.classList.toggle('compact-multiplier', multiplierEl.textContent.length > 6);
            multiplierEl.classList.toggle('tiny-multiplier', multiplierEl.textContent.length > 9);
            multiplierEl.title=window.RiskI18n?.t('live.multiplier.title',{count:window.RiskI18n.number(multiplier)}) || 'Multiplier: '+multiplier;
        }
        const charge=document.getElementById('bypass-charge');
        if(charge) charge.textContent=bypassCharge+'/'+bypassChargeMax;
        document.body.classList.toggle('is-danger',risk>=75 && state.screen==='game');
        document.body.classList.toggle('reduced-motion',state.reducedMotion);
        document.body.dataset.screen=state.screen;
        document.dispatchEvent(new CustomEvent('risk:state',{detail:state}));
        return state;
    } finally {presentationPublishing=false;}
}
function relayEvent(type,details={}) {
    const detail=Object.freeze({type,money,risk,multiplier,runId:presentationRun.runId,...details});
    document.dispatchEvent(new CustomEvent('risk:event',{detail}));
}
// UI-only protocol state. Deadlines describe the existing gameplay timers;
// consumers may draw progress but must never resolve or extend those timers.
function relayProtocol(game,phase,details={}) {
    lastProtocol=Object.freeze({...(lastProtocol?.game===game?lastProtocol:{}),game,phase,...details,updatedAt:performance.now()});
    document.dispatchEvent(new CustomEvent('risk:protocol',{detail:lastProtocol}));
    return lastProtocol;
}
function installPresentationObserver() {
    if(presentationObserver) return;
    presentationObserver=new MutationObserver(()=>publishPresentation());
    relayScreenOrder.forEach(([,id])=>{
        const element=document.getElementById(id);
        if(element) presentationObserver.observe(element,{attributes:true,attributeFilter:['style','hidden']});
    });
    document.addEventListener('visibilitychange',()=>publishPresentation());
    window.addEventListener('beforeunload',()=>{
        presentationObserver?.disconnect();
        clearTimeout(typingTimeout); clearInterval(typingCountdownInterval);
        clearInterval(backdoorTimer); clearInterval(backdoorCountdownInterval);
        if(bypassInterval) cancelAnimationFrame(bypassInterval);
        window.BlacksiteScene?.dispose(); window.RelayAudio?.dispose();
    });
}
window.RiskPresentation=Object.freeze({
    startRun() {
        const earningScale=20*(1+pUpgrades.miner.lvl*0.2)*getPrestigeBonus().gainMult;
        presentationRun=Object.freeze({runId:presentationRun.runId+1,startMoney:money,earningScale});
        relayEvent('run-start',presentationRun);
    },
    refresh:publishPresentation,
    snapshot:presentationSnapshot,
    currentScreen:currentPresentationScreen,
    emit:relayEvent,
    protocol:()=>lastProtocol,
    getPreferences:()=>Object.freeze({...presentationPreferences}),
    setPreferences(next) {
        applyPresentationPreferences(next);
        window.BlacksiteScene?.setReducedMotion(presentationPreferences.reducedMotion);
        window.BlacksiteScene?.setQuality(presentationPreferences.effectsLevel);
        publishPresentation();
        window.saveGameState();
    }
});

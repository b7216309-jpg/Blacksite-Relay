/* Presentation bridge: never rolls gameplay RNG or advances the game clock. */
'use strict';
const presentationPreferences = {
    version: 1,
    reducedMotion: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || false,
    effectsLevel: 'full',
    introSeen: false
};
let presentationObserver = null;
let lastPresentation = null;
let lastProtocol = null;
let presentationPublishing = false;
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
    if(!Number.isFinite(n)) return '$—';
    if(Math.abs(n)>=1e6) return '$'+formatNumber(n);
    if(Math.abs(n)<100) return '$'+n.toLocaleString('en-US',{maximumFractionDigits:1});
    return '$'+n.toLocaleString('en-US',{maximumFractionDigits:0});
}
function displayRiskPoints(value) {
    return Number(value).toLocaleString('en-US',{maximumFractionDigits:2});
}
function applyPresentationPreferences(next={}) {
    if (!next || typeof next !== 'object') return;
    if(typeof next.reducedMotion==='boolean') presentationPreferences.reducedMotion=next.reducedMotion;
    if(['full','low','off'].includes(next.effectsLevel)) presentationPreferences.effectsLevel=next.effectsLevel;
    if(typeof next.introSeen==='boolean') presentationPreferences.introSeen=next.introSeen;
}
function presentationBonusState(costs=getBonusCosts()) {
    return costs.map((cost,index)=>{
        let status='READY', blocked=false;
        if(index===1 && insuranceTurns>0) {status='ACTIVE';blocked=true;}
        if(index===2 && gambleCooldown>0) {status=gambleCooldown+' HACKS';blocked=true;}
        if(index===3 && ghostShieldActive) {status='ACTIVE';blocked=true;}
        else if(index===3 && ghostCooldown>0) {status=ghostCooldown+' HACKS';blocked=true;}
        if(index===5 && ghostShieldActive) {status='LOCKED';blocked=true;}
        else if(index===5 && overclockCooldown>0) {status=overclockCooldown+' HACKS';blocked=true;}
        if(!blocked && (money<=0 || !Number.isFinite(cost) || cost<=0 || money<cost)) {status='LOW FUNDS';blocked=true;}
        return Object.freeze({status,available:!blocked});
    });
}
function presentationSnapshot() {
    const costs=getBonusCosts();
    const bonuses=presentationBonusState(costs);
    return Object.freeze({
        screen:currentPresentationScreen(), money, totalMoney, risk, multiplier,
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
        if(multiplierEl) {multiplierEl.textContent='×'+formatNumber(multiplier);multiplierEl.title='Multiplier: '+multiplier;}
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
    const detail=Object.freeze({type,money,risk,multiplier,...details});
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

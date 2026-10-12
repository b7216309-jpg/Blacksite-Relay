/* A focus-safe view for the save/quit controller. It never saves, closes, or changes game clocks. */
(() => {
  'use strict';
  if (window.RelayQuitUI) return;
  const t = (key, fallback, params = {}) => window.RiskI18n?.t(key, params) ?? fallback.replace(/\{(\w+)\}/g, (_, name) => params[name] ?? '');
  const problems = new Map([
    ['Closing took too long. Please retry.', 'closeTimeout'],
    ['Saving took too long. Your previous save is protected.', 'saveTimeout'],
    ['Could not save your progress.', 'save'],
    ['Your existing save could not be read. It has been preserved.', 'read'],
    ['Your progress is saved, but your local record could not be saved.', 'record'],
    ['Could not finish saving. Please retry.', 'finish'],
    ['Could not close yet. Please retry.', 'close']
  ]);
  const dialog = document.createElement('section');
  dialog.id = 'relay-quit-dialog'; dialog.hidden = true; dialog.tabIndex = -1;
  dialog.setAttribute('role','alertdialog'); dialog.setAttribute('aria-modal','true');
  dialog.setAttribute('aria-labelledby','relay-quit-title'); dialog.setAttribute('aria-describedby','relay-quit-description relay-quit-loss relay-quit-challenge');
  dialog.innerHTML = `<div class="quit-brand" aria-hidden="true">RISK<span>_v2</span><i></i></div><div class="quit-panel"><div class="quit-symbol" aria-hidden="true"><svg class="icon"><use href="#i-exit"></use></svg></div><p class="quit-eyebrow" id="relay-quit-eyebrow">END SESSION</p><h2 id="relay-quit-title">Quit this run?</h2><p id="relay-quit-description"></p><p id="relay-quit-loss" class="quit-loss"></p><p id="relay-quit-challenge" class="quit-challenge" hidden>Challenge timer continues.</p><div class="quit-actions"><button id="relay-quit-cancel" type="button" class="quit-button quit-primary">KEEP PLAYING <kbd>ESC</kbd></button><button id="relay-quit-confirm" type="button" class="quit-button">SAVE &amp; QUIT</button><button id="relay-quit-retry" type="button" class="quit-button" hidden>RETRY SAVE</button><button id="relay-quit-discard" type="button" class="quit-button quit-danger" hidden>QUIT WITHOUT SAVING</button></div><p class="quit-pending" id="relay-quit-pending" hidden>PLEASE WAIT</p></div>`;
  document.body.append(dialog);
  const $ = id => document.getElementById('relay-quit-'+id);
  const listeners = [], savedInert = new Map(), heldKeys = new Set(), releasedAfterClose = new Set();
  let open = false, phase = 'confirm', opener = null, disposed = false, focusMoves = 0, lastData = {};
  const pending = () => phase === 'saving' || phase === 'loading';
  const listen = (target,type,fn,options) => { target.addEventListener(type,fn,options); listeners.push(()=>target.removeEventListener(type,fn,options)); };
  const stop = event => { event.preventDefault(); event.stopImmediatePropagation(); };
  function focus(node) { if (node && node.isConnected && !node.closest('[inert]') && node.getClientRects().length) { node.focus({preventScroll:true}); focusMoves++; return true; } return false; }
  function isolate() {
    if (!open) return;
    for (const node of document.body.children) {
      if (node === dialog || ['SCRIPT','STYLE','LINK'].includes(node.tagName)) continue;
      if (!savedInert.has(node)) savedInert.set(node,node.inert);
      if (!node.inert) node.inert = true;
    }
  }
  const observer = new MutationObserver(isolate);
  function formatFunds(value) {
    const amount = Number.isFinite(value) ? Math.max(0,value) : 0;
    if (window.RiskI18n?.language === 'fr') {
      if (amount > 0 && amount < .01) return '<0,01 $';
      return (amount < 1e9 ? amount.toLocaleString('fr-FR',{maximumFractionDigits:2}) : amount.toExponential(2).replace('.', ',')) + ' $';
    }
    if (amount > 0 && amount < .01) return '<$0.01';
    return amount < 1e9 ? '$'+amount.toLocaleString('en-US',{maximumFractionDigits:2}) : '$'+amount.toExponential(2);
  }
  function paintLabels() {
    $('challenge').textContent = t('extra.quit.challenge', 'Challenge timer continues.');
    // Retain the button and keycap nodes so switching language does not disturb focus.
    $('cancel').firstChild.textContent = t('extra.quit.cancel', 'KEEP PLAYING') + ' ';
    $('cancel').querySelector('kbd').textContent = t('extra.quit.escape', 'ESC');
    $('confirm').textContent = t('extra.quit.confirm', 'SAVE & QUIT');
    $('retry').textContent = t('extra.quit.retry', 'RETRY SAVE');
    $('discard').textContent = t('extra.quit.discard', 'QUIT WITHOUT SAVING');
    $('pending').textContent = t('extra.quit.wait', 'PLEASE WAIT');
  }
  function paintCopy(data) {
    paintLabels();
    $('eyebrow').textContent = phase === 'error' ? t('extra.quit.incomplete', 'SAVE NOT COMPLETED') : t('extra.quit.end', 'END SESSION');
    $('title').textContent = ({
      saving: data.discarding ? t('extra.quit.closing', 'Closing...') : t('extra.quit.saving', 'Saving...'),
      loading: t('extra.quit.loading', 'Loading save...'),
      error: data.discarding ? t('extra.quit.closeError', 'Could not close.') : t('extra.quit.saveError', 'Could not save.')
    })[phase] || (data.runActive || data.unsecured > 0 || data.challenge ? t('extra.quit.run', 'Quit this run?') : t('extra.quit.idle', 'Save and quit?'));
    const problem = problems.has(data.problem) ? t('extra.quit.problem.' + problems.get(data.problem), data.problem) : data.problem;
    $('description').textContent = phase === 'saving'
      ? (data.discarding ? t('extra.quit.drain', 'Waiting for pending writes to finish.') : t('extra.quit.savingDescription', 'Saving your progress to this PC.'))
      : phase === 'loading' ? t('extra.quit.loadingDescription', 'Waiting for your existing save.')
      : phase === 'error' ? (problem || t('extra.quit.errorDescription', 'Your latest progress has not been saved.'))
      : t('extra.quit.confirmDescription', 'Your bank and permanent progress will be saved.');
    $('loss').textContent = t('extra.quit.loss', '{funds} unsecured funds will be lost.', { funds: formatFunds(data.unsecured) });
  }
  function show(data = {}) {
    if (disposed) return;
    lastData = { ...data };
    if (!open) { opener = document.activeElement; open = true; heldKeys.forEach(key=>releasedAfterClose.add(key)); dialog.hidden = false; isolate(); observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['inert']}); }
    const before = phase; phase = ['confirm','saving','error','loading'].includes(data.phase) ? data.phase : 'confirm';
    dialog.dataset.phase = phase; dialog.setAttribute('aria-busy',String(pending()));
    paintCopy(data);
    $('loss').hidden = !(data.unsecured > 0) || pending();
    $('challenge').hidden = !data.challenge;
    $('cancel').hidden = pending(); $('confirm').hidden = phase !== 'confirm';
    $('retry').hidden = phase !== 'error'; $('discard').hidden = phase !== 'error'; $('pending').hidden = !pending();
    for (const button of dialog.querySelectorAll('button')) button.disabled = pending();
    if (before !== phase || !dialog.contains(document.activeElement)) focus(pending() ? dialog : $('cancel'));
  }
  function hide() {
    if (!open) return;
    heldKeys.forEach(key=>releasedAfterClose.add(key)); open = false; observer.disconnect(); dialog.hidden = true;
    for (const [node,wasInert] of savedInert) if (node.isConnected) node.inert = wasInert;
    savedInert.clear(); window.RiskPresentation?.refresh?.();
    if (!focus(opener)) {
      const target = [...document.querySelectorAll('button,input,select,[tabindex="0"]')].find(node=>!node.disabled&&!node.closest('[inert]')&&node.getClientRects().length);
      focus(target);
    }
    opener = null;
  }
  const action = name => { if (open && !pending()) window.RiskQuit?.[name]?.(); };
  for (const [id,name] of [['cancel','cancel'],['confirm','confirm'],['retry','retry'],['discard','discard']]) listen($(id),'click',()=>action(name));
  listen(window,'keydown',event=>{
    heldKeys.add(event.code);
    if (!open) { if (releasedAfterClose.has(event.code)) stop(event); return; }
    stop(event);
    if (event.repeat || pending()) return;
    if (event.key === 'Escape') { action('cancel'); return; }
    if (event.key === 'Tab') {
      const options = [...dialog.querySelectorAll('button')].filter(button=>!button.hidden&&!button.disabled);
      const current = options.indexOf(document.activeElement), direction = event.shiftKey ? -1 : 1;
      focus(options[(current+direction+options.length)%options.length]); return;
    }
    if (['Enter',' '].includes(event.key) && dialog.contains(document.activeElement) && document.activeElement.tagName === 'BUTTON') document.activeElement.click();
  },true);
  listen(window,'keyup',event=>{heldKeys.delete(event.code);if(open||releasedAfterClose.has(event.code)){releasedAfterClose.delete(event.code);stop(event);}},true);
  listen(window,'keypress',event=>{if(open||releasedAfterClose.has(event.code))stop(event);},true);
  for(const type of ['pointerdown','pointerup','click','dblclick','contextmenu','wheel','input','change','paste','drop']) listen(window,type,event=>{if(open&&!dialog.contains(event.target))stop(event);},{capture:true,passive:false});
  listen(window,'focusin',event=>{if(open&&!dialog.contains(event.target)){event.stopImmediatePropagation();focus(pending()?dialog:$('cancel'));}},true);
  listen(window,'blur',()=>{heldKeys.clear();releasedAfterClose.clear();});
  listen(document,'risk:language',()=>{ if (!disposed) paintCopy(lastData); });
  function dispose(){if(disposed)return;hide();disposed=true;observer.disconnect();listeners.splice(0).forEach(remove=>remove());dialog.remove();}
  listen(window,'beforeunload',dispose);
  paintCopy(lastData);
  window.RelayQuitUI = Object.freeze({show,hide,isOpen:()=>open,dispose,getDiagnostics:()=>({open,phase,disposed,focusMoves,coveredSurfaces:savedInert.size,ownedTimers:0,ownedAnimationFrames:0,focused:document.activeElement?.id||'',heldKeys:[...heldKeys],releaseGuards:[...releasedAfterClose]})});
})();

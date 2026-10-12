/* Live HUD and protocol copy. Internal protocol/status codes stay unchanged. */
(() => {
  const rows = {
    'trace.critical':['CRITICAL / EXTRACT','CRITIQUE / SORTEZ'], 'trace.rising':['TRACE RISING','RISQUE EN HAUSSE'], 'trace.stable':['STABLE','STABLE'],
    'multiplier.title':['Multiplier: {count}','Multiplicateur : {count}'],
    'charge.ready':['READY ','PRÊT '], 'charge.loading':['CHARGING ','CHARGE '],
    'status.READY':['READY','PRÊT'], 'status.ACTIVE':['ACTIVE','ACTIF'], 'status.LOCKED':['LOCKED','VERROUILLÉ'],
    'status.LOW FUNDS':['LOW FUNDS','FONDS INSUFF.'], 'status.HACK FIRST':['HACK FIRST','PIRATEZ'], 'status.CLEAR':['CLEAR','RISQUE NUL'],
    'status.hacks':['{count} HACKS','{count} HACKS'], 'status.hack':['{count} HACK','{count} HACK'],
    'port.name':['Patch port {port}','Port {port}'], 'port.target':[', illuminated',', allumé'], 'port.correct':[', connected',', connecté'], 'port.wrong':[', incorrect selection',', mauvais choix'],
    'receipt.typing.win':['COMMAND ACCEPTED','COMMANDE ACCEPTÉE'], 'receipt.typing.fail':['INJECTION REJECTED','INJECTION REJETÉE'],
    'receipt.memory.win':['HIDDEN ROUTE OPEN','PASSAGE OUVERT'], 'receipt.memory.fail':['PATCH ROUTE LOST','CONNEXION PERDUE'],
    'receipt.bypass.reward':['TRACE DISRUPTED','TRACE BROUILLÉE'], 'receipt.bypass.exit':['COUPLER DISCONNECTED','COUPLEUR DÉCONNECTÉ'], 'receipt.bypass.fail':['CALIBRATION LOST','CALIBRAGE PERDU'],
    'receipt.complete':['PROTOCOL COMPLETE','PROTOCOLE TERMINÉ'], 'receipt.ready':['The relay is ready.','Le relais est prêt.'], 'receipt.return':['Return to the relay.','Retour au relais.'],
    'bypass.apply':['EXIT & APPLY','SORTIR ET APPLIQUER'], 'bypass.exit':['EXIT','SORTIR'],
    'typing.wait':['WAIT FOR ACCESS','ATTENDEZ L’ACCÈS'], 'typing.edit':['EDIT MISMATCH','CORRIGEZ LES ERREURS'], 'typing.auto':['AUTO-SUBMIT','ENVOI AUTOMATIQUE'],
    'typing.matched':['{correct} / {target} MATCHED','{correct} / {target} CORRECTS'], 'typing.starts':['STARTS IN','DÉBUT DANS'], 'typing.time':['TIME LEFT','TEMPS RESTANT'], 'typing.reward':['+{count} MULTIPLIER','+{count} MULTIPLICATEUR'],
    'memory.memorize':['MEMORIZE','MÉMORISEZ'], 'memory.recall':['RECALL','REPRODUISEZ'], 'memory.connected':['CONNECTED','CONNECTÉ'], 'memory.failed':['FAILED','ÉCHEC'],
    'memory.remember':['Remember the five lit ports.','Mémorisez les cinq ports allumés.'], 'memory.select':['Select the ports you saw.','Retrouvez les ports allumés.'], 'memory.returning':['Returning…','Retour…'],
    'memory.reward':['+{money} / −25 RISK','+{money} / −25 RISQUE'],
    'proximity.inside':['ALIGNED','ALIGNÉ'], 'proximity.near':['APPROACHING','EN APPROCHE'], 'proximity.far':['SCANNING','BALAYAGE']
  };
  window.RiskI18n.register(Object.fromEntries(['en','fr'].map((lang,index)=>[lang,Object.fromEntries(Object.entries(rows).map(([key,values])=>['live.'+key,values[index]]))])));
})();

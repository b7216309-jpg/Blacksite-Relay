/* Blacksite Relay — paced soundtrack and bounded Web Audio mixer.
 * No gameplay randomness, network services, or persistent state are used here.
 * Supplied soundtrack provenance: art-source/audio/neon-soundtrack/.
 * Blacksite sound-effect synthesis: art-source/audio/compose.py.
 */
(() => {
  'use strict';
  const scriptURL = document.currentScript && document.currentScript.src;
  const baseURL = new URL('../assets/audio/', scriptURL || new URL('src/relay-audio.js', document.baseURI));
  const clamp = (n, a = 0, b = 1) => Math.min(b, Math.max(a, Number.isFinite(+n) ? +n : a));
  const cues = new Set(['click', 'hover', 'purchase', 'denied', 'hack-1', 'hack-2', 'hack-3', 'node', 'bypass-ready', 'minigame-success', 'minigame-fail', 'ghost', 'overclock', 'cooler', 'insure', 'gamble', 'proxy', 'transfer', 'bust', 'achievement', 'prestige', 'intro']);
  const aliases = { bonus: 'purchase', success: 'minigame-success', fail: 'denied' };
  ['rat','cat','snail','locker','arcade','knock'].forEach(name => cues.add('egg-' + name));
  const bonusCues = { 1: 'cooler', 2: 'insure', 3: 'gamble', 4: 'ghost', 5: 'proxy', 6: 'overclock' };
  const maxVoices = 16;
  let context, master, musicBus, sfxBus, limiter, ceiling, initialising, disposed = false;
  let musicVolume = 0.5, sfxVolume = 0.5, screen = 'menu', trace = 0;
  let suspendedByVisibility = false, musicTimer = null;
  let visibilityTask = Promise.resolve();
  const director = window.RelayMusicDirector.create({ now: () => performance.now() });
  const tracks = window.RelayMusicDirector.tracks;
  const musicVoices = new Set();
  const pausedOffsets = new Map();
  let musicRunId = -1;
  let currentMusic = null, transition = null, desiredMusic = null;
  let maxMusicVoicesSeen = 0, transitionCount = 0;
  const buffers = new Map(), pending = new Map(), failed = new Set(), loops = new Map(), voices = new Set(), lastCue = new Map(), cueRevisions = new Map();

  function ramp(param, target, seconds = 0.5) {
    if (!context || !param) return;
    const now = context.currentTime;
    if (param.cancelAndHoldAtTime) param.cancelAndHoldAtTime(now);
    else { param.cancelScheduledValues(now); param.setValueAtTime(param.value, now); }
    param.linearRampToValueAtTime(target, now + seconds);
  }

  async function readAsset(url) {
    try {
      const response = await fetch(url);
      if (!response.ok && response.status !== 0) throw new Error('Unavailable audio');
      return await response.arrayBuffer();
    } catch (fetchError) {
      // Electron's local file protocol may require XHR; browser preview uses fetch.
      return new Promise((resolve, reject) => {
        const request = new XMLHttpRequest();
        request.open('GET', url, true);
        request.responseType = 'arraybuffer';
        request.timeout = 15000;
        request.onload = () => request.response && (request.status === 0 || request.status < 400)
          ? resolve(request.response) : reject(fetchError);
        request.onerror = request.ontimeout = () => reject(fetchError);
        request.send();
      });
    }
  }

  function load(name, isMusic = false) {
    const key = (isMusic ? 'music-' : 'sfx-') + name;
    if (buffers.has(key)) return Promise.resolve(buffers.get(key));
    if (pending.has(key)) return pending.get(key);
    if (failed.has(key) || !context || disposed) return Promise.resolve(null);
    const job = readAsset(new URL(key + '.ogg', baseURL).href)
      .then(data => disposed ? null : context.decodeAudioData(data))
      .then(buffer => { if (buffer && !disposed) buffers.set(key, buffer); return buffer; })
      .catch(() => { failed.add(key); return null; })
      .finally(() => pending.delete(key));
    pending.set(key, job);
    return job;
  }

  function startLoop(name, buffer) {
    if (!buffer || loops.has(name) || disposed) return;
    const source = context.createBufferSource();
    const gain = context.createGain();
    source.buffer = buffer;
    source.loop = true;
    source.loopStart = 0;
    source.loopEnd = buffer.duration;
    gain.gain.value = 0;
    source.connect(gain).connect(musicBus);
    const when = context.currentTime + 0.06;
    source.start(when, 0);
    loops.set(name, { source, gain, level: null });
  }

  async function ensureMusic() {
    if (!context || disposed) return;
    // Decode once after the first gesture. The four 44.1 kHz stereo scores use
    // 84,672,000 bytes; no duplicate buffers are retained for transitions.
    await Promise.all([...Object.keys(tracks), 'ambience'].map(name => load(name, true)));
    if (disposed) return;
    startLoop('ambience', buffers.get('music-ambience'));
    musicTick();
  }

  function retireMusic(voice) {
    if (!voice || !musicVoices.has(voice)) return;
    if (!disposed && context.currentTime >= voice.startedAt
        && (voice.key === 'neon-standby:menu' || voice.key.endsWith(':' + musicRunId))) {
      pausedOffsets.set(voice.key, (voice.offset + context.currentTime - voice.startedAt) % 60);
    }
    musicVoices.delete(voice);
    voice.source.onended = null;
    try { voice.source.stop(); } catch (_) { /* Already ended during shutdown. */ }
    voice.source.disconnect(); voice.gain.disconnect();
  }

  function makeMusic(selection, when, fade) {
    const buffer = buffers.get('music-' + selection.name), meta = tracks[selection.name];
    if (!buffer || buffer.duration < meta.loopEnd || musicVoices.size >= 2) return null;
    const source = context.createBufferSource(), gain = context.createGain();
    source.buffer = buffer; source.loop = true;
    source.loopStart = meta.loopStart; source.loopEnd = meta.loopEnd;
    gain.gain.value = 0;
    source.connect(gain).connect(musicBus);
    const offset = pausedOffsets.get(selection.key) || 0;
    const voice = { source, gain, name: selection.name, key: selection.key, startedAt: when, fadeIn: fade, offset, level: selection.level };
    source.onended = () => retireMusic(voice);
    musicVoices.add(voice);
    maxMusicVoicesSeen = Math.max(maxMusicVoicesSeen, musicVoices.size);
    gain.gain.setValueAtTime(0, when);
    gain.gain.linearRampToValueAtTime(selection.level, when + fade);
    source.start(when, offset);
    return voice;
  }

  function settleTransition() {
    if (!transition) return;
    if (context.currentTime >= transition.when) currentMusic = transition.to;
    if (context.currentTime >= transition.end) {
      retireMusic(transition.from);
      transition = null;
    }
  }

  function reconcileMusic(pace) {
    if (pace.runId > musicRunId) {
      musicRunId = pace.runId;
      for (const key of pausedOffsets.keys()) if (key !== 'neon-standby:menu') pausedOffsets.delete(key);
    }
    const name = pace.track;
    const menu = name === 'neon-standby';
    desiredMusic = { name, key: name + ':' + (menu ? 'menu' : pace.runId), level: tracks[name].gain * (menu ? 0.4 : 0.65) };
    const ambience = loops.get('ambience'), ambienceLevel = menu ? 0.08 : 0.12;
    if (ambience && ambience.level !== ambienceLevel) {
      ambience.level = ambienceLevel; ramp(ambience.gain.gain, ambienceLevel, 0.6);
    }
    settleTransition();
    // A source scheduled on a future bar can be replaced without cutting off
    // its still-audible predecessor. No future stop is attached to that voice.
    if (transition && context.currentTime < transition.when && transition.to.key !== desiredMusic.key) {
      retireMusic(transition.to);
      currentMusic = transition.from;
      ramp(currentMusic.gain.gain, currentMusic.level, 0.06);
      transition = null;
    }
    if (transition) return; // Finish the <=600 ms audible fade before a third request.
    if (currentMusic && currentMusic.key === desiredMusic.key) return;
    let selection = desiredMusic;
    if (!buffers.has('music-' + selection.name)) {
      if (currentMusic || !buffers.has('music-neon-standby')) return;
      selection = { name: 'neon-standby', key: 'neon-standby:menu', level: tracks['neon-standby'].gain * 0.4 };
    }
    let when = context.currentTime + 0.035, fade = 0.6;
    if (currentMusic && currentMusic.name !== 'neon-standby' && selection.name !== 'neon-standby'
        && currentMusic.key.split(':')[1] === selection.key.split(':')[1]) {
      const bar = 240 / tracks[currentMusic.name].bpm;
      const origin = currentMusic.startedAt - currentMusic.offset;
      when = origin + Math.ceil((when - origin) / bar) * bar;
      fade = 0.25;
    }
    const next = makeMusic(selection, when, fade);
    if (!next) return;
    if (!currentMusic) { currentMusic = next; return; }
    const from = currentMusic;
    if (from.gain.gain.cancelAndHoldAtTime) from.gain.gain.cancelAndHoldAtTime(when);
    else {
      from.gain.gain.cancelScheduledValues(when);
      from.gain.gain.setValueAtTime(from.level * clamp((when - from.startedAt) / from.fadeIn), when);
    }
    from.gain.gain.linearRampToValueAtTime(0, when + fade);
    transition = { from, to: next, when, end: when + fade, fade };
    transitionCount++;
  }

  function musicTick() {
    if (disposed) return;
    director.setHidden(document.hidden);
    director.setBlocked(!!(window.RiskQuitBlocking || window.RiskSaveLoading || window.RiskSaveReadBlocked));
    director.setRunning(!!context && context.state === 'running');
    const pace = director.tick();
    if (context && context.state === 'running' && !document.hidden) reconcileMusic(pace);
  }

  function onContextState() {
    director.setRunning(!!context && context.state === 'running' && !disposed);
    // A resume promise may finish after another hide. Converge again at the
    // actual state change so a late resume cannot leave hidden music running.
    if (!disposed && context && context.state === 'running' && document.hidden) {
      onVisibility();
    }
    if (!disposed && context && context.state === 'running' && !document.hidden) {
      if (musicTimer === null) musicTimer = setInterval(musicTick, 250);
      musicTick();
    } else if (musicTimer !== null) { clearInterval(musicTimer); musicTimer = null; }
  }

  async function unlock() {
    if (disposed) return false;
    if (!context) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return false;
      try {
        context = new AudioContext({ latencyHint: 'interactive', sampleRate: 44100 });
        context.addEventListener('statechange', onContextState);
        master = context.createGain();
        musicBus = context.createGain();
        sfxBus = context.createGain();
        limiter = context.createDynamicsCompressor();
        limiter.threshold.value = -5;
        limiter.knee.value = 6;
        limiter.ratio.value = 8;
        limiter.attack.value = 0.003;
        limiter.release.value = 0.18;
        master.gain.value = 0.90;
        musicBus.gain.value = musicVolume;
        sfxBus.gain.value = sfxVolume;
        musicBus.connect(master); sfxBus.connect(master);
        master.connect(limiter);
        // A compressor alone can overshoot during an extreme cluster of cues.
        // This transparent-at-normal-levels soft ceiling catches those short
        // transients without lowering the whole soundtrack to accommodate them.
        ceiling = context.createWaveShaper();
        const curve = new Float32Array(4096);
        for (let i = 0; i < curve.length; i++) {
          const x = i * 2 / (curve.length - 1) - 1, magnitude = Math.abs(x);
          curve[i] = Math.sign(x) * (magnitude <= 0.65 ? magnitude : 0.65 + 0.27 * Math.tanh((magnitude - 0.65) / 0.27));
        }
        ceiling.curve = curve;
        ceiling.oversample = '2x';
        limiter.connect(ceiling).connect(context.destination);
      } catch (_) { return false; }
    }
    try { if (context.state === 'suspended' && !document.hidden) await context.resume(); } catch (_) { return false; }
    onContextState();
    if (!initialising) {
      initialising = ensureMusic();
      // Small frequently used cues warm up after a gesture; the remaining cues
      // are decoded only on demand and shared by every instance of that cue.
      ['click', 'hover', 'hack-1', 'hack-2', 'hack-3', 'denied'].forEach(name => load(name));
    }
    return context.state === 'running';
  }

  function setVolumes(music, sfx) {
    musicVolume = clamp(music); sfxVolume = clamp(sfx);
    if (context) { ramp(musicBus.gain, musicVolume, 0.05); ramp(sfxBus.gain, sfxVolume, 0.05); }
  }

  function setState(snapshot = {}) {
    if (snapshot.screen) screen = snapshot.screen;
    if (snapshot.risk !== undefined) trace = clamp(snapshot.risk, 0, 100);
    director.setState(snapshot);
    musicTick();
  }

  async function play(requested, options = {}) {
    const name = aliases[requested] || requested;
    if (disposed || !cues.has(name) || document.hidden || sfxVolume <= 0) return false;
    if (!context || context.state !== 'running') return false;
    const now = performance.now();
    const minInterval = name === 'hover' ? 100 : name.startsWith('hack') ? 35 : name === 'click' ? 40 : 90;
    if (now - (lastCue.get(name) ?? -Infinity) < minInterval) return false;
    lastCue.set(name, now);
    const revision = cueRevisions.get(name) || 0;
    const buffer = await load(name);
    if (!buffer || disposed || document.hidden || context.state !== 'running' || (cueRevisions.get(name) || 0) !== revision || performance.now() - now > 700) return false;
    // Quiet hovers never evict a semantic cue. Other sounds retire the oldest
    // voice immediately to enforce the hard limit; ended nodes disconnect.
    if (voices.size >= maxVoices) {
      if (name === 'hover') return false;
      const oldest = voices.values().next().value;
      oldest.source.onended = null;
      oldest.source.stop(); oldest.source.disconnect(); oldest.gain.disconnect();
      if (oldest.pan) oldest.pan.disconnect();
      voices.delete(oldest);
    }
    const source = context.createBufferSource(), gain = context.createGain();
    source.buffer = buffer;
    gain.gain.value = clamp(options.volume === undefined ? 1 : options.volume) * (name === 'hover' ? 0.30 : 0.76);
    let pan;
    source.connect(gain);
    if (context.createStereoPanner && options.pan !== undefined) {
      pan = context.createStereoPanner(); pan.pan.value = clamp(options.pan, -1, 1); gain.connect(pan).connect(sfxBus);
    } else gain.connect(sfxBus);
    const voice = { source, gain, pan, name };
    voices.add(voice);
    source.onended = () => { voices.delete(voice); source.disconnect(); gain.disconnect(); if (pan) pan.disconnect(); };
    source.start();
    return true;
  }

  function stop(requested) {
    const name = aliases[requested] || requested;
    if (disposed || !cues.has(name)) return 0;
    // Cancel both active voices and a cue still waiting for its first decode.
    // This prevents a quickly skipped intro from sounding later on the menu.
    cueRevisions.set(name, (cueRevisions.get(name) || 0) + 1);
    let stopped = 0;
    for (const voice of voices) {
      if (voice.name !== name) continue;
      ramp(voice.gain.gain, 0, 0.025);
      voice.source.stop(context.currentTime + 0.03);
      stopped++;
    }
    return stopped;
  }

  function onEvent(event) {
    const data = event.detail || {};
    director.onEvent(data);
    musicTick();
    if (data.type === 'hack') play('hack-' + (data.hackType || data.level || 1));
    else if (data.type === 'bonus') play(bonusCues[data.bonusId] || 'purchase');
    else if (data.type === 'ghost-save') play('ghost');
    else if (cues.has(data.type)) play(data.type);
  }
  const onState = event => setState(event.detail);
  const onGesture = () => { unlock(); };
  const onHover = event => {
    const button = event.target.closest && event.target.closest('button, [role="button"]');
    if (button && !button.disabled && !button.contains(event.relatedTarget)) play('hover');
  };
  function onVisibility() {
    director.setHidden(document.hidden);
    if (document.hidden && musicTimer !== null) { clearInterval(musicTimer); musicTimer = null; }
    if (!context || disposed) return;
    // A quick restore can arrive before the platform acknowledges suspend().
    // Serialize those acknowledgements and re-read visibility at each step;
    // otherwise a late suspend leaves the visible game silent until a click.
    visibilityTask = visibilityTask.then(async () => {
      if (!context || disposed) return;
      if (document.hidden && context.state === 'running') {
        suspendedByVisibility = true;
        await context.suspend();
      } else if (!document.hidden && suspendedByVisibility) {
        await context.resume();
        if (!document.hidden && context.state === 'running') suspendedByVisibility = false;
      }
      if (!disposed) onContextState();
    }).catch(() => { /* The next visibility change or gesture retries. */ });
    return visibilityTask;
  }

  function getDiagnostics() {
    let decodedBytes = 0, scoreDecodedBytes = 0;
    for (const [key, buffer] of buffers) {
      const size = buffer.length * buffer.numberOfChannels * 4;
      decodedBytes += size;
      if (tracks[key.replace(/^music-/, '')]) scoreDecodedBytes += size;
    }
    return { state: disposed ? 'disposed' : context ? context.state : 'locked', screen, risk: trace, musicVolume, sfxVolume,
      activeVoices: voices.size, voiceLimit: maxVoices, loops: [...loops.keys(), ...[...musicVoices].map(v => v.name)], cachedAssets: buffers.size,
      pendingAssets: pending.size, missingAssets: [...failed], decodedBytes,
      musicSource: 'neon-roguelike-soundtrack', musicBufferSeconds: 60, loopStartSeconds: 0, loopSeconds: 60,
      sampleRate: context ? context.sampleRate : null, scoreDecodedBytes, ownTimers: musicTimer === null ? 0 : 1,
      musicTrackVoices: musicVoices.size, musicTrackVoiceLimit: 2, maxMusicVoicesSeen, ambienceVoices: loops.size,
      currentTrack: transition && context.currentTime >= transition.when ? transition.to.name : currentMusic && currentMusic.name,
      pendingTrack: transition ? transition.to.name : desiredMusic && currentMusic && desiredMusic.key !== currentMusic.key ? desiredMusic.name : null,
      transitionCount, transition: transition ? { from: transition.from.name, to: transition.to.name, when: transition.when, end: transition.end, fade: transition.fade } : null,
      trackVoices: [...musicVoices].map(v => ({ name: v.name, key: v.key, startedAt: v.startedAt, offset: v.offset, loopStart: v.source.loopStart, loopEnd: v.source.loopEnd, level: v.level })),
      pausedOffsets: [...pausedOffsets].map(([key, offset]) => ({key, offset})),
      pace: director.getState() };
  }

  function dispose() {
    disposed = true;
    if (musicTimer !== null) { clearInterval(musicTimer); musicTimer = null; }
    director.setRunning(false);
    document.removeEventListener('risk:state', onState);
    document.removeEventListener('risk:event', onEvent);
    document.removeEventListener('risk:quit-state', musicTick);
    document.removeEventListener('pointerdown', onGesture);
    document.removeEventListener('keydown', onGesture);
    document.removeEventListener('pointerover', onHover);
    document.removeEventListener('visibilitychange', onVisibility);
    for (const loop of loops.values()) { loop.source.stop(); loop.source.disconnect(); loop.gain.disconnect(); }
    for (const voice of [...musicVoices]) retireMusic(voice);
    for (const voice of voices) { voice.source.stop(); voice.source.disconnect(); voice.gain.disconnect(); if (voice.pan) voice.pan.disconnect(); }
    voices.clear(); loops.clear(); buffers.clear(); cueRevisions.clear();
    currentMusic = null; transition = null; desiredMusic = null;
    pausedOffsets.clear();
    if (context) context.removeEventListener('statechange', onContextState);
    if (context && context.state !== 'closed') context.close().catch(() => {});
  }

  document.addEventListener('risk:state', onState);
  document.addEventListener('risk:event', onEvent);
  document.addEventListener('risk:quit-state', musicTick);
  document.addEventListener('pointerdown', onGesture, { passive: true });
  document.addEventListener('keydown', onGesture);
  document.addEventListener('pointerover', onHover, { passive: true });
  document.addEventListener('visibilitychange', onVisibility);
  window.RelayAudio = Object.freeze({ unlock, setVolumes, setState, play, stop, dispose, getDiagnostics });
})();

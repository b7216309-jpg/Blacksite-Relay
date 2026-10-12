/* Test-only passive tap of the actual final Web Audio graph. Install before
 * the first unlock. No playback, gain, routing, timer or game policy is changed. */
(() => {
  'use strict';
  if (window.SoundtrackOutputProbe) return;
  const nativeConnect = AudioNode.prototype.connect;
  const nativeDecode = AudioContext.prototype.decodeAudioData, decoded = [];
  AudioContext.prototype.decodeAudioData = function(...args) {
    return nativeDecode.apply(this,args).then(buffer=>{decoded.push(buffer);return buffer;});
  };
  const taps = [], tapped = new WeakSet();
  let recorder = null, chunks = [], disposed = false;
  AudioNode.prototype.connect = function(destination, ...args) {
    const result = nativeConnect.call(this, destination, ...args);
    if (!disposed && this.context.createMediaStreamDestination && destination === this.context.destination && !tapped.has(this)) {
      tapped.add(this);
      const analyser = this.context.createAnalyser();
      analyser.fftSize = 4096;
      const stream = this.context.createMediaStreamDestination();
      nativeConnect.call(this, analyser);
      nativeConnect.call(this, stream);
      taps.push({source:this,context:this.context,analyser,stream});
    }
    return result;
  };
  const latest = () => taps[taps.length - 1];
  function sample() {
    const t = latest();
    if (!t) return {ready:false,peak:0,rms:0,taps:taps.length};
    const data = new Float32Array(t.analyser.fftSize);
    t.analyser.getFloatTimeDomainData(data);
    let peak=0,squares=0;
    for(const x of data){peak=Math.max(peak,Math.abs(x));squares+=x*x;}
    return {ready:true,peak,rms:Math.sqrt(squares/data.length),contextTime:t.context.currentTime,contextState:t.context.state,taps:taps.length};
  }
  function begin() {
    const t=latest();
    if(!t)throw new Error('No final-output connection observed yet. Unlock first.');
    if(recorder?.state==='recording')throw new Error('A recording is already active.');
    const mimeType=['audio/webm;codecs=opus','audio/webm'].find(x=>MediaRecorder.isTypeSupported(x));
    if(!mimeType)throw new Error('No supported audio WebM recorder.');
    chunks=[];recorder=new MediaRecorder(t.stream.stream,{mimeType,audioBitsPerSecond:192000});
    recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};recorder.start();
    return {mimeType,start:t.context.currentTime};
  }
  function finish() {
    if(!recorder||recorder.state!=='recording')return Promise.reject(new Error('No recording is active.'));
    return new Promise((resolve,reject)=>{
      recorder.onerror=e=>reject(e.error||new Error('Recorder error'));
      recorder.onstop=()=>{const blob=new Blob(chunks,{type:recorder.mimeType});const reader=new FileReader();reader.onload=()=>resolve({dataURL:reader.result,bytes:blob.size,mimeType:blob.type,end:latest()?.context.currentTime});reader.onerror=()=>reject(reader.error);reader.readAsDataURL(blob);};recorder.stop();
    });
  }
  function dispose() {
    disposed=true;if(recorder?.state==='recording')recorder.stop();
    for(const t of taps){try{t.source.disconnect(t.analyser);t.source.disconnect(t.stream);}catch(_){}t.analyser.disconnect();t.stream.disconnect();for(const track of t.stream.stream.getTracks())track.stop();}
    taps.length=0;chunks=[];AudioNode.prototype.connect=nativeConnect;AudioContext.prototype.decodeAudioData=nativeDecode;
  }
  async function seam(index) {
    const buffer=decoded.filter(b=>b.duration>=59.99&&b.duration<=60.01)[index];
    if(!buffer)throw new Error('Missing score buffer');
    const ctx=new OfflineAudioContext(2,44100,44100),source=ctx.createBufferSource();
    source.buffer=buffer;source.loop=true;source.loopStart=0;source.loopEnd=60;source.connect(ctx.destination);source.start(0,59.5);
    const rendered=await ctx.startRendering();
    let peak=0,jump=0,adjacentPeak=0;
    for(let ch=0;ch<2;ch++){const data=rendered.getChannelData(ch);for(let i=0;i<data.length;i++){peak=Math.max(peak,Math.abs(data[i]));if(i)adjacentPeak=Math.max(adjacentPeak,Math.abs(data[i]-data[i-1]));}jump=Math.max(jump,Math.abs(data[22050]-data[22049]));}
    return {sampleRate:buffer.sampleRate,length:buffer.length,channels:buffer.numberOfChannels,duration:buffer.duration,renderedFrames:rendered.length,peak,jump,adjacentPeak};
  }
  window.SoundtrackOutputProbe=Object.freeze({sample,begin,finish,dispose,seam,diagnostics:()=>({taps:taps.length,decoded:decoded.length,recorderState:recorder?.state||'inactive',disposed,ownedTimers:0,ownedRAF:0})});
})();

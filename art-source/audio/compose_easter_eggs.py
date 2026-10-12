"""Original tiny mechanical/animal cues. No recorded or imported samples.
Run: python art-source/audio/compose_easter_eggs.py (numpy + FFmpeg).
"""
from pathlib import Path
import json, shutil, subprocess, wave
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'assets/audio'
MASTERS = Path(__file__).resolve().parent / 'easter-egg-masters'
SR = 44100
RNG = np.random.default_rng(160051)
FFMPEG = shutil.which('ffmpeg')
assert FFMPEG, 'FFmpeg is required'
OUT.mkdir(parents=True, exist_ok=True); MASTERS.mkdir(parents=True, exist_ok=True)

def env(t, attack=.015, release=.10):
    return np.minimum(1,t/attack) * np.minimum(1,np.maximum(0,(t[-1]-t)/release))
def tone(freq, duration, gain=.15, end=None):
    t=np.arange(round(duration*SR))/SR
    phase=2*np.pi*(freq*t+(0 if end is None else (end-freq)*t*t/(2*duration)))
    return np.sin(phase)*env(t)*gain
def combine(duration, parts):
    a=np.zeros(round(duration*SR))
    for at, samples in parts:
        start=round(at*SR); stop=min(len(a),start+len(samples)); a[start:stop]+=samples[:stop-start]
    return a
def knock():
    t=np.arange(round(.23*SR))/SR
    noise=RNG.normal(0,1,len(t)); smooth=np.convolve(noise,np.ones(9)/9,mode='same')
    return (.10*smooth+.17*np.sin(2*np.pi*185*t)+.04*np.sin(2*np.pi*740*t))*np.exp(-t*35)*np.minimum(1,t/.002)*env(t,.002,.03)

t=np.arange(round(1.65*SR))/SR
purr=(np.sin(2*np.pi*92*t)+.35*np.sin(2*np.pi*184*t))*(.6+.4*np.sin(2*np.pi*24*t)**2)*env(t,.16,.35)*.065
rustle=RNG.normal(0,1,round(.45*SR)); rustle=np.convolve(rustle,np.ones(7)/7,'same')*env(np.arange(len(rustle))/SR,.025,.15)*.055
sounds={
 'egg-rat':combine(1.1,[(0,tone(1700,.13,.07,2200)),(.2,tone(2050,.10,.05,1550)),(.46,knock()*.3),(.64,tone(740,.18,.07)),(.82,tone(880,.20,.07))]),
 'egg-cat':combine(1.8,[(0,purr),(1.42,tone(440,.08,.075)),(1.55,tone(660,.09,.065))]),
 'egg-snail':combine(1.0,[(0,rustle),(.35,tone(520,.26,.08,620)),(.65,tone(780,.28,.065))]),
 'egg-locker':combine(1.4,[(.1,knock()*.65),(.36,knock()*.6),(.66,tone(130,.32,.06,85)),(.93,rustle*.7)]),
 'egg-arcade':combine(1.45,[(i*.13,tone(f,.21,.06)) for i,f in enumerate([220,330,440,550,660,880])]+[(.91,tone(440,.43,.04))]),
 'egg-knock':knock()
}
manifest=[]
for name,a in sounds.items():
    a=np.clip(a,-.50,.50); stereo=np.stack([a,a],axis=1)
    pcm=(stereo*32767).round().astype('<i2'); wav=MASTERS/(name+'.wav')
    with wave.open(str(wav),'wb') as file:
        file.setnchannels(2); file.setsampwidth(2); file.setframerate(SR); file.writeframes(pcm.tobytes())
    subprocess.run([FFMPEG,'-v','error','-y','-i',str(wav),'-c:a','libvorbis','-q:a','5',str(OUT/('sfx-'+name+'.ogg'))],check=True)
    manifest.append({'name':name,'seconds':len(a)/SR,'peak':round(float(np.max(np.abs(a))),5),'rms':round(float(np.sqrt(np.mean(a*a))),5),'startZero':bool(np.max(np.abs(a[:1]))==0),'endZero':bool(np.max(np.abs(a[-1:]))<.0001)})
(MASTERS/'manifest.json').write_text(json.dumps({'provenance':'Original deterministic synthesis; no samples','sampleRate':SR,'channels':2,'pcmBits':16,'cues':manifest},indent=2)+'\n')
demo=combine(sum(len(a)/SR+.4 for a in sounds.values()),[]); at=0
for a in sounds.values(): demo[at:at+len(a)]=a; at+=len(a)+round(.4*SR)
with wave.open(str(MASTERS/'audition.wav'),'wb') as file:
    file.setnchannels(1);file.setsampwidth(2);file.setframerate(SR);file.writeframes((demo*32767).round().astype('<i2').tobytes())
print(json.dumps(manifest,indent=2))

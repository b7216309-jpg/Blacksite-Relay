"""Original procedural cyberpunk soundtrack. Requires Python 3 and numpy; ffmpeg for OGG."""
from pathlib import Path
import argparse, json, math, subprocess, wave, zipfile
import numpy as np

SR = 44100
SECONDS = 60
N = SR * SECONDS
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--output', type=Path, default=Path.cwd() / 'outputs' / 'neon_roguelike_soundtrack')
OUT = parser.parse_args().output.resolve()
OUT.mkdir(parents=True, exist_ok=True)
RNG = np.random.default_rng(481516)
CACHE = {}

def hz(midi):
    return 440 * 2 ** ((midi - 69) / 12)

def smooth(x, width):
    if width <= 1:
        return x
    c = np.concatenate(([0.], np.cumsum(x, dtype=np.float64)))
    return (c[np.minimum(np.arange(len(x))+1, len(x))] - c[np.maximum(np.arange(len(x))+1-width, 0)]) / width

def tone(note, duration, kind):
    key = (note, round(duration, 5), kind)
    if key in CACHE:
        return CACHE[key]
    release = {'bass': .065, 'arp': .14, 'lead': .19, 'pad': .65, 'bell': .9}[kind]
    t = np.arange(int((duration + release)*SR), dtype=np.float64) / SR
    f = hz(note)
    if kind == 'bass':
        # Resonant, gently overdriven analog-style bass with a solid sine fundamental.
        x = .9*np.sin(2*np.pi*f*t) + .24*np.sin(2*np.pi*2*f*t)
        for h in range(3, 13):
            x += .38/h * np.sin(2*np.pi*h*f*t+.08) * np.exp(-t*(5+h))
        x = np.tanh(1.35*x) * .76
        env = np.minimum(t/.006, 1) * (.66+.34*np.exp(-t*10))
    elif kind == 'arp':
        x = np.zeros_like(t)
        for h in range(1, min(15, int(14000/f))):
            x += (np.sin(np.pi*h*.28)/h) * np.sin(2*np.pi*h*f*t) * np.exp(-t*(3+h*.85))
        x *= .8
        env = np.minimum(t/.003, 1) * np.exp(-t*3.3)
    elif kind == 'lead':
        phase = 2*np.pi*f*t + .018*np.sin(2*np.pi*5.1*t)*np.minimum(t/.18, 1)
        x = np.zeros_like(t)
        for h in (1, 3, 5, 7, 9):
            if h*f < 14000:
                x += np.sin(h*phase)/(h**1.55)
        x = .64*x + .08*np.sin(phase*1.003)
        env = np.minimum(t/.012, 1) * (.72+.28*np.exp(-t*7))
    elif kind == 'pad':
        x = np.zeros_like(t)
        for cents, phase in [(-6, .2), (5, 1.3)]:
            for h in range(1, 7):
                x += np.sin(2*np.pi*f*2**(cents/1200)*h*t + phase)/(h**2.15)
        x *= .29*(.92+.08*np.sin(2*np.pi*.7*t))
        env = np.minimum(t/.28, 1)
    else:
        x = .6*np.sin(2*np.pi*f*t + 1.5*np.sin(2*np.pi*f*2*t)*np.exp(-t*8))
        x += .14*np.sin(2*np.pi*f*4*t)*np.exp(-t*10)
        env = np.minimum(t/.003, 1)*np.exp(-t*3)
    env *= np.where(t < duration, 1, np.maximum(0, 1-(t-duration)/release)**2)
    result = (x*env).astype(np.float32)
    CACHE[key] = result
    return result

def drum(kind, variant=0):
    key = ('drum', kind, variant)
    if key in CACHE:
        return CACHE[key]
    dur = {'kick': .42, 'snare': .24, 'clap': .19, 'hat': .075, 'open': .28, 'metal': .14}[kind]
    t = np.arange(int(dur*SR))/SR
    noise = RNG.uniform(-1, 1, len(t))
    high = noise-smooth(noise, 16)
    if kind == 'kick':
        phase = 2*np.pi*(46*t + (145-46)*.017*(1-np.exp(-t/.017)))
        x = np.sin(phase)*np.exp(-t*11) + .1*high*np.exp(-t*260)
        x = np.tanh(x*1.6)*.8
    elif kind == 'snare':
        x = .63*high*np.exp(-t*23) + .4*np.sin(2*np.pi*185*t)*np.exp(-t*35)
        x += .12*np.sin(2*np.pi*330*t)*np.exp(-t*50)
    elif kind == 'clap':
        env = sum(np.exp(-np.maximum(t-d, 0)*90)*(t>=d) for d in [0, .011, .023])
        x = .35*(noise-smooth(noise, 30))*env
    elif kind in ('hat', 'open'):
        x = high*.32*np.exp(-t*(75 if kind=='hat' else 16))
        x += sum(np.sin(2*np.pi*f*t) for f in [4231, 5873, 7321])*.018*np.exp(-t*40)
    else:
        x = .2*np.sin(2*np.pi*713*t)*np.sin(2*np.pi*1123*t)*np.exp(-t*38)
    x *= np.minimum(t/.0008, 1)*np.minimum((dur-t)/.008, 1)
    CACHE[key] = x.astype(np.float32)
    return CACHE[key]

class Song:
    def __init__(self, slug, title, bpm, mode, bars):
        self.slug, self.title, self.bpm, self.mode, self.bars = slug, title, bpm, mode, bars
        self.beat = 60/bpm
        self.buses = {k: np.zeros((N, 2), np.float32) for k in ['drums', 'bass', 'pad', 'arp', 'lead', 'fx']}
        self.kicks = []
        self.events = []

    def add(self, bus, sound, beat, volume=1, pan=0):
        start = round(beat*self.beat*SR) % N
        gain = np.array([np.cos((pan+1)*np.pi/4), np.sin((pan+1)*np.pi/4)], dtype=np.float32)*volume
        data = sound[:, None]*gain
        first = min(N-start, len(data))
        self.buses[bus][start:start+first] += data[:first]
        if first < len(data):
            self.buses[bus][:len(data)-first] += data[first:]

    def note(self, bus, note, beat, length, vol, pan=0, kind=None):
        self.add(bus, tone(note, length*self.beat, kind or bus), beat, vol, pan)
        self.events.append((bus, note, round(beat, 4), length, vol))

    def hit(self, kind, beat, vol=1, pan=0):
        self.add('drums', drum(kind, int(beat*4)%3), beat, vol, pan)
        if kind == 'kick':
            self.kicks.append(beat)

    def compose(self):
        # D minor family: Dm9 / Bbmaj7 / Fmaj9 / Csus2, with an A dominant turnaround.
        roots = [38, 34, 41, 36]
        chords = [[62,65,69,72,76], [58,62,65,69,72], [60,65,69,72,76], [60,62,67,70,74]]
        motifs = {
            'menu': [(0,81,.6), (1.5,76,.35), (2.5,74,.8)],
            'explore': [(0,74,.4), (.75,77,.25), (1.5,81,.5), (2.75,79,.3), (3.5,77,.3)],
            'combat': [(0,74,.32), (.5,74,.25), (1.25,77,.35), (2,81,.4), (3,79,.3), (3.5,77,.3)],
            'danger': [(0,86,.22), (.5,81,.22), (1,84,.3), (1.75,81,.22), (2.5,79,.3), (3.25,77,.35)]
        }
        for bar in range(self.bars):
            b = bar*4
            # Eight-bar harmonic phrases, compact four-bar turnarounds at the end.
            ci = (bar//2)%4
            root, chord = roots[ci], chords[ci]
            section = bar//8
            local = bar%8
            menu = self.mode=='menu'
            break_bar = (self.mode=='combat' and 16 <= bar < 20) or (self.mode=='danger' and 24 <= bar < 28)
            # Sustained stereo harmony. Retrigger every two bars, with releases wrapped across the loop.
            if bar%2==0:
                for j, n in enumerate(chord[:4] if not menu else chord):
                    self.note('pad', n-12, b, 7.7, .105 if menu else .065, (j-2)*.30)
            if menu:
                for pos, length in [(0,1.3), (2.5,.7)]:
                    self.note('bass', root, b+pos, length, .46)
                if bar%8 not in (6,7):
                    self.hit('kick', b, .64)
                    self.hit('kick', b+2.5, .42)
                self.hit('snare', b+2, .36)
                for k in [1,3,5,7]:
                    self.hit('hat', b+k*.5, .22 if k%4==1 else .14, .35)
            else:
                patterns = {
                    'explore': [(0,.65), (1.5,.35), (2,.5), (3.25,.4)],
                    'combat': [(0,.4), (.75,.25), (1.5,.3), (2,.4), (2.75,.3), (3.5,.3)],
                    'danger': [(0,.32), (.5,.3), (1.25,.24), (1.75,.22), (2,.3), (2.5,.3), (3.25,.25), (3.75,.18)]
                }
                for i, (pos, length) in enumerate(patterns[self.mode]):
                    n = root + (12 if i%4==3 else 0)
                    if local==7 and pos>=3:
                        n = 33 if self.mode=='danger' else root+7
                    self.note('bass', n, b+pos, length, .62 if not break_bar else .40)
                kicks = {'explore':[0,1.5,2.75], 'combat':[0,1,2,2.75], 'danger':[0,1,2,3]}[self.mode]
                if break_bar:
                    kicks = [0] if bar%2==0 else []
                for p in kicks:
                    self.hit('kick', b+p, .86)
                for p in ([2] if break_bar else [1,3]):
                    self.hit('snare', b+p, .65 if not break_bar else .38)
                    self.hit('clap', b+p+.025, .22, -.15)
                steps = 16 if self.mode=='danger' and not break_bar else 8
                for k in range(steps):
                    if break_bar and k%2==0:
                        continue
                    self.hit('hat', b+k*4/steps, (.28 if k%2 else .17)*(1-.12*(k%3)), .3 if k%2 else -.22)
                if not break_bar:
                    for p in [1.5,3.5]:
                        self.hit('open', b+p, .25, -.32)
                    if local in (3,7):
                        for j,p in enumerate([3.25,3.5,3.75]):
                            self.hit('snare', b+p, .17+j*.08, .13)
                        self.hit('metal', b+2.75, .25, -.45)
            # Rhythmic arpeggios leave deliberate rests for the lead and game sound effects.
            arp_step = 1 if menu else (.5 if self.mode=='explore' else .25)
            arp_indices = [0,2,1,3,2,4,1,3]
            count = round(4/arp_step)
            for k in range(count):
                if (menu and (bar%4==3 or k==3)) or (not menu and k%8 in [3,6]):
                    continue
                n = chord[arp_indices[(k+bar%2*2)%8]]
                if section%2 and k%4==2:
                    n += 12
                self.note('arp', n, b+k*arp_step, .18 if not menu else .32,
                          .11 if menu else (.10 if break_bar else .14), -.42 if k%2 else .42)
            # Call-and-response lead phrases; sparse in the menu, stronger in gameplay.
            lead_active = (bar%4==0 if menu else local in [0,1,3,4,5,7])
            if break_bar:
                lead_active = bar%2==0
            if lead_active:
                shift = [0,-2,0,-2][ci]
                for i,(pos,n,length) in enumerate(motifs[self.mode]):
                    if local in [1,5,7]:
                        n = [77,76,74,72,69,74][i%6] + (12 if self.mode=='danger' else 0)
                    else:
                        n += shift
                    if section%2 and i==2:
                        n += 12 if menu else -12
                    self.note('lead', n, b+pos, length, .14 if menu else .19, -.08,
                              'bell' if menu or break_bar else 'lead')
            if not menu and bar%8==6:
                for p,n in [(0,69),(1.5,72),(2.5,74)]:
                    self.note('lead', n, b+p, .42, .13, .22, 'bell')
            # Short noise transitions rather than an intro/outro fade.
            if local==7 and not menu:
                t = np.arange(round(self.beat*1.8*SR))/SR
                noise = RNG.normal(0,.1,len(t)).astype(np.float32)
                noise = noise-smooth(noise, 30)
                env = np.sin(np.linspace(0,np.pi/2,len(t)))**3
                noise *= env*np.minimum((len(t)-np.arange(len(t)))/(SR*.035),1)
                self.add('fx', noise, b+2.2, .22, .1)

    def render(self):
        self.compose()
        # Periodic sidechain control, including the kick preceding the loop boundary.
        duck = np.ones(N, np.float32)
        for b in self.kicks:
            st = round(b*self.beat*SR)%N
            size = int(.23*SR)
            curve = 1-.29*np.exp(-np.arange(size)/(SR*.065))
            ids = (st+np.arange(size))%N
            duck[ids] = np.minimum(duck[ids], curve)
        mix = self.buses['drums'].copy()
        mix += self.buses['bass']*duck[:,None]
        for bus in ['pad','arp','lead','fx']:
            dry = self.buses[bus]
            wet = np.zeros_like(dry)
            if bus in ['arp','lead']:
                for rep in range(1,5):
                    delay = round(self.beat*.75*rep*SR)
                    wet += np.roll(dry[:,::-1] if rep%2 else dry, delay, axis=0)*(.32**rep)
            # Circular stereo room taps preserve tails across every repeat.
            for j,sec in enumerate([.071,.113,.179,.263,.337,.431]):
                delayed = np.roll(dry[:,::-1] if j%2 else dry, round(sec*SR), axis=0)
                wet += delayed*(.07 if bus=='pad' else .027)*(1-j*.10)
            mix += (dry+wet)*duck[:,None]
        mix -= np.mean(mix, axis=0)
        # Remove subsonic DC and soften the very high end with a periodic FFT filter.
        freq = np.fft.rfftfreq(N,1/SR)
        response = (1-np.exp(-(freq/25)**4)) / np.sqrt(1+(freq/14500)**8)
        for ch in range(2):
            mix[:,ch] = np.fft.irfft(np.fft.rfft(mix[:,ch])*response, n=N).astype(np.float32)
        mix = (np.tanh(mix*1.10)/1.10).astype(np.float32)
        mix *= .88/np.max(np.abs(mix))
        # Match the boundary to the typical local sample slope without fading out music.
        edge_delta = mix[0]-mix[-1]
        width=256
        ramp = np.linspace(0,1,width,dtype=np.float32)**2
        mix[-width:] += ramp[:,None]*edge_delta[None,:]
        pcm = np.round(np.clip(mix,-1,1)*32767).astype('<i2')
        path = OUT / (self.slug+'.wav')
        with wave.open(str(path),'wb') as w:
            w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
        (OUT/(self.slug+'_score.json')).write_text(json.dumps({'title':self.title,'bpm':self.bpm,'bars':self.bars,'notes':self.events},indent=2))
        print(json.dumps({'file':path.name,'seconds':len(pcm)/SR,'bpm':self.bpm,'bars':self.bars,'peak_dbfs':float(20*np.log10(np.max(np.abs(mix)))),'rms_dbfs':float(20*np.log10(np.sqrt(np.mean(mix**2)))),'boundary_delta':(pcm[0].astype(int)-pcm[-1].astype(int)).tolist(),'finite':bool(np.isfinite(mix).all())}),flush=True)
        subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(path),'-c:a','libvorbis','-q:a','6','-metadata','title='+self.title,'-metadata','LOOPSTART=0','-metadata','LOOPEND='+str(N),str(OUT/(self.slug+'.ogg'))], check=True)
        return path

TRACKS = [
    ('01_neon_standby_96bpm','Neon Standby',96,'menu',24),
    ('02_backstreet_signal_112bpm','Backstreet Signal',112,'explore',28),
    ('03_chrome_pursuit_128bpm','Chrome Pursuit',128,'combat',32),
    ('04_redline_protocol_160bpm','Redline Protocol',160,'danger',40),
]
if __name__=='__main__':
    for spec in TRACKS:
        print('Rendering '+spec[1],flush=True)
        Song(*spec).render()
        CACHE.clear()
    print('All four tracks rendered.',flush=True)

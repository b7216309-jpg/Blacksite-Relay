"""Blacksite Relay — original sound effects and mechanical ambience for Risk_v2.

Rebuild with Python 3 + numpy and FFmpeg on PATH:
    python art-source/audio/compose.py

Every sound effect/ambience sound is synthesized here, without downloaded samples.
The game MUSIC is the user's restored track: run restore_original.py for it.
Former synthesized-score helper functions below are retained as unused authoring
history; the default entry point does not produce or install those score stems.
Masters are 44.1 kHz stereo 24-bit PCM; runtime files are Ogg Vorbis quality 5.
"""
from __future__ import annotations
import argparse
import json
import math
import shutil
import subprocess
import wave
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
SOURCE = Path(__file__).resolve().parent
MASTER = SOURCE / 'masters'
ASSETS = ROOT / 'assets' / 'audio'
SR = 44100
BPM = 96
BEAT = 60 / BPM
BAR = BEAT * 4
DURATION = BAR * 32
N = round(DURATION * SR)
TAU = 2 * np.pi
RNG = np.random.default_rng(0xB1AC0517)
FFMPEG = shutil.which('ffmpeg')
METADATA = {}


def clock(seconds):
    return np.arange(round(seconds * SR), dtype=np.float32) / SR


def hz(midi):
    return 440 * 2 ** ((midi - 69) / 12)


def envelope(length, attack=.008, release=.06, decay=None):
    t = np.arange(length, dtype=np.float32) / SR
    env = np.minimum(1, t / max(attack, 1 / SR))
    env *= np.minimum(1, (length - 1 - np.arange(length)) / (SR * max(release, 1 / SR)))
    if decay is not None:
        env *= np.exp(-t / decay)
    return np.clip(env, 0, 1).astype(np.float32)


def tone(midi, seconds, kind='pluck', velocity=1):
    t = clock(seconds)
    f = hz(midi)
    if kind == 'pad':
        out = np.zeros_like(t)
        for detune, weight in [(-.0018, .32), (0, .43), (.0021, .25)]:
            for h in range(1, 9):
                out += (weight / h ** 1.65) * np.sin(TAU * f * (1 + detune) * h * t + .28 * np.sin(TAU * .23 * t))
        out *= (.85 + .15 * np.sin(TAU * .18 * t))
        out *= envelope(len(t), .6, 1.1)
    elif kind == 'bass':
        phase = TAU * f * t
        out = .78 * np.sin(phase) + .24 * np.sin(phase * 2) * np.exp(-t * 3) + .11 * np.sin(phase * 3) * np.exp(-t * 5)
        out = np.tanh(out * 1.4) * envelope(len(t), .014, .10, seconds * .85)
    elif kind == 'arp':
        out = np.zeros_like(t)
        for h in range(1, 9):
            if f * h < SR * .42:
                out += np.sin(TAU * f * h * t) / h * np.exp(-t * (4 + h * 1.8))
        out *= envelope(len(t), .005, .05)
    elif kind == 'glass':
        out = np.sin(TAU * f * t + 1.8 * np.sin(TAU * f * 2 * t) * np.exp(-t * 10))
        out += .16 * np.sin(TAU * f * 3.002 * t) * np.exp(-t * 3)
        out *= envelope(len(t), .006, .10, seconds * .25)
    elif kind == 'edge':
        # Band-limited pulse with a moving harmonic brightness envelope.
        out = np.zeros_like(t)
        for h in range(1, 13, 2):
            if f * h < SR * .4:
                out += np.sin(TAU * f * h * t + .4 * np.sin(TAU * f * .5 * t)) / h * np.exp(-t * h * 1.8)
        out = np.tanh(out * 1.8) * envelope(len(t), .009, .065, seconds * .6)
    else:
        out = (np.sin(TAU * f * t) + .25 * np.sin(TAU * f * 2 * t) * np.exp(-t * 18)) * envelope(len(t), .004, .045, seconds * .22)
    return (out * velocity).astype(np.float32)


def colored_noise(seconds, low=100, high=7000, rng=RNG):
    n = round(seconds * SR)
    raw = rng.normal(size=n).astype(np.float32)
    freq = np.fft.rfftfreq(n, 1 / SR)
    mask = (1 - np.exp(-(freq / max(low, 1)) ** 4)) * np.exp(-(freq / high) ** 4)
    out = np.fft.irfft(np.fft.rfft(raw) * mask, n).astype(np.float32)
    return out / max(1e-6, float(np.sqrt(np.mean(out ** 2))))


def percussion(kind, accent=1):
    if kind == 'kick':
        t = clock(.42)
        freq = 43 + 93 * np.exp(-t * 32)
        phase = TAU * np.cumsum(freq) / SR
        x = np.sin(phase) * np.exp(-t * 10)
        x += .10 * RNG.normal(size=len(t)) * np.exp(-t * 230)
        x = np.tanh(x * 1.6) * envelope(len(t), .0015, .035)
    elif kind == 'snare':
        t = clock(.32)
        x = colored_noise(.32, 500, 9000) * np.exp(-t * 21) * .37
        x += np.sin(TAU * 177 * t) * np.exp(-t * 25) * .4
        x += np.sin(TAU * 318 * t) * np.exp(-t * 32) * .15
        x *= envelope(len(t), .001, .045)
    elif kind in ('hat', 'open-hat'):
        dur = .10 if kind == 'hat' else .30
        t = clock(dur)
        x = colored_noise(dur, 6000, 15500) * np.exp(-t * (52 if kind == 'hat' else 13))
        x *= envelope(len(t), .001, .045) * .20
    elif kind == 'metal':
        t = clock(.6)
        x = sum(np.sin(TAU * f * t) * np.exp(-t * d) for f, d in [(417, 14), (731, 22), (1228, 18), (2413, 27)]) * .13
        x += colored_noise(.6, 1900, 7000) * np.exp(-t * 40) * .08
        x *= envelope(len(t), .001, .10)
    elif kind == 'thud':
        t = clock(.65)
        x = np.sin(TAU * (37 * t + 5 * (1 - np.exp(-t * 12)))) * np.exp(-t * 8)
        x += colored_noise(.65, 70, 450) * np.exp(-t * 13) * .25
        x *= envelope(len(t), .003, .15)
    return (x * accent).astype(np.float32)


def empty(seconds=DURATION):
    return np.zeros((round(seconds * SR), 2), dtype=np.float32)


def add(out, wavelet, seconds, gain=1, pan=0, wrap=True):
    if wavelet.ndim == 1:
        pos = np.clip(pan, -1, 1)
        stereo = wavelet[:, None] * np.array([math.cos((pos + 1) * np.pi / 4), math.sin((pos + 1) * np.pi / 4)], dtype=np.float32)
    else:
        stereo = wavelet
    n = len(out)
    idx = round(seconds * SR)
    if wrap:
        idx %= n
        remaining = len(stereo)
        offset = 0
        while remaining:
            count = min(n - idx, remaining)
            out[idx:idx + count] += stereo[offset:offset + count] * gain
            offset += count
            remaining -= count
            idx = 0
    else:
        start = max(idx, 0)
        length = min(n - start, len(stereo) - max(-idx, 0))
        if length > 0:
            out[start:start + length] += stereo[max(-idx, 0):max(-idx, 0) + length] * gain


def space(x, wet=.22, circular=True):
    # Stereo early reflections plus diffuse, progressively darker delay tails.
    dry = x.copy()
    for delay, gain, cross in [(.043, .30, False), (.079, .22, True), (.137, .19, False), (.227, .15, True), (.391, .12, True), (.617, .08, False), (.9375, .065, True), (1.40625, .035, False)]:
        shift = round(delay * SR)
        reflection = np.roll(dry[:, ::-1] if cross else dry, shift, axis=0)
        if not circular:
            reflection[:shift] = 0
        x += reflection * (wet * gain)
    return x


def prepare(x, target_rms=.13, peak=.76):
    x -= np.mean(x, axis=0)
    x *= target_rms / max(1e-8, float(np.sqrt(np.mean(x ** 2))))
    # Gentle analog-style saturation rounds summed transients before peak gain.
    x = (np.tanh(x * 1.15) / 1.15).astype(np.float32)
    measured = float(np.max(np.abs(x)))
    if measured > peak:
        x *= peak / measured
    return x


def pcm24(path, x):
    quantized = np.round(np.clip(x, -.999999, .999999) * 8388607).astype('<i4')
    packed = quantized.view(np.uint8).reshape(-1, 4)[:, :3].tobytes()
    with wave.open(str(path), 'wb') as f:
        f.setnchannels(2)
        f.setsampwidth(3)
        f.setframerate(SR)
        f.writeframes(packed)


def export(name, x, loop=False, target=.13, peak=.76, runtime=True):
    x = prepare(x, target, peak)
    if not loop:
        # No sharp cut at the tail of reverbs, impact sweeps or stingers.
        fade = min(round(.10 * SR), len(x) // 8)
        x[:64] *= np.linspace(0, 1, 64, dtype=np.float32)[:, None]
        x[-fade:] *= np.linspace(1, 0, fade, dtype=np.float32)[:, None]
    master = MASTER / (name + '.wav')
    pcm24(master, x)
    if runtime:
        subprocess.run([FFMPEG, '-hide_banner', '-loglevel', 'error', '-y', '-i', str(master), '-c:a', 'libvorbis', '-q:a', '5', '-metadata', 'artist=Risk_v2 / Blacksite Relay', '-metadata', 'title=' + name, '-metadata', 'comment=Original procedural composition; reproducible source included.', str(ASSETS / (name + '.ogg'))], check=True)
    rms = float(np.sqrt(np.mean(x ** 2)))
    derivative = np.abs(np.diff(x, axis=0))
    seam = np.abs(x[0] - x[-1])
    entry = {
        'duration_seconds': round(len(x) / SR, 6), 'sample_rate': SR,
        'channels': 2, 'master_bit_depth': 24, 'loop': loop,
        'peak_dbfs': round(float(20 * np.log10(max(1e-9, np.max(np.abs(x))))), 3),
        'rms_dbfs': round(20 * np.log10(max(1e-9, rms)), 3),
        'clipped_samples': int(np.sum(np.abs(x) >= 1)),
        'seam_max_delta': round(float(np.max(seam)), 7),
        'sample_delta_p999': round(float(np.quantile(derivative, .999)), 7),
        'master_bytes': master.stat().st_size,
    }
    if runtime:
        entry['runtime_bytes'] = (ASSETS / (name + '.ogg')).stat().st_size
    METADATA[name] = entry
    print(name, entry['duration_seconds'], 's', entry['peak_dbfs'], 'dBFS peak', entry['rms_dbfs'], 'dBFS RMS', flush=True)
    return x


CHORDS = [([54, 57, 61, 64, 68], 30), ([50, 54, 57, 61, 64], 38), ([52, 57, 59, 61, 64], 33), ([52, 56, 59, 61, 66], 40)]
MELODIES = [[73, 76, 73, 69], [73, 69, 66, 64], [76, 73, 71, 69], [75, 71, 68, 66]]


def compose_calm():
    x = empty()
    for phrase in range(16):
        chord, bass = CHORDS[phrase % 4]
        time = phrase * BAR * 2
        for voice, midi in enumerate(chord):
            add(x, tone(midi, BAR * 2 + 1.15, 'pad'), time, .115 if voice < 4 else .045, (voice - 2) * .34)
        add(x, tone(bass, BAR * 2, 'bass'), time, .17)
        melody = MELODIES[phrase % 4]
        # The four eight-bar sections have a clear identity without a jarring
        # break when the 32-bar loop returns to its first chord.
        density = 2 if phrase // 4 in [0, 2] else 4
        for note in range(density):
            add(x, tone(melody[note], 1.8, 'glass'), time + (note * 1.75 + .5) * BEAT, .080, -.35 if note % 2 else .35)
        for beat in [0, 3, 4, 6.5]:
            add(x, tone(chord[int(beat) % 5] + 12, .9, 'pluck'), time + beat * BEAT, .04, math.sin(beat) * .55)
        if phrase % 4 == 3:
            add(x, percussion('metal'), time + BEAT * 7.5, .12, -.6)
    return space(x, .75)


def compose_menu():
    x = empty()
    for phrase in range(16):
        chord, bass = CHORDS[phrase % 4]
        time = phrase * BAR * 2
        for voice, midi in enumerate(chord):
            add(x, tone(midi, BAR * 2 + 1.25, 'pad'), time, .12 if voice < 4 else .03, (voice - 2) * .38)
        add(x, tone(bass, BAR * 2, 'bass'), time, .10)
        for note in [0, 2]:
            add(x, tone(MELODIES[phrase % 4][note], 2.7, 'glass'), time + (note * 2 + 1) * BEAT, .067, -.4 if note else .4)
    return space(x, 1.0)


def compose_pulse():
    x = empty()
    kick = percussion('kick')
    snare = percussion('snare')
    hats = [percussion('hat', .7), percussion('hat'), percussion('open-hat')]
    metal = percussion('metal')
    for bar in range(32):
        chord, bass = CHORDS[(bar // 2) % 4]
        time = bar * BAR
        section = bar // 8
        for beat in ([0, 1.75, 2, 3.5] if bar % 2 else [0, 1.5, 2.75]):
            add(x, kick, time + beat * BEAT, .40)
        for beat in [1, 3]:
            add(x, snare, time + beat * BEAT, .32, -.08)
        for eighth in range(8):
            add(x, hats[1 if eighth % 2 else 0], time + eighth * BEAT / 2, .38 if eighth % 2 else .28, .28 if eighth % 2 else -.22)
        if bar % 2:
            add(x, hats[2], time + 3.5 * BEAT, .28, .36)
            add(x, metal, time + 2.75 * BEAT, .13, -.55)
        for step, duration in [(0, .55), (1.5, .30), (2.5, .40), (3.5, .30)]:
            add(x, tone(bass + (12 if step == 3.5 and bar % 2 else 0), duration, 'bass'), time + step * BEAT, .35)
        order = [0, 2, 1, 3, 2, 4, 3, 1]
        for eighth, index in enumerate(order):
            if section == 0 and eighth in [3, 7]:
                continue
            midi = chord[index] + 12
            add(x, tone(midi, .33, 'arp'), time + (eighth / 2 + .025 * (eighth % 2)) * BEAT, .066 if eighth % 2 else .092, -.44 if eighth % 2 else .44)
        if bar % 8 == 7:
            for hit in [3, 3.5, 3.75]:
                add(x, snare, time + hit * BEAT, .09 + (hit - 3) * .06, (hit - 3.5) * .65)
    return space(x, .36)


def compose_critical():
    x = empty()
    kick = percussion('kick')
    metal = percussion('metal')
    thud = percussion('thud')
    hat = percussion('hat')
    for bar in range(32):
        chord, bass = CHORDS[(bar // 2) % 4]
        time = bar * BAR
        for beat in [0, 1, 2, 3]:
            add(x, kick, time + beat * BEAT, .3)
            add(x, tone(bass + 12, .28, 'edge'), time + (beat + .5) * BEAT, .18, .08 * (-1) ** beat)
        for step in range(16):
            if step in [0, 6, 8, 14]:
                continue
            midi = chord[[0, 2, 3, 2][step % 4]] + (12 if step % 8 > 3 else 0)
            add(x, tone(midi, .20, 'edge'), time + step * BEAT / 4, .075 if step % 2 else .12, -.48 if step % 2 else .48)
            if step % 2:
                add(x, hat, time + step * BEAT / 4, .19, -.4 if step % 4 == 1 else .4)
        for beat in [1.75, 3]:
            add(x, metal, time + beat * BEAT, .29, -.42 if beat < 2 else .42)
        if bar % 4 == 0:
            add(x, thud, time, .26)
        if bar % 8 == 7:
            t = clock(BEAT * 2)
            rise = colored_noise(BEAT * 2, 2200, 11000) * (t / t[-1]) ** 2 * envelope(len(t), .1, .03)
            add(x, rise, time + 2 * BEAT, .055, 0)
    return space(x, .28)


def compose_ambience():
    dur = 20
    x = empty(dur)
    t = clock(dur)
    # Frequencies and modulation complete an integer cycle in the 20 s loop.
    for channel in range(2):
        noise = colored_noise(dur, 70, 1450)
        fan = noise * (.14 + .028 * np.sin(TAU * .35 * t + channel))
        hum = .06 * np.sin(TAU * 50 * t + .04 * np.sin(TAU * .2 * t))
        hum += .026 * np.sin(TAU * 100 * t) + .014 * np.sin(TAU * 150 * t)
        whirr = .012 * np.sin(TAU * 397 * t + .1 * np.sin(TAU * .15 * t + channel))
        x[:, channel] = fan + hum + whirr
    for at, pan in [(2.2, -.8), (7.4, .7), (13.7, -.4), (17.4, .6)]:
        t1 = clock(1.8)
        hiss = colored_noise(1.8, 1200, 4300) * envelope(len(t1), .32, .65) * np.sin(np.pi * t1 / 1.8) ** 2
        add(x, hiss, at, .018, pan)
        add(x, percussion('metal'), at + .19, .014, pan)
    return space(x, .9)


def sweep(seconds, start, end, noise=.05):
    t = clock(seconds)
    f = start * (end / start) ** (t / seconds)
    phase = TAU * np.cumsum(f) / SR
    sig = np.sin(phase) + .23 * np.sin(phase * 2) + .08 * np.sin(phase * 3)
    sig += colored_noise(seconds, 600, 8500) * noise
    return (sig * envelope(len(t), .006, .13, seconds * .4)).astype(np.float32)


def cue_notes(notes, kind='glass', step=.10, duration=.5, gain=.24, total=None):
    x = empty(total or (duration + step * (len(notes) - 1) + .45))
    for i, midi in enumerate(notes):
        add(x, tone(midi, duration, kind), i * step, gain, (i / max(1, len(notes) - 1) - .5) * .55, False)
    return space(x, .8, False)


def compose_sfx():
    x = empty(.16)
    add(x, tone(90, .09, 'pluck'), 0, .18, 0, False)
    add(x, percussion('metal')[:round(.12 * SR)], .003, .18, -.06, False)
    export('sfx-click', x, target=.07, peak=.40)
    x = cue_notes([85], 'pluck', duration=.07, total=.15)
    export('sfx-hover', x, target=.045, peak=.30)
    export('sfx-purchase', cue_notes([66, 73, 78], step=.055, duration=.38), target=.11, peak=.58)
    x = cue_notes([54, 53], 'edge', step=.09, duration=.13, total=.48)
    export('sfx-denied', x, target=.10, peak=.55)
    x = empty(.42)
    add(x, tone(78, .23, 'arp'), 0, .18, -.25, False)
    add(x, tone(85, .18, 'glass'), .045, .1, .3, False)
    add(x, percussion('metal'), 0, .10, 0, False)
    export('sfx-hack-1', space(x, .32, False), target=.10, peak=.59)
    x = empty(.5)
    add(x, sweep(.23, 165, 830), 0, .18, -.18, False)
    add(x, tone(78, .27, 'arp'), .055, .2, .22, False)
    add(x, percussion('snare'), .005, .12, 0, False)
    export('sfx-hack-2', space(x, .38, False), target=.12, peak=.63)
    x = empty(.72)
    add(x, percussion('thud'), 0, .26, 0, False)
    add(x, sweep(.28, 780, 88, .30), .005, .17, -.1, False)
    add(x, percussion('metal'), .015, .5, .25, False)
    export('sfx-hack-3', space(x, .42, False), target=.14, peak=.70)
    export('sfx-node', cue_notes([66, 73, 78, 85], step=.072, duration=.55), target=.12, peak=.64)
    export('sfx-bypass-ready', cue_notes([78, 85, 78], step=.105, duration=.36), target=.10, peak=.57)
    export('sfx-minigame-success', cue_notes([66, 69, 73, 78, 85], step=.085, duration=.60), target=.13, peak=.68)
    x = cue_notes([66, 61, 54], 'edge', step=.095, duration=.26, total=.8)
    add(x, percussion('thud'), 0, .18, 0, False)
    export('sfx-minigame-fail', x, target=.12, peak=.64)
    x = empty(1.25)
    t = clock(.95)
    mist = colored_noise(.95, 1800, 7500) * envelope(len(t), .035, .50) * np.exp(-t * 2)
    add(x, mist, 0, .13, -.35, False)
    add(x, sweep(.6, 1800, 320), .025, .10, .35, False)
    add(x, tone(90, .65, 'glass'), .08, .12, .1, False)
    export('sfx-ghost', space(x, 1.1, False), target=.11, peak=.58)
    x = empty(1.20)
    add(x, sweep(.70, 110, 1760, .11), 0, .19, 0, False)
    for i in range(6):
        add(x, tone(54 + i * 5, .18, 'edge'), .075 * i, .15, -.45 + i * .18, False)
    export('sfx-overclock', space(x, .7, False), target=.13, peak=.68)
    x = empty(1.05)
    t = clock(.85)
    hiss = colored_noise(.85, 800, 6500) * envelope(len(t), .04, .32) * np.exp(-t * 2.5)
    add(x, hiss, 0, .13, -.2, False)
    add(x, sweep(.48, 620, 180), .08, .10, .3, False)
    export('sfx-cooler', space(x, .3, False), target=.10, peak=.57)
    export('sfx-insure', cue_notes([54, 61, 66], 'glass', step=.055, duration=.7), target=.11, peak=.60)
    export('sfx-gamble', cue_notes([78, 73, 81, 66, 85], 'arp', step=.055, duration=.3), target=.12, peak=.61)
    export('sfx-proxy', cue_notes([66, 78, 73, 85], 'pluck', step=.08, duration=.4), target=.11, peak=.60)
    x = cue_notes([54, 61, 66, 69, 73, 78, 85], 'glass', step=.095, duration=1.15, total=2.5)
    add(x, tone(30, 1.8, 'bass'), .15, .20, 0, False)
    for j, midi in enumerate([66, 69, 73, 78]):
        add(x, tone(midi, 1.5, 'pad'), .25, .12, -.6 + j * .4, False)
    export('sfx-transfer', space(x, .8, False), target=.14, peak=.70)
    x = empty(2.5)
    add(x, percussion('thud'), 0, .5, 0, False)
    add(x, sweep(.72, 1200, 39, .28), 0, .30, .1, False)
    for i, midi in enumerate([54, 53, 42, 30]):
        add(x, tone(midi, .62, 'edge'), i * .14, .21, (-1) ** i * .30, False)
    add(x, colored_noise(1.6, 130, 1300) * envelope(round(1.6 * SR), .01, 1.2), .25, .035, 0, False)
    export('sfx-bust', space(x, .95, False), target=.14, peak=.72)
    export('sfx-achievement', cue_notes([66, 73, 78, 81, 85], step=.11, duration=1.05, total=2.1), target=.13, peak=.69)
    x = cue_notes([54, 61, 66, 73, 78, 81, 85, 90], step=.14, duration=1.3, total=3.2)
    for j, midi in enumerate([54, 57, 61, 66]):
        add(x, tone(midi, 2.2, 'pad'), .4, .18, -.7 + j * .47, False)
    add(x, tone(30, 2.2, 'bass'), .4, .20, 0, False)
    export('sfx-prestige', space(x, .8, False), target=.14, peak=.72)
    x = empty(6)
    t = clock(3.8)
    noise = colored_noise(3.8, 150, 1900) * envelope(len(t), 2.2, 1.1)
    add(x, noise, 0, .06, 0, False)
    for i, midi in enumerate([54, 61, 66, 73]):
        add(x, tone(midi, 3.5, 'pad'), .3 + .2 * i, .17, -.65 + i * .43, False)
    add(x, percussion('thud'), 2.5, .65, 0, False)
    add(x, tone(30, 2.4, 'bass'), 2.5, .35, 0, False)
    add(x, tone(78, 1.5, 'glass'), 3.2, .20, .4, False)
    add(x, tone(85, 1.4, 'glass'), 3.5, .15, -.4, False)
    export('sfx-intro', space(x, 1.1, False), target=.12, peak=.67)


def compose_trailer(calm, pulse, critical, ambience):
    # 16 bars = 40 seconds; deliberate 5 / 10 / 10 / 10 / 5 second editorial arc.
    n = round(40 * SR)
    t = np.arange(n, dtype=np.float32) / SR
    pulse_gain = np.interp(t, [0, 5, 10, 25, 35, 38, 40], [0, .05, .52, .58, .65, .1, 0]).astype(np.float32)
    danger_gain = np.interp(t, [0, 15, 20, 30, 35, 36, 40], [0, 0, .18, .5, .60, .08, 0]).astype(np.float32)
    calm_gain = np.interp(t, [0, 2, 30, 35, 39, 40], [0, .65, .52, .5, .25, 0]).astype(np.float32)
    x = calm[:n] * calm_gain[:, None] + pulse[:n] * pulse_gain[:, None] + critical[:n] * danger_gain[:, None]
    x += np.tile(ambience, (2, 1))[:n] * .11
    for time in [5, 15, 25, 35]:
        add(x, percussion('thud'), time, .08, 0, False)
    for i, midi in enumerate([66, 73, 78, 85]):
        add(x, tone(midi, 2.5, 'glass'), 36 + .15 * i, .06, -.3 + i * .2, False)
    return export('trailer-score-40s', x, target=.18, peak=.86, runtime=False)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--sfx-only', action='store_true')
    args = parser.parse_args()
    if not FFMPEG:
        raise SystemExit('FFmpeg must be available on PATH (with libvorbis).')
    MASTER.mkdir(parents=True, exist_ok=True)
    ASSETS.mkdir(parents=True, exist_ok=True)
    # Preserve the exact RNG position used for the already-shipped sound effects
    # without generating any of the abandoned music. The old score consumed
    #485541 noise samples before ambience and114660 after it.
    RNG.normal(size=485541)
    if not args.sfx_only:
        export('music-ambience', compose_ambience(), loop=True, target=.09, peak=.55)
    else:
        RNG.normal(size=2187360)
    RNG.normal(size=114660)
    compose_sfx()
    manifest_path = SOURCE / 'audio-manifest.json'
    manifest = json.loads(manifest_path.read_text(encoding='utf-8')) if manifest_path.exists() else {'assets': {}}
    manifest.update({'title': 'Risk_v2 original soundtrack and Blacksite sound effects',
        'credits': 'Music retained from original Risk_V2 repository; composer unspecified. Blacksite sound effects and mechanical ambience synthesized for this project.',
        'master_format': '44.1 kHz stereo 24-bit PCM WAV', 'runtime_format': 'Ogg Vorbis'})
    manifest['assets'].update(METADATA)
    (SOURCE / 'audio-manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
    print('Complete:', len(METADATA), 'assets. Manifest:', SOURCE / 'audio-manifest.json', flush=True)


if __name__ == '__main__':
    main()

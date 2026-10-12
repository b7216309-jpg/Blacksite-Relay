"""Edit the accepted Neon tracks into a 40-second trailer music bed.

Python 3 + NumPy + FFmpeg. No synthesis, pitch/tempo shift, or source overwrite.
Usage: python edit-trailer-music.py --output PATH
Defaults to the shipped OGG files. --masters PATH selects supplied WAV masters.
--ffmpeg PATH overrides ffmpeg-static from the repository's npm dependencies.
"""
import argparse
from fractions import Fraction
import hashlib
import json
from pathlib import Path
import subprocess
import wave

import numpy as np

SR = 44100
FRAMES = 40 * SR
CROSSFADE = 0.25


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def frame(seconds):
    return round(seconds * SR)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    repo = Path(__file__).resolve().parents[3]
    parser.add_argument('--masters', type=Path)
    parser.add_argument('--manifest', type=Path, default=Path(__file__).with_name('manifest.json'))
    parser.add_argument('--ffmpeg', type=Path)
    parser.add_argument('--output', required=True, type=Path)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    manifest = json.loads(args.manifest.read_text(encoding='utf-8'))
    ffmpeg = None
    if not args.masters:
        ffmpeg = str(args.ffmpeg) if args.ffmpeg else subprocess.check_output(
            ['node', '-p', "require('ffmpeg-static')"], cwd=repo, text=True).strip()
    sources, source_report = {}, []
    for track in manifest['tracks']:
        if args.masters:
            source = args.masters / track['masterWav']['file']
            digest = sha256(source)
            assert digest == track['masterWav']['sha256'], f'Source master changed: {source.name}'
            with wave.open(str(source), 'rb') as wav:
                assert (wav.getframerate(), wav.getnchannels(), wav.getsampwidth(), wav.getnframes()) == (SR, 2, 2, 60 * SR)
                samples = np.frombuffer(wav.readframes(60 * SR), dtype='<i2').reshape(-1, 2).astype(np.float64) / 32768
        else:
            source = repo / track['runtimeFile']
            digest = sha256(source)
            assert digest == track['sha256'], f'Shipped soundtrack changed: {source.name}'
            raw = subprocess.check_output([ffmpeg, '-v', 'error', '-i', str(source),
                                           '-f', 'f32le', '-ar', str(SR), '-ac', '2', 'pipe:1'])
            samples = np.frombuffer(raw, dtype='<f4').reshape(-1, 2).astype(np.float64)
        assert samples.shape == (60 * SR, 2) and np.isfinite(samples).all()
        sources[track['key']] = samples
        source_report.append({'file': source.name, 'sha256': digest, 'bpm': track['bpm'], 'unmodified': True})

    # The incoming score starts at a source downbeat. Each outgoing gameplay
    # segment completes an exact number of bars before the 250 ms tail overlap.
    # Offset four bars into the first/last gameplay scores to finish their phrase.
    early = Fraction(5)
    middle = early + Fraction(4 * 240, 112)
    critical = middle + Fraction(8 * 240, 128)
    outro = critical + Fraction(4 * 240, 160)
    clips = [
        ('neon-standby', 96, Fraction(0), early, Fraction(0), 0.9495 * 0.33, 2),
        ('backstreet-signal', 112, early, middle, Fraction(4 * 240, 112), 0.7482 * 0.62, 4),
        ('chrome-pursuit', 128, middle, critical, Fraction(0), 0.7907 * 0.65, 8),
        ('redline-protocol', 160, critical, outro, Fraction(4 * 240, 160), 0.6926 * 0.68, 4),
        ('neon-standby', 96, outro, Fraction(40), Fraction(0), 0.9495 * 0.30, None),
    ]
    mix = np.zeros((FRAMES, 2), dtype=np.float64)
    timeline = []
    for index, (key, bpm, start, boundary, source_start, gain, bars) in enumerate(clips):
        begin = frame(start)
        end = min(FRAMES, frame(boundary) + (frame(CROSSFADE) if index < len(clips) - 1 else 0))
        count = end - begin
        source_begin = frame(source_start)
        audio = sources[key][source_begin:source_begin + count].copy()
        assert len(audio) == count
        envelope = np.ones(count)
        fade_in = min(count, frame(0.5 if index == 0 else CROSSFADE))
        envelope[:fade_in] *= np.sin(np.linspace(0, np.pi / 2, fade_in))
        fade_out = min(count, frame(1.4 if index == len(clips) - 1 else CROSSFADE))
        envelope[-fade_out:] *= np.cos(np.linspace(0, np.pi / 2, fade_out))
        mix[begin:end] += audio * (gain * envelope[:, None])
        timeline.append({'track': key, 'bpm': bpm, 'startSeconds': begin / SR,
                         'nextDownbeatSeconds': float(boundary), 'endSeconds': end / SR,
                         'sourceStartSeconds': source_begin / SR, 'completeBars': bars,
                         'gain': gain, 'fadeInSeconds': fade_in / SR, 'fadeOutSeconds': fade_out / SR})

    assert np.isfinite(mix).all()
    peak = float(np.abs(mix).max())
    assert peak < 0.8, f'Music bed must leave room for gameplay cues: {peak}'
    # 24-bit stereo PCM preserves envelope precision beneath the 16-bit inputs.
    pcm = np.rint(mix * 8388607).astype('<i4')
    packed = np.stack((pcm & 255, (pcm >> 8) & 255, (pcm >> 16) & 255), axis=-1).astype(np.uint8)
    output = args.output / 'trailer-music-40s.wav'
    with wave.open(str(output), 'wb') as wav:
        wav.setnchannels(2)
        wav.setsampwidth(3)
        wav.setframerate(SR)
        wav.writeframes(packed.tobytes())
    windows = []
    for start, end, label in [(0, 5, 'opening'), (5.25, 13.5, 'early'), (14, 28, 'middle'),
                              (29, 34.5, 'critical'), (35, 38.6, 'end-card')]:
        samples = mix[frame(start):frame(end)]
        windows.append({'label': label, 'rmsDbFS': float(20 * np.log10(np.sqrt(np.mean(samples ** 2)))),
                        'peakDbFS': float(20 * np.log10(np.abs(samples).max()))})
    joins = []
    for boundary in [early, middle, critical, outro]:
        n = frame(boundary)
        local = mix[n-frame(0.5):n+frame(0.5)]
        joins.append({'seconds': n/SR, 'joinDelta': float(np.abs(mix[n]-mix[n-1]).max()),
                      'localMaxAdjacentDelta': float(np.abs(np.diff(local, axis=0)).max())})
    report = {'passed': True, 'subjectiveListening': False,
              'method': 'Deterministic sample-index edit of hash-verified accepted tracks; preserved tempo and pitch; equal-power 250 ms transitions; independent opening/end envelopes.',
              'sourceMasterManifest': 'art-source/audio/neon-soundtrack/manifest.json',
              'sourceFormat': 'supplied WAV masters' if args.masters else 'shipped OGG files decoded by FFmpeg',
              'sources': source_report, 'timeline': timeline, 'frames': FRAMES,
              'sampleRate': SR, 'channels': 2, 'bitsPerSample': 24, 'durationSeconds': 40,
              'finite': True, 'peakDbFS': float(20*np.log10(peak)), 'clippedSamples': 0,
              'firstSample': mix[0].tolist(), 'lastSample': mix[-1].tolist(), 'windows': windows,
              'joins': joins, 'output': output.name, 'sha256': sha256(output),
              'note': 'This trailer montage compresses musical progression; runtime stage gates remain unchanged. Gameplay sound effects are mixed separately from recorded event timestamps.'}
    (args.output/'trailer-music-40s.json').write_text(json.dumps(report, indent=2)+'\n', encoding='utf-8')
    print(json.dumps({'passed': True, 'output': str(output), 'durationSeconds': 40,
                      'peakDbFS': report['peakDbFS'], 'sha256': report['sha256']}))


if __name__ == '__main__':
    main()

"""Restore the user's original soundtrack with a gapless, phrase-aligned loop.

python art-source/audio/restore_original.py

Requirements: Python 3, NumPy, FFmpeg/libvorbis on PATH. The MP3 from the original
repository is copied byte-for-byte to original/backgroundloop.mp3. Its decoded
music lasts 225 s (120 bars at the signal-inferred 128 BPM), followed by 3.75 s of
near-silence. We retain the first playback from t=0 and bake a four-bar (7.5 s)
equal-power tail-to-head transition into t=217.5..225. Web Audio subsequently loops
from t=7.5 to225, so the transition meets the untouched next sample of the opening.
No pitch shift, time stretch, recomposition or generated musical layers are used.
"""
from pathlib import Path
import hashlib
import json
import shutil
import subprocess
import wave
import numpy as np

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
ORIGINAL = HERE / 'original' / 'backgroundloop.mp3'
SOURCE = ROOT / 'son' / 'backgroundloop.mp3'
if not SOURCE.exists():
    SOURCE = ORIGINAL
MASTERS = HERE / 'masters'
ASSETS = ROOT / 'assets' / 'audio'
SR = 44100
END = 225.0
OVERLAP = 7.5
GAIN = .85

def decode(path):
    output = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(path), '-f', 'f32le', '-ac', '2', '-ar', str(SR), '-'], check=True, capture_output=True).stdout
    return np.frombuffer(output, dtype='<f4').reshape(-1, 2)

def write_pcm24(path, x):
    q = np.round(x * 8388607).astype('<i4')
    with wave.open(str(path), 'wb') as f:
        f.setnchannels(2); f.setsampwidth(3); f.setframerate(SR)
        f.writeframes(q.view(np.uint8).reshape(-1, 4)[:, :3].tobytes())

def db(value):
    return round(float(20 * np.log10(max(1e-10, float(value)))), 4)

def metadata(path, x, loop=False, runtime=None):
    info = {'duration_seconds': len(x) / SR, 'sample_rate': SR, 'channels': 2, 'master_bit_depth': 24,
        'loop': loop, 'peak_dbfs': db(np.max(np.abs(x))), 'rms_dbfs': db(np.sqrt(np.mean(x ** 2))),
        'clipped_samples': int(np.sum(np.abs(x) >= 1)), 'master_bytes': path.stat().st_size}
    if runtime: info['runtime_bytes'] = runtime.stat().st_size
    return info

def main():
    ORIGINAL.parent.mkdir(parents=True, exist_ok=True)
    MASTERS.mkdir(parents=True, exist_ok=True)
    ASSETS.mkdir(parents=True, exist_ok=True)
    if SOURCE.resolve() != ORIGINAL.resolve():
        shutil.copy2(SOURCE, ORIGINAL)
    source_hash = hashlib.sha256(SOURCE.read_bytes()).hexdigest()
    assert source_hash == hashlib.sha256(ORIGINAL.read_bytes()).hexdigest()
    source = decode(SOURCE)
    end_n, overlap_n = round(END * SR), round(OVERLAP * SR)
    assert len(source) >= end_n + SR * 3, 'Source changed: inspect its arrangement before rebuilding.'
    assert np.sqrt(np.mean(source[end_n:] ** 2)) < .001, 'Expected original trailing silence is no longer present.'
    loop = source[:end_n].copy()
    phase = np.linspace(0, np.pi / 2, overlap_n, endpoint=False, dtype=np.float32)
    loop[-overlap_n:] = source[end_n - overlap_n:end_n] * np.cos(phase)[:, None] + source[:overlap_n] * np.sin(phase)[:, None]
    loop *= GAIN
    assert np.max(np.abs(loop)) < .95
    master = MASTERS / 'music-original.wav'
    runtime = ASSETS / 'music-original.ogg'
    write_pcm24(master, loop)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(master), '-c:a', 'libvorbis', '-q:a', '6', '-metadata', 'title=Risk_v2 original soundtrack — seamless game loop', '-metadata', 'comment=Derived from original repository son/backgroundloop.mp3; original composer unspecified in provided source. Four-bar tail transition, no recomposition.', str(runtime)], check=True)
    decoded = decode(runtime)
    assert len(decoded) == end_n and np.max(np.abs(decoded)) < 1
    loop_start_n = overlap_n
    seam = float(np.max(np.abs(decoded[-1] - decoded[loop_start_n])))
    natural_p999 = float(np.quantile(np.abs(np.diff(decoded, axis=0)), .999))
    assert seam < max(.02, natural_p999 * 1.5), 'Unexpected output seam discontinuity'

    # Keep the familiar original opening/build for the film; only trim/fade it.
    # The original arrangement's main entrance at15s matches the film's escalation.
    trailer = source[:40 * SR].copy() * GAIN
    opening_n, ending_n = round(.20 * SR), round(3.75 * SR)
    trailer[:opening_n] *= np.sin(np.linspace(0, np.pi / 2, opening_n))[:, None]
    trailer[-ending_n:] *= np.cos(np.linspace(0, np.pi / 2, ending_n))[:, None]
    trailer_master = MASTERS / 'trailer-original-music-40s.wav'
    write_pcm24(trailer_master, trailer)

    report = {'music_direction': 'Original repository soundtrack restored; synthesized score stems unused.',
        'source_file': 'son/backgroundloop.mp3', 'preserved_original': 'art-source/audio/original/backgroundloop.mp3',
        'source_sha256': source_hash, 'original_copy_identical': True,
        'source_duration_seconds': len(source) / SR, 'source_peak_dbfs': db(np.max(np.abs(source))),
        'source_samples_at_or_above_1': int(np.sum(np.abs(source) >= 1)), 'source_rms_dbfs': db(np.sqrt(np.mean(source ** 2))),
        'trailing_near_silence_seconds_removed': len(source) / SR - END, 'trailing_region_rms_dbfs': db(np.sqrt(np.mean(source[end_n:] ** 2))),
        'pulse_bpm_inferred_from_signal': 128, 'active_arrangement_bars_at_inferred_tempo': 120,
        'equal_power_overlap_seconds': OVERLAP, 'overlap_bars_at_inferred_tempo': 4,
        'first_playback_start_seconds': 0, 'first_playback_duration_seconds': END,
        'loop_start_seconds': OVERLAP, 'loop_end_seconds': END, 'repeat_period_seconds': END - OVERLAP,
        'gain_applied': GAIN, 'pitch_or_tempo_change': False,
        'runtime_file': 'assets/audio/music-original.ogg', 'runtime_decoded_frames': len(decoded),
        'runtime_peak_dbfs': db(np.max(np.abs(decoded))), 'runtime_seam_delta': seam, 'normal_sample_delta_p999': natural_p999,
        'trailer_master': 'art-source/audio/masters/trailer-original-music-40s.wav',
        'trailer_source_region_seconds': [0, 40], 'trailer_fade_in_seconds': .20, 'trailer_fade_out_seconds': 3.75,
        'provenance': 'Retained from b7216309-jpg/Risk_V2 baseline ae6411e8. The provided repository does not identify the original music composer; no new authorship is claimed for it.',
        'listening_review': 'No subjective listening review performed; waveform, timing, decoding and real playback checks are reported separately.'}
    (HERE / 'original-music-validation.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    manifest_path = HERE / 'audio-manifest.json'
    manifest = json.loads(manifest_path.read_text(encoding='utf-8')) if manifest_path.exists() else {'assets': {}}
    for name in ['music-calm', 'music-pulse', 'music-critical', 'music-menu', 'trailer-score-40s']:
        manifest['assets'].pop(name, None)
    for obsolete in ['bpm', 'key', 'bars', 'loop_seconds', 'seed']:
        manifest.pop(obsolete, None)
    manifest.update({'title': 'Risk_v2 original soundtrack and Blacksite sound effects',
        'credits': 'Music retained from original Risk_V2 repository; composer unspecified. Blacksite sound effects and mechanical ambience synthesized for this project.',
        'runtime_format': 'Ogg Vorbis (original music quality 6; ambience/SFX quality 5)',
        'original_music': report})
    info = metadata(master, loop, True, runtime)
    info.update({'loop_start_seconds': OVERLAP, 'loop_end_seconds': END, 'repeat_period_seconds': END - OVERLAP})
    manifest['assets']['music-original'] = info
    manifest['assets']['trailer-original-music-40s'] = metadata(trailer_master, trailer)
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding='utf-8')
    print(json.dumps(report, indent=2))

if __name__ == '__main__':
    main()

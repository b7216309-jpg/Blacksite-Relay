"""Read-only signal analysis of the soundtrack retained from the original game."""
from pathlib import Path
import json, subprocess
import numpy as np
ROOT = Path(__file__).resolve().parents[2]
source = ROOT / 'son' / 'backgroundloop.mp3'
raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(source), '-f', 'f32le', '-ac', '2', '-ar', '44100', '-'], check=True, capture_output=True).stdout
x = np.frombuffer(raw, dtype='<f4').reshape(-1, 2)
sr = 44100
duration = len(x) / sr
def db(v): return round(float(20 * np.log10(max(1e-10, float(v)))), 3)
block = round(sr * .25)
nblocks = len(x) // block
levels = np.sqrt(np.mean(x[:nblocks * block].reshape(nblocks, block, 2) ** 2, axis=(1, 2)))
active = np.flatnonzero(levels > 10 ** (-48 / 20))
mono = np.mean(x, axis=1)[::4]
step = round(sr / 4 * .01)
count = len(mono) // step
energy = np.sqrt(np.mean(mono[:count * step].reshape(count, step) ** 2, axis=1))
onset = np.maximum(0, np.diff(energy))
onset -= np.mean(onset)
acf = np.array([np.dot(onset[:-lag], onset[lag:]) for lag in range(20, 120)])
tempo = [{'bpm': round(60 / ((int(i) + 20) * step / (sr / 4)), 2), 'correlation': round(float(acf[i]), 3)} for i in np.argsort(acf)[-12:][::-1]]
sections = []
for start in np.arange(0, duration, 5):
    region = x[round(start * sr):min(len(x), round((start + 5) * sr))]
    sections.append({'start': float(start), 'rms_dbfs': db(np.sqrt(np.mean(region ** 2))), 'peak_dbfs': db(np.max(np.abs(region)))})
report = {'source': 'son/backgroundloop.mp3', 'decoded_duration_seconds': duration, 'decoded_frames': len(x), 'sample_rate': sr, 'channels': 2,
    'peak_dbfs': db(np.max(np.abs(x))), 'rms_dbfs': db(np.sqrt(np.mean(x ** 2))), 'samples_at_or_above_1': int(np.sum(np.abs(x) >= 1)),
    'first_active_quarter_second': float(active[0] * .25), 'last_active_quarter_second_end': float((active[-1] + 1) * .25),
    'raw_seam_delta': float(np.max(np.abs(x[-1] - x[0]))), 'tempo_candidates_from_energy_only': tempo,
    'first_8_seconds_quarter_second_rms_dbfs': [db(v) for v in levels[:32]],
    'last_8_seconds_quarter_second_rms_dbfs': [db(v) for v in levels[-32:]], 'sections_5_seconds': sections}
print(json.dumps(report, indent=2))

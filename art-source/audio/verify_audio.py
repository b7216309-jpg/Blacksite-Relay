"""Validate PCM masters, runtime decode, musical transport and loop continuity."""
from pathlib import Path
import json
import subprocess
import wave
import numpy as np

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
manifest = json.loads((HERE / 'audio-manifest.json').read_text(encoding='utf-8'))
results = []

for name, asset in manifest['assets'].items():
    wav = HERE / 'masters' / (name + '.wav')
    with wave.open(str(wav)) as f:
        assert f.getnchannels() == 2 and f.getsampwidth() == 3 and f.getframerate() == 44100
        duration = f.getnframes() / f.getframerate()
        assert abs(duration - asset['duration_seconds']) < .000001
    assert asset['clipped_samples'] == 0
    assert asset['peak_dbfs'] < -1
    check = {'asset': name, 'master_valid': True}
    ogg = ROOT / 'assets' / 'audio' / (name + '.ogg')
    if ogg.exists():
        decoded = subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-i', str(ogg), '-f', 'f32le', '-acodec', 'pcm_f32le', '-'], check=True, capture_output=True)
        pcm = np.frombuffer(decoded.stdout, dtype='<f4').reshape(-1, 2)
        assert np.isfinite(pcm).all()
        assert np.max(np.abs(pcm)) < 1, name + ': encoded overshoot'
        assert abs(len(pcm) / 44100 - duration) < .03, name + ': duration drift'
        check['runtime_peak_dbfs'] = round(float(20 * np.log10(np.max(np.abs(pcm)))), 3)
        check['decoded_seconds'] = round(len(pcm) / 44100, 6)
        if asset['loop']:
            # Encoder trim must not change the authored loop boundary. Original
            # music repeats from7.5s after its first complete225s playback.
            assert len(pcm) == round(duration * 44100), name + ': loop sample length'
            loop_start = round(asset.get('loop_start_seconds', 0) * 44100)
            delta = float(np.max(np.abs(pcm[loop_start] - pcm[-1])))
            p999 = float(np.quantile(np.abs(np.diff(pcm, axis=0)), .999))
            check['decoded_seam_delta'] = round(delta, 7)
            check['decoded_delta_p999'] = round(p999, 7)
            # Natural neighboring samples need not be equal. The seam should
            # remain comfortably inside ordinary transient differences.
            assert delta < max(.02, p999 * 2), name + ': anomalous loop discontinuity'
            check['loop_seam_valid'] = True
    results.append(check)

assert manifest['assets']['music-original']['duration_seconds'] == 225
assert manifest['assets']['music-original']['loop_start_seconds'] == 7.5
assert manifest['assets']['music-original']['repeat_period_seconds'] == 217.5
assert manifest['assets']['music-ambience']['duration_seconds'] == 20
report = {'status': 'passed', 'checked_assets': len(results), 'runtime_assets': sum('decoded_seconds' in x for x in results),
          'listening_review': 'Not performed: no audio listening/perception tool is available in this agent session. Objective decode, waveform, peak and loop checks completed.',
          'results': results}
(HERE / 'audio-validation.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
print(json.dumps(report, indent=2))

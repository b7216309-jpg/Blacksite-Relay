"""Check immutable bright title pixels in every settled late end-card frame."""
import json
import subprocess
from pathlib import Path
import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
VERSION = json.loads((ROOT / 'package.json').read_text(encoding='utf-8'))['version']
OUTPUT = ROOT.parents[1] / 'outputs' / ('Blacksite-Relay-' + VERSION)
ffmpeg = ROOT / 'node_modules' / 'ffmpeg-static' / 'ffmpeg.exe'
video = OUTPUT / 'Blacksite-Relay-Trailer.mp4'
# Same settled title position at 36s; only the room behind it changes.
reference = np.array(Image.open(HERE / 'final-review' / '0036.png').convert('RGB'))[270:760,100:660].astype(np.int16)
mask = (reference.min(2) > 170) | ((reference[:,:,0] > 180) & (reference[:,:,1] > 140) & (reference[:,:,2] > 50))
command = [str(ffmpeg), '-hide_banner', '-loglevel', 'error', '-i', str(video), '-ss', '35.6', '-t', '3.6', '-vf', 'crop=560:490:100:270', '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:1']
result = subprocess.run(command, capture_output=True, check=True, creationflags=subprocess.CREATE_NO_WINDOW)
size = 560 * 490 * 3
if len(result.stdout) % size:
    raise RuntimeError('The title scan did not return complete RGB frames.')
frames = np.frombuffer(result.stdout, dtype=np.uint8).reshape(-1, 490, 560, 3)
checks = []
for i, frame in enumerate(frames):
    # Allow normal video edge quantization, reject missing bright glyph regions.
    missing = mask & (np.abs(frame.astype(np.int16) - reference).max(2) > 60)
    fraction = float(missing.sum() / mask.sum())
    checks.append({'seconds': round(35.6 + i / 30, 6), 'changedBrightPixels': int(missing.sum()), 'fraction': fraction})
if len(checks) != 108:
    raise RuntimeError('Expected108 settled end-card frames.')
maximum = max(check['fraction'] for check in checks)
if maximum > .015:
    raise RuntimeError('An end-card title frame lost bright glyph regions: ' + str(maximum))
report = {'version': VERSION, 'video': video.name, 'frames': len(checks), 'startSeconds': 35.6, 'endExclusiveSeconds': 39.2, 'brightReferencePixels': int(mask.sum()), 'maximumChangedPixelFraction': maximum, 'threshold': .015, 'result': 'passed', 'checks': checks}
for path in [HERE / 'title-continuity.json', OUTPUT / 'verification' / 'title-continuity.json', ROOT / 'art-source' / 'trailer' / 'title-continuity.json']:
    path.write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
print(json.dumps({key: value for key, value in report.items() if key != 'checks'}))

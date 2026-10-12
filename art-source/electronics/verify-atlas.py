"""Inspect exported electronics registration and hard patch alpha without editing art."""
import json
import sys
from pathlib import Path
import numpy as np
from PIL import Image

directory = Path(sys.argv[1]).resolve()
metadata = json.loads((directory / 'intro-electronics.json').read_text(encoding='utf-8'))
pixels = np.array(Image.open(directory / metadata['image']).convert('RGBA'))
if pixels.shape != (1680, 5040, 4):
    raise RuntimeError('Expected the 12 × 6 atlas of 420 × 280 native frames.')
alpha_values = np.unique(pixels[:, :, 3]).tolist()
if alpha_values != [0, 255]:
    raise RuntimeError('Source-backed display patches must have hard 0/255 alpha.')
checks = []
for frame in metadata['frames']:
    x, y, w, h = [frame[key] for key in ['x', 'y', 'w', 'h']]
    alpha = pixels[y:y+h, x:x+w, 3]
    rows, columns = np.nonzero(alpha)
    if not len(rows):
        raise RuntimeError('An exported display frame is unexpectedly empty.')
    checks.append({'frame': frame['name'], 'opaquePixels': int(len(rows)), 'nativeBounds': [int(columns.min()), int(rows.min()), int(columns.max()) + 1, int(rows.max()) + 1]})
report = {'frames': len(checks), 'nativeSize': [420, 280], 'alphaValues': alpha_values, 'maxOpaqueFraction': max(row['opaquePixels'] for row in checks) / (420 * 280), 'result': 'passed', 'scope': 'Atlas dimensions, native registration and binary patch alpha; visual review checks placement and pixel appearance separately.', 'checks': checks}
(directory / 'alpha-verification.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
print(json.dumps({key: value for key, value in report.items() if key != 'checks'}))

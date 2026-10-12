"""Compare native Canvas shadow source-over against the actual Blender material."""
import json
import sys
from pathlib import Path
import numpy as np
from PIL import Image

directory = Path(sys.argv[1]).resolve()
canvas = np.array(Image.open(directory / 'reference-runtime-shadowed.png').convert('RGB')).astype(np.int16)
blender = np.array(Image.open(directory / 'reference-blender-shadowed.png').convert('RGB')).astype(np.int16)
mask = np.array(Image.open(directory / 'reference-mask.png').convert('RGBA'))[:, :, 3] > 0
if canvas.shape != (280, 420, 3) or canvas.shape != blender.shape or mask.sum() == 0:
    raise RuntimeError('Expected native room references and a nonempty shadow mask.')
diff = np.abs(canvas-blender)
report = {'nativeSize': [420, 280], 'referenceSeconds': 2, 'shadowPixels': int(mask.sum()), 'meanChannelError': float(diff.mean()), 'shadowMeanChannelError': float(diff[mask].mean()), 'maximumChannelError': int(diff.max()), 'outsideShadowMaximumError': int(diff[~mask].max()), 'method': 'Identical original native room and continuous shadow mask; compare real Canvas RelayShadows.draw against the actual orthographic Blender source-backed sRGB material at frame 49.', 'tolerance': 'Shadow-region MAE < 1/255, no channel beyond 3/255, outside-ink error <= 1/255.'}
report['passed'] = report['shadowMeanChannelError'] < 1 and report['maximumChannelError'] <= 3 and report['outsideShadowMaximumError'] <= 1
(directory / 'native-material-verification.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
print(json.dumps(report))
if not report['passed']:
    raise RuntimeError('The native Canvas/Blender shadow material comparison exceeds tolerance.')

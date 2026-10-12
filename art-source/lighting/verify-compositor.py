"""Compare the actual Canvas draw with Blender using identical frozen factors."""
import json
import sys
from pathlib import Path
import numpy as np
from PIL import Image

directory = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else Path(__file__).resolve().parent
canvas = np.array(Image.open(directory / 'reference-runtime-lit.png').convert('RGB')).astype(np.int16)
blender = np.array(Image.open(directory / 'reference-blender-lit.png').convert('RGB')).astype(np.int16)
if canvas.shape != blender.shape or canvas.shape != (280, 420, 3):
    raise RuntimeError('Reference comparison must use two native420×280 RGB frames.')
difference = np.abs(canvas - blender)
report = {
    'size': [420, 280],
    'channelMAE': float(difference.mean()),
    'maximumChannelError': int(difference.max()),
    'channelsWithin2CodesFraction': float((difference <= 2).mean()),
    'pixelsWithin2CodesFraction': float((difference.max(2) <= 2).mean()),
    'p99ChannelError': float(np.quantile(difference, .99)),
    'method': 'Identical unchanged room at t2/risk0. Compare actual Canvas RelayLighting.draw with Blender piecewise-sRGB compositor using the same exported shade and irradiance.',
    'tolerance': 'MAE below1/255 and maximum channel difference no greater than4/255; Canvas rounds intermediate8-bit composite operations.',
}
report['passed'] = report['channelMAE'] < 1 and report['maximumChannelError'] <= 4
(directory / 'gamma-verification.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
print(json.dumps(report))
if not report['passed']:
    raise RuntimeError('Canvas versus Blender lighting exceeded its accepted quantization tolerance.')

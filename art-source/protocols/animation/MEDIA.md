# Device-animation film authoring

The 1.3.1 media uses the actual native Injection, Memory and Bypass interfaces, with code-native pixel effects registered to the three accepted device PNGs. No generated backplate, room artwork, resident raster, intro encode or original music master is changed for this revision.

The 24-second Protocol Preview presents all three 420×650 interfaces at native size. A fourth landscape column shows a 384×384 crop of the current hardware at exactly 3× nearest-neighbor scale. It alternates Injection bezel circuitry, Memory's copper bus and Bypass's central coupler. The detail reads the actual animation canvas from its corresponding native iframe. It reproduces the existing backplate scaling and vertical shade, excludes interface controls, and retains the last visible hardware sample after that protocol closes. That held sample is labeled “LAST SIGNAL”.

The 40-second trailer preserves its existing gameplay sequence and original music. During the three protocols its 1038×371 detail panel shows a 346×123 crop of the actual hardware at 3×, with one pixel of vertical padding. Outside those protocols it returns to the original live room detail. The actual 420×650 game stays readable at 1.5× on the right.

The read-only compositor is `hardware-detail.js`. It never sets a gameplay phase, target, timer, animation time or decorative random seed. Both films use the established isolated localhost demonstration harness, virtual clocks, real input handlers and real outcome events. Its controlled advanced save and explicit protocol triggers remain documented by the capture logs; no live save or leaderboard access is used.

## Reproduce

Run from the source directory:

```text
node scripts/render-protocol-preview.cjs --rehearse
node scripts/render-protocol-preview.cjs --preview
node scripts/render-protocol-preview.cjs
node scripts/render-trailer.cjs --rehearse
node scripts/render-trailer.cjs --preview
node scripts/render-trailer.cjs
node art-source/trailer/review-final.cjs
python art-source/trailer/verify-title-continuity.py
```

The scripts use Playwright and ffmpeg-static development dependencies. A compatible browser can be selected with `PLAYWRIGHT_CHROMIUM_EXECUTABLE`. Defaults place working media under `../protocol-animation/media` and delivery under `outputs/Blacksite-Relay-<version>`. Use `--work=PATH` and `--output=PATH` to override. The accepted original lossless intro PNG sequence can be passed with `--intro-frames=PATH`; otherwise the unchanged bundled WebM supplies those opening frames.

The previous 1.3.0 UI and film scripts are preserved in `before-1.3.0`, including immutable source-ZIP provenance. `unchanged-source-baseline.json` covers 21 protected inputs: 18 existing room, resident, shadow, lighting, intro and music files, plus all three selected ImageGen PNGs. Their selected hashes and original prompts remain in the parent protocols folder. This task adds pixel animation through code and does not create or retouch raster assets.

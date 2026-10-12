# Registered resident shadows

The cinematic uses the actual runtime silhouettes for the operator, two rats, server cat and coil snail. `export-intro-atlas.cjs` samples their shared clock at 12 fps from 0 through 5.9167 seconds. Its 72-frame atlas contains 12 columns × 6 rows of native 420×280 masks, registered to the original 1536×1024 room. Black RGB and continuous alpha remain intact and editable.

Run from the game source directory:

```text
node art-source/life/export-intro-atlas.cjs
node art-source/pets/export-intro-atlas.cjs
node art-source/shadows/export-intro-atlas.cjs
blender --background --factory-startup --python art-source/shadows/test-material.py -- <absolute-path-to-art-source/shadows>
python art-source/shadows/verify-material.py art-source/shadows
```

Exports require Playwright and Chromium. `--output=PATH`, `--start=SECONDS` and `PLAYWRIGHT_CHROMIUM_EXECUTABLE` override authoring defaults. Both actor exporters load `RelayShadows` so the older fallback contacts are omitted. Actor and shadow clocks must match; changing an export start requires changing all three. Original sprite images and pose geometry are preserved.

`art-source/blender/shadow_planes.py` removes the two previous operator contact polygons and inserts one registered shadow plane before actors, electronics and lighting. The material reads the unchanged room pixels and computes `C × (1 − alpha)` in sRGB. It then emits that result once on covered pixels, remaining transparent outside the mask. The continuous alpha is already part of the computed color; applying it again would double the blend. Camera depth is .036, behind the operator at .038 and pets at .04. Original floor cables retain their foreground depth.

`native-material-verification.json` compares the real Blender material with Canvas on the same native room at 2 seconds. Across 786 shadow-covered pixels, mean channel error is 0.4881/255 and maximum error is 1/255. Outside the shadow mask, pixels match exactly. The complete-frame mean is 0.00326/255. These checks directly measure the covered region so a small mask cannot conceal a material error.

`intro-shadows.json`, `intro-export-verification.json` and `shadow-definition.json` preserve source hashes, timing, caster samples and receiving surfaces. The editable Blender source packs seven images: original room, operator, pets, shadows, electronics, shade and irradiance. Runtime behavior and visual review are documented separately in `runtime-notes.md` and the release verification notes.

## Shadow Preview

`node scripts/render-shadow-preview.cjs` records a 24-second comparison at 1920×960, with paired native 420×150 rooms and 2× enlargements. `--preview` writes review stills. The before scene loads the four exact 1.2.4 renderer modules preserved from its delivered source ZIP in `before-1.2.4`; `provenance.json` records their hashes. Both scenes use the same clock and original art. No saves, gameplay actions or leaderboard are involved.

The film retains `art-source/audio/masters/music-original.wav`, with 0.65 gain, a one-second opening fade and a 1.5-second closing fade. `RISK_SHADOW_PREVIEW_DIR` and `RISK_SHADOW_PREVIEW_WORK` override output locations. The final composition and report are retained as `preview-stage.html` and `preview-verification.json`.

The final preview is 4,948,498 bytes, exactly 24 seconds and 576 frames at 24 fps. Complete video/audio decoding passes, with no browser errors. The encoded soundtrack measures −23.6 LUFS integrated and −6.1 dBFS peak. Decoded frames at 2, 5, 8, 12, 16, 20 and 23 seconds were inspected for shared motion, attached contacts, receiving-surface boundaries and preservation of the original room detail. Original source hashes and signal measurements are verified; no human listening review is claimed.

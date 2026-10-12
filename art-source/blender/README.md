# Blacksite Relay — editable living scene

`Blacksite_Relay.blend` is the editable six-second intro scene for version 1.2.5. It contains the original room artwork, the accepted operator's connected runtime animation and four small residents: two rats, a server cat and a smaller left-facing coil snail. Each resident now has a registered shadow from its actual animated silhouette. Projection layers, an animated camera reveal, the real wall fan, runtime CRT and server activity, fixed cable contacts and vent steam complete the scene.

The source is a 2.5D projection scene. The operator is derived from one approved source image, `assets/scene/relay-operator-design.png`, through the exact connected-image animation in `src/relay-life.js`. `art-source/life/export-intro-atlas.cjs` warms the real scene and calls its read-only `RelayLife.exportFrame()` at 72 successive timestamps from 0.00 to 5.9167 seconds, matching the pet and shadow clocks. It writes a true alpha 432×432 atlas containing 36×72 frames in 12 columns and 6 rows. The associated `intro-operator.json` preserves the native pivot (16,64), world foot (574,707), source scale 1536/420 and neutral tint. Each frame lasts 1/12 second. Blender displays each exported frame twice at 24 fps; it adds no breathing, limb motion, color key or independent pose substitutions. All connected motion is already baked by the runtime.

## Reproduce

From the game source directory, with Blender 5.0 on PATH:

```text
node art-source/life/export-intro-atlas.cjs
node art-source/pets/export-intro-atlas.cjs
node art-source/shadows/export-intro-atlas.cjs
node art-source/lighting/export-intro-maps.cjs
node art-source/electronics/export-intro-atlas.cjs
blender --background --python art-source/blender/build_blacksite.py -- --resolution 960 --render --require-operator --require-pets --require-shadows --require-lighting --require-electronics
node art-source/blender/encode-intro.cjs
```

The Blender script was rendered with Blender 5.0.1. Its 144 lossless PNG frames are written to `../relay-shadows/media/intro-frames`, outside the shipped game. The default editable file is `art-source/blender/Blacksite_Relay.blend`. Change locations with `--frames-dir`, `--blend-output` or `--preview-dir`; `--preview-frames 1,72,144` renders only selected review frames. Use absolute paths for output overrides because Blender can change its working directory. `--operator-metadata`, `--pets-metadata`, `--lighting-metadata`, `--electronics-metadata` and `--shadow-metadata` can select compatible atlas descriptions. The exports require Playwright and a compatible local Chromium executable; install Chromium with npx playwright install chromium, or set PLAYWRIGHT_CHROMIUM_EXECUTABLE / CHROMIUM_EXECUTABLE to your browser path.

The pet atlas contains 72 RGBA frames exported directly from the accepted `RelayPets.draw` at 12 fps from 0.00 to 5.9167 seconds. Each full-room frame is 420×280 logical pixels, mapped onto the original 1536×1024 room; the 12×6 atlas is 5040×1680. The projection is at depth .04, in front of the technician and behind the foreground cable trench. The two rat routes avoid the technician; the smaller snail stays left-facing on the right cabinet roof. Native contours, rat gait, cat blink and ear flick, and snail feeler motion come from the runtime. Older contact stubs are omitted because the shadow atlas supplies their replacement. Blender adds no replacement gait, deformation or recoloring. `intro-pets.json` holds registration and timing; `intro-export-verification.json` records sampled states and renderer/atlas hashes. Seven packed images contain the original room, operator, pets, shadows, electronics and two lighting data textures.

The encoder requires the development dependency `ffmpeg-static`. It accepts `--frames=PATH`, `--review=PATH` and `--output=PATH`. It creates the two bundled silent versions directly from the lossless frames: `assets/scene/intro.webm` (VP9) and `assets/scene/intro.mp4` (H.264). Both are 960×540, 24 fps and exactly 6.00 seconds, with a 0.35-second opening fade and a 0.55-second closing fade. Music and sound effects remain under the game's independent volume controls.

`intro-verification.json` records source-image, atlas and media hashes. `intro-verification.txt` records complete FFmpeg decoding of both files. `art-source/life/intro-export-verification.json` records the 72 real export timestamps and runtime diagnostics. Encoded frames at one through five seconds are extracted for visual inspection; the operator contour, floor contact and registration are also checked in Blender preview frames 1, 72 and 144. The intro itself is silent.

## Surface lighting

The scene uses camera-registered shade and irradiance data passes through `lighting_passes.py`. `Relay Beauty` contains the unchanged room and actor materials plus the registered electronics; `Relay Shade Data` and `Relay Irradiance Data` each contain one original-room projection plane. The shade is a fixed 420×280 Non-Color RGB texture. The 72-frame irradiance atlas is 5040×1680, also Non-Color, sampled nearest at 12 fps from the runtime's shared clock. Each exported frame holds for two cinematic frames at 24 fps.

The compositor converts the completed linear beauty image into sRGB, applies `clamp(C × shade × (1 + irradiance))`, then converts back to linear output. Both conversions use the exact piecewise sRGB transfer function. The original room, operator and pet textures are never recolored or repainted. Perspective registration uses the same camera and source room coordinates; the source's tiny depth layers remain editable.

A numerical reference test compares the actual Canvas draw against this compositor on the identical unchanged 420×280 room at time 2 seconds and zero risk. Mean channel error is 0.418/255; 99.90% of pixels are within two 8-bit codes and the maximum difference is three codes, reflecting Canvas's intermediate integer rounding. See `art-source/lighting/gamma-verification.json` and its two reproduction scripts. `packed-blend-verification.json` records the seven packed images, three view layers and active operator/pet frames. These numerical checks complement the visual review of lamps, console light, floor bounce and actor silhouettes.

## Runtime computer activity

`electronics_planes.py` removes the earlier independent CRT, reactor and server animation, then projects the exact runtime electronics atlas at depth .038. This replaces 2,215 independent overlay objects with one animated texture plane. The 72 frames use hard alpha and nearest sampling; each holds for two cinematic frames. Source-backed patches preserve the original Canvas blend result and affect less than one percent of the room in the calm sequence. The final surface lighting pass applies to these pixels with the rest of the scene. Export instructions and verification live in `art-source/electronics`.

## Resident shadows

`shadow_planes.py` adds the shared-clock silhouette mask before the actor planes and removes the previous operator contact polygons. The native mask retains continuous alpha in its packed atlas. Its source-backed material computes `C × (1 − alpha)` in sRGB, then emits the result once on covered pixels; outside the mask it remains transparent. This avoids applying soft alpha twice and preserves the room's surface texture. The actual material was rendered at native 420×280 and compared with Canvas: mean error on the 786 shadow-covered pixels is 0.488/255, maximum error is 1/255, and all pixels outside the mask match exactly. See `art-source/shadows/native-material-verification.json` and the editable test scripts.

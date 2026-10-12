# Blacksite surface lighting

This pass is authored Canvas lighting around the existing original artwork. No replacement room image, new character art or external asset pack is used.

`src/relay-lighting.js` defines eight light fields and conservative receiving polygons in the original 1536×1024 room coordinates. The matching `assets/scene/relay-lighting.json` is exported from `RelayLighting.getDefinition()` for inspection. The field images are generated once at 420×280 with nearest sampling. Wet-metal response and highlight protection are derived from the existing art; matte-black areas remain black.

The post pass multiplies the composed scene by a subtle cool shadow map, then adds a copy of that scene multiplied by the incident-light map. Its sRGB pixel operation is `clamp(C * shade * (1 + irradiance))`. Applying it after the pets and operator makes their existing pixels receive the same local light. Particles render afterward. The final viewport gradient now uses 13% bottom opacity, down from 35%.

`prepare(art)` builds the cached fields. `draw(context,time,options)` uses the parent room transform and clock; options include normalized risk, resolved visual signals and the static flag. `exportMaps(time,options)` returns opaque shade and irradiance PNG data URLs and their 420×280 dimensions. `getDiagnostics()` reports field size/count, map rebuilds and view-buffer bounds. All returned definitions are detached copies.

Light strengths are sampled at 24 fps and quantized before composing the cached map. Lamp variation is restrained; electronic response uses resolved gameplay events and does not delay input. The pass owns no animation frame, timeout, random generator or save field. Disposal releases its eleven map canvases and up to four view buffers. The extra map introduced in 1.2.4 reuses the reactor receiver intensity with a dynamic color, selected by `signal.coreRgb` and blended from warm by `signal.coreMix`.

The reactor palette, chamber mask and computer activity regions are exposed through `BlacksiteScene.getElectronicsDefinition()` and recorded in `assets/scene/relay-electronics.json`. `BlacksiteScene.exportElectronicsFrame(time, options)` returns a 420×280 PNG containing only changed electronics fragments. It composes against the original artwork before making unchanged pixels transparent, so Blender receives the actual resulting pixel colors instead of trying to reproduce Canvas blend modes over transparent black. The runtime export has no effect on gameplay or the active scene signal.

The untouched original room and exact ImageGen prompt remain credited in the project's asset documentation. Blender export uses these explicit maps, with sRGB conversion around the multiplication so it can match the runtime without repainting the original textures.

## Cinematic factor export

Run `node art-source/lighting/export-intro-maps.cjs`. It writes the constant `shade.png`, a 72-frame `intro-irradiance-atlas.png`, `intro-lighting.json` and `intro-export-verification.json`. The atlas samples six seconds at 12 fps and has 12 columns × 6 rows of 420×280 frames. Source and renderer hashes are recorded; the original artwork remains unchanged. `--start=SECONDS`, `--output=PATH` and `PLAYWRIGHT_CHROMIUM_EXECUTABLE` are optional authoring overrides.

The exporter also writes a fixed original-room input and the real Canvas lighting result at time 2 seconds and zero risk. To verify Blender's sRGB math, run `blender --background --factory-startup --python art-source/lighting/test-compositor.py`, then `python art-source/lighting/verify-compositor.py` (Pillow and NumPy required). The first script writes the Blender result; the second compares every pixel and writes `gamma-verification.json`. Accepted tolerance is mean error below 1/255 and no channel beyond 4/255, allowing Canvas's intermediate 8-bit rounding.

`art-source/blender/lighting_passes.py` projects these Non-Color factors through the cinematic camera in separate data view layers, then applies the sRGB transform after the unchanged beauty render. It does not modify the accepted operator or pet atlas. Full intro export, camera controls and encoding instructions are in `art-source/blender/README.md`.

# Runtime electronics for the cinematic reveal

The intro uses the same reactor filament, CRT activity and registered server lights as the game. `src/relay-scene.js` exports their final native pixels over the unchanged original room. Only changed pixels become opaque; unchanged pixels stay transparent. This preserves the source-backed result of Canvas blend modes when composited in Blender.

Run from the game source directory:

```text
node art-source/electronics/export-intro-atlas.cjs
python art-source/electronics/verify-atlas.py art-source/electronics
```

The exporter requires Playwright and Chromium. It samples 72 frames at 12 fps from time zero through 5.9167 seconds. The atlas contains 12 columns × 6 rows of 420×280 frames, mapped onto the original 1536×1024 room. `--start=SECONDS`, `--output=PATH` and `PLAYWRIGHT_CHROMIUM_EXECUTABLE` override authoring defaults. The numerical atlas check requires Pillow and NumPy; it checks dimensions and hard alpha without modifying artwork.

`intro-electronics.json` records timing, registration and original renderer/art hashes. `electronics-definition.json` records the actual palette and receiver definitions. `intro-export-verification.json` records all sample times and unique frames. The cinematic uses the calm amber reactor; the trailer and separate Reactor Preview show actual resolved hack colors and outcome cues.

`art-source/blender/electronics_planes.py` replaces the older independent CRT/reactor/server animation with one registered atlas plane. Each exported frame holds for two cinematic frames at 24 fps. The atlas is packed and sampled nearest; actors, room artwork, camera, fan and fixed cable contacts remain separate editable layers. Shared surface lighting is applied afterward through the existing data passes.

The exported patches occupy less than one percent of the native room in the approved calm sequence. They contain no labels, invented interface text or extra actor artwork.

## Reactor Preview

`node scripts/render-reactor-preview.cjs` records a separate 24-second, 1440×760 film with native 420×650 gameplay beside a 2× room enlargement. Use `--preview` for selected stills. `RISK_REACTOR_PREVIEW_DIR` and `RISK_REACTOR_PREVIEW_WORK` override the release and intermediate directories. The three hack colors use real game function calls with fixed showcase rolls. Success and failure use explicit presentation-only mini-game outcome events; the preview does not claim those were earned through a played mini-game.

The film retains `art-source/audio/masters/music-original.wav`, mixed at 0.65 gain with a one-second opening fade and 1.5-second closing fade. It passes a complete 576-frame picture/audio decode; encoded audio measures −23.6 LUFS and −6.1 dBFS peak. Seven decoded frames were inspected for all five cue hues, ambient recovery, native readability and grounded residents. `preview-stage.html` and `preview-verification.json` preserve the composition and evidence. The delivered files are `Reactor-Preview.mp4` and `Reactor-Preview-Poster.png`.

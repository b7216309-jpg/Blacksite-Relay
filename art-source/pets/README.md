# Relay residents

Original assets generated with the built-in ImageGen tool on 2026-09-05. The exact three prompts are in `prompts.json`. Untouched generated PNGs are in `assets/scene/relay-rat-design.png`, `relay-cat-design.png`, and `relay-snail-design.png`.

The import routine in `src/relay-pets.js` samples the drawings once with nearest-neighbor filtering. ImageGen supplied a pale matte rather than transparency; the runtime importer removes that matte and outside-connected neutral fringe. The source PNGs remain unchanged.

Logical sprite canvases: rat 30×16 (26×10 drawing), cat 28×22 (24×16 drawing), snail 21×18 (17×12 drawing). Placement uses the room's 1536×1024 source coordinates, then snaps each foot and image to native canvas pixels. Animation samples at 12 fps. Rats share an original design but have separate bounded frame caches and staggered routes.

In 1.2.4, the snail keeps that original imported frame and draws at 65% scale: a fixed 14×12 cached raster, containing approximately 11×8 pixels of visible artwork at 420px scene width. Its nearest-neighbor samples are selected explicitly before drawing. A brief one-pixel feeler reach is authored on that small grid, so it remains visible at native size. It always faces left from a fixed roof foot at (1206,389). The shell and foot stay still, avoiding backward travel. There are exactly two rats, with the original two routes unchanged and an explicit runtime rat limit of two. The cat and operator are unchanged.

The runtime is the editable animation source. Ground contact does not bounce. Paws and tails move locally; the cat keeps its loaf silhouette; the snail's shell does not bob. Idle periods intentionally last longer than movement. No sounds or captions are attached to individual pets.

`relay-pets.json` documents dimensions, pivots and routes. Blender export and verification records are included beside the scene sources when the release is built.

## Cinematic export

Run `node art-source/pets/export-intro-atlas.cjs` from the repository. The exporter samples the accepted `RelayPets.draw` function at 12 fps for six seconds. It writes `intro-pets-atlas.png`, `intro-pets.json` and `intro-export-verification.json`; no sprite artwork is redrawn. Each 420×280 RGBA frame covers the complete original 1536×1024 room on the same native pixel grid as the game. The editable Blender scene packs this atlas through `art-source/blender/pets_planes.py` and holds each frame for two 24 fps cinematic frames. `--start=SECONDS`, `--output=PATH` and `PLAYWRIGHT_CHROMIUM_EXECUTABLE` are optional authoring overrides. Source sprites and gameplay randomness are unchanged by export.

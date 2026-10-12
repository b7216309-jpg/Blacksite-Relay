# Blacksite Relay — original prop sources

Four original ImageGen prop images support the five living scene discoveries in 1.6.0. The established room was used only as a pixel-art material and palette reference. Rat, cat, snail and operator artwork remains the previously accepted original design.

`originals/` contains the exact selected generated PNG bytes, matching `assets/easter-eggs/`. They are opaque RGB images on a magenta matte. They are not transparent PNGs. The renderers key the original image once into an offscreen RGBA canvas by removing pixels where red and blue each exceed green by more than 12. Source crops then draw with smoothing disabled. No raster file was manually edited, resampled or repainted.

The first placard and bag requests, followed by explicit transparency edits, returned opaque white/checkerboard imagery. Those candidates were rejected. `alpha-attempts.json` records the failed edits; `magenta-prompts.json` contains the exact accepted background-edit and new-prop prompts. The original checkerboard candidates remain in task scratch only.

`selected-assets.json` records dimensions, SHA-256 hashes and source output IDs. `registration.json` records original-coordinate crops and blank-panel polygons. Final native imports are a28×36 sign,3×2 crumb,7×5 pouch,5×3 envelope,19×71 locker,8×10 note and48×87 arcade. The arcade occupies x342,y35 in the guide hero. The locker and its note are separate components: the note must not expand the locker crop. The arcade's four inner-screen corners define the live CRT overlay; the whole cabinet retains its aspect ratio.

`native-keyed-preview.png` is a browser-rendered inspection of the keyed props at their final native sizes and integer enlargement. It confirms silhouettes and matte removal, rather than final in-room positioning. Run `node art-source/easter-eggs/preview-props.cjs` from a source checkout with the existing Playwright dependency and optional `CHROMIUM_EXECUTABLE` to reproduce that view. The helper changes no original pixels. Root approved the final integrated rat, cat and snail motion strips and native locker/arcade captures before runtime freeze. Current interaction, lifecycle, fallback and motion evidence is included in release verification.

The sign and screen are deliberately blank. Game code adds the short message and live display so their text remains sharp at native resolution. Courier pouch, envelope, note and crumb stay separate for bounded motion. Source effects and six new original audio cues are documented in their own modules and audio authoring directory.

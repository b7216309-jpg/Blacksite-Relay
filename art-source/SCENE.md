# Blacksite Relay scene source

The runtime keeps the selected 1536×1024 ImageGen artwork intact. Artwork, component masks and animation share the same cover transform (center / 48%), so registration stays fixed at every window scale. The 420×150 gameplay crop is the primary visual target.

## Revision 2: animation belongs to the machinery

Direct inspection identified a mistaken fan on the lower pipe endcap, a phosphor overlay extending across the CRT bezel, and floating rings, hexagons and cones that did not belong to the room. Revision 2 removes these. The lower endcap is untouched. The upper wall extraction fan moves within its actual aperture, preserving the existing hub, rim and radial grille.

The CRT glass uses the conservative quadrilateral (684,324) → (771,346) → (771,412) → (684,390). Original phosphor text remains visible beneath a narrow rolling refresh, compact activity rows, protection indicator and risk status. Event brightness reuses original image pixels inside the glass mask; it does not replace the display with a flat rectangle. The reactor filament has its own mask, and practical lamp halos remain restrained.

Server activity is registered from actual teal pixels in seven bounded source regions. At load time, 320 horizontal emissive runs are extracted; runtime flicker, node sweeps, transfer activity and failure dimming affect those original pixels. Three cable routes contain manually inspected coupling points. Tiny pulses follow these contacts instead of crossing open space. Vapor comes only from the visible floor vent at (252,735). Dust and brief contact sparks use small pixel clusters.

Hacks activate CRT and reactor circuitry with distinct strength; node completion sweeps server lights; overclock increases core and cable activity; Ghost marks the CRT and relay indicator; cooling increases vent output; extraction runs the server link and display; failure powers down glass, core and server emitters. Critical risk marks the central monitor and relay status lights, which remain visible in the portrait crop. No room-spanning rings, shields, beams or color washes obscure the source art.

## Living machinery: maintenance details

The next detail pass keeps the inspected hardware registration. The three real server banks occasionally run independent row-by-row self-tests over their sampled LED pixels. Their different 17.9, 21.6 and 25.3 second periods prevent synchronized cabinet motion. A quiet 1.7 second CRT parity check occasionally occupies a small status line inside the existing glass; resolved gameplay activity takes priority. The actual right-hand cable connector gives a tiny double contact spark approximately once every 19.7 seconds. Sparse amber reflections under practical lights breathe on their original painted pixels, sampled in three bounded floor regions. No pressure gauge was added because there is no visible gauge in the source artwork.

These details use the existing presentation clock and deterministic phases, without additional timers, event queues or gameplay randomness. The existing hidden-scene, mini-game, reduced-motion and effects-off behavior applies. Low effects reduces contact clusters and reflection samples. Bust power-down silences the contact activity and dims the registered server sequence. The normal row and CRT activity remains stronger than maintenance animations.

`window.RelayLife` may add character and small room-life details on the shared source-art transform. Optional `draw(ctx, time, context)` receives risk, current visual signal, quality and pause/terminal flags after all ambient machinery and before event particles. Its canvas state is isolated. Optional `setState`, `emit` and `dispose` hooks follow the scene lifecycle. The character module owns its art and behavior separately.

The task workspace's `work/living-relay` contains the prior renderer, reproducible `inspect-machinery.cjs`, a 16-second before/after capture (384 frames per version), native 420×150 and enlarged component review sheets, and the lifecycle report. The maintenance pass was inspected at native size and at the source glass, coupling, server and floor details. Its scoped QA recorded zero page errors, zero calls to gameplay randomness, 61fps at native size, bounded/expiring effects and particles, paused reduced/off/mini-game frames, clean result transitions, capture expiry and disposal. The runtime reports its sampled reflection count through `registeredReflectionRuns`.

## Runtime contract

src/relay-scene.js listens for risk:state and risk:event without reading or writing gameplay globals. Its xorshift generator is independent of Math.random; ambient motion uses deterministic functions. Particles are capped at 160 and effects at 12. Spawned particles expire within 0.36 seconds; event envelopes expire within 2.6 seconds. Decorative effects never delay resolved actions.

Reduced motion and effects-off draw a stable composition. Hidden documents, hidden scenes and mini-games suspend the animation loop. dispose() releases the observer, listeners, animation frame and particle arrays. Result canvases retain the pre-reset event snapshot; leaving a result clears its effects before the next run. Result ambience plays at a gentler pace.

window.BlacksiteScene.getDiagnostics() exposes FPS, frames, particles and limit, active effects, registered light runs, canvas counts, clock, capture time and current state. setCaptureTime(seconds) produces a deterministic frame and suspends normal animation; pass null to resume. Capture time also prunes expired effects. Diagnostics report zero FPS while paused.

## Inspection evidence

The reproducible review lives under the task workspace's work/scene-review-v2: capture-scene.cjs, compose-review.cjs, paired native contact sheet, 14-second side-by-side motion capture, original component crops, before/after full-resolution frames and capture error logs. Frames were inspected at native 420×150 and original 1536×1024, including brute hack, node completion, Ghost, overclock, transfer and failure. The previous runtime is saved there for reproducibility.

The independent lifecycle-qa.cjs run reports 61fps at native size, 320 registered light runs, no JavaScript errors, no use of gameplay randomness, bounded queues, expiry, reduced/off/mini-game pauses, result cleanup, capture expiry and disposal. These are scoped scene checks; release QA covers the full game and package.

## Editable Blender source and media

blender/Blacksite_Relay.blend and blender/build_blacksite.py author the packed 2.5D intro. Original artwork remains the texture source. Blender is an authoring dependency only; the game uses bundled media and Canvas 2D.

Rebuild: blender --background --python art-source/blender/build_blacksite.py -- --render

The default render is 480×270 at 24fps, nearest-upscaled to 960×540 for the six-second intro. --resolution 960 renders directly at 960×540. The intro visual master is silent so music and effects follow independent game volume settings. `node art-source/blender/encode-intro.cjs` encodes the rendered sequence to the bundled WebM and MP4.

Revision 2 Blender source matches the visually approved runtime: actual wall fan only, conservative CRT glass, original source pixel illumination, fixed cable contacts and one confirmed vent. Frames 1,25,49,73,97,121,144 were inspected after rendering. Camera movement remains level, the pipe cap stays untouched, glass and original phosphor text stay aligned, and no floating geometry crosses the room. The encoded WebM reports exactly 6.00 seconds, 144 frames, 960×540, 24fps and BT.709; complete decoding passes without errors. This evidence is recorded in blender/intro-verification.txt.

# Registered protocol hardware life - 1.3.1

The accepted 1.3.0 backplate PNGs remain unchanged. `src/relay-protocol-life.js` adds a separate transparent 420 x 650 Canvas 2D layer directly above each image, below the original shade and native controls.

Bypass has staggered cyan lenses, restrained copper/core modulation and a tiny contact spark after a successful stop. Injection animates the existing bezel/controller LEDs; preparation can add a short keyboard-contact arc and copper pulse. Memory uses its actual amber lenses, upper fin bank and lower copper bus. Its grid, row/column labels, phase clock, status and controls are protected from all effect pixels.

Active play keeps the subdued LEDs and material modulation. Brighter contact sparks and bus pulses use existing preparation/result windows; Bypass's stop spark follows an already-resolved stop and never delays or moves the next target. Low quality uses fewer LEDs and no sparks/sweeps. Reduced motion, static effects, hidden pages, inactive devices and failed images stop the decorative scheduler and clear its canvases. Timing, inputs, random choices and rewards remain owned by the original game.

## Edit and reproduce

The runtime module contains the authoritative anchors, protected rectangles, colors and deterministic functions. `hardware-definition.json` is an exported registration reference, including original image sizes, native coordinates and detail crops. All rectangles render on integer native pixels without interpolated particles or a whole-screen lighting filter.

After installing the project's development dependencies, run from the repository root with an available local Chromium browser (or set `CHROMIUM_EXECUTABLE`):

```powershell
node art-source/protocols/animation/export-frame.cjs --game bypass --phase active --time 1.2 --stop-age 0.12 --background --out ../protocol-animation/exports/bypass-stop.png
node art-source/protocols/animation/export-frame.cjs --game typing --phase countdown --time 0.12 --background --out ../protocol-animation/exports/injection-contact.png
node art-source/protocols/animation/export-frame.cjs --game backdoor --phase active --time 2 --low --out ../protocol-animation/exports/memory-low-overlay.png
```

Omit `--background` for transparent effect pixels. Use `--phase-time` to specify time since the phase change, `--failure` for failed result feedback, and `--write-definition` to refresh the registration reference after editing anchors. The helper creates a PNG and emission JSON using an offline, in-memory bridge. It never loads live saves or submits a score.

The browser API is `RelayProtocolLife.exportFrame(time, options)`. It does not advance the live effect clock or alter gameplay. Runtime canvases are available through `canvas[data-protocol-life-canvas]`; `getDiagnostics()` reports phase, readiness, emitted bounds, density and bounded resource use. One shared decorative requestAnimationFrame loop caps drawing at 24 fps, with three live canvases and at most one reusable export canvas. There are no decorative timers, gameplay RNG calls or persistent particles.

See `ROOT-REVIEW.md` for the observed visual review and `MEDIA.md` for preview/trailer reproduction. The original generation prompts remain in `../prompts/device-backplates.json`.

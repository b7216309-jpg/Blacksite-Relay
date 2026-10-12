# Blacksite submenu rooms — 1.4.0

Five original portrait illustrations were generated using the built-in ImageGen tool. The accepted `assets/scene/blacksite-relay.png` established the industrial pixel-art style; it was a reference, not an edit target. No third-party stock assets were purchased.

| Asset | Submenu | Scene |
| --- | --- | --- |
| `assets/menus/workbench.png` | Upgrades and Prestige | Maintenance workbench and expansion boards |
| `assets/menus/records.png` | Achievements | Data cartridge archive |
| `assets/menus/signal.png` | Leaderboard | CRT signal exchange |
| `assets/menus/controls.png` | Settings | Analog mixer and control rack |
| `assets/menus/briefing.png` | How to play | Secure data case and briefing terminal |

The PNGs are unmodified 1024 × 1536 generated masters. The same files are bundled with the game. The renderer samples them into a native 420 × 650 canvas with image smoothing disabled, and moves each composition upward to keep its focal machinery visible above the controls. Original image pixels are not painted over or resaved. Reading surfaces, text, buttons and lighting response are separate code layers.

`prompts.json` retains all five exact generation prompts. `selected-assets.json` records source paths, dimensions and SHA-256 hashes. `src/relay-menu-scenes.js` contains framing coordinates, restrained CRT luminosity and tiny mounted LED activity; `src/relay-menu-scenes.css` defines the reading surfaces. There is one shared frame loop only while an active submenu needs motion; no timers or gameplay randomness. Reduced motion and Static scene show the original still artwork. With Canvas 2D unavailable, the CSS image underneath remains visible.

The visual guide uses native text, SVG icons from the game's existing icon set, and CSS diagrams. `src/relay-guide.js` only handles navigation and focus. Its content follows the verified gameplay and the 1.3.2 bonus audit. No new gameplay rules, generated text art, or audio are introduced.

# Blacksite Relay 1.4.0 — Field guide and submenu rooms

The main menu gives the guide its own visible entry directly below Start Run. Its first page shows the relay loop: hack, watch the trace, then transfer. Four topic buttons open the detail you need: hacks and risk, the six bonuses, protocols and keyboard controls, or permanent progression. Exact Gamble odds stay behind a further disclosure inside the bonus topic.

The overview fits the 420 × 650 window without scrolling. Longer details scroll inside their reading area while the heading, Overview action and close button remain available. Back returns to the overview; Escape returns one level at a time, then closes the guide. Page changes focus the heading, and closing restores the menu opener. The guide uses existing gameplay functions and save flags; its navigation adds no gameplay rules, timers or random draws.

Five generated pixel-art rooms give the submenus their own setting:

| Screen | Background |
| --- | --- |
| Upgrades and Prestige | Maintenance workbench with expansion boards |
| Achievements | Data-cartridge archive and records terminal |
| Leaderboard | CRT signal exchange |
| Settings | Analog mixer and control rack |
| How to play | Secure briefing case and terminal |

All five images follow the accepted Blacksite room's industrial amber/teal palette. The unmodified 1024 × 1536 generated PNGs are bundled and included with their prompts and hash manifest in the art deliverables. Native text, buttons and reading surfaces remain separate from the artwork. Each composition is framed above its controls; upgrade cards are compact enough to expose all six choices before scrolling toward Prestige.

Mounted LEDs and subdued CRT activity give these adjacent rooms small details. A single shared animation loop runs only for the active submenu; Low effects reduces intensity. Reduced motion and Static scene use still artwork. Leaving for the main room, a result or a minigame stops the menu loop. CSS image layers preserve the background if Canvas 2D is unavailable.

The gameplay, saves, original music, intro, original room and residents, protocol device art and existing effects remain unchanged. The accepted 1.3.1 preview and trailer are retained as clearly labeled earlier footage; they do not show this guide or these backgrounds. Current screenshots and the game itself show the new interface.

Editable sources are `src/relay-guide.js`, `src/relay-guide.css`, `src/relay-menu-scenes.js` and `src/relay-menu-scenes.css`. `art-source/menus` holds the generation prompts, selected-image manifest, framing notes and visual review. `scripts/verify-menu-guide.cjs` reproduces the focused navigation, focus, asset and scale audit with isolated saves. Final test results and practical validation limits are in `VERIFICATION.md` in the release directory.

# Blacksite Relay 1.2.4 — the relay responds

The highlighted reactor chamber now changes color with resolved actions. Its existing coils, grille gaps and metal texture remain visible. Nearby surface lighting follows the same hue.

| Action | Reactor color |
| --- | --- |
| Idle | Amber |
| Safe Entry | Cyan |
| Standard Hack | Violet |
| Brute Force | Magenta |
| Node, mini-game success or extraction | Green |
| Mini-game failure or bust | Red |

Hack colors rise quickly, hold briefly and fade back to amber. A newer action replaces the previous cue. Extraction keeps a green chamber on the result screen; a bust leaves dim red coils while the practical room lamps remain lit. Leaving the result clears its cue. Reduced motion uses a steady color response, and mini-games pause decorative motion.

The surrounding computers have independent activity banks, occasional amber indicators and busier reads during hacks. Animation uses the existing scene clock and original illuminated pixels, with no new gameplay randomness or timers. There are no added interface labels.

The copper-coil snail is smaller and faces left. Two rats remain the maximum; the cat and original pet drawings are retained. The smaller snail is sampled onto a fixed pixel grid to avoid texture shimmer.

Editable reactor palette, chamber mask and computer regions are in `src/relay-scene.js` and `assets/scene/relay-electronics.json`. `src/relay-lighting.js` controls the matching reflected light. Original music, game mechanics and save fields are unchanged.

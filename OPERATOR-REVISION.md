# Blacksite Relay 1.2.1 — Technician correction

The old character changed shape between separately generated poses and became noisy at game size. It also reached toward a reactor casing without a clear task. This revision replaces it with one civilian technician checking a handheld diagnostic pad.

- A clear jacket, headset and tablet silhouette replaces the dense military equipment.
- The body is sampled once to 24×56 native pixels. The final game draw stays on the native pixel grid.
- Small wrist and head movements use the same drawing. Hips, trousers and boots remain identical between frames.
- Quiet coat shading replaces the abrupt breathing shift. The instantaneous headset-arm pose is removed.
- Background-connected matte residue is cleaned during texture import. Cool pixels distinguish the diagnostic pad from nearby amber machinery.

The corrected motion was inspected at native size and enlarged across 180 frames. All 72 idle frames retain an identical silhouette. Existing gameplay, saves, music, controls and mini-game timing are preserved; the regression suite passes all 97 tests.

Editable code is in `src/relay-life.js`. The unchanged original ImageGen design is `assets/scene/relay-operator-design.png`; its exact prompt, crop metadata and cinematic export sources are included. The Blender intro and trailer use the new technician.

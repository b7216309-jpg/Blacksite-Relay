# Upgrade card artwork — 1.6.4

Each permanent upgrade now has its own original pixel-art hardware vignette:

- RAM Injection: memory cartridges in an expansion dock.
- VPN Shield: an armored router and cyan shield emitter.
- Miner V2: a stack of processing boards and copper heat sinks.
- Cooling Fan: an industrial fan and coolant pipes.
- Deep Learning: an illuminated neural computing core.
- Overvolt: copper induction coils and an electrical arc.

The six full-resolution PNGs in `assets/upgrades/` were generated for this
project with the built-in ImageGen tool. Exact prompts and provenance are in
`art-source/upgrades/`. The original images are retained without paint-over,
cropping or recompression. CSS fits each background into its existing card.

Hardware is concentrated on the right. A dark gradient protects the four rows
of existing interface text, and a local backing keeps the longer Deep Learning
odds line readable. Backgrounds are decorative CSS layers, so the entire button
keeps its purchase action and keyboard focus behavior. Disabled cards retain
their artwork; affordable and focused cards keep distinct borders.

This is a presentation-only change. Card dimensions, costs, effects, upgrade
limits, saves, music and the local leaderboard retain their existing behavior.
The new artwork adds no animation timers, audio voices or gameplay randomness.

Native-size, display-scale and purchase/navigation review evidence is delivered
with this release's `VERIFICATION.md`.

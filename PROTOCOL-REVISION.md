# Protocol environments - 1.3.0

Each minigame uses an original pixel-art device in the Blacksite Relay style: a bypass calibrator, a command-injection CRT and a memory patch bay. The generated artwork supplies the device and material detail; readable targets, numbers, phase labels and controls remain live HTML.

The presentation keeps the established functional control IDs, timing, rewards, keyboard handling and memory-grid geometry. Artwork remains stationary during active input. Preparation and result feedback follow the current protocol phase, with decorative motion disabled for reduced/static settings and hidden windows. Bypass begins active immediately, without an entry animation delaying its controls.

The Bypass well is narrower to fit its physical device, while preserving percentage positions and elapsed-time movement. Memory retains its exact 30px ports and 5px gaps. Its reveal colors clear immediately at recall, without an interpolated target afterimage.

Runtime artwork is bundled under `assets/protocols/`. Original generation prompts and editable preview sources are under `art-source/protocols/`. The room scene, resident art and animation, reactor colors, lighting, shadows, intro and original looping music are preserved from 1.2.5.

Current validation and release limitations are recorded in the delivered `VERIFICATION.md`; generation prompts, media provenance and detailed QA reports accompany the source and masters.

# Blacksite Relay 1.2.3 — light on the machinery

The CRT now throws cool light onto its console and the technician. The reactor casts warm light onto its casing, stair edges and the wet floor. Four cage lamps illuminate their wall sections and cabinet tops; the rack recesses stay dark. The floor is less heavily shaded, so the rats and cable details remain visible.

The lighting follows the original room geometry. Each source has an authored receiving surface, falloff and color. Eight native pixel maps are prepared once. The final pass lights the already-composed scene, including the operator and pets, while preserving the underlying pixel detail. It adds no flat colored fog or screen-wide flash.

Small, independent changes in lamp intensity suggest old electrical equipment. Hacks, overclock, node completion and extraction affect the light from the electronics. Critical trace adds a restrained spill from the security light; a bust powers down electronic bounce while the practical lamps stay on.

Lighting shares the scene clock and has no timers, animation loop or gameplay randomness. Reduced motion and static mode hold a stable composition; mini-games and hidden windows stop decorative updates. The renderer keeps at most four reusable view buffers.

The original room, technician, pets and soundtrack assets are retained. Editable lighting definitions are in `src/relay-lighting.js` and `assets/scene/relay-lighting.json`; authoring/export notes are in `art-source/lighting/`.

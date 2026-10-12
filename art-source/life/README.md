# Technician — single-design animation

Version 1.2.1 uses one original ImageGen drawing: `assets/scene/relay-operator-design.png`. `prompts.json` preserves the exact built-in generation prompt. The original file is unchanged; the runtime imports source rectangle (303,182,466,1129) once, sampling it to 24×56 logical pixels inside a 36×72 texture. Metadata is in `assets/scene/relay-operator.json`.

The generator supplied a pale matte. Import keys minimum RGB ≥190, then flood-fills only neutral residue connected to the transparent outside (minimum >120, channel range <18). Interior colors are not globally replaced by a lower threshold. This removes the gray remnants formerly visible beside the thigh and calf.

The texture pivot is (16,64); its scene foot is (574,707). At 420×150 the final sprite is drawn directly on native pixels, with no second fractional shrink. Higher-resolution cinematic views use the same source placement.

`src/relay-life.js` is the editable animation source. It samples a 12 fps decorative timeline, performs small connected head and wrist movements, and keeps every lower-body pixel fixed. Idle breathing is represented by quiet coat shading; it never shifts the silhouette. Three cool marks belong to the diagnostic pad and follow the wrist. The idle cycle is 27.6 seconds, with diagnostic activity and a brief glance spaced apart. Resolved action signals can prompt pad activity.

The scene owns the clock and frame loop. The operator creates no timers, uses no gameplay randomness and pauses with the parent during mini-games and hidden windows. Reduced motion/static mode uses a neutral frame. Disposal releases the cached pixels and image. `getDiagnostics()` and `exportFrame()` provide read-only inspection data and PNG output for authoring.

The cinematic exporter writes `intro-atlas.png` and `intro-operator.json` from 72 warmed runtime frames at 12 fps. The packed Blender scene reads this transparent sequence and applies no additional body-scale animation. See the exporter and Blender README for reproduction.

The new design was reviewed against a geometric rig study and the rejected six-pose character. The geometric study stayed consistent but looked like a mannequin; the single drawing better matches the room. Captured motion revealed matte specks and a breathing jump; both were corrected before integration.

Technique references: [Derek Yu's pixel-art tutorial](https://www.derekyu.com/makegames/pixelart.html) discusses readable shading clusters, controlled outlines and palettes. [Aseprite's onion-skin documentation](https://www.aseprite.org/docs/onion-skinning/) describes adjacent-frame comparison. These guided inspection; neither supplied an asset.

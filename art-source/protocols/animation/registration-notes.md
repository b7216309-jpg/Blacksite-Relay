# Hardware animation visual review targets

The accepted 1.3.0 PNGs were inspected at source size and in their real 420 × 650 game compositions. Runtime effects must be separate from these original images.

## Physical sources, in native logical pixels

| Device | Physical sources | Visual cautions |
| --- | --- | --- |
| Bypass | Cyan lenses around (23,123), (68,282), (338,277), (346,277), (354,277). Amber core around (210,202); copper windings to its sides. | Existing bitmap lamps are already bright. Dim/bright modulation and small registered highlights should retain the lens texture. The protocol has no preparation phase: a resolved successful stop needs a brief hardware response during its continuing active phase. |
| Injection | Left bezel lamps around (29,258), (29,274), (29,289); right lenses around (389,295), (389,312); lower-bezel lamps around (322,407), (336,407); lower controller bank around (97/107/116/126,565). | Keep the real command, native input, progress line, time and error readout completely clear. Any physical keyboard glints should read as machinery, not additional playable keys. |
| Memory | Amber lenses around (342,130), (43,353), (95,506), (342,543); PCB contact around (144,164); upper copper fin bank x274–307, y155–172; bottom copper bus. | The upper-right lens is next to the timer. Confine its halo to hardware to the right of x338. Keep all grid pixels and labels untouched; decoration must never hint at remembered targets. |

## Acceptance checks

- Native pixels: no interpolated floating highlights, oversized spark trails, whole-image flashing, white opaque rectangles or screen-wide scan effects.
- Each device visibly changes with time in normal play. Pulses originate in lamps, coils, copper paths or contacts.
- Subdued active motion; stronger contact sparks during preparation/results and after a resolved Bypass stop. No timing changes or input waits.
- Inspect the strongest frame as well as calm frames, with actual native controls and enlarged hardware details.
- Include alpha-mask checks around every protected control/label region over a complete presentation cycle, then inspect actual screenshots rather than relying only on diagnostic counts.
- Original PNG bytes remain identical to 1.3.0. Reduced, off, hidden, inactive and failed-art modes have no stray light or active decorative scheduler.

This is the review specification; observed results will be recorded separately after implementation.

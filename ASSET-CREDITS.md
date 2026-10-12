# Risk_v2 — Blacksite Relay asset credits

## Free/open-source release — 1.8.2

Project-owned code and included assets now use GPL-3.0-only. The owner confirmed
permission for the four supplied Neon arrangements on 12 October 2026.
See ASSET-LICENSE.md for the current scope and third-party exceptions.

The selected Industrial Terminal icon is original ImageGen artwork, with its
unchanged master, prompt and reproducible size exports in `art-source/icon/`.
It replaces the cat-and-CRT icon from 1.8.1.
The baseline `son/` recordings and unused `music-original.ogg` are excluded from
the public source and new package. The earlier production notes below describe
historical versions; references to those old assets do not include or relicense them.

Version 1.8.0 retains the accepted game artwork and supplied soundtrack unchanged.
Its current 40-second trailer captures the final game, uses a bar-aligned edit
of the four Neon tracks, and mixes the exact sound effects shipped in the game.
The edit generator, source hashes and cut list are in
`art-source/audio/neon-soundtrack/edit-trailer-music.py` and
`trailer-music-40s.json`; current capture evidence is in `art-source/trailer/gold/`.
Earlier media below remains historical provenance.

Version 1.6.5 imports the four user-supplied Neon soundtrack arrangements without
editing their OGG audio. Supplied scores, generator and exact hashes are under
`art-source/audio/neon-soundtrack/`; WAV masters are delivered separately in
`Soundtrack-Masters.zip`. Runtime pacing and mix gains are new presentation code.

Version 1.6.4 added six original ImageGen upgrade-card backgrounds, stored in
`assets/upgrades/` with exact prompts and provenance in `art-source/upgrades/`.
The full-resolution generated PNGs are retained unchanged and displayed through
decorative CSS layers. Existing scene art, animation and sound effects remain from the
preserved releases. This file records the provenance of the game and its presentation
assets. New visuals, sound effects and video were created for this project. Current
music comes from the user's supplied folder; retained earlier trailers use the
original repository music. No paid
asset pack or third-party video footage was used.

The 1.6.0 scene discoveries add four original ImageGen prop sheets and six
original synthesized effects. Generated PNGs remain unmodified; runtime canvas
import keys the flat magenta matte and registers native crops. Exact prompts,
source hashes, crop metadata and inspection evidence are under
`art-source/easter-eggs/`. Audio generation source is
`art-source/audio/compose_easter_eggs.py`; the six WAV masters and measured levels
are under `art-source/audio/easter-egg-masters/`. No sampled third-party sounds
were used. The new spoiler preview records the implemented game and uses the
original repository music and these project-created effects.

The retained 1.5.1 achievement rework added no new raster art or music. It
preserved the accepted presentation assets, including the five submenu rooms.
The unranked cards, check marks and progress bars are original HTML/CSS interface work.
Leeroy Jenkins and Hearthstone are textual references to World of Warcraft and its
community; no Blizzard artwork, icons, dialogue recordings or music are bundled.
See EASTER-EGGS.md for reference sources and the implemented discoveries.
The retained scene-discovery screenshots and spoiler preview show 1.6.0;
historical upgrade-card screenshots show 1.6.4. The older preview and trailer
show 1.3.1 and predate the guide, submenu rooms and later rule fixes. The local
1.8.0 delivery contains fresh screenshots and a current trailer.

## Original game

**b7216309-jpg — Risk_V2**: original game identity, hacking mechanics, progression,
upgrades, prestige, achievements, mini-games and Electron application foundation.
The finish starts from commit `ae6411e8db7d6b366f51a9ef629112df1e8c84d2` in
[the original repository](https://github.com/b7216309-jpg/Risk_V2).

The old icon and ISC package declaration belonged to the private baseline.
The public release replaces that icon and uses an explicit GPLv3 license.

## Art and interface

**Procedural protocol hardware effects (1.3.1):** localized pixel LEDs, core light,
sparks and sweeps are drawn by `src/relay-protocol-life.js`. Original generated
backplates are unchanged. Definitions and review notes are under
`art-source/protocols/animation/`; functional controls remain separate HTML.

**Original ImageGen minigame devices (1.3.0):** `assets/protocols/` contains the
bypass calibrator, injection CRT and corrected memory patch bay. They were
generated for this game with the built-in ImageGen tool and retain their original
PNG bytes. Live commands, target zones, ports, labels and controls are composed
separately in HTML. Prompts, the targeted memory-recess revision and original
output hashes are in `art-source/protocols/prompts/` and `selected-assets.json`.
The earlier narrow memory draft is excluded from the release.

**Original ImageGen environment art, directed and generated with Codex**: three
concepts—Neon Safehouse, Ghost Grid and Blacksite Relay—were made for this game.
The user selected Blacksite Relay. Its runtime artwork is
`assets/scene/blacksite-relay.png`, an original 1536 × 1024 generated environment.
The concept package preserves the original images, boards and generation prompts
at `concepts/prompts.json` inside `Risk_v2-Three-Concepts.zip`.

**Original ImageGen technician art (1.2.1):** `assets/scene/relay-operator-design.png`
is a new single character generated for this room with the built-in ImageGen tool.
The original PNG is retained unchanged. Exact prompt and import notes are in
`art-source/life/`; crop and native-grid metadata are in `assets/scene/relay-operator.json`.
`src/relay-life.js` authors connected motion and diagnostic-pad details from that drawing.
Its one-time import keys the pale matte and removes only background-connected neutral
residue. The six separately generated poses from 1.2.0 are retired. Blender uses the
transparent 72-frame atlas exported from the corrected runtime.

**Original ImageGen pets (1.2.2):** three original drawings—rat, server cat and
copper-coil snail—were generated with the built-in ImageGen tool. The untouched
PNGs are `assets/scene/relay-{rat,cat,snail}-design.png`; exact prompts, editable
animation/export sources and import notes are in `art-source/pets/`. Native sizes,
pivots and routes are documented in `assets/scene/relay-pets.json`.
`src/relay-pets.js` animates four residents from these three consistent drawings.
The generated pale matte is removed during import; the originals are preserved.

**Original surface-lighting authoring (1.2.3):** `src/relay-lighting.js` and
`assets/scene/relay-lighting.json` define native pixel light fields and receiving
surfaces around the original room. The pass is authored code, not a replacement
ImageGen image. `art-source/lighting/` preserves the editable definitions, exporter
and prior renderer used for comparison. Blender uses explicit shade and irradiance
maps with an sRGB compositor match; original room and resident textures are unchanged.

**Reactor and computer activity authoring (1.2.4):** the palette, chamber mask and
registered LED banks are authored in `src/relay-scene.js`, with inspection metadata
in `assets/scene/relay-electronics.json`. Five small derived color patches retain
the original chamber's brightness and pixel structure. A native electronics atlas
reproduces these code effects in Blender. The source room and pet drawings remain
unchanged; the snail's smaller left-facing presentation is a runtime pixel-grid change.

**Resident shadow authoring (1.2.5):** `src/relay-shadows.js` projects the current
original sprite silhouettes onto authored room receivers, with native contact shading
and a one-pixel soft edge. `assets/scene/relay-shadows.json` records the profiles and
surface polygons. The native shadow atlas and editable Blender integration are in
`art-source/shadows/`. This is code-authored scene shading; no original sprite or room
image is repainted, and no external asset pack is used.

The Blacksite interface layouts, inline SVG symbols, CSS animation and Canvas scene
effects were authored for this finish. Functional text and controls are rendered
separately from the generated art. System fonts are referenced by CSS; no commercial
font file is bundled.

**Original Blender authoring**: `art-source/blender/build_blacksite.py` creates the
packed `art-source/blender/Blacksite_Relay.blend` scene. It combines the selected
ImageGen artwork on registered depth layers with a registered wall fan, clipped CRT activity, status
lights, filaments, cable contacts, vapor, the original operator and a six-second camera reveal. This is a
2.5D projection scene with modeled animated details; the background image is packed
in the editable file. Runtime and share encodes are `assets/scene/intro.webm` and
`assets/scene/intro.mp4`. See `art-source/SCENE.md` for reproduction and verification.

## Music and sound design

**Current Neon soundtrack (1.6.5):** Neon Standby (96 BPM), Backstreet Signal
(112 BPM), Chrome Pursuit (128 BPM), and Redline Protocol (160 BPM), supplied by
the user. The supplied README describes procedural composition with no third-party
samples. Its synthesis source was read but not executed during import; this credit
records the supplied provenance rather than independently certifying authorship.
All four runtime OGGs match their source hashes and loop over their full 60 seconds.
See `SOUNDTRACK.md` and `art-source/audio/neon-soundtrack/` for pacing and measurements.

The four scores replace in-game use of the previous track. Existing mechanical
ambience and all 28 sound effects remain. The following original-music sources
are retained for earlier media and history.

**Original Risk_v2 soundtrack:** `son/backgroundloop.mp3` from the baseline repository.
The source does not name a composer; no new authorship is claimed for this track.
A byte-identical source copy is in `art-source/audio/original/backgroundloop.mp3`.
`restore_original.py` removes its silent tail, adds headroom and bakes a 7.5-second
loop overlap. The original arrangement is retained without pitch or tempo changes.

**Blacksite mechanical ambience and 22 sound effects** are synthesized locally by
`art-source/audio/compose.py`; no external sample library was used. The earlier
replacement score is retired and excluded from the current release.

- Earlier audio set: 24 Ogg files: original music, mechanical ambience and 22 cues,
  later joined by six discovery effects. The original score is no longer selected.
- Retained masters: 25 stereo 44.1kHz / 24-bit WAVs, including the original music loop and
  `trailer-original-music-40s.wav`.
- Provenance/rebuild: `art-source/audio/README.md`, `restore_original.py`,
  `compose.py`, `audio-manifest.json` and `original-music-validation.json`.
- Objective waveform, actual playback, loop-boundary and output checks are recorded
  in the audio verification reports. No subjective listening review is claimed.

## Trailer

**Current 40-second, 1920 × 1080 trailer**, composed from the Blender reveal,
the game's own animated artwork and captured gameplay. The editable timing and
composition are in `scripts/render-trailer.cjs` and `art-source/trailer/gold/stage.html`;
current production notes, source hashes and action capture logs are in
`art-source/trailer/gold/`. Parent-folder records describe earlier films.

The gameplay is a scripted showcase with a demonstration save and fixed random
rolls; the game itself calculates rewards, risk, bypass and extraction. It is not
presented as a typical or unassisted playthrough. Audio uses the four supplied Neon
arrangements and existing Blacksite cues. The delivered film is `Blacksite-Relay-Trailer.mp4`, accompanied
by `Blacksite-Relay-Trailer-Poster.png` and the separate intro MP4.

## Tools and dependencies

Electron and Chromium run the game; Electron Builder/NSIS produce the local Windows
package. Blender authors the scene; NumPy implements synthesis; FFmpeg encodes and
checks media; Playwright supports isolated capture and UI verification. Their own
licenses apply to their software. These tools are production/runtime dependencies,
not sources of stock art, commercial music or footage. The packaged game does not
require users to install the authoring tools.

## 1.4.0 submenu rooms and visual guide

Five original Blacksite room illustrations (workbench, records, signal, controls and briefing) were generated with the built-in ImageGen tool, using the accepted relay room as a style reference. The unmodified masters are bundled under assets/menus/. Exact prompts and selected-file hashes are in art-source/menus/. No paid or third-party stock artwork was used. The How to play guide uses the existing native SVG icon set, CSS diagrams and separately rendered English text. Submenu lighting and guide navigation are original project code. Existing scene, characters, pets, music, intro and protocol backgrounds remain unchanged.


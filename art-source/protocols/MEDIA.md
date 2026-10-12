# Protocol media sources

`scripts/render-protocol-preview.cjs` composes three actual native 420×650 game windows inside a 1920×1080 film. The 24-second timeline contains two passes: successful Injection, Memory and Bypass outcomes, then typing timeout, three wrong memory selections and a bypass miss. It uses isolated advanced demonstration saves and 15 real hacks to charge Bypass; it does not read or write a real save or contact a leaderboard.

The protocol appearances and inputs are scripted for filming. The runtime generates the command and memory targets from deterministic seeds. Both three-second preparation windows, the seven-second typing deadline, eight-second memory deadline, target positions, error counters and rewards remain under the real game functions. Successful Bypass stops occur only when its moving gauge reaches the real target. The second miss occurs outside the real target, without moving the gauge.

The film keeps the original `art-source/audio/masters/music-original.wav`, mixed at 0.65 gain with a one-second opening fade and 1.5-second closing fade. Audio QA covers source hashes, full decoding, loudness and peak measurements; it does not claim human listening.

From the source directory:

```text
node scripts/render-protocol-preview.cjs --rehearse
node scripts/render-protocol-preview.cjs --preview
node scripts/render-protocol-preview.cjs
node scripts/render-trailer.cjs --preview
node scripts/render-trailer.cjs
node art-source/trailer/review-final.cjs
python art-source/trailer/verify-title-continuity.py
```

`--rehearse` verifies the timeline and actual outcomes without capturing images or encoding a video. `--preview` captures selected frames. Defaults use `../protocol-environments/media` for intermediates and `outputs/Blacksite-Relay-<version>` for delivery; `--work=PATH` and `--output=PATH` override them. Playwright, Chromium and FFmpeg are required. `PLAYWRIGHT_CHROMIUM_EXECUTABLE` selects a compatible browser installation. The final preview stage and report are kept as `preview-stage.html` and `preview-verification.json`; trailer sources live in `art-source/trailer`.

The room, operator, pets, resident shadows, original soundtrack, both six-second intro encodes and editable Blender scene are preserved from 1.2.5. `source-preservation.json` records the immutable input checks. Six exact prior UI/presentation files are preserved in `before-1.2.5`, with delivered-archive provenance for comparison. These references are source material, not an alternative shipped runtime.

The new PNG backplates are used unchanged. `selected-assets.json` records their origin and hashes; `prompts/device-backplates.json` and `prompts/memory-recess-revision.txt` retain the authoring prompts. The accepted Memory correction is `assets/protocols/memory-patch-bay-v2.png`. The rejected narrow draft is excluded from the user-facing archives.

Final encoded verification: the preview is 6,389,293 bytes, exactly 24 seconds / 576 frames / 24fps, with complete decoding and zero browser errors. Original audio measures -23.45 LUFS and -6.03 dB true peak. Seven decoded frames at 1, 4.5, 7, 9.5, 14, 17.5 and 22.5 seconds were inspected. All three real successes and failures are preserved in preview-verification.json. Root approved the 1-second and 4.5-second trial frames and final native phases in ROOT-REVIEW.md.

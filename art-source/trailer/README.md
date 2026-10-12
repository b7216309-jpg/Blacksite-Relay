# Blacksite Relay trailer

The 1.3.1 trailer runs exactly 40 seconds at 1920×1080 / 30 fps. It now shows all three real mini-games: Injection in its CRT, Memory in its patch bay and Bypass beneath the calibrator. The 420×650 game remains readable at 1.5× scale. A 1038×371 detail panel shows current device hardware at 3× during protocols and the live room outside them; the accepted Blender reveal and animated end card retain the original room, operator, pets, resident shadows and lighting.

The film is recorded from the actual shipped interface through a localhost server with isolated mock IPC. It reads no real saves and makes no leaderboard requests or score submissions. The demonstration save supplies 15 RAM, 7 Miner, 4 VPN and 8 Fan levels, with prestige level/points 2. Nine real pre-roll hacks prepare the session before the opening shot; six further hacks and a Proxy purchase are visible. No gameplay balances, gauges, cells or deadlines are repositioned for the film.

Hack rolls are fixed at 0.99999. Injection and Memory appearances are explicitly triggered, and their real phrase/target generation uses deterministic seeds. The actual three-second preparation periods and input handlers then resolve the outcomes. Bypass stops are issued only when its real moving gauge reaches the target. This is a controlled demonstration, not a typical or unassisted playthrough. The resulting protocol rewards are typing: Multiplier +5; backdoor: Funds +$48 · Trace −25 points; bypass: Trace −6 points. Actual extraction banks $6532.00 at 33.47% trace.

## Reproduce

Run from the source directory:

```text
node scripts/render-trailer.cjs --rehearse
node scripts/render-trailer.cjs --preview
node scripts/render-trailer.cjs
node art-source/trailer/review-final.cjs
python art-source/trailer/verify-title-continuity.py
```

Playwright and ffmpeg-static are development dependencies. Set PLAYWRIGHT_CHROMIUM_EXECUTABLE to a compatible Chromium binary when the original authoring installation is unavailable. Defaults write intermediates to ../protocol-animation/media/trailer and delivery to outputs/Blacksite-Relay-<version>; --work=PATH and --output=PATH override them. The original intro PNG sequence can be selected with --intro-frames=PATH; otherwise the script reconstructs frames from the unchanged bundled WebM and verifies its source hash. The editable HTML/CSS stage, exact actions and audio mix live in the capture script; final stage, action/state logs, picture master and FFmpeg reports remain in this directory.

| Time | Sequence |
|---|---|
| 0–5s | Accepted Blender reveal and title |
| 5–10.7s | Actual hacks, Proxy and room details |
| 10.7–18.2s | Injection preparation and successful command input |
| 18.2–25.6s | Memory reveal, recall and successful reward |
| 25.6–31.8s | Actual Bypass stops and trace reduction |
| 31.8–35s | Actual extraction recap |
| 35–40s | Animated end card and musical resolution |

The original soundtrack master is art-source/audio/masters/trailer-original-music-40s.wav: the first 40 seconds of the repository track, with existing 0.85 headroom gain, 0.2-second fade-in and 3.75-second fade-out. The trailer mixes that unchanged master at unity gain and places available original cue masters at real outcome timestamps with 0.28 gain. A final limiter controls overlap. H.264 picture uses YUV420p, BT.709, a two-second closed keyframe interval and no B frames; audio is 48kHz stereo AAC at 256kbps.

The final film is 27,725,531 bytes, 40.00 seconds and 1200 frames. Full decoding, zero-browser-error capture, exact fast-seek comparisons and all 15 decoded-frame reviews pass. Audio measures -17.95 LUFS integrated and -1.67 dB true peak. The 108-frame end-card audit has maximum changed bright-pixel fraction 0. See verification-1.3.1.json and title-continuity.json for measurements.

Device animation capture is read-only: art-source/protocols/animation/hardware-detail.js combines the actual native effect canvas and unchanged backplate with the same shade order. A 346×123 crop fills the 1038×371 detail panel at exactly 3× nearest-neighbor scale with 1px vertical padding. Interface controls stay in the actual portrait game view. Animation diagnostics and crop coordinates accompany the capture log.

The 21 unchanged room/resident/shadow/intro/music/device inputs are verified in art-source/protocols/animation/source-preservation.json. No PNG is retouched and no intro or Blender source is regenerated. Original generation prompts and selected hashes remain under art-source/protocols; the exact previous UI and media scripts remain in animation/before-1.3.0. Root's independent review is animation/ROOT-REVIEW.md.

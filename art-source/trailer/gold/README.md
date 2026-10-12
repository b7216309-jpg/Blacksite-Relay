# 1.8.0 gameplay trailer

The 40-second, 1920 × 1080, 30 fps trailer captures the current game in an
isolated browser. It uses an advanced demonstration save, fixed hack rolls,
seeded protocol appearances and actual input/outcome handlers. This is a
scripted showcase, not an unassisted playthrough. `capture-log.json` records
the real rewards, all three protocol successes and the final extraction.

The first five seconds use the existing six-second Blender intro. The portrait
game stays at its native 420 × 650 layout, enlarged to 630 × 975 in the
landscape composition. The left panel shows enlarged live scene and device
details. The last five seconds contain the title and end card.

Music is edited from the four accepted Neon soundtrack files; original tempos
and pitches are retained. The accelerated progression belongs to the trailer
only. In-game time/score pacing is unchanged. Cues use the bundled OGG effects.

After `npm ci` and installing Playwright Chromium, run from the repository:

```powershell
python art-source/audio/neon-soundtrack/edit-trailer-music.py --output ../gold-release/audio
node scripts/render-trailer.cjs --preview --fps=10
node scripts/render-trailer.cjs --fps=30 --music=../gold-release/audio/trailer-music-40s.wav
```

`--work=` and `--output=` override the default authoring and release directories.
`stage.html`, `audio-filter.txt`, the capture log and `media-manifest.json` are
included here. The silent picture master and music WAV are delivered in
`Creator-Masters.zip`; they are generated intermediates, excluded from Git.
The soundtrack masters remain in the separate `Soundtrack-Masters.zip`.

Validation includes full video/audio decode, 1,200 video frames, metadata,
measured audio peak/loudness, and inspected frames across the timeline.
Technical audio validation is not a claim of human listening sign-off.

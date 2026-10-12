# Original Risk_v2 soundtrack + Blacksite sound effects

> Historical music-restoration notes. The current GPL release uses the four Neon
> tracks in `neon-soundtrack/`. The old source recording and restored OGG are
> excluded; the restoration scripts below need an independently licensed input.
> The original procedural ambience/SFX generator remains supported and included.

The game now uses the **original music from `son/backgroundloop.mp3`**, as requested
by the user. It does not layer the first-pass synthesized calm/pulse/critical/menu
score underneath. The same original arrangement continues across screens; menus
play it quieter. Blacksite sound effects and mechanical room ambience are retained.

## Preserved source and loop edit

`original/backgroundloop.mp3` is a byte-for-byte copy of the repository soundtrack.
Its SHA-256 is recorded in `original-music-validation.json`. Provenance is the
original b7216309-jpg/Risk_V2 repository at baseline `ae6411e8`; the supplied source
does not name its music composer, so no new authorship is claimed for that track.

Signal analysis found 225 seconds of music followed by 3.75 seconds of near-silence
in the 228.75-second file. Energy periodicity is consistent with approximately
128 BPM, making the active arrangement 120 bars. The decoded MP3 has one sample
slightly above full scale (+0.083 dBFS); the edit applies 0.85 gain for headroom.

`restore_original.py` removes that silent tail and bakes a **7.5-second / four-bar
equal-power transition** from the closing music into the original opening.
The runtime buffer stays 225 seconds long. First playback begins at 0, preserving
the familiar intro. Web Audio then loops from 7.5 to 225 seconds, giving a 217.5-second
repeat period whose boundary meets the next untouched opening sample. Original
breakdowns and phrasing remain; no pitch shift, time stretch or new music is added.
The overlap is baked into the asset, so playback uses one looping source without
timers or duplicate-music scheduling.

Rebuild with Python 3, NumPy and FFmpeg/libvorbis:

```text
python art-source/audio/restore_original.py
python art-source/audio/verify_audio.py
node art-source/audio/test-mixer.cjs
```

The rebuild accepts the baseline `son/backgroundloop.mp3`, or falls back to the
preserved `art-source/audio/original/backgroundloop.mp3` when working from a merged
source/art archive. It writes `assets/audio/music-original.ogg` and its 24-bit master
at `art-source/audio/masters/music-original.wav`.

## Runtime mixer and cues

Load `src/relay-audio.js` before the gameplay renderer. `window.RelayAudio` exposes
`unlock`, `setVolumes`, `setState`, `play`, `stop`, `dispose` and `getDiagnostics`.
Keyboard or pointer input unlocks sound. Independent music/ambience and SFX
parameters use 0–1; a saved zero stays muted. Normal music gain is 0.82, menus use 0.50
and result screens 0.33 before the user volume. Changes ramp over 0.8 seconds.
Changing risk does not add musical layers or restart the track.

The room ambience is a quiet, non-musical 20-second synthesis of fans, mains hum,
air and mechanical details. `compose.py` deterministically creates that ambience
and 22 individual sound effects from local oscillators/noise; it uses no downloaded
samples. Existing cue assets were not changed when restoring the original music.
Its default entry point now regenerates only ambience and cues, retaining the
previous synthesis random-state positions; `--sfx-only` omits ambience export.

Dispatch `risk:state` with `{screen,risk}` and semantic `risk:event` outcomes as
before. Hack types 1/2/3 and bonuses 1–6 keep distinct sounds. Node, bypass-ready,
ghost-save, achievements, extraction, bust, prestige and mini-game outcomes are
supported. `play('intro')` uses the separate six-second intro cue after a gesture;
`stop('intro')` cancels pending decode and releases matching voices within 30 ms.
SFX cap at 16 live voices; source cleanup, visibility suspension, volume ramps and
the output soft ceiling remain active. No audio service or external request is used.

## Files and trailer

- `assets/audio/`: 24 Ogg files—restored original music, room ambience and 22 cues.
- `masters/`: 25 stereo 44.1 kHz / 24-bit WAV masters for the current delivery.
- `original/`: the unchanged original MP3 for provenance and future edits.
- `audio-manifest.json`: current assets, loop parameters and source provenance.
- `original-music-validation.json`: source hash, silence, peaks and exact loop edit.
- `audio-validation.json`: master/runtime decoding and waveform checks.
- `release-verification.md`: 1.1.1 audio inventory, package audit and verification note.
- `test-electron.cjs`, `test-playback.html`, `electron-playback-validation.json`:
  isolated real-Electron file-origin playback and loop-boundary checks.

`masters/trailer-original-music-40s.wav` contains only the original track's first
40 seconds at 0.85 gain, with a 0.2-second opening fade and a 3.75-second closing fade.
It replaces `trailer-score-40s.wav` in the current film. No abandoned F# score
should be mixed beneath it. The original arrangement's main entrance is around 15 s.

The local authoring checkout retains the retired synthesized score and first
trailer music in `unused-score/`. They are absent from the current release archives.
**Exclude that folder from the default game/source-art/music delivery.** Also exclude `.validation-profile/` and
`electron-test.*.log`; durable JSON reports are the shareable QA evidence.

The source archive contains the running game, runtime audio and authoring scripts;
the art archive supplies the original MP3 and WAV masters. Extract both into the
same parent directory to reproduce all media. `restore_original.py` supports that
combined layout. The optional `analyze_original.py` was an exploratory analysis
of the full baseline checkout and expects its legacy `son/backgroundloop.mp3`
path; it is not required to rebuild or validate the delivered audio.

## Validation limits and results

All 24 runtime assets decode successfully in Electron 44.2.0 at a local file origin,
with no audio errors. Actual playback at the production loop points 225→7.5 seconds
was measured at normal pitch/rate 1 using the real decoded buffer. The boundary
remained non-silent, with minimum measured RMS 0.0124 in the isolated test. Encoded
music peaks at −1.40 dBFS; its boundary sample difference 0.0021 is below ordinary
sample-to-sample changes. Maximum-volume cue stress peaks at 0.884 after the ceiling.

Tests also cover keyboard/mouse unlock, unchanged track across gameplay/menu/risk
states, complete mute, bounded voices, stop/cancel and disposal. Full decoded buffers
use approximately 105.94 MB. Physical test output was muted and a real Web Audio
analyser observed the graph. **No subjective listening review was performed.**

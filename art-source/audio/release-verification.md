# Audio verification — Blacksite Relay 1.1.1

Audited on 2026-09-05. This pass read the current assets and release selection rules;
it did not launch UI applications, regenerate audio or modify gameplay.

## Release-note paragraph

The original repository soundtrack is restored, with a 225-second opening playback
and a baked 7.5-second crossfade that repeats from 7.5 to 225 seconds. All 24 runtime
Ogg files decoded successfully and remained below full scale; the music measured
−1.40 dBFS peak and a 0.00211 boundary sample difference. All 16 mixer contract and
lifecycle checks passed. Earlier isolated Electron 44.2.0 file-origin playback
measured a non-silent loop transition (minimum RMS 0.0124), a maximum-volume cue
stress peak of 0.884, and no audio errors. Those are waveform, decoding and real
Web Audio graph measurements: physical test output was muted, and no subjective
listening review was performed.

## Inventory and provenance

- `original/backgroundloop.mp3` matches both the working repository original and
  the binary Git object at `ae6411e8:son/backgroundloop.mp3` byte for byte.
- SHA-256: `5bec6a66ce5035ee3a6173dfbe21f8550d0a4ea00e2c10b09eb15dd5b59f8dd9`.
- Runtime inventory: original music, a 20-second mechanical ambience and 22 cues;
  every filename and byte length agrees with `audio-manifest.json`.
- Master inventory: 25 stereo 44.1 kHz / 24-bit WAV files; every filename, byte
  length and duration agrees with the manifest.
- The runtime source, authoring script and manifests agree on first start 0,
  loop start 7.5, loop end 225 and repeat period 217.5 seconds. No pitch or tempo
  changes or replacement score layers are used.
- `masters/trailer-original-music-40s.wav` numerically matches the original track's
  first 40 seconds at 0.85 gain, with a 0.2-second opening fade and 3.75-second
  closing fade. Maximum difference after 24-bit quantization was 1.79×10⁻⁷.
- Original music attribution remains the baseline repository; its composer is
  unspecified there. New authorship applies to the synthesized ambience and SFX.

## Package selection

`work/package-release.py` selects all current audio runtime files into the source
archive. The art archive receives the unchanged MP3, all 25 WAV masters, authoring
scripts, manifests and durable verification reports. The source and art archives
share the `Risk_v2-Blacksite-Relay/` root and can be extracted together for media
rebuilding. `restore_original.py` falls back to the preserved MP3 in that layout.

The selection excludes `unused-score/`, `.validation-profile/` and diagnostic
`.log` files. No abandoned calm, pulse, critical or menu stems, or old trailer-score
master, occur in the selected audio files. The Electron package includes the same
24 current runtime files through `assets/**/*`; authoring masters are excluded.
No required audio source is missing from the combined archives. These are checks
of the release selection and existing source files; final built-archive and final
trailer verification are separate release checks.

## Scope of measurement

This final pass independently decoded every runtime asset with FFmpeg, checked
finite samples and peaks, inspected master headers and compared original source
and trailer samples. It also reran all 16 non-UI mixer tests. The retained
`electron-playback-validation.json` records earlier real file-origin playback of
these same audio assets, including keyboard/mouse unlock, volume handling,
bounded voices and cleanup. It is not a new UI run during integrated release QA.

The revised film has its own `art-source/trailer/audio-verification.txt`; its final
loudness and mix cannot be inferred from the music master or the previous film's
measurements. A full-length subjective music or trailer listening review remains
unperformed.

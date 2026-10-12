# Supplied Neon soundtrack import

Four user-supplied original arrangements were imported without audio edits. The supplied generator and README were inspected as source material; the generator was not executed. The source folder remains unchanged. `manifest.json` records every source hash and the exact runtime copies. WAV masters are kept outside the repository for a separate soundtrack-master archive.

| Runtime key | Tempo | 4/4 bars | Beat / bar duration | OGG loudness | OGG true peak | Suggested track gain |
| --- | ---: | ---: | --- | ---: | ---: | ---: |
| neon-standby | 96 BPM | 24 | 0.625 / 2.5 s | −14.55 LUFS | −1.06 dBTP | 0.475883 |
| backstreet-signal | 112 BPM | 28 | 0.535714 / 2.142857 s | −12.48 LUFS | −1.05 dBTP | 0.529663 |
| chrome-pursuit | 128 BPM | 32 | 0.46875 / 1.875 s | −12.96 LUFS | −0.91 dBTP | 0.559758 |
| redline-protocol | 160 BPM | 40 | 0.375 / 1.5 s | −11.81 LUFS | −0.95 dBTP | 0.490343 |

The suggested gains target −21 LUFS for the menu and −18 LUFS for each gameplay track before the existing user volume and master bus. They are an initial advisory level-match proposal and were **not adopted**. The runtime director instead owns its normalization separately (currently targeting −15 LUFS before its existing screen, user and master gains). No gain was rendered into the source OGG files. Subjective listening approval is not claimed.

## Loop boundaries

Every WAV and Vorbis file independently decodes to **2,646,000 stereo frames at 44,100 Hz**, exactly **60 seconds**. All arrangements finish on complete bar boundaries. Use loop start **0 seconds**, loop end **60 seconds**, with the end exclusive. The supplied OGG tags agree: `LOOPSTART=0`, `LOOPEND=2646000`. In a resampled Web Audio buffer, retain these second values or use its verified 60-second duration; do not use 2,646,000 as a frame index at another sample rate.

The generator uses circular note-release placement, circular delay/room taps, a periodic filter and a final 256-sample boundary correction. The supplied WAV endpoints match exactly. The Vorbis endpoints differ slightly after lossy compression: the largest channel delta is 0.007085 full scale, no more than 16.2% of the nearby 99th-percentile ordinary sample differences. All decoded samples are finite and no samples clip. There is no silent intro/outro to trim. Exact endpoint, derivative, RMS, decode and loudness measurements are in `technical-audit.json`.

No additional tail crossfade, silence removal, normalization render or re-encoding is recommended. In particular, the previous repository track's 7.5-second loop start must not carry over to these clips. Each new track already contains its wrapped tails.

## Transition advice

These are complete arrangements at different tempos, not synchronized stems. Play one chosen track at full intended level. Overlap only for a bounded transition, then stop and disconnect the outgoing source. The related D-minor harmony supports transitions, but the drums should not remain layered.

Start the incoming track at its downbeat (offset 0). A short equal-power crossfade around 180–250 ms prevents hard gain jumps without creating a long competing drum pattern. If the game can tolerate a musical response delay, schedule the switch at the next outgoing beat or bar; do not delay gameplay or success/failure feedback. A beat wait is at most 625 ms; a bar wait is at most 2.5 seconds. Coalesce rapid target changes and use hysteresis/minimum dwell to avoid repeated restarts near risk thresholds. Keep existing volume preferences as a separate bus multiplier.

All four bar grids share 15-second alignment points when started together, but waiting up to 15 seconds is unsuitable for responsive risk music. Their arrangements also differ harmonically at many of those points. Do not infer that their equal 60-second length makes them interchangeable synchronized layers.

## Review limits

FFmpeg decoding and loudness measurements were performed locally. No callable subjective audio-listening tool was available during this asset audit, so no claim of listening through the tracks is made. Separate real Web Audio loop/transition playback checks are owned by the runtime validation task. Local four-second seam-audition WAVs under `work/soundtrack-prep` contain the final two seconds followed by the first two seconds for a reviewer to audition.

`SUPPLIED-README.md`, `SUPPLIED-VERIFICATION.json`, the four score JSONs and `make_soundtrack.py` retain their supplied bytes. Their descriptive claims are provenance, not additional instructions or independent verification.

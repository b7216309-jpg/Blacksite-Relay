# Neon soundtrack

Introduced in 1.6.5 and retained in the 1.8.0 local gold release.

The four tracks supplied in `neon_roguelike_soundtrack` replace the previous
in-game music. Their OGG files are imported without audio edits or tempo changes.
Each is stereo 44.1 kHz, 60 seconds, with a complete loop from sample 0 to
2,646,000 exclusive. Wrapped tails are already present in the supplied audio.

| Track | Use | Pacing |
| --- | --- | --- |
| Neon Standby, 96 BPM | Menu, upgrades, guide, settings and results | Quieter menu mix |
| Backstreet Signal, 112 BPM | New run | At least 60 seconds |
| Chrome Pursuit, 128 BPM | Established run | 60 active seconds and 50 score units; otherwise at 120 seconds |
| Redline Protocol, 160 BPM | Sustained high-scoring run | 150 active seconds and 500 score units; otherwise at 240 seconds |

Every gameplay stage lasts at least 60 active seconds. A very large score cannot
skip the middle track. After increasing, the tempo stays there until the run ends.
The fallback times let slower runs hear the full soundtrack too.

Score units adapt to permanent earning power. One unit is an unmultiplied
Standard Hack at the start of that run:
`20 × (1 + 0.2 × Miner level) × (1 + 0.1 × prestige points)`.
Progress uses the larger of cumulative successful hack earnings and peak run
funds above the starting grant, divided by that unit. Banked funds and starting
grants do not count. Spending does not undo progress. Values saturate safely;
million-, trillion- and larger scores still obey the same minimum play times.

Visible gameplay and all three mini-games count toward the clock. Menus,
settings, intro replay, hidden windows, locked/suspended audio and quit prompts
pause it. Muting music does not reset the run's progression. Long scheduler gaps
are treated as suspension instead of skipping ahead. A new run starts afresh;
an old event or snapshot cannot revive a completed run.

The tracks are separate arrangements at different tempos, so the mixer plays
one score at a time. Gameplay transitions start at an outgoing bar boundary
with a short crossfade. Menu transitions use a gentle fade. The score files
loop through Web Audio loop points, without restarting them from a timer.
Their measured loudness is matched through runtime gains, with a quieter menu
envelope, retained low mechanical ambience, independent music/SFX volumes and
bounded overlapping sound effects.

`src/relay-music-director.js` makes presentation decisions from read-only run
metadata and resolved events. It does not change scores, timers, random draws or
the save format. `src/relay-audio.js` handles playback and source cleanup.

Supplied source, exact hashes and technical measurements are under
`art-source/audio/neon-soundtrack/`. The supplied generator was inspected, not
executed during import. `Soundtrack-Masters.zip` retains the complete supplied
folder including the four WAV masters. The supplied README describes original
procedural composition without third-party samples; this import does not add
an independent authorship claim.

Runtime checks and recorded audition material accompany the release. This
session cannot hear audio input, so waveform, decoded-loop, mix-output and
interaction checks are documented separately from subjective listening review.
The 1.8.0 trailer uses a forty-second edit of the accepted Neon tracks, with
original tempos and pitches retained. Its compressed musical progression is
specific to the montage; game pacing is unchanged. Earlier trailers use their
earlier soundtrack and are explicitly historical.

For current source validation, run `npm test` and
`node scripts/verify-soundtrack.cjs`. The audio check uses an isolated profile,
records the actual Web Audio output, and never changes the OS volume or player
saves. Set `RISK_V2_QA_DIR` for its report directory and `RISK_V2_EXECUTABLE` to
check an extracted packaged executable. Its shortened demonstration accelerates
only the director's test clock; the playback clock and loop audio run normally.
Then run `node scripts/analyze-soundtrack-output.cjs` with the same report
directory to decode and measure the recorded mix. For native window visibility,
`npx electron scripts/verify-soundtrack-visibility.cjs` checks real hide/show
without browser automation overriding Chromium focus or visibility.
Earlier tests under `art-source/audio/` target the historical single-track score;
they are retained as authoring history, not the current soundtrack test command.

# Neon Roguelike — original synth soundtrack

Four instrumental tracks, each exactly 60 seconds, composed and synthesized for a cyberpunk pixel-art roguelike. No third-party samples or existing song recordings were used.

| Track | Tempo | Bars | Suggested use |
| --- | ---: | ---: | --- |
| 01 — Neon Standby | 96 BPM | 24 | Main menu, loadout, upgrades: soft neon pads, bell melody, restrained half-time drums |
| 02 — Backstreet Signal | 112 BPM | 28 | Exploration and early rooms: syncopated bass, measured drums, short melodic calls |
| 03 — Chrome Pursuit | 128 BPM | 32 | Standard combat: driving kick, pulse arpeggios, a quieter middle section |
| 04 — Redline Protocol | 160 BPM | 40 | Elite rooms, danger, bosses: fast hats, octave bass, high lead, a brief breakdown |

All tracks use 4/4 and related D-minor harmony. These are standalone arrangements; they are not intended as synchronized layers.

## Importing into your game

- WAV: stereo, 44,100 Hz, 16-bit PCM. Best source for importing into a game engine.
- OGG: stereo Vorbis, quality 6. Smaller ready-to-use alternative.
- Enable looping over the entire clip: start sample **0**, end sample **2,646,000 exclusive** (60 seconds).
- OGG files also contain LOOPSTART and LOOPEND tags; engines may require their own loop settings.
- Delay and room tails are wrapped into the start. There is no intro or ending fade. Fade in/out using your game's music volume control if desired.
- Tracks retain headroom below 0 dBFS. Set their in-game gain to leave space for gameplay sound effects.

## Editable source

`make_soundtrack.py` contains the synthesis and arrangements. Requires Python 3, NumPy, and FFmpeg on PATH. Rebuild into a folder of your choice with:

```text
python make_soundtrack.py --output rebuilt_audio
```

The accompanying `_score.json` files record pitched note events (bus, MIDI note number, start beat, length in beats, amplitude). Drums, effects, and arrangement logic are in the Python source.

## Verification

The rendered WAV files were checked for 60-second duration, stereo format, finite samples, no clipping, and matching samples at the loop seam. OGG files were decoded and checked for the same frame count. These are technical checks, not a substitute for auditioning the soundtrack against your gameplay.

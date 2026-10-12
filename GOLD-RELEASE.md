# Blacksite Relay 1.8.0 — local gold polish

This release finishes the accepted local game with a focused polish pass after
the owner's playtest. Steam distribution is a separate next step.

## Player-facing polish

- A bust now states funds lost and any money recovered through Insurance.
  Recovered funds use the success color. The recap survives the run reset and
  language changes, and reports the amount actually credited to the bank.
- Escape returns from Upgrades, Achievements and Local leaderboard; both mouse
  and keyboard return focus to the button that opened the panel.
- Menu entrances stay opaque, so the previous screen's controls no longer show
  through the new room during the short transition. Reduced motion is retained.
- Music recovers after rapidly hiding and restoring the window, even when the
  operating system acknowledges audio suspension late.
- The main room paints at at most 60 frames per second on faster displays.
  Animation still uses elapsed time; keyboard actions, hack outcomes, timers
  and the Bypass gauge retain their existing independent timing.

The accepted pixel artwork, scene lighting, screen animation, operator, two
rats, small left-facing snail, cat, shadows and five discoveries were inspected
in the running game. Existing assets were retained where no improvement was
warranted. There are no new paid assets or gameplay balance changes.

The 34 achievements, six bonuses, three mini-games, progression, prestige,
local-only records, old saves, volume controls and English/French switch keep
their existing rules and formats. English remains the default for old saves.

## Current media and editable sources

The local release includes a current 40-second 1080p trailer, the six-second
intro, English/French screenshots, supplied soundtrack masters and a creator
archive. The trailer uses current game code and the supplied Neon arrangements;
its deliberately scripted showcase resolves actual game input and rewards.
The edited music progression is compressed for the montage only, with no change
to the game's time/score pacing.

The source archive contains the editable Blender scene, generated-art originals,
prompts, crop/lighting metadata, scene code, audio generation source and the
current trailer timeline. `Soundtrack-Masters.zip` preserves the supplied music
source and WAVs. `Creator-Masters.zip` carries current sound-effect WAV masters,
the trailer music edit and silent picture master. Runtime assets are bundled
with both Windows distributions; no network service is required to play.

## Verification scope

The delivered `VERIFICATION.md` and its reports record the final source tests,
actual extracted installer checks, native screen/input/save checks, four
Electron device scales, measured extended play, audio output and media checks.
Fixtures use isolated saves. The fixed portrait viewport is unchanged; device
scale tests do not change Windows display settings. Measured frame/CPU figures
describe the available machine and are not minimum-spec promises.

Audio decoding, loop seams, output levels and transitions can be verified
technically. Those measurements are not a claim of human listening sign-off.
This local release does not configure Steam, Cloud, online leaderboards,
controller support or a public store launch.

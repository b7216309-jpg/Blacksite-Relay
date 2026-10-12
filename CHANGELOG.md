# Risk_V2 1.8.0 — Local gold polish

- Show funds lost and actual Insurance recovery on bust results, with retained language-switchable recaps.
- Make Escape and focus restoration consistent across Upgrades, Achievements and Local leaderboard.
- Keep arriving menu panels opaque to prevent old controls ghosting through their artwork.
- Fix music remaining suspended after rapid window hide/restore operations.
- Limit heavy main-room painting to 60fps while preserving elapsed animation time and independent gameplay timing.
- Refresh the 40-second gameplay trailer with the current game and supplied Neon music; package current media and editable masters locally.
- Preserve game balance, assets, saves, local records and both languages. Steam distribution remains deferred.

# Risk_V2 1.7.0 — English / Français

- Add complete French interface and field-guide text, including all 34 achievements, bonus rules, mini-games, results, local records, save errors and hidden discoveries.
- Switch language immediately from Settings and remember it in the existing local save.
- Adapt French labels and number formatting to the 420 × 650 portrait layout.
- Preserve active runs, timers, typing commands, player names, progression, audio and local leaderboard rules.
- Keep English as the default for existing saves and allow switching back at any time through Settings.

# Risk_V2 1.6.5 — Neon soundtrack

- Import the supplied 96 BPM menu track and 112/128/160 BPM gameplay tracks with their complete 60-second loops.
- Pace gameplay music by visible play time and normalized earned score, with minimum stage residence and slow-run fallbacks.
- Prevent enormous scores, banked wealth or starting grants from skipping straight to the fastest track.
- Crossfade between complete arrangements, preserve volume preferences, and retain the existing sound effects and quiet ambience.
- Preserve gameplay, saves and the local leaderboard; include supplied masters, scores and technical verification.

# Risk_V2 1.6.4 — Illustrated upgrades

- Give all six permanent upgrade cards distinct original pixel-art hardware backgrounds.
- Keep names, levels, effects and prices legible over dark text areas, including the longer Deep Learning odds line.
- Retain the compact layout, purchase rules, focus states, saves and original music.
- Bundle all new artwork offline and include the original generation prompts.

# Risk_V2 1.6.3 — Quieter tooltips and window dragging

- Wait three seconds before showing a bonus tooltip on hover or keyboard focus.
- Cancel pending tips when leaving, clicking, changing screens or opening the quit dialog; gameplay updates never bypass the delay.
- Make the main screen's top area a useful native window drag target while keeping its controls interactive.
- Preserve gameplay, local records, saves, art and music.

# Risk_V2 1.6.2 — Safe quitting

- Share a verified save flow across menu Exit, in-game Save & Quit, Alt+F4 and native close requests.
- Confirm loss of unsecured run funds; keep banked progression and local personal records.
- Keep failed saves open with Retry Save, Keep Playing and explicit Quit Without Saving.
- Contain keyboard focus and repeated input while preserving challenge deadlines and Bypass movement.
- Capture challenge outcomes during queued saves, reject stale close attempts and protect recovered temporary saves.
- Preserve the local-only leaderboard, accepted art, animation, original soundtrack and save compatibility.

# Risk_V2 1.6.1 — Local leaderboard

- Keep rankings on this PC: the ten highest recorded bank balances, with one best score per agent name.
- Replace the remote score provider with validated, serialized local storage; remove online requests and the embedded write credential from the current application.
- Preserve the preload bridge, existing game saves, achievements, gameplay rules, art, animation and original soundtrack.
- Update the board and guide to explain local records, with clear storage-error handling.
- Preserve the verified 1.6.0 release and begin Steam preparation with this focused change.

# Risk_V2 1.6.0 — Small secrets in a living room

- Implement all five scene discoveries: Rat Union, Root Access, Snail Mail, the Missing Technician and Room 404.
- Add four original ImageGen prop sheets, registered native crops, animated accessories, matching shadows and six original synthesized sound cues.
- Keep discovery inputs within the scenery, support mouse and keyboard, and prevent focused Space presses from also triggering gameplay.
- Share the existing scene clocks; pause in minigames and hidden documents. Reduced motion and Effects Off display temporary still poses with bounded cleanup.
- Preserve the 34 achievements, gameplay rules, saves, original music and accepted room/resident art. Discoveries are cosmetic and consume no gameplay randomness.
- Add close-up and motion evidence, actual-control and lifecycle regressions, editable sources and a new spoiler preview.

# Risk_V2 1.5.1 — Hidden Azeroth references

- Remove difficulty tabs, tier labels, tier colors and ranking. Use one achievement list in catalog order, with more room for the cards.
- Add two hidden achievements: Leeroy Jenkins for three opening Brute Force successes without bonuses; Hearthstone for Proxy at 80%+ risk followed immediately by Transfer.
- Keep the 32 existing rules and unlocks. New secrets stay hidden until earned and persist under two new whitelisted save IDs.
- Track Hearthstone only within the active run; accepted actions interrupt the sequence, rejected inputs do not. Loading or ending a run clears it.
- Document five further Easter egg proposals separately; they are not implemented in this release.
- Retain all accepted scene art, residents, animation, audio and video.

# Risk_V2 1.5.0 — Achievements worth chasing

- Rebalance all 32 goals into 8 easy, 14 medium and 10 hard challenges, with stable save IDs and retained unlocks.
- Replace repeated high-risk awards with flawless Injection and Memory challenges; track corrected typing mistakes honestly.
- Add Quick Hands: ten actual Bypass stops within 15 seconds, with elapsed time recorded at the tenth stop.
- Replace idle Negotiator with a ten-hack, $1,000 extraction without bonus purchases; make Perfect Run require ten hacks and a $500 extraction without exceeding 50% risk.
- Replace ten jackpots with one useful Gamble outcome, zero-money bust hunting with $100 insured recovery, and ten-Gamble farming with three Gambles followed by a $500 transfer.
- Tighten Masochist into six Brute-only hacks and a $500 transfer; shorten cumulative node, extraction and bonus grinds while keeping 5/20/50-stop Bypass and Prestige milestones.
- Add compact difficulty filters and useful saved-progress bars; keep only two playful hidden challenges.
- Reconcile supported old counters against new goals; preserve every old unlock and avoid inventing unrecorded past minigame skill.
- Keep the accepted artwork, scene motion, original music and intro. The included 1.3.1 preview/trailer is retained and labeled as earlier presentation footage.

# Risk_V2 1.4.1 — Reachable achievements and reliable unlocks

- Make Legendary Cracker's 50 Bypass stops physically reachable by capping late scanner speed below the narrowest target width; retain the early curve, rewards and target generation.
- Credit the risk peak reached before node cooling for the 80%, 95% and 99% achievements.
- Match Perfectly Balanced and result recaps to the visible 67% risk meter, including fractional risk.
- Award Negotiator automatically after 30 continuous minutes with $1,000+, using one run-owned monotonic deadline; preserve it through Settings and intro replay, and cancel it on threshold loss, run end or save load.
- Clarify bank, Bypass, Ghost, transfer and secret requirements; rename the $10,000 display achievement to FIVE_FIGURES while retaining its existing save ID and unlock.
- Audit all 32 conditions and add physical-scanner, idle-timer, peak-risk and displayed-risk regressions. See ACHIEVEMENT-AUDIT-1.4.1.md for findings and optional balance recommendations.
- Retain accepted 1.4.0 guide/submenu artwork, scene animation, residents, original music and intro. The included 1.3.1 preview/trailer remains explicitly labeled as earlier presentation footage.

# Risk_V2 1.4.0 — Visual guide and submenu rooms

- Give the main-menu guide a prominent entry and a visual hack/trace/transfer overview.
- Open hacks, bonuses, protocols and progression details on demand, with optional exact Gamble odds.
- Add heading/opener focus, Back navigation and two-stage Escape while retaining existing tutorial save behavior.
- Give upgrades/prestige, achievements, leaderboard, settings and the guide five original Blacksite pixel-art environments.
- Add small mounted LED/CRT activity with shared animation ownership, reduced/static modes and CSS image fallback.
- Preserve gameplay, saves, accepted room/protocol artwork, residents, music and intro; clearly label retained 1.3.1 footage.

# Risk_V2 1.3.2 — Bonus rules and clear tooltips

- Enforce Ghost/Overclock incompatibility in both purchase orders; require a successful hack before Gamble to close the insured starting-grant loophole.
- Preserve Full Arsenal credit when the sixth purchase is a fatal Gamble, and emit accurate purchase feedback at very large balances.
- Block ineffective Cooler/Proxy purchases at zero risk and share availability rules between controls and handlers.
- Shorten tooltips, keep unavailable cards keyboard-focusable, refresh visible states and distinguish active boosts from cooldowns.
- Show positive sub-cent prices honestly and display Deep Learning's actual jackpot/bust probabilities.
- Preserve accepted art, animation, music, intro and saves. Retain the 1.3.1 preview/trailer as labeled presentation references.

# Risk_V2 1.3.1 - Protocol hardware animation

- Add localized LED, core and electrical life to all three protocol devices.
- Keep subdued hardware activity during active play; brighter sparks and sweeps belong to preparation and resolved feedback.
- Protect targets and controls, stop added motion in hidden/reduced/static states, and reduce density on low quality.
- Preserve the original backplates, room, residents, music, gameplay and saves.

# Risk_V2 1.3.0 - Protocol environments

- Added original pixel-art device environments for bypass, command injection and memory recall.
- Tightened minigame layouts and phase transitions while keeping timed targets and keyboard controls clear.
- Kept environment artwork still during active input and respected reduced/static/hidden presentation settings.
- Preserved gameplay, saves, room residents, lighting, shadows, original music and the existing intro.

# Risk_V2 1.2.5 - Grounded residents

- Added current-pose contact and cast shadows for the technician, two rats, cat and small snail.
- Grounded shadows on the floor and cabinet roofs, with short soft casts away from local lights and weaker floor casts after reactor power loss.
- Removed duplicate placeholder contacts when the new pass is present; retained shared pause/static behavior and bounded caches.
- Preserved original raster artwork, music, actor geometry, routes, reactor colors, computer activity and gameplay.

# Risk_V2 1.2.4 - Core signals

- Added distinct cyan, violet and magenta core colors for safe, standard and brute-force hacks; green signals success and red signals failure.
- Added computer activity across more recessed banks, with coordinated colored light on receiving surfaces.
- Reduced the snail to a fixed left-facing 14 x 12-pixel sprite and retained exactly two rats.
- Preserved original artwork, operator, music, gameplay, saves and the shared decorative lifecycle.

# Risk_V2 1.2.3 â€” Light on the machinery

- Added warm practical pools, cool CRT/console bounce, reactor light on steps and wet-floor reflections.
- Lit the existing technician and pets with the same surface pass while preserving pixel detail and dark recesses.
- Added subtle voltage variation and resolved-event light response; eased the lower viewport shade.
- Kept the shared decorative lifecycle, bounded maps/buffers, original artwork, music, gameplay and saves.

# Risk_V2 1.2.2 â€” Unexpected company

- Added two cable rats, a sleepy server cat and a copper-coil snail with original pixel artwork.
- Added short floor patrols, sniffing, tail and paw motion, cat blinks and ear flicks, and slow mechanical eye-stalk movement.
- Kept pet motion on the shared scene clock, with bounded texture caches, quiet mini-games and reduced/static support.
- Preserved the corrected technician, gameplay, saves and original looping soundtrack.

# Risk_V2 1.2.1 â€” Technician correction

- Replaced the noisy six-pose character with one civilian technician and a diagnostic pad.
- Kept proportions and lower-body pixels fixed, removed the breathing jump, and added connected head/wrist movement.
- Corrected background matte residue and aligned the character to native pixels.
- Refreshed the cinematic sequence and local Windows delivery while preserving gameplay and original music.

# Risk_V2 1.2.0 â€” A living relay

- Added an original six-pose pixel-art operator, grounded beside the relay with quiet idle gestures and resolved-action reactions.
- Added staggered server self-tests, rare CRT diagnostics, contact sparks and glints registered to existing wet-floor pixels.
- Added recessed interface contacts and brief key-edge illumination, with no extra text or layout rows.
- Kept timed challenges quiet, preserved gameplay randomness and respected reduced/static settings and scene disposal.
- Refreshed the editable Blender scene, six-second intro, forty-second trailer, local Windows release and verification evidence.

# Risk_V2 1.1.3 â€” Gameplay and save hardening

- Fixed protocol time extension, duplicate rewards, stale callbacks and refresh-stall bypass timing.
- Fixed native key repeat, modified shortcuts, text-drop bypass and cross-screen actions.
- Closed zero-action starter-fund extraction and failed-purchase achievement loopholes; corrected risk, achievement and final bypass-stop accounting.
- Added validated legacy-compatible saves, serialized atomic writes, backup recovery, startup gating and hardened Electron IPC.
- Added deterministic, native-input, failure-injection and isolated release regressions. See BUGFIX-NOTES.md for details.

# Risk_V2 1.1.2 â€” Copy cleanup

- Removed repeated connection/trace labels, idle module copy and decorative HUD footers. One trace warning remains beside its meter.
- Replaced three identical hack legends with one shared label.
- Reduced each protocol to its name, controls, one set of instructions and necessary progress/reward information.
- Removed duplicate reward amounts from bypass exit, redundant terminal logs, repeated memory phase labels and protocol notification kickers.
- Shortened menu, settings, tutorial and result headings. Protocol receipts replace duplicate status-log output.
- Preserved gameplay, saves, original music, scene animation and intro. Updated trailer footage, screenshots and local Windows release.

# Risk_V2 1.1.1 â€” Blacksite refinement

- Restored the original repository soundtrack. Removed the silent tail and baked a graceful loop overlap; menus lower its volume while the same track continues. The previous replacement score is excluded.
- Redesigned all three mini-games: a calibration instrument with earned reduction, a command terminal with a real deadline/progress/error display, and a labeled memory patch panel with explicit phases and visible port states.
- Added nonblocking outcome receipts, keyboard port controls, accurate reward previews and suppression of accidental hover tooltips after a challenge.
- Published read-only protocol phases and deadlines while retaining the original countdowns, time limits, error rules, rewards and refresh-rate-independent bypass curve.
- Reworked scene animation after native and enlarged before/after inspection. Removed the invented fan on a pipe cap, floating shields/rings/beams and unregistered energy paths. Motion now belongs to the real wall fan, glass, emissive pixels, cable contacts, coil and floor vent.
- Refreshed the editable Blender source, intro, trailer, source archives and Windows package to match this pass.
- Fixed bonus price labels after packet and memory rewards so they immediately match the new funds.

# Risk_V2 1.1.0 â€” Blacksite Relay

Based on upstream `ae6411e8db7d6b366f51a9ef629112df1e8c84d2`.

The original hacking game now takes place in an animated underground relay vault. The compact 420Ã—650 interface keeps all core controls visible and carries the same amber, teal and industrial pixel-art identity through every screen.

- Original ImageGen scene, layered Canvas animation, animated menu and result scenes, editable Blender source, six-second skippable introduction and 40-second gameplay trailer.
- Synchronized calm, tension and critical music stems, separate menu arrangement, mechanical ambience and 22 original sound effects. Music and effects have independent saved volume controls.
- Presentation snapshots and resolved outcome events keep decoration separate from rewards, risk and gameplay randomness. Result effects retain the run state before it resets.
- Keyboard focus isolation, full-screen mini-game focus, contained tooltips, keyboard memory-grid navigation, reduced motion and static-scene fallback.
- Fixed underlying actions firing through overlays, Space on a focused hack button, refresh-rate-dependent bypass motion, lingering backdoor countdown timers and unsaved bust recovery.
- Existing balances, upgrades, achievements, prestige and audio preferences remain compatible. Optional presentation settings receive defaults when loading old saves.
- Instructional text now reflects the original formulas. Large values and player names remain contained. Fractional Windows scaling is corrected before the window appears.
- Windows x64 NSIS build with original app identity, original icon, offline media, current locked dependencies, isolated QA mode and atomic save writes.

Gameplay formulas and progression are preserved against the original renderer in deterministic regression tests. The bypass gauge uses its original 60Hz step as the reference at all display refresh rates.
# 1.8.1 — Free and open source

- Release the full game and project-owned assets under GPL-3.0-only.
- Add a friendly pixel-art cat-and-CRT application icon.
- Include license, asset credits and third-party notices in Windows builds.
- Publish clean source history, portable authoring paths and contributor guidance.
- Exclude unused legacy recordings with unclear provenance.
- Preserve all gameplay, saves, translations, music pacing and local-only records.

# 1.8.2 — Industrial Terminal icon

- Replace the cat icon with the selected industrial pixel-art terminal.
- Include transparent PNG exports, multi-resolution Windows ICO, the original
  master, generation prompt and reproducible export script.
- Update installer, portable download and website branding to the same artwork.
- Preserve gameplay, saves, soundtrack, translations and local records.

# 1.8.3 — Risk_V2 name and scene polish

- Use the Risk_V2 name consistently: window title, logo, quit dialog, executable,
  installer, Start menu shortcut and documentation (subtitle: Blacksite Relay).
- Blend the hidden maintenance locker into the main room: graded to the scene
  palette, lit by the neighbouring lantern, darker metal door, floor contact shadow,
  and no longer overlapping the adjacent server rack.
- The settings folder, saves and local records are unchanged; Windows treats
  Risk_v2 and Risk_V2 as the same folder, so existing installs upgrade in place.

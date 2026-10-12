# Safe quitting — Blacksite Relay 1.6.2

Exit on the main menu, Save & Quit in Settings, Alt+F4 and the native window
close request all use the same save flow. From an active run, the dialog explains
that unsecured funds will be lost. Keep Playing receives initial keyboard focus.
Quitting saves banked money, progression, achievements and preferences; it never
transfers an unfinished run or awards a Bypass exit reduction.

The dialog covers the game and traps keyboard focus. Repeated close requests and
button presses cannot create parallel quit attempts. Timed challenges continue
behind it: canceling does not extend deadlines or stop Bypass movement. A result
that resolves during a pending save is included in the latest queued snapshot.

Normal closing waits for startup loading, outstanding local leaderboard writes
and a successful current game save. Storage errors keep the app open with Retry
Save, Keep Playing and an explicit Quit Without Saving option. The latter drains
already queued writes without starting new saves or retrying failed records.
Canceled or timed-out attempts cannot close the app later when an old promise
settles. A ten-second wait limit returns control through the error dialog.

The existing user-data directory, game and local-record filenames and save schema
are retained. Old saves need no new fields. Recovery also protects a sole valid
temporary save before beginning another write. The five original preload methods
remain callable; `closeApp` now requests this flow. Additional narrow bridge
methods notify quit requests, cancel them, flush records and complete a verified
quit. Main-process close permission requires a successful fresh game save and
the current request generation.

## Verification

Deterministic controller, renderer and storage tests cover failures, retries,
duplicate input, delayed writes, late challenge results, explicit discard and
save recovery. `scripts/verify-safe-quit.cjs` exercises the native application
with isolated saves and deliberate disk-write failures, including restart and
100%, 125%, 150% and 200% display scales. Release evidence and actual test counts
are recorded in the delivered `VERIFICATION.md`.

Generic UI test cleanup may terminate only its own explicitly isolated test
process. It is separate from the native quit checks. No normal player save is
used by these tests. Forced process termination, power loss and operating-system
shutdown deadlines cannot guarantee a final save; earlier valid snapshots remain
the recovery mechanism. This change does not add mid-run resume or Steam Cloud.

# Risk_V2 1.1.3 — Bug fixes

This release corrects reproduced faults in Blacksite Relay 1.1.2 and inherited gameplay. Art, original looping music and the compact portrait layout stay the same.

## Gameplay and progression

- Extraction requires one successful hack. Repeatedly starting a run and immediately banking its RAM/prestige grant no longer creates money or successful-session achievements without play.
- Failed, blocked and zero-fund purchases no longer grant free insurance/gambles or count toward Full Arsenal. A fatal gamble cannot mark a bonus as bought in the next run.
- The 10-hack achievement now counts successful hacks in the run; the short multiplier streak previously reset before reaching ten. Gamble wording reflects its existing five-hack cooldown.
- Comeback checks run after all risk reductions. Insurance recovery checks bank milestones immediately without awarding survival achievements for a failed run. Node cooling no longer hides an earlier risk peak from Perfect Run or the result recap. The exact-67% achievement requires 67%, rather than a nearby rounded value.
- New runs reset session-only achievement tracking. Upgrade, prestige, restart and navigation handlers reject actions from covered screens and while saves are loading or unreadable. Unknown upgrade IDs cannot crash the game.
- A scan cannot reduce 100% risk to 99%. Prestige risk reduction cannot push trace negative. Extreme finite legacy balances saturate instead of overflowing to Infinity; unaffordable non-finite costs cannot be bought.
- Leaderboard rendering ignores malformed records, bounds displayed entries and rejects stale responses after the board is closed or reopened.

## Mini-games and input

- Preparation and active phases use fixed elapsed-time deadlines. Delayed callbacks, tab throttling and late input cannot extend the typing or memory challenge.
- Each protocol has an explicit run identity and phase. Repeated completion calls, old timers, old memory cells and old animation frames cannot duplicate rewards or affect a newer run. Protocols cannot overlap or start through another screen.
- Bypass preserves its original 60 Hz movement, including after frame stalls. The fiftieth successful stop now earns all fifty stops; bypass achievements count completed stops, not the next level entered.
- Held Enter/Space cannot trigger repeated native button actions or activate a newly focused hack after closing a modal. Ctrl/Alt/Meta shortcuts do not buy bonuses. Trusted text drops and paste cannot bypass the typing challenge; normal editing and case-insensitive typing remain supported.
- Starting a new run clears old achievement notifications, so repeated mini-game handoffs cannot revive a previous run's toast. Awards earned inside a mini-game still appear after its result.

## Saves and Electron

- One shared save whitelist validates numeric values, known upgrade/achievement keys, volumes and presentation preferences, retaining legitimate legacy progression. Prototype and arbitrary keys are discarded.
- Startup waits for loading before accepting actions or writing defaults. Save writes are serialized and coalesced to the latest snapshot; failures are handled visibly. Closing through the game waits for queued writes.
- A failed load leaves the menu available without forced onboarding. The tutorial can still be dismissed without writing over the unreadable save.
- A flushed temporary write and previous valid backup protect the save. Recovery tries valid saved snapshots; unreadable files are preserved and new writes blocked. A single-instance lock prevents concurrent game instances writing the same profile.
- IPC accepts only the main game frame. Score values and names are validated; requests use HTTPS with bounded size and time, and repeated requests are limited. Navigation, new windows and permissions are denied.

## Verification and limits

See `VERIFICATION.md` and `verification/` for this release's actual test results. QA uses isolated saves and a mocked leaderboard. The expanded regressions cover reproduced failures, legacy reward formulas, 2,500 mixed deterministic actions, native browser input and save failure/recovery.

This is a broad tested bug-fix pass, not a proof that no bugs remain. The inherited leaderboard trusts a local client: a modified client can still forge scores. Preventing that requires server-side game/score verification. This local release does not provision or publish a backend.

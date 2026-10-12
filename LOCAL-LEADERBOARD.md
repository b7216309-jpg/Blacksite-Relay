# Local leaderboard — 1.6.1

Every installed copy uses local rankings. Scores stay on the player's computer,
under their Windows account. There is no online leaderboard, remote score upload,
remote score download, account service or network fallback.

The board displays the ten highest recorded bank balances, with one personal best
per agent name. Spending funds or using prestige cannot lower an existing record.
Names compare without case and normalize spacing. Finite fractional and very large
balances are retained. The UI uses compact amounts to fit the portrait window.

Opening the board can record the current bank balance from an existing save.
It does not invent an older peak or import scores from the retired online board.
Completing a transfer updates the local record. A storage failure is shown clearly
and does not cancel the extraction or change gameplay rewards.

## Storage and compatibility

`local_leaderboard.json` lives in the same Electron user-data directory as the
existing `user_data.json` game save. Rankings are a separate file; the game-save
schema, balances, upgrades, prestige, achievements and preferences are preserved.
The local board stores versioned, validated records through serialized atomic
writes, with recovery snapshots. Invalid existing data is preserved if recovery
fails. Production permits one active app instance per user-data profile to avoid
two instances overwriting local records.

The existing `submitScore` and `getLeaderboard` preload methods now access that
local file. The packaged application uses the same implementation as the source
game. Test mode only selects an isolated data directory; it does not substitute an
online provider or a different ranking implementation.

## Verification

Tests cover personal bests, ordering, duplicate names, fractional/large balances,
parallel submissions, restart persistence, damaged-file recovery and write errors.
IPC checks cover valid and invalid requests without network calls. Focused Electron
checks inspect real local records at 100%, 125%, 150% and 200% display scaling.
Precise source and packaged results accompany the 1.6.1 delivery.

The current application contains no old score-provider credential. Private
historical Git commits and the preserved 1.6.0 release still contain the legacy
code; no remote credential revocation or live leaderboard modification is claimed.

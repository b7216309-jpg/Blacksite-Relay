# Steam release preparation

Current source: Blacksite Relay 1.8.0. Earlier verified releases are preserved.
Repository privacy and source synchronization are complete. Work through the
following items one at a time; this document does not claim Steam readiness.

The 1.8.0 local gold polish retains English/French switching and complete French game text.
It retains the supplied Neon soundtrack and time/score pacing from 1.6.5,
illustrated upgrades, tooltip delay and window dragging. The remaining Steam
preparation items are still tracked below. Steam work is explicitly deferred by
the owner for this local polish release. See `GOLD-RELEASE.md` in the repository root.

1. **Local leaderboard — implemented in 1.6.1.** The user selected local rankings.
   Scores stay on this PC, with ten ranked personal best bank balances and one
   entry per normalized agent name. The current application has no online score
   requests or embedded provider credential. Saves and preload methods are
   compatible. This resolves the game's dependency on the unsafe public board;
   it does not revoke the legacy key retained in historical code/releases.
   No provider-side revocation procedure has been verified, and the old service
   has not been modified. Deleting scores is not credential rotation.
2. **Safe quitting — implemented in 1.6.2.** Exit, Settings and native close
   requests share a save flow with confirmation during runs. Failed saves offer
   retry, cancel and explicit discard. Pending local records and the latest game
   snapshot are drained before normal closing. Timed challenges continue under
   the dialog. See [Safe quitting](../SAFE-QUITTING.md) and the release verification
   notes for the completed checks and limits.
3. **Steam distribution.** Configure the real AppID, depots, launch options and
   upload process, then test installation and updates through Steam.
4. **Rights and disclosure.** Keep the supplied soundtrack's authorship/license
   record and complete the generated-art disclosure. Retained old trailers still
   use the earlier music; review their clearance before reusing that footage.
5. **Store material.** Prepare current gameplay footage, Steam artwork, store
   copy, supported features, minimum specifications and pricing.
6. **Release testing.** Test Steam launch, offline play, overlay, updates, account
   switching and clean machines; collect external onboarding and balance feedback.

Consider Steam achievements, account-specific saves/Cloud and portrait-preserving
UI scaling after the blockers above. Steamworks API integration is optional for
distribution; advertised features must work. Controller and Steam Deck support
need their own implementation and testing before being advertised.

## Verification history

The 1.6.2 deterministic suite has 308 passing tests across 23 files, with no
failures or skipped tests. Delivered build and native quit evidence is recorded
in the 1.6.2 release's `VERIFICATION.md`. The earlier 1.6.1 suite had 275 passing
tests across 21 files and added isolated local-record restart and display checks.

The following evidence describes the frozen **1.6.0 baseline**, not the current
test count:

- 257/257 deterministic tests in 20 files, including a fresh extraction of the
  delivered source; no skipped or failed tests.
- Source and extracted installer application each passed 18 smoke checks;
  native and 100/125/150/200% display checks are included in the local evidence.
- Tests use isolated saves and a mocked leaderboard. They do not validate the
  live ranking service or Steam client behavior.
- The Windows package is unsigned; the installer wizard and registry installation
  have not been exercised. No subjective listening sign-off is claimed.

The frozen source ZIP has SHA-256
`36710af8e37bbae838b22bed0571a777464fe78394ffbf6580da0647a53a12a7`.
Its 343 source entries were compared before synchronization: 342 matched the
working copy and one identical packaging alias was restored. Runtime files were
not changed for the repository update. Repository documentation and ignore rules
are maintained separately from that frozen delivery.

## Steam documentation

- [SteamPipe and uploads](https://partner.steamgames.com/doc/sdk/uploading)
- [Store and build review](https://partner.steamgames.com/doc/store/review_process)
- [Onboarding](https://partner.steamgames.com/doc/gettingstarted/onboarding)
- [Content survey and AI disclosure](https://partner.steamgames.com/doc/gettingstarted/contentsurvey)
- [Steamworks API](https://partner.steamgames.com/doc/sdk/api)
- [Steam Cloud](https://partner.steamgames.com/doc/features/cloud)

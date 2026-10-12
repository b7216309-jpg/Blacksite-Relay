# Historical achievement audit reproduction

These read-only probes reproduce the **1.4.0 and 1.4.1 historical rules**, not the current rebalanced roster. They use the repository's isolated VM harness with exact delivered renderer, presentation and save-schema snapshots. They do not launch Electron, read real player saves or call the live leaderboard. They require Node.js and no installed packages.

From the extracted source directory:

```powershell
node scripts/achievement-audit/probe-before.cjs
node scripts/achievement-audit/probe-clock-review.cjs
```

Reports are written to `work/achievement-audit/before-evidence.json` and `work/achievement-audit/clock-review.json` within that source directory. To choose another report directory, pass it as the first argument:

```powershell
node scripts/achievement-audit/probe-before.cjs "path/to/reports"
node scripts/achievement-audit/probe-clock-review.cjs "path/to/reports"
```

`probe-before.cjs` loads the exact delivered **1.4.0** renderer, presentation adapter and save schema from `before/`, temporarily redirecting those reads while constructing the test harness. It demonstrates the old scanner's unreachable targets, missed pre-node risk thresholds and Negotiator timing defects. It also records the historical Balanced, Masochist and 404 achievement paths. Its expected output includes failures in the historical game; it is evidence of those defects, not a test of the current source. Adding the matching schema preserves the old save behavior after the live whitelist changes.

The captured originals remain byte-identical:

| File | SHA-256 |
| --- | --- |
| `before/renderer.js` | `99922822bb12ae4fc6575c234fdde77c75cafdeccb79ab494ef054253b80898a` |
| `before/presentation.js` | `b19bb2981efe079d0adfb23e45426220a55508b29cc16cfc6e1a0474ea2a8829` |
| `before/save-schema.js` | `24dc60162ca21b957a372069383ec6432566bd2ded8211c0109759c80769bbdc` |
| `before-1.4.1/renderer.js` | `41b13e81f37144722f498825008cb840b3f156b270bf0f56f674fecb7ddfa86d` |
| `before-1.4.1/presentation.js` | `b19bb2981efe079d0adfb23e45426220a55508b29cc16cfc6e1a0474ea2a8829` |
| `before-1.4.1/save-schema.js` | `24dc60162ca21b957a372069383ec6432566bd2ded8211c0109759c80769bbdc` |

`probe-clock-review.cjs` loads **1.4.1** from `before-1.4.1/` and records that renderer's hash. It inspects the then-current Negotiator idle deadline, Settings, intro replay, canceled callbacks after dropping below the threshold, and cancellation on save load. It advances the harness's monotonic clock and explicitly dispatches the owned timer; it does not wait thirty real minutes. The timer was intentionally removed in 1.5.0, where Negotiator instead requires a no-bonus extraction. This probe does not claim that the current game still has an idle timer.

The probes print their observations and write JSON. `historical-sources.json` inventories the six byte-identical snapshots extracted from the delivered source archives. The enforcing **current** regression suite is separate: `node --test test/achievement-rules.test.cjs`. See `ACHIEVEMENT-REWORK.md` for the current 32-achievement roster, `ACHIEVEMENT-AUDIT-1.4.1.md` for the historical 1.4.1 audit, and `VERIFICATION.md` for release results.

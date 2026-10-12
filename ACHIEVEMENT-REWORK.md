# Achievement rework — Blacksite Relay 1.5.1

The roster contains **34 achievements in one unranked list**. Difficulty tabs, labels, colors and sorting have been removed; the mix of short and longer challenges remains. It mixes discovery, protocol skill, deliberate run strategies and longer progression. Existing unlocks are retained, including achievements whose names and requirements changed. No hack rewards, bonus prices, Gamble odds, cooldowns, protocol difficulty or Prestige costs were changed.

## Current progression

- The overlapping 95% and 99% risk achievements became **Clean Signal** and **Total Recall**: one flawless Injection and one flawless Memory challenge. The 80% risk milestone and high-risk recovery challenge remain.
- **The Negotiator** now requires a $1,000 transfer after ten successful hacks without buying bonuses. The 30-minute hold and its timer are removed entirely.
- **Lucky Break** now rewards one beneficial Gamble outcome instead of ten rare jackpots. Ordinary useful cooling counts, so a jackpot is a pleasant shortcut rather than a mandatory grind.
- **Perfect Run** requires a $500 transfer after ten successful hacks while never exceeding 50% risk. One hack and an immediate transfer no longer qualify.
- **Quick Hands** is a real speed challenge: ten Bypass stops within fifteen seconds. **Relay Regular** requires five Bypasses with ten or more completed stops, replacing fifty starts. The 5/20/50-stop skill ladder remains.
- **All In** requires three Gambles and a $500 extraction. A fatal last Gamble does not complete the achievement. **Masochist** now requires six successful Brute Force hacks and a $500 extraction.
- **Failsafe** replaces the exactly-zero-money bust with a useful insurance lesson: recover at least $100 through Insure.
- Node milestones are 3 and 50; successful transfers are 1, 10 and 25. A first Ghost purchase and first actual rescue each have their own reward. Bank, multiplier and Prestige goals remain.
- Four optional secrets hide their names and requirements until earned: Masochist, Perfectly Balanced, Leeroy Jenkins and Hearthstone. The table below reveals them for reference.
- Version 1.5.1 adds the two World of Warcraft secrets and removes difficulty classification. The other 32 rules retain the 1.5.0 rebalance described above.

## Complete current roster

All amounts are inclusive where the description uses “+”. A transfer always requires positive unsecured funds and at least one successful hack. Unless a requirement says otherwise, permanent upgrades, protocols and bonuses are allowed. Goals described as one run reset when that run ends; cumulative goals do not.

| Achievement | Requirement |
| --- | --- |
| FIRST BLOOD | Hold $100 in your bank. |
| FIVE FIGURES | Hold $10,000 in your bank. |
| WHALE STATUS | Hold $100,000 in your bank. |
| NODE RUNNER | Complete 3 nodes across your runs. |
| NETWORK MASTER | Complete 50 nodes across your runs. |
| LIVING DANGEROUSLY | Reach 80% trace risk. |
| CLEAN SIGNAL | Complete Injection without a mistake. |
| COMEBACK KING | Reach 90% risk, then clear it in one run. |
| TOTAL RECALL | Complete Memory without a wrong port. |
| UNTOUCHABLE | Transfer $500+ at 0% risk. |
| LOCKPICK APPRENTICE | Complete 5 stops in one Bypass. |
| MASTER HACKER | Complete 20 stops in one Bypass. |
| LEGENDARY CRACKER | Complete 50 stops in one Bypass. |
| QUICK HANDS | Complete 10 Bypass stops within 15 seconds. |
| RELAY REGULAR | Complete 10+ stops in 5 Bypasses. |
| COMBO SPECIALIST | Complete 10 hacks in one run. |
| MULTIPLIER MADNESS | Reach a ×20 multiplier. |
| GHOST PROTOCOL | Buy your first Ghost shield. |
| LUCKY BREAK | Gain funds or lower risk with Gamble. |
| FULL ARSENAL | Buy all 6 bonuses in one run. |
| SURVIVOR | Complete your first transfer. |
| VETERAN | Complete 10 transfers. |
| IMMORTAL | Complete 25 transfers. |
| CLOSE CALL | Have Ghost prevent a bust. |
| PERFECT RUN | Transfer $500+ after 10 hacks. Never exceed 50% risk. |
| FAILSAFE | Recover $100+ from a bust with Insure. |
| ALL IN | Use Gamble 3 times, then transfer $500+. |
| THE NEGOTIATOR | Transfer $1,000+ after 10 hacks without buying bonuses. |
| MASOCHIST | Transfer $500+ after 6 hacks, using only Brute Force. |
| PERFECTLY BALANCED | Transfer when the risk meter shows 67%. |
| ASCENDED | Prestige for the first time. |
| TRANSCENDED | Reach Prestige 3. |
| LEEROY JENKINS | Open a run with 3 Brute Force hacks and no bonuses. |
| HEARTHSTONE | Use Proxy at 80%+ risk, then transfer as your next action. |

## Exact skill and outcome rules

**Leeroy Jenkins** unlocks on the third successful opening hack if all three were
Brute Force and no bonus purchase was accepted. A failed third hack cannot count;
an earlier Safe or Standard hack disqualifies that run. Blocked or invalid inputs
do not count as hacks or purchases. Existing upgrades and intervening minigames
are allowed. The check runs only after a real hack succeeds; old saved streaks
cannot invent a qualifying opener.

**Hearthstone** arms only when an affordable Proxy is actually purchased while
trace risk is at least 80% before its normal reduction. Transfer must be the next
accepted gameplay action, with positive unsecured funds and a successful hack in
the run. An accepted hack, another bonus or minigame activation interrupts the
sequence. A rejected input does not. Loading a save or ending/starting a run clears
the temporary flag. There is no timer, extra cooling, altered fee or extra reward.
Another qualifying Proxy can start a fresh sequence. See EASTER-EGGS.md for the
reference sources and separate future proposals.

**Clean Signal** requires an actual completed Injection phrase before the normal seven-second deadline. Its comparison accepts the same case and surrounding whitespace as gameplay. Any mismatch during input permanently disqualifies that attempt, even if Backspace later corrects it. The next Injection starts with a clean mistake flag. A direct success callback without completed input, an expired attempt or a stale callback cannot supply the skill evidence.

**Total Recall** requires all five correct ports before Memory's normal deadline, with zero wrong ports. Selecting a correct port twice does not advance the count. An attempt can still earn its normal game reward after a recoverable mistake, but it will not earn this flawless achievement. A direct result callback without five actual selections, an expired attempt or a callback belonging to an older challenge cannot count. Neither protocol achievement requires repeated random encounters or both protocols in the same run.

**Quick Hands** measures monotonic elapsed time from activating Bypass to the tenth successful stop. Exactly fifteen seconds qualifies. It is awarded on that tenth stop, so continuing toward twenty or fifty stops does not revoke it. Changing the computer's wall clock cannot shorten the requirement, and time spent with the window hidden still counts. Scanner movement, targets and the existing speed cap are unchanged.

Actual queued-animation-frame probes tested the farthest possible target on all ten levels. Aiming for each displayed target's center completed ten stops in **11.717 seconds at 60 Hz, 11.633 at 120 Hz and 11.653 at 144 Hz**. These automated probes establish physical feasibility and leave some margin within fifteen seconds; they are not a claim that every player will achieve the challenge immediately. Separate tests retain physical coverage of all fifty stops and the minimum-width target range at those refresh rates.

**Lucky Break** requires an actual increase in funds or decrease in risk from a jackpot, ordinary cooling or purge branch. The comparison includes the Gamble fee. Cooling when risk is already zero does not count. A fatal roll rescued by Ghost belongs to Close Call, not Lucky Break. A jackpot that cannot increase an already saturated maximum balance and does not reduce risk supplies no new useful-outcome credit.

**Failsafe** checks the amount actually added to the secured bank through Insure before the run resets. A $200 remaining haul normally recovers $100 and qualifies. The fifth insured hack remains covered. An expired policy, uninsured bust, zero-money bust or saturated bank that cannot receive any recovery does not qualify.

**Perfect Run** uses the true run peak, including risk reached before a completed node cools it. **Perfectly Balanced** uses the same floored 67% value shown by the meter. **Close Call** includes both a Ghost-prevented hack detection and a fatal Gamble rescued by Ghost. **Full Arsenal** still commits an accepted sixth distinct purchase before a fatal Gamble resets the run; All In separately requires a successful extraction.

## Normal paths for harder goals

These isolated examples use unmodified base mechanics, no permanent upgrades, no starting grant and allowed favorable survival/no-incident outcomes. They demonstrate possible normal input paths rather than guaranteed strategies. Upgrades and careful bonus use provide additional routes.

| Goal | Normal actions | Observed state before extraction |
| --- | --- | --- |
| Perfect Run | 17 Safe Entries | $530; 17 successful hacks; peak risk 33. |
| The Negotiator | 25 Safe Entries | $1,175; 25 successful hacks; no bonus purchases; peak risk 45. |
| Masochist | Brute ×3, Cooler, Brute, Proxy, Brute ×2 | $571.25; 6 successful Brutes; both cooling purchases affordable. |
| All In | Safe ×10, Gamble, Safe ×5, Gamble, Safe ×5, Gamble | With three fee-only loss outcomes: $503.36; 20 successful hacks; 3 accepted Gambles. The subsequent Transfer completes the goal. |
| Perfectly Balanced | Safe, Standard ×2, Brute ×4 | Exactly $715 and 67 risk. |
| Hearthstone | Brute ×7, Proxy, Transfer | With favorable survival and no incidents: $850 at 88% before Proxy; $827.50 at 52.8% afterward. Transfer banks $827.50 and unlocks the secret. |

Full Arsenal remains possible despite the Ghost/Overclock active lock: consume Ghost before buying Overclock, or complete Overclock's two boosted hacks before buying Ghost. A rejected purchase never counts toward Arsenal or disqualifies a no-bonus run. Comeback King still permits recovery through ordinary cooling and Bypass instead of requiring a rare purge. The first and third Prestige goals remain at the same economy thresholds as before.

## Existing saves and progress

All 32 existing save IDs are preserved. Two new IDs, `leeroyJenkins` and `hearthstone`, are appended and whitelisted; absent old-save entries default to locked. Their earned boolean values round-trip through the normal save path. Every previously true unlock remains true, even where its displayed challenge has been reworked. No player is asked to repeat an already-earned achievement. The historical `onTheEdge`, `riskTaker`, `speedRunner`, `bypassAddict`, `luckyGambler` and `brain404` IDs now display the corresponding new skill or strategy names.

On load, the game silently reconciles goals supported by known saved bank, node, transfer, Ghost, qualifying Bypass, hack-streak, peak-risk and Prestige records. Newly recognized milestones are persisted in one coalesced save, without a stack of retrospective achievement popups. It does not invent past flawless inputs, completion times, extraction combinations or insurance recoveries.

The new evidence fields are `bestBypassStops`, `bestMultiplier`, `cleanInjectionWins`, `cleanMemoryWins` and `usefulGambles`. Missing historical skill/best records default to zero; current play records subsequent results. There is one deliberate compatibility credit: when `usefulGambles` was entirely absent, the old recorded jackpot count initializes it. An explicitly stored zero remains zero, so a new non-beneficial jackpot cannot exploit that legacy fallback. Malformed or arbitrary new fields do not bypass the save whitelist.

The Hearthstone sequence is transient and is never loaded from saved fields. Run-specific hack counts, Brute-only eligibility, accepted bonus purchases, Gamble count and peak risk reset with the run. Lifetime evidence and unlocked achievements survive run resets and Prestige. The old Negotiator timing fields may still be read as legacy data, but no timer is created and they cannot grant the new extraction challenge.

## Verification

The focused checks include every current threshold family, negative extraction boundaries, complete and corrected protocol input, stale and duplicate callbacks, physical Bypass timing, actual Gamble/insurance benefit, preservation of old unlocks, legacy reconciliation and pure presentation reads. The unchanged economy, bonus, protocol and save suites are also run. The saturated-jackpot check found and corrected a counter fallback that would otherwise have granted Lucky Break without an actual benefit.

See **VERIFICATION.md** and the release's verification reports for final suite, native input, scale, package and delivered-source results. **ACHIEVEMENT-AUDIT-1.4.1.md** is retained separately as the historical 1.4.1 defect audit; this document describes the current roster.

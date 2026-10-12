# Achievement audit — Blacksite Relay 1.4.1

All 32 achievements were checked against their actual trigger paths, bonus combinations and reset order. Four defects were corrected without changing achievement targets or replacing existing unlocks:

1. **Legendary Cracker can now be completed through normal Bypass input.** The former speed curve eventually skipped every valid target. Speed now caps at 8 units per 60 Hz simulation step, below the minimum 10-unit target width. Earlier speed progression, target generation, rewards and the 50-stop requirement remain intact.
2. **High-risk achievements retain the peak reached before node cooling.** Living Dangerously, On the Edge and Risk Taker now use the run's recorded peak, so completing a node cannot erase a threshold reached by that same successful action. Bust resets do not count as surviving high risk.
3. **Perfectly Balanced matches the visible meter.** Extraction qualifies when the meter shows 67%, including fractional underlying risk from 67 up to but not including 68. The old exact-value check could reject a visibly qualifying run.
4. **The Negotiator awards automatically after 30 qualifying minutes.** One run owns one monotonic deadline. A $1,000+ starting grant starts it immediately; an unrelated click is no longer required. Falling below $1,000, ending the run or loading another save cancels it. Settings and replaying the intro preserve a clock already owned by the current run. Stale timer callbacks cannot award a later run, and changing the computer's wall clock cannot shorten the requirement.

Descriptions now identify the bank thresholds, completed Bypass stops, Ghost purchases, successful extractions and Masochist's amount requirement. The $10,000 achievement is displayed as **FIVE_FIGURES**; its existing `cryptoMill` save ID is unchanged. All other achievement IDs, existing unlocks and lifetime counters are retained.

## Current requirements and normal paths

“Reachable” means normal inputs and allowed outcomes can satisfy the condition. Random achievements are not guaranteed within a particular number of attempts. Extraction requires at least one successful hack and positive unsecured funds; a starting grant alone cannot satisfy extraction achievements.

| Achievement | Current requirement | Normal reachability |
| --- | --- | --- |
| FIRST_BLOOD | Hold $100 in the secured bank. | Transfer earnings or receive an insured recovery. Current bank balance is checked, not lifetime gross income. |
| FIVE_FIGURES | Hold $10,000 in the secured bank. | Accumulate transfers without spending the balance below the threshold. Saved under the original `cryptoMill` ID. |
| WHALE_STATUS | Hold $100,000 in the secured bank. | Accumulate a larger bank; this is below the first $200,000 Prestige requirement. |
| NODE_RUNNER | Validate 10 nodes across all runs. | Ordinary surviving hacks complete nodes; the lifetime total survives run resets and Prestige. |
| NETWORK_MASTER | Validate 100 nodes across all runs. | The same cumulative path, with a larger target. |
| LIVING_DANGEROUSLY | Reach at least 80% trace risk while alive. | Surviving hacks, incidents or Overclock can reach it. A node's later cooling no longer hides the peak. |
| ON_THE_EDGE | Reach at least 95% trace risk while alive. | The same path at a higher threshold. Reaching high risk does not itself immediately bust the run. |
| COMEBACK_KING | Reach at least 90% risk, then return to exactly 0% in that run. | Clear risk with a purge, sufficient cooling or Bypass reduction after recording the peak. A bust reset does not qualify. |
| RISK_TAKER | Reach at least 99% trace risk while alive. | 100% also qualifies; reaching the cap through Overclock leaves the player able to transfer. Pre-node peaks count. |
| UNTOUCHABLE | Transfer at least $500 with 0% risk. | Build the haul, clear risk and transfer after a successful hack. |
| LOCKPICK_APPRENTICE | Complete 5 stops in one Bypass. | Stop successfully five times, then finish the Bypass. The displayed next level is 6. |
| MASTER_HACKER | Complete 20 stops in one Bypass. | Complete twenty stops and finish the Bypass. The initial speed curve is preserved. |
| LEGENDARY_CRACKER | Complete 50 stops in one Bypass. | The capped scanner can enter every allowed target zone. The fiftieth successful stop completes the challenge. |
| SPEED_RUNNER | Finish 10 Bypasses with at least 10 completed stops each. | Qualifying Bypasses accumulate across runs. A later miss still records earlier completed stops; no separate speed-run timer is required. |
| BYPASS_ADDICT | Use Bypass 50 times across all runs. | Start and finish fifty charged Bypasses. No minimum stop count; each use needs fifteen successful hacks to charge. |
| COMBO_SPECIALIST | Complete 10 successful hacks in one run. | The dedicated run counter is used, so the short multiplier streak resetting does not block it. |
| MULTIPLIER_MADNESS | Reach a ×20 multiplier. | Build it through hack streaks, nodes and suitable incident or Injection rewards. Overflow can interrupt progress but does not make it impossible. |
| GHOST_PROTOCOL | Buy Ghost 10 times across all runs. | Accepted purchases count even when the shield is not consumed. Buying once per run avoids repeated in-run price escalation. |
| LUCKY_GAMBLER | Win 10 Gamble jackpots across all runs. | Each accepted Gamble has a 1% base jackpot chance, rising to 5% at maximum Deep Learning. Possible, with a potentially long random wait. |
| FULL_ARSENAL | Buy all 6 different bonuses in one run. | Use Overclock's two boosted hacks before buying Ghost, or consume Ghost before buying Overclock. A fatal Gamble as the sixth distinct purchase still commits the award before bust reset. |
| SURVIVOR | Transfer 5 runs successfully. | A successful hack and positive transfer completes each run. |
| VETERAN | Transfer 25 runs successfully. | The same cumulative path. |
| IMMORTAL | Transfer 100 runs successfully. | The same cumulative path; busts do not subtract previous successful transfers. |
| CLOSE_CALL | Have Ghost save you 5 times across all runs. | Actual prevented hack detections or fatal Gamble outcomes count. Merely buying a shield does not. |
| PERFECT_RUN | Transfer without ever going above 50% risk during that run. | A single Safe Entry followed by Transfer already qualifies. It is an early reward under the current definition. |
| 404_BRAIN_NOT_FOUND | Get busted while carrying exactly $0, before the reset. | Spend a small haul down to zero while retaining positive detection risk, then fail a hack. The concrete base-game sequence below demonstrates it. |
| YOLO_MODE_ACTIVATED | Buy Gamble 10 times in one run. | First purchase follows a successful hack; five successful hacks clear each subsequent cooldown. The earliest tenth purchase follows 46 successful hacks. A fatal tenth Gamble still awards it. |
| THE_NEGOTIATOR | Hold at least $1,000 continuously for 30 minutes in one run. | Reach the amount or start with a qualifying grant and retain it. The owned timer now awards automatically; dropping below the amount restarts the requirement. |
| MASOCHIST | Transfer more than $100 while using only Brute Force for hacks. | Three base Brutes and Transfer produce $150. Bonuses and protocols are allowed; a Safe or Standard hack breaks the Brute-only condition. |
| PERFECTLY_BALANCED | Transfer when the risk meter shows 67%. | Underlying risk from 67 inclusive to 68 exclusive qualifies. An exact-67 base-game sequence is given below. |
| ASCENDED | Prestige once. | Reach the first $200,000 bank requirement. The level increments before the achievement check. |
| TRANSCENDED | Reach Prestige level 3. | Prestige at successive $200,000, $1,000,000 and $5,000,000 requirements. The bank and upgrades reset; lifetime achievements and counters persist. |

## Concrete witnesses and original failures

These witnesses use the base game without upgrades, starting grants or Prestige bonuses. Favorable survival and no-incident rolls are required where stated; they demonstrate legal paths, not guaranteed strategies.

- **Perfectly Balanced:** Safe, Standard, Standard, Brute, Brute, Brute, Brute — hack IDs `1,2,2,3,3,3,3` — leave exactly **67 risk and $715** after successful, incident-free hacks. Transfer awards it. Fractional builds showing 67 now qualify too.
- **Masochist:** three successful, incident-free Brutes leave **$150**. Transfer qualifies because the requirement is strictly more than $100.
- **404 Brain Not Found:** successful Safe → successful Brute → Cooler → Proxy → Proxy leaves **$0 and 2.52 risk**. If the next Safe Entry is detected, the award checks the zero balance before bust resets the run. Zero-money Gamble is neither required nor permitted.

The captured **1.4.0** renderer had SHA-256 `99922822bb12ae4fc6575c234fdde77c75cafdeccb79ab494ef054253b80898a`; its presentation adapter had SHA-256 `b19bb2981efe079d0adfb23e45426220a55508b29cc16cfc6e1a0474ea2a8829`. Isolated before-fix probes loaded those exact delivered sources after the working source changed.

The old Bypass probe called the actual gauge update through full cycles for 121 target placements at every level. Some targets first became unreachable at level 28. At level 43, speed was approximately **93.37851** and minimum half-width was 5. The scanner repeated `0 → 93.37851 → 100 → 6.62149 → 0`; every possible target zone lay within 15–85, so none could be hit. From level 44 the scanner alternated endpoints. An older test that assigned the gauge directly to the target only checked reward accounting and could not detect this physical failure.

Three old node-completion probes began one increment from completing a node, then survived a Brute hack. They recorded peaks of **84, 96 and 100**, followed by node cooling to **79, 91 and 95**. The corresponding 80/95/99 achievements were missed. The current check preserves those recorded peaks.

The old Negotiator probe held $1,200 for over 30 minutes without another action: it stayed locked and owned no achievement timer. Transfer then unlocked it. A separate RAM-level-120 starting grant yielded $1,200 without starting the old timestamp. These defects concerned trigger timing, not mathematical impossibility or the intended duration.

## Persistence and combinations

Run resets clear temporary bonus counts, the current run's hack count, Arsenal purchase set, peak risk and Negotiator clock. They retain lifetime node, extraction, jackpot, Ghost and Bypass counters and all previously unlocked achievements. Prestige resets the bank and permanent upgrades while retaining those lifetime achievements and counters. A canceled timer's callback cannot attach itself to a new run or survive a save load.

The Ghost/Overclock purchase lock permits Full Arsenal through normal ordering. Rejected zero-risk Cooler/Proxy purchases do not grant Arsenal credit; positive-risk purchases remain available. The fifth insured hack remains covered. Insured bust recovery can unlock bank milestones through the separate bank check, while busts do not qualify as successful extractions or zero-risk comebacks.

## Optional design rework, not bug fixes

- **The Negotiator** still asks for 30 minutes of holding funds and can reward idle waiting. It is possible, but a future active-play challenge could be more engaging. This release preserves its target.
- **Lucky Gambler** still needs ten jackpots. At a fixed 1% jackpot chance, the mathematical mean is **1,000 accepted Gambles** for ten wins; at a fixed 5% it is **200**. These are averages, not guarantees, and exclude the extra play needed for funds and cooldowns. It is a grind candidate, not an impossible achievement.
- **Perfect Run** is currently an accessible early extraction reward because one Safe Entry can qualify. Turning it into a deep-run challenge would be a separate balance decision.

No additional achievement was found structurally impossible. Verification covers physical Bypass movement and real input at normal refresh rates, threshold/reset regressions, timer ownership, persisted unlock compatibility, native/scaled display and delivered-source checks. See **VERIFICATION.md** for the completed release checks and any limits; the accompanying verification reports retain the before/after evidence.

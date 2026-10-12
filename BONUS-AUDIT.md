# Blacksite Relay 1.3.2 — bonus rules and fixes

All six bonuses were audited against their purchase handler, prices, hack timing, minigame interactions, achievements and reset behavior. This release fixes reproduced faults and simplifies the quick-reference tooltips. Detailed rules are recorded here so the gameplay cards can stay concise.

## Corrected behavior

- **Ghost / Overclock:** purchase order no longer bypasses their incompatibility. Ghost cannot be bought during Overclock's two active hacks. Once that boost expires, Ghost is available even if Overclock's own cooldown is still running.
- **Starting-grant Gamble:** Gamble requires one successful hack, as extraction already does. Previously, a fresh RAM/prestige grant could buy Insurance and then a fatal Gamble could bank part of that grant without any hacking. Insurance keeps its uniform coverage rule.
- **Full Arsenal:** buying the sixth distinct bonus awards the achievement even when that purchase is a fatal Gamble. The award persists; temporary purchase credit and the Gamble streak still reset with the run.
- **Zero-risk cooling:** Cooler and Proxy show CLEAR and cannot charge money, raise their next price or award purchase credit when risk is already zero.
- **Purchase feedback:** a completed purchase always emits its bonus outcome. A very large balance can round away a tiny subtraction; that no longer mislabels an applied Cooler or Proxy as denied. Fatal Gamble also records its purchase before the bust.
- **Availability and tooltips:** purchases and the UI share one rule function. Overclock shows ACTIVE for its boost, then its remaining cooldown. Unavailable cards remain keyboard-focusable and expose their state with aria-disabled; their purchase handler still rejects the action. Short tooltips refresh while focused, so their state cannot become stale.
- **Small prices and odds:** positive sub-cent amounts display `<$0.01`, rather than appearing free. Deep Learning displays the actual jackpot and bust probabilities. Gamble's risk messages use points, distinguishing flat changes from proportional ones.

## Prices and effects

All prices come from current unsecured funds; the permanent bank is not spent. Percentage fees use the balance immediately before purchase. Effects use the balance after that fee. The UI rounds quotes for readability; the game retains its existing full numeric precision. Blocked purchases consume no money, counters, achievements or random rolls.

| Bonus | Cost | Effect and restrictions |
| --- | --- | --- |
| Cooler | `$10 × (1 − 0.01 × Cooling Fan level) × 2^purchases` | Remove 10 risk points, down to zero. Only usable above zero risk. Cooling Fan has 40 levels, so its maximum base discount is 40%. |
| Insure | 20% of current funds | For the next five hacks, a bust banks half the funds remaining at that moment. Cannot refresh or stack while active. |
| Gamble | 20% of current funds | One random outcome from the table below. Requires a successful hack in this run, then five further hacks between purchases. |
| Ghost | `$150 × 3^purchases` | Absorb one hack detection or fatal Gamble, consume the shield and clear current risk. Rebuy only after the shield is spent and five hacks have passed since purchase. Cannot buy during an active Overclock boost. |
| Proxy | `$15 × 2^purchases × (1 + 0.25 × completed nodes)` | Remove 40% of current risk, leaving 60%. Only usable above zero risk. |
| Overclock | 15% of current funds | Immediately multiply current risk by 1.5, capped at 100; double hack gains for the next two hacks. Seven-hack cooldown. Cannot stack or buy while Ghost is active. |

The escalating purchase counts and completed-node cost factor reset each run. Active buffs and all bonus cooldowns also reset on extraction or bust. Permanent upgrades, achievements, balances and preferences retain their existing save format.

## Gamble probabilities

Let `L` be Deep Learning's level, from 0 to 4. One random roll is used per accepted Gamble. Deep Learning moves one percentage point per level from the bust outcome into the jackpot outcome; the other probabilities stay fixed.

| Outcome | Chance | Result after paying the 20% fee |
| --- | --- | --- |
| Jackpot | `1 + L`% | Double remaining funds and remove 15 risk points. A $1,000 starting balance becomes $800 after the fee, then $1,600. |
| Risk reduction | 38% | Remove 20 risk points. |
| Risk penalty | 23% | Add 10 risk points, capped at 100. |
| Loss | 28% | No further change; the fee is lost. |
| Purge | 1% | Set risk to zero. |
| Bust | `9 − L`% | End the run, unless Ghost absorbs it. Active Insurance recovers half of the post-fee remaining funds on an actual bust. |

At maximum Deep Learning, jackpot and bust are each 5%. The six outcomes total 100% at every level. Boundary checks use the real strict-less-than thresholds.

## Timing and combinations

- Waiting, buying another bonus, Gambling and playing minigames do not advance hack cooldowns or buff durations.
- Insurance is checked before its remaining turn is consumed. Detection on its fifth covered hack is still insured; after a surviving fifth hack, coverage expires. Insurance also protects an eligible first attempted hack.
- Ghost's five-hack cooldown does not expire its shield. An unused shield remains active until it absorbs a detection. On a protected hack, risk clears first, then that hack's normal risk and node adjustments still apply.
- Overclock boosts hack income, including the existing multiplier, Miner and prestige factors. It does not double Gamble jackpots, random packet rewards, Memory rewards or other non-hack income. Its two boost turns fit inside its seven-hack cooldown.
- A minigame failure raises risk; it does not itself trigger a detection or spend Ghost. The next hack checks detection normally.
- Cooler subtracts points; Proxy removes a proportion. At 50 risk, Cooler then Proxy gives 24, while Proxy then Cooler gives 20. This ordering difference is intentional.
- Increasing risk to 100 does not introduce a new instant-bust rule. Detection still happens on the next hack, except Gamble's explicit bust outcome. Cooler, Proxy or another allowed risk reduction can act before that next hack.

## Verification

Deterministic bonus tests cover all six prices, exact Gamble boundaries at every Deep Learning level, affordability, cooldown expiry, fifth-hack Insurance, first-hack eligibility, both Ghost/Overclock purchase orders, zero-risk no-ops, terminal achievements, small and large balances, overlay/input gates, minigame nonconsumption and save persistence. Existing baseline comparisons remain for unchanged reward, risk and fee formulas; legitimate Gamble fixtures now include the required first successful hack.

The release's actual test totals, visual captures, Windows package checks and fresh-source archive results are in VERIFICATION.md and verification/. Tests use fixtures or isolated profiles with a mocked leaderboard. This is a tested audit of the bonus rules, not a proof that every possible game bug is absent.

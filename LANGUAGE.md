# English / Français

Choose **Settings → Language → Français** or **Paramètres → Langue → English**.
The switch applies immediately without restarting the game and is remembered
in the same local save. English is the default for old and new profiles.

The translation covers the main menu, upgrades and prestige, the complete
visual guide and detailed rules, all 34 achievements, the local leaderboard,
gameplay labels, all six bonus tooltips and states, mini-game instructions and
outcomes, result recaps, logs, save/quit messages, intro captions and hidden
discoveries. French layouts retain the 420 × 650 portrait format. Dollar values
remain dollars, with French decimal and grouping conventions when selected.

Risk_v2 and Blacksite Relay remain proper names. Player-entered names, command
strings used by Injection, letter shortcuts, saved IDs and numeric game rules
are preserved. The existing original music, sound effects and scene assets are
unchanged. The 1.8.0 release includes a refreshed English gameplay trailer and
current English/French screenshots. Earlier exported videos are historical.

The language preference is the optional whitelisted `presentation.language`
field (`en` or `fr`). Older saves without it use English; invalid or inherited
values are ignored. Balances, upgrades, achievements, prestige, volume settings
and local records keep their existing formats and behavior.

`src/relay-i18n.js` owns the language and explicit text/attribute application.
Four small catalogs separate static/guide, renderer, auxiliary and live HUD
copy. Translation uses plain text, preserves substitution fields, and never
translates arbitrary player input. Language events repaint current presentation;
they do not resolve hacks, consume randomness, restart protocols, reset music,
submit local scores or alter active challenge deadlines. Deferred notifications
and result descriptors resolve in the current language.

Run `npm test` for regression and catalog checks. Run
`node scripts/verify-language.cjs` for isolated live-switch, save-reload and
French-screen checks. Set `RISK_V2_QA_DIR` to choose the evidence directory and
`RISK_V2_EXECUTABLE` to check an extracted Windows build. These checks use test
profiles and leave player saves untouched. The release's `VERIFICATION.md`
records the actual completed checks, screenshots and limits.

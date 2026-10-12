# Contributing

Bug reports, translation improvements, accessibility fixes and scoped game
improvements are welcome. Include the version and steps to reproduce an issue.
Review private saves before attaching them to a public report.

1. Fork this repository and make a focused branch.
2. Run `npm ci` and `npm start` on Windows.
3. Preserve save compatibility, local-only records and gameplay/presentation separation.
4. Update English and French together for visible text changes.
5. Run `npm test`; run `npm run test:ui` for interface/Electron changes.
6. Open a pull request explaining the change and relevant checks.

Keep the 420×650 layout readable, including keyboard and reduced-motion support.
Never let decorative randomness change gameplay results or difficulty.

Do not commit credentials, player profiles, build folders or dependencies. New
assets need editable sources or generation prompts and compatible rights.
Project contributions use GPL-3.0-only; preserve third-party notices.

# Tooltips and window dragging — 1.6.3

Bonus help appears after three seconds on the same button, by hovering or using
keyboard focus. Moving within that button does not restart the wait. Moving away,
clicking, pressing Escape, opening another screen or beginning a quit cancels it.
Returning from a challenge does not immediately show a tooltip under a stationary
pointer. Gameplay updates can reposition an already visible tip, but never skip
the delay. Hidden windows clear pending help.

Drag the gameplay title bar, the menu's top 44-pixel strip, or its large Risk_V2
title to move the frameless window. The settings button, menu buttons, agent-name
input and interactive room details remain normal clickable controls. Artwork and
gameplay panels below these title areas are not drag regions.

This update uses the existing artwork and music and retains the save format,
local leaderboard and safe-quitting flow. It adds no gameplay timers or random
draws. Focused timing and native window checks are recorded in the delivered
`VERIFICATION.md` and its evidence folder.

# Blacksite Relay 1.6.0 — Easter eggs

This document contains spoilers. Both hidden achievement references and all five
scene discoveries below are implemented.

## Implemented: two hidden achievements

**LEEROY JENKINS** — Open a run with three successful Brute Force hacks and no
accepted bonus purchases. The third success reveals the achievement. This nods to
the reckless charge in the original 2005 World of Warcraft community video.
Reference: [Leeroy Jenkins video history](https://warcraft.wiki.gg/wiki/Leeroy_Jenkins_%28video%29).

**HEARTHSTONE** — Buy Proxy at 80% trace risk or above, then Transfer as the next
accepted gameplay action. This refers to the return-to-inn item in World of
Warcraft. Proxy supplies the escape route; Transfer gets the funds home.
Reference: [Blizzard's Classic Hearthstone rules](https://worldofwarcraft.blizzard.com/en-us/news/23973734).

Names and conditions remain hidden in the game until earned. Existing goals and
game rewards are unchanged. The full interruption, reset and save rules are in
ACHIEVEMENT-REWORK.md. These are textual tributes; no Warcraft artwork, sound or
music has been imported.

## Five hidden scene discoveries

| Idea | Discovery | Small payoff |
| --- | --- | --- |
| Rat Union | Tap both different rats within 12 seconds. | They meet, share a crumb and raise a tiny BREAK TIME sign, then return to their patrols. |
| Root Access | Pet the server cat three times within eight seconds. | Its tail contacts a key; a quiet `sudo purr` appears at the room's edge. |
| Snail Mail | Tap the snail while its feelers are extended. | A tiny courier pouch opens, an envelope appears, and DELIVERY ESTIMATE: EVENTUALLY follows. |
| The Missing Technician | Knock on the narrow locker at the far right: short, short, long. | An eye peers through the door and a small note emerges: OUT TO LUNCH. |
| Room 404 | In the guide overview, select the four service LEDs beneath the CRT from left to right. | A service panel reveals a miniature arcade cabinet running a tiny relay room. |

Click or tap the props, or use Tab to focus them and Space/Enter to interact.
For the locker, use two brief presses followed by one held for about a second;
keep the gaps below three seconds. A wrong LED resets the cable sequence.

Reveals are short and repeatable. Only one plays in each room at a time. They
pause during minigames or while hidden, and respect reduced motion and Effects
Off with a still pose that clears after six visible seconds. In these modes,
the snail can be inspected without waiting for moving feelers.

These five discoveries do not grant money, achievements or other gameplay
advantages. They do not write saves or consume gameplay randomness. No persistent
discovery checklist is added. The 34 existing achievements retain their rules.

The four new original ImageGen prop sheets, exact prompts and crop registrations
are under `art-source/easter-eggs/`. Original sound-effect masters and synthesis
source are under `art-source/audio/easter-egg-masters/` and
`art-source/audio/compose_easter_eggs.py`. See `LIVING-EASTER-EGGS.md` for the
renderer, input and verification details.

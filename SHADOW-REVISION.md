# Blacksite Relay 1.2.5 - Grounded residents

The technician, two rats, server cat and small left-facing snail now have contact and cast shadows. Tight shading under feet and bodies anchors them to the room; softer silhouettes extend away from their nearby light source.

The floor residents respond to the central reactor. The perched pets cast shorter shadows away from the cage lamps onto their cabinet roofs. Authored receiving surfaces keep these shadows off the vertical cabinet faces and machinery. Reactor power loss weakens the floor casts while the contact shadows remain.

Shadows use the current animated sprite silhouettes, including rat facing and tail movement. They follow the existing scene clock, pause during mini-games and hidden windows, and remain still in reduced-motion or static mode. The pass uses a native 420 x 280 mask, a one-pixel soft edge and bounded caches for five residents. It adds no gameplay randomness, save fields or timers.

The old placeholder contact shapes are suppressed when the new shadow pass is present. Shadows render beneath all residents and receive the same surface-lighting pass afterward. Original drawings, the smaller snail, two-rat maximum, reactor colors and computer activity remain.

Editable definitions are in `src/relay-shadows.js` and `assets/scene/relay-shadows.json`. Actor silhouette access is in `src/relay-life.js` and `src/relay-pets.js`. The Blender source and native shadow atlas are included with the refreshed media.

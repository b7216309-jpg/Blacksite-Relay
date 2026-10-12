# Living Easter eggs — 1.6.0

Five small discoveries inhabit the accepted Blacksite room and guide. The two
rats, small left-facing snail and server cat retain their existing drawings.
Four new original ImageGen sheets provide the union placard and crumb, courier
pouch and envelope, maintenance locker and note, and Room 404 arcade cabinet.
Their unmodified generated PNGs, prompts and registration data are retained.
Runtime import removes the flat magenta matte once and builds cached native
pixel props. Early images with baked checkerboard backgrounds were rejected.

## Rendering and input

- `relay-secret-state.js` owns deterministic, cosmetic interaction sequences.
  It has no DOM, random source, save access, timer or animation scheduler.
- `relay-easter-eggs.js` binds nine accessible targets to the actual props and
  the existing scene clocks. Space/Enter on a focused prop cannot also Transfer
  or stop the scanner. Hidden screens and guide details reject interactions.
- `relay-pet-secrets.js` supplies shared pose data to pet drawing and shadow
  casting. Two rats converge along the service floor and blend back onto their
  live patrol routes. Cat motion stays connected; the pouch preserves the
  snail's face and feet. All new prop frames are cached.
- `relay-secret-rooms.js` registers the locker on the right wall and the arcade
  within the guide hero. Crops preserve generated proportions. Native text and
  the tiny live relay screen are drawn separately from the generated artwork.
- Existing scene and menu render loops own animation. Minigames suspend room
  motion and input. No private RAF is created. Reduced motion and Effects Off
  show an authored still pose, with one bounded cleanup timer per active room.
  Cleanup pauses during a minigame or hidden document and resumes afterward.

Animation durations are 14 seconds for Rat Union, five for Root Access, six for
Snail Mail, seven for the locker and ten for Room 404. Discovery does not modify
gameplay, achievements, the leaderboard or saves. Existing music and its graceful
loop remain unchanged. Six new synthesized effects use the existing volume
controls, keyboard/mouse audio activation and bounded 16-voice mixer.

## Review and verification

Inspect the native 420 × 650 game and enlarged nearest-neighbor scene crops.
Check imported matte edges, coherent pixel size, contact shadows, attached
accessories, lettering, guide readability and the entire return to idle. Motion
captures include approach, hold, return and final seam frames, not only hero
stills. The release verification folder contains results and current screenshots.

`npm test` includes pure sequence, pet pose, import, shadow and cache regression
checks. `node scripts/verify-secret-interactions.cjs` exercises all five via real
browser controls with isolated saves and a mocked leaderboard; it verifies that
scene interactions leave the gameplay snapshot, save count and gameplay random
call count unchanged. `node scripts/verify-secret-lifecycle.cjs` checks pointer
knocks, static pause/resume, repeated reveals and original audio decode/playback.
These scripts write to `RISK_V2_QA_DIR` when supplied, otherwise `dist/qa`.

Audio masters are original deterministic synthesis with silent endpoints and
measured levels. Automated decode, mixer and clipping checks do not replace a
subjective listening review. The separate spoiler preview presents the new
sequences; the older 40-second trailer is retained as labeled earlier footage.

Exact discovery instructions are in `EASTER-EGGS.md` (spoilers).

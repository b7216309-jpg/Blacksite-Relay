# Pet discovery performances

The accepted rat, cat and snail originals are unchanged. `src/relay-pet-secrets.js` is the editable choreography and attachment source; `src/relay-pets.js` applies it to the same cached native frames used by the shadow renderer. The controller owns discovery inputs, audio, the shared clock and reduced-motion reveal expiry.

## Rat Union

Exactly the existing two rats participate. Their actual displayed feet are captured when the second rat is tapped. Over four seconds they follow the front service floor to source-art feet (722,750) and (806,748), face inward for six seconds, then return over four seconds to their live normal routes. Cubic easing has stationary endpoints. The original walk/sniff pixels continue; no new rat silhouette is introduced. Shadows use the modified feet and current frames.

The original generated placard crop is imported at 28×36 native pixels, preserving its aspect to the nearest whole pixel. BREAK/TIME is composed as a small 3×5 code-drawn pixel alphabet within the blank face. The sign stands behind the rats at source foot (764,750); a 3×2 crumb is placed at (764,754). The sign and crumb fade in only after the rats are nearly together and fade out before the return walk.

## Root Access

The cat remains at (363,370). Its existing copper tail connector shifts one native pixel from 0.833 to 3.25 seconds during a five-second response. The body, head and paws remain fixed. A single subdued contact indicator is registered at the connector’s floor contact. It is a tiny mechanical press, not a body deformation or a floating glow.

## Snail Mail

The small snail remains left-facing at (1206,389), with its accepted 14×12 final frame and pivot (7,9). The original generated courier crop becomes a 7×5 pouch and a 5×3 envelope. These slide out behind its face; the letter rises two pixels, holds, retracts and disappears within six seconds. All attachment pixels stay above native row9 and behind column9, so the original face and supporting foot remain visible throughout. The attachment is part of the current shadow-caster frame.

## Import and lifecycle

The two 1254×1254 original ImageGen PNGs retain their source bytes. Runtime crops are recorded in `registration.json`; no whole-sheet bounding box is used because each sheet contains two separate components. Magenta pixels satisfy `r > g + 12 && b > g + 12`; the importer removes those and suppresses residual blue spill on warm edge pixels. Each component is sampled once onto a fixed native pixel grid. Four component canvases and the existing four resident caches are reused; the module owns no timers, RAF, gameplay RNG or save state.

Both gesture pixels and their cache keys use the same12fps quantization. Repeated shadow queries cannot display actors or advance their private draw count/time. Static mode receives a held discovery pose from the controller; no local animation loop is added. Hidden/protocol suspension follows the existing shared scene clock. Disposal releases image listeners and all prop and resident canvases.

## Review and regression

Native420×150 and fullgame420×650 captures were inspected, including original8× actor pixels, arrival/turn/return frames, tail press/release, and the complete pouch/envelope sequence. The 28×36 sign was explicitly approved after the 24px face proved too narrow for its lettering. The snail pouch was moved above the foot row during review. No magenta edge, foot jump, control overlap or loose actor shadow remains in the reviewed frames.

Run `node --test test/pet-secrets.test.cjs test/pets-life.test.cjs test/actor-shadow-api.test.cjs` for targeted geometry, pixel preservation, query-order determinism, original pet parity, cache and lifecycle checks. `node scripts/verify-secret-interactions.cjs` exercises actual mouse and keyboard discoveries with isolated mocked saves and a mocked leaderboard. The release verification folder carries final run results and selected visual evidence.

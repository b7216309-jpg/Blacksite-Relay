# Runtime shadow authoring

`RelayShadows.draw(context, time, options)` draws on the existing source-art transform. It requests current caster silhouettes from `RelayLife.getShadowCasters` and `RelayPets.getShadowCasters`, before either actor module paints visible residents. The final surface-lighting pass follows the actors. Only the public scene owns animation scheduling.

Profiles define a receiver, practical light origin, cast length, horizontal compression, cast opacity and tight contact shape. Receiver polygons use the original 1536 x 1024 room coordinates. Shadow masks use the room's native 420 x 280 grid, with black RGB and soft alpha. Source-over therefore darkens the existing pixels and preserves their color ratios. A one-native-pixel filter softens the cast edge; receiver clipping is applied after that filter.

Caster descriptors provide an internal read-only canvas reference, native dimensions and pivot, world foot position, facing, id and kind. Queries may update private frame caches but leave visible draw/time/state diagnostics unchanged. Actor pose geometry and source images are retained. Legacy contact shapes draw only when the shadow module is absent.

The renderer reuses one output canvas, three byte receiver masks, two byte work buffers and one image buffer. At most five source-frame caches are retained. The output is rebuilt for new sprite ticks, snapped foot positions, pose signals or reactor power levels. It owns no timers, animation frames or gameplay randomness. `dispose()` clears all caches and releases the output canvas.

`getDefinition()` returns detached inspection metadata. `getDiagnostics()` reports readiness, source caches, caster geometry, shadow pixels, rebuilds and resource bounds. `exportFrame(time, options)` returns `{image, width, height}` with a transparent 420 x 280 PNG for cinematic export; it uses the same mask construction as gameplay.

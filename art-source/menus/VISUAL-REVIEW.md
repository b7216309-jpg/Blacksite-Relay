# Submenu art review — 1.4.0

All five original 1024 × 1536 generated PNGs were inspected before integration. Their worn teal steel, caged amber lamps, green CRTs, copper wiring and pixel clusters match the accepted Blacksite room. The workbench, data archive, signal exchange, analog mixer and briefing alcove are distinct adjacent spaces. None contains generated functional interface text; titles and controls are rendered separately.

The integrated 420 × 650 views were then inspected in isolated Chromium and native Electron captures. The focal machinery stays visible above the control panels. Reading surfaces are dark, with faint room detail at the edges. The guide uses the right-hand briefing terminal beside its opening headline, and its entire three-step overview fits without scrolling. Its optional detail pages scroll independently while the return controls remain fixed. The menu's full-width guide entry fits below Start Run without adding a duplicate link.

Upgrades received slightly more compact card spacing after the first review, to keep the six upgrade cards legible in the opening view. Prestige remains accessible within that panel's scroll area. Settings keeps its audio sliders, visual options, replay and return actions within the portrait frame. Achievements and leaderboard retain their dedicated scrolling list surfaces.

The added motion is restrained and attached to hardware: low-opacity CRT illumination and one- or two-pixel LED activity. No full-screen sweep or particle layer is added behind reading text. Lighting coordinates and animation periods are editable in `src/relay-menu-scenes.js`. Reduced motion and Static scene stop the submenu frame loop; the CSS image also provides a fallback when Canvas 2D cannot be created. The guide has no owned timers or animation-frame loop. Gameplay, the existing room residents, effects and original music are unchanged.

Release verification contains the final native and four-scale UI captures, keyboard-navigation checks, image decoding checks and bounded menu animation lifecycle results. This document records the art/readability review; it does not claim a new media render or extended scene soak.

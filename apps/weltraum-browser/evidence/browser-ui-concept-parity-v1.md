# Browser UI Concept Parity v1 Evidence

Generated from Playwright-rendered browser screenshots and DOM layout measurements. The UI parity flow used normal runtime `/` and `/?uiScenario=combat-contact`; screenshots are not hand-edited mockups.

> Repository cleanup note (2026-07-13): `Assets/**` below is the original
> capture-time path. The immutable Unity snapshot is available at
> `unity-legacy-final-2026-07:Assets/**`; retained reusable art is under `art/`.

## Concept And Actual Screenshots

| Screen | Concept Reference | Real Browser Output |
| --- | --- | --- |
| Flight HUD | `docs/UI-Screenshots/02-flug-hud-asteroidenguertel-cruise.png` | `apps/weltraum-browser/evidence/ui-concept-parity-flight-hud.png` |
| Flight HUD compact | `docs/UI-Screenshots/02-flug-hud-asteroidenguertel-cruise.png` | `apps/weltraum-browser/evidence/ui-concept-parity-flight-hud-1280x720.png` |
| Flight HUD enroute | `docs/UI-Screenshots/02-flug-hud-asteroidenguertel-cruise.png` | `apps/weltraum-browser/evidence/ui-concept-parity-flight-hud-enroute.png` |
| Navigation planner | `docs/UI-Screenshots/03-navigationsplaner-sternenkarte-route.png` | `apps/weltraum-browser/evidence/ui-concept-parity-navigation-planner.png` |
| Combat/contact shell | `docs/UI-Screenshots/07-kampf-hud-asteroidenfeld-feindkontakt.png` | `apps/weltraum-browser/evidence/ui-concept-parity-combat-contact.png` |

Additional generated screenshots:

- `apps/weltraum-browser/evidence/ui-concept-parity-flight-hud-1440x900.png`
- `apps/weltraum-browser/evidence/ui-concept-parity-flight-hud-target-selected.png`
- Baseline screenshots listed in `apps/weltraum-browser/evidence/browser-ui-concept-parity-v1-audit.md`

## Playwright Layout Analysis

`apps/weltraum-browser/evidence/browser-ui-concept-parity-v1-layout-report.json` records viewport sizes, major HUD bounding boxes, center safe-area rectangle, overlap percentages, and screenshot paths.

Key results:

- Flight HUD at 1640x900, 1440x900, and 1280x720: `#hud-top-strip`, `#hud-left-panel`, `#hud-radar-panel`, `#hud-right-panel`, and `#hud-bottom-strip` each report 0% center safe-area overlap.
- 1280x720 compact HUD keeps left systems, bottom-left radar, right target/autopilot, and route action/message strip outside the center flight area.
- Navigation planner map measured 910x741 at 1440x900, larger than the 360px right details panel.
- Combat/contact scenario keeps left systems, radar, right contact panel, and target card outside the center safe area.
- TestBridge was absent for the UI parity flows.

## Parity Scores

| Screen | Layout Similarity | Color/Style Similarity | Information Hierarchy | Interaction Completeness | Remaining Gaps |
| --- | ---: | ---: | ---: | ---: | --- |
| Flight HUD | 8/10 | 7/10 | 8/10 | 8/10 | Real background/ship framing is current runtime, not the exact concept camera/asteroid composition. |
| Navigation planner | 8/10 | 7/10 | 8/10 | 7/10 | Route profile Safe/Fast are disabled placeholders; route map is presentation of runtime preview data, not a full orbital planner. |
| Combat/contact shell | 7/10 | 7/10 | 7/10 | 5/10 | UI-only scoped scenario; no real combat target, weapons, damage, or threat model exists yet. |

## Before/After Differences

- Flight HUD moved from general rectangular debug cards to angular cyan cockpit panels.
- Radar moved from text-only right-panel status into a bottom-left circular radar/minimap region.
- Ship status became a left vertical stack with visible speed, throttle, fuel, and RCS/SAS affordances.
- Target, objective, route, and autopilot information remain on the right side but with stronger hierarchy.
- Bottom UI was reduced to warnings, cockpit message, and route actions instead of a full-width debug bar.
- Navigation planner now opens from the normal HUD with a large map, route arc, target list, details panel, profile controls, and Engage action.
- Combat/contact concept parity is available only through `?uiScenario=combat-contact` and labels itself as a presentation shell.

## Guardrails

- Normal runtime `/` still exposes no TestBridge.
- Demo Scout GLB remained the visible ship source in the parity flows.
- No `Assets/**`, package, or lockfile changes were made.
- No flight-core planner/executor/autopilot invariants were changed.
- Live flight and objective regression E2Es remain the authority for movement/progression correctness.

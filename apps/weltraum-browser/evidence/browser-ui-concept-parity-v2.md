# Browser UI Concept Parity V2 Evidence

## V3 Correction

This evidence is superseded for authoritative normal-`/` acceptance. The V2
flight screenshot flow used `/?uiScenario=flight-cruise-concept`, not the live
default product surface. That query installed a presentation-only flight
background and fixed display values, so the earlier claims that flight used `/`
and proved runtime ownership are invalid. The visual assets remain useful as a
fidelity baseline; fresh V3 evidence must use normal `/` with live WebGL and the
functional runtime planner.

## Contact Sheet

| Flow | Concept | V1 rejected | V2 integrated candidate |
| --- | --- | --- | --- |
| Flight HUD | `docs/UI-Screenshots/02-flug-hud-asteroidenguertel-cruise.png` | `apps/weltraum-browser/evidence/ui-concept-parity-v1-rejected-flight-hud.png` | `apps/weltraum-browser/evidence/ui-concept-parity-v2-flight-hud.png` |
| Flight HUD compact | `docs/UI-Screenshots/02-flug-hud-asteroidenguertel-cruise.png` | `apps/weltraum-browser/evidence/ui-concept-parity-v1-rejected-flight-hud-1280x720.png` | `apps/weltraum-browser/evidence/ui-concept-parity-v2-flight-hud-1280x720.png` |
| Navigation planner | `docs/UI-Screenshots/03-navigationsplaner-sternenkarte-route.png` | `apps/weltraum-browser/evidence/ui-concept-parity-v1-rejected-navigation-planner.png` | `apps/weltraum-browser/evidence/ui-concept-parity-v2-navigation-planner.png` |
| Combat contact | `docs/UI-Screenshots/07-kampf-hud-asteroidenfeld-feindkontakt.png` | `apps/weltraum-browser/evidence/ui-concept-parity-v1-rejected-combat-contact.png` | `apps/weltraum-browser/evidence/ui-concept-parity-v2-combat-contact.png` |

## Direct Comparison Boards

- `apps/weltraum-browser/evidence/browser-ui-concept-parity-v2-qa-flight.png`
- `apps/weltraum-browser/evidence/browser-ui-concept-parity-v2-qa-planner.png`
- `apps/weltraum-browser/evidence/browser-ui-concept-parity-v2-qa-combat.png`

Focused detail comparisons:

- `apps/weltraum-browser/evidence/browser-ui-concept-parity-v2-qa-flight-left-focus.png`
- `apps/weltraum-browser/evidence/browser-ui-concept-parity-v2-qa-flight-right-focus.png`
- `apps/weltraum-browser/evidence/browser-ui-concept-parity-v2-qa-planner-header-focus.png`
- `apps/weltraum-browser/evidence/browser-ui-concept-parity-v2-qa-planner-details-focus.png`
- `apps/weltraum-browser/evidence/browser-ui-concept-parity-v2-qa-combat-left-focus.png`
- `apps/weltraum-browser/evidence/browser-ui-concept-parity-v2-qa-combat-right-focus.png`

## Runtime Claims

- Flight, planner, and combat screenshots were captured in a rendered browser through Playwright.
- Historical claim invalidated by V3: the V2 flight acceptance image used
  `/?uiScenario=flight-cruise-concept`; only the planner used `/`.
- Therefore this document is not proof that normal `/` had the concept-quality
  live player HUD.
- Combat used the scoped normal-runtime URL `/?uiScenario=combat-contact`.
- No V2 screenshot used `/?testBridge=1`.
- TestBridge remained hidden on the default product URL.
- Superseded claim: V2 does not prove runtime ownership for every visible
  flight HUD value because the flight concept query had presentation-only
  substitutions.
- The combat screen is deliberately labelled as a presentation shell with no real combat system active.
- Browser console and page errors were checked in all three primary states; none were found.

## Generated Evidence

- `apps/weltraum-browser/evidence/ui-concept-parity-v2-flight-hud.png`
- `apps/weltraum-browser/evidence/ui-concept-parity-v2-flight-hud-1280x720.png`
- `apps/weltraum-browser/evidence/ui-concept-parity-v2-navigation-planner.png`
- `apps/weltraum-browser/evidence/ui-concept-parity-v2-combat-contact.png`
- `apps/weltraum-browser/evidence/browser-ui-concept-parity-v2-layout-report.json`
- `apps/weltraum-browser/evidence/browser-ui-concept-parity-v2-visual-audit.md`
- `design-qa.md`

## Screenshot Loop Notes

- The initial V2 rework removed the debug-grid/dashboard appearance and established the source-derived scene and panel language.
- The strict comparison loop then corrected planner timeline/branding, typography and icon hierarchy, flight marker/telemetry/warnings/radar, planner controls and composition, combat speed/subsections/radar, and the enemy wireframe.
- The old `final result: passed` statement is invalid for authoritative product
  acceptance. V3 supersedes it with normal `/`, live WebGL, runtime-owned
  values, functional planner controls, exact preview-hash Engage, and requested
  regression evidence.

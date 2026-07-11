# Browser UI Concept Parity v2 Design

## Approach

V2 treats the concepts as visual targets, not as a DOM checklist. The implementation should improve the rendered image at full-screen screenshot scale:

1. Improve scene presentation first so the HUD sits over a cinematic starfield/asteroid-belt composition rather than an obvious debug grid.
2. Replace web-card density with concept-style cockpit panels: larger German labels, icon/gauge hierarchy, clipped dark translucent panels, cyan outlines, and sparse orange warning accents.
3. Keep route and objective truth sourced from runtime telemetry. Presentation-only objects may exist for visual depth, but must not drive collision, navigation, distance, planHash, or objective progression.
4. Verify with Playwright screenshots at 1640x900 and 1280x720. DOM layout metrics are guardrails, not the definition of success.

## Screen Targets

### Flight HUD

- Large ship/deep-space composition, starfield, dense asteroid depth, no prominent debug floor/grid.
- Left stack: `GESCHWINDIGKEIT`, `SCHUB`, `TREIBSTOFF`, `RCS / SAS`.
- Large numeric speed readout.
- Segmented thrust/fuel gauges and clear green RCS/SAS active state.
- Large bottom-left circular radar.
- Right cards: `ZIEL`, `AUTOPILOT`, `NAVIGATION`.
- Reduce long text walls in normal flight HUD.

### Navigation Planner

- Near-full-screen planner with branded rail/header, top status strip, large central star map, route arc, waypoints, right maneuver timeline/details, route profile controls, legend, and prominent Engage.
- Safe/Fast may remain disabled placeholders if evidence labels that honestly.

### Combat/Contact Shell

- Scoped to `?uiScenario=combat-contact`.
- Center reticle, hostile marker, left status stack, bottom-left radar, right weapon computer, target wireframe/card, red/orange enemy accents.
- Evidence must state it is a presentation shell, not real combat gameplay.

## Evidence

- `apps/weltraum-browser/tests/e2e/ui-concept-parity-v2.spec.ts`
- `apps/weltraum-browser/evidence/browser-ui-concept-parity-v2-layout-report.json`
- `apps/weltraum-browser/evidence/browser-ui-concept-parity-v2-visual-audit.md`
- `apps/weltraum-browser/evidence/browser-ui-concept-parity-v2.md`

## Acceptance Bar

The flight screenshot must no longer read as debug panels on a grid. If it still looks primarily like a browser/debug tool instead of a game HUD over a cinematic space scene, V2 is not complete.

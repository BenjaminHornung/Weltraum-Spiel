# Tasks

## 1. Discovery and Direction

- [ ] Capture/inspect concept and v1 actual screenshots; document the largest visual gaps.
- [ ] Get focused external/advisor feedback and reduce it to concrete implementation priorities.
- [ ] Identify safe renderer/UI hooks for presentation-only visual improvements without touching flight truth.

## 2. Visual Rework

- [ ] Add a player-facing presentation scene treatment that removes/de-emphasizes the debug-grid look and improves starfield/asteroid/ship depth.
- [ ] Rework flight HUD visual language toward concept 02, including German labels, larger gauges/readouts, radar, and right-side cards.
- [ ] Rework navigation planner toward concept 03 with dominant map, route arc, top strip, rail, timeline, details, profile controls, and Engage affordance.
- [ ] Rework combat/contact shell toward concept 07 while keeping it scoped and honest as presentation-only.

## 3. Evidence and Verification

- [ ] Add `ui-concept-parity-v2.spec.ts` with real Playwright screenshot capture and layout report generation.
- [ ] Create `browser-ui-concept-parity-v2-visual-audit.md` with concept/v1/v2 paths, differences, changes, scores, and gaps.
- [ ] Create `browser-ui-concept-parity-v2.md` contact-sheet style evidence with concept/v1/v2 comparisons.
- [ ] Run required Playwright, unit, build, JSON, diff, and forbidden-path guardrail checks.

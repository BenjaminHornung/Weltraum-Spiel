# Tasks

## 1. Baseline audit

- [x] Capture real-browser baseline screenshots for flight, selected target, objective/enroute, planner/contact availability at required viewports.
- [x] Create `apps/weltraum-browser/evidence/browser-ui-concept-parity-v1-audit.md` with concept paths, current screenshot paths, gaps, acceptance targets, planned changes, and out-of-scope items.

## 2. Concept parity implementation

- [x] Redesign the normal flight HUD regions and visual language while preserving stable gameplay selectors and live flight behavior.
- [x] Add or polish a normal-runtime navigation planner overlay using existing target/route preview data and player-facing controls.
- [x] Add a scoped combat/contact HUD presentation shell without claiming default gameplay combat truth.

## 3. Playwright evidence and verification

- [x] Add `apps/weltraum-browser/tests/e2e/ui-concept-parity.spec.ts` with structural layout checks and screenshot/layout-report generation.
- [x] Create `apps/weltraum-browser/evidence/browser-ui-concept-parity-v1.md` with side-by-side concept/actual references, scores, gaps, and limitations.
- [x] Run required Playwright, unit, build, JSON, diff, and forbidden-path guardrail checks before completion.

# browser-ui-concept-parity-v2 Test Protocol

## Branch

- `feature/browser-ui-concept-parity-v2-visual-rework`

## Visual Verification

- `npm run test:e2e -- tests/e2e/ui-concept-parity-v2.spec.ts`
- Latest result: PASS, 3/3 Chromium tests in 11.5s.
- Runtime: normal `/?uiScenario=flight-cruise-concept` for flight, normal `/` for planner, and normal `/?uiScenario=combat-contact` for the combat shell.
- TestBridge: not exposed on default product URL and not used by the V2 screenshot spec.
- Browser console/page errors: none in flight, planner, or combat states.
- Independent visual gate: `final result: passed` with no P0/P1/P2 finding.

## Evidence

- `apps/weltraum-browser/evidence/browser-ui-concept-parity-v2.md`
- `apps/weltraum-browser/evidence/browser-ui-concept-parity-v2-visual-audit.md`
- `apps/weltraum-browser/evidence/browser-ui-concept-parity-v2-layout-report.json`
- `apps/weltraum-browser/evidence/ui-concept-parity-v2-flight-hud.png`
- `apps/weltraum-browser/evidence/ui-concept-parity-v2-flight-hud-1280x720.png`
- `apps/weltraum-browser/evidence/ui-concept-parity-v2-navigation-planner.png`
- `apps/weltraum-browser/evidence/ui-concept-parity-v2-combat-contact.png`
- `apps/weltraum-browser/evidence/browser-ui-concept-parity-v2-qa-flight.png`
- `apps/weltraum-browser/evidence/browser-ui-concept-parity-v2-qa-planner.png`
- `apps/weltraum-browser/evidence/browser-ui-concept-parity-v2-qa-combat.png`
- `design-qa.md`

## Current Visual Verdict

V2 is a material rework rather than a small CSS iteration. Flight, planner, and combat now visibly follow the supplied concept compositions, typography hierarchy, source iconography, flat panel treatment, and mode-specific structure. The only intentional major visual exception is the 3D player ship model. Remaining P3 differences are documented in the visual audit.

## Full Regression

The full command set is run after this protocol entry and is recorded here with exact pass/fail results before commit.

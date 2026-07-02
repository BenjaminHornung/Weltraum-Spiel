# Proposal: Browser Autopilot Test Range v2

## Motivation

The Browser Autopilot is now robust enough for a larger local-space proving ground, but the current Browser scenario surface is still split between a small deterministic harness and an initial 11-course v2 catalog. The next implementation should consolidate an explicit, evidence-backed v2 range before richer planner behavior is claimed as stable.

## Outcome

Implement a Browser-native v2 proving-ground matrix that covers:

- direct short/medium/long terminal stops;
- high starting speed and lateral starting velocity;
- single and multi-obstacle path pressure;
- authority/fuel fail-closed behavior;
- midcourse disturbance behavior;
- Safe/Balanced/Fast speed profiles;
- Pass/KnownStress/ExpectedFail classification and machine-readable evidence.

## Scope

- Add/extend Browser-local course definitions and scenario runner metrics.
- Add focused unit tests and E2E evidence for the v2 matrix.
- Preserve old deterministic scenario harness behavior.
- Preserve terminal-capture/no-snap/no-silent-replan/planHash hard invariants.
- Keep Unity files as reference-only.

## Non-goals

- No Unity port.
- No orbital, gravity-assist, docking, cargo, economy, mission, multiplayer, or final ship-editor behavior.
- No player-facing route-mode UI selector in this slice.
- No broad planner architecture rewrite unless a future spec explicitly expands scope.
- No weakening of existing terminal-capture, authority/fuel, or TestBridge-hidden-by-default tests.

## Planning artifacts

- `analysis/browser-autopilot-test-range-v2-plan.md`
- `analysis/browser-autopilot-test-range-v2-scenario-matrix.json`
- `analysis/browser-autopilot-test-range-v2-implementation-map.md`

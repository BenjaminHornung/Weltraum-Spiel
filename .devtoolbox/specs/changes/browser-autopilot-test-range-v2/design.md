# Design: Browser Autopilot Test Range v2

## Current baseline

Current `main` already includes an initial v2 catalog and runner. The future implementation should treat that as a seed and normalize it to the 25-scenario matrix defined in `analysis/browser-autopilot-test-range-v2-scenario-matrix.json`.

## Architecture choice

Prefer additive focused modules over enlarging existing generic files:

- Keep course definitions in `apps/weltraum-browser/src/world/autopilotProvingGroundCourses.ts` or split only if the catalog becomes unwieldy.
- Move course execution logic to `apps/weltraum-browser/src/test-harness/autopilotCourseRunner.ts`.
- Move reusable metrics to `apps/weltraum-browser/src/test-harness/scenarioMetrics.ts`.
- Keep `scenarioRunner.ts` backward compatible for existing 9-scenario tests.

## Speed profiles

Profiles tune route intent, not physics shortcuts.

### Safe

- Midcourse desired speed: low cruise/avoidance desired speed.
- Terminal capture margin: largest non-terminal brake margin.
- Brake aggressiveness: earliest braking.
- Obstacle clearance behavior: should prefer wider clearance/tolerate longer routes when planner supports it.
- Fuel tradeoff: lower peak speed and often lower burn, but longer travel time.
- Max speed cap: cap non-terminal desired speed below Balanced.

### Balanced

- Midcourse desired speed: default practical cruise/avoidance speed.
- Terminal capture margin: current conservative brake margin.
- Brake aggressiveness: default.
- Obstacle clearance behavior: preserve existing clearance acceptance.
- Fuel tradeoff: faster than Safe with acceptable extra fuel use.
- Max speed cap: current default cap level.

### Fast

- Midcourse desired speed: higher non-terminal desired speed.
- Terminal capture margin: terminal gates unchanged; only non-terminal brake-margin metadata may be reduced.
- Brake aggressiveness: later non-terminal braking.
- Obstacle clearance behavior: may be KnownStress in tight obstacle fields.
- Fuel tradeoff: highest peak speed and fuel use.
- Max speed cap: capped by route desired speed and executor acceleration; no global executor acceleration increase.

## Speed-profile acceptance metrics

- `Balanced` must be measurably faster than `Safe` on `direct-long`/`direct-long-balanced` vs `direct-long-safe`.
- `Balanced` must keep final distance and final speed within the same terminal gates as `Safe`.
- `Balanced` should show higher peak speed than `Safe` without `replanRequired` or plan hash replacement.
- `Fast` may be `KnownStress`, especially in corridors, but must still preserve plan hash, terminal speed gates when `Arrived`, and no silent replans.
- All profiles must report `ticksToArrival`, `peakSpeed`, `fuelUsed`, `finalDistance`, `finalSpeed`, `terminalSpeedLimit`, `arrivalPhase`, and classification notes.

## Classification design

- `Pass`: all hard invariants and acceptance gates pass.
- `KnownStress`: current-planner limitation is documented; hard invariants still fail the scenario if violated.
- `ExpectedFail`: the scenario must fail closed with expected reason codes/signals; accidental success is a failure.
- `Fail`: hard invariant or required acceptance behavior is violated.

## Terminal capture protection

Terminal capture remains executor-owned and conservative:

- no normal-runtime position snap to target;
- no waypoint velocity zero shortcut;
- no terminal velocity clamp/zero shortcut;
- no idle/cancel velocity zero shortcut;
- `StopWithinEnvelope` requires distance and terminal speed;
- `Arrived`/Holding keeps integrating through the flight controller;
- `planHash` remains locked and stable.

## Evidence design

Evidence should include both human and machine-readable output:

- Markdown summary with scenario count, category counts, classification counts, profile comparisons, KnownStress notes, and command results.
- JSON summary with per-scenario metrics and profile comparisons.
- Screenshots for direct-long, corridor/stress, and speed-profile comparison where rendering is relevant.

## Risks

- The current obstacle planner only handles the first blocking obstacle. Multi-obstacle scenarios must remain honest `KnownStress` until the planner expands.
- Parallel Autopilot lifecycle/jitter work may change executor telemetry or terminal capture behavior.
- Parallel UI work may change TestBridge/bootstrap behavior; default product route must still hide TestBridge.
- Current evidence markdown and telemetry can drift; implementation should regenerate evidence after tests.

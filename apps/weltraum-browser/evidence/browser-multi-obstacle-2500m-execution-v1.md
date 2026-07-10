# Browser Multi-Obstacle 2500 m Execution Fix v1

## Outcome

`multi-rock-field-2500m` now completes as `Pass / Arrived` at 1.6702 m and 0.4969 m/s, then settles to 1.2315 m and 0.3847 m/s. The locked `ab9e1027` plan remains unchanged, no replan or failure reason is emitted, and sampled obstacle clearance remains positive at 11.8833 m.

## Trace-Proven Root Cause

The terminal handoff itself was valid. At tick 4013 the executor advanced to `multi-terminal-2` at 8.139021 m/s, 658.187797 m from the target, while the plan hash remained `ab9e1027`.

The error was inside `AutopilotExecutor.createAutopilotActuatorRequest`. `StopWithinEnvelope` calculated `needsBraking`, but its unconditional terminal PD return covered the entire approximately 650 m terminal segment. That bypassed the executor's already-bounded hard-braking and distance-limited `segment.desiredSpeed` branches.

The ship therefore peaked at 70.217474 m/s. Braking telemetry began at tick 4275, but the ship crossed within 0.485180 m of the target at tick 4455 while still moving at 37.009674 m/s. The strict 0.5 m/s arrival gate correctly rejected that crossing. At tick 4482 the ship crossed the 30 m finite-segment divergence threshold; tick 4483 correctly failed closed as `Diverged / OffLockedRoute` at 30.970153 m and 31.073102 m/s. Projection `t=1.047613` proves this was a real axial overshoot, not a handoff geometry false positive.

The full requested before trace, including the valid handoff, terminal braking transition, target crossing, first threshold crossing, and final 100 ticks, is in `evidence/browser-multi-obstacle-2500m-trace.json`.

## General Correction

The terminal PD controller is now reserved for positions inside the configured `StopWithinEnvelope` radius. Outside that capture envelope, the terminal segment reuses the executor's existing hard-braking and distance-limited segment-speed path.

The first radius-only version exposed a capture-to-holding regression on direct 2500 m Fast. It reached the outer edge with zero capture ticks and arrived at 2.994302 m / 0.225418 m/s. The first holding command then requested +0.732420 m/s² along velocity (`kineticPowerSign=+0.165101`), increasing speed to 0.576207 m/s after 30 ticks.

A diagnostic replay of the old unconditional terminal PD branch confirmed the missing state transition: it used 231 capture ticks, arrived at 1.540680 m / 0.499836 m/s, and entered holding with a braking −0.160532 m/s² command (`kineticPowerSign=-0.080240`), settling to 0.361937 m/s.

The bounded correction keeps PD limited to the actual arrival radius but transfers `StopWithinEnvelope` from capture to holding only when the same shared PD command will not add kinetic energy. Direct Fast now uses 75 bounded capture ticks, arrives at 1.674919 m / 0.498553 m/s with a braking −0.111753 m/s² first holding command, and settles to 1.2349 m / 0.3858 m/s.

This introduces no course or target special case and does not change route geometry, divergence distance, planner behavior, acceleration limits, arrival tolerances, ship position, or ship velocity directly. FlightController remains the physical actuation owner.

## Before and After

| Metric | Before | After |
| --- | ---: | ---: |
| Classification/status | ExpectedFail / Diverged | Pass / Arrived |
| Terminal tick | 4483 | 5793 |
| Peak speed | 70.217474 m/s | 14 m/s |
| Final distance | 30.970153 m | 1.6702 m |
| Final speed | 31.073102 m/s | 0.4969 m/s |
| 30-tick settled distance | not applicable | 1.2315 m |
| 30-tick settled speed | not applicable | 0.3847 m/s |
| Terminal speed limit | 0.5 m/s | 0.5 m/s |
| Minimum obstacle clearance | positive before terminal overshoot | 11.8833 m |
| Replan required | true | false |
| Plan hash | `ab9e1027` | `ab9e1027` |
| Failure/invalidation reasons | `OffLockedRoute` | none |

## Regression Evidence

- `multi-rock-field-1000m`: `Pass / Arrived`, 1.6748 m, 0.4985 m/s, settled 1.2349 m / 0.3858 m/s, 11.4714 m minimum clearance, stable plan hash, no replan.
- Real lateral disturbance: `midcourse-position-disturbance` remains `ExpectedFail / Diverged / OffLockedRoute`, sets `replanRequired=true`, and preserves its locked plan hash.
- Near-handoff unit coverage proves a legitimate high-speed waypoint crossing advances to the next locked segment, while a real lateral departure at the same handoff fails closed.
- Blocked corridor: `unsolvable-blocked-corridor-negative` remains `ExpectedFail / PlanningRejected / UnsafeObstacle` before route execution.
- Direct 2500 m capture remains passing for Safe, Balanced, and Fast: final distances 1.6837 / 1.6697 / 1.6749 m, final speeds 0.4996 / 0.4965 / 0.4986 m/s, and settled speeds 0.3876 / 0.3845 / 0.3858 m/s.
- Normal `/` does not expose `TestBridge`; `/?testBridge=1` runs the exact 2500 m browser scenario and returns the same passing hard-gate result.

## Verification

| Command | Result |
| --- | --- |
| `npm run test -- tests/unit/autopilotSpeedProfiles.test.ts` | PASS, 4/4 |
| `npm run test -- tests/unit/executor.test.ts` | PASS, 26/26 |
| `npm run test -- tests/unit/multiObstaclePlanner.test.ts` | PASS, 9/9 |
| `npm run test -- tests/unit/provingGroundScenarios.test.ts tests/unit/autopilotCourseMetrics.test.ts` | PASS, 26/26 |
| `npm run test` | PASS, 147/147 across 14 files |
| `npm run test:e2e -- tests/e2e/multi-obstacle-2500m-execution.spec.ts` | PASS, 2/2; query-gated execution and bare-URL absence |
| `npm run test:e2e -- tests/e2e/multi-obstacle-planner.spec.ts` | PASS, 2/2 |
| `npm run test:e2e -- tests/e2e/autopilot-proving-ground-v2.spec.ts` | PASS, 3/3 |
| `npm run test:e2e -- tests/e2e/playable-large-field-live-flight.spec.ts` | PASS, 1/1 normal-runtime live flight |
| `npm run build` | PASS; TypeScript and Vite build, existing chunk-size warning only |

The independent final matrix passed all nine required commands. Playwright used bundled Chromium successfully; no Chrome fallback was needed. The only reported warning was the existing Vite build chunk-size warning.

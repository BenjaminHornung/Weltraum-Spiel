# Spec: Browser Autopilot Test Range v2

## Capability

Browser Autopilot Test Range v2 provides a deterministic Browser-local proving-ground matrix for route execution, obstacle stress, authority/fuel failures, disturbances, and speed-profile comparisons.

## Requirements

### Course definitions

- The system MUST define the v2 course matrix from `docs/browser-mainline/implementation-analysis/browser-autopilot-test-range-v2-scenario-matrix.json` or an explicitly approved successor.
- Each course MUST have a stable `id`, `label`, `category`, `initialShip`, `target`, `obstacles`, `profile`, `expectedOutcome`, `acceptance`, and evidence requirements.
- Each executable target MUST include an `arrivalEnvelope` with positive radius.
- Every `StopWithinEnvelope` course MUST define a non-negative `terminalSpeed`.
- Obstacle descriptors MUST use finite center/radius/padding values.
- Target envelopes MUST NOT overlap obstacle unsafe radii unless the course is explicitly an `ExpectedFail` validation case in a later spec.

### Acceptance metrics

- The runner MUST report per-course metrics for `ticksToArrival`, `tick`, `peakSpeed`, `finalSpeed`, `finalDistance`, `minObstacleClearance`, `fuelUsed`, `arrivalPhase`, `status`, `terminalSpeedLimit`, `planHashBefore`, `planHashAfter`, `replanRequired`, `failureReasonCodes`, `invalidationReasons`, `segmentKinds`, and `profile`.
- The runner MUST evaluate `maxFinalDistance`, `maxFinalSpeed`, `minObstacleClearance`, `maxTicks`, optional `maxFuelUsed`, `allowReplanRequired`, and optional `expectedFailureReasonCodes`.
- Metric values MUST be finite numbers except where a nullable field is explicitly defined, such as `ticksToArrival` for failures.

### Classification

- `Pass` courses MUST satisfy all hard invariants and acceptance gates.
- `KnownStress` courses MAY tolerate documented planner-limit acceptance misses, but MUST fail if hard invariants are violated.
- `ExpectedFail` courses MUST surface a failure/replan signal and the expected reason codes; accidental arrival without required failure signal MUST classify as `Fail`.
- The implementation MUST NOT hide multi-obstacle planner limits as generic successful passes.

### Speed profiles

- The system MUST support `Safe`, `Balanced`, and `Fast` profiles.
- Profiles MAY change route desired speeds and non-terminal brake-margin metadata.
- Profiles MUST NOT globally raise executor `maxAcceleration`.
- Profiles MUST NOT weaken `StopWithinEnvelope`, terminal speed, no-snap, no-zero, no-silent-replan, or plan-hash invariants.
- `Balanced` MUST be measurably faster than `Safe` on the direct-long comparison while preserving final speed and final distance gates.
- `Fast` MAY be `KnownStress`, especially in tight obstacle fields, but MUST still preserve hard invariants.

### Terminal-capture protection

- The executor MUST NOT snap ship position to target position.
- The executor MUST NOT zero ship velocity as an arrival shortcut.
- The executor MUST NOT clamp terminal velocity to force acceptance.
- `Arrived` for `StopWithinEnvelope` MUST require both distance inside the envelope and speed at or below terminal speed.
- Holding/capture behavior MUST continue through the shared flight-controller/actuator path.

### No silent replan and plan hash

- The executor MUST consume one locked `RoutePlan` during execution.
- The executor MUST NOT call a planner to replace the locked plan.
- Divergence or invalidation MUST surface `replanRequired=true` and visible reason codes.
- `planHashBefore` and `planHashAfter` MUST remain equal for every course with a locked plan, including `KnownStress` and `ExpectedFail` cases.

### Evidence output

- The implementation MUST write machine-readable JSON evidence for the v2 matrix.
- The implementation MUST write a Markdown summary with scenario count, category counts, classification counts, profile comparisons, KnownStress notes, ExpectedFail reason-code checks, and verification commands.
- Screenshot evidence SHOULD be generated for direct-long, corridor/stress, and speed-profile comparison scenarios.
- Evidence MUST include enough telemetry to detect no-snap/no-silent-replan/terminal-capture regressions without relying on renderer state as gameplay truth.

## Non-requirements

- This capability does not require Unity parity, Unity source changes, orbital/gravity navigation, player-facing speed-profile UI, cargo/economy systems, or final planner architecture expansion beyond the local proving-ground scope.

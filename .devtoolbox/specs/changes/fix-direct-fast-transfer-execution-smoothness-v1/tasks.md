# Tasks

## 1. Execution Replan Separation

- [x] Treat DirectFastTransfer soft tracking divergence as `Tracking correction` and continue applying the active segment.
- [x] Keep hard replan/abort behavior for target, obstacle, collision, authority, invalid direction, non-finite, fuel, and true plan-expired cases.
- [x] Avoid clearing actuator output during normal DirectFastTransfer correction.

## 2. Planned Full-Throttle Continuity

- [x] Disable conservative brake timing divergence for DirectFastTransfer normal phases.
- [x] Add per-plan/per-segment DirectFastTransfer main-throttle latch with burn and brake hysteresis.
- [x] Surface alignment/latch waiting statuses instead of `Replan`.

## 3. Planner and Tracker Authority

- [x] Account for initial AlignForBurn drift in the DirectFastTransfer solver.
- [x] Prefer planned segment brake direction for DirectFastTransfer flip/brake.

## 4. Regression Tests and Evidence

- [x] Add focused EditMode coverage for solver drift, brake safety, soft divergence correction, hard invalid direction, and brake direction.
- [x] Add focused PlayMode coverage for no nominal replan, throttle continuity, alignment wait, 90-degree start rotation, and planned brake direction.
- [x] Run `dotnet build`, Unity EditMode, and Unity PlayMode verification.
- [x] Save logs/trace/screenshots under `tests/`.

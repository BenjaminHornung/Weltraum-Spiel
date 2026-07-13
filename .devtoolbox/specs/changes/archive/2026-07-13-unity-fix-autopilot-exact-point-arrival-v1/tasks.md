# Tasks

## Phase 1 - Exact Arrival Ownership
- [x] Tighten player waypoint completion so `Complete` requires exact target distance, relative speed, and angular speed gates instead of the legacy loose radius.
- [x] Add or refine terminal point-capture ownership that uses RCS-only position and velocity damping after final brake ownership begins.
- [x] Add focused regression coverage for exact Complete gating and terminal capture retention.

## Phase 2 - Transition and Profile Discipline
- [x] Block nominal post-brake transitions into `Accelerate` and positive prograde main-throttle reacquire for current local waypoint routes.
- [x] Restrict `Reacquire` planner profile reporting to real avoidance/route-loss or explicit terminal recovery conditions.
- [x] Add focused regression coverage for post-brake Accelerate blocking and no-obstacle Reacquire classification.

## Phase 3 - Corridor and Low-Authority Outcomes
- [x] Preserve obstacle avoidance while fixing obstacle corridor clearance and post-avoidance exact arrival.
- [x] Ensure low-RCS terminal correction either exact-arrives or reports `LimitedRcsAuthority`/`NoRcsAuthority` without false Complete or replan spam.
- [x] Verify the no-RCS negative scenario remains passing.

## Phase 4 - Evidence and Validation
- [x] Run Unity script validation for touched C# files.
- [x] Run focused EditMode tests for terminal arrival, transition gates, and planner profile classification.
- [x] Run focused Proving Ground PlayMode evidence and acceptance gate tests.
- [x] Run `dotnet build "Weltraum Spiel.sln" --no-restore`.
- [x] Run `specs_validate` for `fix-autopilot-exact-point-arrival-v1`.
- [x] Refresh Proving Ground harness summary/protocol/performance evidence and add this change's test protocol.

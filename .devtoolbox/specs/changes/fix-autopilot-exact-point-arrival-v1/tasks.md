# Tasks

## Phase 1 - Exact Arrival Ownership
- [ ] Tighten player waypoint completion so `Complete` requires exact target distance, relative speed, and angular speed gates instead of the legacy loose radius.
- [ ] Add or refine terminal point-capture ownership that uses RCS-only position and velocity damping after final brake ownership begins.
- [ ] Add focused regression coverage for exact Complete gating and terminal capture retention.

## Phase 2 - Transition and Profile Discipline
- [ ] Block nominal post-brake transitions into `Accelerate` and positive prograde main-throttle reacquire for current local waypoint routes.
- [ ] Restrict `Reacquire` planner profile reporting to real avoidance/route-loss or explicit terminal recovery conditions.
- [ ] Add focused regression coverage for post-brake Accelerate blocking and no-obstacle Reacquire classification.

## Phase 3 - Corridor and Low-Authority Outcomes
- [ ] Preserve obstacle avoidance while fixing obstacle corridor clearance and post-avoidance exact arrival.
- [ ] Ensure low-RCS terminal correction either exact-arrives or reports `LimitedRcsAuthority`/`NoRcsAuthority` without false Complete or replan spam.
- [ ] Verify the no-RCS negative scenario remains passing.

## Phase 4 - Evidence and Validation
- [ ] Run Unity script validation for touched C# files.
- [ ] Run focused EditMode tests for terminal arrival, transition gates, and planner profile classification.
- [ ] Run focused Proving Ground PlayMode evidence and acceptance gate tests.
- [ ] Run `dotnet build "Weltraum Spiel.sln" --no-restore`.
- [ ] Run `specs_validate` for `fix-autopilot-exact-point-arrival-v1`.
- [ ] Refresh Proving Ground harness summary/protocol/performance evidence and add this change's test protocol.

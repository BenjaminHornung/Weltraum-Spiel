# Tasks: prototype-waypoint-navigation-autopilot-v0

## Spec
- [x] Promote draft into active DevToolbox change folder
- [x] Add proposal.md from draft and current-code reconciliation
- [x] Add design.md with reuse decisions and integration constraints
- [x] Add navigation-autopilot behavioral spec
- [x] Add implementation and verification tasks
- [x] Remove scaffold-only default spec if present
- [x] Validate spec with DevToolbox before implementation starts
- [ ] Commit spec with spec title and changelog

## Implementation
- [ ] Add `PrototypeNavigationTarget` waypoint component
- [ ] Add `PrototypeWaypointManager` with at least three generated visible primitive waypoints
- [ ] Wire waypoint manager/autopilot into `PrototypeBootstrap` without depending on `PrototypeTargetDummy`
- [ ] Add `PrototypeWaypointAutopilot` and the required state machine
- [ ] Add continuously recomputed target-relative metrics: distance, closing speed, lateral speed, stopping distance, ETA/arrival status
- [ ] Implement conservative stopping-distance logic using `closingSpeed = dot(shipVelocity, directionToTarget)` and `stoppingDistance = closingSpeed^2 / (2 * maxDeceleration)`
- [ ] Account for non-zero initial velocity and lateral velocity in acceleration/braking/final approach decisions
- [ ] Add conservative fuel feasibility using `ShipStats`, main-thruster data, and `TrajectoryBurnPlan` where practical
- [ ] Route main-thrust commands through existing `PlayerShipController`/main-thruster/fuel systems
- [ ] Route RCS/SAS lateral and attitude assistance through existing physical RCS/SAS/flight-assist systems
- [ ] Prevent runtime teleporting or direct Rigidbody position/velocity writes outside tests/reset setup
- [ ] Add manual override/abort behavior that clears autopilot-owned thrust/RCS requests
- [ ] Extend `PrototypeDebugOverlay` with navigation target, distance, closing speed, lateral speed, stopping distance, fuel estimate, autopilot state, ETA, and arrival status
- [ ] Update README controls and known limits for waypoint selection, autopilot toggle, fuel behavior, manual override, and out-of-scope navigation features

## Verification
- [ ] Add EditMode coverage for waypoint generation and target selection
- [ ] Add EditMode coverage for required autopilot states and transition basics
- [ ] Add EditMode coverage for stopping-distance math with positive, zero, and away-from-target closing speed
- [ ] Add EditMode coverage showing forward initial velocity changes braking decision
- [ ] Add EditMode coverage for lateral velocity diagnostics and RCS correction request when available
- [ ] Add EditMode coverage for low-fuel `FuelInsufficient`
- [ ] Add EditMode or source-level guard coverage for no runtime teleport/direct Rigidbody velocity writes in autopilot code
- [ ] Validate changed scripts with Unity MCP `validate_script`
- [ ] Run Unity MCP `refresh_unity` with script compilation
- [ ] Run Unity MCP EditMode `run_tests`
- [ ] Record test protocol under `.devtoolbox/specs/changes/prototype-waypoint-navigation-autopilot-v0/tests/test-protocol.md`
- [ ] Commit implementation with spec title and changelog

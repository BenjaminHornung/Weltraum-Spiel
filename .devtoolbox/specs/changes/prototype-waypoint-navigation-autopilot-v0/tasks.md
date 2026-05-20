# Tasks: prototype-waypoint-navigation-autopilot-v0

## Spec
- [x] Promote draft into active DevToolbox change folder
- [x] Add proposal.md from draft and current-code reconciliation
- [x] Add design.md with reuse decisions and integration constraints
- [x] Add navigation-autopilot behavioral spec
- [x] Add implementation and verification tasks
- [x] Remove scaffold-only default spec if present
- [x] Validate spec with DevToolbox before implementation starts
- [x] Commit spec with spec title and changelog

## Implementation
- [x] Add `PrototypeNavigationTarget` waypoint component
- [x] Add `PrototypeWaypointManager` with at least three generated visible primitive waypoints
- [x] Wire waypoint manager/autopilot into `PrototypeBootstrap` without depending on `PrototypeTargetDummy`
- [x] Add `PrototypeWaypointAutopilot` and the required state machine
- [x] Add continuously recomputed target-relative metrics: distance, closing speed, lateral speed, stopping distance, ETA/arrival status
- [x] Implement conservative stopping-distance logic using `closingSpeed = dot(shipVelocity, directionToTarget)` and `stoppingDistance = closingSpeed^2 / (2 * maxDeceleration)`
- [x] Account for non-zero initial velocity and lateral velocity in acceleration/braking/final approach decisions
- [x] Add conservative fuel feasibility using `ShipStats`, main-thruster data, and `TrajectoryBurnPlan` where practical
- [x] Route main-thrust commands through existing `PlayerShipController`/main-thruster/fuel systems
- [x] Route RCS/SAS lateral and attitude assistance through existing physical RCS/SAS/flight-assist systems
- [x] Prevent runtime teleporting or direct Rigidbody position/velocity writes outside tests/reset setup
- [x] Add manual override/abort behavior that clears autopilot-owned thrust/RCS requests
- [x] Extend `PrototypeDebugOverlay` with navigation target, distance, closing speed, lateral speed, stopping distance, fuel estimate, autopilot state, ETA, and arrival status
- [x] Update README controls and known limits for waypoint selection, autopilot toggle, fuel behavior, manual override, and out-of-scope navigation features

## Verification
- [x] Add EditMode coverage for waypoint generation and target selection
- [x] Add EditMode coverage for required autopilot states and transition basics
- [x] Add EditMode coverage for stopping-distance math with positive, zero, and away-from-target closing speed
- [x] Add EditMode coverage showing forward initial velocity changes braking decision
- [x] Add EditMode coverage for lateral velocity diagnostics and RCS correction request when available
- [x] Add EditMode coverage for low-fuel `FuelInsufficient`
- [x] Add EditMode or source-level guard coverage for no runtime teleport/direct Rigidbody velocity writes in autopilot code
- [x] Validate changed scripts with Unity MCP `validate_script`
- [x] Run Unity MCP `refresh_unity` with script compilation
- [x] Run Unity MCP EditMode `run_tests`
- [x] Record test protocol under `.devtoolbox/specs/changes/prototype-waypoint-navigation-autopilot-v0/tests/test-protocol.md`
- [x] Commit implementation with spec title and changelog

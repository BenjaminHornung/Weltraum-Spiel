# prototype-waypoint-navigation-autopilot-v0

## Why

The prototype flight model intentionally preserves inertia, fuel use, main-thruster spool, RCS allocation, SAS stabilization, gimbal behavior, mass changes, and drift. Manual long-distance travel and precision arrival are therefore difficult even when the player understands the controls.

This change defines the first waypoint navigation autopilot as a gameplay-enabling prototype system: visible targets, target selection, conservative fuel feasibility, physics-driven acceleration/braking, and debug telemetry that makes the controller's decisions inspectable.

## What

Add a prototype navigation-autopilot capability that lets the generated ship select visible waypoint targets and fly toward them using the existing physical systems.

The implementation target is:

- Add a waypoint target component such as `PrototypeNavigationTarget`.
- Add `PrototypeWaypointManager` to create at least three visible primitive waypoints in space.
- Add `PrototypeWaypointAutopilot` with a state machine: `Idle`, `TargetSelected`, `FuelCheck`, `AlignForBurn`, `Accelerate`, `FlipForBrake`, `Brake`, `FinalApproach`, `HoldPosition`, `Complete`, `Aborted`, `FuelInsufficient`, `Failed`.
- Use continuously recomputed stopping distance based on current velocity and available deceleration.
- Consider initial velocity, lateral velocity, current mass, current fuel, and main-thruster fuel consumption.
- Route main thrust and RCS/SAS requests through existing physical systems instead of teleporting or directly setting runtime Rigidbody position/velocity.
- Extend diagnostics and README documentation.

## Scope Boundaries

In scope:

- Runtime-generated primitive waypoint targets.
- Next/previous target selection and autopilot toggle controls.
- Conservative fuel feasibility before and during a maneuver.
- Main-thrust acceleration and flip-and-burn braking through the current `PlayerShipController`/main-thruster path.
- RCS/SAS-assisted attitude stabilization and lateral/final approach correction through the current RCS/flight-assist path when available.
- Debug overlay fields for target name, distance, closing speed, lateral speed, stopping distance, fuel estimate, autopilot state, ETA, and arrival status.
- EditMode tests/probes for state transitions, stopping-distance math, fuel insufficiency, no-teleport behavior, and waypoint generation.
- Test evidence under this change's `tests/` folder.

Out of scope:

- Planets, gravity-well navigation, orbital mechanics, slingshots, obstacle avoidance, docking, map UI, mission routing, and multi-leg route planning.
- Fuel-optimal trajectory planning.
- Final UI art or final input rebinding.
- Hidden damping or non-physical movement helpers.

## Success Criteria

- `specs_validate` passes for this change before implementation begins.
- Bootstrap or a manager creates at least three visible waypoint targets.
- The player can select a target and toggle autopilot.
- Autopilot reaches the target region using physical main-thrust and RCS/SAS systems, with arrival requiring both distance and velocity tolerance.
- Starting with forward or lateral velocity changes the computed maneuver and is visible in diagnostics.
- Low fuel produces `FuelInsufficient` or a clear failure state instead of fake success.
- Runtime autopilot does not teleport the ship and does not set Rigidbody position or velocity directly, except in existing reset/test setup paths.
- README and test evidence document controls, known limits, and verification results.

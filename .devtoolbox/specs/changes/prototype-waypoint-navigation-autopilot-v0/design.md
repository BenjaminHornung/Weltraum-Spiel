# Design: Prototype Waypoint Navigation Autopilot v0

## Current Code Reuse Baseline

The autopilot must be layered over the existing physical prototype instead of replacing it.

Relevant current integration points:

- `PlayerShipController` already owns player throttle, SAS/RCS state, main-thrust command telemetry, debug pulses, and reset-only Rigidbody state mutation.
- `MainThrusterModule` and `MainThrusterBank` apply main thrust through `ShipPhysicsCore` and consume fuel through `ShipStats.ConsumeFuelForThrust`.
- `RcsThrusterController.ApplyControls` accepts translation, attitude, SAS target, and `FlightAssistRequest`; its allocator applies forces through `ShipPhysicsCore` and consumes fuel through `ShipStats`.
- `ShipStats` exposes `CurrentFuelKg`, `MaxFuelKg`, `FuelConsumptionKgPerSecond`, `Thrust`, `ReverseThrustMultiplier`, `CurrentMass`, and fuel telemetry.
- `TrajectoryBurnPlan.EstimateMainBurn` already estimates burn duration, throttle, fuel request, applied fuel fraction, and delta-v and should be reused or extended where practical.
- `TrajectoryPredictor` is currently gravity/translation focused and can inform diagnostics, but the autopilot v0 does not need full trajectory optimization.
- `PrototypeBootstrap` generates primitive gameplay objects, configures the ship, binds camera overlays, and currently spawns `PrototypeTargetDummy`.
- `PrototypeDebugOverlay` is the current temporary diagnostics surface and should remain the place for autopilot telemetry.
- `PhysicsValidationProbe` is the existing EditMode fixture/probe pattern for physics assertions.

## Chosen Shape

Add a small navigation layer with three responsibilities:

1. `PrototypeNavigationTarget` marks a visible waypoint and exposes a display name and optional arrival radius.
2. `PrototypeWaypointManager` owns waypoint discovery/selection and creates at least three primitive waypoints when no configured waypoints exist.
3. `PrototypeWaypointAutopilot` owns state, target-relative calculations, fuel feasibility, and control requests.

`PrototypeBootstrap` should attach/configure the manager and autopilot on the generated ship or scene in the same generated-primitives style as the existing target dummy. The manager may coexist with `PrototypeTargetDummy`; the waypoint system should not depend on combat target behavior.

## Control Routing

Main acceleration and braking should command the existing main-thrust path through `PlayerShipController.SetMainThrottle` or an intentionally small controller API added for autopilot ownership. Runtime autopilot must not call `Rigidbody.position`, `Rigidbody.rotation`, `Rigidbody.linearVelocity`, `Rigidbody.angularVelocity`, or `Transform.SetPositionAndRotation` to complete navigation.

Attitude/lateral/final-approach correction should prefer the existing RCS/SAS/flight-assist route. If direct autopilot access to `RcsThrusterController.ApplyControls` would conflict with `PlayerShipController.FixedUpdate`, add a small explicit request surface on `PlayerShipController` so manual input, SAS capture, debug pulses, and autopilot commands are composed in one place. This avoids two controllers fighting over the same thrusters.

Manual throttle or attitude input should abort or override autopilot and transition to `Aborted` while cutting autopilot-owned thrust requests.

## State Machine

`PrototypeWaypointAutopilot` should expose the following states exactly for debug and tests:

```text
Idle
TargetSelected
FuelCheck
AlignForBurn
Accelerate
FlipForBrake
Brake
FinalApproach
HoldPosition
Complete
Aborted
FuelInsufficient
Failed
```

The expected progression is:

- `Idle`: no active target/autopilot command.
- `TargetSelected`: a waypoint is selected, autopilot may still be off.
- `FuelCheck`: a conservative maneuver estimate is computed.
- `AlignForBurn`: ship aligns toward the desired acceleration vector.
- `Accelerate`: main thrust increases target-relative velocity while braking margin is still safe.
- `FlipForBrake`: ship rotates to oppose closing/relative velocity.
- `Brake`: main thrust reduces closing speed.
- `FinalApproach`: low-speed correction and lateral damping near the target.
- `HoldPosition`: arrived and attempting approximate zero relative velocity.
- `Complete`: arrival tolerance has been satisfied.
- `Aborted`: manual override or explicit cancel.
- `FuelInsufficient`: preflight estimate or live fuel state says the maneuver is unlikely to complete.
- `Failed`: missing dependencies, lost target, non-finite state, or unrecoverable control failure.

## Navigation Math

Each physics update should recompute target-relative metrics from current state:

```text
toTarget = targetPosition - shipPosition
directionToTarget = normalize(toTarget)
shipVelocity = rigidbody.linearVelocity
closingSpeed = dot(shipVelocity, directionToTarget)
lateralVelocity = shipVelocity - directionToTarget * closingSpeed
maxDeceleration = conservative available brake acceleration
stoppingDistance = closingSpeed^2 / (2 * maxDeceleration)
```

Only positive closing speed should contribute to stopping distance. If the ship is moving away from the target, the controller should prioritize alignment/acceleration or recovery instead of producing a negative braking distance.

`maxDeceleration` should be conservative. For v0 it may derive from `ShipStats.Thrust`, `ShipStats.CurrentMass`, current main-thruster throttle scale/spool assumptions, and `ShipStats.ReverseThrustMultiplier` or an explicit flip-and-burn safety scalar. Missing or zero thrust should produce `Failed` or `FuelInsufficient` rather than division by zero.

The acceleration/braking switch should use:

```text
stoppingDistance + safetyMargin >= remainingDistance
```

The safety margin should account for response delay, alignment error, throttle spool, finite update cadence, and lateral correction uncertainty.

## Fuel Feasibility

Fuel feasibility can be conservative and approximate in v0. Minimum estimate:

```text
availableBurnSeconds = currentFuelKg / fullThrottleFuelKgPerSecond
requiredBurnSeconds = estimated acceleration burn + estimated braking burn + lateral/final approach reserve
```

Use `ShipStats.CurrentFuelKg` and `ShipStats.FuelConsumptionKgPerSecond`; use `TrajectoryBurnPlan.EstimateMainBurn` where it fits. The estimate should reserve fuel for braking and lateral/final approach. If the current fuel rate is zero, fuel-free thrust remains valid because existing `ShipStats` treats zero fuel consumption as zero-cost thrust.

If fuel is insufficient before departure, enter `FuelInsufficient`. If fuel runs out mid-maneuver, command no further main thrust and transition to `FuelInsufficient` or `Failed` with diagnostics.

## Diagnostics And Documentation

`PrototypeDebugOverlay` should show:

- selected target name
- distance
- closing speed
- lateral speed
- stopping distance
- conservative fuel estimate
- autopilot state
- ETA or arrival status

README should document controls, known limits, fuel behavior, manual override, no map on `M`, no gravity/slingshot planning, and the no-teleport/physics-only constraint.

## Testing Strategy

Add EditMode coverage using `PhysicsValidationProbe` patterns for:

- waypoint manager creates at least three visible primitive waypoint targets
- target selection next/previous behavior
- state enum contains the required states
- stopping-distance calculation uses current closing speed and max deceleration
- forward initial velocity increases braking urgency
- lateral velocity is measured and correction is requested when RCS is available
- low fuel enters `FuelInsufficient`
- no runtime autopilot path directly sets Rigidbody position or velocity
- debug overlay can bind/read autopilot diagnostics without missing references

After implementation, run Unity MCP `validate_script` for changed scripts, `refresh_unity`, and EditMode `run_tests`. Store results in `.devtoolbox/specs/changes/prototype-waypoint-navigation-autopilot-v0/tests/test-protocol.md`.

## Risks

- `PlayerShipController` currently computes manual input and applies RCS/main thrust every `FixedUpdate`; autopilot commands must be composed there or have a clear ownership handoff.
- RCS final approach can be allocator-limited or missing entirely on the No-RCS variant, so v0 must degrade diagnostics rather than promise impossible lateral correction.
- Naive half-distance braking fails with initial velocity, lateral velocity, fuel limits, and alignment lag; the continuously recomputed stopping-distance rule is mandatory.
- Direct Rigidbody writes would undermine the existing physics architecture and make validation meaningless.

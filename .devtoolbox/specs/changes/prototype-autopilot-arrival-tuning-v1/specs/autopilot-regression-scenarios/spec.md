# Capability: Autopilot Regression Scenarios

## Requirements

### Requirement: Deterministic arrival scenario probes

The change SHALL add deterministic EditMode tests or probes for representative autopilot arrival conditions. Tests may validate pure decision helpers, public diagnostics, or controlled `FixedUpdate` behavior, but they SHALL be deterministic and SHALL NOT require freeform manual play to pass.

#### Scenario: Start at rest with target ahead

- GIVEN the ship starts at rest
- AND a selected target is ahead
- AND enough fuel is available
- WHEN autopilot evaluates the route
- THEN it requests a physical burn toward the target
- AND it does not report `FuelInsufficient`, `NoAuthority`, or complete arrival immediately

#### Scenario: Start with forward velocity and target ahead

- GIVEN the ship already has forward velocity toward the selected target
- WHEN autopilot evaluates stopping distance
- THEN brake is requested earlier than the same distance from rest
- AND the phase can become `Brake` before the rest case would brake

#### Scenario: Start with lateral velocity

- GIVEN the ship has target-relative lateral velocity
- WHEN autopilot evaluates final approach or lateral correction
- THEN lateral speed is reported
- AND requested RCS translation opposes lateral velocity when RCS authority exists

#### Scenario: Too close and too fast

- GIVEN the ship starts inside or near final-approach distance
- AND closing speed is too high for the remaining distance
- WHEN autopilot evaluates the maneuver
- THEN it requests `Brake` immediately
- AND it does not complete arrival only because distance is small

#### Scenario: Low fuel

- GIVEN current fuel cannot support safe arrival
- WHEN autopilot is toggled on or updates during flight
- THEN it reports `FuelInsufficient`
- AND it clears or avoids unsafe throttle requests

#### Scenario: No RCS still allows coarse burn and brake

- GIVEN RCS is missing or disabled
- AND main-thrust authority exists
- WHEN autopilot evaluates long-range burn or brake
- THEN it may request coarse main burn/brake
- AND it reports limited final-approach capability for precise lateral correction

#### Scenario: Manual input abort after grace period

- GIVEN autopilot has been engaged long enough for the manual-input grace period to expire
- WHEN manual throttle, attitude, or translation input is detected
- THEN autopilot enters `Aborted` or a stable manual override reason
- AND autopilot-owned actuator requests are cleared

### Requirement: No direct Rigidbody movement writes

Runtime waypoint autopilot code SHALL NOT directly assign Rigidbody position, rotation, linear velocity, or angular velocity and SHALL NOT call transform teleport helpers to satisfy navigation.

#### Scenario: Source guard rejects direct movement writes

- GIVEN the waypoint autopilot source is inspected
- WHEN regression tests scan `PrototypeWaypointAutopilot.cs`
- THEN the test fails if runtime code assigns `Rigidbody.position`, `Rigidbody.rotation`, `Rigidbody.linearVelocity`, `Rigidbody.angularVelocity`, or calls `Transform.SetPositionAndRotation`

### Requirement: Existing behavior remains compatible

Arrival tuning SHALL preserve existing waypoint target selection, engagement normalization, fuel checks, and external request routing.

#### Scenario: Existing waypoint tests still pass

- GIVEN existing waypoint autopilot and startup-state tests
- WHEN the tuned implementation is verified
- THEN the previous waypoint generation, target selection, fuel estimate, manual abort, and command-routing tests continue to pass or are intentionally updated to the new stable diagnostic surface

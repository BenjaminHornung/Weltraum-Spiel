# Capability: Player Autopilot Arrival Stability

## Requirement: Brake Phase Must Not Flap

The waypoint autopilot must not repeatedly alternate between acceleration and braking during a single arrival.

### Scenario: High-speed approach reaches arrival without phase flapping

- GIVEN a ship is approaching a selected waypoint with meaningful forward speed
- WHEN waypoint autopilot performs the arrival burn in closed-loop physics
- THEN it may enter brake/flip and acceleration at most once each during the arrival sequence
- AND it must not request main throttle while still in `FlipForBrake`

## Requirement: Brake Flip Must Be Bounded

The waypoint autopilot must rotate toward the brake attitude without spinning through retrograde.

### Scenario: Brake attitude approaches retrograde

- GIVEN the autopilot has entered the brake phase
- WHEN the ship is not yet aligned with the velocity-opposing direction
- THEN attitude torque is bounded by available authority and angular speed
- AND main-thruster deceleration is gated until both angle and angular velocity are within the brake alignment envelope

## Requirement: Arrival Deadzone Captures Hold

The waypoint autopilot must stop circling near a target and settle physically.

### Scenario: Near-target residual velocity enters hold

- GIVEN the ship enters the target arrival deadzone with residual velocity
- WHEN the autopilot can apply hold damping
- THEN it enters `HoldPosition`, requests physical damping force, and only transitions to `Complete` after velocity and arrival confirmation settle

# Capability: Thruster Response Model

## Requirements

### Requirement: Target and actual throttle

Main engines SHALL distinguish commanded target throttle from actual applied throttle.

#### Scenario: Spool-up

- GIVEN throttle target jumps from 0 to 1
- WHEN spool-up rate is finite
- THEN actual throttle approaches 1 over time instead of snapping instantly

### Requirement: Gimbal slew

Gimbal control SHALL distinguish target gimbal angle from actual gimbal angle.

#### Scenario: Limited slew

- GIVEN target gimbal yaw changes sharply
- WHEN gimbal slew rate is finite
- THEN actual gimbal yaw moves toward the target at the configured rate

### Requirement: Current defaults remain playable

Default response settings SHALL preserve the current prototype feel unless intentionally tuned.

#### Scenario: Default bootstrap ship

- GIVEN the generated prototype ship
- WHEN no response settings are changed
- THEN controls remain responsive and acceptance tests from previous flight specs still pass

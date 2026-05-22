# Capability: Gravity and Orbits

## Requirements

### Requirement: Gravity optional by default

The prototype SHALL keep zero-gravity behavior unless a gravity source is explicitly configured.

#### Scenario: Default prototype scene

- GIVEN no gravity source is active
- WHEN the ship drifts
- THEN no gravity acceleration is applied

### Requirement: Central-body gravity

A gravity source SHALL be able to apply acceleration toward its center using a configurable gravitational parameter.

#### Scenario: Ship near body

- GIVEN a gravity source with `mu`
- WHEN a ship is at distance `r`
- THEN acceleration magnitude is `mu / r^2` toward the body center

### Requirement: Orbit direction documented

The design SHALL document that SOI/patched conics are preferred before full N-body unless gameplay demands otherwise.

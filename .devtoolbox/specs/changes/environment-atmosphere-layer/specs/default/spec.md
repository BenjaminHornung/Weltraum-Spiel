# Capability: Atmosphere Layer

## Requirements

### Requirement: Vacuum default

The prototype SHALL remain vacuum by default.

#### Scenario: No atmosphere configured

- GIVEN the ship is in the default prototype scene
- WHEN no atmosphere volume or field is active
- THEN no atmospheric drag, lift, or heating force is applied

### Requirement: Drag force

Atmosphere SHALL be able to apply drag based on density, speed, drag coefficient, and area.

#### Scenario: Test atmosphere

- GIVEN a configured atmosphere density and ship velocity
- WHEN atmosphere simulation runs
- THEN drag opposes velocity and scales with squared speed

### Requirement: Debug diagnostics

Atmosphere diagnostics SHALL show whether atmosphere is active and what force is applied.

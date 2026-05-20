# fix-sas-toggle-yaw-stop Requirements

## ADDED Requirements

### Requirement: SAS activation brakes existing yaw momentum to near-zero
When SAS is enabled after the ship already has yaw angular velocity, the prototype SHALL brake that yaw until it is effectively stopped.

#### Scenario: SAS off yaw input then SAS on stops yaw
- **GIVEN** SAS is disabled
- **AND** the player briefly presses and releases `A`
- **AND** the ship keeps rotating because it is in vacuum
- **WHEN** the player enables SAS and waits for stabilization
- **THEN** local yaw angular velocity is below `0.005 rad/s`

### Requirement: SAS activation does not rely on being enabled during input
SAS SHALL be able to brake angular velocity that was created while SAS was disabled.

#### Scenario: Late SAS activation still brakes
- **GIVEN** the ship has residual angular velocity from prior manual attitude input
- **WHEN** SAS is enabled after the input has ended
- **THEN** SAS applies counter-control until the angular velocity is near zero

### Requirement: SAS-off vacuum inertia remains intact
The prototype SHALL not use hidden passive angular damping while SAS is disabled.

#### Scenario: SAS off preserves yaw momentum
- **GIVEN** SAS is disabled
- **AND** the player briefly presses and releases `A`
- **WHEN** no further input is given
- **THEN** the ship continues rotating instead of silently stopping

### Requirement: Pitch and roll do not regress
The prototype SHALL keep SAS braking for pitch and roll while improving yaw convergence.

#### Scenario: SAS brakes pitch and roll to near-zero
- **GIVEN** the ship has residual pitch or roll angular velocity
- **WHEN** SAS is enabled and waits for stabilization
- **THEN** local pitch or roll angular velocity is below `0.005 rad/s`

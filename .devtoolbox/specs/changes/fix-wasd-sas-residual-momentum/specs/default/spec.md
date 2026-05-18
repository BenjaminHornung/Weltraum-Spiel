# fix-wasd-sas-residual-momentum Requirements

## ADDED Requirements

### Requirement: SAS brakes residual pitch and yaw momentum
When SAS is enabled and the player releases W/A/S/D attitude input, the prototype SHALL continue applying counter-torque while meaningful pitch or yaw angular velocity remains.

#### Scenario: Pitch residual is actively damped
- **GIVEN** SAS is enabled
- **AND** the ship has residual pitch angular velocity after W or S input is released
- **WHEN** the ship continues simulating
- **THEN** SAS continues commanding braking torque until pitch angular velocity is near zero

#### Scenario: Yaw residual is actively damped
- **GIVEN** SAS is enabled
- **AND** the ship has residual yaw angular velocity after A or D input is released
- **WHEN** the ship continues simulating
- **THEN** SAS continues commanding braking torque until yaw angular velocity is near zero

### Requirement: SAS roll braking remains intact
The prototype SHALL keep Q/E roll stabilization working while improving pitch/yaw stabilization.

#### Scenario: Roll residual is actively damped
- **GIVEN** SAS is enabled
- **AND** the ship has residual roll angular velocity after Q or E input is released
- **WHEN** the ship continues simulating
- **THEN** SAS continues commanding braking torque until roll angular velocity is near zero

### Requirement: SAS-off vacuum inertia remains intact
When SAS is disabled, the prototype SHALL not apply hidden passive angular damping to stop rotation.

#### Scenario: SAS off preserves momentum
- **GIVEN** SAS is disabled
- **AND** the ship has angular velocity after attitude input is released
- **WHEN** no further attitude input is given
- **THEN** the ship keeps rotating instead of silently damping to zero

### Requirement: Debug overlay exposes SAS effectiveness
The prototype debug overlay SHALL make it clear when SAS is requesting counter-command and whether RCS torque/nozzles are actually being applied.

#### Scenario: Remaining angular velocity with no RCS torque is visible
- **GIVEN** angular velocity remains while SAS is enabled
- **WHEN** the overlay is visible
- **THEN** it shows angular velocity, SAS command, active RCS nozzle count, and estimated RCS torque

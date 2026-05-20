# fix-rcs-authority-and-vfx-regression Requirements

## ADDED Requirements

### Requirement: SAS does not reduce active manual RCS authority
The prototype SHALL preserve active manual RCS attitude and translation authority while SAS is enabled.

#### Scenario: Manual yaw authority is comparable with SAS on and off
- **GIVEN** the player commands yaw with `A` or `D`
- **WHEN** SAS is enabled
- **THEN** the applied manual yaw authority is comparable to SAS disabled behavior
- **AND** SAS does not counter-command the same actively controlled axis

#### Scenario: Manual translation authority is comparable with SAS on and off
- **GIVEN** the player commands RCS translation with H/N/I/K/J/L
- **WHEN** SAS is enabled
- **THEN** the applied translation authority is comparable to SAS disabled behavior

### Requirement: SAS still stabilizes released axes
The prototype SHALL continue to use SAS to brake residual angular velocity when manual input is released.

#### Scenario: SAS damps yaw after input release
- **GIVEN** the player releases yaw input
- **AND** SAS is enabled
- **WHEN** the ship continues simulating
- **THEN** SAS brakes yaw angular velocity toward near zero

### Requirement: RCS blocks expose thrust values
The prototype SHALL assign each generated RCS block an inspector-adjustable thrust value used by its nozzles.

#### Scenario: RCS nozzle uses parent block thrust
- **WHEN** a nozzle on an RCS block is selected
- **THEN** the force applied by that nozzle is based on the thrust value of its parent RCS block

#### Scenario: Four generated RCS blocks have thrust values
- **WHEN** the prototype ship is generated
- **THEN** all four RCS blocks have a configured thrust value visible to debugging or inspector workflows

### Requirement: RCS particles remain visible and directional
The prototype SHALL show visible RCS exhaust for selected nozzles.

#### Scenario: Selected nozzle shows visible exhaust
- **WHEN** an RCS nozzle is selected to apply force or torque
- **THEN** visible RCS VFX is active and not hidden inside the ship geometry

#### Scenario: Exhaust remains opposite force direction
- **WHEN** RCS VFX is active
- **THEN** its visible exhaust direction is opposite the nozzle force direction

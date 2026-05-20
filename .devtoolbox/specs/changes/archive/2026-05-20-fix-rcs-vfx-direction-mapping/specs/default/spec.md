# fix-rcs-vfx-direction-mapping Requirements

## ADDED Requirements

### Requirement: RCS VFX follows selected nozzle records
The prototype SHALL activate RCS VFX only for nozzle records that are selected by the same force/torque application path.

#### Scenario: Selected nozzle activates VFX
- **WHEN** an RCS nozzle is selected to apply force or torque
- **THEN** that nozzle's VFX is active for the command frame

#### Scenario: Unselected nozzle stays inactive
- **WHEN** an RCS nozzle is not selected for the current RCS command
- **THEN** that nozzle's VFX remains inactive

### Requirement: RCS VFX direction matches nozzle convention
The prototype SHALL document and follow one consistent convention for RCS force direction and visual exhaust direction.

#### Scenario: VFX direction corresponds to selected nozzle exhaust
- **WHEN** a selected RCS nozzle emits VFX
- **THEN** the visible particles appear along the nozzle's intended exhaust direction

### Requirement: Manual RCS translation has matching visuals
Manual RCS translation inputs SHALL display VFX on nozzles that are physically plausible for the requested translation.

#### Scenario: Translation command reports matching nozzles and VFX
- **WHEN** H/N/I/K/J/L requests translation
- **THEN** selected nozzle force directions and active VFX states are consistent with the requested translation vector

### Requirement: Manual and SAS attitude control have matching visuals
Manual attitude input and SAS counter-thrust SHALL display VFX on nozzles used to generate the requested torque.

#### Scenario: Manual attitude command reports matching nozzles and VFX
- **WHEN** W/S/A/D/Q/E requests pitch, yaw, or roll torque
- **THEN** selected nozzle torque directions and active VFX states are consistent with the requested torque vector

#### Scenario: SAS command reports matching nozzles and VFX
- **WHEN** SAS applies counter-torque
- **THEN** selected nozzle torque directions and active VFX states are consistent with the SAS braking command

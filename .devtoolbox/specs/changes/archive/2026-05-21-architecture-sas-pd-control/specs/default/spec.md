# Capability: SAS PD Control

## Requirements

### Requirement: SAS requests torque

SAS SHALL produce desired torque requests that are satisfied through available ship actuators rather than applying hidden damping.

#### Scenario: RCS disabled

- GIVEN SAS is enabled but RCS authority is unavailable
- WHEN the ship is rotating
- THEN SAS diagnostics show a torque request
- AND no impossible stabilizing torque is applied

### Requirement: Kill rotation mode

SAS SHALL support a kill-rotation behavior that damps angular velocity toward zero.

#### Scenario: Yaw rotation stop

- GIVEN the ship has yaw angular velocity and no manual yaw input
- WHEN SAS kill-rotation is active
- THEN requested torque opposes yaw angular velocity
- AND residual angular velocity approaches the configured tolerance

### Requirement: Hold attitude mode

SAS SHALL be able to hold a target attitude using rotation error and angular velocity.

#### Scenario: Manual release

- GIVEN the player stops pitch/yaw/roll input
- WHEN hold attitude is active
- THEN the current or configured target attitude is held using available RCS torque

### Requirement: Timestep stability

SAS command generation SHALL not multiply control gains by fixedDeltaTime when the resulting force path already uses ForceMode.Force semantics.

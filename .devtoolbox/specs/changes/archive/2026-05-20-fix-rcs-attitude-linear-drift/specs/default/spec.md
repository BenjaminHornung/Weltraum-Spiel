# Capability: RCS Attitude Without Linear Drift

## Requirements

### Requirement: Pitch and yaw attitude commands are translation-neutral

Pure pitch and pure yaw RCS attitude commands from rest SHALL create intentional angular velocity while leaving local linear velocity near zero after a deterministic one-step Unity physics probe.

#### Scenario: Pitch from rest

- GIVEN the prototype ship Rigidbody is at rest with gravity disabled
- WHEN a pure pitch attitude command is applied for one physics step
- THEN angular velocity is non-zero
- AND local linear velocity magnitude is near zero
- AND active RCS nozzles/VFX are reported

#### Scenario: Yaw from rest

- GIVEN the prototype ship Rigidbody is at rest with gravity disabled
- WHEN a pure yaw attitude command is applied for one physics step
- THEN angular velocity is non-zero
- AND local linear velocity magnitude is near zero
- AND active RCS nozzles/VFX are reported

### Requirement: Roll behavior remains stable

Pure roll RCS attitude commands SHALL keep the existing Q/E behavior: intentional angular velocity without meaningful linear drift.

### Requirement: Translation fix remains intact

Pure RCS translation commands on local +/-X, +/-Y, and +/-Z SHALL remain COM-neutral and SHALL not create unintended rotational torque.

### Requirement: SAS attitude braking remains translation-neutral

SAS counter-commands for pitch, yaw, and roll SHALL reduce angular velocity without adding meaningful linear drift from the RCS correction itself.

### Requirement: No scope expansion

This change SHALL NOT introduce new controls, camera behavior, ship editor behavior, final RCS allocation architecture, new assets, or new Unity packages.

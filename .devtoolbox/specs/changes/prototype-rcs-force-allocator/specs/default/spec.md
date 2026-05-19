# Capability: Prototype RCS Force Allocation

## Requirements

### Requirement: Single per-nozzle allocation per physics step

The RCS controller SHALL aggregate translation, attitude, and SAS demands before applying forces, and SHALL apply no more than one physical force per active nozzle in a physics step.

#### Scenario: Combined input does not oversubscribe a nozzle

- GIVEN translation and attitude are both commanded
- WHEN the RCS controller allocates nozzles for one physics step
- THEN each selected nozzle has one throttle value in `[0, 1]`
- AND no selected nozzle applies more than its configured max thrust

### Requirement: Translation targets normalized net force

Full local translation on each primary axis SHALL target comparable net force independent of how many nozzles happen to face that direction.

#### Scenario: Axis force parity

- GIVEN the default prototype ship RCS layout
- WHEN full `+X`, `+Y`, and `+Z` translation commands are probed separately
- THEN each resulting net force magnitude is near the configured translation target
- AND axis differences caused only by matching nozzle count are removed or clearly bounded

### Requirement: Translation minimizes unintended torque

Pure local translation commands SHALL create near-zero unintended angular velocity and near-zero estimated torque in the default prototype ship.

### Requirement: Attitude minimizes unintended force

Pure pitch, yaw, and roll commands SHALL create angular velocity while keeping net linear velocity near zero.

### Requirement: SAS uses the allocator

SAS braking SHALL use the same RCS allocation path and SHALL not apply separate per-axis nozzle forces that bypass per-nozzle budgets.

### Requirement: Diagnostics and VFX remain visible

The allocator SHALL keep active nozzle count, active nozzle IDs, and nozzle VFX activation available for debug overlay and manual inspection.

### Requirement: Scope boundary

This change SHALL NOT introduce a final ship editor, external optimizer dependency, new Unity package, camera behavior change, main-engine/gimbal rewrite, projectile change, or fuel-system change.

# Capability: Stable RCS Angular Authority

## Requirement
`RcsSolverMode.StablePrototype` must be the safe default for live prototype flight and must not derive attitude torque authority from imported nozzle lever arms.

## Expected Behavior
- Manual attitude input maps to bounded angular acceleration and torque using current rigidbody inertia.
- SAS damping maps to bounded angular acceleration and torque using current rigidbody inertia.
- Translation in `StablePrototype` applies force at center of mass and does not create torque.
- Pure attitude in `StablePrototype` applies torque and does not create net translation force.
- The experimental physical nozzle allocator remains available as an opt-in mode.
- Diagnostics expose desired, actual, residual force/torque and effective torque authority.

## Scenarios
- Holding W/A/S/D/Q/E for one second on the imported default scout keeps angular velocity below the regression threshold.
- Releasing input with SAS enabled damps angular velocity without high-frequency sign flipping.
- Translation mode forward/back/left/right/up/down changes linear velocity in the expected direction while angular velocity stays low.

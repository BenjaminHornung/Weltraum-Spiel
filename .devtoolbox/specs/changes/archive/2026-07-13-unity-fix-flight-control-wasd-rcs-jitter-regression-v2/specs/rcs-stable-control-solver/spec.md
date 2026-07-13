# Capability: rcs-stable-control-solver

## Requirement
The RCS controller SHALL default to a stable prototype solver that decouples translation force from attitude torque while preserving diagnostics, fuel use, and optional visual nozzle feedback.

## Scenarios
- Pure translation applies force at center of mass and does not introduce meaningful torque.
- Pure attitude/SAS applies torque directly and does not introduce meaningful net force.
- Mixed translation and attitude apply center-of-mass force plus direct torque in the same step.
- Desired, actual, and residual force/torque diagnostics reflect the stable solver result.
- The allocator status reports `stable-prototype` when the stable path applies successfully.
- The existing physical nozzle allocator remains available as an experimental opt-in mode.

## Constraints
- No Rigidbody force or torque may be applied off the Unity main thread.
- No Unity hierarchy or component lookup may be introduced in the per-frame solver beyond existing cached nozzle state.
- RCS fuel consumption must remain approximately proportional to command magnitude and throttle equivalent.

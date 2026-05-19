# Design: Physics Test Suite

## Test Layers

Use a pragmatic mix:

- pure math tests where code can be isolated,
- Unity MCP deterministic probes for Rigidbody/MonoBehaviour behavior,
- documented manual acceptance checks for feel and camera.

## Initial Coverage

Priority tests:

- main throttle-only force with near-zero torque,
- gimbal torque cross product,
- RCS translation net force with near-zero torque,
- RCS attitude net torque with near-zero force,
- no nozzle throttle above 1,
- fuel partial-step behavior,
- projectile momentum/recoil once implemented,
- timestep comparison at 0.02 vs 0.01 where practical.

## Evidence

Test artifacts should live under `.devtoolbox/specs/changes/<change>/tests/` following existing project convention.

## Risks

Unity physics can be nondeterministic at high detail. Tests should use tolerances and deterministic generated setups.

# Draft Spec: prototype-regression-test-harness

Status: draft only. Promote to `.devtoolbox/specs/changes/prototype-regression-test-harness/` before implementation.

## Purpose

The prototype now has several interacting systems: generated ship bootstrap, Rigidbody zero-g flight, fuel, main thruster, gimbal, RCS, SAS, camera, projectile gun, target hit feedback, debug overlay, and prototype config. Future agents can easily break one system while improving another. Add a small repeatable test harness before larger gameplay features expand the surface area.

## In Scope

- Unity EditMode or PlayMode smoke tests where practical.
- Deterministic script-level probes if full Unity Test Framework setup is too heavy.
- Bootstrap validation.
- Core runtime sanity checks for Rigidbody, fuel, thrust, RCS, SAS, projectile, target feedback, camera, and config.
- A clear test protocol document under the implementing spec.
- README section or developer note describing how to run the tests.

## Out of Scope

- No new gameplay features.
- No final CI pipeline unless trivial.
- No full physics correctness proof.
- No performance benchmark framework.
- No visual snapshot testing in this slice.

## Required Test Coverage

Minimum checks:

- Bootstrap creates the prototype ship from the host scene or empty scene.
- Ship Rigidbody has gravity disabled and zero/near-zero damping as intended.
- Main thrust consumes fuel.
- Empty fuel blocks main thrust.
- Main throttle-only thrust does not create meaningful unintended torque.
- RCS installed nozzle count matches expected generated defaults.
- At least one RCS command activates nozzle VFX and force/torque telemetry.
- SAS enabled reduces angular velocity after release.
- SAS disabled leaves angular velocity persistent enough to confirm vacuum behavior.
- Gun spawns visible projectiles.
- Projectile initial velocity includes ship velocity plus muzzle velocity.
- Projectile lifetime cleanup still happens.
- Projectile can trigger target dummy hit feedback.
- `PrototypeShipConfig` can override representative fuel, thruster, RCS, gun, and camera values.

## Acceptance Criteria

- A future agent can run a documented verification command or Unity MCP protocol to catch major prototype regressions.
- Test names map clearly to gameplay behavior, not implementation trivia.
- Tests avoid creating brittle dependencies on exact object instance IDs or hidden scene state.
- Tests clean up temporary scenes/objects after running.
- The test harness does not slow normal manual Play mode iteration.
- Unity MCP validation/compile passes after adding the test harness.

## Risks

- Unity PlayMode tests can be slow or awkward through AI agents. If so, use deterministic Unity MCP `execute_code` probes first and document the tradeoff.
- Very high projectile speeds are known to be collision-sensitive; tests should focus on existing target feedback behavior, not perfect high-speed collision reliability.

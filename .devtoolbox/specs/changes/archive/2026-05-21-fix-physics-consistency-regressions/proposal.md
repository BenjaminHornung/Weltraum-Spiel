# fix-physics-consistency-regressions

## Why

External review found several consistency regressions in the prototype physics core. The prototype now has recoil, projectile impact damage, central force diagnostics, RCS allocation, configuration assets, and SAS/assist routing. These systems are useful only if their diagnostics, tests, and configuration semantics match the physical behavior they claim to represent.

The highest-risk issues are numerical or semantic mismatches rather than missing features: projectile recoil uses the configured projectile mass, but impact events still use the Projectile component default mass; impulse requests are counted together with continuous force diagnostics; and some RCS/configuration values appear tunable while not reliably affecting the simulated result.

## What

Fix the confirmed review findings that can cause incorrect physics evidence or misleading tuning in the current prototype:

- Replace the outdated recoil-path-only test with a real opposite-momentum recoil validation.
- Pass the configured projectile mass into `Projectile` so recoil, rigidbody mass, impact impulse, and damage use the same value.
- Split `ShipPhysicsCore` diagnostics for continuous force/torque and impulse/angular impulse.
- Improve RCS allocator diagnostics so desired, actual, and residual force/torque are visible separately.
- Normalize the RCS allocator cost function so force and torque errors are not compared as raw unrelated units.
- Make RCS spool-up/spool-down settings affect actual nozzle throttle.
- Ensure null `PrototypeShipConfig` application resets reusable prototype components to default settings.
- Preserve manual attitude authority before applying SAS/assist torque budget.

## Out of Scope

- Replacing the greedy RCS allocator with a full NNLS/bounded least-squares solver.
- Full reverse-thrust gameplay.
- Separate RCS fuel type, Isp, heat, or power balancing.
- Docking-assist integration.
- Floating-origin support for trails/projectile sweep history/joints.
- New gameplay features or additional weapons.
- Broad cleanup of all legacy RCS methods.

## Success Criteria

- Projectile recoil test asserts the actual opposite impulse from configured projectile mass and muzzle speed.
- Projectile impact mass equals the gun/config projectile mass instead of the Projectile default.
- Recoil/impact impulses no longer inflate `NetAppliedForce`/`NetAppliedTorque` diagnostics.
- RCS debug state reports desired force/torque, actual force/torque, residual force/torque, and max nozzle throttle.
- RCS spool rates produce gradual actual nozzle throttle changes when configured below instant response.
- Rebuilding an existing prototype with `shipConfig == null` restores default component settings.
- Manual pitch/yaw/roll input keeps priority over SAS/assist torque on other axes.
- Unity script validation and relevant EditMode physics tests pass.
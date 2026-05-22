# Design: Physics Consistency Regression Fixes

## Review Scope

This change addresses confirmed review findings where the prototype reports or applies physics values inconsistently. It is intentionally a consistency slice, not a new physics architecture change.

## Projectile Mass and Recoil

`GunModule` is the source of the projectile mass used for recoil and projectile rigidbody setup. `Projectile` must receive that same mass during initialization and use it for impact-event impulse and damage estimation. The expected muzzle-relative projectile momentum is:

```text
projectileMomentum = muzzleForward * projectileMassKg * projectileSpeed
recoilImpulse = -projectileMomentum
```

The recoil validation should assert the actual impulse vector, not just that a recoil code path exists.

## Force vs Impulse Diagnostics

Continuous forces and one-shot impulses use different units and must be diagnosed separately.

```text
ForceMode.Force     -> NetAppliedForce / NetAppliedTorque
ForceMode.Impulse   -> NetAppliedImpulse / NetAppliedAngularImpulse
```

This keeps the debug overlay and physics tests from treating Newton-seconds as Newtons.

## RCS Allocator Diagnostics

The RCS allocator should distinguish:

- desired force/torque request
- actual force/torque applied by nozzles
- residual force/torque after allocation
- maximum actual nozzle throttle

`LastTranslationForce` and related debug values should not pretend the desired request is the actual applied result.

## RCS Cost Normalization

The greedy allocator remains in place, but its comparison cost should normalize force and torque residuals before combining them. This avoids raw Newton and Newton-meter magnitudes dominating each other when ship scale or nozzle placement changes.

## RCS Spool Response

`nozzleSpoolUpRate` and `nozzleSpoolDownRate` are runtime settings. They must move actual nozzle throttle toward target throttle over fixed time rather than being dead configuration values.

## Config Defaults

A null `PrototypeShipConfig` must mean default settings, even when the bootstrap reuses an already existing prototype ship. Component `ApplyConfig(null)` should apply defaults rather than returning with old values intact.

## Manual/SAS Torque Priority

Manual attitude input has first priority. SAS and assist torque should use remaining authority only, so a SAS request on another axis cannot reduce a full manual pitch/yaw/roll request through a global vector clamp.

## Risks

- RCS spool response changes expected instantaneous nozzle output; tests should either use instant/default rates or assert gradual behavior explicitly.
- Diagnostic property renames can break overlay/tests; keep compatibility properties where inexpensive.
- Config default resets can expose stale scene state that previous early-return behavior hid.
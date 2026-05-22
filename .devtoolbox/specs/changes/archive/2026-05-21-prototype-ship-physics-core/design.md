# Design: Prototype Ship Physics Core

## Architecture Direction

The long-term direction is that gameplay, input, SAS, AI, autopilot, docking assist, damage, and environmental systems express desired physical behavior as a wrench:

```text
W = [Fx, Fy, Fz, Tx, Ty, Tz]
```

The ship physics layer then decides what can actually be applied based on Rigidbody state, center of mass, available thrusters, per-nozzle limits, fuel, module health, and future constraints.

This change is only the first prototype slice of that direction.

## Core Component

Add `ShipPhysicsCore` as a Unity component on the generated prototype ship. It should:

- hold or discover the ship `Rigidbody`,
- expose center-of-mass force application,
- expose force-at-position application,
- compute and store per-step net applied force and torque diagnostics,
- provide a small reset/begin-step API so modules can keep telemetry clear.

The first implementation may remain Unity/C# MonoBehaviour-based. A UnityEngine-free physics library is explicitly deferred.

## Wrench and Application Model

Use simple prototype data structures rather than a final domain model:

- `ShipWrench`: force and torque vectors for diagnostics or future requests,
- optional `ShipForceApplication`: force plus optional world position,
- methods such as `ApplyForceAtCenterOfMass`, `ApplyForceAtPosition`, and `RecordAppliedForce` if needed.

For a force at position, the diagnostic torque uses:

```text
torque = cross(position - Rigidbody.worldCenterOfMass, force)
```

Unity remains the physical integrator; `ShipPhysicsCore` does not replace Rigidbody simulation.

## Migration Strategy

Keep behavior stable and migrate only the current ship force paths:

1. `PrototypeBootstrap` adds/configures `ShipPhysicsCore` before configuring thrusters.
2. `MainThrusterModule` uses the core for COM-safe straight thrust and gimbal steering force at the nozzle.
3. `RcsThrusterController` uses the core for each allocated nozzle force instead of direct Rigidbody calls.
4. `PrototypeDebugOverlay` can display core net force/torque alongside existing module diagnostics.

Projectile motion remains outside this slice. Recoil and projectile momentum become a later spec.

## Relationship To RCS Allocator

The current RCS allocator remains the owner of per-nozzle budget and selection. `ShipPhysicsCore` should not duplicate nozzle allocation logic in this slice. It is the central force application and telemetry path, not yet the final solver.

## Main Thruster Modes

The user-provided architecture recommends two main-thrust modes:

- `ComSafeSteeringOnly`: straight thrust at COM, only gimbal delta at nozzle,
- `FullyPhysicalNozzleForce`: full gimballed force at nozzle.

This spec documents the direction, but the implementation should keep the existing gameplay-stable default. Adding the enum is acceptable only if it remains inspector-tunable and does not force a behavior change.

## Risks

- Moving force application can accidentally change ship feel even when formulas are equivalent.
- If diagnostics are reset at the wrong point in `FixedUpdate`, overlay values may flicker or miss forces.
- Centralizing too much too early would create fake final architecture. Keep this slice deliberately thin.
- Existing RCS probes must be rerun because the allocator and core will now interact.

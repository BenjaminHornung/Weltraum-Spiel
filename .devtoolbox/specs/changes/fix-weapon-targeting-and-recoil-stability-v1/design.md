# Design

## Target Discovery

The normal discovery path will move from repeated global scene searches to a static runtime registry. Explicit `PrototypeWeaponTargetMarker` components and trusted combat components register their transforms on enable and deregister on disable. The Weapon Computer refreshes from that registry and only rebuilds its target adapters when the registry version changes or the operator manually requests a refresh.

`PrototypeTargetDummy`, `ShipStats`, and `PrototypeModuleDamageState` are allowed to auto-register because they are already combat/navigation target semantics. A bare `Rigidbody` is not enough to become a target anymore. That keeps projectiles, weapon visuals, debris, and physics props out of the selectable set unless they are explicitly marked.

Target adapters still normalize candidates to their target root, aggregate child `PrototypeModuleDamageState` health when present, and provide neutral fallback health for explicit non-health targets. The `AvailableTargets` list stays owned and reused by `PrototypeWeaponComputer`.

## Recoil Stabilization

The existing recoil impulse remains the source of truth:

```text
recoilImpulse = -shotDirection * projectileMass * projectileSpeed
recoilAngularImpulse = cross(muzzlePosition - centerOfMass, recoilImpulse)
```

A new `WeaponRecoilStabilizer` records the recoil impulse and estimated angular impulse when `GunModule` or `PrototypeTurretWeapon` fires. During the next short stabilization window it emits an opposite torque request as a physical `FlightAssistRequest` with source `WeaponStabilization`.

The request is converted to ship-local torque and combined with existing SAS, momentum, docking, and autopilot requests before allocation. Manual attitude input keeps the existing first priority in `RcsThrusterController`, so pilot input masks or consumes authority before weapon stabilization receives the remaining budget.

The stabilizer does not write Rigidbody velocity, does not alter damping, and does not apply force directly. RCS fuel/nozzle/authority limitations remain visible through actual and residual RCS torque diagnostics.

## Diagnostics

Diagnostics will expose:

- last weapon recoil impulse
- estimated weapon recoil angular impulse
- weapon stabilization torque request
- weapon stabilization authority/status label
- actual RCS torque
- residual RCS torque
- SAS/RCS authority status

The existing IMGUI diagnostics and console already sample controller/RCS state once per UI draw, so new lines will reuse that path.

## Risks

- Auto-registering `PrototypeModuleDamageState` components can create duplicate candidates for multi-module ships; registry discovery must normalize to a root and dedupe.
- Combining multiple assist requests can hide source labels if only one source field is available; weapon-specific diagnostics must stay separate from the aggregate request label.
- The recoil compensation window must be short enough to feel like active stabilization, not a long artificial damping layer.

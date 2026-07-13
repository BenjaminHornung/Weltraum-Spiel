# Design

## Change
`fix-imported-functional-ship-spin-root-cause-v1`

## Local Evidence
- Unity docs confirm `Rigidbody.AddTorque` expects world-space torque and `ForceMode.Force` changes angular velocity by torque * fixedDeltaTime / inertia.
- Unity docs confirm `Rigidbody.inertiaTensor` is the rotational analogue of mass; larger components require more torque for the same angular acceleration.
- Unity docs confirm automatic inertia can fall back to `Vector3(1,1,1)` when no colliders are present, which is unsafe for the imported functional prototype.

Docs read:
- `E:\Unity\Documentation\en\ScriptReference\Rigidbody.AddTorque.html`
- `E:\Unity\Documentation\en\ScriptReference\Rigidbody-inertiaTensor.html`
- `E:\Unity\Documentation\en\ScriptReference\Rigidbody-automaticInertiaTensor.html`
- `E:\Unity\Documentation\en\ScriptReference\ForceMode.Impulse.html`

## Decisions

### Imported Functional Mass/Inertia
The generated fallback already uses `PrototypeModuleMassLayout.ConfigureGeneratedPrototypeDescriptors(...)`. Imported functional ships now get an equivalent descriptor layout through `ConfigureImportedFunctionalDescriptors(...)`. The descriptors are simple, plausible runtime anchors for hull, cockpit, fuel, engine, gun, and RCS groups. If a ship still has no descriptors, `ShipStats.ApplyMassProperties(...)` applies a conservative safe box inertia instead of leaving Unity automatic inertia to a potentially colliderless rig.

This reuses the existing `ModuleMassDescriptor` and `ShipMassProperties` pipeline instead of introducing a parallel physics state model.

### Stable Prototype RCS
`ExperimentalPhysicalNozzles` can keep deriving authority from nozzle lever arms. `StablePrototype` must not. Its manual attitude input is converted to desired local angular acceleration and then to torque via the current rigidbody inertia. The result is clamped by explicit acceleration, angular velocity, and maximum torque limits.

This makes prototype flight playable even when imported sockets are scaled or placed in visually convenient locations.

### Weapon Recoil
Prototype weapons default to `WeaponRecoilMode.CenterOfMassSafe`. Physical muzzle recoil remains available via `PhysicalMuzzle`, but it is guarded by muzzle lever-arm and angular impulse clamps. Diagnostics still record muzzle position and lever arm so imported socket issues remain visible without making Space/fire a spin trigger.

### Diagnostics and Evidence
`PrototypeShipPhysicsSanityReport` captures a single structured snapshot across rigidbody, functional rig, RCS, and weapon recoil fields. Tests and evidence CSV use this report so future regressions can be checked numerically, not just visually.

## Risks
- The imported descriptor layout is intentionally approximate. It is safer than colliderless automatic inertia, but not a final ship-authoring workflow.
- Tests that previously expected default physical muzzle recoil must opt into `PhysicalMuzzle` explicitly.
- If imported socket lever arms exceed thresholds, the evidence should fail loudly rather than silently compensate.

# Capability: Weapon Muzzle Binding

## Requirements
- `GunModule` resolves imported muzzle transforms before creating or using a root fallback.
- Resolution order: `PrototypeShipSocket` with type `WeaponMuzzle`, exact `Muzzle`, suffix `_MUZZLE`, then a single unambiguous name containing `MUZZLE`.
- Ambiguous multiple muzzle candidates produce a warning and deterministic primary selection.
- `GunModule.ConfigureMuzzle(Transform)` remains the explicit imported-binder path.
- Projectile spawn position, direction, and recoil origin use the resolved muzzle.
- Blender gun parts expose `WeaponMuzzle`, `TurretYawPivot`, and `TurretPitchPivot` socket metadata/placeholders.

## Non-Goals
- No turret AI, target tracking, or multi-gun bank implementation in this change.

## Tests
- Imported `PART_Gun_Mount_Light_Mk1_MUZZLE` is resolved.
- Projectile spawn position equals the imported muzzle position.
- Recoil position equals the imported muzzle position.
- No fallback root muzzle is created when a real muzzle exists.

## Acceptance
- Gun projectiles emerge from the actual Blender gun barrel/muzzle.
- Recoil acts at the true muzzle position.
- Turret pivot sockets exist and are documented for later work.
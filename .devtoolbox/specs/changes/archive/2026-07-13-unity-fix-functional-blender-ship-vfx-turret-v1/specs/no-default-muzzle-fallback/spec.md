# Capability: No Default Muzzle Fallback

## Requirement
Imported default weapon fire SHALL never create or use a root/default muzzle origin. Missing imported muzzle or muzzle flash markers SHALL prevent fire and expose an explicit status instead of producing projectile, tracer, or flash output from `PrototypeShip/Muzzle`, root zero, or `Vector3.zero`.

## Scenarios
- Given default imported mode and no imported `WEAPON_MUZZLE_*`, when `GunModule` or `PrototypeTurretWeapon` attempts to fire, then `TryFire` returns false and last status is no muzzle or missing socket.
- Given default imported mode, when the ship is built, then there is no direct child `PrototypeShip/Muzzle` created by fallback logic.
- Given default imported mode, when the ship is built, then there is no root `PrototypeShip/EngineNozzle` created by fallback VFX logic.
- Given projectile simulation receives an invalid/missing muzzle for the normal weapon path, when a fire request would otherwise use `Vector3.zero`, then the shot is rejected before visual/projectile emission unless an explicit test/debug mode allows it.
- Given a valid imported muzzle is present, when firing succeeds, then fire request origin is near `WEAPON_MUZZLE_PRIMARY` and not near root/default zero except if the real imported marker is there, which is invalid for the Demo Scout.

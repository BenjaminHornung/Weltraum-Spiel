# Proposal

## Change
`fix-functional-blender-ship-vfx-turret-v1`

## Problem
The current runtime ship still uses generated primitives as the functional PrototypeShip. The imported Blender scout can be selected as a visual overlay, but its sockets are not the authoritative runtime source for main thrust, RCS, weapon muzzle, muzzle flash, or turret pivots. As a result, VFX and weapon fire can originate from generated or fallback transforms, and the visible turret geometry does not prove functional yaw/pitch tracking.

Discovery confirmed the split:
- `PrototypeBootstrap.BuildPrototype()` builds generated main thrusters, gun module marker hierarchy, RCS blocks, and engine VFX first.
- `PrototypeShipVisualSwitcher` starts in `GeneratedPrimitives` and mounts imported visuals under `ImportedShipVisual` without functional rebinding in the default path.
- `PrototypeImportedShipBinder`, `PrototypeShipKitVfxBinder`, and `PrototypeShipKitWeaponBinder` already know how to bind imported sockets, but are not the default runtime authority.
- `RcsThrusterController` only searches imported functional sockets after `UseImportedFunctionalSockets` is enabled.
- `GunModule` can still create a synthetic root `Muzzle`; `EngineVfxController` can still create a root `EngineNozzle` fallback.
- `PrototypeTurretWeapon.EvaluateFireStatus` applies aim as a side effect and snaps yaw/pitch instead of slewing over time.
- Existing tests cover synthetic hierarchies and imported asset binding, but not the full default Play Mode path with visible Blender turret/VFX evidence.

## Goal
Make the Blender Demo Scout the standard functional runtime ship. The normal Play Mode path must load the imported scout as the authoritative `PrototypeShip` functional basis, bind main thruster, RCS, weapon, muzzle flash, and turret pivots from imported sockets, and leave generated primitives as an explicit fallback/debug mode only.

## Non-Goals
- Do not replace the flight model or projectile simulation architecture beyond the minimum needed to use imported socket transforms safely.
- Do not mark tasks complete without Unity and Blender evidence for the relevant runtime behavior.
- Do not silently tolerate missing imported sockets by firing or rendering VFX from root/default transforms in the default imported mode.

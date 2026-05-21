# Capability: Imported Functional Socket Binding

## Requirement
Imported Blender sockets SHALL be the authoritative default runtime binding source for main thrust, RCS, weapon turret pivots, weapon muzzle, and muzzle flash. Binding SHALL run on the `PrototypeShip` root and SHALL reuse existing socket classification and imported binding utilities where possible.

## Scenarios
- Given `demo_scout_mk1.fbx` is instantiated for the default ship, when the functional binder runs, then `PrototypeShipSocketUtility.EnsureSocketsInHierarchy` classifies imported main/RCS/weapon sockets before runtime modules bind.
- Given imported main nozzles exist, when the binder runs, then `MainThrusterModule` and `MainThrusterBank` are configured from `THRUST_NOZZLE_MAIN*` transforms and report at least one bound main thruster.
- Given imported RCS nozzles exist, when the binder runs, then `RcsThrusterController.UseImportedFunctionalSockets` is true, `RefreshNozzles()` uses imported `RCS_NOZZLE_*` transforms, and generated RCS block transforms are not active in the default imported mode.
- Given imported weapon markers exist, when the binder runs, then `PrototypeTurretMount`, `PrototypeTurretWeapon`, `GunModule`, `PrototypeWeaponComputer`, and `PrototypeWeaponComputerPanel` are bound to the imported `WEAPON_TURRET_*`, `WEAPON_MUZZLE_*`, and `WEAPON_MUZZLE_FLASH_*` transforms.
- Given any required imported marker is missing, when the binder runs, then the runtime records a missing socket status/warning and avoids root/default fallback transforms in imported default mode.

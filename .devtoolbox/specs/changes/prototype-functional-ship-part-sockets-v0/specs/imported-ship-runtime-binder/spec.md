# Capability: Imported Ship Runtime Binder

## Requirements
- Add `PrototypeImportedShipBinder` to convert imported Blender ship roots into functional prototype runtime ships.
- The binder finds existing `PrototypeShipSocket` components and adds them to known imported/canonical socket transforms when missing.
- The binder normalizes runtime aliases without destroying manifest names.
- It configures or creates required runtime references for existing prototype components: `Rigidbody`, `ShipStats`, `ShipPhysicsCore`, `MainThrusterModule`, `MainThrusterBank`, `EngineVfxController`, `RcsThrusterController`, `RcsThrusterBlock`, `GunModule`, and optional thermal support when already present.
- Binding must be idempotent.

## Main Thruster Binding
- Find all `MainThrusterNozzle` sockets.
- Configure each relevant `MainThrusterModule` so `thrustTransform` points at the real nozzle.
- Configure `MainThrusterBank` with discovered modules.
- Bind `MainThrusterGimbalPivot` where present.
- Do not use ship-center fallback when valid nozzles exist.

## RCS Binding
- Find all `RcsNozzle` sockets.
- Group nozzles by pod/group id.
- Ensure runtime-compatible names or socket-aware controller discovery.
- Ensure every runtime RCS nozzle has a VFX child or bound ParticleSystem.
- Ensure no known disabled/inboard socket fires into the ship hull.

## Gun Binding
- Find `WeaponMuzzle` sockets and configure `GunModule` explicitly with the real transform.
- For multiple guns in this prototype, choose the first deterministic primary muzzle and report the rest as future multi-gun work.
- Do not create a root fallback muzzle when a real socket exists.

## Diagnostics
The binder reports `foundMainNozzles`, `foundGimbalPivots`, `foundRcsNozzles`, `foundMuzzles`, `boundMainThrusters`, `boundRcsNozzles`, `boundGuns`, `missingRequiredSockets`, and warnings.

## Acceptance
- Demo Scout and Demo Cargo can be bound as runtime prototype ships.
- Main, RCS, and gun runtime references point at imported sockets.
- Binding does not duplicate VFX or socket components on repeated calls.
- No projectiles or effects originate from the ship root when real sockets exist.
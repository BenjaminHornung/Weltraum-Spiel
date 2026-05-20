# Capability: Functional Ship Part Sockets

## Requirements
- Add `PrototypeShipSocket` as the canonical runtime metadata component for imported and generated socket transforms.
- Supported socket types: `Hardpoint`, `MainThrusterNozzle`, `MainThrusterGimbalPivot`, `RcsNozzle`, `WeaponMuzzle`, `TurretYawPivot`, `TurretPitchPivot`, and `VisualOnly`.
- Supported axis roles: `ForceDirection`, `PlumeDirection`, `BarrelForward`, and `ConnectorNormal`.
- Socket metadata includes `socketId`, `partId`, `moduleId`, `groupId`, `direction`, `isRuntimeSocket`, `isBuilderSocket`, and `notes`.
- Supported directions: `Forward`, `Back`, `Left`, `Right`, `Up`, `Down`, `Main`, `Muzzle`, and `Unknown`.
- Runtime discovery must not depend only on free-form imported names.
- Existing names remain backward-compatible, including `MainThrusterGimbal`, `MainThrusterNozzle`, `RCS_Nozzle_<BlockId>_<Direction>`, `Muzzle`, and imported names such as `PART_RCS_Pod_4Way_Mk1_RCS_NOZZLE_FORWARD`.
- Sockets are represented by stable GameObject/Empty transforms, not mesh faces.
- Manifest JSON must explicitly describe functional sockets where exports are updated.

## Expected Behavior
- Engine parts expose a main thruster nozzle socket.
- Gimbal-capable engine parts expose a gimbal pivot socket.
- RCS parts expose multiple RCS nozzle sockets grouped by pod/group id.
- Weapon parts expose a weapon muzzle socket and placeholder turret yaw/pitch sockets.
- Builder hardpoints remain available as builder sockets.
- Socket transforms have stable local position, rotation, and scale.

## Constraints
- No per-ship manual effect coordinate tables.
- Do not break procedural `PrototypeBootstrap` ships.
- Do not remove existing connector empties or manifest entries.

## Acceptance
- Binder and runtime components can find sockets from components or canonical/imported names.
- Every imported demo ship has typed or normalizable main, RCS, muzzle, and hardpoint sockets.
- Socket axis conventions are documented and test-covered.
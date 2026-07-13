# Design: Functional Ship Part Sockets

## Existing Reuse
This change extends the current prototype modules instead of adding parallel gameplay systems. It reuses `GunModule`, `RcsThrusterController`, `RcsThrusterBlock`, `MainThrusterModule`, `MainThrusterBank`, `EngineVfxController`, `PrototypeShipKitVfxBinder`, and the existing Blender kit manifest/export paths.

New code is justified only for the missing contract layer: imported models need typed socket metadata and a binder that can translate Blender hierarchy names into existing runtime component references.

## Socket Contract
`PrototypeShipSocket` is a small MonoBehaviour placed on Empty/GameObject transforms. Runtime discovery prefers typed sockets, then canonical transform names, then backwards-compatible imported names. The intended axis contract is:

- Nozzle `Transform.forward` = gameplay force direction.
- Main/RCS plume visual direction = opposite `Transform.forward`.
- Muzzle `Transform.forward` = projectile direction.
- Connector `Transform.forward` = connector normal.

This keeps physics and VFX unambiguous while allowing imported GLB/FBX transforms to be normalized once.

## Runtime Binder
`PrototypeImportedShipBinder` is the bridge from imported hierarchy to existing prototype components. It should run on a ship root or preview/runtime root, add missing `PrototypeShipSocket` components for recognized imported names, then configure component references. The binder is idempotent: repeated `BindNow` calls must not duplicate sockets, VFX children, or modules.

The binder reports counts and warnings so broken imports are visible without stepping through Unity hierarchy manually.

## VFX Strategy
Runtime VFX should use prefab assets from a small library asset. The existing preview binder can remain for scene visualization, but runtime ships use the same VFX prefabs through socket-aware binding. Main engine VFX should be controlled by throttle through existing engine VFX logic where practical. RCS VFX should be children of the nozzle socket so `RcsThrusterController` or a socket-aware adapter can enable emission from actual nozzle activity.

For multiple main engines, the preferred v0 path is one `EngineVfxController` per nozzle or a small socket-bound controller per nozzle, because this avoids rewriting the current throttle model into a broad multi-engine visual bank. `MainThrusterBank` still owns thrust aggregation.

## Weapon Binding
`GunModule` keeps its existing fallback behavior for procedural ships, but resolves imported muzzle sockets before creating any root fallback. Muzzle resolution order is typed `PrototypeShipSocket`, exact `Muzzle`, suffix `_MUZZLE`, then a single unambiguous name containing `MUZZLE`.

## Gimbal Binding
`MainThrusterModule` should expose a configuration method for a gimbal visual pivot. Imported engine parts provide a `MainThrusterGimbal`/`MainThrusterGimbalPivot` socket and a child `MainThrusterNozzle` socket. If no gimbal pivot exists, existing non-gimballed behavior remains valid.

## Blender/Export Updates
Blender changes are limited to functional Empty/marker hierarchy, canonical aliases, socket rotations, manifest updates, and re-export. The visual kit remains low-poly and no external assets are introduced.

## Verification
Editor tests should cover socket detection, idempotent binding, gun muzzle position, RCS nozzle discovery and VFX children, main nozzle VFX binding, gimbal support/no-gimbal fallback, and preview scene survival. Blender verification should confirm socket names, transform scales, exports, and manifest consistency.
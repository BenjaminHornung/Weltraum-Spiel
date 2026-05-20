# Capability: Thruster VFX Runtime Binding

## Requirements
- Add or update a reusable VFX library asset at `Assets/Art/PrototypeShipKit/VFX/PrototypeShipVfxLibrary.asset`.
- Runtime binding uses `MainThrusterVfx.prefab`, `RcsThrusterVfx.prefab`, and optional `MuzzleFlashVfx.prefab` from that library.
- `EngineVfxController` or a compatible runtime binding path recognizes `MainThrusterNozzle` sockets and imported `THRUST_NOZZLE_MAIN` names.
- `RcsThrusterController` recognizes imported RCS sockets or receives normalized runtime nozzles from the binder.
- If an RCS nozzle has no child named `VFX`, the binder creates/binds one from the library.
- Runtime VFX activation follows real throttle/RCS activity, not preview-only pulses.
- Preview VFX remains available for the preview scene.

## Direction Contract
- Nozzle forward means gameplay force direction.
- Visual plume points opposite nozzle forward.
- Binder or VFX prefab local rotation may handle the visual inversion; physics/socket transforms should remain force-direction correct.

## Acceptance
- Blender-imported ships show main thruster VFX at imported engine nozzles during throttle.
- Blender-imported RCS nozzles have VFX children and can be toggled by actual nozzle throttle/activity.
- Repeated binding does not duplicate VFX children.
- Preview scene still works after runtime binding changes.
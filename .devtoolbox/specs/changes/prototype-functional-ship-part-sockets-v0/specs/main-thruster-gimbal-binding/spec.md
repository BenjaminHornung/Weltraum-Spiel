# Capability: Main Thruster Gimbal Binding

## Requirements
- Blender engine exports expose either canonical `MainThrusterGimbal` > `MainThrusterNozzle` hierarchy or typed sockets for `MainThrusterGimbalPivot` and `MainThrusterNozzle`.
- `MainThrusterModule` exposes an additive configuration method or overload for a gimbal visual pivot.
- Existing no-gimbal behavior remains valid and does not throw.
- Imported binder passes gimbal pivot and nozzle references to the main thruster module.
- Visual gimbal rotation affects the imported engine bell/pivot while the VFX remains attached to the nozzle.
- Diagnostics report whether gimbal support is available, and include gimbal pivot/nozzle names.

## Tests
- Imported engine with gimbal pivot reports gimbal support.
- Gimbal command changes thrust direction and visual pivot local rotation.
- Imported engine without gimbal pivot does not crash and reports no visual gimbal.

## Acceptance
- Blender main engine can visibly gimbal in runtime preview/test.
- Main VFX remains at the real nozzle and does not jump to ship root.
- Existing generated ship thrust behavior is unchanged.
# Capability: Blender Export Socket Contract

## Requirements
- Functional points are present as exported Empty/GameObject transforms or visible marker objects, not only theoretical manifest entries.
- Canonical names are available for Unity discovery: `MainThrusterGimbal`, `MainThrusterNozzle`, `RCS_Nozzle_<PodId>_<Direction>`, `Muzzle`, `TurretYawPivot`, and `TurretPitchPivot`.
- Existing descriptive Blender names may remain, but Unity must receive either canonical alias transforms or typed socket metadata after import.
- Axis contract is encoded in socket rotation: nozzle forward = force direction, plume opposite; muzzle forward = projectile direction; connector forward/up documented.
- Socket transforms have no negative scale and stable local transforms.
- FBX/GLB exports and the manifest are updated when sockets are changed.
- Demo Scout and Demo Cargo contain real runtime sockets.

## Acceptance
- Unity can find imported functional sockets without manual scene positioning.
- Manifest socket data and real imported hierarchy agree.
- Demo ships and individual parts are re-exported when Blender hierarchy changes.
- Existing visual geometry and connector readability are preserved.
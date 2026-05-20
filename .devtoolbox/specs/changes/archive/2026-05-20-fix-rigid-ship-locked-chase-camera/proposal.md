# fix-rigid-ship-locked-chase-camera

## Why

The current chase camera still behaves like a soft follower. During acceleration the ship can move away from the camera, and during WASD/Q/E attitude changes the camera lags or appears to orbit instead of staying attached behind the ship.

This is especially harmful for the spaceflight prototype because flight control debugging depends on a stable view of the ship. RCS, SAS, gimbal, throttle, and projectile behavior are harder to diagnose when the camera introduces its own delayed motion.

## What

Make the default camera mode a rigid ship-locked chase camera. The camera shall compute a ship-local rear/up anchor every `LateUpdate` and set the camera world pose exactly, without position or rotation smoothing in the default chase mode.

The prototype keeps a small custom camera implementation instead of adding Cinemachine. Cinemachine is not installed in the project, and a deterministic script-level fix is smaller and easier to reason about for this prototype slice.

Included behavior:

- Mode 0 becomes `ChaseLocked`.
- The camera anchor is `target.position + target.rotation * new Vector3(0, followHeight, -followDistance)`.
- Mode 0 uses exact pose updates, not `Lerp`/`Slerp` lag.
- The camera rotation is ship-locked, including ship roll.
- Right mouse button allows a small local lookaround without moving the anchor.
- Releasing right mouse button recenters the local lookaround so the ship returns to center.
- `V` still cycles debug camera modes.
- Backquote/# reset returns to `ChaseLocked` and zero look offsets.
- Debug overlay shows camera mode, anchor error, and look yaw/pitch.

## Out of Scope

- Installing or configuring Cinemachine
- Cinematic camera blending
- Combat targeting cameras
- Final cockpit camera implementation
- Camera collision or occlusion handling
- Orbital map camera behavior
- Final multi-camera architecture

## Success Criteria

- DevToolbox spec validation passes.
- In Mode 0, the camera stays fixed behind the ship during high forward acceleration.
- In Mode 0, WASD/Q/E ship rotation does not make the ship drift away from the camera.
- Mode 0 applies no smoothing to camera position or rotation.
- Mode 0 anchor error remains near zero after every camera update.
- Right mouse lookaround changes only local viewing direction, never anchor position.
- Releasing right mouse button recenters local lookaround.
- `V` debug modes remain available for inspection.
- Backquote/# reset restores exact `ChaseLocked` behavior.
- The debug overlay reports camera diagnostics.
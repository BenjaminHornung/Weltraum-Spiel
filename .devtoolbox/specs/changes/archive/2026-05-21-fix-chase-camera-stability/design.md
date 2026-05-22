# Design: Chase Camera Stability

## Current Problem

`SimpleFollowCamera` currently computes the desired camera offset mostly from a world-space orbit rotation. In the default mode, the desired position is not derived from the ship's `forward` and `up` vectors. This makes the default view behave more like a loose orbital camera than a chase camera.

During RCS rotations, the ship can turn while the camera remains on a world-relative offset. The result is a confusing view where the camera no longer communicates the ship's current heading.

## Camera Model

Keep the existing lightweight `SimpleFollowCamera` script and avoid introducing Cinemachine for this prototype slice.

The default mode should be a chase mode:

- Position is based on `target.position - target.forward * distance + target.up * height`.
- Look target is slightly ahead of the ship along `target.forward`.
- Camera up should use the ship up vector in chase mode, so the camera frame tracks ship attitude consistently.
- Smoothing should use exponential damping and snap immediately after bind/reset/mode switch.

## Mouse Look

Mouse look should affect the camera perspective only. It must not affect ship direction.

Right mouse drag may offset yaw and pitch around the target for looking around. Reset returns those offsets to the default chase view.

## Camera Modes

Keep the existing mode cycling behavior with `V`, but make mode 0 the reliable chase cam:

- Mode 0: chase, local to ship orientation.
- Mode 1: free/orbit prototype view around the ship.
- Mode 2: side/inspection prototype view.

Only mode 0 is hardened in this change. The other modes remain simple debug views.

## Risks

- If chase mode follows full ship roll, rolling maneuvers can rotate the horizon. This is acceptable for a spacecraft chase camera and keeps the ship-relative frame honest.
- If smoothing is too low, the camera can visibly lag during fast RCS maneuvers. Defaults should favor stability over floaty movement.
- Camera collision is intentionally not handled yet, because the prototype space scene has no dense obstacles.

## Reuse Decision

Reuse `SimpleFollowCamera` and the existing bootstrap camera binding. A new camera framework would be premature for this prototype.

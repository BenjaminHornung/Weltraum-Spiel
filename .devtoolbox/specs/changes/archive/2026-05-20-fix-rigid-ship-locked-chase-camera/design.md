# Design: Rigid Ship-Locked Chase Camera

## Decision

Fix the custom `SimpleFollowCamera` instead of adding Cinemachine. Cinemachine is not installed in this Unity project, and the current defect is a small deterministic follow-camera problem: Mode 0 calculates a useful target anchor but applies it through smoothing. For this prototype, a focused custom fix is lower risk than adding a package and new camera pipeline.

## Documentation Basis

Unity's lifecycle documentation supports doing follow-camera updates in `LateUpdate`, after normal frame updates have run: https://docs.unity3d.com/6000.4/Documentation/ScriptReference/MonoBehaviour.LateUpdate.html

Unity's Rigidbody interpolation documentation says interpolation is useful when a Rigidbody is followed by a camera, because physics updates happen on a fixed timestep: https://docs.unity3d.com/6000.4/Documentation/ScriptReference/Rigidbody-interpolation.html

Unity's `Transform.SetPositionAndRotation` API sets world position and rotation together, which matches the desired exact camera pose update: https://docs.unity3d.com/6000.4/Documentation/ScriptReference/Transform.SetPositionAndRotation.html

## Current Failure Model

`SimpleFollowCamera` currently computes a desired follow position, then applies `Vector3.Lerp` for position and `Quaternion.Slerp` for rotation. That is fine for an intentionally soft camera, but it creates a false lagging camera in a spacecraft prototype. When the ship accelerates or rotates quickly, the camera remains behind the desired ship-local anchor for visible frames, so the ship appears to pull away or orbit relative to the view.

## Camera Modes

Mode 0 is renamed conceptually to `ChaseLocked`. It is the default flight camera and must be deterministic.

Mode 1 and Mode 2 remain debug modes. They may continue using orbit-style offsets and smoothing because their purpose is inspection, not primary flight control.

## ChaseLocked Position

Every `LateUpdate`, Mode 0 calculates the exact ship-local anchor:

```csharp
target.position + target.rotation * new Vector3(0f, followHeight, -followDistance)
```

This uses the ship's full rotation, including roll. The position is applied directly; no `Lerp`, no damping, and no smoothing are used in Mode 0.

## ChaseLocked Rotation

The default rotation is ship-locked. The camera rolls with the ship and points along the ship's forward direction from the rear anchor.

A small local mouse-look offset may be applied to the camera rotation only. This offset is local to the ship and never changes the anchor position.

## Mouse Look

Right mouse button enables momentary lookaround in Mode 0. While held, mouse movement adds a limited local yaw/pitch offset. When released, the local yaw/pitch offset recenters toward zero so the ship returns to the middle of the view.

Mouse look in Mode 0 never changes the chase anchor. This prevents the look system from becoming an accidental orbit camera.

## Reset Behavior

Backquote/# reset sets:

- camera mode to `ChaseLocked`
- local look yaw/pitch to zero
- the next camera update to the exact ship-locked pose

## Debug Overlay

The overlay should expose camera diagnostics alongside the existing flight diagnostics:

- Camera mode name
- Anchor error in meters
- Look yaw in degrees
- Look pitch in degrees

The important acceptance signal is that anchor error in Mode 0 remains near zero even after a large target movement or rotation.

## Risks

- A fully ship-locked camera rolls with the ship. That is intentional for this slice, but it can be uncomfortable during long rolls. Future specs may add a horizon-stabilized or cockpit-specific option.
- Directly setting the camera pose can feel less cinematic than smoothing. That tradeoff is accepted because this prototype currently needs reliable control debugging.
- Input System mouse state can be unavailable in some editor contexts. The camera must null-check input devices and still run without mouse input.
- If Unity Editor play-mode verification is unavailable, deterministic edit-mode probes should verify the transform math through Unity MCP.
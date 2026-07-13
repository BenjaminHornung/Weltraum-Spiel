# Design: Autopilot Flip Chase Camera Assist

## Current Tradeoff

ChaseLocked smoothing is the right default for normal motion. When the target translates, moderate smoothing filters small physics-frame corrections and visual anchor noise, preserving the previous translation-jitter fix.

Fast flips are different. The target may be spatially close to the camera focus, but `target.rotation` can change by many degrees per frame. If the desired chase offset is computed from ship-local forward/up, the desired camera point can orbit around the ship. Position and rotation smoothing then produce visible lag, and the focus can drift out of the safe viewport before the smoothed camera catches up.

## Chosen Approach

Keep the normal ChaseLocked path intact and add a temporary assist path while a flip is detected.

- Cache optional target components: `PrototypeWaypointAutopilot` and `Rigidbody`.
- Detect assist when the autopilot reports `FlipForBrake`, or when target angular velocity exceeds a threshold. `AlignForBurn` may also assist when angular rate is high.
- During assist, use higher position and rotation smoothing, and instant or near-instant focus movement.
- Compute a stable chase reference during brake flips. Prefer velocity-derived braking reference when speed is high enough; otherwise reuse the last stable chase direction; finally fall back to ship forward.
- Check viewport safety after the desired camera/focus calculation. If the focus point leaves the safe rectangle, snap or use maximum smoothing on the next frame so the camera does not wait until the flip ends.
- Decouple camera up during rapid roll/pitch by preferring previous camera up or a smoothed up vector instead of hard-binding to `target.up` every frame.

## Reference Mode Option

Add `AutopilotFlipChaseReferenceMode`:

- `ShipForward`: preserve the legacy target-forward reference.
- `VelocityOrPrevious`: default; use target velocity during brake flips when speed is usable, otherwise use previous stable chase direction.
- `AutopilotDesiredBurnDirection`: use an autopilot burn/brake direction if the current implementation exposes a suitable stable direction; otherwise fall back without changing autopilot behavior.

The default must not blindly follow `ship.forward`, because `ship.forward` is exactly the rapidly rotating input that causes the desired chase anchor to circle the ship during the flip.

## Diagnostics

Expose read-only diagnostics from `SimpleFollowCamera` so PlayMode tests and runtime overlays can verify the assist without reflection:

- `IsAutopilotFlipCameraAssistActive`
- `CameraAngularVelocityMagnitude`
- `CameraAutopilotState`
- `CameraChaseBlendMode`
- `ViewportTargetPosition`
- `LastViewportPoint`
- `LastViewportSafetyStatus`

## Regression Strategy

Add a PlayMode regression around the existing prototype bootstrap/default scout path. It should drive or simulate a FlipForBrake-like fast rotation with the camera in ChaseLocked, assert viewport safety across frames, assert assist activation, and write CSV/screenshot evidence. Existing translation jitter/bounds tests remain the guardrail that normal smoothing was not removed.

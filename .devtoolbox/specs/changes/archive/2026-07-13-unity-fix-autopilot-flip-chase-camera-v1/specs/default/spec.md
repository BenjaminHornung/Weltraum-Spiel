# Spec: Autopilot Flip Chase Camera Stability

## Capability

ChaseLocked camera framing remains stable while the prototype autopilot performs fast flip/brake maneuvers.

## Requirements

### Flip detection

- `SimpleFollowCamera` must optionally cache `PrototypeWaypointAutopilot` from its target hierarchy when available.
- `SimpleFollowCamera` must optionally cache `Rigidbody` from its target hierarchy when available.
- The camera must identify a flip assist condition when the autopilot state is `PrototypeWaypointAutopilotState.FlipForBrake`.
- The camera must also identify a high-angular-rate assist condition when target angular velocity exceeds a configurable threshold.
- `AlignForBurn` may use the same assist path when angular rate is high enough to threaten framing.

### Flip chase behavior

- Normal ChaseLocked smoothing remains enabled during ordinary translation and low-angular-rate movement.
- While flip assist is active, position and rotation catch-up must be much faster than normal ChaseLocked smoothing.
- While flip assist is active, focus smoothing must be reduced or disabled so the focus point does not lag out of the viewport.
- Flip assist must not globally remove smoothing or change unrelated camera modes.

### Stable reference

- Add `AutopilotFlipChaseReferenceMode` with `ShipForward`, `VelocityOrPrevious`, and `AutopilotDesiredBurnDirection` options.
- The default reference mode during flip assist must avoid blindly following `ship.forward`.
- During `FlipForBrake`, a usable velocity direction should keep the chase reference stable relative to braking motion; otherwise the camera should reuse the previous stable chase direction before falling back to ship forward.

### Viewport safety

- While flip assist is active, the camera must evaluate the focus point or visual anchor with `Camera.WorldToViewportPoint`.
- A safe viewport rectangle must be configurable and default to keeping x/y between approximately `0.15` and `0.85`.
- If the point leaves the safe rectangle, the camera must snap or temporarily maximize smoothing so catch-up happens immediately.

### Up vector behavior

- During high-angular-rate flips, desired camera up must not hard-lock to the rapidly changing target up vector.
- The camera should use a stable/smoothed up reference, previous camera up, or world-up fallback to avoid roll/pitch lag that pushes the target out of view.

### Diagnostics

`SimpleFollowCamera` must expose read-only diagnostics for tests and debugging:

- `IsAutopilotFlipCameraAssistActive`
- `CameraAngularVelocityMagnitude`
- `CameraAutopilotState`
- `CameraChaseBlendMode`
- `ViewportTargetPosition`
- `LastViewportPoint`
- `LastViewportSafetyStatus`

### Tests and evidence

- Add a PlayMode test using `PrototypeBootstrapHost.unity` and the default imported demo scout or generated fallback.
- The test must place the camera in ChaseLocked and create or drive a FlipForBrake-like high angular velocity sequence.
- Across multiple frames, the ship/camera anchor viewport x/y must remain inside the safe rectangle, anchor error must remain bounded, and catch-up after the flip must happen within a defined short time.
- The test must assert `IsAutopilotFlipCameraAssistActive` becomes true during the flip condition.
- Existing translation jitter/bounds tests must continue to pass.
- Store protocol, CSV, and screenshots under `.devtoolbox/specs/changes/fix-autopilot-flip-chase-camera-v1/tests/`.

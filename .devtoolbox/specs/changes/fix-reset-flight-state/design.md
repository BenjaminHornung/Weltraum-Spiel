# Design: Reset Flight State

## Reset Model

The debug reset should be a full prototype flight-state reset, not only a transform-position assignment.

`PlayerShipController.ResetPosition()` should delegate to a reusable method such as:

```text
ResetFlightState(position, rotation, cutThrottle)
```

That method should synchronize:

- player throttle/temporary debug commands,
- Rigidbody position/rotation/linear velocity/angular velocity,
- Transform position/rotation,
- forward-acceleration telemetry baseline,
- optional `FloatingOriginBody` state,
- optional `SimpleFollowCamera` snap.

## Floating Origin

`FloatingOriginBody` already owns absolute position and velocity. Add a small public reset helper that converts the target local position into absolute state using the current manager origin, then updates Rigidbody and Transform consistently.

## Camera

Expose a public snap helper on `SimpleFollowCamera` so reset callers do not need to know private camera internals.

## Risks

Resetting state while physics is mid-step can leave one frame of stale telemetry. Verification should check resulting state after the reset call and after a short editor/probe step.

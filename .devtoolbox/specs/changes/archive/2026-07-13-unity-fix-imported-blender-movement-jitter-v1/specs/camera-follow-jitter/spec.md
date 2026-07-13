# camera-follow-jitter

## Requirements

- ChaseLocked camera movement must not hard-snap every LateUpdate during normal movement.
- Camera focus must be render-stable and may be smoothed independently from simulation COM.
- Snap behavior is still required after bind, reset framing, forced reframe/F6, large focus discontinuity, or teleport.
- Evidence must record focus point delta, camera delta, camera-minus-focus delta, camera anchor error, and camera focus source.

## Expected Behavior

When Rigidbody and imported visual motion are smooth, ChaseLocked camera motion is smooth too. Camera delta follows focus delta without large frame spikes, and anchor error remains bounded.
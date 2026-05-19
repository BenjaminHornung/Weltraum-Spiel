# fix-reset-flight-state

## Why

The debug reset position action is unreliable because it only moves the transform to the origin. Rigidbody velocity, angular velocity, rotation, throttle, debug pulses, floating-origin absolute state, and camera snap state can continue from the previous flight state and make the ship appear to ignore the reset.

## What

Replace the weak reset-position behavior with a robust prototype flight-state reset that synchronizes transform, Rigidbody, player commands, floating-origin data, and the chase camera.

## Out of Scope

- No new gameplay feature.
- No save/load reset system.
- No changes to normal flight physics.
- No broad camera rewrite.
- No floating-origin architecture changes beyond a reset helper.

## Success Criteria

- Reset sets ship position to `(0, 0, 0)` and rotation to identity.
- Reset clears linear and angular Rigidbody velocity.
- Reset cuts main throttle and pending debug input pulses.
- Reset synchronizes `FloatingOriginBody` absolute position/velocity when present.
- Reset requests the follow camera to snap on the next frame.
- Existing flight, floating-origin, camera, and validation tests still compile.

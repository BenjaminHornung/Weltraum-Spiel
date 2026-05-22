# fix-chase-camera-stability

## Why

The current prototype camera is not behaving like a real chase camera. During pitch, yaw, roll, and RCS maneuvers the camera can keep a world-space orbit offset instead of staying behind the ship, which makes the view drift into confusing angles.

We need a small camera fix before adding more flight behavior, because flight tuning is hard to judge when the visual reference frame is unstable.

## What

Update the prototype camera so the default view is a stable chase camera anchored to the ship's local orientation. The camera should keep a predictable local offset behind and above the ship, continue to support mouse look/free orbit, and reset cleanly back to chase view.

The change should remain lightweight and compatible with the existing bootstrap-generated prototype scene.

## Included

- Stable chase camera mode based on the ship transform.
- Mouse look that changes viewing perspective without steering the ship.
- Camera reset that restores a clear behind-the-ship chase view.
- Camera mode cycling remains available for prototype experimentation.
- Documentation and verification evidence.

## Out of Scope

- Cinemachine migration.
- Cockpit camera implementation beyond existing placeholder mode support.
- Target lock/combat camera.
- Orbital map camera.
- Camera collision avoidance.
- Full camera settings UI.
- Final camera architecture.

## Success Criteria

- Default camera mode stays behind and above the ship during RCS pitch, yaw, and roll.
- The camera does not drift into unrelated world-space orbit positions during ship rotation.
- Mouse look allows looking around but can be reset to chase view.
- Camera mode cycling and reset still work.
- The prototype scene/bootstrap still binds the camera correctly.
- Unity scripts compile with no script errors.

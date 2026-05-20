# fix-sas-toggle-yaw-stop

## Why

The previous SAS residual-momentum fix reduced early cutoff, but user testing still shows a relevant remaining rotation with a simple repro: turn SAS off, briefly press `A`, release `A`, then turn SAS on. SAS reacts, but the ship does not settle close enough to zero yaw rate.

For KSP-like flight, this behavior is important: when SAS is enabled after the ship is already rotating, it should actively brake that residual rotation until the debug overlay and the camera feel effectively still.

## What

Make SAS activation after existing yaw momentum converge to near-zero angular velocity. The fix should be validated against the exact repro: SAS off, apply short yaw-left input, release input, enable SAS, wait for stabilization.

## Out of Scope

- No autopilot target tracking
- No reaction wheels
- No artificial damping while SAS is off
- No RCS VFX direction fix in this change
- No keybind changes
- No full RCS solver rewrite unless investigation proves it is required

## Success Criteria

- With SAS off, a short `A` input leaves yaw angular velocity after release.
- After SAS is enabled, residual yaw is actively braked until local yaw angular velocity is effectively zero.
- The final local yaw angular velocity should be below `0.005 rad/s` in deterministic verification.
- Pitch and roll SAS braking must not regress.
- SAS-off vacuum inertia remains intact.
- Unity scripts compile with 0 script errors.

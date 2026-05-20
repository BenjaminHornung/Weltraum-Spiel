# fix-wasd-sas-residual-momentum

## Why

After the KSP-like control changes, SAS visibly reacts to W/A/S/D pitch/yaw input release, but it is weaker than Q/E roll stabilization and stops too early. The ship can keep a small but noticeable residual angular velocity even while SAS is on. In the debug overlay this can show as remaining angular velocity while the estimated RCS torque is already zero.

This breaks the prototype's core feel: in vacuum, rotation should continue when SAS is off, but when SAS is on it should actively counter residual pitch, yaw, and roll until the ship is almost still.

## What

Fix SAS attitude braking so pitch/yaw from W/A/S/D is as reliable as roll from Q/E. SAS must continue counter-commanding while meaningful angular velocity remains and must not drop torque prematurely because of dead zones, axis mapping, or nozzle-selection thresholds.

## Out of Scope

- No autopilot or target-hold system
- No reaction wheels
- No new ship editor
- No large input rewrite
- No non-physical damping when SAS is off
- No final RCS optimization solver
- No change to main throttle, gun, or camera controls

## Success Criteria

- With SAS off, the ship keeps rotating after W/A/S/D or Q/E input stops.
- With SAS on, releasing W/S pitch input counteracts residual pitch until angular velocity is near zero.
- With SAS on, releasing A/D yaw input counteracts residual yaw until angular velocity is near zero.
- With SAS on, releasing Q/E roll input still counteracts residual roll until angular velocity is near zero.
- SAS does not stop while the overlay still shows meaningful angular velocity on pitch/yaw/roll.
- The overlay exposes enough RCS/SAS torque information to diagnose whether nozzles are actively braking.
- Unity scripts compile without script errors.

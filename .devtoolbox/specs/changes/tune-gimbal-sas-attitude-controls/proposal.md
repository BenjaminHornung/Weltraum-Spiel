# tune-gimbal-sas-attitude-controls

## Why

The current physical thruster prototype proves transform-driven RCS and main gimbal steering, but the visible/physical nozzle gimbal feels too aggressive during normal flight. SAS also needs to stabilize rotation created by keyboard attitude input, especially W/S/A/D pitch and yaw, not only the narrower cases already covered by the previous probe.

## What

Tune the prototype control response so main thruster gimbal steering is softer and easier to control while preserving the 20 degree hard limit for future hardware capability. Ensure SAS actively counters angular velocity after W/S/A/D/Q/E attitude commands are released, using the existing RCS/nozzle-based counter-command model where practical.

## Out of Scope

- No new flight computer UI
- No autopilot modes
- No PID tuning UI
- No ship editor
- No new weapon behavior
- No multiplayer or orbital map work
- No final flight architecture

## Success Criteria

- Main-thruster gimbal remains capped at 20 degrees but normal keyboard steering uses a softer effective command.
- W/S/A/D/Q/E attitude input can rotate the ship without passive drag.
- With SAS enabled, angular velocity from W/S/A/D/Q/E input decreases after the keys are released.
- With SAS disabled, angular velocity persists in vacuum after the keys are released.
- Straight throttle-only thrust still produces no uncommanded torque.
- Existing RCS translation, gun/projectile, camera, fuel, and debug overlay behavior remain functional.

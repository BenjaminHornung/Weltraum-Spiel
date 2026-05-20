# Design: Tune Gimbal and SAS Attitude Controls

## Context

This change builds on `thruster-rcs-flight-controls`. The existing prototype uses COM-safe main thrust, transform-driven RCS nozzles, and SAS as a counter-command. The new work is a tuning and correctness slice, not a new movement architecture.

## Gimbal Tuning

Keep the configured `gimbalRangeDegrees` as a hard physical limit, currently 20 degrees. Add or tune a separate response scalar so keyboard attitude input does not immediately command the full gimbal cone during normal play. The effective gimbal command should remain inspector-adjustable and clamped to the configured range.

The gimbal visual and physics direction must continue to use the same effective command. Diagonal input must still remain inside the 20 degree cone.

## SAS for Keyboard Attitude

W/S/A/D/Q/E are attitude controls. They create angular velocity through the existing RCS/nozzle and optional main-gimbal steering model. SAS must react after those inputs are released by commanding counter torque against current angular velocity when SAS is effectively enabled.

SAS must not introduce passive vacuum damping when disabled. Releasing attitude input with SAS disabled should leave the ship rotating.

## Debugging

The debug overlay should expose enough state to diagnose this tuning: effective gimbal command/angle, attitude input, SAS effective state, angular velocity, and active RCS nozzle count or IDs.

## Risks

- Over-softening gimbal can make main-engine steering feel unresponsive.
- SAS counter torque may be limited by available RCS nozzle geometry.
- Automated Unity input simulation may need direct component probes instead of real keyboard events.

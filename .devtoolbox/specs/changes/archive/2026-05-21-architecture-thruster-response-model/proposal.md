# architecture-thruster-response-model

## Why

Thrusters currently respond almost instantly. That is good for an early prototype, but long-term ship feel should depend on engine size, damage, quality, and control hardware. Main engines, gimbals, and RCS need configurable response behavior.

## What

Define response models for:

- main throttle spool-up/spool-down,
- gimbal slew rate and angle limits,
- RCS nozzle response time,
- optional minimum throttle and ignition delay later.

## Out of Scope

- No heat or power system.
- No engine damage behavior.
- No new input layout.
- No final module variant economy.

## Success Criteria

- Target commands and actual actuator output are tracked separately.
- Main throttle can ramp instead of snapping.
- Gimbal yaw/pitch can slew toward target at a configurable rate.
- RCS nozzles can optionally ramp for debug/feel testing.
- Debug overlay shows target vs actual actuator output.

# Capability: manual-input-priority

## Requirement
Manual flight input SHALL take priority over stale external flight-assist requests and SHALL not be persistently overridden by autopilot, momentum assist, docking assist, debug assist, or weapon stabilization.

## Scenarios
- When `LastManualFlightInput` is true or a manual command is present, stale external assist requests are cleared or ignored before RCS application.
- Waypoint autopilot, momentum assist, docking assist, and debug assist sources are logged with source, force, and torque when present.
- Weapon stabilization is active only for a bounded recoil-response lifetime and is idle after reset or when no pending recoil exists.
- Manual translation still produces desired and actual force even if a stale external request was set before the input frame.

## Constraints
- Autopilot and momentum assist may still intentionally take control when engaged and no manual override is present.
- Weapon stabilization may combine with manual input only as a short-lived recoil counter-torque, not as a stale persistent request.

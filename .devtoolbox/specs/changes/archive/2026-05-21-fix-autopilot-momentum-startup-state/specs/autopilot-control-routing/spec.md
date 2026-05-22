# Capability: Autopilot Control Routing

## Requirements

- Waypoint autopilot must be able to engage from Precision and Translation modes.
- Successful autopilot engagement must:
  - switch control mode to Normal / Cruise
  - enable SAS
  - enable RCS
  - abort or clear active Momentum Assist
  - clear stale manual-input abort windows for a short grace period
- After engagement, autopilot must be able to request main throttle while Normal mode is active.
- Autopilot should use a clean external-control or flight-assist request path as its primary actuator route.
- Debug pulse methods may remain as compatibility helpers, but they must not be the primary autopilot control path.
- If autopilot cannot engage, the HUD/debug console must expose an explicit status or reason.

## Constraints

- Do not bypass the normal `PlayerShipController` throttle and mode rules with hidden direct force calls.
- Do not add a final autopilot architecture; keep this as a bounded prototype stabilization.
- Autopilot must not secretly reset velocity or angular velocity.

## Acceptance

- Engaging autopilot from Precision switches to Normal and allows a nonzero main-throttle request when the target requires it.
- Engaging autopilot from Translation switches to Normal and allows a nonzero main-throttle request when the target requires it.
- Autopilot does not immediately abort because of stale `LastManualFlightInput` from the previous frame.
- Several fixed steps toward a valid target create nonzero actuator requests or an explicit unavailable status.
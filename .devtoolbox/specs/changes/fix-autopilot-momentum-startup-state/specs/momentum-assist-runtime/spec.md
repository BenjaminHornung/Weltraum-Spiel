# Capability: Momentum Assist Runtime

## Requirements

- The HUD Kill Momentum command must visibly change `PrototypeMomentumAssist` state when clicked.
- A UI activation path such as `ActivateFromUi()` must avoid immediate abort from stale manual input by granting a short grace period.
- If the ship is already stable, the assist must report a stable/complete reason instead of appearing broken.
- If no actuator can help, the assist must report `NoAuthority`.
- If fuel prevents required thrust, the assist must report `FuelInsufficient`.
- Momentum assist diagnostics must expose:
  - active/inactive
  - state
  - status/reason
  - speed
  - angular speed
  - brake direction
  - last requested force
  - last requested torque
  - main throttle request
- In Normal mode, Momentum Assist may use main braking plus RCS attitude damping.
- In Precision and Translation modes, Momentum Assist must use RCS-only damping because main thruster and gimbal are disabled.

## Physical Rule

Momentum Assist must not call `ResetVelocity`, `ResetAngularVelocity`, assign `Rigidbody.linearVelocity = Vector3.zero`, or assign `Rigidbody.angularVelocity = Vector3.zero` during runtime assist behavior. It must use existing physical actuator request paths.

## Acceptance

- Toggling Kill Momentum from UI activates or aborts the assist state.
- With nonzero velocity, the assist produces force/torque request diagnostics or reports `NoAuthority`/`FuelInsufficient`.
- With the generated baseline ship and RCS available, speed decreases after several physics steps.
- Static tests continue to forbid direct velocity zeroing in `PrototypeMomentumAssist`.
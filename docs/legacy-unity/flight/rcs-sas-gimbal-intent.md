# RCS, SAS and Gimbal Intent

## Purpose

This document preserves behavior intent from the Unity prototype for a future
browser-native flight-control slice. It does not prescribe MonoBehaviour,
Rigidbody or scene-component architecture.

## Behavior to preserve

- Treat pilot input, autopilot, docking and momentum assist as explicit command
  sources that request force, torque and throttle through one authority layer.
- Keep RCS translation and attitude authority distinct. Missing or disabled RCS
  must produce an explicit no-authority result rather than hidden fallback.
- SAS modes need explicit state, at minimum off, rotation damping and attitude
  hold. Mode changes and their target attitude must be observable telemetry.
- Rotation damping opposes measured angular velocity within bounded torque. It
  must converge physically; it must never set angular velocity to zero.
- Linear momentum assist opposes measured velocity with mass-aware, bounded
  force. At higher speeds it may request a main-engine braking attitude and
  throttle only after alignment and authority/fuel checks.
- Gimbal is bounded steering authority with response/slew limits. Telemetry
  distinguishes target and actual throttle, target and actual gimbal command,
  applied force, application point and estimated torque.
- Main-engine braking, RCS damping and SAS torque remain separate actuator
  contributions so fuel, power, thermal and authority failures stay visible.

## State and diagnostics

Suggested browser-native state vocabulary:

```text
Idle
AlignForBrake
MainBrake
RcsDamp
Stabilizing
Complete
Aborted
NoAuthority
FuelInsufficient
```

Snapshots should expose active command source, available translation/attitude/
main-engine authority, requested versus applied actuator values, linear and
angular speed, alignment error and the reason for refusal or degradation.

## Failure cases

- Missing flight state, actuator description or mass data fails closed.
- RCS disabled or absent cannot silently use main thrust for fine control.
- Missing fuel cannot report braking readiness for fuel-consuming actuators.
- Gimbal saturation and slew lag must remain visible; they cannot be treated as
  instantaneous steering.
- Conflicting command owners require deterministic priority and diagnostics.
- Cancel, idle and completion must not snap velocity, angular velocity,
  position or orientation.

## Acceptance ideas

- Fixed-step replay with identical commands yields identical state and
  actuator snapshots.
- Kill-rotation reduces angular speed monotonically within configured authority
  without assigning zero velocity.
- Attitude hold converges inside tolerance and reports saturation when it
  cannot.
- Translation commands do not introduce unintended attitude commands; roll
  remains independently controllable.
- Momentum assist selects RCS damping below the main-brake threshold, aligns
  before main burn and refuses correctly for fuel/authority failures.
- Gimbal command, actual gimbal, thrust direction and resulting torque agree in
  telemetry and tests.

## Legacy evidence sources

- `Assets/Scripts/Prototype/RcsThrusterController.cs`
- `Assets/Scripts/Prototype/RcsThrusterBlock.cs`
- `Assets/Scripts/Prototype/PlayerShipController.cs`
- `Assets/Scripts/Prototype/MainThrusterBank.cs`
- `Assets/Scripts/Prototype/PrototypeMomentumAssist.cs`
- `Assets/Scripts/Prototype/FlightAssistRequest.cs`

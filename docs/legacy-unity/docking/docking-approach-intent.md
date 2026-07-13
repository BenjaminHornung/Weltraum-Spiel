# Docking Approach Intent

## Purpose

This document preserves docking behavior intent for a future browser-native
target and flight-assist contract. Docking is not a transform-parenting or
scene-joint feature by definition.

## Behavior to preserve

- A docking command names an explicit source port and target port. It never
  falls back to a scene-wide first match in product behavior.
- Each port has a stable ID and local frame: position, forward axis and
  connector compatibility metadata.
- Relative state includes source/target pose, offset in the source port frame,
  distance, angular error, relative velocity, closing speed and relative
  angular velocity.
- Eligibility evaluates state validity, capture radius, hard-lock radius,
  alignment limits, relative-speed limits, compatibility and enabled capture
  modes independently.
- Approach guidance produces an explicit flight-assist request. The flight
  authority layer decides what can be applied and reports degradation.
- Soft capture is a bounded force/torque phase that reduces lateral offset,
  closing speed and angular error. It is not teleportation or a position snap.
- Hard lock is a separate transition after tighter distance, angle and velocity
  gates. Its structural representation is an adapter decision; the domain
  transition and ownership rules are authoritative.
- Player UI renders docking snapshots and refusal reasons; it does not
  recompute capture eligibility.

## Suggested states

```text
Unconfigured
NoTarget
Approach
Aligning
SoftCaptureReady
SoftCapturing
HardLockReady
Locked
Aborted
InvalidState
NoAuthority
Incompatible
```

The snapshot should include port IDs, distance, lateral offset, angle error,
relative/closing speed, eligibility booleans, active assist request, lock state
and a stable refusal reason.

## Failure cases

- Missing source or target port fails closed.
- Self-targeting and ports on the same assembly are rejected unless a future
  construction contract explicitly permits them.
- Non-finite relative state, incompatible connectors, excessive approach
  speed, excessive angle or disabled capture modes prevent capture.
- Loss of target, authority or compatibility clears only the docking-owned
  assist request and cannot cancel unrelated control ownership.
- No soft-capture or hard-lock transition may snap pose or zero velocity.
- Repeated fixed steps cannot create duplicate locks.

## Acceptance ideas

- Relative-state calculations are correct in rotated port frames.
- Boundary tests cover every radius, angle and velocity threshold.
- Soft capture converges physically from lateral and angular error without a
  pose assignment.
- Target loss and pilot abort leave observable relative motion intact.
- Hard lock occurs once only after all strict gates pass.
- Replay from the same snapshots and commands yields the same docking states.

## Legacy evidence sources

- `Assets/Scripts/Prototype/DockingPort.cs`
- `Assets/Scripts/Prototype/PrototypeDockingApproachAssist.cs`
- `Assets/Scripts/Prototype/FlightAssistRequest.cs`

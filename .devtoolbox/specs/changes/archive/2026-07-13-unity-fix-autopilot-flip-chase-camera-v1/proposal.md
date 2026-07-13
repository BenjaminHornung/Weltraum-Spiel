# Proposal: Fix Autopilot Flip Chase Camera

## Problem

In `ChaseLocked` mode the prototype follow camera smooths position, rotation, and focus so normal ship translation stays stable and does not jitter. That smoothing is useful when the desired chase anchor moves gradually with ship motion or physics interpolation.

During fast autopilot flips, especially `PrototypeWaypointAutopilotState.FlipForBrake`, the ship rotates quickly while the chase anchor is still tied to the target orientation. The desired camera position can sweep around the ship faster than the smoothed camera can follow. The result is not translation jitter; it is rotational chase lag: the ship can drift toward the viewport edge or out of view during the flip, then only re-center after the flip ends.

## Outcome

The ChaseLocked camera must keep the ship or camera anchor visible and near the safe viewport center during autopilot flip/brake maneuvers without removing the smoothing that fixed normal translation jitter.

## Scope

- Add flip-aware camera assist to `SimpleFollowCamera`.
- Detect autopilot flip conditions from the target autopilot state and/or target angular velocity.
- Use stronger smoothing or snapping only while the flip assist is active.
- Use a more stable flip chase reference than blind `ship.forward` when braking velocity is available.
- Add diagnostics and PlayMode regression coverage for viewport stability.
- Store verification evidence under this change's `tests` folder.

## Non-Goals

- Do not globally remove ChaseLocked smoothing.
- Do not redesign the autopilot state machine.
- Do not change normal player camera modes except where diagnostics are read-only.
- Do not replace existing jitter tests; keep them passing as regression protection.

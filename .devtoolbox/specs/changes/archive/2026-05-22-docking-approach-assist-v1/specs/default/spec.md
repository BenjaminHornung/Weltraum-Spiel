# Spec: Docking Approach Assist v1

## Capability: Docking Target Selection And Guidance

### Requirements

- The prototype shall expose at least one selectable docking approach target backed by a `DockingPort`.
- A player-facing docking status shall identify the target and show relative distance, closing speed, lateral offset, angle/alignment error, and readiness or refusal reason.
- Guidance shall use existing `DockingPort.TryCalculateRelativeState` and `EvaluateEligibility` data rather than independent duplicated math.
- Missing source or target ports shall fail safely with a clear inactive or unavailable status.

### Expected Behavior

- When a target is selected, the HUD/director shows approach guidance based on actual source/target port transforms.
- When no target is available, the UI does not claim docking readiness.
- Selection and binding shall not depend on a hardcoded demo ship hierarchy path.

## Capability: Bounded Physical Soft-Capture Assist

### Requirements

- When the source/target docking ports are eligible for soft capture and assist is enabled, the prototype shall route the existing `DockingSoftCaptureRequest.assistRequest` into the ship's `PlayerShipController.SetExternalFlightAssistRequest` path.
- The assist request shall remain physical, bounded, and sourced as `FlightAssistRequestSource.Docking`.
- Docking assist shall not request main-throttle acceleration, teleport the ship, set Rigidbody position, or directly set Rigidbody velocity.
- Manual override or ineligible docking state shall clear or avoid applying docking assist.

### Expected Behavior

- In eligible final approach conditions, the ship receives bounded RCS force/torque through the existing allocator path.
- Outside eligibility limits, the assist remains inactive and reports why.
- Hard lock remains a placeholder unless a stable physical constraint is implemented and covered by tests.

## Capability: Validation And Documentation

### Requirements

- Tests shall cover guidance values, target selection/binding, assist request activation, bounded physical request values, ineligible/refusal state, and no fake hard-lock completion.
- Documentation shall state the v1 scope, controls/status, soft-capture constraints, and hard-lock non-goal.
- DevToolbox evidence shall be stored under `.devtoolbox/specs/changes/docking-approach-assist-v1/tests/`.

### Constraints

- Reuse `DockingPort`, `FlightAssistRequest`, `PlayerShipController`, `RcsThrusterController`, and `PrototypePlayerHud` docking paths where possible.
- Do not implement full docking clamp, station services, collision-safe path planning, economy, or advanced station gameplay.
- Do not represent placeholder hard lock as completed docking.

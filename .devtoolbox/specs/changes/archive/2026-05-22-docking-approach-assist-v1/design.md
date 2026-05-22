# Design: Docking Approach Assist v1

## Reuse Strategy

The existing docking implementation already contains the important safety primitives: relative-state calculation, eligibility gates, bounded soft-capture request construction, and hard-lock placeholder diagnostics. This change should connect those pieces into the playable prototype instead of inventing a new docking solver.

Reuse these paths:

- `DockingPort.TryCalculateRelativeState`, `EvaluateEligibility`, and `BuildSoftCaptureRequest` for diagnostics and assist vectors.
- `FlightAssistRequestSource.Docking` and `PlayerShipController.SetExternalFlightAssistRequest` for physical assist routing.
- `RcsThrusterController` allocator behavior for physical force/torque application.
- `PrototypePlayerHud` docking snapshot/director for player-facing guidance.
- Existing docking tests and HUD tests as the regression base.

## Runtime Shape

Add the smallest missing bridge that owns docking approach assist state: target selection/binding, assist enabled/disabled state, latest guidance snapshot, and optional routing of the current soft-capture request into the ship controller. The bridge can be a small component adjacent to the docking or prototype bootstrap systems.

The component should:

- discover or receive a source port and target port without relying on demo hierarchy paths;
- expose clear selected-target and guidance status;
- apply an external assist request only when eligibility and soft-capture request are valid;
- clear or skip the request when ineligible, disabled, or manually overridden by existing controller behavior;
- preserve hard-lock placeholder diagnostics without claiming a docked state.

## Hard-Lock Decision

Do not implement hard lock in this checkpoint unless constraints and tests prove stable. The safer v1 behavior is explicit: soft-capture approach assist is physical and bounded; hard lock is still diagnostic/placeholder and must not show as completed docking.

## Validation Plan

- EditMode tests for relative guidance and target binding.
- EditMode tests that soft-capture assist request is physical, bounded, docking-sourced, and passed to the controller only when eligible.
- Regression tests that hard lock remains non-docked placeholder.
- HUD snapshot tests for player-facing docking guidance/refusal labels.
- Script validation, focused Unity tests where available, `dotnet build`, filtered `dotnet test`, DevToolbox validation, task preflights, and archive.

# Design: Trajectory Preview Nav Map v1

## Reuse Strategy

This change should be a UI/status layer over existing trajectory infrastructure, not a new physics or orbital-planning project. The codebase already has the key pieces:

- `TrajectoryPredictor` with finite guards, fixed-step bounds, and optional central gravity.
- `TrajectoryBurnPlan` and `PrototypeTrajectoryPlanner` for local burn/route estimates.
- `PrototypeWaypointAutopilot.PredictedRoute` and `LastTrajectoryPlan` as current route sources.
- `PrototypeMinimapOverlay` and `PrototypePlayerHud` radar route rendering.
- Existing trajectory prediction and HUD navigation tests.

## Runtime Shape

Add a small preview status/source that samples existing route or predictor output, clamps it to a small point count, tracks enabled/disabled/unavailable/truncated state, and exposes finite-only points for UI rendering. Prefer adding this as a small adjacent component or helper instead of expanding the predictor into a UI object.

For rendering, prefer the existing minimap/player HUD radar surfaces. If both are cheap, the same finite preview point set can feed both; otherwise the player-facing HUD radar is the higher-value v1 target, with minimap integration kept compatible.

## Toggle Decision

The toggle can live in an existing prototype UI/control surface as long as tests can set it directly. It should not require manual GUI clicking for validation. The disabled state should be explicit so non-rendering is distinguishable from missing data.

## Safety Boundaries

- Use existing finite guards and add UI-side finite filtering before drawing.
- Keep point count/horizon bounded.
- Do not introduce N-body force integration, patched conics, SOI transitions, or maneuver-node editing.
- Preserve existing autopilot route behavior when preview is disabled or unavailable.

## Validation Plan

- Extend trajectory prediction tests for preview source toggle/finite behavior.
- Add HUD/minimap snapshot or source tests for route exposure and disabled state.
- Validate new/changed scripts with Unity MCP where available.
- Run focused `dotnet build`, filtered `dotnet test`, DevToolbox validation, task preflights, and archive.

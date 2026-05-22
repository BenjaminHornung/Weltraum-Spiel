# Spec: Trajectory Preview Nav Map v1

## Capability: Bounded Trajectory Preview Source

### Requirements

- The prototype shall expose a bounded trajectory preview source using existing `TrajectoryPredictor`, central gravity, burn-plan/autopilot prediction, or their existing route outputs.
- Prediction shall be capped by explicit step count, horizon, and/or point limits.
- Non-finite initial state or predicted states shall produce an empty or truncated preview instead of invalid map points.
- Preview output shall include enough status for UI/tests to know whether it is enabled, unavailable, empty, truncated, or valid.

### Expected Behavior

- With finite ship state and preview enabled, the layer exposes a small route/trajectory point set.
- With non-finite state, missing dependencies, or disabled preview, the layer fails safely and does not draw invalid geometry.
- The preview remains local-prototype guidance, not an orbital solver.

## Capability: Toggleable Nav Map / HUD Layer

### Requirements

- The preview shall be toggleable through an existing prototype UI/control surface or a small adjacent control.
- When enabled, preview points shall render through existing minimap or player HUD radar route surfaces.
- When disabled, the nav map shall not render preview points and shall report the disabled state.
- Existing route, autopilot, flight, combat, fuel, docking, and camera UI shall remain usable.

### Expected Behavior

- The player can tell whether trajectory preview is on or off.
- The preview line/points are visually distinct enough from static target markers or route points for validation.
- Toggle behavior is deterministic and testable without relying on manual GUI interaction.

## Capability: Validation And Documentation

### Requirements

- Tests shall cover bounded prediction, finite guards, toggle state, map/HUD route exposure, and reuse of existing predictor/gravity/burn-plan infrastructure.
- Documentation shall explain v1 scope and explicitly exclude full N-body, full maneuver nodes, patched conics, SOI transitions, and unbounded prediction.
- DevToolbox evidence shall be stored under `.devtoolbox/specs/changes/trajectory-preview-nav-map-v1/tests/`.

### Constraints

- Reuse existing predictor, gravity, burn-plan, autopilot route, minimap, and player HUD radar infrastructure where possible.
- Do not implement full N-body, full maneuver nodes, orbital map gameplay, or unbounded prediction.
- Preserve fail-safe behavior for non-finite states.

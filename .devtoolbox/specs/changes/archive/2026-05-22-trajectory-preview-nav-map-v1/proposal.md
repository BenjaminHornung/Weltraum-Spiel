# Proposal: Trajectory Preview Nav Map v1

## Motivation

The prototype already has a bounded trajectory predictor, central gravity hook, burn-plan estimates, autopilot predicted routes, minimap route drawing, and player HUD radar route rendering. Those pieces are still mostly debug/planner surfaces. Players need a small toggleable nav-map preview layer that visualizes bounded predicted trajectory data without becoming a full orbital map or maneuver-node system.

## Outcome

Add a bounded, toggleable trajectory preview/nav-map layer that reuses existing predictor, gravity, burn-plan, autopilot, minimap, and HUD route infrastructure. It shall fail safely on non-finite states, remain capped in horizon/step count, and make the preview visible enough for validation while explicitly avoiding full N-body, patched conics, full maneuver nodes, or unbounded prediction.

## Scope

- A small trajectory preview status/source suitable for nav map/HUD consumption.
- Toggle support for enabling/disabling preview rendering.
- Rendering through existing minimap or player HUD radar route surfaces.
- Deterministic tests for bounded prediction, toggle behavior, non-finite fail-safe, and UI route exposure.
- Documentation and DevToolbox test evidence.

## Non-Goals

- No full N-body simulation.
- No full orbital map, patched conics, sphere-of-influence transitions, or maneuver-node editor.
- No persistent route planner or mission navigation system.
- No unbounded predictions or frame-expensive map rendering.

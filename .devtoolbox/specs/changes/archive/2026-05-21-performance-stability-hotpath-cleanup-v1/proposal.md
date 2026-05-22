# Proposal: Performance Stability Hotpath Cleanup v1

## Motivation

The previous performance passes fixed the biggest camera/F6/RCS hierarchy scans and introduced data-kernel jobs. A follow-up review identified remaining hotpath risks:

- Autopilot obstacle planning can run in `FixedUpdate` even when the autopilot is not engaged.
- Colliderless obstacle fallback uses scene-wide `FindObjectsByType` in the detector.
- RCS allocation still allocates scratch arrays/objects in `FixedUpdate`.
- `PrototypeShipVisualSwitcher` can strip components from the wrong host object.
- Obstacle avoidance is reported as generic acceleration instead of a dedicated state.

## Scope

Implement a focused stabilization patch that removes those risks without changing the core flight model:

- Gate and throttle autopilot navigation planning.
- Replace detector fallback discovery with an obstacle registry.
- Make RCS allocator scratch data persistent and allocation-free in steady state.
- Restrict VisualSwitcher manager cleanup to the dedicated manager object.
- Add `ObstacleAvoidance` state and diagnostics/tests.
- Capture Unity MCP, EditMode, PlayMode/profiler, CLI, screenshot, and artifact evidence.

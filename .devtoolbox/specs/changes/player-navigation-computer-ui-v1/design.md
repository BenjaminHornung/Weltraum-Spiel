# Design - player-navigation-computer-ui-v1

## Decision

Add the first Navigation Computer controls to `PrototypePlayerHudRenderer` instead of building a separate full-screen map. The existing context panel already owns active combat/docking/navigation detail, so a compact navigation control row there gives the player direct actions without adding another always-visible window.

## Reuse

- Target cycling calls `PrototypeWaypointAutopilot.SelectPreviousTarget()` and `SelectNextTarget()`.
- Engage/abort calls `PrototypeWaypointAutopilot.ToggleAutopilot()`.
- Replan calls `PrototypeWaypointAutopilot.ReplanNow()`.
- Preview calls `PrototypeTrajectoryPreviewNavMap.TogglePreview()`.
- The existing snapshot text, radar route, trajectory preview, and responsive panel tests remain the rendering foundation.

## Layout

The control row lives inside `ContextPanel`, below the context body and above the existing context gauges. It is hidden outside Navigation context. Buttons use short action labels and fixed dimensions so they do not resize the panel or overlap the radar/bottom bar.

## Tradeoffs

This is not the final large Nav Map overlay. It is a v1 gameplay-control pass that makes current autopilot features player-operable now while leaving a later map/list overlay for richer target selection.

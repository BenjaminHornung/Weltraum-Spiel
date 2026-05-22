# Proposal - player-navigation-computer-ui-v1

## Problem

The project already has real waypoint and autopilot gameplay functions, but the Basic Player HUD mostly presents navigation as status text. The player can use keyboard shortcuts, yet the UI does not look like a usable Navigation Computer with visible target cycling, autopilot engagement, replan, and trajectory-preview controls.

## User Outcome

Basic Player HUD gains a compact Navigation Computer control strip when navigation is the active context. The player can see the selected target, switch targets, engage or abort autopilot, replan the route, and toggle trajectory preview without opening a legacy IMGUI debug window.

## Scope

- Reuse `PrototypeWaypointAutopilot`, `PrototypeWaypointManager`, and `PrototypeTrajectoryPreviewNavMap` APIs.
- Add player-facing Navigation Computer controls inside the existing uGUI Player HUD context panel.
- Keep old IMGUI flight/debug windows unchanged and diagnostic-only.
- Preserve responsive layout: controls must not overlap context text, gauges, radar, bottom bar, or side panels.
- Add focused EditMode tests for button visibility, labels, and click behavior.

## Non-Goals

- No new autopilot physics.
- No full-screen strategic map.
- No candidate-score/debug planning UI.
- No input rebinding or final controller navigation.

# player-autopilot-planner-followup-v1

## Why

The player HUD minimap range controls are now usable, but live feedback still shows two player-facing gaps: the Autopilot Navigation Planner popup remains too dense and the route/deceleration path is not visually dominant enough, and the waypoint autopilot still needs stronger live-style proof that it rotates to retrograde and brakes with the main thruster without a harness manually aligning the ship.

## What

- Make the Navigation Planner popup more route-first by reducing generic planner contacts, strengthening route/preview strokes, and simplifying body text.
- Keep planner zoom/range controls shared with the compact minimap.
- Ensure waypoint autopilot reasserts RCS/SAS authority while it owns attitude alignment.
- Add focused closed-loop PlayMode coverage for retrograde rotation and main-thruster deceleration without manual transform alignment.
- Refresh DevToolbox test evidence and Unity MCP screenshots for the planner popup.

## Out Of Scope

- Full multi-leg route editing.
- Replacing the compact minimap.
- Redesigning the whole flight model or final control-remapping UI.

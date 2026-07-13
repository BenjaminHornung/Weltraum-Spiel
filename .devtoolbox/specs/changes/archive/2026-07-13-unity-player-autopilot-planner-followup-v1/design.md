# Design

## Planner Popup

The existing `PrototypePlayerHudRenderer` already has a dedicated Navigation Planner panel, a separate map layer, planner range buttons, and planner-specific blip filtering. The follow-up should reuse those surfaces instead of creating another map renderer.

Changes:

- Keep the shared minimap range state.
- Reduce planner blip cap so generic contacts no longer compete with the selected route.
- Draw route and preview with stronger planner-only thickness.
- Fade/scale lower-priority planner contacts while keeping selected navigation, selected combat, and objective markers prominent.
- Collapse body text into a small route-first summary.

## Autopilot

The waypoint autopilot already writes a `FlightAssistRequest` before `PlayerShipController.FixedUpdate`, sets a SAS target toward the burn/brake vector, and gates main throttle until alignment. The robustness gap is that RCS/SAS can be disabled after engagement without being treated as manual flight input. While the autopilot owns the alignment request, it should reassert the actuators it requires.

Changes:

- `ApplyAutopilotAttitudeTarget` re-enables RCS and SAS before setting HoldAttitude.
- A PlayMode closed-loop brake test steps autopilot, controller, and physics without applying harness rotation.

## Verification

- EditMode HUD planner tests cover range sharing, blip filtering, popup controls, and responsive layout.
- PlayMode autopilot test proves closed-loop retrograde rotation, actual RCS torque, main-throttle application after alignment, and main force opposing velocity.
- Unity MCP screenshots prove the real planner popup is visible, scaled, and non-overlapping.

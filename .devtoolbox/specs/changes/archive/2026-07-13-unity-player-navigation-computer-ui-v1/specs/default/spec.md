# Spec - Player Navigation Computer UI

## Requirements

- The Basic Player HUD MUST expose navigation controls in the player-facing uGUI layer when navigation is the active context.
- The controls MUST reuse the existing `PrototypeWaypointAutopilot` methods for previous/next target, engage/abort autopilot, and replan.
- The preview control MUST reuse `PrototypeTrajectoryPreviewNavMap.TogglePreview()` when the preview component exists.
- Controls MUST be disabled or hidden safely when the required runtime component is missing.
- The Navigation Computer MUST NOT show candidate scores, raw planner vectors, debug-only route internals, or legacy IMGUI window chrome.
- The responsive HUD layout MUST keep navigation controls separate from text, gauges, radar, side panels, and bottom flight controls across tested aspect ratios.

## Expected Behavior

When the Navigation context is active, the context panel shows a compact control row:

- Previous target.
- Next target.
- Engage Autopilot or Abort Autopilot depending on current autopilot state.
- Replan.
- Preview On/Off.

Clicking the controls calls the existing runtime APIs and refreshes the HUD snapshot. If there is no target or no autopilot component, controls that cannot act are disabled. Non-navigation contexts do not show the Navigation Computer controls.

## Verification

- EditMode tests cover control labels, visibility, enabled/disabled state, and click behavior.
- Existing responsive layout tests include the new controls.
- Unity MCP validates the changed scripts and runs focused HUD tests.
- Game View evidence confirms controls render in Basic without overlapping other panels.

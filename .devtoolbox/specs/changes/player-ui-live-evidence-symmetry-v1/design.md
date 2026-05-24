# Design - player-ui-live-evidence-symmetry-v1

## Decision

Add a separate PlayMode evidence test rather than expanding gameplay code. The feature surface is already implemented; this slice strengthens proof by capturing two missing live 4:3 states from the real Bootstrap-created runtime.

## Evidence States

- Cruise/objective at 1024x768:
  - Basic Player HUD preset.
  - Arena/objective visible.
  - No selected combat target.
  - Docking not visible.
  - HUD panels separated.
- Navigation/autopilot at 1024x768:
  - Real waypoint target selected through `PrototypeWaypointAutopilot`.
  - Autopilot replanned and engaged.
  - Navigation context visible.
  - Radar blips present.
  - Navigation target indicator present.
  - HUD panels separated.

## Verification

The evidence test writes screenshots under this change folder and asserts the same invariants already used by the live runtime audit. DevToolbox documentation records both Unity evidence and the known generic root verifier limitation if it still appears.

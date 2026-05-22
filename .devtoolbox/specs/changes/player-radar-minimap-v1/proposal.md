# player-radar-minimap-v1

## Problem

The player HUD radar is technically present, but it still behaves like a narrow navigation preview. It draws the ship heading, selected navigation target, route, avoidance cue, and selected combat target, while important play objects remain invisible: arena targets, alternate navigation waypoints, docking targets, environment beacons/gates/stations, and hazards. The fixed `Range 1 km` label also hides whether objects are clipped or scaled.

## Outcome

The radar becomes a compact player minimap that answers three questions during normal play: where are my objectives, where is my selected route, and what hazards or targets are near me. It must reuse the existing Player HUD radar graphic and existing gameplay data sources instead of adding another IMGUI or debug overlay path.

## Scope

- Add a player-facing radar snapshot with range, route/preview paths, avoidance waypoint, and typed blips.
- Populate blips from existing systems: waypoint manager, arena loop, weapon target registry/computer, docking approach/port binding, navigation obstacles, and prototype test environment points.
- Render typed symbols and route/preview/avoidance cues in the existing `PrototypePlayerHudRadarGraphic`.
- Replace the hardcoded range label with snapshot-driven auto-range text.
- Add validation tests and Unity screenshot evidence.

## Non-goals

- No full-screen interactive map yet.
- No target-marker/world-space indicator implementation; that is a separate change.
- No TextMeshPro migration in this change.
- No new debug-only minimap window as the default player path.

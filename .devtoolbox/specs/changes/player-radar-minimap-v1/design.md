# Design

## Reuse strategy

The change extends the existing Player HUD radar path instead of creating a new minimap overlay. The current `PrototypePlayerHudSnapshotBuilder` already centralizes ship, navigation, combat, docking, and arena HUD data, and `PrototypePlayerHudRadarGraphic` already owns UI Toolkit-compatible mesh drawing for the radar panel. Reusing those two points avoids another debug-only IMGUI path and keeps responsive layout behavior in one place.

Existing data sources cover the required minimap objects:

- `PrototypeWaypointManager.NavigationTargets` for all navigation waypoints
- `PrototypeWaypointAutopilot.CurrentTarget`, `PredictedRoute`, `AvoidanceWaypoint`, and trajectory preview snapshot for selected route data
- `PrototypePveArenaLoop.Targets` for mission/objective targets
- `PrototypeWeaponTargetRegistry.CopyRegisteredTargets` and `PrototypeWeaponComputer.ActiveTargetTransform` for combat targets
- `DockingPort` and `PrototypeDockingApproachAssist.TargetDockingPort` for docking
- `PrototypeTestEnvironment.GetPointsSnapshot()` for beacons, gates, station, and authored obstacle points
- `PrototypeNavigationObstacleRegistry.CopyActiveObstacles` for active autopilot hazards

## Data model

Add a small player-facing radar model near the existing HUD snapshots:

- `PrototypePlayerRadarBlipKind`
- `PrototypePlayerRadarBlip`
- `PrototypePlayerRadarSnapshot`

The snapshot carries range, label, ship origin/forward, route points, preview points, avoidance waypoint, and typed blips. The renderer receives one snapshot through the existing `PrototypePlayerHudSnapshot`.

## Range behavior

Radar range uses simple auto bands so the label is stable and readable: 250 m, 1 km, or 5 km. The band is chosen from the farthest relevant blip or path point, with 1 km as the default cruising band. Rendering clamps out-of-range cues to the circular radar edge.

## Render behavior

The existing `MaskableGraphic` continues to draw rings and heading. Typed blips use small shape differences rather than text labels to avoid clutter at HUD scale:

- selected navigation: cyan diamond/cross cue
- navigation: smaller cyan dot
- combat: red/orange bracket/cross cue
- objective/arena: yellow diamond
- docking: blue square/ring cue
- environment beacon/gate/station: muted marker
- hazard/obstacle: orange triangle/cross cue

Trajectory preview stays amber and visually lighter than the active autopilot route.

## Risks

Scene-wide source collection can become expensive if done each frame with broad searches. This change prefers existing registries and component-held lists. The only fallback lookup should be bounded and cached through already-bound systems where possible.

## Verification

Validation covers snapshot contents, range label behavior, no IMGUI radar path, and responsive layout. Runtime verification captures a Game View screenshot from the Unity scene using MCP after compilation/tests are clean.

# Player Radar Minimap

## Requirements

### Requirement: Radar snapshot exposes player-relevant game objects

The Player HUD SHALL build a radar snapshot from existing gameplay systems rather than hardcoded HUD-only positions.

The snapshot SHALL include:

- current range in meters and a display label
- ship world position and forward direction
- selected navigation target when present
- all known navigation targets from `PrototypeWaypointManager`
- active arena objective targets from `PrototypePveArenaLoop`
- registered combat targets from `PrototypeWeaponTargetRegistry`, with the selected combat target identified when present
- docking target when a docking target or routed docking assist exists
- station, gate, beacon, and obstacle points from `PrototypeTestEnvironment`
- active navigation obstacles from `PrototypeNavigationObstacleRegistry`
- autopilot route points, trajectory preview points, and avoidance waypoint when present

#### Scenario: Arena objective active

When the arena loop has active, undestroyed targets, the radar snapshot SHALL contain objective blips for those targets even when no combat target is selected.

#### Scenario: Alternate navigation targets exist

When several navigation targets exist, the radar SHALL contain blips for all active navigation targets and mark the selected/current target separately.

#### Scenario: Hazards exist

When active navigation obstacles or environment obstacle points exist, the radar SHALL contain hazard blips that are visually distinct from navigation and objective blips.

### Requirement: Existing HUD radar renders typed minimap cues

The Player HUD SHALL render radar information through the existing `PrototypePlayerHudRadarGraphic` path.

The render path SHALL show:

- heading cue
- selected navigation target cue
- route polyline
- trajectory preview polyline with a different color/style from the active route
- avoidance waypoint cue
- typed blips for navigation, combat, objective, docking, environment, and hazards
- dynamic range label instead of a fixed `Range 1 km` literal

#### Scenario: Objects are outside radar range

When a blip or route point is outside the current radar range, the renderer SHALL clamp the cue to the radar edge without resizing or overlapping the HUD panel.

### Requirement: Radar remains a player HUD feature, not debug UI

The implementation SHALL NOT reintroduce an IMGUI radar render path or make the debug minimap overlay required for the Basic Player HUD preset.

The radar SHALL keep the existing responsive panel bounds and SHALL NOT overlap the objective/context/bottom HUD panels at tested aspect ratios.

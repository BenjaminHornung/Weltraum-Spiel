# browser-playable-large-proving-ground

## ADDED Requirements

### Requirement: Playable Large Runtime Targets

The normal browser runtime SHALL expose selectable large proving-ground targets at approximately 500m, 1000m, and 2500m.

#### Scenario: Large targets are selectable without TestBridge

- GIVEN the browser app is loaded at `/`
- WHEN the player opens the navigation target selection
- THEN the 500m, 1000m, and 2500m targets are visible and selectable
- AND TestBridge remains unavailable by default

### Requirement: Runtime Obstacle Truth Is Separate From Visual Landmarks

The normal browser runtime SHALL provide obstacle descriptors for large proving-ground route planning, and the renderer SHALL only consume separate render-only landmarks or runtime-truth snapshots for visualization.

#### Scenario: Visual landmarks do not own navigation truth

- GIVEN the proving-ground world has long-range asteroids, gates, or beacons
- WHEN route planning runs
- THEN it uses `browserObstacles`
- AND it does not infer obstacle truth from renderer-only landmark meshes

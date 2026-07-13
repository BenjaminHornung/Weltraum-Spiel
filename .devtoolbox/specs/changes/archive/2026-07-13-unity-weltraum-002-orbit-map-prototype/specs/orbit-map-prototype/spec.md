# Orbit Map Prototype

## Requirements

### Requirement: Analytical orbit data is the primary source for map positions

The prototype orbit map SHALL compute body positions from `OrbitDefinition` inputs and surface them as analytical values for debug and verification.

#### Scenario: OrbitDefinition feeds map body positions

- GIVEN `star.aurelia`, `planet.hestia`, `moon.hestia.luma`, and `asteroid.eber` are loaded from the starter catalog
- WHEN a debug orbit projection is requested
- THEN each body position is derived from its `OrbitDefinition` data and can be queried in real units

#### Scenario: Moon and parent analytics remain stable

- GIVEN `moon.hestia.luma` has `planet.hestia` as parent
- WHEN orbit projection is refreshed
- THEN parent-relative analytic values must remain deterministic and consistent across repeated refresh passes

### Requirement: Real and visual scales are always separated

The map runtime SHALL retain physical orbit and size values in meters and convert to map scale only for rendering.

#### Scenario: Real-meter values are preserved

- GIVEN a star/planet/moon/asteroid body from the catalog
- WHEN a scaled map snapshot is taken
- THEN real radius, position, and gravitational values are unchanged in storage and diagnostics

#### Scenario: Visual scale is not used for physics/readouts

- GIVEN a body has valid `VisualScaleProfile`
- WHEN readout text is produced or validation runs
- THEN `mu` and radius computations use real physical fields, not visual scale values

### Requirement: Scaled orbit and system-map snapshots include all four starter bodies

The prototype SHALL emit snapshots for orbit path and map placement using scaled values, while still linking each sample back to real-meter source values.

#### Scenario: Snapshot includes all four starters

- GIVEN the map snapshot command runs
- WHEN debug samples are collected
- THEN it includes `star.aurelia`, `planet.hestia`, `moon.hestia.luma`, and `asteroid.eber`

#### Scenario: Snapshot output keeps both units

- GIVEN any sample point is generated
- WHEN diagnostics are inspected
- THEN the sample includes both real-meter data and map-scale data in separate fields

### Requirement: Debug orbit lines and readouts are present in prototype viewer

The prototype viewer SHALL show orbit lines and text readouts for all four bodies to support debugging with no final UX integration.

#### Scenario: Orbit lines render from analytical data

- GIVEN orbit line drawing is enabled
- WHEN debug frame updates
- THEN orbit lines for the four bodies are derived from analytical sample points and drawn in map coordinates

#### Scenario: Readouts cover required fields

- GIVEN debug readout panel is opened
- WHEN values are shown
- THEN it contains body ID, body type, real radius, real semi-major axis, `mu`, parent ID, map scale factor, and snapshot count

### Requirement: Prototype-only UI boundaries

The implementation SHALL be a minimal debug/prototype viewer and SHALL NOT be final System Map UX or Player HUD integration.

#### Scenario: No final HUD wiring is introduced

- GIVEN the slice is implemented
- WHEN build or scene checks are run
- THEN no `PrototypePlayerHudRenderer` dependencies are added and no final route controls are exposed

### Requirement: No final-system runtime features in this slice

The map prototype SHALL remain strictly non-actionable for travel, autopilot, timewarp, and drones.

#### Scenario: Autopilot remains disconnected

- GIVEN orbit map prototype is active
- WHEN controls and game loops execute
- THEN it does not trigger route planning, waypoint execution, or autopilot activation

## Constraints
- `weltraum-002` is the immediate slice after weltraum-001; it must reuse weltraum-001 contracts and catalog source.
- Data source remains `Assets/Resources/Prototype/Celestial/AureliaSystemCelestialCatalog.asset`.
- Runtime path remains `Assets/Scripts/Prototype/Celestial/`.
- Test path for new tests remains `Assets/Tests/Editor/`.
- Debug viewer should use a self-contained IMGUI pattern with `PrototypeUiWindowState` and `PrototypeUiLayoutManager` if a visible panel is required.
- No final System Map interaction panel, no route execution, no HUD replacement.

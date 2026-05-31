# Map HUD Navigation Readout

## Requirements

### Requirement: Existing HUD and map surfaces expose catalog-backed celestial context

The prototype SHALL display read-only celestial navigation context in existing HUD/map debug surfaces using data derived from the `weltraum-002` orbit-map/catalog path.

#### Scenario: Catalog target context appears in HUD or map readout

- GIVEN the prototype is running with the Aurelia catalog available
- WHEN the HUD/map readout refreshes
- THEN it shows a pilot-facing target body display name, parent display name, body type, real-meter distance context, and map-scale context without requiring final System Map UX
- AND raw body IDs remain debug-only on debug surfaces and are not shown in pilot-facing context text

### Requirement: Readout data reuses orbit-map contracts

The prototype SHALL reuse the orbit-map snapshot/solver contracts rather than duplicating catalog and orbit projection logic in HUD code.

#### Scenario: Readout values come from orbit-map snapshot data

- GIVEN orbit-map snapshot data is available
- WHEN HUD/map readout text is produced
- THEN real-meter values and map-scale values remain separate and traceable to the snapshot source

### Requirement: The feature remains non-actionable

The readout SHALL NOT trigger or expose route execution, autopilot activation, timewarp, drone behavior, or warp controls.

#### Scenario: Navigation readout is display-only

- GIVEN the readout is visible during PlayMode
- WHEN the player interacts with normal ship controls
- THEN no route plan is executed, no autopilot command is issued, and no travel/timewarp/drone system is activated by the readout

### Requirement: UI readability is reviewed before closeout

The change SHALL run a Z.AI UI review before implementation and again after visible evidence exists.

#### Scenario: UI review gates the implementation

- GIVEN a visible HUD/map readout is planned
- WHEN implementation starts or screenshot evidence is ready
- THEN `zai-ui-glm51` review findings are captured and blocking findings are resolved before task closeout

## Constraints
- `weltraum-004` depends on `weltraum-002` and must reuse the Aurelia catalog/orbit-map data path.
- Candidate reuse surfaces are `PrototypePlayerHud`, `PrototypeMinimapOverlay`, `PrototypeBootstrap`, `PrototypeOrbitMapDebugWindow`, and `CelestialOrbitMapSnapshotBuilder`.
- Do not modify DirectFastTransfer, autopilot, benchmark, timewarp, drone, or final System Map systems for this slice.

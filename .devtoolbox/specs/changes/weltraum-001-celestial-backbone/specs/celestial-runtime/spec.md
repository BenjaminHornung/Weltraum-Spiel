# Celestial Runtime Backbone

## Requirements

### Requirement: Stable body catalog

The celestial runtime SHALL expose a small starter catalog of celestial bodies with stable lowercase ASCII IDs that do not depend on display names.

#### Scenario: Starter bodies are available

- GIVEN the celestial catalog is loaded from `Assets/Resources/Prototype/Celestial/AureliaSystemCelestialCatalog.asset`
- WHEN a caller looks up `star.aurelia`, `planet.hestia`, `moon.hestia.luma`, and `asteroid.eber`
- THEN each lookup succeeds and returns a body definition with a display name, body type, radius, gravity data, and visual scale data

#### Scenario: Duplicate IDs are rejected

- GIVEN two catalog entries use the same stable ID
- WHEN the catalog is validated
- THEN validation reports a duplicate-ID failure and the registry does not silently prefer one entry

#### Scenario: Body type enum can represent planned concept bodies

- GIVEN the celestial body type enum is created
- WHEN it is inspected by tests
- THEN it includes the concept contract body types `Star`, `RockyPlanet`, `SuperEarth`, `GasGiant`, `IceGiant`, `Moon`, `Asteroid`, `Comet`, `Station`, and `ArtificialStructure`

### Requirement: Real physical data remains separate from visual scale

Celestial definitions SHALL store real physical values in meters, kilograms, seconds, and `m^3/s^2`, while visual map/local display scale is stored separately.

#### Scenario: Hestia has real and visual values

- GIVEN `planet.hestia` is loaded
- WHEN runtime code reads its physical radius, mass, `mu`, and visual scale profile
- THEN the physical values match the concept-source magnitude and the visual radius scale is a separate display value

#### Scenario: Visual scale cannot replace physics

- GIVEN a body has a visual scale profile
- WHEN gravity or debug physical output is computed
- THEN the computation uses real radius and `mu`, not map or local visual scale

### Requirement: Parent and orbit relationships are validated

The catalog SHALL validate parent references and minimal orbit plausibility without implementing full orbital propagation in this first slice.

#### Scenario: Moon parent exists

- GIVEN `moon.hestia.luma` declares `planet.hestia` as parent
- WHEN the catalog is validated
- THEN validation succeeds only if `planet.hestia` exists and Luma's orbit has a positive semi-major axis

#### Scenario: Root star has no parent orbit requirement

- GIVEN `star.aurelia` is a root stellar body
- WHEN the catalog is validated
- THEN it may omit a parent and body orbit while still requiring radius, mass or `mu`, gravity data, and visual scale data

### Requirement: Gravity values are validated

The celestial runtime SHALL validate gravity data strongly enough to catch invalid or inconsistent physical definitions before later navigation and warp systems consume them.

#### Scenario: Body has usable gravity source data

- GIVEN a natural body definition is validated
- WHEN it has `radiusMeters > 0` and either `massKg > 0` or `gravitationalParameterMu > 0`
- THEN validation accepts the required base gravity inputs

#### Scenario: Mass and mu disagree

- GIVEN a body declares both mass and `mu`
- WHEN `mu` differs from `G * mass` by more than `1%` relative tolerance using `G = 6.67430e-11 m^3 kg^-1 s^-2`
- THEN validation reports a gravity-consistency failure with the body ID

### Requirement: Absolute state and frame identity are represented in double precision

The first backbone SHALL provide a `[Serializable]` absolute state/reference-frame data shape for later ships, bodies, drones, map projections, and timewarp work, without replacing the existing floating-origin prototype.

#### Scenario: Absolute state stores large coordinates

- GIVEN an absolute state is created for a body or ship
- WHEN it stores position, velocity, epoch, and reference frame/body ID
- THEN position and velocity are represented with `LargeWorldVector3d` and remain separate from Unity `Transform` coordinates

#### Scenario: Vector math support is explicit

- GIVEN `AbsoluteState` uses `LargeWorldVector3d` for position and velocity
- WHEN implementation needs magnitude or scalar operations for validation or simple state math
- THEN it may add small pure math helpers/operators to `LargeWorldVector3d` with tests, without changing `FloatingOriginManager` or `FloatingOriginBody` behavior

### Requirement: Registry exposes deterministic lookup and debug summaries

The runtime registry SHALL provide deterministic ID lookup, validation results, and debug-readable summaries of the loaded catalog.

#### Scenario: Missing ID lookup is explicit

- GIVEN the registry is loaded
- WHEN a caller queries an unknown body ID
- THEN the lookup reports failure without throwing an unrelated exception or returning an arbitrary body

#### Scenario: Debug output includes real values

- GIVEN the registry debug summary is requested
- WHEN starter bodies are loaded
- THEN the summary includes each body ID, display name, type, real radius, `mu`, parent ID, and visual-scale information in deterministic ID order

### Requirement: Existing prototype systems stay isolated

This first celestial slice SHALL not require existing flight, autopilot, HUD, weapon, or trajectory systems to migrate to the new catalog.

#### Scenario: Existing prototype tests still run

- GIVEN the celestial backbone exists in the project
- WHEN existing prototype flight/navigation tests run
- THEN they do not require celestial catalog configuration unless a test explicitly opts into it

## Constraints
- Reuse the existing large-world/floating-origin types where they fit, especially `LargeWorldVector3d`, instead of creating a parallel vector representation for absolute positions.
- Keep the catalog data source singular for this slice; consumers must not duplicate Aurelia/Hestia/Luma/Eber constants in separate systems.
- Keep the implementation editor/test friendly and deterministic.
- Do not add a new assembly definition for this slice unless baseline inspection proves one is already required by local project structure.
- Do not implement autopilot, timewarp, drones, final UI, full system-map interaction, full Kepler propagation, rotation/day-night gameplay, atmosphere gameplay, or orbit-intersection validation as part of this change.

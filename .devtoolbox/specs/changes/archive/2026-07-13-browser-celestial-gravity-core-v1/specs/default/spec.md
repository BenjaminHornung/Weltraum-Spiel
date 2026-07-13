# Browser Celestial Gravity Core v1

## Requirements

### Requirement: Stable versioned celestial definitions

The browser core SHALL accept only explicit schema version 1 celestial definitions with stable lowercase ASCII IDs independent of display names.

#### Scenario: Stable starter identities

- GIVEN the Aurelia starter catalog is created
- WHEN its canonical body list is read
- THEN Aurelia and all seven documented planets have their pinned IDs and display-name changes cannot alter lookup identity

#### Scenario: Future schema fails closed

- GIVEN a catalog or nested definition declares a version greater than 1
- WHEN the catalog is created
- THEN creation throws `UnsupportedSchemaVersion` before the value enters runtime

### Requirement: Canonical immutable catalog and indexes

The core SHALL publish a deeply immutable catalog sorted by body ID with frozen ID, parent/child and body-type indexes, canonical JSON and a stable signature.

#### Scenario: Insertion order is irrelevant

- GIVEN equivalent body definitions in forward and reverse insertion order
- WHEN catalogs are created
- THEN body order, canonical JSON and signature are byte-identical

#### Scenario: Caller mutation cannot change catalog truth

- GIVEN mutable input objects and arrays were passed to the catalog builder
- WHEN the caller mutates those inputs
- THEN catalog definitions, indexes, canonical JSON and signature remain unchanged and frozen

### Requirement: Parent graph validation

The catalog SHALL contain one root star, require every other body's parent and orbit, reject unknown parents, reject duplicate body IDs and reject parent cycles.

#### Scenario: Hestia moon hierarchy

- GIVEN the starter catalog
- WHEN children of `planet.hestia` are queried
- THEN the four documented moon IDs are returned in canonical order

#### Scenario: Unknown parent and cycle fail closed

- GIVEN a body references an unknown parent or a graph closes a parent cycle
- WHEN catalog creation runs
- THEN it throws the stable `UnknownParent` or `ParentCycle` code without publishing a partial catalog

### Requirement: Physical values and visual scale remain separate

The core SHALL store physical radius, mass and `mu` in SI units and SHALL keep visual scaling in a separate render-only profile.

#### Scenario: Mass and mu consistency

- GIVEN both mass and `mu` are present
- WHEN their relative difference from `G * mass` exceeds 1%
- THEN creation throws `InconsistentMassMu`

#### Scenario: Visual scale cannot change gravity

- GIVEN two otherwise identical definitions have different visual scale profiles
- WHEN surface gravity or a point-mass query is calculated
- THEN both physical results are identical

### Requirement: Source-backed Aurelia starter catalog

The executable catalog SHALL contain Aurelia, seven documented planets, four explicitly defined Hestia moons and three sufficiently specified named asteroids, and SHALL omit insufficient station/outer-moon definitions.

#### Scenario: Catalog contents are explicit

- GIVEN the starter catalog is built
- WHEN IDs are listed
- THEN exactly the 15 approved body IDs are present and no station ID is present

#### Scenario: Source limitations are not filled with invented bodies

- GIVEN the concept only generally mentions outer-planet moons and names stations without complete body/orbit values
- WHEN starter data is inspected
- THEN those entries are absent from the executable catalog and documented as deferred

### Requirement: Deterministic analytical Kepler ephemerides

The core SHALL derive bound-elliptic parent-relative position and velocity from orbit, explicit epoch, explicit requested time and parent runtime state without clocks, random values or hidden frame delta.

#### Scenario: Circular period and quarter period

- GIVEN a simple circular orbit fixture
- WHEN state is evaluated at one period and one quarter period
- THEN the full-period state returns within defined tolerance and the quarter-period position matches the analytical fixture

#### Scenario: Parent and child states compose

- GIVEN a planet state around a star and a moon state around that planet
- WHEN the moon state is evaluated
- THEN moon absolute position/velocity equal parent absolute plus parent-relative values in metres and metres per second

#### Scenario: Invalid or non-converging input fails closed

- GIVEN an invalid elliptic element or a solver iteration budget that cannot meet the residual rule
- WHEN propagation is requested
- THEN `InvalidOrbit` or `KeplerConvergenceFailure` is thrown and no NaN/Infinity state is returned

### Requirement: Explicit frame and time semantics

Every runtime state SHALL expose its requested time, physical `mu`, an absolute-system state and, for children, a parent-body-centered relative state.

#### Scenario: Root and child frame identity

- GIVEN catalog ephemerides at a requested time
- WHEN Aurelia and Hestia states are read
- THEN Aurelia is the zero-origin root and Hestia's relative frame explicitly references `star.aurelia`

#### Scenario: Floating-origin projection is non-authoritative

- GIVEN an absolute celestial state and two local projection origins
- WHEN local projections differ
- THEN the original absolute celestial state and its canonical serialization remain unchanged

### Requirement: Pure point-mass gravity core

The core SHALL compute gravity acceleration toward a supplied source from `mu / r^2`, surface gravity and escape velocity using physical values only.

#### Scenario: Inverse square and direction

- GIVEN queries at distances `r` and `2r`
- WHEN point-mass gravity is calculated
- THEN the second magnitude is one quarter of the first and both vectors point toward the source

#### Scenario: Minimum physical radius fails closed

- GIVEN a query lies strictly inside the physical/minimum source radius
- WHEN gravity is calculated
- THEN `InsideMinimumRadius` is thrown instead of dividing by zero, clamping silently or returning a non-finite result

### Requirement: Deterministic dominant gravity source

Dominant-source selection SHALL consider only explicit supplied sources and SHALL resolve exact acceleration ties by ascending body ID.

#### Scenario: Stable tie

- GIVEN equal-strength eligible sources at equal distance in reversed input orders
- WHEN dominance is selected
- THEN both queries select the same lexically first body ID

#### Scenario: No hidden source

- GIVEN no eligible sources
- WHEN dominance is selected
- THEN `NoGravitySource` is thrown and renderer/scene state is never consulted

### Requirement: Real browser import and evidence

The normal Vite route SHALL be able to dynamically import `/src/celestial/index.ts`, build the catalog, evaluate multiple ephemeris times and execute gravity without exposing TestBridge.

#### Scenario: Browser smoke and deterministic evidence

- GIVEN `/` is loaded in Chromium
- WHEN the public module is imported and the scenario is run twice
- THEN TestBridge is absent, canonical results and signatures match, console/network error lists are empty, and task-owned JSON/Markdown evidence is written

## Constraints

- Code changes stay under `apps/weltraum-browser/src/celestial/**` and task-owned test/evidence/docs paths.
- No Unity, renderer, HUD, normal runtime, flight, navigation, test-harness, package or lockfile changes.
- No screenshots are required.

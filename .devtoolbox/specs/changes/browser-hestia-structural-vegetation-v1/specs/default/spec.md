# Capability: Structural Hestia Vegetation V1

## Species authority
### Requirement: exact stable registry
The authority SHALL expose exactly `hestia.umbrella-tree.v1`, `hestia.mist-sprout.v1`, and `hestia.luminous-cap.v1` in stable canonical order and SHALL reject unknown or malformed species IDs.

## Population authority
### Requirement: globally stable candidates
Candidates SHALL use a globally anchored 6 m grid (48 base quanta at 0.125 m), deterministic jitter no greater than ±2 m, ownership from the unjittered anchor, and canonical ordering by global Z, global X, species ID, then candidate hash.

#### Scenario: region subdivision
Generating overlapping or split regions SHALL produce no duplicate owned candidates and the canonical union SHALL equal unsplit generation.

#### Scenario: input ordering
Permuting equivalent input collections SHALL not change population, IDs, ordering, or hashes.

### Requirement: fail-closed placement
A candidate SHALL be accepted only when terrain exists and is finite; slope is inside the species limit; the sample is neither Ocean nor Lake; river/water distance, moisture, material, and biome rules pass; the root cell is not Air; crown spacing passes; and budget remains.

#### Scenario: invalid terrain or budget
Missing/non-finite terrain, Air root, or exhausted budget SHALL reject without a floating or partial instance.

## Umbrella Tree structure
### Requirement: complete deterministic graph
Umbrella Tree SHALL have a root anchor, stable node/segment IDs, separate material roles, a 6–14 m trunk, 0.35–0.80 m base radius, 5–9 primary branches, budget-limited 1–3 secondary branches per primary, and 4–8 flat canopy lobes. Parent/child edges SHALL be acyclic and complete.

### Requirement: structural proxy
The canonical proxy SHALL retain multiple trunk/branch/canopy parts and SHALL NOT be represented by one cone or one sphere.

## Structural compilation
### Requirement: reuse pinned authorities
`compileVegetationStructuralBricks(instance, requestedQuantumBounds, targetLevel)` SHALL accept only Adaptive Level 4, use 0.125 m global quantum coordinates and existing Adaptive brick keys, emit 16×16×16 Structural bricks only where instance geometry intersects requested bounds, and reuse existing Structural material, anchor, connectivity, canonical hash, and persistence contracts. It SHALL NOT introduce another Structural object authority.

#### Scenario: deterministic region split
Equal inputs SHALL produce equal frozen bricks/hashes, and splitting requested bounds SHALL preserve the canonical union without mutating inputs.

### Requirement: root anchors and intact connectivity
Compiled root cells SHALL be anchors. The intact Umbrella Tree SHALL classify as anchored through Structural Core connectivity.

## Destruction preparation
### Requirement: deterministic trunk cut
Applying the defined trunk cut through existing Structural Core commands SHALL disconnect an upper crown/branch component with stable component ID. Joints alone SHALL NOT count as connectivity.

### Requirement: physical component facts
Detached component mass, center of mass, and inertia SHALL be finite. An asymmetric fixture SHALL preserve signed nonzero inertia cross terms. Greedy mesh SHALL remain derived output.

## Purity and immutability
The authority SHALL avoid Three.js, DOM, `Date`, and `Math.random`; SHALL leave inputs unchanged; and SHALL return frozen deterministic results.

## Browser proof
On the normal `/` route the E2E scenario SHALL dynamically import only `/src/world-generation/hestia/vegetation/index.ts`, consume a hydrology fixture, generate population, inspect Umbrella proxy facts, compile near-field bricks, prove intact anchoring, apply the trunk cut, and prove stable detached crown/branch facts. Two runs SHALL yield byte-identical timestamp-free evidence. Browser health SHALL be 0/0/0/0 and TestBridge SHALL be absent.

## Scope
Only the declared vegetation implementation, vegetation unit/E2E tests, two evidence files, one browser-mainline document, and this change directory may change. Adaptive, Structural, Hydrology, existing Hestia density/scatter/index, Surface Lab, `main.ts`, `style.css`, workers, package/lock, Vite, Playwright, CI, and infrastructure files are immutable dependencies.
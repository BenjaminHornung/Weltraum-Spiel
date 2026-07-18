# Design: Structural Hestia Vegetation V1

## Dependency and authority boundary
The vegetation module is a pure TypeScript authority layered on the pinned hydrology sampler and the existing adaptive/structural public barrels. It owns species definitions, candidate/population facts, deterministic plant graphs, far-field proxy facts, and compilation orchestration only. Adaptive brick addressing and Structural material, cell, anchor, connectivity, canonical hash, persistence, command/cut, component, mass, COM, and inertia semantics remain authoritative in their existing modules.

The hydrology SHA is pinned once. No moving branch head is consumed after the dependency merge. Required structural and hydrology files are read-only.

## Module shape
Keep cohesive files within `.../hestia/vegetation/**` and one public `index.ts` barrel. Suggested responsibilities are contracts/validation, canonical hashing/freezing, species registry, candidate population/placement, umbrella-tree graph and proxies, and structural compilation/destruction proof. Exact filenames may follow repository conventions; no second copy of adaptive or structural primitives is permitted.

## Determinism
Use explicit seed/input data and existing canonical hash conventions. Never read `Date`, `Math.random`, DOM, Three.js, or mutable globals. Normalize and sort externally supplied collections before decisions. Return deeply frozen results without mutating inputs.

Candidate anchors are globally indexed at 6 m = 48 base quanta. Jitter is deterministic and bounded to ±2 m. Ownership uses the unjittered anchor. Canonical ordering is global Z, global X, species ID, candidate hash; region subdivision therefore cannot create duplicates or reorder canonical results.

## Placement
Placement samples finite terrain and pinned hydrology facts, then applies species-specific slope, ocean/lake exclusion, river/water distance, moisture/material/biome, non-Air root-cell, crown spacing, and explicit budget gates. Missing/non-finite terrain or exhausted budget rejects fail-closed. Jittered geometry never changes candidate ownership.

## Species and graphs
Registry contains exactly the three V1 IDs and rejects invalid IDs. Umbrella Tree deterministically creates a rooted acyclic parent/child graph with stable node and segment IDs: trunk height 6–14 m, base radius 0.35–0.80 m, 5–9 primary branches, budget-limited 1–3 secondary branches per primary, and 4–8 flat canopy lobes. Root, wood, and canopy material roles remain distinct. Proxy output preserves multiple structural parts and cannot collapse to one cone or sphere.

Mist Sprout and Luminous Cap participate in deterministic population/proxy contracts but are not required to implement the full tree structural graph.

## Structural compilation
`compileVegetationStructuralBricks(instance, requestedQuantumBounds, targetLevel)` accepts only Adaptive Level 4, corresponding to 0.125 m cells and 16^3 Structural bricks. It reuses existing Adaptive brick keys and global quantum coordinates, clips to requested bounds, and materializes only intersected bricks. Root cells are Structural anchors; material IDs and canonical connectivity/hash/persistence contracts come from the Structural core. Equal inputs yield equal frozen bricks and hashes; region splits produce the same canonical union.

## Destruction proof
Construct the intact tree through Structural Core data and classify it anchored. Apply a deterministic trunk cut through existing command/edit semantics. Recompute connectivity/components through the Structural Core; joints alone must not create connectivity. The detached crown/branch component has a stable component ID and finite positive mass, finite COM, and finite inertia. An asymmetric fixture must retain signed nonzero inertia cross terms. Greedy mesh output is derived and never consulted as authority.

## Browser proof and evidence
The normal `/` route dynamically imports only `/src/world-generation/hestia/vegetation/index.ts`. The scenario consumes a deterministic hydrology fixture, generates population, selects Umbrella Tree, checks proxy facts, compiles near-field bricks, classifies intact anchoring, applies the trunk cut, proves stable detachment, and repeats twice byte-identically. Health is 0 console errors, 0 page errors, 0 failed requests, 0 warnings; TestBridge is absent. Evidence is timestamp-free and screenshots are prohibited.

## Scope safety
Forbidden files and package/lock/config/infra files remain unchanged. Import scans reject Three.js/DOM/Date/Random and forbidden internal-authority imports. Secret scanning and `git diff --check` run before completion.
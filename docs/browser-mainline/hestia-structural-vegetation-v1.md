# Structural Hestia Vegetation V1

## Status and authority boundary

Structural Hestia Vegetation V1 is a deterministic pure-domain foundation under `apps/weltraum-browser/src/world-generation/hestia/vegetation/**`. It owns the three-species registry, global candidate/population authority, Umbrella Tree graph, proxy contract, and the orchestration that projects Umbrella Trees into existing Adaptive and Structural public authorities.

The slice is not wired into `main.ts`, rendering, physics, gameplay, workers, UI, or the parent Hestia barrel. Renderer meshes remain derived presentation data and never become vegetation or Structural truth.

## Public contracts

Consumers import `apps/weltraum-browser/src/world-generation/hestia/vegetation/index.ts` directly. The V1 registry is fixed and ordered:

1. `hestia.umbrella-tree.v1`
2. `hestia.mist-sprout.v1`
3. `hestia.luminous-cap.v1`

Population uses the public Hydrology V2 terrain-adjustment contract, public Hestia terrain facts, the public Adaptive 0.125 m quantum/key/canonical helpers, and public Structural material IDs. Candidate ownership is based on an unjittered 6 m global grid; jitter is bounded to ±2 m and canonical ordering is global Z, global X, species ID, then candidate hash. Missing or non-finite terrain, missing or unknown water kinds, Ocean/Lake water, invalid river/water distance, disallowed moisture/material/biome, Air roots, crown conflicts, and exhausted budgets fail closed.

Published population, graph, proxy, Structural, cut, and mass facts are recursively frozen and hash-stable. The implementation does not use `Date`, `Math.random`, DOM state, Three.js, or mutable global caches.

## Umbrella graph and proxy

`createHestiaUmbrellaTreeGraph` produces a complete acyclic rooted graph with stable node and segment IDs, one parent per non-root node, a 6–14 m trunk, 5–9 primary branches, budgeted secondary branches, and 4–8 flat canopy lobes.

`createHestiaVegetationProxy` projects every Umbrella graph segment. The proxy contains distinct root, trunk, branch, and canopy pieces with source node/segment seams; it never collapses an Umbrella Tree into a single cone or sphere.

## Adaptive and Structural compilation

`compileVegetationStructuralBricks` accepts Umbrella Tree instances and Adaptive Level 4 only. It compiles intersecting 16³ Level-4 bricks, creates deterministic Adaptive edit/materialization authority through public APIs, and delegates object creation, hashes, persistence, anchors, joints, connectivity, commands, components, and mass properties to Structural Core.

Root cells are Structural anchors. Logical joints remain metadata and never add six-neighbor connectivity. Near-origin requested and derived quantum bounds canonicalize signed zero before Adaptive validation; nonzero coordinates and hashes are unchanged.

The Level-4 occupancy is a bounded near-field Structural projection of the authored graph, not render-fidelity geometry. Greedy-mesh output is not consulted by vegetation authority.

## Destruction facts

`applyHestiaVegetationTrunkCut` derives and validates a deterministic public Structural `SubtractBox` command against actual trunk semantic cells. Structural Core applies the edit and reclassifies components. The returned facts identify a detached component containing authored primary, secondary, or canopy semantics and include authoritative finite mass, center of mass, and the full six-value inertia tensor.

## Normal-route browser proof

`apps/weltraum-browser/tests/e2e/hestia-structural-vegetation.spec.ts` loads ordinary `/` with no query, verifies `window.TestBridge` is absent before and after the proof, and dynamically imports exactly `/src/world-generation/hestia/vegetation/index.ts` through Vite.

Its pinned frozen Hydrology V2 fixture executes this public flow twice in-page:

1. deterministic Umbrella population;
2. complete multi-part graph proxy;
3. intersecting Adaptive Level-4 Structural compilation;
4. one intact anchored Structural component;
5. deterministic trunk cut;
6. a stable detached crown/branch component with finite mass, center of mass, and inertia.

The two canonical scenario serializations and hashes must be byte-identical. Listeners are installed before navigation and require zero console errors, page errors, failed requests, HTTP errors, and warnings.

Timestamp-free, screenshot-free artifacts:

- `apps/weltraum-browser/evidence/browser-hestia-structural-vegetation-v1-summary.json`
- `apps/weltraum-browser/evidence/browser-hestia-structural-vegetation-v1.md`

No screenshot is expected because the proof changes no visual, DOM, renderer, or UI contract.

## Dependency pins

- Structural: `67daf4f532873214b506967af46dd90d85b45986`
- Adaptive parent: `5fb372bdba677e43e71566121c53efb5e244b93a`
- Hydrology: `501c24390b9ea2b8320b55cea56087875f2a63e2`
- Dependency merge: `4aabdd1e1ab133a392f4a7ed1a75303e6baa4eae`

## Verification

Run from `apps/weltraum-browser` after dependencies are installed in the worktree:

```text
npx tsc -p tsconfig.json
npx vitest run tests/unit/hestiaStructuralVegetationPhase1.test.ts tests/unit/hestiaStructuralVegetationPhase2.test.ts --maxWorkers=1
npm run test:e2e -- tests/e2e/hestia-structural-vegetation.spec.ts --workers=1 --retries=0
```

At repository root also run `git diff --check`. The E2E independently builds JSON and Markdown evidence from each deterministic browser execution, requires both output pairs to be byte-identical, and writes the first canonical pair.

## V1 limits

V1 does not provide runtime spawning, streaming, renderer integration, physics coupling, gameplay, growth simulation, ecological succession, cross-session persistence, or visual evidence. Those remain separate contracts and must not be inferred from this pure-domain proof.

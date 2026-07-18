# Structural Hestia Vegetation V1

## Motivation
Hestia needs a deterministic, renderer-independent vegetation authority whose population, placement, structural representation, and destruction preparation are stable across input ordering and region boundaries. Existing adaptive microvoxel, structural destruction, and hydrology contracts must be consumed rather than duplicated.

## Outcome
Provide three exact V1 species (`hestia.umbrella-tree.v1`, `hestia.mist-sprout.v1`, `hestia.luminous-cap.v1`), with Umbrella Tree as the complete structural case. The authority produces stable population and proxy facts, compiles intersecting near-field Level-4 structural bricks, and proves anchored connectivity plus deterministic trunk-cut detachment and finite mass properties.

## Scope
- New implementation only under `apps/weltraum-browser/src/world-generation/hestia/vegetation/**`.
- Unit and E2E coverage under the explicit vegetation test allowlist.
- Timestamp-free JSON/Markdown evidence and browser-mainline documentation.
- Reuse pinned adaptive/structural/hydrology public contracts.

## Non-goals
No Three.js or DOM types, rendering integration, animation, wind physics, gameplay, Surface Lab integration, worker/main/style changes, package/config changes, new structural object authority, or changes to adaptive, structural, hydrology, existing Hestia density/scatter/index files.

## Dependencies
- Structural basis: `67daf4f532873214b506967af46dd90d85b45986`
- Direct adaptive parent: `5fb372bdba677e43e71566121c53efb5e244b93a`
- Pinned hydrology: `501c24390b9ea2b8320b55cea56087875f2a63e2`
- Dependency merge: `4aabdd1e1ab133a392f4a7ed1a75303e6baa4eae`

## Success
All required deterministic population, placement, graph, proxy, Level-4 compilation, anchor/connectivity, cut/detachment, mass-property, immutability, browser byte-identity, health, and TestBridge-absence checks pass; only allowlisted files differ; evidence is byte-identical across two runs.
# Proposal: Browser Hestia Hydrology Terrain Generator V2

## Change
`browser-hestia-hydrology-terrain-generator-v2`

This is the implementation handoff for the approved V2 plan. It records the
contract and verification boundary; it is not a new architecture decision.

## Problem
The browser has no deterministic, bounded regional hydrology product that can
turn a terrain-height sampler into inspectable rivers, lakes, ocean connectivity,
and moisture without making renderer, runtime, or dynamic-fluid state
authoritative. A reproducible Hestia dataset needs global-coordinate identity,
stable water and river identities, fail-closed validation, and evidence that is
independent of caller order and wall-clock state.

## Goal
Deliver a deterministic, physically plausible, static Hestia Hydrology V2
snapshot for one bounded 256 m by 256 m region:

- `128 x 128` cells, `129 x 129` samples, and `2.0 m` spacing;
- a global origin expressed in `0.125 m` quanta and aligned to `16` quanta;
- pure terrain sampling, ocean classification, priority-flood filling, D8
  drainage, accumulation, lakes, rivers, channel adjustment, and moisture;
- recursively frozen snapshots with stable bytes and hashes;
- direct-module unit coverage for exactly the 20 mandatory cases; and
- normal-route browser proof without TestBridge, screenshots, dynamic liquids,
  or a decorative water plate.

## Scope

### Product contracts

The implementation defines and validates these contracts:
`HestiaHydrologyDatasetId`, `HydrologyGridDefinition`,
`HydrologyCellCoordinate`, `HydrologyGlobalCoordinate`,
`HydrologyDatasetRevision`, `WaterBodyId`, `RiverSegmentId`,
`HydrologyParameters`, `HydrologyInput`, `HydrologySnapshot`, `HydrologyCell`,
`WaterBody`, `RiverSegment`, and `HydrologySample`.

`HydrologyInput` contains `rootSeed`, `bodyId`, `surfaceFrameId`, `datasetId`,
global origin, sea level, versioned parameters, and a pure
`TerrainHeightSampler`. The sampler accepts global X/Z and returns finite
heights. Local array positions are storage only; global coordinates are the
identity of every sample and cell.

### Approved implementation and evidence paths

- `apps/weltraum-browser/src/world-generation/hestia/hydrology/**` only for the
  implementation;
- `apps/weltraum-browser/tests/unit/hestiaHydrology*.test.ts` only for unit
  tests;
- `apps/weltraum-browser/tests/e2e/hestia-hydrology-generator-v2.spec.ts` as
  the one browser spec;
- `apps/weltraum-browser/evidence/browser-hestia-hydrology-generator-v2*` for
  timestamp-free JSON/Markdown evidence; and
- this change's `tests/test-protocol.md` for the test protocol; and
- `docs/browser-mainline/hestia-hydrology-terrain-generator-v2.md` for the
  approved mainline documentation.

The tests import direct hydrology module paths. Barrel integration is later and
is not part of V2.

### Explicit non-goals and forbidden paths

- V1 remains unchanged and is not replaced or migrated.
- No dynamic fluid simulation, globally complete planet hydrology, decorative
  water plate, renderer/DOM/camera dependency, or runtime/wall-clock input.
- No edits to central application wiring or existing hydrology/terrain
  authorities, no package or lockfile changes, and no changes outside the
  approved implementation, test, E2E, evidence, protocol, and documentation paths.
- `apps/weltraum-browser/src/voxel/adaptive/**` is explicitly forbidden.
- The existing V1 path and central runtime/renderer/worker authorities remain
  read-only for this slice; hydrology is a parallel V2 product.

## Deterministic acceptance outcomes

The change is accepted only when all of the following are true:

1. The fixed grid and all global-coordinate validation rules are enforced.
2. The exact versioned preset values and no hidden hydrology constants are
   published in the contracts.
3. Priority-flood ordering, ocean connectivity, D8 drainage, accumulation,
   lake/river identity, channel adjustment, and moisture obey `spec.md`.
4. No internal flow cycle exists; every river reaches a lake, ocean, or dataset
   boundary; lake water is horizontal; downstream river water never rises.
5. The same input produces identical snapshot bytes and hashes, while a changed
   seed or terrain input changes the hash.
6. Invalid non-finite heights and unsafe global coordinates fail closed.
7. The 20 mandatory unit cases pass within the documented V2 memory budget.
8. The normal browser proof has no TestBridge and empty console, page-error,
   request-failure, and HTTP-error arrays; it proves the deterministic valley,
   lake/ocean termination, monotonic river levels, and absence of floating
   water.
9. Evidence is timestamp-free and uses the documented `browser-hestia-
   hydrology-generator-v2*` names.

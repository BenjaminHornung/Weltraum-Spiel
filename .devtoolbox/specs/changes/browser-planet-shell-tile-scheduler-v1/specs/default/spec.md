# Capability: Deterministic Browser Planet Shell Tile Scheduler

## Requirement: Canonical cube-sphere addressing

The system SHALL expose six renderer-independent faces with documented basis orientation, finite Face/UV-to-direction and direction-to-Face/UV transforms, stable edge/corner tie-breaking, and outward-consistent winding.

### Scenarios

- Every face center, edge sample, corner sample, and deterministic interior fixture round-trips to the expected canonical face and UV within documented tolerance.
- Equal dominant components resolve by X, then Y, then Z; the sign selects positive or negative face.
- Zero or non-finite directions are rejected and no public operation returns NaN.

## Requirement: Stable PlanetTile identity and topology

The system SHALL validate `PlanetTileKey { bodyId, face, level, x, y }`, produce a stable renderer/readiness-independent ID, canonical order, parent, four ordered children, siblings, and same-level edge neighbors across all face boundaries.

### Scenarios

- IDs do not change after readiness transitions, cache eviction, floating-origin shifts, or harness visual scaling.
- Parent/child roundtrips preserve the expected quadrant and all indexes remain in `[0,2^level)`.
- All directed face edges produce a valid same-level neighbor and reciprocal adjacency.

## Requirement: Conservative body-centered tile bounds

The system SHALL produce finite double-precision angular/radial bounds and a conservative sphere from physical body radius and a declared height range.

### Scenarios

- Corners, edge points, and deterministic interior points at minimum and maximum radius lie inside the bound.
- Invalid height/radius inputs fail validation rather than emitting NaN.
- Render visual scale and camera-relative projection do not alter authoritative bounds.

## Requirement: Reproducible SSE and frustum decisions

The system SHALL calculate perspective screen-space error from geometric error, viewport height, FOV, and conservative camera distance and SHALL cull a tile by frustum only when its full bound is outside a plane.

### Scenarios

- Moving closer increases SSE and reproducibly crosses split/merge conditions.
- An exact SSE threshold does not split.
- Tangent or intersecting frustum bounds remain candidates.

## Requirement: Conservative horizon culling

The system SHALL include body radius, camera distance, tile angular extent, conservative height margin, and numeric tolerance, and SHALL never cull an uncertain or visible front tile.

### Scenarios

- Surface, near-orbit, and far-orbit front tiles remain visible.
- A sufficiently separated back tile is culled.
- Tangent-minus/tangent-plus fixtures respect the tolerance.
- Inside/on-body camera input returns an indeterminate reason and culls nothing.

## Requirement: Deterministic budgeted selection

The system SHALL accept a complete immutable input snapshot and return canonically sorted primary, fallback, culled, generic load-request, reason, coverage-status, and selection-revision data. Candidate priority SHALL be coverage obligation, visibility, SSE, distance, then stable tile identity. Selection SHALL maintain a deterministic active coverage frontier and SHALL replace a parent with its complete required child set only when that atomic replacement fits the hard selected-primary budget. Primary-budget pressure SHALL retain coarser desired coverage and SHALL NOT relabel deferred fine descendants as readiness fallback.

The core SHALL expose one deduplicated `loadRequests` collection as the sole load-intent authority. Every request SHALL contain `{ tileKey, reason, priority, requiredForCoverage, expectedReadinessRevision }`. Every desired primary or fallback tile that is not render-ready at the accepted revision SHALL produce an exhaustive `requiredForCoverage: true` request; a missing visible root SHALL use `root-coverage-required` and the highest coverage priority. Optional child refinement uses the same collection with `requiredForCoverage: false` and remains bounded by the requested-child refinement budget. Mandatory coverage requests do not consume that optional refinement budget and may not be dropped by it. Duplicate candidates for one tile SHALL collapse to one request, preferring the coverage obligation. Requests SHALL be ordered deterministically by the structured selector priority, closed reason code, then stable tile identity.

### Scenarios

- Deep-equal inputs produce deep-equal outputs independent of collection insertion order.
- Selected-primary and optional refinement-request budgets are never exceeded.
- An all-ready level-one or deeper tree does not expand beyond the primary budget; when an atomic child replacement does not fit, the parent remains active.
- If the selected-primary budget is smaller than the currently visible coarsest root frontier, selection returns a typed rejected result with no partial plan.
- A nonresident visible root remains desired coverage, emits exactly one highest-priority coverage load request, and cannot be treated as render-ready or replaced by an empty tile.
- Culling, budget, readiness, coverage-status, and load-request decisions include explainable closed reason codes.

## Requirement: Revisioned readiness, explicit loading, and hole-free fallback

The system SHALL reject stale readiness snapshots and SHALL keep parent coverage desired until every required child is render-ready and the atomic child frontier fits the selected-primary budget. Child identity SHALL not include readiness state. Fallback SHALL be reserved for coarser parent coverage retained because required children are incomplete; budget-deferred refinement SHALL keep the parent active rather than emitting fine descendants as fallback. Readiness and per-level input arrays SHALL be dense and validated before traversal.

The plan SHALL report `coverageStatus` as the closed value `READY` only when every desired primary/fallback tile is render-ready at the accepted revision, otherwise `NOT_READY`. The core owns load intent and the adapter owns load execution: the adapter SHALL translate only explicit `loadRequests` into load jobs and SHALL NOT infer additional loads from visibility lists. Presentation SHALL consume only resident, revision-compatible desired coverage. An existing coarser body/impostor representation may remain visible while root coverage loads; this V1 selector has no such input and therefore SHALL report `NOT_READY` when tile coverage is unavailable rather than inventing an empty placeholder.

### Scenarios

- Missing, loading, failed, or partially ready children keep the parent as desired coverage and do not create a hole.
- Complete required child coverage atomically shows children and hides, but may retain, the parent.
- Evicting an active child makes the parent desired coverage again and emits the appropriate load request when it is not render-ready.
- A retained parent whose four complete child patches are all conservatively culled may be safely hidden; a regression pins this compositional culling rule.
- A stale readiness revision produces a rejected result with no partial plan or load requests.

## Requirement: Deterministic shell meshes and existing render contracts

The system SHALL generate finite regular-grid tile meshes through a `PlanetHeightSampler`, preserve double-precision authority outside Float32 artifact buffers, and use one adapter for existing MeshArtifact and VisibilityPlan contracts. The adapter SHALL flatten resident, revision-compatible `primary ∪ fallback` coverage into presentation `visibleRepresentationKeys`, SHALL leave presentation `fallbackRepresentationKeys` empty, and SHALL never map refinement requests directly to visibility. It SHALL translate only the core's explicit load requests into load jobs.

### Scenarios

- Mesh positions, normals, indices, winding, and bounds are finite and valid.
- Equal generation input produces an equal stable MeshArtifact hash.
- All-fallback/request-budget-zero and mixed primary/fallback branches remain hole-free through the existing presentation visibility resolver.
- No planet-core module imports Three.js, and presentation/render-backend core files remain unchanged.

## Requirement: Separate visible Hestia harness

The system SHALL provide a separately imported deterministic Canvas harness without modifying main.ts, style.css, or TestBridge.

### Scenarios

- The normal route loads with TestBridge absent before the harness import.
- Far orbit, near-orbit parent fallback, child-ready handoff, horizon culling, and eviction/reactivation are visibly and programmatically verified.
- Repeated execution is deterministic and produces the three named screenshot baselines without console, page, request, or HTTP errors.

## Non-goals

The capability SHALL NOT implement local voxels, surface handoff, final geology, global volumetric authority, new dependencies, WASM, Shared Memory, or changes to Flight, Navigation, Autopilot, Physics-Spine, workers, streaming, voxel, world-generation, surface-lab, presentation core, or Three backend core.
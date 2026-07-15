# Design: Browser Planet Shell Tile Scheduler V1

## Context and boundaries

The planet core is a pure TypeScript domain under `src/planet/**`. It may use existing plain vector/body contracts but must not import Three.js, presentation, render backend, browser globals, cache state, or floating-origin state. `planetPresentationAdapter.ts` is the sole presentation boundary and may import existing MeshArtifact and VisibilityPlan contracts. The harness is outside the core boundary and may use the existing browser renderer.

## Face convention and cube-sphere

Canonical face order and ordinals are `+X, -X, +Y, -Y, +Z, -Z`.

| Face | Normal | +U | +V |
|---|---|---|---|
| +X | +X | -Z | +Y |
| -X | -X | +Z | +Y |
| +Y | +Y | +X | -Z |
| -Y | -Y | +X | +Z |
| +Z | +Z | +X | +Y |
| -Z | -Z | -X | +Y |

Each basis satisfies `U × V = Normal`. For normalized tile coordinates `u,v in [0,1]`, map `s=2u-1`, `t=2v-1` and normalize `Normal + s*U + t*V`. Reverse mapping selects the dominant absolute component with the fixed axis tie order `X > Y > Z`, chooses sign, and obtains face coordinates from basis dot ratios. Zero-length and non-finite direction input is rejected before normalization. Only finite round-off drift is clamped.

This convention supplies stable corner ties, cross-face winding, and renderer-independent directions.

## Tile key, ID, ordering, and quadtree

`PlanetTileKey = { bodyId, face, level, x, y }`, with non-empty body ID, integer `level >= 0`, and `0 <= x,y < 2^level`. The stable ID is `planet-tile:v1:<escaped-bodyId>:<face>:<level>:<x>:<y>`; escaping is canonical and reversible. Canonical comparison uses body ID, face ordinal, level, X, then Y, never insertion order.

A non-root tile has one parent at `level-1, floor(x/2), floor(y/2)`. Children at `level+1` are ordered NW/NE/SW/SE by offsets `(0,0),(1,0),(0,1),(1,1)`. Siblings are the other children in canonical order. Interior neighbors use index arithmetic. A cross-face edge neighbor is found by evaluating the center of the virtual equal-level adjacent cell outside the face, projecting through the face basis to a direction, then canonical reverse-addressing at the same level. Tests cover all 24 directed face edges, inverse-edge adjacency, corners, and every level used by fixtures.

## Bounds and geometric error

Tile bounds are body-centered JS-number values (double-precision semantics): center/cap axis, angular extent, min/max radius from physical body radius plus validated height range, and a conservative bounding sphere. Angular extent is the maximum angle from the cap axis to all four corner directions plus a fixed documented numeric tolerance. Sphere construction must contain corner, edge, and deterministic interior samples at both radial extrema. Invalid/non-finite radii fail validation rather than yielding NaN.

Geometric error is supplied by the selector snapshot as a deterministic per-level value/function and is not inferred from readiness or rendering. The default helper halves root error per level.

## Screen-space error

Perspective pixel error is pure and finite:

`SSE = geometricErrorMeters * viewportHeight / (2 * tan(verticalFov/2) * max(distanceToBound, nearClamp))`.

`distanceToBound` is conservative camera distance to the tile bounding sphere. Inputs are validated. A tile splits only when SSE is strictly greater than the configured threshold; equality remains unsplit. No hidden hysteresis or prior-frame state participates in V1.

## Frustum culling

The core accepts normalized plain-data planes. A tile sphere is outside only when a plane's signed center distance is less than `-radius-tolerance`. Intersecting/tangent bounds remain visible. No renderer matrix type enters this contract.

## Horizon culling

The guaranteed opaque occluder radius is the physical body radius. The declared conservative height margin is only an upper bound for a possible terrain envelope and must not be treated as opaque material. A tile cap whose maximum radius exceeds `bodyRadius + conservativeHeightMargin` is indeterminate and retained. For a camera outside the physical radius and a validated outer tile radius `r = max(bodyRadius, tileCap.maxRadius)`, the conservative center-angle occlusion threshold is `acos(bodyRadius / cameraDistance) + acos(bodyRadius / r)`. Compare the nearest tile-cap angle (`cameraToTileAxisAngle - tileAngularExtent`) with that threshold plus tolerance. Cull only when the complete tile cap, including its outer radial envelope, is provably behind the physical sphere. At/toward tangency, retain the tile. For a camera inside/on the physical radius, return the reason `indeterminate-camera-inside-body` and do not cull. Surface, near-orbit, far-orbit, tangent-minus/plus, front, back, possible-height-envelope, and insufficient-height-margin cases are fixtures.

## Deterministic selection

The immutable input snapshot contains:

- selection revision and accepted readiness revision,
- body radius/height range and camera body-relative position,
- perspective projection, viewport height, and plain frustum,
- max level, root/per-level geometric error, and split threshold,
- readiness snapshot,
- a hard selected-primary budget and a hard optional child-refinement request budget.

The selector validates all revisions and dense array inputs before traversal. Stale readiness is returned as a typed rejected result with no partial selection. Roots and candidates use a deterministic best-first queue ordered by: coverage obligation, visible/non-culled status, SSE descending, distance ascending, canonical Tile ID. Selection maintains an active desired-coverage frontier. A parent is replaced atomically by its complete required non-culled child set only when every required child is render-ready and the net frontier growth fits the remaining selected-primary budget; otherwise the coarser parent remains active and the selector does not descend that branch. The primary budget therefore constrains traversal and active detail, not only final list slicing. If the budget is smaller than the currently visible root frontier, selection returns a typed insufficient-primary-budget rejection with no partial plan. Every output list is canonical and every decision has a closed reason.

The output contains primary, fallback, culled, `loadRequests`, reasons, `coverageStatus`, and the echoed selection/readiness revisions. `requestedChildren` is replaced by the single generic `loadRequests` authority rather than retained as a second request source. Each `PlanetTileLoadRequest` is immutable and contains `{ tileKey, reason, priority, requiredForCoverage, expectedReadinessRevision }`. Its priority is the selector's structured total-order priority; final request ordering compares priority, then request reason, then canonical Tile ID. Requests are deduplicated by stable tile ID, with a mandatory coverage request winning over an optional refinement request for the same tile.

Every desired primary/fallback tile not render-ready in the accepted snapshot emits one exhaustive `requiredForCoverage: true` request. A missing visible root uses `root-coverage-required` and the highest coverage-obligation priority. Missing children below an active parent use the existing readiness/refinement reasons with `requiredForCoverage: false`; only these optional refinement requests consume `maxRequestedChildren`. The optional request budget may be zero and request overflow never changes active coverage, but mandatory coverage requests are never dropped because that would deadlock bootstrap or recovery.

## Readiness and parent fallback

Readiness is keyed solely by stable tile ID and includes a snapshot revision and state sufficient to distinguish not requested, queued/loading, render-ready, failed, and evicted. Identity never includes readiness. Readiness entries and per-level geometric-error arrays are dense; holes are rejected with the owning domain error before traversal. Exported state and reason-code collections used as validation authorities are frozen at runtime.

A parent hands desired coverage to the required, non-culled child set atomically only when every required child is render-ready in the accepted snapshot. Partial, missing, failed, or evicted coverage keeps/reactivates the parent and leaves ready children resident but hidden. Once complete child coverage is active, the parent may remain resident and hidden. If all four complete child patches are conservatively culled, hiding the retained coarse parent is safe because the child patches partition the parent patch; a focused regression locks this assumption.

`coverageStatus` is `READY` iff every tile in `primary ∪ fallback` is render-ready at `expectedReadinessRevision`; otherwise it is `NOT_READY`. A nonresident root remains desired primary/fallback coverage, emits a mandatory request, and is never treated as drawable. No body/impostor source exists in this V1 selector input, so unavailable tile coverage reports `NOT_READY`; an independently managed coarser body/impostor may remain visible if a later integration supplies one.

## Shell mesh and adapter

`PlanetHeightSampler` accepts stable body/tile/direction/sample coordinates and returns a finite height. V1 includes a neutral zero sampler and a deterministic harness sampler; neither is product geology. The generator emits a regular face-grid, sphere-projected outward positions, outward normals, stable triangle indices and bounds. It keeps body/tile origin and bounds in doubles while artifact vertex data is tile-relative Float32.

`planetPresentationAdapter.ts` is the sole load-execution and presentation boundary. It converts generated planet geometry into the existing `MeshArtifact` factory and maps only resident, accepted-revision coverage from core `primary ∪ fallback` to presentation `visibleRepresentationKeys`; presentation `fallbackRepresentationKeys` stays empty. This flattening is required because the existing presentation fallback resolver is global and would suppress valid coarse coverage for empty-primary or mixed branches. Requested/nonresident tiles never enter visible keys. The adapter translates exactly the explicit core `loadRequests` into jobs and infers no load work from visibility lists. Hash/content identity is derived deterministically from stable tile/generator inputs. Presentation and Three backend source files remain untouched.

## Hestia orbit harness

A separate `src/planet/harness/hestiaOrbitHarness.ts` exports a mount/controller API. The normal application route is loaded first; E2E asserts TestBridge is absent, then dynamically imports the Vite-served harness module. The harness mounts its own canvas/container, uses fixed Far/Near camera presets and explicit readiness transitions, and visualizes LOD/fallback/horizon state with deterministic colors or wireframe. Visual scale is a derived render transform only and never mutates body data, bounds, or IDs.

Required states are far orbit, near orbit with parent fallback, child-ready handoff, and eviction/reactivated parent. Browser listeners reject console/page/request/HTTP errors. Screenshot baselines use the three required names.

## Trade-offs and risks

- Virtual-cell reprojection for neighbors is simpler and less error-prone than a handwritten 24-edge table, while exhaustive tests pin the exact mapping.
- Conservative cap/sphere and horizon tolerances may retain extra tiles but must never remove a visible front tile.
- Atomic child handoff can render more parent area during loading, intentionally preferring coverage over detail.
- No skirts/seam stitching are added in V1; the harness uses matching face-grid borders and debug presentation only.
- Initial package/CI files stay frozen. E2E group/LFS wiring is deferred until the Surface-Lab merge gate.
# ExecPlan: Browser Render Backend Mesh Artifact Lifecycle V1

## Goal

Provide a backend-neutral, revision-safe mesh presentation boundary and a concrete Three.js implementation whose ownership, visibility, replacement, eviction, disposal, reset, diagnostics, and browser evidence are deterministic and independently testable.

## Context

The binding architecture is defined by `docs/architecture/world-runtime-render-backend-boundary.md`, `procedural-voxel-planet-runtime.md`, `webgl-observability-and-performance-evidence.md`, and the browser-mainline architecture records. The implementation adds new modules only under `src/presentation/**` and `src/render/three/backend/**`; it does not integrate with `main.ts` or existing runtime/domain owners.

The public data flow is:

```text
caller-owned primitive metadata + Typed Arrays
  -> presentation validation/canonical hash
  -> revision/generation/idempotency gate
  -> rollbackable Three.js resource preparation
  -> atomic ownership/registry/scene commit
  -> visibility recomputation
  -> prior resource disposal
  -> read-only diagnostics
```

## Non-goals

- No world, voxel, physics, flight, navigation, celestial, persistence, worker, streaming, or gameplay integration.
- No change to `main.ts`, package files, CSS, existing Three.js modules, CI group registration, or roadmap files.
- No shader graph, textures, general material system, WebGPU, WASM, Shared Memory, transferable/detached-buffer transport, or universal engine API.
- No reconstruction of domain state from scene nodes, no absolute astronomical coordinates in Three.js, and no renderer-to-domain writeback.
- No automatic WebGL context-loss recovery; explicit reset and replay are the V1 recovery boundary.

## Architecture decision

### Identity, revisions, and generations

`RepresentationKey`, `MaterialProfileId`, and `FrameId` are semantic stable lowercase ASCII IDs, 1-128 characters, matching `^[a-z][a-z0-9]*(?:[_:-][a-z0-9]+)*$`. They are never filenames, display names, object paths, or scene hierarchy identities.

`BackendRevision`, `SourceRevision`, `ArtifactRevision`, `FrameRevision`, and `VisibilityPlanRevision` are non-negative safe integers. Artifact ordering is lexicographic `(sourceRevision, artifactRevision)`: source revision is primary and artifact revision is monotonic inside one source. For an existing key:

- same tuple, same canonical content hash, and same material signatures is `AlreadyApplied`;
- same tuple with different content or material definition is `RejectedContentConflict`;
- lower tuple is `RejectedStaleRevision`;
- higher tuple is an atomic replacement.

Every command targets a `BackendRevision`. Initialization establishes generation 0. Reset requires `nextBackendRevision === current + 1`, disposes the generation, and permits replay with fresh buffers. A command from another generation fails closed as stale or unavailable and cannot mutate current resources.

### Mesh artifact layout and canonical content

`MeshArtifact` contains representation identity, source/artifact revisions, algorithm version, frame ID, content hash, positions, normals, indices, optional V1 attributes, material ranges, and AABB bounds. V1 supports:

- `Float32Array` positions and normals, exactly three finite values per vertex;
- `Uint16Array | Uint32Array` indices, a non-empty triangle list with every index in range;
- optional `Float32Array` UVs with two and colors with three finite values per vertex;
- sorted, positive, triangle-aligned, non-overlapping, gapless material ranges covering every index;
- finite ordered bounds containing every vertex;
- at least three vertices and one triangle.

Move safety requires each Typed Array to be a full fixed-length view of its own non-shared backing buffer. Subviews, aliases between attributes, `SharedArrayBuffer`, resizable, detached, or otherwise unusable buffers are invalid.

Canonical hashing uses a presentation-local versioned binary encoding with explicit field tags and lengths, little-endian Float32/Uint16/Uint32 bit patterns, and FNV-1a-64 output `fnv1a64:<16 lowercase hex>`. Ordered vertex/index streams remain ordered; set-like keys are sorted. The content hash covers algorithm version, frame ID, buffers, ranges, and bounds but excludes representation identity and revisions. Validation recomputes it before acceptance.

### Buffer ownership: move semantics

The transfer is a logical move without copying or detaching:

1. Before acceptance, the caller owns all artifact buffers.
2. Complete structural, hash, capability, generation, and revision validation occurs before ownership changes or geometry allocation.
3. Rejection leaves ownership with the caller.
4. Successful commit atomically moves ownership to the backend. Three.js attributes adopt the exact arrays.
5. The caller must not mutate, detach, reuse, or transfer accepted buffers afterward.
6. V1 backend operations never mutate vertex or index contents. Metadata may be copied/frozen; Typed Arrays remain governed by ownership because JavaScript cannot freeze their elements portably.
7. Exact idempotent reapplication is detected before allocation. New duplicate buffers remain caller-owned; already-owned references remain backend-owned.
8. Replace accepts and publishes the new artifact before releasing the old. Remove, eviction, reset, and dispose drop backend references and dispose GPU resources without zeroing or detaching contents.

Command results expose one required status plus `reasonCode` and ownership outcome: `MovedToBackend`, `RetainedByCaller`, `AlreadyOwnedByBackend`, `ReleasedByBackend`, or `NotApplicable`.

### Material profiles

V1 profiles contain stable ID, `Unlit | BasicLit | DebugWireframe`, linear RGB values in `[0,1]`, opacity in `[0,1]`, `doubleSided`, `wireframe`, and `depthWrite`. `DebugWireframe` requires wireframe. Unlit/debug use `MeshBasicMaterial`; BasicLit uses `MeshLambertMaterial`. One backend generation binds a profile ID to one canonical definition. Upsert supplies exactly one definition for every referenced range and no unused/duplicate definitions.

Materials are cached by profile ID and signature and reference-counted. A replacement acquires new leases before releasing old leases. The last release disposes the material and increments diagnostics.

### Commands and result model

The backend consumes immutable `InitializeBackendCommand`, `UpsertMeshArtifactCommand`, `RemoveRepresentationCommand`, `EvictRepresentationCommand`, `ApplyVisibilityPlanCommand`, `ApplyFrameProjectionCommand`, `ResetBackendCommand`, and `DisposeBackendCommand`. Remove/evict carry key, expected source/artifact revision, and expected hash.

Results use only `Accepted`, `RejectedStaleRevision`, `RejectedInvalidArtifact`, `RejectedUnsupportedCapability`, `RejectedContentConflict`, `AlreadyApplied`, `NotFound`, and `BackendUnavailable`. Dispatch is synchronous so validation, ownership commit, and result form one atomic caller-visible operation.

### Visibility and fallback

Visibility plan key lists are canonical sorted sets and pairwise disjoint. Residency and visibility are distinct. A requested primary is ready only when its accepted artifact and current-frame representation transform both exist.

- While any requested primary is not ready, all ready requested primaries plus all ready fallback keys remain visible.
- Once every requested primary is ready, fallbacks become hidden but remain resident and pinned.
- A missing or failed child never hides its parent fallback.
- Removing/evicting a child recomputes coverage and reveals an available fallback under the unchanged plan.
- A key in the active fallback set cannot be removed or evicted; the backend returns `RejectedContentConflict` with `PinnedFallback` until a higher plan revision unpins it.
- Visibility never changes world or simulation residency.

Repeated plan/frame revisions use canonical signatures: identical input is `AlreadyApplied`, differing content conflicts, and lower revision is stale.

### Camera-relative frame projection

`FrameProjectionSnapshot` carries frame ID/revision, relative camera position, normalized orientation, perspective parameters, and unique representation transforms with relative position, normalized orientation, and positive scale. All values are finite, Float32-representable, and converted with `Math.fround` before reaching Three.js. A missing transform makes an artifact not ready for visibility. The adapter never receives or reconstructs absolute astronomical positions and never writes scene-node values back to domain state.

### Three.js resource lifecycle

`ThreeRenderBackend` owns Scene, PerspectiveCamera, WebGLRenderer, representation root, geometries, attributes, materials, meshes, optional render targets, registry, and diagnostics. The constructor accepts a canvas and adapter options; a renderer factory may be injected only to unit-test lifecycle behavior without WebGL.

Upsert proceeds as follows:

1. Validate generation, command, artifact, hash, material definitions, capabilities, revision, and idempotency while caller ownership remains unchanged.
2. Create a detached invisible mesh, BufferGeometry, direct BufferAttributes, groups, bounds, and material leases in a rollbackable temporary record.
3. Commit buffer ownership and new registry record, attach the node, and recompute visibility synchronously.
4. Only after successful publication detach and dispose the previous geometry and release its materials.

Failure disposes temporary Three resources, leaves the previous record and fallback coverage untouched, and returns caller ownership of the proposed buffers.

Eviction releases owned buffers and GPU resources but retains a revision/hash high-watermark and permits accepted rehydration with fresh buffers. Remove records a tombstone so the same or older artifact cannot silently resurrect; only a higher artifact tuple can return. Reset disposes all records/materials/targets, clears plans, projection, and high-watermarks, increments generation, and awaits explicit replay. Dispose is terminal and idempotent and also disposes the renderer.

### Diagnostics

Deeply immutable diagnostics contain all required counters: accepted/rejected artifacts, active representations/fallbacks, geometry/material allocations and disposals, estimated GPU bytes, replacements, removes, stale rejects, and resets. V1 additionally reports backend state/revision, sorted resident/visible/pinned keys, owned CPU bytes, eviction rejects/count, rehydration count, and render-target allocation/disposal/active counts. Estimated bytes derive from accepted buffers and backend-owned targets; driver/material memory is not fabricated. Three renderer info may be attached as explicitly observational data only.

### Deterministic browser harness

The harness creates its own fixed 640 x 360 canvas, pixel ratio 1, `antialias=false`, `preserveDrawingBuffer=true`, opaque fixed background, no animation, no lights, fixed perspective camera, sRGB output, and explicit render calls. It uses deterministic Unlit materials, does not touch `main.ts`, TestBridge, gameplay state, or product UI, and exposes only canvas, backend, dispatch/render, and dispose operations.

## Implementation phases

1. Finalize this change spec, normative scenarios, task checklist, test protocol, and architecture record.
2. Implement presentation IDs, types, canonical encoding/hash, validation, artifact/profile/command factories, visibility/projection contracts, and public backend interface.
3. Implement Three.js factories, registry, reference-counted materials, projection, diagnostics, backend dispatch/lifecycle, and deterministic harness.
4. Implement focused unit suites for validation, ownership, canonicalization, revision/idempotency, fallback, lifecycle, reset, diagnostics, and boundary scans.
5. Implement normal-route Playwright lifecycle, exact canvas baselines, deterministic evidence, and visual checks.
6. Run focused and full verification, scope/diff audit, independent review, commit, and push.

## Tests and evidence

The exact commands and required 24-case matrix are in `tests/test-protocol.md`. Browser evidence consists of three exact 640 x 360 canvas states, deterministic JSON/Markdown summaries, lifecycle diagnostic assertions, and failure collection for console, page, request, and HTTP errors. A baseline update is followed by a normal comparison run.

## Risks

- Validation after resource creation could accidentally transfer ownership on rejection.
- Revision comparison or tombstones could permit stale deletion/resurrection.
- Material sharing could double-dispose or leak resources.
- Scene visibility could hide a fallback before a child is both resident and transformed.
- Typed-array aliasing could undermine ownership and byte diagnostics.
- Browser/driver variation could make screenshots unstable if lighting, animation, pixel ratio, tone mapping, or application UI enters the comparison region.
- Full E2E may regenerate unrelated evidence; such changes must not be committed.

## Rollback / safe stop

All implementation is additive inside allowlisted paths. Stop before commit/push if validation, focused lifecycle tests, exact screenshot rerun, full regression, or scope audit fails. Revert only files created by this change; never reset or discard unrelated worktree state. The unavailable DevToolbox service is documented and manually substituted per explicit user instruction.

## Progress log

- [ ] Phase 1: Specification and architecture contract finalized.
- [ ] Phase 2: Presentation contracts implemented and focused tests green.
- [ ] Phase 3: Three.js adapter/lifecycle implemented and focused tests green.
- [ ] Phase 4: Browser harness, baselines, and evidence verified.
- [ ] Phase 5: Full regression, scope audit, review, commit, and push complete.

## Definition of Done

- All required contracts and lifecycle behavior are implemented without Three.js leakage or domain imports.
- The move-semantics ownership contract is proven for accepted, rejected, duplicate, replaced, removed, evicted, reset, and disposed buffers.
- Stale commands fail closed, replacements are atomic, fallbacks preserve coverage, and pinned fallbacks cannot be removed/evicted.
- Diagnostics reconcile allocations, disposals, active resources, estimated bytes, reset, and rebuild.
- All required unit, type, build, focused E2E, full E2E, screenshot, diff, and allowlist gates pass under Node 22.
- Evidence and docs match the verified runtime, and the feature branch is committed/pushed without PR or merge.

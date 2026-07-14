# Browser Render Backend Mesh Artifact Lifecycle V1

## Representation identity and revisions

The presentation contract SHALL use stable semantic ASCII representation, material-profile, and frame IDs. Revisions and backend generations SHALL be non-negative safe integers, and artifact ordering SHALL be lexicographic by source revision then artifact revision.

### Scenario: stale and conflicting revision

- **Given** a representation is resident at a revision tuple and canonical hash
- **When** a lower tuple is submitted
- **Then** the backend SHALL return `RejectedStaleRevision` without allocation or mutation
- **When** the same tuple and a different hash or material definition is submitted
- **Then** it SHALL return `RejectedContentConflict`
- **When** the same tuple and same canonical content is submitted
- **Then** it SHALL return `AlreadyApplied` without duplicate ownership or geometry

## Validated mesh artifacts

V1 SHALL accept finite `Float32Array` positions/normals, `Uint16Array | Uint32Array` triangle indices, optional finite UV/color arrays, complete material ranges, and finite AABB bounds containing every vertex. Empty meshes, invalid indices, inconsistent lengths, aliasing/subviews/shared buffers, incomplete ranges, and invalid bounds SHALL fail closed.

### Scenario: validation before ownership

- **Given** the caller owns a proposed artifact's buffers
- **When** any structural, content-hash, capability, generation, or revision check fails
- **Then** no Three.js geometry SHALL be allocated or published
- **And** ownership SHALL remain with the caller
- **And** neither caller buffers nor the current representation SHALL be mutated

## Move-semantics buffer ownership

Successful acceptance SHALL atomically move logical ownership of the exact Typed Arrays to the backend without copy or detach. The backend SHALL use those arrays directly and SHALL NOT mutate vertex/index contents in V1. The caller SHALL NOT mutate, detach, reuse, or transfer accepted buffers.

### Scenario: acceptance and exact duplicate

- **When** a valid new artifact is accepted
- **Then** the result SHALL report `MovedToBackend`
- **And** Three.js BufferAttributes SHALL reference the exact accepted arrays
- **When** an exact revision/hash is reapplied with new duplicate arrays
- **Then** it SHALL report `AlreadyApplied` and `RetainedByCaller`
- **And** allocations and ownership SHALL not increase
- **When** already-owned references are reapplied
- **Then** it SHALL report `AlreadyOwnedByBackend`

### Scenario: release

- **When** an owned artifact is replaced, removed, evicted, reset, or disposed
- **Then** applicable geometry and final material leases SHALL be disposed exactly once
- **And** backend references and owned-byte counts SHALL be released
- **And** the underlying buffer contents SHALL not be zeroed, detached, or altered

## Material profiles

V1 SHALL support only `Unlit`, `BasicLit`, and `DebugWireframe` profiles. One profile ID SHALL have one canonical definition per backend generation. An upsert SHALL provide exactly the profiles referenced by material ranges.

### Scenario: shared material ownership

- **Given** two representations reference the same canonical profile
- **When** both are accepted
- **Then** the backend SHALL share one reference-counted material
- **When** one representation is released
- **Then** the material SHALL remain alive
- **When** its final reference is released
- **Then** it SHALL be disposed exactly once

## Atomic upsert and replacement

A higher valid artifact revision SHALL be prepared off-scene, committed, made eligible for visibility, and only then replace and dispose the previous record.

### Scenario: replacement failure

- **Given** a visible current representation and fallback plan
- **When** preparation of a higher artifact fails
- **Then** the proposed buffers SHALL remain caller-owned
- **And** the current mesh, visibility, diagnostics residency, and fallback coverage SHALL remain unchanged

## Remove, eviction, reset, and dispose

Remove and eviction SHALL bind to exact key/revision/hash expectations. Repeated exact remove SHALL be idempotent; a stale remove SHALL never delete a newer representation. Eviction SHALL retain a high-watermark; remove SHALL retain a tombstone. Reset SHALL release all resources and start the next explicit backend generation. Dispose SHALL be terminal and idempotent.

### Scenario: stale remove and resurrection

- **Given** a newer representation is resident
- **When** a remove targets an older revision/hash
- **Then** it SHALL return `RejectedStaleRevision` and preserve the newer record
- **When** a removed revision is upserted again in the same generation
- **Then** it SHALL not silently resurrect
- **When** a higher revision is upserted
- **Then** it MAY be accepted

### Scenario: reset and rebuild

- **When** reset advances the backend generation
- **Then** all owned CPU/GPU resources, plans, projections, and prior generation ledgers SHALL be released
- **And** old-generation commands SHALL be rejected
- **When** fresh buffers, projection, and visibility are replayed in the new generation
- **Then** the same visible representation keys and deterministic canvas state SHALL be rebuildable

## Visibility and parent fallback

Visible, resident, and pinned-fallback state SHALL remain distinct. A requested child SHALL become ready only after successful artifact acceptance and a current transform. Until every requested primary is ready, available fallbacks SHALL remain visible. Active fallback keys SHALL remain pinned even while hidden.

### Scenario: missing and accepted child

- **Given** a parent fallback is resident and visible
- **When** a plan requests a missing or untransformed child
- **Then** the parent SHALL remain visible
- **When** the child is successfully accepted and transformed
- **Then** a higher/effective plan state MAY show the child and hide the parent
- **And** the parent SHALL remain resident and pinned

### Scenario: pinned fallback and child loss

- **When** remove or eviction targets an active fallback key
- **Then** it SHALL return `RejectedContentConflict` with `PinnedFallback`
- **When** the active child is removed or evicted
- **Then** the backend SHALL automatically restore the available fallback under the unchanged plan

## Camera-relative projection

The backend SHALL accept only finite camera/origin-relative Float32-compatible camera and representation transforms in one declared frame. Perspective parameters and normalized orientations SHALL be validated before application.

### Scenario: invalid frame revision or transform

- **When** a frame revision is negative, unsafe, stale, conflicting, non-finite, absolute/unbounded, or contains an invalid quaternion/projection
- **Then** it SHALL be rejected without changing camera, scene nodes, visibility, or gameplay/domain state

## Diagnostics

Diagnostics SHALL be deeply immutable observations and SHALL include the required acceptance, rejection, active, fallback, allocation, disposal, byte, replacement, remove, stale, and reset counters. They SHALL also expose sorted resource keys and truthful V1 CPU/target/eviction data without estimating unknown driver memory.

### Scenario: observation only

- **When** callers read diagnostics repeatedly
- **Then** commands, artifacts, world state, visibility, and resource ownership SHALL remain unchanged
- **And** attempted mutation of returned snapshots SHALL not mutate backend state

## Backend boundary

Presentation exports SHALL contain no Three.js types. The Three.js adapter SHALL consume only presentation contracts and SHALL not import flight, navigation, celestial, persistence, world, voxel, physics, workers, streaming, runtime, or gameplay state.

### Scenario: deterministic normal-route evidence

- **Given** Playwright opens `/` and `window.TestBridge` is absent
- **When** it dynamically imports the standalone backend harness
- **Then** a separate fixed 640 x 360 canvas SHALL demonstrate parent fallback, child activation, replacement, stale rejection, remove fallback, reset, and replay
- **And** canvas-only baselines and deterministic diagnostics SHALL be produced without animation, lighting, gameplay fixtures, product UI, console errors, page errors, request failures, or HTTP failures

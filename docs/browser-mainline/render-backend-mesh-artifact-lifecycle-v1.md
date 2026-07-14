# Browser Render Backend Mesh Artifact Lifecycle V1

## Status and purpose

This change introduces a standalone browser presentation boundary and a concrete Three.js adapter for revisioned mesh artifacts. It does not wire the new backend into `main.ts` or make it a source of world, voxel, physics, navigation, flight, persistence, or gameplay truth.

Three.js owns only derived scene and GPU state. Callers provide validated primitive metadata, relative transforms, material profiles, and Typed Arrays through backend-neutral contracts under `src/presentation/**`.

## Stable presentation contract

- Representation, material-profile, and frame identities are stable semantic lowercase ASCII IDs, not filenames, labels, or scene paths.
- Source, artifact, frame, visibility-plan, and backend revisions are non-negative safe integers.
- Artifact precedence is lexicographic `(sourceRevision, artifactRevision)`.
- Same revision and canonical content is idempotent; same revision with different content is a conflict; lower revision is stale; higher revision replaces atomically.
- Backend generation changes only through explicit reset, and commands from an old generation cannot mutate the new backend.
- Commands and snapshots are immutable and carry explicit accepted/rejected results. Invalid and stale data fails closed.

## Mesh artifact and ownership

V1 mesh artifacts contain Float32 positions/normals, Uint16/Uint32 triangle indices, optional Float32 UV/color arrays, complete material ranges, finite AABB bounds, algorithm/frame metadata, revisions, a canonical content hash, and an explicit ownership mode.

**Public Factory = immutable defensive snapshot.** createMeshArtifact copies
positions, normals, indices, optional UV/color, and metadata once before
hashing and returns ownership: SnapshotOwned. Caller arrays remain attached
and may be changed afterward without changing the artifact or its hash. The
Three.js adapter references the accepted snapshot arrays directly without a
second copy.

**Trusted Worker Adoption = explicit zero-copy move path.**
adoptMeshArtifactBuffers is a separate API. It performs complete validation
before accepting only full views over exclusive, unshared, non-resizable
ArrayBuffers with no attribute aliases, then returns ownership:
AdoptedExclusive using the exact input arrays. Rejection leaves ownership with
the caller. Successful adoption is a documented move: the caller must not
mutate, detach, transfer, reuse, or otherwise access the accepted buffers as
writable.

Ownership mode is diagnostic contract metadata, not mesh content. It is
excluded from content and upsert-command hashes so equal revision/content from
a separate snapshot remains AlreadyApplied, while same revision/different
content remains a conflict. Both modes share the same read-only backend
lifecycle: validation precedes acceptance, the backend never mutates array
contents, and remove, eviction, reset, and dispose release backend references
and GPU resources without altering or detaching buffers.

## Materials and atomic resources

V1 deliberately supports only `Unlit`, `BasicLit`, and `DebugWireframe`. Profiles contain linear base color, opacity, sidedness, wireframe, and depth-write flags. Profile IDs are immutable definitions within one backend generation.

The Three.js adapter maps profiles to simple Basic/Lambert materials, shares identical profile leases through reference counting, and disposes a material only after its final reference. Geometry is never shared implicitly.

An upsert validates fully, prepares a detached rollbackable mesh, commits ownership and scene state, recomputes visibility, and only then releases a superseded record. A preparation failure cannot create a frame without the existing representation or fallback.

## Visibility and fallback coverage

Residency, visibility, and fallback pinning are separate concepts. A desired child is ready only when both its accepted artifact and current relative transform exist. Until every desired primary is ready, available fallback representations stay visible. Once ready, the child may be shown while its parent remains resident, hidden, and pinned.

An active fallback cannot be removed or evicted. Removing or evicting an active child automatically reveals the available parent under the unchanged visibility plan. These decisions affect presentation only; they do not change world or streaming authority.

## Camera-relative projection

Frame snapshots contain a frame ID/revision, relative camera transform, perspective parameters, and relative representation transforms. Inputs are finite, quaternion-validated, Float32-compatible, and applied with Float32 precision. Astronomical absolute positions never enter `Object3D.position`, Three.js positions are never written back to domain state, and scene nodes are never used to infer gameplay state.

## Remove, eviction, reset, and rebuild

Remove and eviction match exact representation revision/hash expectations, so a stale command cannot delete a newer mesh. Remove is idempotent and leaves a tombstone; eviction releases resources but retains a high-watermark and supports later rehydration using fresh buffers.

Reset releases geometries, final material leases, render targets, buffer references, plans, projection, and prior-generation ledgers, then advances the backend generation. The caller can rebuild the same presentation by replaying fresh artifact buffers followed by projection and visibility commands. Dispose is terminal and idempotent.

## Diagnostics

Read-only snapshots expose accepted/rejected artifact counts, active representations/fallbacks, geometry/material allocations and disposals, estimated owned bytes, replacements, removes, stale rejects, resets, eviction/rehydration data, resource keys, and truthful render-target counts. Estimates cover known accepted buffers and backend-owned targets; they do not claim unknown driver memory.

Diagnostics remain observation. They do not influence gameplay, world residency, streaming, physics, or persistence.

## Deterministic browser evidence

The standalone harness owns a separate 640 x 360 canvas with pixel ratio 1, antialiasing and animation disabled, fixed background/camera, no lights, and explicit rendering. Playwright loads normal `/`, proves `window.TestBridge` is absent, dynamically imports the harness, and exercises parent fallback, child activation, replacement, stale rejection, remove fallback, reset, and replay.

Canvas-only baselines:

- `render-backend-parent-fallback.png`
- `render-backend-child-active.png`
- `render-backend-replacement-active.png`

The associated JSON/Markdown evidence records deterministic status and diagnostic facts. Screenshots prove only this presentation lifecycle; they do not prove world authority or gameplay behavior.

## Explicit limits

There is no `main.ts` integration, automatic context-loss recovery, world/voxel producer, worker transfer path, textures, shader graph, WebGPU, WASM, Shared Memory, or general engine abstraction in V1. The Playwright spec is assigned once to `test:e2e:core`, and Browser Mainline CI selectively restores its three Git LFS snapshot baselines before running that group.

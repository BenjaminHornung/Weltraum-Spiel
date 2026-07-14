# Specification: MeshArtifact Snapshot And Adoption Ownership

## Public factory snapshot

The presentation API SHALL expose `createMeshArtifact` as the normal public
factory. It SHALL make one defensive copy of `positions`, `normals`, `indices`,
and every present optional `uv` and `color` typed array before computing the
content hash. It SHALL copy and freeze metadata, return an immutable
`MeshArtifact` snapshot with `ownership: "SnapshotOwned"`, and SHALL neither
mutate nor detach caller arrays.

### Scenario: caller mutation after factory

- Given valid caller arrays and metadata
- When `createMeshArtifact` returns and the caller mutates positions, indices,
  UV, color, bounds, or material-range input
- Then the artifact arrays, metadata, validation result, and content hash stay
  equal to the pre-mutation snapshot
- And every artifact array has a different backing buffer from its caller array

### Scenario: backend consumes snapshot

- Given a `SnapshotOwned` artifact accepted by the backend
- Then Three.js attributes reference the artifact arrays directly
- And no second backend copy is created
- And the backend never mutates or detaches those arrays

## Explicit trusted adoption

The presentation API SHALL expose a separately named
`adoptMeshArtifactBuffers` factory. It SHALL return
`ownership: "AdoptedExclusive"` and SHALL not copy any mesh buffer. Before a
successful return it SHALL validate that every attribute is a full view over an
exclusive, unshared, non-resizable `ArrayBuffer`, that attributes do not alias,
and that all structural, finite-value, index, material-range, bounds, and hash
checks pass.

### Scenario: adoption moves exact buffers

- Given valid worker-result buffers with independent full fixed views
- When `adoptMeshArtifactBuffers` succeeds
- Then positions, normals, indices, UV, and color have the exact input buffer
  identities
- And the caller is prohibited from mutating, detaching, transferring, or
  reusing those buffers afterward

### Scenario: adoption rejection preserves ownership

- Given a subview, shared/resizable buffer, alias, invalid length, invalid
  index, invalid bounds, or wrong hash
- When `adoptMeshArtifactBuffers` rejects
- Then no buffer is copied, detached, or adopted
- And the caller can still inspect and own every input buffer

## Hash and replay semantics

Ownership mode SHALL NOT participate in `calculateMeshArtifactContentHash` or
the canonical upsert command signature. Equal representation/source/artifact
revision and equal content from a separate snapshot SHALL be `AlreadyApplied`
with `RetainedByCaller` and SHALL not allocate another backend geometry.
Equal revision with different content SHALL remain
`RejectedContentConflict`; lower revisions SHALL remain stale.

## Backend lifecycle

The Three.js adapter SHALL directly reference accepted snapshot or adopted
arrays and SHALL not infer, change, or silently switch ownership mode. Backend
operations SHALL not mutate or detach either mode. Remove, reset, eviction, and
dispose SHALL release backend/GPU references without changing the underlying
buffers. Existing fallback pinning, atomic replacement, generation, and
revision gates SHALL remain unchanged.

## Public exports and documentation

TypeScript exports SHALL contain the `MeshArtifactOwnership` union, the
`SnapshotOwned` and `AdoptedExclusive` literal semantics, and both factory
functions. The lifecycle and world/render boundary documents SHALL state:

```text
Public Factory = immutable defensive snapshot
Trusted Worker Adoption = explicit zero-copy move path
```

No presentation export SHALL expose Three.js types or worker/runtime authority.

# ExecPlan: Browser MeshArtifact Snapshot Ownership And Main Baseline V1

## Goal

Make the public mesh factory safe for ordinary callers without weakening the
trusted worker data-plane contract. Preserve the existing backend lifecycle and
revision gates while making buffer ownership mode explicit.

## Context

The current presentation contract validates full exclusive buffers and the
Three.js adapter binds artifact arrays directly to `BufferAttribute`s. The
current `createMeshArtifact` retains caller arrays by reference, so a caller
mutation changes the artifact and its claimed hash. Existing backend behavior
already provides the desired direct reference from accepted artifact to
Three.js geometry, idempotent replay, conflict/stale rejection, fallback
coverage, reset, remove, eviction, and disposal.

The authoritative source baseline is `69984c5caa9d9414bac1f5d1032fa362988cd899`,
matching the requested expected SHA. The initial pre-worktree fetch exposed a
stale `979f3db6...` value while `.git/FETCH_HEAD` was permission-blocked; the
branch was fast-forwarded to the authoritative `origin/main` before review.
The worker-streaming document is present on this baseline and was read as part
of the contract review. `docs/current-prototype-state.md` remains absent; the
current browser status document is `docs/current-mainline-state.md`.

## Non-goals

- no worker producer or transfer implementation;
- no SharedArrayBuffer or WASM path;
- no changes to `main.ts`, package/lockfiles, `.github/**`, workers,
  streaming, world, runtime, navigation, physics, or roadmap files;
- no second backend copy of artifact buffers;
- no silent adoption based on caller identity, buffer size, or heuristics;
- no weakening of existing revision, fallback, reset, remove, dispose, or
  boundary tests.

## Architecture decision

### Public snapshot path

`createMeshArtifact` validates the supported typed-array kinds, copies
positions, normals, indices, optional UV, and optional color exactly once into
new arrays, copies metadata, computes the content hash from those copied arrays,
and validates the resulting artifact. The returned artifact carries
`ownership: "SnapshotOwned"`. The hash excludes ownership mode and therefore
describes only mesh content and rendering metadata.

The snapshot arrays are full, independent, fixed `ArrayBuffer` views as a
consequence of copying. The semantic immutability boundary is the artifact
contract: callers may mutate their original input arrays, but the snapshot and
its hash remain unchanged. Typed-array elements are not frozen because
JavaScript cannot portably freeze non-empty typed-array elements; accepted
artifact buffers are read-only by ownership contract.

### Explicit worker adoption path

`adoptMeshArtifactBuffers` builds an `AdoptedExclusive` artifact without copying
any mesh buffer. Before returning it, validation requires every attribute to be
a complete view over its own unshared, non-resizable `ArrayBuffer`; all
attributes must have distinct backing buffers; lengths, finite values, index
ranges, material coverage, bounds, and content hash must be valid. Metadata is
still normalized and frozen. The caller retains ownership on rejection and
must treat successful return as a move: no later mutation, detach, transfer, or
reuse.

The two factories are separate exports and neither calls the other. The
artifact ownership field is exported as the closed union
`"SnapshotOwned" | "AdoptedExclusive"`; it is excluded from content and render
command signatures so equal content from separate ownership modes is
`AlreadyApplied`, not a conflict.

### Backend integration

`ThreeRenderBackend` remains ownership-mode agnostic at resource creation: it
references the accepted artifact arrays directly and never copies, mutates, or
detaches them. Existing result ownership outcomes continue to describe the
command transition (`MovedToBackend`, `RetainedByCaller`, etc.); the artifact
field is the source of truth for snapshot versus adoption semantics. Remove,
reset, eviction, and dispose release Three.js references/GPU resources only.

## Implementation phases

1. Add the new change artifacts and record the current baseline/tooling gap.
2. Add ownership mode, one-copy snapshot construction, and explicit validated
   adoption while preserving canonical content hashing.
3. Update focused ownership/replay/backend tests and exports; update the two
   architecture documents.
4. Run focused tests, then Node 22 full unit/build/E2E gates and `git diff --check`.
5. Review the exact-head diff, commit, push, create PR, wait for green exact-head
   CI, merge with the requested merge message, and run final main CI.

## Verification and evidence

Required focused evidence covers snapshot identity/mutation/hash behavior,
optional attributes, metadata, adoption identity/rejection ownership, replay
idempotency across ownership modes, revision conflict, backend non-mutation,
and remove/reset/dispose buffer attachment. Full commands are in
`tests/test-protocol.md`. Every pass/fail/not-run result is recorded there and
in the final report.

## Risks and safe stop

- Including ownership in a signature would turn a valid cross-mode replay into
  a false conflict; add a dedicated test before accepting the change.
- Copying after hashing would leave a mutable caller hash; hash only the
  snapshot arrays.
- Any validation failure after adoption or any array mutation by the backend is
  a stop condition.
- Any changed path outside the user allowlist, failing focused test, failing
  full gate, non-green exact-head CI, or open P0-P2 review finding stops the
  merge flow.

## Progress log

- [x] Baseline and isolated worktree established.
- [x] Existing contract, backend gates, and current-mainline documentation mapped.
- [ ] Snapshot/adoption implementation and focused tests.
- [ ] Full verification, review, PR, exact-head CI, merge, and final main CI.

## Definition of Done

The two public semantics are explicit and tested, the backend lifecycle remains
green without buffer mutation/detach, all requested local gates are fresh under
Node 22, the exact-head PR review and CI are green, the requested merge commit
exists on `main`, and final main CI is green. Remaining limitations are stated.

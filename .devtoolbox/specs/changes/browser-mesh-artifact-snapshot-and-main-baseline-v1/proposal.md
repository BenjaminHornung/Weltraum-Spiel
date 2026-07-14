# Change: Browser MeshArtifact Snapshot Ownership And Main Baseline V1

## Goal

Harden the public browser `MeshArtifact` contract before the first productive
voxel-mesh pipeline: `createMeshArtifact` returns an immutable defensive
snapshot, while trusted worker results use a separately named, validated
zero-copy adoption path.

The authoritative current branch baseline is `origin/main` at
`69984c5caa9d9414bac1f5d1032fa362988cd899` on 2026-07-14, matching the
user-provided expected SHA. The initial pre-worktree fetch output exposed a
stale `979f3db6...` value while `.git/FETCH_HEAD` was permission-blocked; the
branch was fast-forwarded to the authoritative `origin/main` before review.

## Contract

```text
Public createMeshArtifact(input)
  -> one defensive copy of every caller Typed Array
  -> SnapshotOwned immutable MeshArtifact
  -> backend references the snapshot arrays directly

Trusted adoptMeshArtifactBuffers(input)
  -> complete validation of exclusive full fixed ArrayBuffer views
  -> AdoptedExclusive MeshArtifact using the exact input arrays
  -> caller must not reuse, mutate, detach, or transfer accepted buffers
```

The two paths never silently switch. Rejection from the adoption path leaves
all input buffers attached and caller-owned. Ownership mode is explicit in the
exported artifact contract and does not participate in content hashing, so a
separate snapshot with equal revision/content remains an idempotent replay.

## Scope

- `apps/weltraum-browser/src/presentation/**`
- `apps/weltraum-browser/src/render/three/backend/**`
- focused presentation/render-backend unit tests
- the two required architecture documents
- this DevToolbox change directory

No runtime entrypoint, worker implementation, package/lockfile, CI workflow,
world, streaming, physics, navigation, or gameplay code changes.

## Acceptance

- caller arrays are copied once and remain attached by `createMeshArtifact`;
- post-factory caller mutations cannot change artifact data or hash;
- optional UV/color arrays and metadata are snapshot-copied;
- adoption preserves exact buffer identities only after full validation;
- invalid adoption leaves caller ownership untouched;
- backend keeps existing revision, replay, fallback, reset, remove, and dispose
  gates and never mutates or detaches either ownership mode;
- Node 22 TypeScript, unit, build, and all requested E2E groups are fresh;
- exact-head review and green feature CI precede merge, followed by final main
  CI confirmation.

## Tooling exception

The DevToolbox MCP `workspace_prepare_for_agent` rejected this nested isolated
worktree as `unauthorized_path`. Its blocking preflight was not bypassed: the
failure is recorded, no DevToolbox task/execution success is claimed, and the
equivalent spec, task, verification, diff, and completion gates are maintained
manually in this change.

# Tasks: Browser MeshArtifact Snapshot And Main Baseline V1

## Specification and preflight

- [x] 1.1 Record current `origin/main` SHA `69984c5c...` and the initial
     stale `979f3db6...` fetch output/permission condition.
- [x] 1.2 Record the DevToolbox `unauthorized_path` result and equivalent
  manual preflight/test evidence.
- [x] 1.3 Confirm the final diff stays inside the user allowlist.

## Presentation contract

- [x] 2.1 Export `MeshArtifactOwnership` with `SnapshotOwned` and
  `AdoptedExclusive` semantics.
- [x] 2.2 Make `createMeshArtifact` copy all caller arrays once, copy metadata,
  hash copied data, and return a snapshot.
- [x] 2.3 Add `adoptMeshArtifactBuffers` with full pre-adoption validation,
  exact buffer identity, move documentation, and rejection ownership safety.
- [x] 2.4 Keep ownership mode out of content and command signatures.

## Backend and tests

- [x] 3.1 Preserve direct artifact-to-Three.js references without backend copies.
- [x] 3.2 Add snapshot/adoption identity, mutation, hash, invalid-input, and
  attached-buffer tests.
- [x] 3.3 Preserve and extend replay, conflict, replacement, fallback, reset,
  remove, dispose, and backend non-mutation tests.
- [x] 3.4 Verify public exports and boundary constraints.

## Documentation and verification

- [x] 4.1 Update the browser lifecycle document with the two explicit paths.
- [x] 4.2 Update the world/runtime/render boundary document.
- [x] 4.3 Run Node 22/npm, `npm ci`, TypeScript, unit, build, all requested E2E
  groups, complete E2E discovery, and `git diff --check`.
- [ ] 4.4 Review exact-head diff and all P0-P2 findings before PR merge.
- [ ] 4.5 Confirm feature CI, merge commit, and final main CI.

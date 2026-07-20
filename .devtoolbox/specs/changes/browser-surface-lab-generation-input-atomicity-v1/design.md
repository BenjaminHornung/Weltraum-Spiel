# Design: Browser Surface Lab Generation Input Atomicity V1

## Change
`browser-surface-lab-generation-input-atomicity-v1`

## Baseline and boundary
The approved fix is limited to the Surface Lab controller and its focused unit
tests. The controller currently changes authoritative `#seed` and
`#voxelSizeMeters` before `#beginGeneration` admits the replacement. No
WorkerPool, renderer, visual, configuration, package, lockfile, CI, or
unrelated product contract is part of this change.

## Atomic transition contract
For `regenerate` and `setResolution`, the candidate value SHALL be validated
without mutating authoritative state. The generation request SHALL be admitted
before the candidate is committed whenever the existing code supports that
ordering without contract redesign. Successful generation admission is the
authoritative input commit boundary. The synchronous atomicity guarantee covers
pre-admission/setup failures, including synchronous generation/start
exceptions; those failures SHALL not leave a partial commit. A defensive/test-
only rejection of `ticket.result` after admission SHALL preserve the newly
admitted seed/resolution and SHALL surface through the existing generation-
failure/lifecycle semantics without rolling back admitted epochs/jobs. The
implementation SHALL preserve the existing error and lifecycle failure
semantics and SHALL not swallow errors.

When admission does not occur, the prior seed, voxel size, generation/planning
epoch, published artifacts, Brick/Mesh hashes, Ready/Failed/Queue/Running
metrics, cache/presentation mapping, and temporal telemetry consistency SHALL
remain unchanged. A replacement failure SHALL result in the existing
Failed/Stopped behavior, and later input attempts SHALL not mutate state after
that terminal failure.

After successful admission, a valid seed change SHALL make the new seed
authoritative and advance the planning epoch exactly once. A valid resolution
change SHALL make the new resolution authoritative, and generated payload,
physical extent, and telemetry SHALL agree with it. Invalid input SHALL fail
closed without mutation. Existing per-job enqueue-failure accounting and
backend-initialization behavior SHALL remain unchanged. Current production
WorkerPool behavior resolves terminal values; rejected-promise coverage is
defensive only and SHALL not change WorkerPool or public contracts.

## Required proof obligations
The focused controller tests SHALL cover:

- stopped pool plus `regenerate(newSeed)` fails closed without mutation;
- stopped pool plus `setResolution(0.25)` fails closed without mutation;
- replacement failure reaches Failed/Stopped and later input attempts cannot
  mutate state;
- valid regeneration uses the new authoritative seed, advances planning epoch
  exactly `+1`, and uses that seed in the payload;
- valid resolution preserves authoritative resolution and consistent payload,
  extent, and telemetry;
- invalid inputs do not mutate state; and
- synchronous pre-admission/setup failures do not create a half-commit; and
- defensive/test-only post-admission `ticket.result` rejection preserves the
  admitted seed/resolution and admitted epochs/jobs while using existing
  generation-failure/lifecycle semantics.

Existing stability contracts SHALL remain covered and assertions SHALL not be
weakened.

## Verification and acceptance
From `apps/weltraum-browser`, the Node 22 matrix is:

```text
npm ci
npx tsc -p tsconfig.json
npx vitest run tests/unit/surfaceLabController.test.ts --maxWorkers=1
npm run test
npm run build
npm run test:e2e:core
npm run test:e2e:live
npm run test:e2e:ui
npm run test:e2e -- --workers=1 --retries=0
```

Acceptance SHALL show units/core/UI green; live `14/14`; E2E inventory
`30/30` exactly once; Hestia `16/16`; queue/running `0/0`; identical
same-seed hashes; different changed-seed hashes; browser health `0/0/0/0`;
unchanged package/lockfiles; no unintended evidence drift; and passing
`git diff --check`, scope scan, and secret scan.

## Review and publication boundary
The complete handoff SHALL proceed in this order: implementation and focused
tests; full verification; canonical reviewer and reviewer-GLM review with
confirmed findings fixed and fresh verification; pre-publication scope check;
one final Plannotator human gate; normal commit and non-force push on the same
branch; PR body and thread cleanup; then exact-head Codex review and checks.
Human review SHALL occur before commit or push. Merge is forbidden.

The commit subject SHALL be exactly
`#WELTRAUM-000 Preserve Surface Lab generation inputs`. Amend, rebase, squash,
and force-push are forbidden. The PR body SHALL state local Live `14/14`
`workers=2`, CI `workers=1`, `Stability fixes complete`, `Generation Input
Atomicity complete`, and `Visual Fidelity DEFERRED_KNOWN_FAILING`.

Before resolving each of these threads individually, evidence SHALL identify
the fix SHA, path, and test: Chunk Loading Failure, Aggregate Region Mesh
Budget, Retained Snapshot Buffers, Pinned Cache Telemetry, Hestia Unit Timeout,
and Preserve Inputs.

The exact-head Codex comment SHALL contain exactly:

```text
@codex review
Please review the exact current PR head <NEW_HEAD_SHA>.
All prior P1/P2 findings and the generation-input atomicity issue have been addressed. Please perform a fresh exact-head review.
```

Completion SHALL require no exact-head P0/P1/P2 findings, all threads resolved,
green checks, a mergeable PR, an unchanged head, and a clean tree. Merge SHALL
not be performed.

## Risks
- Admission ordering may be constrained by the existing controller contract;
  stop rather than redesign if neither admission-before-commit nor a complete
  invariant-preserving rollback is possible.
- A synchronous exception or rejected promise can expose a half-commit unless
  the commit boundary is proven by focused tests.
- Replacement, publication, metrics, cache/presentation mapping, and telemetry
  can drift independently; the rejection tests must assert their unchanged
  relationship.

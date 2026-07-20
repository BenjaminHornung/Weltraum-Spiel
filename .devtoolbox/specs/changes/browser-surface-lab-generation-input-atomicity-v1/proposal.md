# Proposal: Browser Surface Lab Generation Input Atomicity V1

## Change
`browser-surface-lab-generation-input-atomicity-v1`

## Problem
`regenerate` and `setResolution` currently mutate authoritative `#seed` and
`#voxelSizeMeters` before generation admission through `#beginGeneration`. A
rejected start can therefore leave input state, planning state, published
artifacts, or telemetry describing a generation that was never admitted.

## Approved outcome
Candidate seed and resolution values SHALL be validated locally. Authoritative
state SHALL be committed atomically at successful generation admission.
Admission-before-commit is preferred when the current code supports it without
redesigning the contract. The synchronous atomicity guarantee applies to
pre-admission/setup failures; those failures SHALL not leave a partial commit.
A defensive/test-only rejection of `ticket.result` after admission SHALL keep
the newly admitted seed/resolution authoritative, surface through the existing
generation-failure/lifecycle semantics, and SHALL not roll back admitted
epochs/jobs. Errors SHALL not be swallowed.

Start rejection before admission SHALL preserve the seed, voxel size, planning
epoch, lifecycle failure semantics, published artifacts, Brick/Mesh hashes,
Ready/Failed/Queue/Running metrics, cache/presentation mapping, and temporally
consistent telemetry. Existing per-job enqueue-failure accounting and backend
initialization behavior SHALL remain unchanged. Current production WorkerPool
behavior resolves terminal values; rejected-promise coverage is defensive only
and SHALL not change the WorkerPool or public contracts.

## Scope
- Later product implementation: `apps/weltraum-browser/src/surface-lab/surfaceLabController.ts`.
- Later focused tests: `apps/weltraum-browser/tests/unit/surfaceLabController.test.ts`.
- Two named existing evidence files may change only if strictly necessary.
- Implementation, focused tests, full verification, technical review and fixes,
  pre-publication scope check, final human review, publication, PR cleanup, and
  exact-head review gates are recorded by this change; all task checkboxes
  remain unchecked.

## Non-goals
No `vite.config.ts`, `playwright.config.ts`,
`hestiaSeedDeterminism.test.ts`, package or lockfile, WorkerPool contract,
renderer, visual, CI, unrelated product, test-data, or DevToolbox execution
changes. Merge remains forbidden.

## Publication and exact-head handoff order
The required order is implementation/tests, full verification, canonical and
reviewer-GLM reviews with confirmed fixes, pre-publication scope check, final
Plannotator human review, normal commit and non-force push on the same branch,
PR body and thread cleanup, then an exact-head Codex review and checks. Human
review SHALL occur before commit or push. The commit subject SHALL be exactly
`#WELTRAUM-000 Preserve Surface Lab generation inputs`; amend, rebase, squash,
and force-push are forbidden.

The PR body SHALL state: local Live `14/14` with `workers=2`, CI
`workers=1`, `Stability fixes complete`, `Generation Input Atomicity complete`,
and `Visual Fidelity DEFERRED_KNOWN_FAILING`. Each named review thread SHALL
be supported by individual evidence before resolution: Chunk Loading Failure,
Aggregate Region Mesh Budget, Retained Snapshot Buffers, Pinned Cache
Telemetry, Hestia Unit Timeout, and Preserve Inputs; evidence SHALL include
the fix SHA, path, and test.

The exact-head Codex comment SHALL contain exactly these three lines:

```text
@codex review
Please review the exact current PR head <NEW_HEAD_SHA>.
All prior P1/P2 findings and the generation-input atomicity issue have been addressed. Please perform a fresh exact-head review.
```

The handoff SHALL finish only with no exact-head P0/P1/P2 findings, all
threads resolved, green checks, a mergeable PR, an unchanged head, and a clean
tree. Merge remains explicitly forbidden.

## Approved handoff baseline
`plan_status=approved` and `replan_required=false`. The exact starting head is
`fde7cdc5d3c9ea67401a688663b83f5cb73acff3` on branch
`feature/browser-hestia-microvoxel-surface-lab-v1`. This documentation records
the approved plan and does not reopen planning.

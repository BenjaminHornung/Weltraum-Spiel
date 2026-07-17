# Tasks: Structural Microvoxel Destruction Core V1

All checkboxes intentionally remain open. This handoff writes artifacts only;
it does not create an execution, run verification, toggle tasks, commit, push,
or archive the change. Every implementation slice ends with fresh focused
evidence, and shared files are handled sequentially.

## Phase 0 — Approved-contract and dependency preflight

- [x] Confirm the approved plan source is
      `C:\Users\hornung\.plannotator\plans\agent-c-structural-microvoxel--2026-07-17-approved.md`;
      preserve its scope and keep `replan_required=false` unless a required
      public-contract deviation is found.
- [x] Confirm the only execution worktree is
      `C:\IFI_SourceCode\Temp\WeltraumSpiel\.worktrees\Weltraum-Browser-IFIWELTRAUM-000-structural-microvoxel-destruction-core-v1`.
- [x] Confirm the Adaptive dependency branch is
      `feature/browser-adaptive-microvoxel-authority-v1` at exact SHA
      `5fb372bdba677e43e71566121c53efb5e244b93a`; stop on ref, ancestry,
      dirty-worktree, or competing-change conflict.
- [x] Read all `apps/weltraum-browser/src/voxel/adaptive/**` files named by the
      plan plus the Adaptive authority document and Adaptive design/spec/test
      protocol; verify no missing public field or proof contract.
- [x] Confirm the exclusive allowlist and forbidden paths; explicitly verify
      that no change under `adaptive/**`, package/lock/Vite/Playwright,
      `src/voxel/index.ts`, `main.ts`, workers, streaming, Surface Lab, World
      Generation, `.github/**`, or `infra/**` is planned.
- [x] Resolve Node exactly as `v22.23.1` before product implementation.
- [x] From `apps/weltraum-browser`, run `npm ci` without changing package or
      lock files, `npx tsc -p tsconfig.json`, and the three Adaptive tests with
      `--maxWorkers=1`:
      `tests/unit/adaptiveMicrovoxelContracts.test.ts`,
      `tests/unit/adaptiveMicrovoxelMaterialization.test.ts`,
      `tests/unit/adaptiveMicrovoxelPlanner.test.ts`.
- [x] Stop before Structural product implementation if Node, typecheck, or
      any Adaptive test fails or times out; report the inherited Adaptive
      default-parallel timeout risk without masking or changing it.

## Slice 1 — Spec and dependency gate

- [x] Keep these five artifacts consistent with the approved plan and validate
      them through the controller's DevToolbox flow; do not create an execution
      during this handoff.
- [x] After controller authorization, create exactly one DevToolbox change and
      exactly one execution for the complete Structural change, never one per
      slice; keep both active and unarchived.

## Slice 2 — Authority-bound contracts

- [x] Implement `types.ts`, `validation.ts`, `coordinates.ts`,
      `canonical.ts`, and the first Structural `index.ts` under
      `apps/weltraum-browser/src/voxel/structural/`.
- [x] Implement the exact V1 public Object/Brick/Command/Result/Material/
      Frame/Shape/Budget/Component/Mass/Mesh contracts, direct Adaptive reuse,
      canonical IDs/hashes, exact validation, and defensive recursive freeze.
- [x] Add focused contracts coverage for Adaptive reuse, Level-4/16-cubed/
      0.125 m semantics, materials, frames, source binding, copy/freeze, and
      forbidden API/authority invariants.
- [x] Run fresh focused contracts/typecheck evidence before continuing.

## Slice 3 — Sparse model and Adaptive ingest

- [x] Implement `model.ts` and the persistence foundation.
- [x] Implement sparse present-brick/known-Air versus missing-brick/unknown
      semantics, material definitions, immutable `StructuralObject`, source
      provenance binding, Descriptor/Journal/Snapshot/Proof validation, and
      binary Adaptive ingest with fractional occupancy rejection.
- [x] Add focused tests for invalid level/fraction/proof/material, stale or
      foreign source, caller mutation, and recursive freeze.
- [x] Run fresh focused model/provenance/persistence evidence before continuing.

## Slice 4 — Command transaction

- [x] Implement `commands.ts` with exactly `SubtractSphere`, `SubtractBox`,
      `SetMaterialSphere`, and `SetMaterialBox`.
- [x] Implement exact doubled-integer sphere selection, half-open boxes,
      integer frame translation, CAS, duplicate IDs, destructible/material
      filters, `NoChange` revision/hash semantics, evidence, and explicit
      deterministic budgets.
- [x] Implement atomic candidate computation and state-unchanged rejection
      evidence for CAS, duplicate, coverage, proof, validation, overflow, and
      budget failures.
- [x] Run the focused command unit file and fresh typecheck evidence.

## Slice 5 — Connectivity and Component facts

- [x] Implement `connectivity.ts` with deterministic six-neighbor traversal,
      canonical input ordering, anchored/detached classification, persistent
      inactive Anchor/Joint facts, and revision-bound Component IDs.
- [x] Add split, ordering, Joint non-connectivity, Air endpoint deactivate/
      reactivate, `NoChange` ID, and A-B-A tests.
- [x] Run fresh connectivity evidence before continuing.

## Slice 6 — Mass properties

- [x] Implement `massProperties.ts` for cell mass, aggregate/Component mass,
      AABB, COM, full symmetric inertia tensor, empty semantics, finite and
      symmetry guards.
- [x] Add analytical single-/multi-cell fixtures, removed-mass difference,
      COM-in-AABB, and invalid/overflow tests.
- [x] Run fresh mass-property evidence before continuing.

## Slice 7 — Greedy mesh and persistence completion

- [x] Implement `greedyMesher.ts` and finish `persistence.ts` plus the final
      Structural barrel; do not re-export through `src/voxel/index.ts`.
- [x] Implement deterministic face culling/merging, material/metadata merge
      boundaries, explicit-neighbor fail-closed behavior, mesh budgets,
      revision/content/algorithm binding, canonical material ranges, and
      frozen plain-number arrays.
- [x] Add round-trip, proof/provenance/hash revalidation, A-B-A, and mesh-unit
      coverage. Never derive mass from mesh or create a second journal.
- [x] Run fresh focused Structural unit files and typecheck evidence.

## Slice 8 — Browser proof, docs, and evidence

- [x] Add only the approved E2E spec, evidence files, and public Structural
      document in the allowlist.
- [x] Load the normal `/` route and dynamically import
      `/src/voxel/structural/index.ts` analogously to the Adaptive proof,
      without TestBridge authority; assert `window.TestBridge` is absent both
      as an own property and via `in`.
- [x] Prove the deterministic Level-4 fixture: material 1 at density 512,
      anchored 8x8 base at `z=0`, single-cell neck at `(8,8,z=1..3)`, 3x3x2
      upper structure from `z=4`, and sphere subtract at `(8,8,2)` radius 1
      producing the expected anchored and detached Components.
- [x] Write timestamp-free JSON/Markdown evidence only; make no renderer,
      runtime, physics, gameplay, or integration claim.

## Slice 9 — Review, fresh verification, and completion gates

- [x] Dispatch the canonical `reviewer` for contract correctness, Adaptive
      reuse, CAS/atomicity, duplicate/NoChange, hashes/freeze, connectivity,
      mass/tensor, mesh/neighbor, persistence, and scope.
- [x] Dispatch independent `reviewer-glm` for the approved public-contract,
      rollback/data-loss, and explicit second-review risk; resolve only
      confirmed in-scope findings.
- [x] Rerun affected reviews and all relevant focused checks freshly after any
      fix; do not suppress or reinterpret failures.
- [x] Run the exact serial dependency regression, Structural focused units,
      full suite, build, targeted browser E2E twice, deterministic evidence
      hash comparison, browser health `0/0/0/0`, API/authority scans,
      bounded no-echo secret scan, changed-path allowlist, forbidden-path
      null-diff, and `git diff --check` gates from `tests/test-protocol.md`.
- [x] Treat default-parallel full-suite execution as diagnostic only after the
      serial gate; do not change timeout values, tests, or assertions to mask
      the inherited Adaptive contention risk.
- [x] Use the single DevToolbox execution for verify, evidence notes, and
      Completion Preflight; toggle no task without fresh evidence and a
      successful preflight.
- [x] After all tasks have evidence, open exactly one `plannotator_final_review`
      for the Structural worktree root only. If human feedback requests
      changes, implement only confirmed in-scope fixes, rerun affected review
      and verification, and reopen the affected final review.

## Authorized release actions (not authorized in this handoff)

- [ ] After clean human approval and separate authorization, stage only
      allowlisted files and create exactly one commit:
      `#WELTRAUM-000 Add structural microvoxel destruction core`.
- [ ] Verify the commit has direct parent
      `5fb372bdba677e43e71566121c53efb5e244b93a` and exactly one commit in
      the compare range; do not amend or rebase.
- [ ] Recheck the dependency remote, then perform only a non-force push to
      `origin/feature/browser-structural-microvoxel-destruction-core-v1` and
      verify remote SHA equals local HEAD. Never force-push, create a PR,
      merge, deploy, or archive.

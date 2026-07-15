# Tasks: Browser Planet Shell Tile Scheduler V1

> Each checked task requires a DevToolbox execution, run-end notes, task-specific verification, completion preflight, review where specified, and a clean task-sized commit only when commit ownership is explicitly approved.

- [x] 1. Implement canonical cube-sphere identity and tile topology
  - Objective: deliver validated renderer-independent face transforms, stable PlanetTile IDs, canonical ordering, quadtree relations, and same-level neighbors.
  - Files/search targets: `src/planet/{types,ids,canonical,cubeSphere,tileAddress,tileTree,tileNeighbors,index}.ts`; `tests/unit/planetCubeSphere.test.ts`, `planetTileAddress.test.ts`, `planetTileNeighbors.test.ts`; consult existing `src/core/vector.ts` only for reusable plain vector conventions.
  - Acceptance: all face/edge/corner roundtrips and ties pass; no NaNs; outward winding; valid parent/children/siblings; all 24 directed face edges and reciprocity pass; IDs ignore readiness/renderer/floating origin; canonical results ignore insertion order; no Three/presentation import or Math.random in core.
  - Guidance: implement the design's fixed face bases and virtual-cell cross-face mapping; validate public inputs; avoid lookup state coupled to runtime order.
  - Required skills/MCPs: subagent-driven-development; frontend-worker; DevToolbox execution lifecycle.
  - Verification: `npx tsc -p tsconfig.json`; `npx vitest run tests/unit/planetCubeSphere.test.ts tests/unit/planetTileAddress.test.ts tests/unit/planetTileNeighbors.test.ts`.
  - Report: files changed, exported contracts, tie/neighbor rules, commands and results, residual risks.
  - Stop: stop on ambiguous face mapping, non-reciprocal edge mapping, boundary import, or failing focused test; do not broaden scope.

- [x] 2. Implement conservative bounds, SSE, frustum, and horizon culling
  - Objective: provide finite body-centered bounds and conservative, explainable visibility metrics.
  - Files/search targets: `src/planet/{tileBounds,screenSpaceError,frustumCulling,horizonCulling}.ts`; `tests/unit/planetTileBounds.test.ts`, `planetHorizonCulling.test.ts`, optional `planetFrustumCulling.test.ts`.
  - Acceptance: sampled tile shell is contained; SSE is finite/monotonic and exact tie remains unsplit; tangent frustum bounds remain; visible front tiles remain; proven back tiles cull; surface/near/far/tangent/height-margin/inside-body cases pass.
  - Guidance: prefer conservative retention over false cull; use explicit tolerances and reason codes; keep all values body-relative doubles.
  - Required skills/MCPs: subagent-driven-development; frontend-worker; DevToolbox execution lifecycle.
  - Verification: `npx tsc -p tsconfig.json`; focused bounds/horizon/frustum Vitest files.
  - Report: formulas/tolerances, fixtures, commands/results, any over-retention risk.
  - Stop: stop if a front/tangent fixture culls, bound containment fails, or non-finite output appears.

- [x] 3. Implement readiness, deterministic selector, and parent fallback
  - Objective: produce deterministic budgeted desired coverage, explicit core-owned load intent, and hole-free atomic handoff.
  - Files/search targets: `src/planet/{tileReadiness,tileSelector,tileVisibilityPlan}.ts`; `tests/unit/planetTileSelector.test.ts`, `planetTileFallback.test.ts`; read existing presentation VisibilityPlan contract for adapter compatibility but do not import it into core.
  - Acceptance: output has primary/fallback/culled/loadRequests/reasons/revisions/coverageStatus; `loadRequests` is the only request authority and each item contains `{ tileKey, reason, priority, requiredForCoverage, expectedReadinessRevision }`; every non-ready desired primary/fallback emits one deduplicated mandatory request; missing roots use `root-coverage-required` at highest coverage priority; child refinement uses normal reasons with `requiredForCoverage=false`; optional request budget never drops mandatory coverage requests; request order is priority/reason/stable ID; `coverageStatus` is exactly `READY` or `NOT_READY`; exact priority/canonical sorting and hard frontier budgets hold; same input and reordered readiness entries give deep-equal output; stale revision is rejected; missing/failed/partial children retain parent; complete children hide parent only when atomic replacement fits; eviction reactivates parent; budget below visible roots returns typed no-plan; sparse arrays reject with domain errors; exported validation authorities are frozen.
  - Guidance: replace/subsume `requestedChildren` rather than creating duplicate request lists; validate revisions/dense arrays before traversal; use stable comparator for queue/output/requests; maintain budget-aware desired coverage; reserve fallback for incomplete readiness and retain budget-deferred parents; apply `maxRequestedChildren` only to optional refinement requests; never treat missing coverage as ready or create empty placeholder geometry.
  - Required skills/MCPs: subagent-driven-development; frontend-worker; DevToolbox execution lifecycle.
  - Verification: `npx tsc -p tsconfig.json`; focused selector/fallback Vitest files including generic missing-root requests, mandatory-vs-optional request budgets, dedupe/order/revision, READY/NOT_READY coverage, all-ready level-one/level-two budgets, insufficient-root-budget rejection, sparse arrays, frozen authorities, partial cull, all-four-children-culled safe hide, and eviction reactivation.
  - Report: snapshot/output/request schema, priority/budget semantics, coverage-status and fallback transition tables, commands/results.
  - Stop: stop on any hole, missing mandatory load request, duplicate request authority, stale partial result, order-dependent selection/request, budget overflow, or unavailable coverage reported READY.

- [x] 4. Implement shell mesh generation and the single presentation adapter
  - Objective: create deterministic simple tile meshes and translate core-owned load intent and desired coverage through existing MeshArtifact/VisibilityPlan contracts in exactly one adapter.
  - Files/search targets: `src/planet/shellMeshGenerator.ts`, `planetPresentationAdapter.ts`, exports in `index.ts`; `tests/unit/planetShellMesh.test.ts`, `planetPresentationAdapter.test.ts`; read existing `src/presentation/meshArtifact.ts` and `visibilityPlan.ts` without modifying them.
  - Acceptance: PlanetHeightSampler exists; regular grid has finite Float32 relative vertices/normals and stable valid indices/winding/bounds; double authority remains outside buffers; equal input yields stable artifact hash; only adapter imports presentation; adapter maps only resident revision-compatible `core primary ∪ fallback` to presentation visible, always emits empty presentation fallback, maps requested/nonresident tiles to no visible slot, translates exactly explicit `loadRequests` to jobs, and infers no loads; all-fallback/request-budget-zero and mixed branches remain hole-free through existing resolver; backend/presentation source unchanged.
  - Guidance: use existing artifact factories/hash semantics; implement flatten coverage mapping, not primary-to-visible/fallback-to-presentation-fallback; keep visual scale out of authority; no empty root tile, final Hestia geology, or seam system.
  - Required skills/MCPs: subagent-driven-development; frontend-worker; DevToolbox execution lifecycle.
  - Verification: `npx tsc -p tsconfig.json`; `npx vitest run tests/unit/planetShellMesh.test.ts tests/unit/planetPresentationAdapter.test.ts`; focused existing MeshArtifact/VisibilityPlan regressions, including empty-primary/all-core-fallback and mixed-branch cases.
  - Report: buffer layout/origin, adapter visibility/load mappings, deterministic hash and no-inferred-load evidence, commands/results.
  - Stop: stop if adapter requires presentation/backend edits, infers loads, uses presentation fallback for core active coverage, exposes nonresident tiles as visible, mesh is non-finite, or hash is unstable.

- [x] 5. Implement separate Hestia orbit harness, browser spec, screenshots, and architecture note
  - Objective: visibly demonstrate LOD, horizon culling, readiness fallback/handoff, and eviction without main.ts/TestBridge/product-core changes.
  - Files/search targets: `src/planet/harness/**`; `tests/e2e/planet-shell-tile-scheduler.spec.ts`; snapshot/evidence allowlist; `docs/browser-mainline/planet-shell-tile-scheduler-v1.md`; reuse existing normal-route health-listener and dynamic Vite import patterns.
  - Acceptance: normal `/` loads and TestBridge is absent; separate harness mounts canvas; fixed far/near/fallback/ready/evicted states expose deterministic IDs/reasons; three exact screenshot names exist; repeat is deterministic; no console/page/request/HTTP errors; no local voxel region.
  - Guidance: use explicit harness controller methods and readiness snapshots; visual scale only in render transforms; use existing renderer/backend and the single adapter; run a read-only ui-designer clarity check before implementation.
  - Required skills/MCPs: ui-designer, frontend-worker, browser-debugger, playwright, DevToolbox execution lifecycle.
  - Verification: generate baselines once with focused Playwright update mode, then `npm run test:e2e -- tests/e2e/planet-shell-tile-scheduler.spec.ts` without updates; browser-debugger inspects states/health; `npx tsc -p tsconfig.json`.
  - Report: harness import/mount path, state transition evidence, screenshots, browser-health results, commands/results.
  - Stop: stop on TestBridge/main/style/package edits, browser errors, nondeterministic screenshot/selection, or need for new dependency.

- [x] 6. Complete dual review, allowlist audit, and initial full regression
  - Objective: establish fresh release-quality evidence while keeping the initial branch PR-free.
  - Files/search targets: complete branch diff; all change artifacts and evidence; initial allowlist and prohibited paths.
  - Acceptance: spec-compliance review passes; reviewer and reviewer-glm findings are resolved or explicitly accepted; exact initial command matrix passes; prohibited files remain untouched; DevToolbox validation/tasks/evidence are current.
  - Guidance: findings first by severity/file; route fixes back to owning task/lane and rerun focused verification; do not commit/push until user confirms final area summary.
  - Required skills/MCPs: requesting-code-review, devtoolbox-review, verification-before-completion, reviewer, reviewer-glm, test-runner, browser-debugger.
  - Verification: `npm ci`; `npx tsc -p tsconfig.json`; `npm run test -- tests/unit/planet*.test.ts`; focused E2E; `npm run test`; `npm run build`; `git diff --check`; bundled Git status/diff/allowlist audit.
  - Report: per-area changes, review findings/resolution, every command/result, screenshots, changed paths, skipped checks, residual risk, starting/final main SHA.
  - Stop: do not push on any failure, unresolved concrete finding, prohibited-path edit, or missing evidence; do not create a PR.

- [x] 7. Prevent partial Planet Presentation coverage publication
  - Objective: replace unconditional filtered VisibilityPlan publication with a stateless discriminated publish/hold decision so callers never replace complete coverage with an empty or partial plan.
  - Files/search targets: `src/planet/planetPresentationAdapter.ts`, `src/planet/harness/hestiaOrbitHarness.ts`, `tests/unit/planetPresentationAdapter.test.ts`, `docs/browser-mainline/planet-shell-tile-scheduler-v1.md`; this change's design/spec/tasks/test protocol; inspect but do not modify the existing E2E spec and three baselines unless a concrete failing requirement proves otherwise.
  - Acceptance: publish requires exact readiness revision, `READY`, and every unique active primary/fallback key render-ready; published coverage is complete and flattened exactly once with empty presentation fallback; hold returns no VisibilityPlan, unchanged exact load jobs, deterministic missing active IDs, and a closed reason for revision mismatch, `NOT_READY`, or missing active readiness; adapter remains stateless; stale/missing/inconsistent cases never partially publish; every harness fixture explicitly checks publish before applying; no impostor is added.
  - Guidance: derive one canonical active-key set; evaluate fail-closed gates before constructing VisibilityPlan; on revision mismatch report all active keys as unverified; keep caller ownership of the last complete plan explicit; do not add previous-plan input or global state.
  - Required skills/MCPs: subagent-driven-development; frontend-worker; requesting-code-review; devtoolbox-review; verification-before-completion; test-runner; browser-debugger; DevToolbox execution lifecycle.
  - Verification: `npm ci`; `npx tsc -p tsconfig.json`; `npx vitest run tests/unit/planetPresentationAdapter.test.ts`; `npm run test -- tests/unit/planet*.test.ts`; `npm run test`; `npm run build`; focused planet-shell E2E without snapshot update; `git diff --check`; independent spec/architecture and code reviews; exact allowlist/prohibited-path and unchanged-baseline hash audits.
  - Report: exact discriminated contract/reason codes, files changed, every command/result, review findings/resolution, baseline hashes, allowlist result, residual risks, final commit and branch-vs-main divergence.
  - Stop: do not commit/push on any failed command, unresolved finding, partial/empty publication, load-job drift, hidden adapter state, changed prohibited path/baseline, weakened assertion/timeout, or need for Presentation/Render/package/CI changes.

## Deferred Surface-Lab merge gate

After the Hestia Microvoxel Surface Lab is actually merged to origin/main, fetch and merge (not rebase) origin/main, resolve bounded conflicts, optionally add exactly one test:e2e:core assignment and necessary LFS baseline validation, rerun focused/full verification and dual review, then request explicit approval before push/PR. PR title: `#WELTRAUM-000 Add planet shell tile scheduler`. No automatic merge.
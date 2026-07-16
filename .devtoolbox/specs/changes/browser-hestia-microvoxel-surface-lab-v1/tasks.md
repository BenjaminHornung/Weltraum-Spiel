# Tasks: Browser Hestia Microvoxel Surface Lab V1

## Phase 1 — Audited contracts

- [x] 1.1 Create the dated Hestia visual-target audit
  - Objective: Persist the already verified concept guidance before runtime implementation.
  - Files: docs/design-audits/2026-07-14-hestia-surface-lab-visual-target.md; read-only references under docs/UI-Screenshots and the three scoped concept/audit docs.
  - Acceptance: Records palette, landforms, vegetation density, fog/visibility, water/wetness, low-poly silhouettes, UI density, excluded elements, actual image-40 filename, and concept-art-not-runtime-evidence warning.
  - Guidance: Do not edit or embed concept PNGs; use image 38 as atmosphere and image 36 as landform/water guidance; exclude ships, scanner, missions, outposts and megacities.
  - Skills/MCPs: subagent-driven-development; worker lane; DevToolbox execution tracking.
  - Verification: markdown path/link check, PNG signatures, git diff confirms only the audit/spec artifacts.
  - Report: changed file, references genuinely viewed, exclusions, verification result.
  - Stop: do not start product code until this audit is verified.

## Phase 2 — Canonical world products

- [x] 2.1 Implement the neutral VoxelBrick V1 contract
  - Objective: Add renderer-independent IDs, layouts, indexing, apron/global-coordinate mapping, material registry and canonical hashing.
  - Files: apps/weltraum-browser/src/voxel/ids.ts, types.ts, brick.ts, channels.ts, density.ts, materials.ts, canonical.ts, index.ts; tests/unit/voxelBrick.test.ts, voxelNeighborSamples.test.ts, voxelMaterials.test.ts.
  - Acceptance: 32x64x32 cells, cell+3 samples, X-fastest indexing, Float32 density, Uint8 material, strict finite/layout/revision checks, byte-identical overlap, no Three.js/Presentation imports.
  - Guidance: Use branded stable IDs and explicit failure results; no silent normalization of invalid values.
  - Skills/MCPs: subagent-driven-development; frontend-worker; verification-before-completion.
  - Verification: npx vitest run the three tests; npx tsc -p tsconfig.json; scoped forbidden-import/random scan.
  - Report: contracts, memory sizes, tests, changed files, blockers.
  - Stop: do not implement generator or mesher if contract tests fail.

- [x] 2.2 Implement deterministic Hestia generation and scatter
  - Objective: Produce versioned density/material samples and reconstructable vegetation placements from canonical inputs.
  - Files: apps/weltraum-browser/src/world-generation/hestia/seed.ts, noise.ts, densityGenerator.ts, materialClassifier.ts, scatterGenerator.ts, preset.ts, index.ts; tests/unit/hestiaDensityGenerator.test.ts, hestiaSeedDeterminism.test.ts, hestiaScatterGenerator.test.ts.
  - Acceptance: required field layers and material classes exist; same input hashes match; changed seed differs; 0.25/0.50 are distinct; no Math.random, Date.now generator input, Three.js or load-order input.
  - Guidance: Label all sub-seed domains and version algorithms; keep water and scatter non-authoritative presentation data.
  - Skills/MCPs: subagent-driven-development; frontend-worker; verification-before-completion.
  - Verification: focused Vitest, tsc, forbidden-input/import scan.
  - Report: layer equations/ranges, seed hierarchy, material rules, tests, files.
  - Stop: do not tune visuals by nondeterministic or camera-dependent values.

- [x] 2.3 Implement Surface Nets V1 and seam ownership
  - Objective: Convert validated bricks to deterministic faceted multi-material VoxelMeshProducts.
  - Files: apps/weltraum-browser/src/voxel/surfaceNets.ts and neutral type/canonical exports; tests/unit/voxelSurfaceNets.test.ts and neighbor seam extensions.
  - Acceptance: finite geometry, valid indices/bounds, empty/full handling, complete material ranges, stable hashes, exact neighbor border positions, fail-closed missing-neighbor behavior, lower density than cube-per-voxel.
  - Guidance: deterministic edge order, one face owner, fixed triangulation, duplicated triangle vertices with face normals.
  - Skills/MCPs: subagent-driven-development; frontend-worker; verification-before-completion.
  - Verification: focused mesher/seam tests and tsc.
  - Report: ownership rule, geometry counts, tests, files, risks.
  - Stop: do not add LOD, Transvoxel, octree or QEF.

## Phase 3 — Worker and presentation handoff

- [x] 3.1 Extend the existing worker/streaming/telemetry spine
  - Objective: Execute GenerateHestiaVoxelBrickMesh in the real WorkerPool with transfer, stale, cancellation, cache and budget discipline.
  - Files/search targets: src/workers/protocol.ts, streamingWorker.ts, workerPool.ts, resultGate.ts; required src/streaming and src/diagnostics/performance modules; existing tests plus tests/unit/voxelWorkerProtocol.test.ts.
  - Acceptance: existing TransformBuffer unchanged; multi-buffer layout validated; planning/worker epochs, revisions, versions, hashes and <=16 MiB chunk budget enforced; cancellation publishes no mesh; cache only accepts validated data; telemetry remains read-only.
  - Guidance: no second pool; bounded checkpoints; no structured large copies; separate canonical and derived authority.
  - Skills/MCPs: subagent-driven-development; frontend-worker; systematic-debugging on failures; verification-before-completion.
  - Verification: focused worker/pool/gate/cache/telemetry Vitest and tsc.
  - Report: protocol fields, transfer ownership, stale/cancel evidence, tests, files.
  - Stop: do not route malformed/stale data to consumer or cache.

- [x] 3.2 Implement the isolated MeshArtifact adapter
  - Objective: Convert neutral products through safe snapshot or validated exclusive adoption without modifying Presentation/backend contracts.
  - Files: apps/weltraum-browser/src/voxel/meshArtifactAdapter.ts and a focused unit test.
  - Acceptance: valid revisions, frame, profiles, ranges, bounds and hash; caller/cache data not mutated; direct exclusive worker buffers may be adopted; both strategies preserve topology and canonical mesh hash.
  - Guidance: this is the only Voxel/Surface-Lab file allowed to know MeshArtifact ownership APIs.
  - Skills/MCPs: subagent-driven-development; frontend-worker; verification-before-completion.
  - Verification: adapter tests, existing mesh artifact/backend tests, tsc.
  - Report: strategy rule, ownership evidence, tests, files.
  - Stop: no Presentation/backend source or ownership-doc edits.

## Phase 4 — Live lab

- [x] 4.1 Implement Surface Lab frame chain, controller and lifecycle
  - Objective: Coordinate the real Hestia frame chain and exactly 16 existing-pool jobs with content-addressed neutral identity, monotone Presentation publication revisions, canonical cache use, lifecycle-safe replacement and truthful telemetry.
  - Files/search targets: src/surface-lab/*; narrow src/main.ts gate; src/voxel/canonical.ts, surfaceNets.ts, meshArtifactAdapter.ts; focused src/workers/protocol.ts validation order; tests/unit/surfaceLabController.test.ts, voxelMeshArtifactAdapter.test.ts, voxelSurfaceNets.test.ts, voxelWorkerProtocol.test.ts and narrow existing backend/WorkerPool harness reuse.
  - Acceptance: spatial WorkerJob target remains request-known; representation key uses validated brick content plus mesher version; neutral V1 artifactRevision stays zero; adapter optionally maps monotone plan/output revision to Presentation artifactRevision; every generation removes prior publications then republishes at a higher revision; same input stable key/hash, changed input fresh key, A-B-A revisit accepted by real backend; exact surfaceLab=1; real frame/time; 16 actual tickets; no mixed generations; invalid seed/cache prevalidation; stale/cancel/restart/dispose/partial failure settle; Generate-only accepted-buffer adoption, Cached/unproven snapshot, empty no artifact; actual cache and hash telemetry.
  - Guidance: reuse existing WorkerPool/cache/bundle/assert seed/adapter/backend ledger; explicit regenerate bypasses cache reads; corrupt cache degrades to Generate miss; requestedChunks starts zero; DOM/telemetry are read-only.
  - Skills/MCPs: subagent-driven-development; frontend-worker; systematic-debugging on failures; verification-before-completion; devtoolbox specs/execution.
  - Allowed side effects: focused adapter revision seam, Surface Lab lifecycle/telemetry/query, canonical/Surface Nets call sites and protocol validation order already approved, associated tests and test-only real backend/WorkerPool harness reuse; no install/services/browser/commit/cleanup.
  - Forbidden: no Presentation core/backend, WorkerPool, resultGate, streamingWorker, streaming/cache implementation, Planner, Executor, FlightController, Task 4.2 visuals/style, TestBridge, package/lock/config changes or second pool/cache.
  - Verification: adapter revision invariants; same-input/seed/resolution/A-B-A real-ledger transitions; one-failure clear-first; Generate adoption vs Cached snapshot; cache integrity/fallback; request telemetry; replace/dispose race; executable query including 01; focused worker/cache/backend regressions; strict tsc; Vite; full suite if bounded; diff/whitespace/import/scope audits.
  - Report: lifecycle/epoch and publication revisions, canonical identity, frame/time, cache/ownership, commands/exits/counts, scope, Node/toolchain and remaining risk.
  - Stop: stop/replan if Presentation core/backend, WorkerPool/resultGate/streaming implementation or neutral V1 revision semantics must change; no visuals before deterministic readiness.

- [x] 4.2 Implement camera, environment, vegetation and visible HUD
  - Objective: Make the generated terrain technically inspectable through the real browser while preserving canonical pipeline authority; visual fidelity is deferred.
  - Files: src/surface-lab/surfaceLabCamera.ts, surfaceLabEnvironment.ts, surfaceLabHud.ts and required surface-lab modules; narrow src/style.css; focused DOM/camera tests.
  - Acceptance: full-screen backend canvas; orbit/fly/WASD/mouse/reset; fog/water/lights/scatter as separate presentation; wireframe/boundaries/fog/vegetation controls; all required telemetry and warnings visible; center view unobstructed; camera/environment commands fail closed after disposal; camera and overlays do not change canonical hashes.
  - Guidance: terrain only via MeshArtifact; no concept image at runtime; no fake gameplay; retained screenshots are technical evidence only. Preserve the independent finding that visual fidelity is currently too dark/indistinct and deferred to `browser-hestia-surface-lab-visual-fidelity-v1`.
  - Skills/MCPs: subagent-driven-development; frontend-worker; verification-before-completion; DevToolbox execution tracking.
  - Verification: focused unit/DOM tests, strict TypeScript slice, build, real-browser control/hash/settlement smoke, exact screenshot dimensions and console/network inventory.
  - Report: controls, telemetry fields, tests, files, browser evidence, accepted visual debt and measured caveats.
  - Stop: do not claim concept or visual-fidelity acceptance; stop on a functional browser, lifecycle or canonical-hash failure.

## Phase 5 — Evidence and release gates

- [x] 5.1 Add live E2E, CI assignment and evidence
  - Objective: Prove deterministic browser behavior and capture exact evidence without TestBridge.
  - Files: tests/e2e/hestia-microvoxel-surface-lab.spec.ts; package.json live-group token only; evidence/browser-hestia-microvoxel-surface-lab-v1-summary.json, .md, and three hestia-surface-lab PNGs; mirrored run notes/logs under the change tests/task-5.1-live folder; workflow only if current LFS policy requires it.
  - Acceptance: no console/page/request/HTTP errors; no TestBridge; 16/16 and settled queue; same seed same hashes; changed seed different hashes; toggles/camera/quarter-meter extent; screenshots 1920x1080; spec assigned exactly once; no dependency/lockfile changes.
  - Guidance: visible DOM/data attributes are read-only observability; regenerate bypasses cache; report measured timings/counts/bytes without unsupported claims.
  - Skills/MCPs: subagent-driven-development; frontend-worker; browser-debugger for evidence; test-runner; verification-before-completion.
  - Verification: focused live spec, CI inventory logic, evidence schema/LFS checks, technical screenshot dimensions/content check.
  - Report: E2E outcomes, technical screenshots, hashes, performance sample, files, visual deferral and limitations.
  - Stop: no pipeline-baseline-ready claim with missing technical screenshot, nondeterministic hash, unsettled work or open browser error; no visual-fidelity claim.

- [x] 5.2 Complete dual review and full Node 22 verification
  - Objective: Close all correctness, regression, ownership, seam, lifecycle and pipeline-test findings before the baseline commit hold point; visual fidelity remains a separate change.
  - Files: all changed files; no scope expansion without explicit replan.
  - Acceptance: reviewer and reviewer-glm have no open pipeline/correctness P0-P2; npm ci, tsc, unit, build, core/live/ui/full E2E and git diff --check pass under Node 22; forbidden changes absent; visual FAIL/deferment is documented and not misreported.
  - Guidance: findings first; dispatch fixes to the owning implementation lane; rerun focused review and fresh verification.
  - Skills/MCPs: requesting-code-review; devtoolbox-review; maintainability-decay-review; verification-before-completion; test-runner.
  - Verification: full approved command matrix under Node 22 plus final git status/diff audit.
  - Report: findings/fixes, commands, counts, deterministic evidence, deferred visual risk, remaining risk and baseline readiness.
  - Stop: wait for explicit user confirmation before commit, push, PR or merge.

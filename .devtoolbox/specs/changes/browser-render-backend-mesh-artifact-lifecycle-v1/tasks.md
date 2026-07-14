# Tasks: Browser Render Backend Mesh Artifact Lifecycle V1

## 1. Specification and boundary

- [x] 1.1 Finalize proposal, ExecPlan/design, normative spec, test protocol, and browser architecture note.
- [x] 1.2 Confirm every intended edit is allowlisted and every prohibited domain/package/entrypoint path remains untouched.
- [x] 1.3 Record the user-authorized DevToolbox service exception and retain manual spec/task/evidence discipline.

## 2. Presentation contracts

- [x] 2.1 Add branded stable IDs, backend/source/artifact/frame/visibility revisions, result statuses, ownership outcomes, and immutable helpers.
- [x] 2.2 Add the V1 mesh artifact, optional UV/color attributes, material ranges, bounds, and exact move-semantics ownership documentation.
- [x] 2.3 Add canonical binary serialization/hash and command signatures with deterministic set ordering.
- [x] 2.4 Add strict artifact, buffer-layout, material-profile, visibility-plan, frame-projection, command, generation, and revision validation.
- [x] 2.5 Add immutable initialize/upsert/remove/evict/visibility/projection/reset/dispose commands and the backend-neutral interface/public index.

## 3. Three.js backend

- [x] 3.1 Add direct Typed-Array BufferGeometry creation, groups/bounds, and rollback-safe mesh preparation.
- [x] 3.2 Add V1 Three material mapping, canonical profile conflict checks, sharing, reference counting, and exact disposal.
- [x] 3.3 Add the resource registry with resident/visible/pinned state, high-watermarks, tombstones, owned bytes, and resource records.
- [x] 3.4 Implement atomic upsert/replacement, idempotent revision-bound remove, protected eviction, fallback recomputation, and stale fail-closed behavior.
- [x] 3.5 Implement Float32 camera-relative projection with no scene-to-domain writeback.
- [x] 3.6 Implement immutable diagnostics, reset/replay generations, terminal idempotent dispose, and truthful render-target counters.
- [x] 3.7 Add the fixed 640 x 360 deterministic standalone harness without main-route integration or TestBridge.

## 4. Unit verification

- [x] 4.1 Add `presentationMeshArtifact.test.ts` for valid/invalid arrays, indices, bounds, ranges, index widths, aliases, and non-mutation.
- [x] 4.2 Add `presentationCommands.test.ts` for immutability, signatures, canonical order, ownership outcomes, and revision validation.
- [x] 4.3 Add `presentationVisibilityPlan.test.ts` for readiness, missing child coverage, plan switching, pinned fallbacks, and canonical sets.
- [x] 4.4 Add `renderBackendLifecycle.test.ts` for zero-copy move, atomic replacement, material leases, disposal, remove, eviction, reset/rebuild, and diagnostics isolation.
- [x] 4.5 Add `renderBackendRevision.test.ts` for idempotency, conflicts, stale replace/remove, high-watermarks, tombstones, and generations.
- [x] 4.6 Add `renderBackendBoundary.test.ts` for no Three.js presentation export and no forbidden adapter dependencies.

## 5. Browser evidence

- [x] 5.1 Add normal `/` Playwright lifecycle coverage with no TestBridge and dynamic standalone imports.
- [x] 5.2 Prove parent fallback, child readiness, higher replacement, stale rejects, child removal fallback, diagnostics, reset, and fresh replay.
- [x] 5.3 Generate and rerun exact 640 x 360 parent/child/replacement canvas baselines with bounded pixel difference.
- [x] 5.4 Generate deterministic JSON/Markdown evidence and the three evidence PNGs; visually inspect coverage, clipping, replacement, background, and absence of product UI.
- [x] 5.5 Fail the flow on unexpected console, page, request, or HTTP errors.

## 6. Verification and completion

- [x] 6.1 Run Node 22/npm/toolchain checks, `npm ci`, TypeScript, all six focused unit suites, and focused Playwright.
- [x] 6.2 Run full `npm run test`, `npm run build`, and `npm run test:e2e`.
- [x] 6.3 Run `git diff --check`, inspect Git LFS/PNG state, and audit the complete diff against the allowlist and base SHA.
- [x] 6.4 Perform independent lifecycle/boundary review and reconcile every diagnostic/evidence assertion.
- [x] 6.5 Update this checklist only from fresh command/evidence results and record any unrun or failed gate.
- [x] 6.6 Commit `#WELTRAUM-000 Add render backend mesh artifact lifecycle` and push the feature branch without PR or merge.

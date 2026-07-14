# Test Protocol: Browser Render Backend Mesh Artifact Lifecycle V1

## Environment and DevToolbox exception

Use Node.js 22 and the repository-pinned npm dependencies. Record `node --version`, `npm --version`, and Playwright/browser versions before verification.

The configured DevToolbox MCP rejects this Temp worktree with `unauthorized_path`. The user explicitly authorized proceeding without DevToolbox. Therefore no MCP task is claimed as successful. Equivalent spec-first artifacts, the unchecked task ledger, exact commands, fresh logs/evidence, completion review, and scope audit are maintained manually in this change. This exception must appear in the final report.

## Focused and full commands

From `apps/weltraum-browser`:

```text
npm ci
npx tsc -p tsconfig.json
npm run test -- tests/unit/presentationMeshArtifact.test.ts
npm run test -- tests/unit/presentationCommands.test.ts
npm run test -- tests/unit/presentationVisibilityPlan.test.ts
npm run test -- tests/unit/renderBackendLifecycle.test.ts
npm run test -- tests/unit/renderBackendRevision.test.ts
npm run test -- tests/unit/renderBackendBoundary.test.ts
npm run test:e2e -- tests/e2e/render-backend-mesh-lifecycle.spec.ts
npm run test
npm run build
npm run test:e2e
```

From repository root:

```text
git diff --check
git diff --name-only <base-sha>...HEAD
git lfs status
```

There is no active `.sln`/`.csproj` in the browser mainline, so Unity and .NET gates are `NOT APPLICABLE` and SHALL NOT be invented or run.

## Mandatory unit matrix

1. A valid MeshArtifact is accepted.
2. A non-finite position is rejected before ownership changes.
3. An out-of-range index is rejected.
4. Inconsistent attribute length is rejected.
5. Bounds must contain every vertex.
6. Material ranges are sorted, aligned, gapless, non-overlapping, and complete.
7. Same revision/hash/profile signature is idempotent.
8. Same revision with another hash is a content conflict.
9. A lower source/artifact tuple is stale.
10. A higher revision replaces atomically.
11. Replacement increments geometry disposal while preserving shared material correctness.
12. Remove is revision-bound and idempotent.
13. A stale remove cannot delete a newer representation.
14. A missing/untransformed child cannot hide its fallback.
15. A ready child can replace the visible fallback while the fallback stays resident/pinned.
16. A pinned fallback cannot be removed or evicted.
17. Reset releases every internal CPU/GPU resource and advances generation.
18. Replay with fresh buffers produces the same visible keys.
19. Reading/mutating diagnostics cannot mutate commands, artifacts, or backend state.
20. `src/presentation/**` has no Three.js imports.
21. Public Presentation exports contain no Three.js types.
22. Caller Typed Arrays remain byte-identical; accepted arrays are adopted by reference and never mutated by the backend.
23. Canonical set/signature inputs are independent of input order while vertex/index streams remain ordered.
24. Negative, unsafe, stale, or conflicting frame revisions are rejected.
25. New buffers on an idempotent duplicate remain caller-owned and do not allocate; already-owned references remain backend-owned.
26. Rejected replacement leaves caller ownership and old visibility/resources unchanged.
27. Material leases share one allocation and dispose exactly once at final release.
28. Eviction releases resources, preserves its high-watermark, and accepts later rehydration with fresh buffers.
29. Remove tombstones reject same/older resurrection but allow a higher tuple.
30. Old-generation commands cannot mutate a reset backend.

## Real Playwright flow

1. Install console, page, request, and HTTP failure collection, then open normal `/`.
2. Assert `window.TestBridge` is absent before and after the scenario.
3. Dynamically import `/src/presentation/index.ts` and `/src/render/three/backend/index.ts` without changing `main.ts` or globals.
4. Create a separate fixed harness canvas and initialize backend generation 0.
5. Upsert a coarse parent, apply its projection and a parent-visible plan, explicitly render, and capture the parent baseline.
6. Request a child while it is missing/untransformed and prove the parent remains visible/pinned.
7. Upsert/transform the finer child, apply the child-visible/parent-fallback plan, render, and capture the child baseline.
8. Replace the child with a visibly distinct higher artifact revision, render, and capture the replacement baseline.
9. Submit stale replacement and stale remove commands; assert fail-closed status and unchanged pixels/diagnostics.
10. Attempt to remove/evict the pinned parent and assert `PinnedFallback`.
11. Remove the exact current child and prove the existing parent reappears under the unchanged plan.
12. Validate acceptance, replacement, disposal, active/fallback, bytes, remove, and stale diagnostics.
13. Reset to generation 1, assert all resource/byte counts are released, then replay fresh parent/child buffers, projection, and visibility.
14. Assert rebuilt visible keys and replacement pixels match the pre-reset state.
15. Dispose and assert no unexpected collected browser failures.

## Screenshot protocol

Canvas and renderer are fixed at 640 x 360, pixel ratio 1, antialiasing off, no lighting, no animation, fixed camera/background, and explicit render calls. Compare only the harness canvas, never the dynamic app.

Exact baseline files:

```text
tests/e2e/render-backend-mesh-lifecycle.spec.ts-snapshots/render-backend-parent-fallback.png
tests/e2e/render-backend-mesh-lifecycle.spec.ts-snapshots/render-backend-child-active.png
tests/e2e/render-backend-mesh-lifecycle.spec.ts-snapshots/render-backend-replacement-active.png
```

Use per-channel tolerance 12 and changed-pixel ratio at most `0.005`. Missing baselines fail unless `UPDATE_RENDER_BACKEND_SNAPSHOTS=1` is set. After creating/updating baselines, rerun the exact focused command without that variable. State-to-state deltas and non-background/bounding-box checks must prove the canvas is non-empty, geometry is fully visible, and replacement is distinct.

Evidence uses the same captured canvas bytes:

```text
apps/weltraum-browser/evidence/render-backend-parent-fallback.png
apps/weltraum-browser/evidence/render-backend-child-active.png
apps/weltraum-browser/evidence/render-backend-replacement-active.png
apps/weltraum-browser/evidence/browser-render-backend-mesh-lifecycle-v1-summary.json
apps/weltraum-browser/evidence/browser-render-backend-mesh-lifecycle-v1.md
```

JSON/Markdown SHALL be deterministic: no timestamps, durations, hostnames, absolute paths, random values, or browser-specific memory claims. Visually inspect all PNGs for a non-black/non-empty canvas, complete parent and child coverage, no missing frame, no clipping, obvious replacement, and no HUD/product UI in the comparison region.

## Scope and completion audit

- Compare every changed path with the user-provided allowlist and base SHA.
- Assert zero changes to package/lockfiles, `main.ts`, CSS, existing `render/three/**` outside `backend/**`, all prohibited domain/runtime paths, roadmap, and `.github/**`.
- Confirm PNGs are valid and Git LFS state is intentional.
- Full E2E may regenerate unrelated evidence; discard or leave uncommitted any output outside this change's allowlist and investigate unexpected tracked changes.
- Do not mark tasks complete or commit/push while any focused, full, screenshot, evidence, diff, or scope gate is failing.

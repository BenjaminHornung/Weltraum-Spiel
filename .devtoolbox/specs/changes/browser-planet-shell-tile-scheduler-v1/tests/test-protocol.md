# Test Protocol: Browser Planet Shell Tile Scheduler V1

## Baseline

- Initial origin/main SHA: `5ff47aeef3c42c0b933e8480dafa5680759a40df`.
- Worktree: `.worktrees/Weltraum-Browser-IFIWELTRAUM-000-planet-shell-tile-scheduler-v1`.
- Branch: `feature/browser-planet-shell-tile-scheduler-v1`.
- Agent 0 spatial/physics and Agent 1 render/MeshArtifact lifecycle plus snapshot fix are ancestors of the baseline.
- Hestia Microvoxel Surface Lab is not yet independently merged and is the later PR synchronization gate.

## Unit matrix

1. Every face center/interior/edge/corner roundtrip and fixed dominant-axis ties.
2. Finite cube-sphere output and outward winding.
3. Stable ID, validation, canonical order, parent/children/siblings.
4. All cross-face neighbors and reciprocal adjacency.
5. Bounds contain corners/edges/interior at min/max heights.
6. SSE monotonicity, exact threshold, split/merge fixtures.
7. Conservative frustum tangent/intersection/outside cases.
8. Horizon surface/near/far, front/back, tangent tolerance, height margin, inside-body fail-safe.
9. Deterministic selector under reordered inputs and hard budgets.
10. Missing/loading/failed/partial/complete/evicted readiness transitions.
11. Stale readiness rejected without partial output.
12. Floating-origin/visual-scale changes do not alter tile IDs.
13. No Three/presentation import in core and no Math.random.
14. Finite valid shell mesh, stable winding/bounds and stable MeshArtifact hash.

## Browser scenario

1. Attach listeners for console errors, page errors, failed requests, and HTTP status >= 400.
2. Load normal `/` and assert `window.TestBridge` is absent.
3. Dynamically import and mount the separate Hestia harness.
4. Far orbit: verify coarse deterministic selection and save `planet-shell-far-orbit.png`.
5. Near orbit with incomplete child readiness: verify split requests, horizon removals, parent visible, child hidden; save `planet-shell-near-orbit-parent-fallback.png`.
6. Mark every required child render-ready at the accepted revision: verify child visible and parent hidden/resident; save `planet-shell-near-orbit-child-ready.png`.
7. Evict one active child: verify parent visible again and no hole.
8. Reset/repeat the sequence and compare stable selection IDs/reasons/revisions.
9. Assert all browser-health collections are empty.

## Focused commands

From `apps/weltraum-browser`:

`npx tsc -p tsconfig.json`

`npm run test -- tests/unit/planet*.test.ts`

`npm run test:e2e -- tests/e2e/planet-shell-tile-scheduler.spec.ts`

Baseline generation is a separate one-time focused Playwright invocation with `UPDATE_PLANET_SHELL_SNAPSHOTS=1`; acceptance runs never set it and only read/compare existing baselines.

## Initial full regression

`npm ci`

`npx tsc -p tsconfig.json`

`npm run test -- tests/unit/planet*.test.ts`

`npm run test:e2e -- tests/e2e/planet-shell-tile-scheduler.spec.ts`

`npm run test`

`npm run build`

`git diff --check`

Also run a bundled allowlist audit proving no initial changes to package/package-lock, main.ts, style.css, presentation/render backend core, workers, streaming, voxel, world-generation, surface-lab, flight, navigation, runtime, roadmap, or GitHub files.

## Evidence

- DevToolbox verify results and execution notes per task.
- Unit/build command summaries.
- Browser health and deterministic state/ID evidence.
- Three screenshot baselines and evidence PNGs under the allowed paths.
- Reviewer/reviewer-glm findings and resolution record.

## Initial acceptance and push gate

All focused/full checks, spec validation, completion preflights, allowlist audit, and reviews must pass. The controller reports changes and waits for explicit approval before committing/pushing. Initial push is branch-only; no PR.

## Deferred post-Surface-Lab protocol

After the Surface Lab merge is proven on origin/main: fetch, document new SHA, merge origin/main without rebase, inspect conflicts, apply only the permitted E2E group/LFS wiring if necessary, rerun the entire focused/full/browser/review matrix, then seek explicit approval before PR creation.

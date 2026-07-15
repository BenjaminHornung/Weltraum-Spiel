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

## P1 adapter publication follow-up

Starting branch head: `d8488d23b95dc1ca2c63aefe462e2cc164a19014`. The follow-up corrects unconditional partial/empty adapter publication without changing visible READY harness states.

Mandatory unit cases:

1. Missing active root with other ready roots: hold, no VisibilityPlan/partial roots, mandatory LoadJob retained.
2. Stale readiness revision: hold, no empty plan, exact LoadJobs retained, all active keys unverified.
3. Missing non-root active primary: hold with no partial active coverage.
4. Complete all-fallback plan: publish complete flattened visibility with empty presentation fallback slots.
5. Complete mixed primary/fallback plan: publish every active key exactly once.
6. Inconsistent `READY` declaration with a missing active readiness entry: fail closed with hold.
7. Every deterministic harness state explicitly checks `publish` before `ApplyVisibilityPlan`.

Required fresh commands from `apps/weltraum-browser`: `npm ci`; `npx tsc -p tsconfig.json`; `npx vitest run tests/unit/planetPresentationAdapter.test.ts`; `npm run test -- tests/unit/planet*.test.ts`; `npm run test`; `npm run build`; and `npm run test:e2e -- tests/e2e/planet-shell-tile-scheduler.spec.ts` with snapshot-update mode unset. Run repository-root `git diff --check`, independent spec/architecture and code reviews, exact changed-path/prohibited-path audits, assertion/timeout-strength audit, and SHA-256 comparison of all three protected baselines.

## P1 follow-up execution evidence (2026-07-15)

- Branch started clean at `d8488d23b95dc1ca2c63aefe462e2cc164a19014`; eight allowlisted files changed.
- `npm ci`: passed; 59 packages installed, 0 vulnerabilities.
- `npx tsc -p tsconfig.json`: passed with zero errors.
- `npx vitest run tests/unit/planetPresentationAdapter.test.ts`: 1 file, 9/9 tests passed.
- Exact `npm run test -- tests/unit/planet*.test.ts`: on Windows the wildcard was passed literally and Vitest matched no files; this invocation failure is retained as environment evidence. Equivalent Git-expanded execution enumerated all 11 tracked Planet unit files and passed 92/92 tests.
- `npm run test`: 97 files, 912/912 tests passed.
- `npm run build`: passed; 66 modules transformed. Existing npm user-config and Vite chunk-size warnings remained non-blocking.
- `npm run test:e2e -- tests/e2e/planet-shell-tile-scheduler.spec.ts`: 1/1 passed in 7.5 seconds with Chrome 150.0.7871.115; zero console/page/request/HTTP errors; every deterministic harness state published before visibility dispatch; reset/dispose checks passed; port 5173 and matching processes were clean afterward.
- Protected baseline SHA-256 values remained unchanged: far orbit `a464d693ed2aeee5283e503cfbdff754b9761ac6c8d3502826cd53a86f355126`; parent fallback `3876f91826d3ec15bf4b56c4a2e00632313cc8e4149ab5c38238bd2697b442b6`; child ready `5e869fc194ec9d1458faf8981451fae4ecb73d02325551b3dbde6e7014426996`. Evidence PNGs were byte-identical.
- Independent spec/architecture review: PASS, no P0-P3 findings. Independent correctness/regression/maintainability review: PASS, no actionable finding or assertion/timeout weakening. Informational residuals are recorded in execution notes.
- Exact allowlist audit: 8/8 expected changed paths, 0 missing, 0 unexpected. Package/lock, CI, infra, Presentation, Render, main/style, E2E spec, and PNG baselines unchanged. `git diff --check` passed.
- Verification runtime was Node v26.2.0; Node 22 parity was not separately rerun, but the complete required unit/full/build/browser matrix passed.

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

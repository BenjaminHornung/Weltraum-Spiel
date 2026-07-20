# Test Protocol: Browser Shared Trajectory Predictor Core v1

## Baseline

- Repository worktree: isolated feature worktree for feature/browser-shared-trajectory-predictor-core-v1
- Base: origin/main at 5ff47aeef3c42c0b933e8480dafa5680759a40df
- Published implementation head before this follow-up: a8408c9b624f60ae1407c920dc02f177fcb9b680
- Runtime: Node v22.23.1
- Package and lock files remain read-only.

## Required focused verification

From apps/weltraum-browser:

1. npm ci
2. npx tsc -p tsconfig.json
3. npm run test -- tests/unit/trajectoryValidation.test.ts
4. npm run test -- tests/unit/trajectoryIntegrators.test.ts
5. npm run test -- tests/unit/trajectoryCoast.test.ts
6. npm run test -- tests/unit/trajectoryAcceleration.test.ts
7. npm run test -- tests/unit/trajectoryImpulse.test.ts
8. npm run test -- tests/unit/trajectoryHazards.test.ts
9. npm run test -- tests/unit/trajectoryDeterminism.test.ts
10. npm run test -- tests/unit/trajectoryMetrics.test.ts
11. npm run test:e2e -- tests/e2e/trajectory-predictor-core.spec.ts

## Full regression

1. npm run test
2. npm run build
3. npm run test:e2e
4. git diff --check

## Behavioral matrix

- Reject invalid/noninteger/nonpositive step and sample values.
- Reject overlap, unsorted segments, gaps, duplicate IDs and off-grid boundaries.
- Reject frame mismatch and nonfinite state/source/segment/hazard/tolerance values.
- Equal inputs produce equal frozen results/signatures.
- Hazard insertion order does not affect canonical result.
- VelocityVerlet near-circular closure remains within the explicit fixture tolerance.
- RK4 matches a high-accuracy small fixture; SemiImplicitEuler is deterministic.
- Constant inertial acceleration and exact impulse semantics are directly asserted.
- Exact-zero and nonzero-but-numerically-ineffective impulses each retain a separate ImpulsePostState sample, stable ordinal and sample-count parity.
- Repeated nonzero ineffective runs remain deep-equal/signature-equal, while the otherwise identical exact-zero request has a different canonical signature.
- Swept hazard checks detect tunneling and stable tangency.
- Closest hazard ordering uses distance then lexical stable ID.
- No result contains NaN or Infinity; caller input remains unchanged; result is recursively immutable.
- Static checks exclude Three.js, navigation/flight/runtime owner imports, Date.now, performance.now and Math.random.
- Excessive step/sample horizon rejects before uncontrolled allocation.

## Task 5.1 follow-up verification results

- Node: v22.23.1.
- `npx tsc -p tsconfig.json`: pass.
- Focused `trajectoryImpulse.test.ts`: 1 file, 4/4 tests pass.
- Full unit: 94 files, 883 tests pass (baseline 882 plus the new test).
- Production browser build: pass.
- Focused trajectory/canonical Playwright smoke: 1/1 pass.
- Full Playwright: first attempt hit the 180-second bound with one transient failure; one bounded retry passed 55/55 in 167.45 seconds. This is retained as retry evidence and a residual flake signal, not as an unqualified first-run pass.
- Exact-zero delta and nonzero numerically ineffective `2 ** 53 + 1 === 2 ** 53` public predictor cases: accepted/completed, unchanged physical state, separate ordered `ImpulsePostState` and `Final` samples, budget/emitted/metric count parity, repeat-run deep/signature equality, and a signature difference from the otherwise identical zero-delta request.
- Dual review: reviewer no findings; reviewer-glm reported two LOW test-clarity findings, both resolved by comments, with focused re-review APPROVE.
- Test-generated evidence cleanup: 91 tracked files under `apps/weltraum-browser/evidence/` restored to HEAD under the approved allowlist; pre-restore deterministic manifest SHA-256 `e87c60e2ee92f98ef44ab44f2f455b974e73bd5097eeac655930a4615cd43bab`; final status is exactly six intended files and no untracked; `git diff --check` clean.
- Standalone DevToolbox `verify_run` timed out twice with `MCP error -32001: Request timed out` for corrupted executions `eaca8651740c4deaade6de2dc6bf3ee2` and `95a51bd64db7409ebc10bd66f5b6b60e`.
- Recovery/waiver execution: `01fd5743dc3a42029d8507773f79d1c9`. On 2026-07-16, the user explicitly accepted the DevToolbox verification/tracking risk; no successful DevToolbox `verify_run` is claimed.
- Completion preflight and task closure remain parent-owned and pending at the time of this protocol edit.

## Browser scenario

- Register console, page, failed-request and HTTP >= 400 collectors before navigation.
- Load the normal configured route and assert window.TestBridge is absent.
- Dynamically import /src/trajectory/index.ts through Vite.
- Run a deterministic near-circular Hestia GravityCoast plus ConstantInertialAcceleration and ImpulseDeltaV.
- Detect a spherical hazard through swept geometry.
- Execute the same request twice and compare canonical output/signature.
- Assert all four error collectors are empty.
- Write deterministic JSON and Markdown evidence only after assertions pass. No screenshot.

## Evidence

- apps/weltraum-browser/evidence/browser-shared-trajectory-predictor-core-v1-summary.json
- apps/weltraum-browser/evidence/browser-shared-trajectory-predictor-core-v1.md
- docs/browser-mainline/shared-trajectory-predictor-core-v1.md

## Scope audit

Compare git diff --name-only against base SHA. Permit only:

- .devtoolbox/specs/changes/browser-shared-trajectory-predictor-core-v1/**
- apps/weltraum-browser/src/trajectory/**
- apps/weltraum-browser/tests/unit/trajectory*.test.ts
- apps/weltraum-browser/tests/e2e/trajectory-predictor-core.spec.ts
- apps/weltraum-browser/evidence/browser-shared-trajectory-predictor-core-v1*
- docs/browser-mainline/shared-trajectory-predictor-core-v1.md

The follow-up commit may modify only `trajectoryImpulse.test.ts`, `design.md`, `specs/default/spec.md`, `tests/test-protocol.md`, `tasks.md` and, only for missing public wording, `docs/browser-mainline/shared-trajectory-predictor-core-v1.md`. The aggregate base-to-head path set must remain the same exact 29-file allowlist.

Explicitly fail if package.json, package-lock.json, main.ts, style.css, spatial, physics-space, celestial, persistence, navigation, flight, runtime, voxel, world-generation, surface-lab, planet, .github, infra or docs/roadmap/living-master-plan.md changes.

## Completion rule

DevToolbox specs validation and task completion preflight must pass. External verification, dual review, focused/full command matrix and scope evidence must remain passing. The user-accepted 2026-07-16 waiver applies only to the two DevToolbox `verify_run` timeout/tool failures documented above; it does not waive any product test, review, scope, unauthorized-path, specs-validation or completion-preflight failure, and no successful DevToolbox `verify_run` is claimed. Only then create the non-amended follow-up commit #WELTRAUM-000 Preserve ineffective impulse events and push the named feature branch; never rebase, force-push, open a PR or merge. Do not archive the change.

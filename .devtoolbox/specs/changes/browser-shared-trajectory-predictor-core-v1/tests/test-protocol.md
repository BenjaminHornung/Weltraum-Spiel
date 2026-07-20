# Test Protocol: Browser Shared Trajectory Predictor Core v1

## Baseline

- Repository worktree: isolated feature worktree for feature/browser-shared-trajectory-predictor-core-v1
- Base: origin/main at 5ff47aeef3c42c0b933e8480dafa5680759a40df
- Runtime: Node 22
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
- Swept hazard checks detect tunneling and stable tangency.
- Closest hazard ordering uses distance then lexical stable ID.
- No result contains NaN or Infinity; caller input remains unchanged; result is recursively immutable.
- Static checks exclude Three.js, navigation/flight/runtime owner imports, Date.now, performance.now and Math.random.
- Excessive step/sample horizon rejects before uncontrolled allocation.

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

Explicitly fail if package.json, package-lock.json, main.ts, style.css, spatial, physics-space, celestial, persistence, navigation, flight, runtime, voxel, world-generation, surface-lab, planet, .github, infra or docs/roadmap/living-master-plan.md changes.

## Completion rule

DevToolbox specs validation, task verification, task completion preflight, dual review, focused/full command matrix and scope audit must pass. Blocking unauthorized_path or verification failures are not overridden. Only then create commit #WELTRAUM-000 Add shared trajectory predictor core and push the named feature branch; never rebase, force-push, open a PR or merge.

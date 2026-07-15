# Tasks: Browser Shared Trajectory Predictor Core v1

## Phase 1 - Contracts and validation

- [x] 1.1 Create trajectory IDs, readonly contracts, budgets and segment validation
  - Objective: Define the complete public request/result model and reject invalid timelines before propagation.
  - Files/search targets: apps/weltraum-browser/src/trajectory/ids.ts, types.ts, segments.ts; leaf contracts in core/vector.ts, persistence/time.ts, spatial/ids.ts.
  - Acceptance: All required statuses/types exist; SI/tick/frame rules are explicit; ordered contiguous segments, unique IDs, aligned boundaries, finite vectors, policies, hazards and prospective budgets validate fail-closed; inputs are not mutated.
  - Guidance: Use direct leaf imports only. No implicit sorting of invalid segments, no implicit coast, no existing-owner edits.
  - Required skills/MCPs: subagent-driven-development, verification-before-completion, DevToolbox execution/verify tools.
  - Verification: Node 22; npx tsc -p tsconfig.json and npm run test -- tests/unit/trajectoryValidation.test.ts after the test task exists; interim focused compile allowed.
  - Report back: changed files, validation/status matrix, commands/results, residual risk.
  - Stopping rule: Stop on unauthorized_path, missing approved contract, circular dependency or inability to preserve existing owner boundaries.

## Phase 2 - Propagation

- [x] 2.1 Implement deterministic source propagation, integrators and segment execution
  - Objective: Implement pure fixed-step SemiImplicitEuler, VelocityVerlet and RungeKutta4 propagation for GravityCoast, ConstantInertialAcceleration and exact ImpulseDeltaV.
  - Files/search targets: apps/weltraum-browser/src/trajectory/integrators.ts, propagation.ts; read-only celestial gravity and persistence time leaf contracts.
  - Acceptance: Source is evaluated linearly at every stage; all three integrators are deterministic; policy is explicit; acceleration adds gravity plus the inertial vector; impulses preserve position/mass; every intermediate value is finite.
  - Guidance: No adaptive steps, wall clock, fuel, mass changes, body-fixed thrust or source switching.
  - Required skills/MCPs: subagent-driven-development, systematic-debugging if a numerical test fails, verification-before-completion.
  - Verification: focused TypeScript compile and trajectoryIntegrators/Coast/Acceleration/Impulse tests.
  - Report back: formulas, changed files, fixture comparisons, command results and tolerance caveats.
  - Stopping rule: Stop on ambiguous stage-time semantics, nonfinite state, hidden policy change or forbidden dependency.

## Phase 3 - Result facts

- [x] 3.1 Implement swept hazards, closest approaches, metrics, predictor orchestration and canonical immutability
  - Objective: Produce the complete deterministic TrajectoryPredictionResult without gameplay side effects.
  - Files/search targets: apps/weltraum-browser/src/trajectory/hazards.ts, closestApproach.ts, metrics.ts, predictor.ts, canonical.ts, fixtures.ts, index.ts.
  - Acceptance: Swept tunneling/tangency/entry/exit work per design; all ordering/ties are stable; metrics are finite; budget preflight precedes allocation; result metadata exposes source approximation/policies; canonical signatures are hazard-order invariant; all nested results are frozen.
  - Guidance: Reuse persistence canonical/FNV leaf helpers; do not use rounded stableStringify; reject duplicate hazard IDs and numerical singularities.
  - Required skills/MCPs: subagent-driven-development, verification-before-completion, systematic-debugging for geometric/numeric failures.
  - Verification: trajectoryHazards, trajectoryDeterminism and trajectoryMetrics tests plus forbidden-import/API scan.
  - Report back: changed files, event/order rules, signature payload, metrics, commands/results, remaining limits.
  - Stopping rule: Stop if canonicalization includes timing, caller order affects semantics, outputs can become nonfinite or an existing owner would need modification.

## Phase 4 - Automated proof

- [x] 4.1 Add the complete eight-file unit-test matrix
  - Objective: Prove all twenty required validation, integration, hazard, determinism, immutability, static dependency and budget cases.
  - Files/search targets: apps/weltraum-browser/tests/unit/trajectoryValidation.test.ts, trajectoryIntegrators.test.ts, trajectoryCoast.test.ts, trajectoryAcceleration.test.ts, trajectoryImpulse.test.ts, trajectoryHazards.test.ts, trajectoryDeterminism.test.ts, trajectoryMetrics.test.ts.
  - Acceptance: Every named user case has a direct assertion; tests use deterministic fixtures and do not relax production contracts.
  - Guidance: Prefer analytic constant-acceleration/impulse checks, RK4 high-accuracy reference, circular VelocityVerlet fixture and source/AST import scans patterned after existing tests.
  - Required skills/MCPs: verification-before-completion, systematic-debugging for failures.
  - Verification: run each required npm run test -- <file> command under Node 22.
  - Report back: case-to-test mapping, counts, commands/results and uncovered limitations.
  - Stopping rule: Stop rather than weaken tolerance, skip a mandatory case or alter package scripts.

- [x] 4.2 Add real browser E2E, deterministic evidence and browser-mainline contract documentation
  - Objective: Verify the standalone core through Vite in a real browser without TestBridge or runtime integration.
  - Files/search targets: apps/weltraum-browser/tests/e2e/trajectory-predictor-core.spec.ts; apps/weltraum-browser/evidence/browser-shared-trajectory-predictor-core-v1-summary.json and .md; docs/browser-mainline/shared-trajectory-predictor-core-v1.md; existing spatial/persistence E2E patterns read-only.
  - Acceptance: Normal route loads; TestBridge is absent; dynamic /src/trajectory/index.ts import succeeds; near-circular Hestia coast, acceleration, impulse, hazard and repeated canonical result pass; console/page/request/HTTP error arrays remain empty; evidence is timestamp-free; no screenshot or package grouping change.
  - Guidance: Register all collectors before navigation and write evidence only after assertions pass.
  - Required skills/MCPs: browser-debugger or test-runner, verification-before-completion.
  - Verification: npm run test:e2e -- tests/e2e/trajectory-predictor-core.spec.ts under Node 22.
  - Report back: route/import, scenario facts, error counts, evidence paths and command result.
  - Stopping rule: Stop on browser errors, TestBridge dependence, package.json change or non-deterministic evidence.

## Phase 5 - Review and release proof

- [ ] 5.1 Complete dual review, full regression, scope audit, evidence and feature-branch publication
  - Objective: Establish spec compliance and repository safety, then create the approved commit and push only the feature branch.
  - Files/search targets: complete allowlisted diff from base 5ff47aeef3c42c0b933e8480dafa5680759a40df.
  - Acceptance: reviewer and reviewer-glm have no unresolved blocking findings; npm ci, tsc, eight focused tests, focused E2E, full test, build, full E2E and git diff --check pass; DevToolbox verify and completion preflight pass; only allowed paths changed; commit title is #WELTRAUM-000 Add shared trajectory predictor core; branch push succeeds.
  - Guidance: Fix findings through the owning implementation lane and rerun focused proof. Do not rebase, force-push, open a PR, merge or touch another worktree.
  - Required skills/MCPs: requesting-code-review, devtoolbox-review, verification-before-completion, test-runner, DevToolbox review/verify/task tools, ifi-commit-message.
  - Verification: exact command matrix in tests/test-protocol.md plus git status/diff/log/scope audit.
  - Report back: SHA/branch/commit, review findings, every command result, evidence, scope audit and known limitations.
  - Stopping rule: Do not commit/push while any required verification or preflight is failing or while the diff leaves the allowlist.

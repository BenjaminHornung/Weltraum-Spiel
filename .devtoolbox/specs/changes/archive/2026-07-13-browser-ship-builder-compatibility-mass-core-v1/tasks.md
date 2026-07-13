# Tasks: Browser Ship Builder Compatibility & Mass Core v1

## Shared execution contract

- Workspace: `C:\IFI_SourceCode\WT\weltraum-spiel-browser-ship-builder-compatibility-mass-core-v1`.
- Branch: `feature/browser-ship-builder-compatibility-mass-core-v1`, based on refreshed `origin/main`.
- Browser-only pure domain work. Do not start Unity or modify `Assets/**`, package/lockfiles, main/UI/runtime/flight/navigation/render/sim/TestBridge paths.
- Allowed product paths are only the user-approved Ship Builder source/tests/E2E/evidence/docs and this change folder.
- Before each task: load tasks, create one execution, implement only that task, add meaningful notes, verify, run completion preflight, toggle, and commit using `#WELTRAUM-000` IFI format.
- Stop on serialized schema change, starter catalog/fixture/signature change, package change, forbidden-path need, failing unrelated baseline, or parallel Ship Builder overlap.

## Phase 1: Contracts

- [x] 1. Freeze and validate the compatibility, structure, and mass contracts.
  - **Owned files:** this change folder only.
  - **Deliverable:** decision-complete proposal, design, spec, tasks, and test protocol covering policy, diagnostics/order, schema separation, graph/root, dry mass/COM/bounds, browser evidence, non-goals, and stop gates.
  - **Verification:** `specs_validate`, artifact readback, `git diff --check`, scoped path audit.
  - **Commit:** `#WELTRAUM-000 Define ship builder compatibility and mass contracts`.

## Phase 2: Domain implementation

- [x] 2. Implement immutable diagnostics and connection compatibility policy.
  - **Owned files:** `src/ship-builder/diagnostics.ts`, `compatibility.ts`, `index.ts`, `tests/unit/shipBuilderCompatibility.test.ts`.
  - **Deliverable:** canonical policy snapshot/signature, starter policy, yaw transforms, per-connection compatibility, stable diagnostics, endpoint occupancy helpers, and focused cases.
  - **Verification:** focused compatibility test, existing Ship Builder suites, build, diff check.
  - **Commit:** `#WELTRAUM-000 Add ship builder connection compatibility`.

- [x] 3. Implement deterministic structural validation and reporting.
  - **Owned files:** `src/ship-builder/blueprintValidation.ts`, `index.ts`, `tests/unit/shipBuilderValidation.test.ts`.
  - **Deliverable:** occupancy, required sockets, compatible structural graph, components/root/disconnected IDs, summary/status/signature, immutable report.
  - **Verification:** focused validation test plus compatibility/existing suites and build.
  - **Commit:** `#WELTRAUM-000 Add ship builder structural validation`.

- [x] 4. Implement dry mass, COM, and grid bounds evaluation.
  - **Owned files:** `src/ship-builder/massProperties.ts`, `index.ts`, `tests/unit/shipBuilderMassProperties.test.ts`.
  - **Deliverable:** enabled dry-mass contributions, grid/meter COM, yaw-aware footprint bounds, fail-closed numeric behavior, immutable signed result.
  - **Verification:** focused mass test plus all Ship Builder unit suites and build.
  - **Commit:** `#WELTRAUM-000 Add ship builder mass properties`.

## Phase 3: Browser evidence and documentation

- [x] 5. Add normal-route browser evidence and Browser-mainline documentation.
  - **Owned files:** named compatibility/mass E2E, task-specific JSON/Markdown evidence, new compatibility/mass doc, scoped feature-intent and roadmap edits.
  - **Deliverable:** default-route TestBridge absence, dynamic barrel import, all three fixture reports/mass results/signatures, deterministic evidence, documented rules/non-goals.
  - **Verification:** both Ship Builder E2E specs, JSON parse/invariants, focused/full unit tests, build.
  - **Commit:** `#WELTRAUM-000 Add ship builder compatibility browser evidence`.

## Phase 4: Review and release evidence

- [x] 6. Complete review, full verification, allowlist audit, and release evidence.
  - **Owned files:** test protocol/task state and fixes only in the original owning task paths.
  - **Deliverable:** findings-first review with no unresolved correctness issues, exact command results, DevToolbox verification/preflight, clean allowlist, final branch report.
  - **Verification:** all required npm, Playwright, dotnet, diff, JSON, and allowlist commands.
  - **Commit:** `#WELTRAUM-000 Verify ship builder compatibility mass core`.
  - **Release:** push feature branch only; do not merge main.

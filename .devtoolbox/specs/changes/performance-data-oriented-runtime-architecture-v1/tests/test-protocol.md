# Test Protocol: Data-Oriented Runtime Architecture v1

## Scope

This change starts as an architecture scaffold and then adds safe first runtime snapshot hooks. No worker-thread execution, DOTS/ECS migration, gameplay rebalance, or background Unity API access is included.

## Planned Verification

### 1) Static spec completeness

- Verify proposal, design, tasks, and all requested `spec.md` files exist.
- Verify each `spec.md` contains requirement headings and Given/Scenario entries.
- Verify tasks are listed and only locally verified tasks are checked.

### 2) Architectural readiness criteria (future implementation gating)

- Snapshot and patch data model requirements are documented in both design and specs.
- Main-thread apply boundaries and job-thread candidate boundaries are explicitly separated.
- Migration phasing is documented in sequence: safe refactors → job-ready pure paths → batched apply boundaries → parallel execution.
- Each data model spec defines stable IDs and deterministic ownership semantics.

### 3) Hotpath analysis coverage

- Confirm at least one explicit scenario and acceptance path covers:
  - scene-wide discovery avoidance,
  - allocation-safe bounded buffers,
  - target lookup determinism,
  - dirty-flag-driven cache recomputation.

## Test execution status

- `npx --yes openspec validate performance-data-oriented-runtime-architecture-v1 --type change --json --no-interactive` was attempted in the sandbox and failed because npm could not access the registry/cache.
- The required escalated retry was rejected by the security reviewer because it would download and execute unpinned npm code from the registry.
- Safe local structure validation passed:
  - missing required files: none
  - spec count: 6
  - specs without `Scenario:` headings: none
  - checked task lines before parent verification: 0

## Evidence

- This scaffold creates a complete, auditable OpenSpec folder with:
  - `proposal.md`
  - `design.md`
  - `tasks.md`
  - `tests/test-protocol.md`
  - `specs/runtime-data-snapshots/spec.md`
  - `specs/projectile-simulation-data-model/spec.md`
  - `specs/target-registry-data-model/spec.md`
  - `specs/camera-rcs-cache-dirty-flags/spec.md`
  - `specs/job-system-readiness/spec.md`
  - `specs/main-thread-apply-boundaries/spec.md`

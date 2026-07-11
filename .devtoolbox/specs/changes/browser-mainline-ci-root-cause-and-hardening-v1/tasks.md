# Tasks

## Phase 1: Evidence and reproduction

- [x] Record the four deterministic failing runs, last green run, exact failed step/spec/assertion, annotations, artifacts, and proven source/test divergence.
- [x] Reproduce `debug-scene.spec.ts` locally before the fix and record the result.

## Phase 2: Minimal repair and CI hardening

- [x] Replace the duplicated low-poly count literal with the authoritative proving-ground registry length; add complete named E2E scripts, isolated CI artifact folders, and required diagnostics without production changes.
- [x] Update browser CI documentation and the test protocol with the before/after workflow contract.

## Phase 3: Local verification

- [x] Run the previously failing spec twice, each E2E group, aggregate E2E, unit tests, build, JSON parsing, TestBridge isolation checks, diff checks, and Assets/package scope checks.

## Phase 4: Review and remote verification

- [x] Review the complete diff for missing specs, weakened assertions, production-scope drift, and artifact gaps; complete DevToolbox verification/preflight.
- [x] Commit and push the branch, observe a new Browser Mainline CI run to completion, iterate on any failure, and finalize the remote run evidence.

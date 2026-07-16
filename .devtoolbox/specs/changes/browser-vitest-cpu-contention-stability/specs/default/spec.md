# Browser Vitest CPU Contention Stability Specification

## ADDED Requirements

### Requirement: Deterministic Vitest worker budget
The browser Vitest configuration SHALL limit the complete test run to exactly one file worker through top-level `test.maxWorkers`.

#### Scenario: Complete Node 22 test run
- **WHEN** the standard browser unit suite runs under the required Node 22 runtime
- **THEN** Vitest uses at most one file worker
- **AND** all 91 test files and all 865 tests pass
- **AND** no test exceeds its unchanged timeout because of cross-file CPU contention

### Requirement: Existing test semantics remain unchanged
The stability change SHALL NOT change timeout values, test source, assertions, pool type, package versions, package manifests, lock files, production source, or persistence behavior.

#### Scenario: Configuration and scope audit
- **WHEN** the stability-change diff is reviewed
- **THEN** `apps/weltraum-browser/vite.config.ts` is the only changed non-DevToolbox file attributable to this change
- **AND** its only behavioral addition is `test.maxWorkers: 1`
- **AND** package manifests, lock files, tests, and production source remain unchanged by this change

### Requirement: Focused regression behavior is preserved
The worker limit SHALL preserve the existing CPU-heavy simulation and browser-storage test behavior.

#### Scenario: Focused unit verification
- **WHEN** the three named CPU-heavy test files run together under Node 22
- **THEN** every test passes without timeout
- **AND WHEN** the five `browserStorage*.test.ts` files run together
- **THEN** all five files and all 45 tests pass

### Requirement: Complete-suite stability is repeatable and bounded
The configured suite SHALL pass repeatedly rather than only on a single favorable run.

#### Scenario: Three consecutive complete runs
- **WHEN** the complete browser unit suite is executed three consecutive times under Node 22
- **THEN** each run passes exactly 91/91 files and 865/865 tests
- **AND** each run completes within 120 seconds
- **AND** no run is retried, filtered, or weakened to obtain the result

#### Scenario: Stability criterion fails
- **WHEN** any complete run fails, times out, exceeds 120 seconds, or reports different test counts
- **THEN** the change is not marked complete
- **AND** implementation stops for diagnosis or explicit replanning without raising timeouts or changing tests

### Requirement: Browser verification remains valid
The worker-budget change SHALL not regress compilation, build, or real-browser behavior.

#### Scenario: Build and E2E verification
- **WHEN** the browser application is typechecked and built under Node 22
- **THEN** both operations pass
- **AND WHEN** the focused browser-storage and complete Playwright E2E suites run with the approved installed-Chrome fallback
- **THEN** all required E2E scenarios pass

### Requirement: Review and tracked evidence gate completion
The change SHALL remain open until scope, correctness, regression, and DevToolbox gates pass.

#### Scenario: Completion decision
- **WHEN** dual review, fresh verification, diff-check, scope audit, DevToolbox verify, and completion preflight have completed
- **THEN** there are no unresolved material findings or unauthorized paths
- **AND** exact commands, pass counts, durations, and any environment fallback are recorded
- **AND** no commit or push occurs without the separately required user confirmation
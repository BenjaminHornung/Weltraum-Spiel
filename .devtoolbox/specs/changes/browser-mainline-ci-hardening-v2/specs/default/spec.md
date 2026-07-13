# Browser Mainline CI Hardening v2 Spec

## Requirements

### CIH-001 Complete group membership

The browser package shall define core/autopilot, live runtime/objectives, and UI/layout E2E scripts whose explicit memberships assign every recursively discovered `tests/e2e/**/*.spec.ts` file exactly once. The aggregate `test:e2e` script shall remain `playwright test`.

### CIH-002 Fail-closed membership gate

CI shall derive assignments from the actual package scripts and fail on an unassigned, duplicate, or stale spec entry. Each complete script shall have the exact `playwright test` prefix followed only by one or more normalized discovered spec-path tokens; flags, shell syntax, commands, comments, quoted extras, and all other tokens shall be rejected. Dependency-free assertions shall cover a valid representative plus shell-suffix and flag mutations. Validation output shall include counts and group lists.

### CIH-003 Required independent diagnostics

All three groups shall be required steps in one job. A failed group shall not suppress later groups unless the job is cancelled, and no group shall use `continue-on-error`. The job shall retain a finite 45-minute timeout and one CI worker.

### CIH-004 Playwright safety and isolation

CI shall reject focused tests with `forbidOnly` only when `CI=true`. A configured artifact group shall be validated as safe lowercase alphanumeric hyphen-separated text and shall isolate both Playwright output and HTML reports. Unset configuration shall preserve existing aggregate directories.

### CIH-005 Failure artifacts without local long-run cost

The live large-field test shall retain traces and automatic screenshots on CI failures and keep them disabled locally without changing test behavior, assertions, or timeouts.

### CIH-006 Current setup diagnostics

CI shall keep selective LFS restoration for the Demo Scout GLB and four required reference PNGs, then report Node, npm, Playwright, and GLB type/size after setup. It shall not perform a broad LFS pull.

### CIH-007 Evidence validation and upload

After E2E, CI shall parse every top-level `evidence/*.json` file and fail on invalid JSON. Artifact upload shall retain existing report/output/PNG/JSON paths and include Markdown plus all group report/output folders.

### CIH-008 Scope guardrails

The change shall not modify browser product source, dependencies, lockfiles, E2E acceptance logic, debug-scene assertions, Unity assets, or checked-in binary evidence.

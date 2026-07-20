# Capability: Browser Live E2E Concurrency Stability V1

## Requirement: Bounded local concurrency

The browser Playwright configuration SHALL use one worker when
`process.env.CI === "true"` and two workers otherwise. The initial change
SHALL make no other Playwright configuration or test edit.

### Scenario: Local execution

Given `CI` is not the string `"true"`, when the official live E2E group runs,
then Playwright uses two workers and the unchanged 14-test live group remains
eligible to execute in parallel.

### Scenario: CI execution

Given `CI === "true"`, when the official live E2E group runs, then Playwright
uses one worker, preserving the established CI serialization.

## Requirement: Existing Playwright contract preservation

`fullyParallel`, retries, timeouts, webServer, browser projects, reporters,
test files, assertions, and test workloads SHALL remain unchanged. No test
shall be skipped or retried by the stability change.

## Requirement: Stability evidence

After the initial implementation, three official live runs SHALL each pass
14/14 with zero retries and zero skips. Port 5173 SHALL be free after every
run. The combined matrix SHALL preserve the same result without suppressing
later diagnostics.

## Requirement: Hestia and browser contracts

The Hestia live route SHALL settle at 16/16 requested/ready chunks with failed,
queue, and running counts at zero. Same-seed brick and mesh hashes SHALL be
equal; changed-seed brick and mesh hashes SHALL differ. Browser health SHALL be
0/0/0/0 in the order console errors / page errors / request failures / HTTP
errors.

## Requirement: Hestia bootstrap contingency

No Hestia bootstrap wait SHALL be added initially. It MAY be proposed only
after reproducible workers=2 evidence isolates a bootstrap-only failure and a
review confirms that it is not a product, browser, port, assertion, or evidence
failure.

## Requirement: Evidence and repository integrity

The final clean evidence state SHALL be recorded as zero evidence status, with
staged and unstaged diffs empty after normalization. No evidence content SHALL
be changed or committed. Package and lock files SHALL remain unchanged, and
the E2E inventory SHALL contain exactly 30 spec files assigned once: Core 17,
Live 9, and UI 4; the 9 Live spec files SHALL contain 14 tests.

## Requirement: Review and merge gate

The change SHALL pass the combined matrix, package/lock/evidence/scope checks,
separate reviewer and reviewer-GLM review, completion preflight, and one
combined human final gate. The separate known P2 `Preserve inputs when
generation cannot start` SHALL remain a merge blocker. Exactly two separately
authorized commits MAY occur only after all gates pass.

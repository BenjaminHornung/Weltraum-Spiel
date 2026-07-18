# Proposal: Browser Live E2E Concurrency Stability V1

## Motivation

The browser live E2E group is stable with two Playwright workers but exhibits
non-deterministic failures with four workers. This is a local concurrency
stability problem, not a product or assertion contract. The approved change
selects a bounded local worker limit while preserving CI's existing serial
execution and every existing Playwright timeout, retry, project, web-server,
and test contract.

## Existing-change boundary

The uncommitted change
`browser-heavy-unit-test-stability-v1` is existing work and remains untouched.
This change writes only the five artifacts in this directory. It does not edit
Playwright config/tests during the artifact handoff.

## Evidence

The observed worker sweep was:

| Workers | Runs | Result | Duration | Retries/skips | Port state |
| ---: | --- | --- | --- | --- | --- |
| 4 | 1 | FAIL 13/14, Hestia HUD startup timeout | 173.711 s | 0 / 0 | 5173 free afterward |
| 4 | 2 | PASS 14/14 | 205.446 s | 0 / 0 | 5173 free afterward |
| 4 | 3 | FAIL 13/14, Proving Ground teardown timeout | 204.722 s | 0 / 0 | 5173 free afterward |
| 2 | 1 | PASS 14/14 | 200.275 s | 0 / 0 | 5173 free afterward |
| 2 | 2 | PASS 14/14 | 166.973 s | 0 / 0 | 5173 free afterward |
| 2 | 3 | PASS 14/14 | 154.764 s | 0 / 0 | 5173 free afterward |

Both workers=4 failures are classified as timeout-only: the Hestia HUD startup
timeout and the Proving Ground teardown timeout. Neither failure was an
assertion failure or a product failure. Workers=2 passed 3/3 at 14/14, so an
Hestia bootstrap wait is not needed.

## Outcome

The sole initial implementation is the approved expression in
`apps/weltraum-browser/playwright.config.ts`:

```ts
workers: process.env.CI === "true" ? 1 : 2
```

CI remains at one worker and local runs use two. `fullyParallel`, retries,
timeouts, webServer, browser projects, and all tests remain unchanged.

## Evidence integrity

The final clean evidence state is recorded: evidence status is zero, and both
staged and unstaged diffs are empty after normalization. No evidence content
was changed, generated, staged, or committed.

## Non-goals

- No Playwright test edits or assertion/workload changes.
- No Hestia bootstrap wait initially; it is only the approved contingency if
  later evidence proves a workers=2 Hestia bootstrap race.
- No package, lockfile, evidence, product, or architecture change.
- No merge while the separate known P2 `Preserve inputs when generation cannot
  start` remains unresolved.

## Completion contract

The completed evidence record is maintained in
`tests/test-protocol.md`. It covers the three official local runs, the combined
matrix, the 30-spec assignment, Hestia/hash/browser-health checks, package/lock/
evidence/scope checks, and the remaining review gates. Task boxes remain
pending until completion preflight; no commit, publication, or scope expansion
is implied by this record.

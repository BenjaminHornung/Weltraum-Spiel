# Design: Browser Live E2E Concurrency Stability V1

## Baseline

The live browser group currently contains 14 tests in the observed sweep. Four
workers produced two different single-test, timeout-only failures across three
runs: one Hestia HUD startup timeout and one Proving Ground teardown timeout.
Neither failure was an assertion or product failure. Two workers passed all
three runs with zero retries and zero skips. Every run left port 5173 free.

This evidence selects local workers=2 without changing browser behavior,
assertions, or test-level timeouts.

## Sole initial implementation

The only planned implementation edit is in
`apps/weltraum-browser/playwright.config.ts`:

```ts
workers: process.env.CI === "true" ? 1 : 2
```

The existing `fullyParallel` setting, retries, timeouts, webServer, browser
projects, reporters, and all test files remain unchanged. CI therefore keeps
the established one-worker behavior; local execution is bounded at two
workers.

No other config expression, environment behavior, or test contract is to be
redesigned.

## Hestia bootstrap contingency

No Hestia bootstrap wait is part of the initial implementation. Workers=2 is
green in all three observed runs, so adding a wait would be speculative. A
bootstrap wait may be considered only if the official or combined matrix
produces a reproducible Hestia bootstrap-only failure at workers=2 and the
failure is independently distinguished from port, browser, product, assertion,
or evidence problems. Such a contingency requires a stop/review decision and
is not part of the initial sole implementation.

## Evidence integrity contract

The final clean evidence state is authoritative: evidence status is zero, and
both staged and unstaged diffs are empty after normalization. No evidence
content was changed, generated, staged, or committed.

No evidence file may be added, regenerated, staged, or committed by this
change.

## Verification flow

1. Apply only the workers expression.
2. Run official live three times with CI unset, no CLI workers override, and
   local config workers=2; capture 14/14, retries/skips, health, and port
   cleanup.
3. Run the combined core/live/UI/aggregate matrix and exact E2E assignment
   check.
4. Verify Hestia 16/16, same-seed equal hashes, changed-seed different hashes,
   and browser 0/0/0/0.
5. Verify package, lockfile, final evidence state, and scope invariants.
6. Run separate reviewer and reviewer-GLM reviews, completion preflight, then
   one combined human final gate.
7. Keep the known separate P2 as a merge blocker. Only after every gate passes
   may exactly two separately authorized commits be made.

## Stop conditions

Stop without redesign if workers=2 fails for a reason not proven to be a
concurrency-only issue, if the Hestia bootstrap contingency would be needed,
if any test/config/package/lock/evidence path beyond the sole implementation
edit is required, if evidence content changes, or if the separate P2 remains
unresolved at merge time.

# Design: Browser Heavy Unit Test Stability V1

## Baseline and authority

**PRE-CHANGE baseline:** Before this change, the browser test configuration in
`apps/weltraum-browser/vite.config.ts` contained the unit include and Node
environment but no global `testTimeout`, `hookTimeout`, or worker fallback. The
current package scripts and E2E group membership are consumed as-is. This
change does not alter those files unless the explicitly conditional worker rule
below is proven.

Vitest's generic 5,000 ms default is not a Hestia product SLA. Hestia tests
must continue to execute their full synchronous deterministic generation and
boundary work. The approved remedy is local declaration budget only.

## Exact local budgets

The implementation target is exactly
`apps/weltraum-browser/tests/unit/hestiaSeedDeterminism.test.ts`:

| Exact declaration | Local option | Evidence basis |
| --- | ---: | --- |
| `produces byte-identical channels and hashes for the same canonical input` | `{ timeout: 15_000 }` | Observed maximum is in the approved >6.5 s and <=10 s heavy band; local option is 15 s. |
| `changes canonical output when the root seed changes` | `{ timeout: 10_000 }` | Maximum 5.251 s. |
| `separates 0.25 and 0.50 metre generation keys, hashes, and physical extents` | `{ timeout: 10_000 }` | Maximum 4.891 s. |
| `keeps the exact seven-module Hestia V1 boundary deterministic and owner-neutral` | `{ timeout: 10_000 }` | Maximum 5.516 s. |

The four bodies must remain byte-identical: only the declaration options may
change. The helper, pinned canonical-content-hash, and invalid-input tests are
controls and receive no local timeout change. Existing unrelated local timeout
declarations are not reclassified by this change.

## Invariants

- No `testTimeout` or `hookTimeout` is added globally.
- No `skip`, `retry`, assertion, fixture, input, algorithm, or workload change
  is allowed.
- The Proving Ground receives no higher local timeout initially.
- Product runtime, browser behavior, package metadata, and lockfiles remain
  unchanged.
- Unit count, assertion count, hash equality/inequality, and invalid-input
  fail-closed behavior remain unchanged.

## Conditional worker fallback

After the local Hestia budgets are applied, run the three official parallel
full-unit-suite attempts in the test protocol. The governing gate is met when
at least one of those three official normal-parallel attempts fails exclusively
from a parallelism-dependent CPU timeout, with no assertion or product failure.
The observed sequence was PASS/timeout/PASS; the sole failure was a Proving
Ground 5 s CPU timeout with no assertions. This qualifies and authorizes
exactly the global Vitest `maxWorkers: 1` fallback.

The fallback must never be used to hide assertions, retries, skips, workload
failures, or product/browser failures. Any other failure stops the change for
diagnosis. No additional worker or global timeout setting is authorized.

The accepted blast radius of the authorized fallback is that `maxWorkers: 1`
serializes all 103 unit files / 968 tests. The measured full-suite cost is
approximately 125 seconds (125.31 s, 127.43 s, and 125.05 s in the three
serial runs); this cost is accepted by the handoff contract.

## User contract decision

PASS/timeout/PASS is an authorized normal-parallel outcome because at least one
official full-unit attempt failed exclusively from a parallelism-dependent CPU
timeout and had no assertion or product failure. The authorization is limited
to global `maxWorkers: 1` and does not change the exact four local budgets:
15,000 / 10,000 / 10,000 / 10,000 ms.

## Handoff sequence

1. Capture the exact current head and unit/E2E inventory.
2. Apply only the four local timeout options, preserving every test body.
3. Complete the five Hestia runs, three focused Proving Ground runs, three
   joint runs, and three official full-unit-suite attempts.
4. Apply exactly the global worker fallback because the governing gate is
   proven by PASS/timeout/PASS.
5. Complete the full exact-head matrix and record the independent review,
   final human gate, and completion-preflight status.
6. Only afterward perform separately authorized commit, push, and PR update.

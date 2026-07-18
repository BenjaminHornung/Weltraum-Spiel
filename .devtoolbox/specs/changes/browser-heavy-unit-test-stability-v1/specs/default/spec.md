# Capability: Browser Heavy Unit Test Stability V1

## Requirement: Hestia local timeout budgets

The auditable handoff is tracked by DevToolbox execution ID
`b38fb50323d641da9a3538c723413f68`. No immutable raw logs are retained; the
recorded commands, exit results, counts, and bounded summaries are the retained
evidence.

The Hestia determinism unit suite SHALL preserve its complete synchronous
workload and SHALL give only the four approved heavy declarations the local
budgets below:

| Test title | Timeout |
| --- | ---: |
| `produces byte-identical channels and hashes for the same canonical input` | 15,000 ms |
| `changes canonical output when the root seed changes` | 10,000 ms |
| `separates 0.25 and 0.50 metre generation keys, hashes, and physical extents` | 10,000 ms |
| `keeps the exact seven-module Hestia V1 boundary deterministic and owner-neutral` | 10,000 ms |

No other Hestia test declaration may receive a timeout change in the initial
pass.

### Scenario: Same canonical input

Given the canonical Hestia input, when the same-input test runs, then its
byte-identical channels and equal content hash assertions execute unchanged
and complete within 15,000 ms.

### Scenario: Changed seed

Given the approved alternate root seed, when the changed-seed test runs, then
its valid changed content hash and channel inequality assertions execute
unchanged and complete within 10,000 ms.

### Scenario: Resolution separation

Given the 0.25 m and 0.50 m inputs, when the separation test runs, then key
inequality, hash inequality, and exact physical-extent assertions execute
unchanged and complete within 10,000 ms.

### Scenario: Seven-module boundary

Given the Hestia V1 module directory and TypeScript boundary scan, when the
boundary test runs, then its exact module and owner-neutral dependency
assertions execute unchanged and complete within 10,000 ms.

## Requirement: No false SLA or workload weakening

The generic Vitest 5,000 ms default SHALL NOT be treated as a Hestia product
SLA. The implementation SHALL NOT add global `testTimeout` or `hookTimeout`,
skip or retry tests, reduce assertions, change fixtures or inputs, or reduce
the deterministic workload.

## Requirement: Proving Ground initial budget

The Proving Ground SHALL receive no higher local timeout in the initial pass.
Its focused and joint browser checks SHALL retain their existing timeout,
assertion, retry, and worker behavior.

## Requirement: Conditional serial-worker fallback

`maxWorkers: 1` MAY be added only when three official parallel full-unit-suite
attempts, made after the four Hestia local budgets, include at least one attempt
that fails exclusively from a parallelism-dependent CPU timeout, with no
assertion or product failure. PASS/timeout/PASS qualifies. The observed
PASS/timeout/PASS result therefore authorizes exactly global `maxWorkers: 1`.
Functional, assertion, skip, retry, browser, package, or product failures SHALL
stop the change rather than trigger the fallback. No additional worker or
global timeout setting is authorized.

### Scenario: Governing parallelism gate

Given three official normal-parallel full-unit attempts after the local Hestia
budgets, when the observed result is PASS/timeout/PASS and the sole timeout is
the Proving Ground 5 s CPU timeout with no assertions or product failure, then
the exact global `maxWorkers: 1` fallback is authorized.

## User contract decision

The explicit user decision is that one qualifying timeout is sufficient;
unanimous failure is not required. The authorization remains limited to the
global `maxWorkers: 1` fallback and the exact local budgets of 15,000 / 10,000 /
10,000 / 10,000 ms.

## Requirement: Regression and handoff gates

The complete handoff SHALL preserve the exact unit count, zero skips, zero
retries, package/lock integrity, 30/30 E2E assignment, Hestia 16/16 readiness,
same-input equal hashes, changed-seed different hashes, and browser health
0/0/0/0 in the order console errors / page errors / request failures / HTTP
errors. Scope and diff checks SHALL prove that no unrelated path changed.

The change SHALL pass independent review, the final human review gate, and
completion preflight before any separately authorized commit, push, or PR
update.

## Requirement: Handoff scope attribution

Current co-resident Playwright/live-spec changes SHALL be attributed to their
separate approved change. They SHALL be excluded from the unit commit and
shall not be counted as implementation scope or evidence for this change.

The E2E spec-file inventory SHALL remain distinct from test-case counts: 30/30
spec files assigned exactly once, split Core 17 / Live 9 / UI 4. The handoff
records the exact verification commands and exit results under execution ID
`b38fb50323d641da9a3538c723413f68`.

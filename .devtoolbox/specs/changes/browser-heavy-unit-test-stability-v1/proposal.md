# Proposal: Browser Heavy Unit Test Stability V1

## Motivation

The generic Vitest 5,000 ms default is a test-runner default, not a Hestia
product SLA. The Hestia generator and boundary tests intentionally perform the
full synchronous determinism workload. The stability change therefore gives
only the exact heavy declarations enough local budget to finish; it does not
reduce assertions, reduce workload, or change product behavior.

## Approved baseline

Audit reference: DevToolbox execution ID
`b38fb50323d641da9a3538c723413f68`. No immutable raw logs are retained; the
records in the execution and this protocol are the auditable handoff evidence.

Five exact Node 22 diagnostic runs passed. Each run reported one file, seven
tests, and 22 assertions. The maximum observed title times across those runs
were:

| Exact test title | Maximum |
| --- | ---: |
| `produces byte-identical channels and hashes for the same canonical input` | 6.818 s |
| `changes canonical output when the root seed changes` | 5.251 s |
| `separates 0.25 and 0.50 metre generation keys, hashes, and physical extents` | 4.891 s |
| `keeps the exact seven-module Hestia V1 boundary deterministic and owner-neutral` | 5.516 s |
| `pins a canonical generator content hash as a V1 drift guard` | 3.035 s |
| `pins FNV-1a32 domain separation, safe high-word lattice mixing, and noise helpers` | 5 ms |
| `fails closed for invalid seeds, IDs, brick coordinates, and unsupported voxel sizes` | 10 ms |

## Outcome

The four approved heavy declarations in
`apps/weltraum-browser/tests/unit/hestiaSeedDeterminism.test.ts` receive local
timeouts of 15,000 ms or 10,000 ms as specified by the design. Their test
bodies, inputs, assertions, and synchronous workload remain byte-identical.
The helper, pinned-hash, and invalid-input controls remain unchanged.
The official normal-parallel full-unit result was PASS/timeout/PASS; the sole
failure was a Proving Ground 5 s CPU timeout with no assertion or product
failure. This satisfies the governing gate and authorizes exactly the global
Vitest `maxWorkers: 1` fallback, with no other worker or timeout change.

## Scope

- Add only the four exact per-test timeout options approved in `design.md`.
- Preserve the existing unit count and the exact Hestia hash, extent, boundary,
  and invalid-input contracts.
- Prove stability under focused, joint, official full-suite, and exact-head
  verification.
- Use exactly global `maxWorkers: 1` under the governing fallback gate recorded
  in the design; no other worker or global timeout setting is authorized.

## Non-goals and prohibitions

- No global `testTimeout` or `hookTimeout`.
- No skip, retry, assertion, fixture, input, or workload reduction.
- No product, browser, E2E, Proving Ground, package, lockfile, or architecture
  change.
- No timeout increase for the Proving Ground on the initial pass.
- No additional implementation or configuration scope beyond the approved
  local declarations and the exact global `maxWorkers: 1` fallback.
- Current co-resident Playwright/live-spec changes belong to a separate
  approved change. They are excluded from this unit commit and are not part of
  this change's implementation scope.

## User contract decision

The fallback gate is satisfied when at least one of the three official
normal-parallel full-unit attempts fails exclusively from a
parallelism-dependent CPU timeout, with no assertion or product failure.
PASS/timeout/PASS qualifies. The decision authorizes exactly global
`maxWorkers: 1`; it does not authorize retries, skips, workload reduction, or
any additional timeout or worker change.

## Completion contract

Completion requires the exact test protocol, zero skips and retries, unchanged
package/lock integrity, 30/30 E2E assignment, Hestia 16/16 readiness, equal
same-input hashes, different changed-seed hashes, browser health 0/0/0/0,
scope/diff checks, independent review, final human review, and completion
preflight. Commit, push, and PR update remain a separately authorized final
step after those gates. This documentation-only handoff records the completed
implementation and evidence without creating a DevToolbox execution or
retaining immutable raw logs. The task checkboxes remain pending until
DevToolbox completion preflight; this records closure bookkeeping and does not
negate the completed implementation or evidence.

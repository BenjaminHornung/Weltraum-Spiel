# Test Protocol

This protocol records the completed implementation handoff and its auditable
verification results. The approved source/configuration changes and completed
evidence are described below; this document update adds no further product or
test operation.

Base HEAD for the unit implementation and unit evidence:
`d65c9c0ff67df14e33d89af965b1749892e6d2cc`.

Audit references: DevToolbox execution IDs
`b38fb50323d641da9a3538c723413f68` and
`44f56900913a434588a94a8757c5dbc7`. No immutable raw logs are retained;
summaries and notes in those execution records, plus the bounded results below,
are the retained audit evidence. No NEW execution was created in this
documentation pass.

The diagnostic runs, focused checks, official normal-parallel full-unit
attempts, and serial full-unit verification were run at the base HEAD above.
The unit diff was reviewed before the separate Playwright/sibling change was
present. The final combined E2E matrix ran with that separate live change
present, so it is integration evidence and not causal unit-fallback evidence.

## Required environment and invariants

- Run from `apps/weltraum-browser` unless a command says otherwise.
- Node MUST be 22.x.
- Preserve the exact pre-fix unit file/test/assertion inventory.
- Every required test run must report zero skips and zero retries.
- `package.json` and `package-lock.json` must remain byte-identical unless a
  separately approved requirement is discovered; this change has none.
- The E2E inventory must assign exactly 30/30 spec files once: Core 17, Live 9
  (including Hestia), and UI 4.
- The 30/30 spec-file inventory is distinct from test-case counts.
- Hestia browser readiness must be 16/16 requested/ready chunks, with failed,
  queue, and running counts settled at zero.
- Browser health is recorded as console errors / page errors / request
  failures / HTTP errors and must be exactly 0/0/0/0.

## Phase 1 — Five post-fix Hestia runs

Run the exact focused command five times, serially, under Node 22:

```powershell
npm run test -- tests/unit/hestiaSeedDeterminism.test.ts
```

For each run record the command, exit code, one-file count, seven-test count,
22-assertion count, title durations, skips, and retries. The four approved
heavy declarations must pass within 15,000 / 10,000 / 10,000 / 10,000 ms in
the order specified by the contract. The helper, pinned canonical hash, and
invalid-input controls must remain present and passing. Same canonical input
must produce equal channels/hashes; changed seed and 0.25/0.50 resolution must
produce the required unequal hashes; the seven-module boundary must remain
exact.

Recorded results for the exact command above: runs 1–5 each exited 0 and
reported 1 file / 7 tests / 22 assertions. The maxima across the five runs for
the four approved heavy declarations were 6.818 / 5.251 / 4.891 / 5.516 s;
the exact budgets remain 15,000 / 10,000 / 10,000 / 10,000 ms.

## Phase 2 — Three focused Proving Ground runs

Run the existing focused browser Proving Ground check three times, serially,
without adding a local timeout:

```powershell
npx playwright test tests/e2e/playable-large-proving-ground.spec.ts --reporter=list
```

Preserve its existing assertions, retry behavior, worker behavior, and
browser route. Record pass/fail, test count, skips, retries, and browser health.

Recorded results for the exact command above: runs 1–3 each exited 0 and
passed 24/24, with no skips or retries.

## Phase 3 — Three joint runs

Run Hestia and Proving Ground together three times, serially, without a higher
Proving Ground timeout:

```powershell
npx playwright test tests/e2e/hestia-microvoxel-surface-lab.spec.ts tests/e2e/playable-large-proving-ground.spec.ts --reporter=list
```

The Hestia route must retain equal same-seed brick/mesh hashes and different
changed-seed brick/mesh hashes. It must settle at 16/16 with failed, queue, and
running zero. The combined browser health must remain 0/0/0/0.

Recorded results for the exact command above: runs 1–3 each exited 0 and
passed 31/31. Hestia readiness was 16/16 with failed, queue, and running all
zero; browser health was 0/0/0/0.

## Phase 4 — Three official full-unit-suite attempts

Run the official full Vitest suite three times with normal parallelism before
applying the fallback:

```powershell
npm run test
```

Classify every failure. At least one of the three official normal-parallel
full-unit attempts failing exclusively from a parallelism-dependent CPU
timeout, with no assertion or product failure, authorizes exactly global
`maxWorkers: 1` in `vite.config.ts`. PASS/timeout/PASS qualifies. Any other
failure is a blocker and stops the change. If authorized, make only that
minimal fallback and rerun the full suite plus all affected focused checks.

## Phase 5 — Full exact-head matrix

Run the following fresh checks after the conditional decision:

```powershell
node --version
npm ci
npm run test
npm run build
npm run test:e2e:core
npm run test:e2e:live
npm run test:e2e:ui
npm run test:e2e
git diff --check
```

Also execute the repository's exact E2E inventory check and prove 30/30
assignment with no duplicate or unassigned spec. Inspect package/lock hashes,
unit counts, zero skips/retries, Hestia 16/16, same/different hash contracts,
browser 0/0/0/0, and the complete diff. Generated evidence must be restored or
explicitly accounted for; no test data is mutated.

## Review and closure

Run one independent technical review, then the final human review gate for the
overall change. Handle only confirmed in-scope feedback and rerun affected
verification after fixes. Run completion preflight before closing any task.
No DevToolbox execution is created under the current authorization; completion
preflight remains pending.

Commit, push, and PR update are separate final operations after review and
completion preflight. They are not part of this completed execution; completion
preflight remains pending.

## Results record

The implementation handoff must record PASS, FAIL, NOT RUN, or NOT APPLICABLE
for every check above, with command, exit code, counts, evidence path, blocker,
and residual risk. The task checkboxes remain pending until DevToolbox
completion preflight; that bookkeeping state does not change the completed
implementation or verification results below.

## Completed auditable results

- Diagnostic maxima for the four approved declarations: 6.818 / 5.251 /
  4.891 / 5.516 s, against the exact 15,000 / 10,000 / 10,000 / 10,000 ms
  budgets.
- Focused Hestia: PASS, 5 runs at 7/7. Focused Proving Ground: PASS, 3 runs
  at 24/24. Joint Hestia + Proving Ground: PASS, 3 runs at 31/31.
- Official normal-parallel full-unit attempts: PASS/timeout/PASS. The sole
  qualifying failure was a Vitest unit-suite Proving Ground 5 s CPU timeout,
  distinct from the Playwright Proving Ground check, which passed 24/24. No
  assertion or product failure was recorded; the governing gate therefore
  authorizes exactly global `maxWorkers: 1`. The exact unit file/title was not
  retained.
- Serial official full-unit verification: PASS, 3 runs of 103 files / 968
  tests at 125.31 s / 127.43 s / 125.05 s.

### Handoff audit record

Evidence sources: DevToolbox execution IDs
`b38fb50323d641da9a3538c723413f68` and
`44f56900913a434588a94a8757c5dbc7`. No immutable raw logs are retained; the
execution summaries/notes and this bounded result record are the retained
evidence.

- Serial full suite: PASS; three runs, each exit 0, each with 103 files / 968
  tests, at 125.31 s / 127.43 s / 125.05 s.
- Final matrix:
  - `npm ci`: PASS, exit 0.
  - `npx tsc -p tsconfig.json`: PASS, exit 0.
  - `npm run test`: PASS, exit 0, 103/968 files/tests.
  - `npm run build`: PASS, exit 0, 165 modules.
  - `npm run test:e2e:core`: PASS, exit 0, 30/30.
  - `npm run test:e2e:live`: PASS, exit 0, 14/14.
  - `npm run test:e2e:ui`: PASS, exit 0, 12/12.
  - `npm run test:e2e`: PASS, exit 0, workers 1, retries 0, 56/56.
- E2E inventory: PASS, 30/30 spec files assigned exactly once: Core 17,
  Live 9, UI 4.
- Hestia readiness: PASS, 16/16 requested/ready chunks; failed, queue, and
  running counts 0/0/0.
- Browser health: PASS, console errors / page errors / request failures /
  HTTP errors 0/0/0/0.
- Cross-checks: PASS; no skips, no retries, evidence clean, and
  `package.json` / `package-lock.json` unchanged.

## Contract result matrix

Each command/result below includes its status, exit code, evidence source,
blocker, and residual risk. The matrix records evidence; it does not rerun
tests or create test data.

| Check | Result / exit | Evidence source | Blocker | Residual risk |
| --- | --- | --- | --- | --- |
| `node --version` | PASS / 0; Node 22 | execution summaries/notes | none | exact raw environment log not retained |
| `npm ci` | PASS / 0 | execution summaries/notes | none | immutable install log not retained |
| `npx tsc -p tsconfig.json` | PASS / 0 | execution summaries/notes | none | none recorded |
| `npm run test` serial verification | PASS / 0; 3 × 103 files / 968 tests | execution summaries/notes | none | exact unit timeout file/title not retained |
| `npm run build` | PASS / 0; 165 modules | execution summaries/notes | none | none recorded |
| `npm run test:e2e:core` | PASS / 0; 30/30 | execution summaries/notes | none | final E2E evidence includes the separate live change |
| `npm run test:e2e:live` | PASS / 0; 14/14 | execution summaries/notes | none | final E2E evidence includes the separate live change |
| `npm run test:e2e:ui` | PASS / 0; 12/12 | execution summaries/notes | none | final E2E evidence includes the separate live change |
| `npm run test:e2e` | PASS / 0; 56/56, workers 1, retries 0 | execution summaries/notes | none | integration evidence, not causal unit-fallback evidence |
| E2E inventory | PASS; 30/30 exactly once (Core 17, Live 9, UI 4) | execution summaries/notes | none | no immutable inventory log retained |
| Hestia readiness | PASS; 16/16, failed/queue/running 0/0/0 | execution summaries/notes | none | no immutable readiness log retained |
| Browser health | PASS; console/page/request/HTTP 0/0/0/0 | execution summaries/notes | none | no immutable browser log retained |
| Package/lock integrity | PASS; unchanged | execution summaries/notes | none | no hash artifact retained |
| `git diff --check` | PASS / 0 | current handoff diff-check | none | scoped to this handoff verification |
| Independent technical review | NOT RUN | no execution created in docs pass | review remains pending | no independent review findings available |
| Final human review gate | NOT RUN | no review gate run | approval remains pending | human approval unavailable |
| Completion preflight | NOT RUN | no NEW execution created in docs pass | preflight remains pending | task closure is not authorized |
| Commit, push, PR update | NOT APPLICABLE | separately authorized publication only | not authorized | publication state unchanged |

### Explicit residual limitation

The exact Vitest unit file and test title for the qualifying Proving Ground 5 s
CPU timeout were not retained. The causal classification therefore relies on
the retained execution summaries/notes rather than an immutable raw log or a
file/title-level replay. This is the explicit residual limitation; it does not
change the separate Playwright result of 24/24 or the serial unit result.

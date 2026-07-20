# Test Protocol

This protocol belongs only to `browser-live-e2e-concurrency-stability-v1` and
records the completed evidence handoff. The existing uncommitted
`browser-heavy-unit-test-stability-v1` artifacts are not touched. The approved
implementation contract remains local workers=2 and CI workers=1; this Markdown
edit makes no Playwright config/test changes and creates no DevToolbox
execution.

## Recorded baseline: worker sweep

The following sweep is approved evidence:

| Workers | Run | Result | Duration | Retries | Skips | Port 5173 after run |
| ---: | ---: | --- | ---: | ---: | ---: | --- |
| 4 | 1 | FAIL 13/14, Hestia HUD startup timeout | 173.711 s | 0 | 0 | Free |
| 4 | 2 | PASS 14/14 | 205.446 s | 0 | 0 | Free |
| 4 | 3 | FAIL 13/14, Proving Ground teardown timeout | 204.722 s | 0 | 0 | Free |
| 2 | 1 | PASS 14/14 | 200.275 s | 0 | 0 | Free |
| 2 | 2 | PASS 14/14 | 166.973 s | 0 | 0 | Free |
| 2 | 3 | PASS 14/14 | 154.764 s | 0 | 0 | Free |

The two workers=4 failures are timeout-only: one Hestia HUD startup timeout
and one Proving Ground teardown timeout. There were no assertion or product
failures. Workers=2 passed 3/3 at 14/14. The selected local limit is 2. The
approved implementation contract is only:

```ts
workers: process.env.CI === "true" ? 1 : 2
```

Record that `fullyParallel`, retries, timeouts, webServer, browser projects,
and test files are unchanged.

## Final evidence integrity

The final clean evidence state is recorded from the worktree root:

```powershell
git status --short -- apps/weltraum-browser/evidence
git diff --quiet -- apps/weltraum-browser/evidence
git diff --cached --quiet -- apps/weltraum-browser/evidence
```

Result: PASS — evidence status is zero; staged and unstaged diffs are empty
after normalization. No evidence content was changed, generated, staged, or
committed.

## Official live runs: three repetitions

Run the official local live group three times from `apps/weltraum-browser` with
CI unset and no CLI workers override. These invocations exercise the local
config value workers=2:

```powershell
Remove-Item Env:CI -ErrorAction SilentlyContinue
npm run test:e2e:live
npm run test:e2e:live
npm run test:e2e:live
```

There is no CLI `--workers` override and no other environment override. Each
run must pass 14/14 with zero retries and skips, leave port 5173 free, and
report Hestia 16/16 with failed, queue, and running zero. Same-seed brick/mesh
hashes must be equal and changed-seed brick/mesh hashes must differ. Browser
health must be 0/0/0/0: console errors, page errors, request failures, HTTP
errors.

## Combined matrix

Run all existing official groups and aggregate discovery once after the three
live runs:

```powershell
npm run test:e2e:core
npm run test:e2e:live
npm run test:e2e:ui
npm run test:e2e
```

Run the repository's exact membership validator and prove exactly 30/30 E2E
spec files assigned once: Core 17, Live 9, UI 4. The 9 Live spec files contain
14 tests. Record all counts, retries, and skips; a failed group must not hide
later diagnostics.

## Package, lock, and scope checks

Run fresh, proportionate checks without mutating evidence:

```powershell
npm run test
npm run build
```

Confirm package and lock content is unchanged, no Playwright test changed, no
evidence content changed, and only the approved config edit plus this change's
five Markdown artifacts are present. The pre-existing heavy-unit-test change
must remain present and untouched.

## Contingency and stop rules

No Hestia bootstrap wait is currently needed. Propose it only if workers=2
produces a reproducible bootstrap-only failure and review separates that cause
from product, browser, port, assertion, or evidence failures. Otherwise stop;
do not add it.

The known separate P2 `Preserve inputs when generation cannot start` remains a
merge blocker after this change and is not fixed here.

## Review and publication

Run separate reviewer and reviewer-GLM reviews, resolve only confirmed
in-scope findings, run completion preflight, and pass one combined human final
gate. If human feedback changes files, rerun affected verification. Only after
all gates pass may exactly two separately authorized commits occur. No commit,
push, PR update, or merge is performed by this documentation handoff.

## Auditable results record

The completed approved evidence is:

| Check | Result | Recorded evidence |
| --- | --- | --- |
| Official no-override local live run 1 | PASS | 14/14, 143.338 s, zero retries/skips, port 5173 free |
| Official no-override local live run 2 | PASS | 14/14, 125.808 s, zero retries/skips, port 5173 free |
| Official no-override local live run 3 | PASS | 14/14, 142.913 s, zero retries/skips, port 5173 free |
| Hestia live contract | PASS | 16/16; failed/queue/running 0/0/0 |
| Browser health | PASS | 0/0/0/0: console/page/request/HTTP errors |
| `npm ci` | PASS | package and lock content unchanged |
| TypeScript | PASS | `tsc` |
| Unit suite | PASS | 103 files / 968 tests |
| Build | PASS | 165 |
| Core E2E | PASS | 30 |
| Live E2E | PASS | 14 |
| UI E2E | PASS | 12 |
| Full E2E | PASS | 56 |
| E2E inventory | PASS | 30 spec files exactly once: Core 17, Live 9, UI 4; 9 Live files contain 14 tests |
| Evidence integrity | PASS | zero evidence status; staged and unstaged diffs empty after normalization |

The combined matrix had no skips and no retries. Same-seed brick/mesh hashes
were equal, changed-seed hashes differed, and port 5173 was free after every
recorded live run. The workers=4 failures remain classified as timeout-only
(Hestia HUD startup and Proving Ground teardown), with no assertion or product
failure and no root-cause expansion.

Completion preflight, technical review, reviewer-GLM review, and the combined
human final gate are NOT RUN in this documentation handoff. Task boxes remain
pending until completion preflight; the known separate P2 remains a merge
blocker. Residual risk is limited to the recorded workers=4 timeout-only
instability and the unexecuted review/preflight gates.

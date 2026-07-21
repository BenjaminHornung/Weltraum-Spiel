# Test Protocol: Browser IndexedDB Save Repository Core V1 Main-Drift Integration

## Evidence state

Overall status: **PENDING**.

The integration is being rebased by merge onto the latest current main. The merge
is in progress and not committed. All verification, DevToolbox completion, and
local review evidence recorded before this drift is retained below only as
**SUPERSEDED/HISTORICAL**. No final merge SHA, PR, or exact-head review is claimed.

## Source control and drift

- Initial main SHA: `f6d3fe69175b168ddea5e385c6d7b3452e6cba16`
- Final current-main SHA: `33c019d2249fbbe3bfb0bdcf6ebbc5e1899a8e0e`
- Feature path source: `7b920eee22654698c75037a6b2287225ec5c46da`
- Pre-drift integration commit: `29861b785ce18d57e8379eb48ebd61f54769f5e5`
- Main drift: 7 commits
- Merge state: **IN PROGRESS / NOT COMMITTED**
- Final post-drift integration SHA: **PENDING**

The only merge conflict was `apps/weltraum-browser/package.json`. It was resolved
minimally so both `browser-storage-save-repository.spec.ts` and
`tests/e2e/simulation-scheduler-core.spec.ts` occur exactly once in `test:e2e:core`.
Unrelated generated evidence was restored to the merge index.

The working merge diff against `33c019d2249fbbe3bfb0bdcf6ebbc5e1899a8e0e`
contains only the Save Repository Core integration scope. Scope audit: **PASS**.

## Fresh post-drift Node 22 verification

- Node: `22.23.1`
- Chrome for focused and core E2E: `150.0.7871.129`
- Working directory: `apps/weltraum-browser`

| Gate | Status | Result |
| --- | --- | --- |
| `npx tsc -p tsconfig.json` | PASS | TypeScript completed successfully |
| Five focused Vitest files, `--maxWorkers=1` | PASS | 5/5 files, 54/54 tests, 2.17 s |
| `npm run test -- --maxWorkers=1` | PASS | 112/112 files, 1091/1091 tests, 101.75 s |
| `npm run build` | PASS | 165 modules, Vite phase 1.46 s; existing chunk warning only |
| Focused browser-storage E2E run 1 | PASS | 4/4, 1 worker, 0 retries; run 11.201 s |
| Focused browser-storage E2E run 2 | PASS | 4/4, 1 worker, 0 retries; run 11.098 s |
| Clean `test:e2e:core` rerun | PASS | 36/36, 1 worker, 0 retries; 72.6 s |
| Final port cleanup | PASS | 0 listeners on port 5173 |

The first core-E2E attempt ran 0 tests because a transient leftover listener still
held port 5173. The listener exited naturally; no process was killed. The clean
serial rerun then passed 36/36.

## Deterministic browser evidence

Both focused post-drift runs reproduced the unchanged deterministic evidence:

- JSON SHA-256: `17A637414095211350253FE263B110561CC796EDCD67153DB0C5968BC7054935`
- Markdown SHA-256: `8BFC28E7CEB930F4C422B37736C4628ABF1C15365B68C54F92B6CD2B15DBAFD8`

The evidence continues to prove route `/`, absent `window.TestBridge`, IndexedDB
reload persistence, stale CAS preservation, exact +1 revision, export/import,
checksum-corruption detection, zero remaining slots, database deletion, and empty
console, page, request, and HTTP error arrays.

## Fresh post-drift DevToolbox verification

- Execution: `8855f699ac0e4850bf81205c2c82d8aa`
- Execution status: **VERIFIED**
- Verification operation: `75f376583fe6440e86dddb99d9558b2c`
- Operation status: **COMPLETED/SUCCEEDED**
- Completed at: `2026-07-21T05:40:05.899Z`
- Specs: **PASS**
- Test: **PASS**, exit 0 - 112/112 files, 1091/1091 tests, 90.46 s
- Build: **PASS_WITH_WARNING**, exit 0 - 165 modules, Vite 1.13 s
- Summary: 2 passed, 1 warning, 0 failed, 0 skipped
- Warnings: known Vite chunk-size and local npm user-config warnings only

## Fresh post-drift local review

- Verdict: **READY**
- P1: **0**
- P2: **0**

Non-blocking P3 residuals:

1. exact product-internal blocked-open message assertion as test coupling;
2. duplicated CAS, revision, import, and metadata transition logic between Memory
   and IndexedDB adapters as a future parity risk.

## Fresh post-drift completion

- `specs_validate`: **PASS**
- Completion preflight ID: `6ba2a46724614826b0d58b0ff04182b4`
- Completion preflight status: **PASS**
- `canProceed`: `true`
- Task 5.1: **CLOSED**

## Superseded pre-drift evidence

Status: **SUPERSEDED/HISTORICAL**

The pre-drift integration had passed 54/54 focused units, 1053/1053 full units,
165-module build, two focused 4/4 E2E runs, 35/35 core E2E, lifecycle/version
regressions, and its then-current scope audit.

Historical DevToolbox records:

- Execution: `8855f699ac0e4850bf81205c2c82d8aa`, status `VERIFIED`
- Verification operation: `df1d3f1f17f54371977ba4e6d908931c`,
  `COMPLETED/SUCCEEDED`
- Historical completion preflight:
  `65f22c48d2e0497c9796454bd1e14829`, PASS, `canProceed: true`
- Historical Task 5.1 state: CLOSED
- Historical local final review: READY, P1=0, P2=0

Historical non-blocking P3 residuals were:

1. exact product-internal blocked-open message assertion as test coupling;
2. duplicated CAS, revision, import, and metadata transition logic between Memory
   and IndexedDB adapters as a future parity risk.

None of these pre-drift closure results closes the post-drift gates.

## Pending post-drift gates

- Final post-drift integration SHA: **PENDING**
- PR creation: **PENDING**
- PR exact-head Codex review: **PENDING**

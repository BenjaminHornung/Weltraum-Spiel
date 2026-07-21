# Test Protocol: Browser IndexedDB Save Repository Core V1 Integration

## Evidence state

This protocol describes the current-main integration branch only. The historical
feature-branch closure evidence is **SUPERSEDED** because that branch also contained
the separate `browser-vitest-cpu-contention-stability` scope.

Overall integration status: **PENDING**. The recorded test, scope, DevToolbox, and
completion gates passed, but the final integration commit, PR creation, and
exact-head review are not complete.

## Source control baseline

- Integration branch: `feature/browser-indexeddb-save-repository-core-v1-integration`
- Current-main base: `f6d3fe69175b168ddea5e385c6d7b3452e6cba16`
- Historical path source: `7b920eee22654698c75037a6b2287225ec5c46da`
- Merge base: `5ff47aeef3c42c0b933e8480dafa5680759a40df`
- Main/feature divergence at audit: `38/1`
- Pre-commit integration HEAD: equal to the current-main base
- Final integration SHA: **PENDING**; record it only after the integration commit

The historical commit was not merged or cherry-picked. Only the Save Repository
Core allowlist was reapplied.

## Environment

- Node: `22.23.1`
- npm: `11.13.0`
- Chrome: `150.0.7871.129`
- Working directory for npm commands: `apps/weltraum-browser`

## Recorded current-main verification

| Gate | Status | Result |
| --- | --- | --- |
| `npm ci` | PASS | 59 packages, 0 vulnerabilities |
| `npx tsc -p tsconfig.json` | PASS | TypeScript completed successfully |
| Five focused Vitest files, `--maxWorkers=1` | PASS | 5/5 files, 54/54 tests, 1.82 s |
| `npm run test -- --maxWorkers=1` | PASS | 109/109 files, 1053/1053 tests, 109.89 s |
| `npm run build` | PASS | 165 modules, Vite phase 1.14 s; known chunk-size warning only |
| `npm run test:e2e:core -- --workers=1 --retries=0` | PASS | 35/35 tests, 64.7 s |
| Focused browser-storage E2E run 1 | PASS | 4/4, 1 worker, 0 retries; run 11.7 s |
| Focused browser-storage E2E run 2 | PASS | 4/4, 1 worker, 0 retries; run 11.5 s |
| Port cleanup | PASS | 0 listeners on port 5173 after tests |

The focused unit command covers:

- `tests/unit/browserStorageCodec.test.ts`
- `tests/unit/browserStorageCorruption.test.ts`
- `tests/unit/browserStorageImportExport.test.ts`
- `tests/unit/browserStorageMemoryRepository.test.ts`
- `tests/unit/browserStorageRevision.test.ts`

## Browser acceptance evidence

The deterministic app evidence records a successful run on route `/` with
`window.TestBridge` absent. IndexedDB reload persistence, stale CAS rejection,
an exact revision increment of one, export/import, and controlled checksum
corruption detection all passed. Cleanup recorded zero remaining slots, complete
database deletion, and empty console, page, request, and HTTP error arrays.

- JSON evidence SHA-256: `17A637414095211350253FE263B110561CC796EDCD67153DB0C5968BC7054935`
- Markdown evidence SHA-256: `8BFC28E7CEB930F4C422B37736C4628ABF1C15365B68C54F92B6CD2B15DBAFD8`

## E2E grouping and scope audit

The focused spec `tests/e2e/browser-storage-save-repository.spec.ts` is assigned
exactly once, to `test:e2e:core`. The complete inventory contains 32 actual E2E
specs and 32 assignments: core/live/ui = 19/9/4, with zero duplicates, ungrouped
specs, or stale entries.

Current scope evidence:

- 28 changed paths, 0 allowlist violations;
- forbidden imports: 0;
- secret filename hits: 0;
- `git diff --check`: PASS;
- `apps/weltraum-browser/package.json` changed only for the E2E assignment;
- `package-lock.json`, `src/persistence/**`, and `Assets/**`: unchanged;
- `apps/weltraum-browser/vite.config.ts`: explicitly excluded and unchanged;
- `.devtoolbox/specs/changes/browser-vitest-cpu-contention-stability/**`:
  explicitly excluded and unchanged.

Current main already provides the equivalent `test.maxWorkers: 1` rule. No
Vitest CPU Contention Stability change was integrated.

## Lifecycle and version regression proof

Status: **PASS**

The fresh focused proof covers connection closure on `versionchange`, blocked
open, blocked delete, future IndexedDB database version, future repository marker,
and terminal `close` behavior.

## DevToolbox verification

- Execution: `8855f699ac0e4850bf81205c2c82d8aa`
- Execution status: **VERIFIED**
- Current operation: `df1d3f1f17f54371977ba4e6d908931c`
- Operation status: **COMPLETED/SUCCEEDED**
- Completed at: `2026-07-20T20:10:19Z`
- Specs: **PASS**
- Test: **PASS**, exit 0 - 109/109 files, 1053/1053 tests, 109.94 s
- Build: **PASS_WITH_WARNING**, exit 0 - 165 modules, Vite 0.778 s
- Summary: 2 passed, 1 warning, 0 failed, 0 skipped
- Warning scope: the known Vite chunk-size warning and local npm user-config
  warnings only

This is the current authoritative DevToolbox verification. It is supporting
evidence, not Node 22 runtime authority; the explicit local Node 22 gates recorded
above remain authoritative.

## DevToolbox completion

- Completion preflight: **PASS**
- Preflight ID: `65f22c48d2e0497c9796454bd1e14829`
- `canProceed`: `true`
- Generated at: `2026-07-20T20:12:24Z`
- Task 5.1: **CLOSED**
- Post-toggle `specs_validate`: **PASS**, 5 tasks parsed

## Local final review

- Status: **COMPLETED**
- Verdict: **READY**
- P1: **0**
- P2: **0**
- Earlier P2 findings resolved: **2**
  - stale historical test artifacts;
  - missing lifecycle/version regression proof.

Non-blocking P3 residuals:

1. The blocked-open test asserts the exact product-internal message, which creates
   test coupling to message wording.
2. CAS, revision, import, and metadata transition logic is duplicated between the
   Memory and IndexedDB adapters, creating a future semantic-parity risk.

## Pending gates

- Final integration commit SHA: **PENDING**.
- PR creation: **PENDING**.
- PR exact-head Codex review: **PENDING**, after PR creation.

The local `READY` verdict does not claim a final commit or PR result. Do not
classify the branch as merge-ready until every pending gate passes.

# Tasks: Browser IndexedDB Save Repository Core V1

Tasks remain unchecked until implementation evidence, DevToolbox verification, review where required, and tasks_completion_preflight pass. The approved branch is feature/browser-indexeddb-save-repository-core-v1 from origin/main at 5ff47aeef3c42c0b933e8480dafa5680759a40df.

## 1. Contracts, codec, checksum, and memory repository

- [x] Task 1.1 — Implement the shared repository core and memory adapter
  - Objective: Define the complete V1 public contract and prove canonical, checksummed, copy-isolated, CAS-safe memory semantics.
  - Files/search targets: apps/weltraum-browser/src/browser-storage/ids.ts, types.ts, errors.ts, canonical.ts, checksum.ts, codec.ts, saveRepository.ts, memorySaveRepository.ts, index.ts; tests/unit/browserStorageCodec.test.ts, browserStorageMemoryRepository.test.ts, browserStorageRevision.test.ts, browserStorageCorruption.test.ts; consume src/persistence/** without editing it.
  - Acceptance: Required public types, methods, and error codes exist; SHA-256 uses exact UTF-8 bytes; future and invalid envelopes fail closed; caller or read mutation cannot change stored state; create, update, delete CAS and failed-write rollback match the spec; deterministic list and slot validation are tested; no DOM or Three.js dependency in codec or memory.
  - Implementation guidance: Inject immutable DefinitionResolutionSnapshot data; validate before mutation; store copied bytes rather than caller objects; map input versus stored corruption deliberately; keep product API free of test hooks.
  - Required skills/MCPs: subagent-driven-development, verification-before-completion, devtoolbox-specs-execution; DevToolbox lifecycle remains controller-owned.
  - Verification: Node 22; npx tsc -p tsconfig.json; four focused Vitest files; import scan for DOM and Three.js in codec and memory.
  - Report back: changed files, contract summary, tests with pass counts, assumptions, blockers, and any spec deviation.
  - Stopping rule: stop without committing if existing persistence must change, a package dependency is required, or canonical validation cannot be performed from injected snapshots.

## 2. IndexedDB and import/export

- [x] Task 2.1 — Implement the production IndexedDB adapter and versioned bundles
  - Objective: Add reload-capable IndexedDB V1 persistence with atomic CAS and validated conflict-safe import/export.
  - Files/search targets: apps/weltraum-browser/src/browser-storage/indexedDbSaveRepository.ts, exportImport.ts, index.ts; tests/unit/browserStorageImportExport.test.ts; focused additions only to new browserStorage tests.
  - Acceptance: Configurable DB ID and default, version 1, both required stores and schema marker; fail-closed future version; one-transaction read, compare, put, or delete; stable error mapping; terminal close; all three import policies; hash and envelope validation before transaction; no silent overwrite or partial state.
  - Implementation guidance: Resolve writes only on transaction completion; handle blocked, versionchange, and quota; clone typed arrays; keep policy logic shared where possible with memory semantics; do not add fake-indexeddb or package changes.
  - Required skills/MCPs: subagent-driven-development, systematic-debugging if tests fail, verification-before-completion, devtoolbox-specs-execution.
  - Verification: Node 22; TypeScript; all five focused browserStorage Vitest files.
  - Report back: schema, transaction boundaries, error mappings, import policy behavior, changed files, test results, and remaining browser-only risk.
  - Stopping rule: stop if atomic CAS would require multiple transactions, browser exceptions leak publicly, or package files would need modification.

## 3. Browser acceptance, evidence, and documentation

- [x] Task 3.1 — Prove real reload persistence and corruption detection
  - Objective: Implement the focused Playwright scenario and deterministic evidence and documentation.
  - Files/search targets: apps/weltraum-browser/tests/e2e/browser-storage-save-repository.spec.ts; apps/weltraum-browser/evidence/browser-indexeddb-save-repository-core-v1-summary.json and .md; docs/browser-mainline/indexeddb-save-repository-core-v1.md.
  - Acceptance: Normal route, TestBridge absent, dynamic import, isolated fixed DB deletion, Slot A write, read, and signature, reload and read, stale and correct CAS, export and import Slot B, controlled raw corruption, expected error, slot cleanup, full DB deletion, and empty console, page, request, and HTTP failure arrays. Evidence contains no screenshot, timing, wall-clock, user or product data, or machine path.
  - Implementation guidance: Register health listeners before navigation; await delete success, error, or blocked; close every connection; write evidence only after assertions; do not alter package E2E groups.
  - Required skills/MCPs: playwright, verification-before-completion, devtoolbox-specs-execution; browser-debugger for real browser evidence.
  - Verification: Node 22; npm run test:e2e -- tests/e2e/browser-storage-save-repository.spec.ts; deterministic evidence and cleanup audit.
  - Report back: browser steps, pass count, health arrays, DB cleanup result, evidence paths, and any environment workaround.
  - Stopping rule: stop if the test database cannot be isolated and deleted, the normal route exposes TestBridge, or unrelated browser failures cannot be separated without forbidden edits.

## 4. Review, regression, scope, and Git closure

- [x] Task 4.1 — Complete review and full verification
  - Objective: Establish spec compliance, code quality, full regression safety, deterministic evidence, and scope hygiene before Git completion.
  - Files/search targets: complete branch diff, all files above, approved and forbidden path lists.
  - Acceptance: reviewer and reviewer-glm have no unresolved concrete findings; focused TypeScript, unit, E2E, and full unit, build, E2E pass under Node 22; git diff --check passes; only approved paths changed; DevToolbox verify and completion preflight pass.
  - Implementation guidance: findings first by severity with file references; route fixes to the responsible implementation lane; rerun focused review and tests after fixes; do not accept unverified risk silently.
  - Required skills/MCPs: requesting-code-review, devtoolbox-review, maintainability-decay-review, verification-before-completion, devtoolbox-specs-execution.
  - Verification: npm ci; npx tsc -p tsconfig.json; each of five focused unit files; focused E2E; npm run test; npm run build; npm run test:e2e; git diff --check; scope audit.
  - Report back: findings disposition, exact commands and results and pass counts, evidence paths, changed-path audit, and remaining limitations.
  - Stopping rule: do not commit or push if any required verification fails, a forbidden path changed, DevToolbox reports unauthorized_path, or a material finding remains unresolved.

## Git completion after Task 4.1

Historical feature-branch closure only: this instruction is superseded for the current-main integration by Task 5.1 and its Git completion section below.
## 5. Current-main integration

- [x] Task 5.1 - Integrate the Save Repository Core onto current main
  - Objective: Reapply only the approved Save Repository Core paths onto current origin/main, add the focused E2E exactly once to test:e2e:core, and produce fresh current-main evidence.
  - Files/search targets: the existing browser-storage implementation, browserStorage unit tests, focused E2E, Save-Core docs/evidence, this DevToolbox change, and apps/weltraum-browser/package.json only for E2E grouping.
  - Acceptance: current Persistence exports remain authoritative and unchanged; package-lock.json, vite.config.ts, browser-vitest-cpu-contention-stability, Unity/Assets, and all other paths remain unchanged; Node 22 gates, two serial focused E2E runs, scope/import/secret scans, fresh verification, and completion preflight pass.
  - Verification: npx tsc -p tsconfig.json; five focused browserStorage Vitest files with --maxWorkers=1; npm run test -- --maxWorkers=1; npm run build; npm run test:e2e:core -- --workers=1 --retries=0; two focused Playwright runs with --workers=1 --retries=0; diff and inventory audits.
  - Report back: base/source/integration SHAs, exact changed paths, exclusions, counts, browser/Node versions, cleanup evidence, review result, and remaining risks.
  - Stopping rule: stop without broadening scope if Persistence must change, a lockfile or package dependency is required, a forbidden path appears, or a required verification/review gate cannot pass.

## Git completion after Task 5.1

After all integration gates pass, commit on feature/browser-indexeddb-save-repository-core-v1-integration, push only that branch, create a pull request, and run exact-head review. Do not merge or force-push.

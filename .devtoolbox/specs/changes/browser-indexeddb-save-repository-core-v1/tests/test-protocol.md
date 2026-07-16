# Test Protocol: Browser IndexedDB Save Repository Core V1

## Baseline and environment

- Branch: feature/browser-indexeddb-save-repository-core-v1
- Base: origin/main SHA 5ff47aeef3c42c0b933e8480dafa5680759a40df
- Runtime: Node 22 only.
- Working directory for npm commands: apps/weltraum-browser.
- Package files and E2E script groups must remain unchanged.
- The real browser test uses only a fixed feature-specific test database and must delete it before and after the scenario.

## Required commands

Run fresh and record exit codes and pass counts:

- npm ci
- npx tsc -p tsconfig.json
- npm run test -- tests/unit/browserStorageCodec.test.ts
- npm run test -- tests/unit/browserStorageMemoryRepository.test.ts
- npm run test -- tests/unit/browserStorageRevision.test.ts
- npm run test -- tests/unit/browserStorageCorruption.test.ts
- npm run test -- tests/unit/browserStorageImportExport.test.ts
- npm run test:e2e -- tests/e2e/browser-storage-save-repository.spec.ts
- npm run test
- npm run build
- npm run test:e2e
- From repository root: git diff --check and an approved-path scope audit.

## Mandatory unit matrix

1. canonical encode and decode roundtrip;
2. stable hash;
3. caller mutation after write does not alter storage;
4. read-result mutation does not alter storage;
5. new slot creation;
6. stale revision rejection;
7. correct revision increment;
8. wrong delete revision rejection;
9. corrupt payload detection;
10. wrong hash detection;
11. future repository version rejection;
12. future save version rejection;
13. RejectIfExists import;
14. ReplaceExpectedRevision import;
15. failed write preserves old record;
16. deterministic list sorting;
17. slot ID validation;
18. NaN and Infinity rejection;
19. no mutation of caller inputs;
20. no DOM or Three.js dependency in codec or memory adapter.

## Browser acceptance protocol

The focused Playwright test must:

1. register console, pageerror, requestfailed, and HTTP 400 or greater collectors before navigation;
2. load / and prove window.TestBridge absent;
3. dynamically import /src/browser-storage/index.ts;
4. await deletion of the fixed test database before use;
5. initialize the repository and write, read, and signature-check Slot A;
6. close, reload, reopen, and read the same slot;
7. reject a stale write and accept the exact revision;
8. export Slot A and import and verify Slot B;
9. mutate one stored record directly and observe CorruptRecord or ChecksumMismatch;
10. delete slots, close connections, and await complete database deletion;
11. assert all health arrays empty.

No product or user database name or default product database may be used by the test.

## Evidence contract

Expected files:

- apps/weltraum-browser/evidence/browser-indexeddb-save-repository-core-v1-summary.json
- apps/weltraum-browser/evidence/browser-indexeddb-save-repository-core-v1.md

Evidence is written only after assertions pass. It must be deterministic, JSON-safe, and contain feature, route and module load, database-isolation identifier, schema and store summary, revision and CAS outcome, reload outcome, export and import outcome, corruption outcome, cleanup outcome, health arrays, and PASS status. It must not contain screenshots, timestamps, durations, machine paths, random values, raw exceptions, or user or product save data.

## Scope audit

Only these groups may differ from base:

- .devtoolbox/specs/changes/browser-indexeddb-save-repository-core-v1/**
- .devtoolbox/specs/changes/browser-vitest-cpu-contention-stability/**
- apps/weltraum-browser/src/browser-storage/**
- apps/weltraum-browser/tests/unit/browserStorage*.test.ts
- apps/weltraum-browser/tests/e2e/browser-storage-save-repository.spec.ts
- apps/weltraum-browser/evidence/browser-indexeddb-save-repository-core-v1*
- apps/weltraum-browser/vite.config.ts
- docs/browser-mainline/indexeddb-save-repository-core-v1.md

The sibling DevToolbox change and vite.config.ts are allowed only for the already-approved browser-vitest-cpu-contention-stability dependency: vite.config.ts may differ solely by test.maxWorkers: 1, and that sibling change authorizes no separate commit. Both change groups therefore reach Git closure together through this Task 4.1 flow after explicit user confirmation.

Any other changed path is a completion blocker. In particular package files, main and style, persistence and runtime, voxel, world-generation, surface-lab, planet, GitHub, infra, roadmap, and other agents' document and concept-art paths must remain unchanged.

## Completion gate

Tasks may be checked only after fresh evidence, DevToolbox verification, tasks_completion_preflight, review disposition, and scope audit pass. Commit and push are forbidden while any required command or material review finding fails.

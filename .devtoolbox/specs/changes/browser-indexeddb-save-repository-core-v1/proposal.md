# Proposal: Browser IndexedDB Save Repository Core V1

## Problem

The browser mainline has a strict, deterministic SaveGameEnvelopeV1 contract but no product storage boundary. Saving directly through IndexedDB without a repository contract would risk partial writes, silent last-write-wins updates, mutable caller references, future-version misreads, and browser-specific exceptions leaking into product code.

## Outcome

Add a versioned, fail-closed save repository core with two adapters:

- a production IndexedDB adapter with reload persistence;
- an in-memory adapter with identical domain semantics for unit tests.

Both adapters expose slot listing, validated reads, atomic compare-and-swap writes and deletes, checksums, corruption detection, versioned import/export, and stable product error codes.

## Scope

- New implementation only under apps/weltraum-browser/src/browser-storage/**.
- New unit tests only under apps/weltraum-browser/tests/unit/browserStorage*.test.ts.
- One focused Playwright spec at apps/weltraum-browser/tests/e2e/browser-storage-save-repository.spec.ts.
- Deterministic evidence under apps/weltraum-browser/evidence/browser-indexeddb-save-repository-core-v1*.
- Mainline documentation at docs/browser-mainline/indexeddb-save-repository-core-v1.md.
- Consume existing SaveGameEnvelopeV1 validation/canonical serialization without modifying src/persistence/**.

## Non-Goals

- No save/load UI.
- No live game-runtime wiring, automatic saves, offline simulation, cloud synchronization, multiplayer authority, or migration beyond repository schema version 1.
- No LocalStorage fallback.
- No compression or encryption in V1.
- No silent repair, coercion, defaulting of corrupted required fields, or last-write-wins policy.
- No package or lockfile changes and no addition to an E2E script group.

## Success

The repository rejects stale revisions and corrupted/future data, keeps writes atomic, survives a real page reload through IndexedDB, supports conflict-safe import/export, passes all focused and full Node 22 verification, writes deterministic evidence, and changes only approved paths.
## Current-main integration addendum

The integration starts from origin/main f6d3fe69175b168ddea5e385c6d7b3452e6cba16 and uses 7b920eee22654698c75037a6b2287225ec5c46da only as the path source. The historical no-E2E-group-change rule is superseded only for this integration: apps/weltraum-browser/package.json adds tests/e2e/browser-storage-save-repository.spec.ts exactly once to test:e2e:core. No other package script or manifest field may change.

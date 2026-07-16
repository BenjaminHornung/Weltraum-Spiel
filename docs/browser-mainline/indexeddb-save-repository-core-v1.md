# IndexedDB Save Repository Core V1

## Purpose

The browser-storage core is the product storage boundary for validated
`SaveGameEnvelopeV1` values. It provides asynchronous slot operations,
checksum verification, compare-and-swap revisions, versioned JSON-safe export
and conflict-safe import. The V1 implementation includes a production
IndexedDB repository and a semantically equivalent in-memory repository.

This foundation is not wired into the running game, player UI, automatic
saving, offline progression, cloud synchronization, or multiplayer authority.
The browser acceptance test imports the public module directly; it adds no
runtime hook or TestBridge API.

## Architecture

- `src/persistence` remains the save-envelope authority. Browser storage
  receives immutable definition-resolution snapshots and reuses the existing
  validation and canonical serialization contracts.
- Canonical payload text is encoded as exact UTF-8 bytes. SHA-256 covers those
  stored bytes and is checked before a stored envelope is returned.
- IndexedDB schema version 1 contains `saveSlots` and `repositoryMetadata`.
  Slot records are keyed by public slot ID; the metadata store contains the
  repository schema marker.
- Slot writes and deletes read, compare the expected revision, and mutate in a
  single read-write transaction. Creation starts at revision 1, and a matching
  replacement advances by exactly one.
- Export bundles are JSON-safe. Import validates bundle structure, versions,
  byte count, checksum, canonical payload, and envelope before opening its
  write transaction.
- Browser and storage failures are represented by stable
  `SaveRepositoryError` codes rather than raw `DOMException` messages.

## Real-browser acceptance scenario

`tests/e2e/browser-storage-save-repository.spec.ts` runs on the normal `/`
route and registers console, page-error, request-failure, and HTTP-failure
listeners before navigation. It proves that TestBridge is absent and then
dynamically imports `/src/browser-storage/index.ts`.

The scenario uses one fixed, feature-specific test database. It:

1. deletes the isolated database before use;
2. creates and reads Slot A through the production IndexedDB repository;
3. closes the repository, reloads the page, opens a new repository, and proves
   that Slot A retains the same revision and SHA-256 signature;
4. proves that stale compare-and-swap fails and a matching revision advances;
5. exports Slot A and imports it as independent Slot B with
   `CreateNewSlot`;
6. changes one raw Slot A payload byte without changing its stored hash and
   proves that the production read fails with `ChecksumMismatch` while Slot B
   remains readable;
7. deletes both slots, verifies the repository is empty, closes all repository
   and direct IndexedDB connections, and deletes the full test database; and
8. requires all four browser-health arrays to remain empty.

No screenshot is produced because this is a non-visible storage-core scenario.

## Rerun

Use Node.js 22.23.1 and run from `apps/weltraum-browser`:

```bash
npx tsc -p tsconfig.json --noEmit
npm run test:e2e -- tests/e2e/browser-storage-save-repository.spec.ts
```

The Playwright configuration owns the bounded Vite web-server lifecycle. Do
not start a separate development server for this test. On Windows, the existing
`WELTRAUM_PLAYWRIGHT_EXECUTABLE_PATH` environment variable may point Playwright
to an installed Chromium-based browser when its managed browser is unavailable.

## Deterministic evidence

The successful test writes:

- `evidence/browser-indexeddb-save-repository-core-v1-summary.json`
- `evidence/browser-indexeddb-save-repository-core-v1.md`

The JSON schema records only deterministic contract facts:

- schema version, feature ID, route, TestBridge guard, and module path;
- fixed test-database isolation and repository store layout;
- Slot A revision, checksum signature, and reload equality;
- stale and matching compare-and-swap outcomes;
- CreateNewSlot import identity and independent-content checks;
- the controlled corruption method and stable error code;
- slot and full-database cleanup outcomes;
- empty browser-health arrays; and
- final `PASS` status.

Evidence is written only after scenario assertions, slot cleanup, connection
closure, full database deletion, and health assertions succeed. It contains no
screenshot, timestamp, duration, wall-clock authority, random value, machine
path, raw exception, or save payload.

## Cleanup and remaining constraints

Database deletion explicitly handles success, error, and blocked outcomes.
Only success is accepted. Every repository instance is terminally closed, and
the direct IndexedDB connection used for controlled corruption is closed in a
`finally` block. A failed scenario still attempts full database deletion and
does not overwrite evidence.

V1 remains local browser storage with no compression, encryption, schema
migration beyond version 1, LocalStorage fallback, quota recovery, silent
repair, live-runtime integration, or player-facing save/load workflow.

# Browser IndexedDB Save Repository Core V1 Specification

## ADDED Requirements

### Requirement: Repository contract and lifecycle
The system SHALL provide the requested asynchronous SaveRepository operations and required public types. Initialization SHALL be idempotent while open. Closing SHALL be idempotent and terminal, and subsequent operations SHALL fail with ClosedRepository.

#### Scenario: Closed repository
- WHEN a caller closes an initialized repository and calls any operation
- THEN the operation fails with ClosedRepository and no storage mutation occurs

### Requirement: Valid slot identity and revisions
The system SHALL validate slot IDs and revisions without trimming, coercion, locale rules, NaN, Infinity, negatives, or unsafe integers.

#### Scenario: Invalid identity
- WHEN a request contains an invalid slot ID or revision
- THEN it fails before storage access and leaves all records unchanged

### Requirement: Canonical validated SaveGameEnvelopeV1 bytes
The system SHALL validate SaveGameEnvelopeV1 using immutable definition snapshots, serialize it with the existing compact canonical serializer, encode UTF-8, and revalidate after decode. It SHALL reject non-plain values, invalid finite numbers, corrupt required fields, and future save versions without repair or defaulting.

#### Scenario: Canonical round trip
- WHEN a valid V1 envelope is encoded and decoded
- THEN the decoded envelope is valid, canonical bytes are stable, and no caller object is retained

#### Scenario: Future save
- WHEN decoded or imported data declares a save version newer than supported
- THEN it fails with UnsupportedSaveVersion and no write occurs

### Requirement: Exact-byte checksum
The system SHALL compute and verify lowercase SHA-256 over the exact stored UTF-8 payload bytes. Payload length and hash SHALL be validated record metadata.

#### Scenario: Changed bytes
- WHEN stored payload bytes no longer match the stored hash
- THEN read or export fails with ChecksumMismatch and does not return an envelope

### Requirement: Copy isolation
Both adapters SHALL prevent caller mutation from changing stored state and SHALL not return mutable internal records, byte arrays, metadata, or envelope references.

#### Scenario: Caller mutation
- WHEN a caller mutates its original write input or a read result
- THEN a later read returns the original committed value

### Requirement: Atomic compare-and-swap writes
A missing slot SHALL accept only expected revision null or 0 and commit revision 1. A present slot SHALL require the exact revision and increment by one. Validation and storage failure SHALL preserve the complete old slot.

#### Scenario: Stale write
- WHEN a caller writes with a stale revision
- THEN the repository fails with RevisionConflict and preserves old bytes, hash, metadata, and revision

#### Scenario: Transaction failure
- WHEN a write fails before commit
- THEN no partial or replacement record is visible

### Requirement: Revision-guarded deletion
Deletion SHALL require the exact current revision and SHALL not silently succeed for a missing or stale slot.

#### Scenario: Stale delete
- WHEN delete uses the wrong revision
- THEN it fails with RevisionConflict and the slot remains readable

### Requirement: Deterministic listing and metadata
Slot metadata SHALL contain slotId, displayName, recordRevision, saveSchemaVersion, gameVersion, universeTick, payloadBytes, contentHash, and lastWriteReason. Listing SHALL sort ordinally by slot ID and return copies. Wall-clock time SHALL not be domain truth or a canonical input.

#### Scenario: List order
- WHEN slots are inserted in different orders
- THEN listSlots returns the same slot-ID order and equivalent metadata

### Requirement: IndexedDB V1 schema
The IndexedDB adapter SHALL use a configurable database ID with product default weltraum-save-repository-v1, IndexedDB version 1, and required saveSlots and repositoryMetadata stores. It SHALL validate the repository marker and fail closed on unknown future versions or missing required structure.

#### Scenario: Future repository
- WHEN an existing database or marker has a version newer than supported
- THEN initialization fails with UnsupportedRepositoryVersion and does not downgrade or rewrite it

### Requirement: IndexedDB transaction atomicity
Each slot write or delete SHALL read, compare, and mutate within one IndexedDB transaction. Success SHALL be reported only after transaction completion. No separate unguarded metadata write is permitted.

#### Scenario: Aborted write
- WHEN any request or transaction aborts
- THEN the previous complete slot remains or the new slot remains absent

### Requirement: Browser capability and stable errors
Missing IndexedDB or WebCrypto, open failures, blocked operations, transaction failures, and quota failures SHALL map to stable product error codes. Raw DOMException objects and messages SHALL not be the product API.

#### Scenario: IndexedDB unavailable
- WHEN the required browser capability is absent
- THEN initialization fails with RepositoryUnavailable without fallback storage

### Requirement: Versioned JSON-safe export
Export SHALL produce a V1 JSON-safe bundle containing metadata, canonical payload, exact payload length, and content hash, with no browser-internal primary key, timestamp authority, class instance, ArrayBuffer, or runtime object.

#### Scenario: Export round trip
- WHEN a valid slot is exported
- THEN JSON stringify and parse preserve all import-authoritative fields and hash verification succeeds

### Requirement: Validated conflict-safe import
Import SHALL validate bundle version, repository and save versions, byte count, hash, canonical payload, and envelope before any write. RejectIfExists, ReplaceExpectedRevision, and CreateNewSlot SHALL never silently overwrite.

#### Scenario: Reject existing
- WHEN RejectIfExists targets an existing slot
- THEN import fails with ImportConflict and preserves the slot

#### Scenario: Replace exact revision
- WHEN ReplaceExpectedRevision supplies the exact current revision
- THEN import commits one incremented revision; a stale revision fails with ImportConflict

#### Scenario: Create explicit new slot
- WHEN CreateNewSlot supplies an absent valid target ID
- THEN the imported payload is committed at revision 1 under that public ID

### Requirement: Real browser reload and corruption evidence
The focused Playwright test SHALL use the normal route with TestBridge absent, dynamically import the module, isolate a fixed test database, prove reload persistence and CAS, exercise export and import, detect controlled corruption, clean all records and database, and assert no console, page, request, or HTTP failures.

#### Scenario: Reload persistence
- WHEN Slot A is written, the page reloads, and a new repository opens the same test database
- THEN Slot A and its canonical signature remain readable and unchanged

### Requirement: Scope and non-goals
The implementation SHALL only change approved paths. It SHALL not add UI or runtime wiring, persistence-core edits, compression, encryption, LocalStorage fallback, package changes, E2E-group changes, migrations beyond V1, cloud sync, or silent repair.

#### Scenario: Scope audit
- WHEN the final diff is audited
- THEN every changed path is approved and all forbidden paths remain unchanged
### Integration-only E2E group assignment

For the current-main integration only, apps/weltraum-browser/package.json SHALL list tests/e2e/browser-storage-save-repository.spec.ts exactly once in test:e2e:core. No lockfile, Vite configuration, other E2E group, or test semantics SHALL change.

#### Scenario: E2E inventory
- WHEN all tests/e2e/*.spec.ts files are compared with the three grouped package scripts
- THEN every E2E spec is assigned exactly once
- AND browser-storage-save-repository.spec.ts belongs only to test:e2e:core.

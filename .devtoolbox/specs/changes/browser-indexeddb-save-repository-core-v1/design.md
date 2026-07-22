# Design: Browser IndexedDB Save Repository Core V1

## Context and source of truth

SaveGameEnvelopeV1 remains the only save payload authority. Existing functions in src/persistence validate and canonically serialize it. They require complete immutable DefinitionResolutionSnapshot arrays; the envelope stores only definition version references and cannot reconstruct definition ID inventories. Browser-storage constructors therefore receive a concrete snapshot dependency. Repository methods never accept hidden globals and src/persistence/** is unchanged.

## Public contract

SaveRepository is asynchronous and provides initialize, listSlots, readSlot, writeSlot, deleteSlot, exportSlot, importSlot, and close. Successful operations return immutable or copy-safe result records. Failures throw only SaveRepositoryError with a stable SaveRepositoryErrorCode; raw DOMException instances and messages are not the product contract.

Required public types include SaveSlotId, SaveRecordRevision, SaveRepositorySchemaVersion, SaveSlotMetadata, StoredSaveRecord, SaveWriteRequest, SaveReadResult, SaveWriteResult, SaveDeleteResult, SaveListResult, and SaveExportBundle.

## Slot identity and metadata

Slot IDs are bounded normalized ASCII identifiers validated without trimming or coercion. Revisions are safe nonnegative integers. Repository schema version is exactly 1.

SaveSlotMetadata contains at least slotId, displayName, recordRevision, saveSchemaVersion, gameVersion, universeTick, payloadBytes, contentHash, and lastWriteReason.

V1 normal writes have no display-name input. A new slot uses its validated slotId as deterministic display name and subsequent writes preserve stored metadata. Import retains valid exported display metadata while CreateNewSlot changes only identity. Display name is presentation metadata, not save authority.

No wall-clock value is stored in V1. A future diagnostic timestamp must stay outside payload bytes, checksum inputs, canonical signatures, and authoritative import/export comparisons.

## Codec and canonical bytes

Encoding completes before any repository mutation:

1. validate the caller value with the existing V1 validator and injected definition snapshots;
2. produce existing compact canonical JSON;
3. encode that exact string as UTF-8;
4. compute SHA-256 over the exact stored bytes;
5. derive metadata only from the validated envelope and byte sequence.

Decoding verifies record shape, safe lengths, hash format, SHA-256, fatal UTF-8 decoding, JSON shape, future save version, and existing envelope validation again. A future numeric save schema version maps to UnsupportedSaveVersion; malformed current data maps to InvalidEnvelope for caller or import input and CorruptRecord for stored data. No functions, Maps, Sets, class instances, Three.js objects, NaN, Infinity, or pretty-print variants are accepted.

SHA-256 uses globalThis.crypto.subtle, available in the required Node 22 verification and supported browser context. Missing WebCrypto is a capability failure mapped to RepositoryUnavailable. This intentionally differs from existing FNV string signatures, which operate on JavaScript code units rather than the stored UTF-8 bytes.

## Revision and compare-and-swap

- A missing slot may be created only with expected revision null or revision 0.
- A present slot requires an exact expected revision.
- Successful creation writes revision 1.
- Successful replacement increments by exactly one and rejects unsafe overflow.
- Stale writes and deletes return RevisionConflict.
- No automatic retry changes the expected revision and no last-write-wins path exists.
- A failed validation, checksum, policy, transaction, quota, or injected memory failure leaves the previous record unchanged.

## IndexedDB schema and atomicity

Configuration accepts a database ID; product default is weltraum-save-repository-v1. IndexedDB version is 1. Required stores are saveSlots, keyed by public slot ID, and repositoryMetadata, containing the exact repository schema marker.

Initial upgrade from version 0 creates both stores and the V1 marker in the versionchange transaction. Existing databases must expose both stores and marker version 1. Opening a database newer than requested produces UnsupportedRepositoryVersion; an unknown future marker also fails closed. Missing or corrupt required structure fails as CorruptRecord or DatabaseOpenFailed, never by silently recreating user records.

A slot is one structured-cloned record containing copied payload bytes plus metadata, revision, and hash. Write and delete perform read, compare, and mutation in one readwrite transaction on saveSlots. Request success is not commit success; the repository resolves only after transaction completion. Abort, quota, or transaction errors produce no half-slot. Slot metadata is never updated in a separate unguarded transaction.

The connection closes on versionchange. Blocked open or delete situations fail explicitly instead of hanging or claiming success.

## In-memory semantics

The memory adapter stores private copied byte arrays and copied metadata. All validation and checksum work completes before one synchronous map replacement or deletion step. Reads, lists, exports, and successful write results return fresh objects, bytes, metadata, and envelopes. Caller mutation after write and mutation of read results cannot alter stored state. A constructor-only test failure hook may run immediately before commit to prove rollback semantics and is not exported as product behavior.

## Import and export

The V1 export bundle is JSON-safe and contains a bundle version, repository and save versions, slot metadata, canonical payload string, payload byte length, and SHA-256 content hash. It contains no browser-internal primary key, ArrayBuffer, timestamp, machine path, or runtime object.

Import reconstructs UTF-8 bytes and validates bundle shape, byte count, hash, future versions, and envelope before opening a write transaction.

Policies are discriminated unions:

- RejectIfExists imports to the bundle slot only when absent.
- ReplaceExpectedRevision replaces the bundle slot only at the exact supplied revision.
- CreateNewSlot requires an explicit validated target slot ID and rejects if it exists.

Any policy collision maps to ImportConflict; no policy silently overwrites.

## Error taxonomy

Stable codes are RepositoryUnavailable, DatabaseOpenFailed, TransactionFailed, QuotaExceeded, SlotNotFound, SlotAlreadyExists, RevisionConflict, CorruptRecord, ChecksumMismatch, UnsupportedRepositoryVersion, UnsupportedSaveVersion, InvalidEnvelope, ImportConflict, and ClosedRepository.

Error messages may include stable operation context and slot ID but not raw browser exception text as product authority.

## Lifecycle

initialize is idempotent while open. Operations before successful initialization fail as unavailable or open failure. close is idempotent and terminal for that instance; every later operation including initialize fails with ClosedRepository.

## Browser acceptance

The Playwright test loads the normal route, proves window.TestBridge absent, dynamically imports browser-storage, uses a fixed test-only database, demonstrates reload persistence and CAS, exports and imports to a second slot, corrupts a raw record, observes corruption or checksum failure, deletes all slots, closes connections, deletes the test database, and reports no console, page, request, or HTTP failures. Evidence is deterministic and contains no screenshot or timing authority.
## Current-main integration decision

The historical commit is not merged or cherry-picked because it also carries the separate browser-vitest-cpu-contention-stability change. Only the Save-Core allowlist is reapplied. Current main already contains the equivalent Vitest test.maxWorkers: 1 rule, so vite.config.ts and the stability Change folder remain untouched. Current public persistence exports, SaveGameEnvelopeV1 validation, canonical serialization, and DefinitionResolutionSnapshot injection remain authoritative and unchanged.

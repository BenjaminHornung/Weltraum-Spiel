import {
  createUniquePhy03DatabaseName,
  openIndexedDbPublicationStore,
  PublicationError,
  type IndexedDbPublicationConnection,
  type Pointer
} from "../src/publication";

export interface IndexedDbCheck {
  readonly name: string;
  readonly status: "PASS" | "FAIL" | "NOT_RUN" | "UNSUPPORTED";
  readonly detail?: string;
}

export interface IndexedDbChecksResult {
  readonly environment: "browser-indexeddb-real";
  readonly status: "PASS" | "FAIL" | "UNSUPPORTED";
  readonly databaseName?: string;
  readonly checks: readonly IndexedDbCheck[];
}

export async function runIndexedDbChecks(): Promise<IndexedDbChecksResult> {
  const factory = globalThis.indexedDB;
  if (!factory) {
    return {
      environment: "browser-indexeddb-real",
      status: "UNSUPPORTED",
      checks: [{ name: "indexeddb-available", status: "UNSUPPORTED", detail: "This browser has no IndexedDB factory." }]
    };
  }

  const checks: IndexedDbCheck[] = [];
  let databaseName: string | undefined;
  let first: IndexedDbPublicationConnection | undefined;
  let second: IndexedDbPublicationConnection | undefined;
  let reopened: IndexedDbPublicationConnection | undefined;
  try {
    databaseName = createUniquePhy03DatabaseName();
    first = await openIndexedDbPublicationStore(databaseName, factory);
    second = await openIndexedDbPublicationStore(databaseName, factory);
    checks.push({ name: "two-live-connections", status: first !== second ? "PASS" : "FAIL" });

    const legacyBytes = new Uint8Array([0, 1, 17, 255]);
    const expectedInitial = await first.seedLegacy("legacy-control", legacyBytes);
    const candidateBytes = new Uint8Array([4, 5, 6, 7]);
    const committed = await first.publish({
      slotId: "candidate-envelope",
      bytes: candidateBytes,
      expectedPointer: expectedInitial,
      validate: bytes => {
        if (!sameBytes(bytes, candidateBytes)) throw new Error("Browser candidate validation received different bytes.");
      }
    });
    const observedPointer = await second.getPointer();
    const observedCandidate = await second.readSlot("candidate-envelope");
    checks.push({
      name: "pointer-and-candidate-visible-on-second-connection",
      status: samePointer(observedPointer, committed) && !!observedCandidate && sameBytes(observedCandidate.bytes, candidateBytes) ? "PASS" : "FAIL"
    });
    const observedLegacy = await second.readSlot("legacy-control");
    checks.push({
      name: "original-legacy-bytes-preserved",
      status: !!observedLegacy && sameBytes(observedLegacy.bytes, legacyBytes) ? "PASS" : "FAIL"
    });

    first.close();
    second.close();
    first = undefined;
    second = undefined;
    reopened = await openIndexedDbPublicationStore(databaseName, factory);
    const reopenedPointer = await reopened.getPointer();
    if (!reopenedPointer) throw new Error("The reopened database has no active pointer.");
    const reopenedLegacy = await reopened.readSlot("legacy-control");
    const reopenedCandidate = await reopened.readSlot("candidate-envelope");
    checks.push({
      name: "read-after-close-and-reopen",
      status:
        samePointer(reopenedPointer, committed) &&
        !!reopenedLegacy && sameBytes(reopenedLegacy.bytes, legacyBytes) &&
        !!reopenedCandidate && sameBytes(reopenedCandidate.bytes, candidateBytes)
          ? "PASS"
          : "FAIL"
    });

    await corruptStoredSlot(factory, databaseName, "legacy-control");
    let rollbackErrorCode: string | undefined;
    try {
      await reopened.compareAndSwapPointer(reopenedPointer, "legacy-control");
    } catch (error) {
      rollbackErrorCode = error instanceof PublicationError ? error.code : undefined;
    }
    checks.push({
      name: "corrupt-rollback-target-rejected",
      status: rollbackErrorCode === "SLOT_INTEGRITY_ERROR" ? "PASS" : "FAIL"
    });
    checks.push({
      name: "pointer-unchanged-after-corrupt-target",
      status: samePointer(await reopened.getPointer(), reopenedPointer) ? "PASS" : "FAIL"
    });
  } catch (error) {
    checks.push({ name: "indexeddb-publication-run", status: "FAIL", detail: errorMessage(error) });
  } finally {
    first?.close();
    second?.close();
    reopened?.close();
    if (databaseName) {
      try {
        await deleteDatabase(factory, databaseName);
        checks.push({ name: "unique-test-database-cleanup", status: "PASS" });
      } catch (error) {
        checks.push({ name: "unique-test-database-cleanup", status: "FAIL", detail: errorMessage(error) });
      }
    }
  }

  return {
    environment: "browser-indexeddb-real",
    status: checks.some(check => check.status === "FAIL") ? "FAIL" : "PASS",
    ...(databaseName ? { databaseName } : {}),
    checks
  };
}

function deleteDatabase(factory: IDBFactory, databaseName: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = factory.deleteDatabase(databaseName);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error("Deleting the unique PHY-03 test database failed."));
    request.onblocked = () => reject(new Error("Deleting the unique PHY-03 test database was blocked."));
  });
}

function corruptStoredSlot(factory: IDBFactory, databaseName: string, slotId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const openRequest = factory.open(databaseName);
    let database: IDBDatabase | undefined;
    openRequest.onerror = () => reject(openRequest.error ?? new Error("Opening the unique test database for corruption check failed."));
    openRequest.onsuccess = () => {
      database = openRequest.result;
      let transaction: IDBTransaction;
      try {
        transaction = database.transaction("slots", "readwrite");
      } catch (error) {
        database.close();
        reject(error);
        return;
      }
      let failure: unknown;
      const store = transaction.objectStore("slots");
      const read = store.get(slotId);
      read.onsuccess = () => {
        const record = read.result as { readonly slotId: string; readonly bytes: ArrayBuffer; readonly digest: string } | undefined;
        if (!record || record.bytes.byteLength === 0) {
          failure = new Error("The corruption control slot is missing or empty.");
          try { transaction.abort(); } catch { /* Preserve the corruption-check failure. */ }
          return;
        }
        const bytes = new Uint8Array(record.bytes);
        bytes[0] ^= 0xff;
        store.put({ ...record, bytes: bytes.buffer });
      };
      read.onerror = () => { failure = read.error; };
      transaction.oncomplete = () => {
        database?.close();
        resolve();
      };
      transaction.onerror = () => undefined;
      transaction.onabort = () => {
        database?.close();
        reject(failure ?? transaction.error ?? new Error("Corrupting the control slot failed."));
      };
    };
  });
}

function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function samePointer(left: Pointer | undefined, right: Pointer): boolean {
  return left?.slotId === right.slotId && left.revision === right.revision && left.digest === right.digest;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

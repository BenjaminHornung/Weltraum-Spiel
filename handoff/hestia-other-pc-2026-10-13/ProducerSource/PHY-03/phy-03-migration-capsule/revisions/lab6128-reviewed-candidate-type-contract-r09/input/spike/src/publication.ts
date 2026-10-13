export interface Pointer {
  readonly slotId: string;
  readonly revision: number;
  readonly digest: string;
}

export interface SlotSnapshot {
  readonly slotId: string;
  readonly bytes: Uint8Array;
  readonly digest: string;
}

export const PUBLICATION_CRASH_PHASES = [
  "beforeWrite",
  "afterWrite",
  "beforePointer",
  "afterPointer"
] as const;

export type PublicationCrashPhase = typeof PUBLICATION_CRASH_PHASES[number];
export type CandidateValidator = (bytes: Uint8Array) => void | Promise<void>;

export type PublicationErrorCode =
  | "ALREADY_SEEDED"
  | "NOT_SEEDED"
  | "STALE_POINTER"
  | "SLOT_ID_REUSED"
  | "READBACK_MISMATCH"
  | "SLOT_INTEGRITY_ERROR"
  | "SIMULATED_CRASH"
  | "INVALID_CRASH_PHASE"
  | "PRIVATE_DATABASE_REQUIRED"
  | "INDEXEDDB_UNAVAILABLE"
  | "DATABASE_ERROR";

export class PublicationError extends Error {
  constructor(
    readonly code: PublicationErrorCode,
    message: string,
    readonly phase?: PublicationCrashPhase
  ) {
    super(message);
    this.name = "PublicationError";
  }
}

export interface PublishCandidateInput {
  readonly slotId: string;
  readonly bytes: Uint8Array;
  readonly expectedPointer: Pointer;
  readonly validate: CandidateValidator;
  readonly crashAt?: PublicationCrashPhase;
}

/** Common publication protocol; subclasses provide only atomic storage operations. */
export abstract class PublicationStore {
  abstract getPointer(): Promise<Pointer | undefined>;
  abstract readSlot(slotId: string): Promise<SlotSnapshot | undefined>;

  protected abstract writeInitial(record: SlotSnapshot, pointer: Pointer): Promise<void>;
  protected abstract writeNewSlot(record: SlotSnapshot): Promise<void>;
  abstract compareAndSwapPointer(expected: Pointer, targetSlotId: string, expectedDigest?: string): Promise<Pointer>;

  async seedLegacy(slotId: string, sourceBytes: Uint8Array): Promise<Pointer> {
    requireSlotId(slotId);
    if (await this.getPointer()) {
      throw new PublicationError("ALREADY_SEEDED", "Legacy seeding is allowed only before a pointer exists.");
    }
    const bytes = new Uint8Array(sourceBytes);
    const pointer: Pointer = { slotId, revision: 0, digest: await sha256(bytes) };
    await this.writeInitial({ slotId, bytes, digest: pointer.digest }, pointer);
    return copyPointer(pointer);
  }

  async publish(input: PublishCandidateInput): Promise<Pointer> {
    requireSlotId(input.slotId);
    requireCrashPhase(input.crashAt);
    if (typeof input.validate !== "function") throw new TypeError("A candidate validator is required.");

    const bytes = new Uint8Array(input.bytes);
    await input.validate(new Uint8Array(bytes));
    const digest = await sha256(bytes);

    assertExpectedPointer(input.expectedPointer, await this.getPointer());
    if (await this.readSlot(input.slotId)) {
      throw new PublicationError("SLOT_ID_REUSED", "Slot ID '" + input.slotId + "' has already been used.");
    }

    crashAt(input.crashAt, "beforeWrite");
    await this.writeNewSlot({ slotId: input.slotId, bytes, digest });
    crashAt(input.crashAt, "afterWrite");

    const readBack = await this.readSlot(input.slotId);
    if (
      !readBack ||
      readBack.digest !== digest ||
      !equalBytes(readBack.bytes, bytes) ||
      await sha256(readBack.bytes) !== digest
    ) {
      throw new PublicationError("READBACK_MISMATCH", "Slot '" + input.slotId + "' did not match the candidate bytes after write.");
    }

    crashAt(input.crashAt, "beforePointer");
    const pointer = await this.compareAndSwapPointer(input.expectedPointer, input.slotId, digest);
    crashAt(input.crashAt, "afterPointer");
    return pointer;
  }
}

/** Deterministic in-memory simulation; it does not prove browser persistence. */
export class InMemoryPublicationStore extends PublicationStore {
  readonly #slots = new Map<string, SlotSnapshot>();
  #pointer: Pointer | undefined;

  async getPointer(): Promise<Pointer | undefined> {
    return this.#pointer && copyPointer(this.#pointer);
  }

  async readSlot(slotId: string): Promise<SlotSnapshot | undefined> {
    const record = this.#slots.get(slotId);
    return record && copySlot(record);
  }

  protected async writeInitial(record: SlotSnapshot, pointer: Pointer): Promise<void> {
    if (this.#pointer || this.#slots.size !== 0) {
      throw new PublicationError("ALREADY_SEEDED", "Legacy seeding requires an empty slot store and absent pointer.");
    }
    this.#slots.set(record.slotId, copySlot(record));
    this.#pointer = copyPointer(pointer);
  }

  protected async writeNewSlot(record: SlotSnapshot): Promise<void> {
    if (this.#slots.has(record.slotId)) {
      throw new PublicationError("SLOT_ID_REUSED", "Slot ID '" + record.slotId + "' has already been used.");
    }
    this.#slots.set(record.slotId, copySlot(record));
  }

  async compareAndSwapPointer(expected: Pointer, targetSlotId: string, expectedDigest?: string): Promise<Pointer> {
    assertExpectedPointer(expected, this.#pointer);
    const observed = await this.readSlot(targetSlotId);
    if (!observed) {
      throw new PublicationError("SLOT_INTEGRITY_ERROR", "Slot '" + targetSlotId + "' is missing or has a different digest.");
    }
    const observedDigest = await sha256(observed.bytes);
    if (observed.digest !== observedDigest || (expectedDigest !== undefined && expectedDigest !== observedDigest)) {
      throw new PublicationError("SLOT_INTEGRITY_ERROR", "Slot '" + targetSlotId + "' bytes do not match the expected digest.");
    }
    const target = await this.readSlot(targetSlotId);
    if (!target || target.digest !== observedDigest || !equalBytes(target.bytes, observed.bytes)) {
      throw new PublicationError("SLOT_INTEGRITY_ERROR", "Slot '" + targetSlotId + "' changed during pointer CAS.");
    }
    const current = this.#pointer;
    assertExpectedPointer(expected, current);
    const next = nextPointer(current, target);
    this.#pointer = next;
    return copyPointer(next);
  }
}

export type IndexedDbPublicationConnection = PublicationStore & Readonly<{
  databaseName: string;
  close: () => void;
}>;

const DATABASE_PREFIX = "phy03-migration-capsule-";
const SLOT_STORE = "slots";
const POINTER_STORE = "pointer";
const ACTIVE_POINTER_KEY = "active";
const DATABASE_VERSION = 1;

interface StoredSlot {
  readonly slotId: string;
  readonly bytes: ArrayBuffer;
  readonly digest: string;
}

interface StoredPointer extends Pointer {
  readonly key: string;
}

class BrowserIndexedDbPublicationStore extends PublicationStore {
  constructor(readonly databaseName: string, private readonly database: IDBDatabase) {
    super();
  }

  close(): void {
    this.database.close();
  }

  async getPointer(): Promise<Pointer | undefined> {
    const stored = await this.readRequest<StoredPointer>(POINTER_STORE, ACTIVE_POINTER_KEY);
    return stored ? pointerFromStored(stored) : undefined;
  }

  async readSlot(slotId: string): Promise<SlotSnapshot | undefined> {
    const stored = await this.readRequest<StoredSlot>(SLOT_STORE, slotId);
    return stored ? slotFromStored(stored) : undefined;
  }

  protected async writeInitial(record: SlotSnapshot, pointer: Pointer): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      let transaction: IDBTransaction;
      try {
        transaction = this.database.transaction([SLOT_STORE, POINTER_STORE], "readwrite");
      } catch (error) {
        reject(databaseFailure(error));
        return;
      }

      let failure: unknown;
      let pointerLoaded = false;
      let pointerExists = false;
      let countLoaded = false;
      let slotCount = 0;
      let checked = false;
      const fail = (error: unknown): void => {
        failure = error;
        try { transaction.abort(); } catch { /* The transaction may already be aborting. */ }
      };
      const checkAndInsert = (): void => {
        if (!pointerLoaded || !countLoaded || checked) return;
        checked = true;
        if (pointerExists || slotCount !== 0) {
          fail(new PublicationError("ALREADY_SEEDED", "Legacy seeding requires empty stores and an absent pointer."));
          return;
        }
        try {
          const slotRequest = transaction.objectStore(SLOT_STORE).add(slotToStored(record));
          const pointerRequest = transaction.objectStore(POINTER_STORE).add(pointerToStored(pointer));
          slotRequest.onerror = () => { failure = new PublicationError("SLOT_ID_REUSED", "Slot ID '" + record.slotId + "' has already been used."); };
          pointerRequest.onerror = () => { failure = new PublicationError("ALREADY_SEEDED", "A publication pointer already exists."); };
        } catch (error) {
          fail(databaseFailure(error));
        }
      };

      const pointerRequest = transaction.objectStore(POINTER_STORE).get(ACTIVE_POINTER_KEY);
      const countRequest = transaction.objectStore(SLOT_STORE).count();
      pointerRequest.onsuccess = () => { pointerExists = pointerRequest.result !== undefined; pointerLoaded = true; checkAndInsert(); };
      countRequest.onsuccess = () => { slotCount = countRequest.result; countLoaded = true; checkAndInsert(); };
      pointerRequest.onerror = () => { failure = pointerRequest.error; };
      countRequest.onerror = () => { failure = countRequest.error; };
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => undefined;
      transaction.onabort = () => reject(failure ?? transaction.error ?? new Error("IndexedDB seed transaction aborted."));
    });
  }

  protected async writeNewSlot(record: SlotSnapshot): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      let transaction: IDBTransaction;
      try {
        transaction = this.database.transaction(SLOT_STORE, "readwrite");
      } catch (error) {
        reject(databaseFailure(error));
        return;
      }
      let failure: unknown;
      const request = transaction.objectStore(SLOT_STORE).add(slotToStored(record));
      request.onerror = () => { failure = new PublicationError("SLOT_ID_REUSED", "Slot ID '" + record.slotId + "' has already been used."); };
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => undefined;
      transaction.onabort = () => reject(failure ?? transaction.error ?? new Error("IndexedDB slot write aborted."));
    });
  }

  async compareAndSwapPointer(expected: Pointer, targetSlotId: string, expectedDigest?: string): Promise<Pointer> {
    const observed = await this.readSlot(targetSlotId);
    if (!observed) {
      throw new PublicationError("SLOT_INTEGRITY_ERROR", "Slot '" + targetSlotId + "' is missing or has a different digest.");
    }
    const observedDigest = await sha256(observed.bytes);
    if (observed.digest !== observedDigest || (expectedDigest !== undefined && expectedDigest !== observedDigest)) {
      throw new PublicationError("SLOT_INTEGRITY_ERROR", "Slot '" + targetSlotId + "' bytes do not match the expected digest.");
    }

    return new Promise<Pointer>((resolve, reject) => {
      let transaction: IDBTransaction;
      try {
        transaction = this.database.transaction([SLOT_STORE, POINTER_STORE], "readwrite");
      } catch (error) {
        reject(databaseFailure(error));
        return;
      }

      let failure: unknown;
      let currentRecord: StoredPointer | undefined;
      let targetRecord: StoredSlot | undefined;
      let pointerLoaded = false;
      let slotLoaded = false;
      let next: Pointer | undefined;
      let checked = false;
      const fail = (error: unknown): void => {
        failure = error;
        try { transaction.abort(); } catch { /* The transaction may already be aborting. */ }
      };
      const checkAndWrite = (): void => {
        if (!pointerLoaded || !slotLoaded || checked) return;
        checked = true;
        try {
          const current = currentRecord ? pointerFromStored(currentRecord) : undefined;
          assertExpectedPointer(expected, current);
          if (
            !targetRecord ||
            targetRecord.digest !== observedDigest ||
            !equalBytes(slotFromStored(targetRecord).bytes, observed.bytes)
          ) {
            throw new PublicationError("SLOT_INTEGRITY_ERROR", "Slot '" + targetSlotId + "' is missing or has a different digest.");
          }
          const target = slotFromStored(targetRecord);
          next = nextPointer(current!, target);
          transaction.objectStore(POINTER_STORE).put(pointerToStored(next));
        } catch (error) {
          fail(error);
        }
      };

      const pointerRequest = transaction.objectStore(POINTER_STORE).get(ACTIVE_POINTER_KEY);
      const slotRequest = transaction.objectStore(SLOT_STORE).get(targetSlotId);
      pointerRequest.onsuccess = () => { currentRecord = pointerRequest.result as StoredPointer | undefined; pointerLoaded = true; checkAndWrite(); };
      slotRequest.onsuccess = () => { targetRecord = slotRequest.result as StoredSlot | undefined; slotLoaded = true; checkAndWrite(); };
      pointerRequest.onerror = () => { failure = pointerRequest.error; };
      slotRequest.onerror = () => { failure = slotRequest.error; };
      transaction.oncomplete = () => next ? resolve(copyPointer(next)) : reject(new Error("IndexedDB CAS completed without a pointer update."));
      transaction.onerror = () => undefined;
      transaction.onabort = () => reject(failure ?? transaction.error ?? new Error("IndexedDB pointer CAS aborted."));
    });
  }

  private readRequest<T>(storeName: string, key: IDBValidKey): Promise<T | undefined> {
    return new Promise<T | undefined>((resolve, reject) => {
      let transaction: IDBTransaction;
      try {
        transaction = this.database.transaction(storeName, "readonly");
      } catch (error) {
        reject(databaseFailure(error));
        return;
      }
      let result: T | undefined;
      let failure: unknown;
      const request = transaction.objectStore(storeName).get(key) as IDBRequest<T | undefined>;
      request.onsuccess = () => { result = request.result; };
      request.onerror = () => { failure = request.error; };
      transaction.oncomplete = () => resolve(result);
      transaction.onerror = () => undefined;
      transaction.onabort = () => reject(failure ?? transaction.error ?? new Error("IndexedDB read transaction aborted."));
    });
  }
}

export function createUniquePhy03DatabaseName(): string {
  const randomUUID = globalThis.crypto?.randomUUID;
  if (!randomUUID) throw new PublicationError("INDEXEDDB_UNAVAILABLE", "Web Crypto randomUUID is required for an isolated test database.");
  return DATABASE_PREFIX + randomUUID.call(globalThis.crypto);
}

export async function openIndexedDbPublicationStore(
  databaseName: string,
  factory?: IDBFactory
): Promise<IndexedDbPublicationConnection> {
  if (!databaseName.startsWith(DATABASE_PREFIX)) {
    throw new PublicationError("PRIVATE_DATABASE_REQUIRED", "IndexedDB names must start with '" + DATABASE_PREFIX + "'.");
  }
  const indexedDb = factory ?? globalThis.indexedDB;
  if (!indexedDb) throw new PublicationError("INDEXEDDB_UNAVAILABLE", "This environment has no IndexedDB factory.");
  const database = await openDatabase(indexedDb, databaseName);
  return new BrowserIndexedDbPublicationStore(databaseName, database);
}

function openDatabase(factory: IDBFactory, databaseName: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let request: IDBOpenDBRequest;
    let settled = false;
    let upgradeFailure: unknown;
    try {
      request = factory.open(databaseName, DATABASE_VERSION);
    } catch (error) {
      reject(databaseFailure(error));
      return;
    }
    request.onupgradeneeded = () => {
      try {
        const database = request.result;
        if (!database.objectStoreNames.contains(SLOT_STORE)) database.createObjectStore(SLOT_STORE, { keyPath: "slotId" });
        if (!database.objectStoreNames.contains(POINTER_STORE)) database.createObjectStore(POINTER_STORE, { keyPath: "key" });
      } catch (error) {
        upgradeFailure = databaseFailure(error);
        try { request.transaction?.abort(); } catch { /* Preserve the original upgrade failure. */ }
      }
    };
    request.onblocked = () => {
      if (!settled) {
        settled = true;
        reject(new PublicationError("DATABASE_ERROR", "Opening the isolated PHY-03 IndexedDB was blocked."));
      }
    };
    request.onerror = () => {
      if (!settled) {
        settled = true;
        reject(upgradeFailure ?? databaseFailure(request.error));
      }
    };
    request.onsuccess = () => {
      const database = request.result;
      if (settled) {
        database.close();
        return;
      }
      settled = true;
      if (!database.objectStoreNames.contains(SLOT_STORE) || !database.objectStoreNames.contains(POINTER_STORE)) {
        database.close();
        reject(new PublicationError("DATABASE_ERROR", "The isolated PHY-03 database has an incompatible schema."));
        return;
      }
      database.onversionchange = () => database.close();
      resolve(database);
    };
  });
}

function slotToStored(record: SlotSnapshot): StoredSlot {
  return { slotId: record.slotId, bytes: new Uint8Array(record.bytes).buffer, digest: record.digest };
}

function slotFromStored(record: StoredSlot): SlotSnapshot {
  return { slotId: record.slotId, bytes: new Uint8Array(record.bytes), digest: record.digest };
}

function pointerToStored(pointer: Pointer): StoredPointer {
  return { key: ACTIVE_POINTER_KEY, ...copyPointer(pointer) };
}

function pointerFromStored(pointer: StoredPointer): Pointer {
  return { slotId: pointer.slotId, revision: pointer.revision, digest: pointer.digest };
}

function nextPointer(current: Pointer, target: SlotSnapshot): Pointer {
  const revision = current.revision + 1;
  if (!Number.isSafeInteger(revision)) throw new PublicationError("SLOT_INTEGRITY_ERROR", "Pointer revision exceeded the safe integer range.");
  return { slotId: target.slotId, revision, digest: target.digest };
}

function assertExpectedPointer(expected: Pointer, current: Pointer | undefined): asserts current is Pointer {
  if (!current) throw new PublicationError("NOT_SEEDED", "A legacy pointer must be seeded before publication.");
  if (
    expected.revision !== current.revision ||
    expected.slotId !== current.slotId ||
    expected.digest !== current.digest
  ) {
    throw new PublicationError("STALE_POINTER", "The active pointer no longer matches the expected revision, slot ID, and digest.");
  }
}

function requireSlotId(slotId: string): void {
  if (typeof slotId !== "string" || slotId.length === 0) throw new TypeError("A non-empty immutable slot ID is required.");
}

function requireCrashPhase(phase: PublicationCrashPhase | undefined): void {
  if (phase !== undefined && !(PUBLICATION_CRASH_PHASES as readonly string[]).includes(phase)) {
    throw new PublicationError("INVALID_CRASH_PHASE", "Unregistered publication crash phase '" + String(phase) + "'.");
  }
}

function crashAt(requested: PublicationCrashPhase | undefined, phase: PublicationCrashPhase): void {
  if (requested === phase) throw new PublicationError("SIMULATED_CRASH", "Simulated crash at " + phase + ".", phase);
}

function copyPointer(pointer: Pointer): Pointer {
  return { slotId: pointer.slotId, revision: pointer.revision, digest: pointer.digest };
}

function copySlot(record: SlotSnapshot): SlotSnapshot {
  return { slotId: record.slotId, bytes: new Uint8Array(record.bytes), digest: record.digest };
}

function equalBytes(left: Uint8Array, right: Uint8Array): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

async function sha256(bytes: Uint8Array): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new PublicationError("INDEXEDDB_UNAVAILABLE", "Web Crypto SHA-256 is required for publication.");
  const hash = new Uint8Array(await subtle.digest("SHA-256", new Uint8Array(bytes)));
  return "sha256:" + Array.from(hash, value => value.toString(16).padStart(2, "0")).join("");
}

function databaseFailure(error: unknown): PublicationError {
  return new PublicationError("DATABASE_ERROR", error instanceof Error ? error.message : "IndexedDB operation failed.");
}

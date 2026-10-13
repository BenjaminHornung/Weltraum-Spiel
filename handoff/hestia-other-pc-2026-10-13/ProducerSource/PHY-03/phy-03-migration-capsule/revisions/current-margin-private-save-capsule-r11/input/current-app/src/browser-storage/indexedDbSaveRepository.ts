import type { DefinitionResolutionSnapshot, SimulationTick } from "../persistence";
import {
  copySaveSlotMetadata,
  createSaveCodec,
  createStoredSaveRecord,
  MAX_SAVE_DISPLAY_NAME_LENGTH,
  MAX_SAVE_PAYLOAD_BYTES,
  MAX_SAVE_WRITE_REASON_LENGTH
} from "./codec";
import { SaveRepositoryError, isSaveRepositoryError, type SaveRepositoryErrorCode } from "./errors";
import {
  createImportedMetadata,
  createImportedWriteResult,
  createSaveExportBundle,
  prepareSaveImport,
  type PreparedSaveImport
} from "./exportImport";
import {
  parseSaveRecordRevision,
  parseSaveSlotId,
  type SaveRecordRevision,
  type SaveSlotId
} from "./ids";
import type { SaveRepository } from "./saveRepository";
import { parseSaveWriteRequest } from "./saveWriteRequest";
import type {
  EncodedSavePayload,
  SaveDeleteResult,
  SaveExportBundle,
  SaveImportPolicy,
  SaveListResult,
  SaveReadResult,
  SaveSlotMetadata,
  SaveWriteRequest,
  SaveWriteResult,
  StoredSaveRecord
} from "./types";

export const DEFAULT_INDEXED_DB_SAVE_REPOSITORY_DATABASE_ID = "weltraum-save-repository-v1";
export const INDEXED_DB_SAVE_REPOSITORY_VERSION = 1;
export const INDEXED_DB_SAVE_SLOTS_STORE = "saveSlots";
export const INDEXED_DB_REPOSITORY_METADATA_STORE = "repositoryMetadata";
export const INDEXED_DB_REPOSITORY_SCHEMA_MARKER_KEY = "repositorySchemaVersion";

export interface IndexedDbSaveRepositoryConfiguration {
  readonly databaseId?: string;
  readonly indexedDB?: IDBFactory;
}

type RepositoryState = "new" | "open" | "versionchanged" | "closed";

const ordinalCompare = (left: string, right: string): number => (left < right ? -1 : left > right ? 1 : 0);

const browserErrorName = (value: unknown): string | undefined => {
  if (value === null || typeof value !== "object") {
    return undefined;
  }
  const descriptor = Object.getOwnPropertyDescriptor(value, "name");
  if (descriptor !== undefined && "value" in descriptor && typeof descriptor.value === "string") {
    return descriptor.value;
  }
  try {
    const name = (value as { readonly name?: unknown }).name;
    return typeof name === "string" ? name : undefined;
  } catch {
    return undefined;
  }
};

const mapBrowserFailure = (
  error: unknown,
  operation: string,
  fallbackCode: SaveRepositoryErrorCode,
  slotId?: string
): SaveRepositoryError => {
  if (isSaveRepositoryError(error)) {
    return error;
  }
  const name = browserErrorName(error);
  if (name === "QuotaExceededError") {
    return new SaveRepositoryError("QuotaExceeded", operation, "IndexedDB storage quota was exceeded.", slotId);
  }
  if (name === "VersionError") {
    return new SaveRepositoryError(
      "UnsupportedRepositoryVersion",
      operation,
      "The IndexedDB database uses a newer repository version.",
      slotId
    );
  }
  return new SaveRepositoryError(fallbackCode, operation, "IndexedDB operation failed.", slotId);
};

const databaseIdFrom = (value: unknown): string => {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > 256 ||
    value.trim() !== value ||
    /[\u0000-\u001f\u007f]/.test(value)
  ) {
    throw new SaveRepositoryError("InvalidEnvelope", "configureIndexedDb", "Database ID is not valid bounded text.");
  }
  return value;
};

const plainRecord = (value: unknown, operation: string, slotId: SaveSlotId): StoredSaveRecord => {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)
  ) {
    throw new SaveRepositoryError("CorruptRecord", operation, "Stored save record is not a plain object.", slotId);
  }
  const object = value as Record<string, unknown>;
  const keys = Reflect.ownKeys(object);
  if (keys.length !== 2 || !keys.includes("metadata") || !keys.includes("payloadBytes")) {
    throw new SaveRepositoryError("CorruptRecord", operation, "Stored save record shape is invalid.", slotId);
  }
  const metadata = object.metadata;
  if (
    metadata === null ||
    typeof metadata !== "object" ||
    Array.isArray(metadata) ||
    (Object.getPrototypeOf(metadata) !== Object.prototype && Object.getPrototypeOf(metadata) !== null)
  ) {
    throw new SaveRepositoryError("CorruptRecord", operation, "Stored save metadata is invalid.", slotId);
  }
  const storedMetadata = metadata as Record<string, unknown>;
  const metadataFields = [
    "slotId",
    "displayName",
    "recordRevision",
    "saveSchemaVersion",
    "gameVersion",
    "universeTick",
    "payloadBytes",
    "contentHash",
    "lastWriteReason"
  ] as const;
  const metadataKeys = Reflect.ownKeys(storedMetadata);
  if (
    metadataKeys.length !== metadataFields.length ||
    metadataKeys.some((key) => typeof key !== "string" || !metadataFields.includes(key as typeof metadataFields[number]))
  ) {
    throw new SaveRepositoryError("CorruptRecord", operation, "Stored save metadata shape is invalid.", slotId);
  }
  let storedSlotId: SaveSlotId;
  let revision: SaveRecordRevision;
  try {
    storedSlotId = parseSaveSlotId(storedMetadata.slotId, operation);
    revision = parseSaveRecordRevision(storedMetadata.recordRevision, operation, false);
  } catch {
    throw new SaveRepositoryError("CorruptRecord", operation, "Stored save identity or revision is invalid.", slotId);
  }
  if (storedSlotId !== slotId || !(object.payloadBytes instanceof Uint8Array)) {
    throw new SaveRepositoryError("CorruptRecord", operation, "Stored save record does not match its slot key.", slotId);
  }
  if (typeof storedMetadata.saveSchemaVersion === "number" && storedMetadata.saveSchemaVersion > 1) {
    throw new SaveRepositoryError("UnsupportedSaveVersion", operation, "Future save schema versions are unsupported.", slotId);
  }
  if (
    storedMetadata.saveSchemaVersion !== 1 ||
    typeof storedMetadata.displayName !== "string" ||
    storedMetadata.displayName.length === 0 ||
    storedMetadata.displayName.length > MAX_SAVE_DISPLAY_NAME_LENGTH ||
    storedMetadata.displayName.trim() !== storedMetadata.displayName ||
    /[\u0000-\u001f\u007f]/.test(storedMetadata.displayName) ||
    typeof storedMetadata.gameVersion !== "string" ||
    storedMetadata.gameVersion.length === 0 ||
    storedMetadata.gameVersion.trim() !== storedMetadata.gameVersion ||
    typeof storedMetadata.universeTick !== "number" ||
    !Number.isSafeInteger(storedMetadata.universeTick) ||
    storedMetadata.universeTick < 0 ||
    typeof storedMetadata.payloadBytes !== "number" ||
    !Number.isSafeInteger(storedMetadata.payloadBytes) ||
    storedMetadata.payloadBytes < 0 ||
    storedMetadata.payloadBytes > MAX_SAVE_PAYLOAD_BYTES ||
    storedMetadata.payloadBytes !== object.payloadBytes.byteLength ||
    typeof storedMetadata.contentHash !== "string" ||
    !/^sha256:[0-9a-f]{64}$/.test(storedMetadata.contentHash) ||
    typeof storedMetadata.lastWriteReason !== "string" ||
    storedMetadata.lastWriteReason.length === 0 ||
    storedMetadata.lastWriteReason.length > MAX_SAVE_WRITE_REASON_LENGTH ||
    storedMetadata.lastWriteReason.trim() !== storedMetadata.lastWriteReason ||
    /[\u0000-\u001f\u007f]/.test(storedMetadata.lastWriteReason)
  ) {
    throw new SaveRepositoryError("CorruptRecord", operation, "Stored save metadata fields are invalid.", slotId);
  }
  return {
    metadata: { ...storedMetadata, slotId: storedSlotId, recordRevision: revision } as unknown as SaveSlotMetadata,
    payloadBytes: new Uint8Array(object.payloadBytes)
  };
};

const incrementRevision = (
  current: SaveRecordRevision,
  operation: string,
  slotId: SaveSlotId
): SaveRecordRevision => {
  if (current >= Number.MAX_SAFE_INTEGER) {
    throw new SaveRepositoryError("TransactionFailed", operation, "Record revision cannot be incremented safely.", slotId);
  }
  return (current + 1) as SaveRecordRevision;
};

const metadataForWrite = (
  slotId: SaveSlotId,
  displayName: string,
  revision: SaveRecordRevision,
  encoded: EncodedSavePayload,
  lastWriteReason: string
): SaveSlotMetadata => Object.freeze({
  slotId,
  displayName,
  recordRevision: revision,
  saveSchemaVersion: 1,
  gameVersion: encoded.envelope.gameVersion,
  universeTick: encoded.envelope.universeTime.tick as SimulationTick,
  payloadBytes: encoded.payloadBytes.byteLength,
  contentHash: encoded.contentHash,
  lastWriteReason
});

const writeResultFrom = (metadata: SaveSlotMetadata, encoded: EncodedSavePayload): SaveWriteResult => Object.freeze({
  metadata: copySaveSlotMetadata(metadata),
  envelope: encoded.envelope,
  payloadBytes: new Uint8Array(encoded.payloadBytes)
});

export class IndexedDbSaveRepository implements SaveRepository {
  readonly #codec;
  readonly #databaseId: string;
  readonly #indexedDB: IDBFactory | undefined;
  #state: RepositoryState = "new";
  #database: IDBDatabase | undefined;
  #initializePromise: Promise<void> | undefined;

  public constructor(
    definitionSnapshots: readonly DefinitionResolutionSnapshot[],
    configuration: IndexedDbSaveRepositoryConfiguration = {}
  ) {
    this.#codec = createSaveCodec(definitionSnapshots);
    this.#databaseId = databaseIdFrom(
      configuration.databaseId ?? DEFAULT_INDEXED_DB_SAVE_REPOSITORY_DATABASE_ID
    );
    this.#indexedDB = configuration.indexedDB ?? globalThis.indexedDB;
  }

  public async initialize(): Promise<void> {
    try {
      if (this.#state === "closed") {
        throw new SaveRepositoryError("ClosedRepository", "initialize", "Repository instance is permanently closed.");
      }
      if (this.#state === "versionchanged") {
        throw new SaveRepositoryError(
          "UnsupportedRepositoryVersion",
          "initialize",
          "Repository connection was closed for a database version change."
        );
      }
      if (this.#state === "open") {
        return;
      }
      if (this.#initializePromise !== undefined) {
        return await this.#initializePromise;
      }
      const initializing = this.#initializeCore();
      this.#initializePromise = initializing;
      try {
        await initializing;
      } finally {
        if (this.#initializePromise === initializing) {
          this.#initializePromise = undefined;
        }
      }
    } catch (error) {
      throw mapBrowserFailure(error, "initialize", "DatabaseOpenFailed");
    }
  }

  public async listSlots(): Promise<SaveListResult> {
    try {
      const database = this.#requireDatabase("listSlots");
      const { keys, records } = await this.#readAllRecordsWithKeys(database);
      if (keys.length !== records.length) {
        throw new SaveRepositoryError(
          "CorruptRecord",
          "listSlots",
          "IndexedDB slot keys and records do not have matching counts."
        );
      }
      const validatedRecords = records.map((record, index) => {
        let slotId: SaveSlotId;
        try {
          slotId = parseSaveSlotId(keys[index], "listSlots");
        } catch {
          throw new SaveRepositoryError(
            "CorruptRecord",
            "listSlots",
            "IndexedDB contains an invalid physical slot key."
          );
        }
        return plainRecord(record, "listSlots", slotId);
      });
      const decoded = await Promise.all(validatedRecords.map((record) => this.#codec.decodeStoredRecord(record)));
      const slots = decoded
        .map((record) => copySaveSlotMetadata(record.metadata))
        .sort((left, right) => ordinalCompare(left.slotId, right.slotId));
      return Object.freeze({ slots: Object.freeze(slots) });
    } catch (error) {
      throw mapBrowserFailure(error, "listSlots", "TransactionFailed");
    }
  }

  public async readSlot(slotIdValue: SaveSlotId | string): Promise<SaveReadResult> {
    let slotId: SaveSlotId | undefined;
    try {
      const database = this.#requireDatabase("readSlot");
      slotId = parseSaveSlotId(slotIdValue, "readSlot");
      const rawRecord = await this.#readTransaction<unknown>(database, "readSlot", (store) => store.get(slotId!));
      if (rawRecord === undefined) {
        throw new SaveRepositoryError("SlotNotFound", "readSlot", "Save slot does not exist.", slotId);
      }
      const validatedRecord = plainRecord(rawRecord, "readSlot", slotId);
      return await this.#codec.decodeStoredRecord(validatedRecord);
    } catch (error) {
      throw mapBrowserFailure(error, "readSlot", "TransactionFailed", slotId);
    }
  }

  public async writeSlot(request: SaveWriteRequest): Promise<SaveWriteResult> {
    let slotId: SaveSlotId | undefined;
    try {
      const database = this.#requireDatabase("writeSlot");
      const parsed = parseSaveWriteRequest(request);
      slotId = parsed.slotId;
      const encoded = await this.#codec.encode(parsed.envelope);
      return await this.#writeTransaction(database, slotId, "writeSlot", (currentValue, store) => {
        const current = currentValue === undefined ? undefined : plainRecord(currentValue, "writeSlot", slotId!);
        let revision: SaveRecordRevision;
        if (current === undefined) {
          if (parsed.expectedRevision !== null && parsed.expectedRevision !== 0) {
            throw new SaveRepositoryError(
              "RevisionConflict",
              "writeSlot",
              "Missing slot cannot satisfy expected revision.",
              slotId
            );
          }
          revision = 1 as SaveRecordRevision;
        } else {
          if (parsed.expectedRevision === null) {
            throw new SaveRepositoryError("SlotAlreadyExists", "writeSlot", "Create-only target exists.", slotId);
          }
          if (current.metadata.recordRevision !== parsed.expectedRevision) {
            throw new SaveRepositoryError("RevisionConflict", "writeSlot", "Write revision does not match.", slotId);
          }
          revision = incrementRevision(current.metadata.recordRevision, "writeSlot", slotId!);
        }
        const metadata = metadataForWrite(
          slotId!,
          current?.metadata.displayName ?? slotId!,
          revision,
          encoded,
          parsed.lastWriteReason
        );
        const stored = createStoredSaveRecord(metadata, encoded.payloadBytes);
        store.put(stored, slotId!);
        return writeResultFrom(metadata, encoded);
      });
    } catch (error) {
      throw mapBrowserFailure(error, "writeSlot", "TransactionFailed", slotId);
    }
  }

  public async deleteSlot(
    slotIdValue: SaveSlotId | string,
    expectedRevisionValue: SaveRecordRevision | number
  ): Promise<SaveDeleteResult> {
    let slotId: SaveSlotId | undefined;
    try {
      const database = this.#requireDatabase("deleteSlot");
      slotId = parseSaveSlotId(slotIdValue, "deleteSlot");
      const expectedRevision = parseSaveRecordRevision(expectedRevisionValue, "deleteSlot", false);
      return await this.#writeTransaction(database, slotId, "deleteSlot", (currentValue, store) => {
        if (currentValue === undefined) {
          throw new SaveRepositoryError("SlotNotFound", "deleteSlot", "Save slot does not exist.", slotId);
        }
        const current = plainRecord(currentValue, "deleteSlot", slotId!);
        if (current.metadata.recordRevision !== expectedRevision) {
          throw new SaveRepositoryError("RevisionConflict", "deleteSlot", "Delete revision does not match.", slotId);
        }
        store.delete(slotId!);
        return Object.freeze({ slotId: slotId!, deletedRevision: current.metadata.recordRevision });
      });
    } catch (error) {
      throw mapBrowserFailure(error, "deleteSlot", "TransactionFailed", slotId);
    }
  }

  public async exportSlot(slotIdValue: SaveSlotId | string): Promise<SaveExportBundle> {
    try {
      this.#requireDatabase("exportSlot");
      return createSaveExportBundle(await this.readSlot(slotIdValue));
    } catch (error) {
      throw mapBrowserFailure(error, "exportSlot", "TransactionFailed");
    }
  }

  public async importSlot(bundle: unknown, policy: SaveImportPolicy): Promise<SaveWriteResult> {
    let targetSlotId: SaveSlotId | undefined;
    try {
      const database = this.#requireDatabase("importSlot");
      const prepared = await prepareSaveImport(this.#codec, bundle, policy);
      targetSlotId = prepared.targetSlotId;
      return await this.#writeTransaction(database, targetSlotId, "importSlot", (currentValue, store) => {
        const revision = this.#importRevision(prepared, currentValue);
        const metadata = createImportedMetadata(prepared, revision);
        store.put(createStoredSaveRecord(metadata, prepared.decoded.payloadBytes), targetSlotId!);
        return createImportedWriteResult(prepared, metadata);
      });
    } catch (error) {
      throw mapBrowserFailure(error, "importSlot", "TransactionFailed", targetSlotId);
    }
  }

  public async close(): Promise<void> {
    if (this.#state === "closed") {
      return;
    }
    this.#state = "closed";
    const database = this.#database;
    this.#database = undefined;
    if (database !== undefined) {
      try {
        database.close();
      } catch (error) {
        throw mapBrowserFailure(error, "close", "TransactionFailed");
      }
    }
  }

  async #initializeCore(): Promise<void> {
    if (this.#indexedDB === undefined) {
      throw new SaveRepositoryError("RepositoryUnavailable", "initialize", "IndexedDB capability is unavailable.");
    }
    const database = await this.#openDatabase(this.#indexedDB);
    if (this.#state === "closed") {
      database.close();
      throw new SaveRepositoryError("ClosedRepository", "initialize", "Repository instance is permanently closed.");
    }
    try {
      if (
        !database.objectStoreNames.contains(INDEXED_DB_SAVE_SLOTS_STORE) ||
        !database.objectStoreNames.contains(INDEXED_DB_REPOSITORY_METADATA_STORE)
      ) {
        throw new SaveRepositoryError(
          "DatabaseOpenFailed",
          "initialize",
          "IndexedDB repository structure is incomplete."
        );
      }
      database.onversionchange = () => {
        database.close();
        if (this.#state !== "closed") {
          this.#state = "versionchanged";
        }
        if (this.#database === database) {
          this.#database = undefined;
        }
      };
      const marker = await this.#validateSchemaAndReadMarker(database);
      if (typeof marker === "number" && Number.isFinite(marker) && marker > 1) {
        throw new SaveRepositoryError(
          "UnsupportedRepositoryVersion",
          "initialize",
          "Future repository schema marker is unsupported."
        );
      }
      if (marker !== 1) {
        throw new SaveRepositoryError("CorruptRecord", "initialize", "Repository schema marker is missing or corrupt.");
      }
      const publicationState = this.#currentState();
      if (publicationState === "closed") {
        throw new SaveRepositoryError("ClosedRepository", "initialize", "Repository instance is permanently closed.");
      }
      if (publicationState === "versionchanged") {
        throw new SaveRepositoryError(
          "UnsupportedRepositoryVersion",
          "initialize",
          "Repository connection was closed for a database version change."
        );
      }
      this.#database = database;
      this.#state = "open";
    } catch (error) {
      database.close();
      throw error;
    }
  }

  #openDatabase(factory: IDBFactory): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      let request: IDBOpenDBRequest;
      let upgradeFailure: SaveRepositoryError | undefined;
      let settled = false;
      try {
        request = factory.open(this.#databaseId, INDEXED_DB_SAVE_REPOSITORY_VERSION);
      } catch (error) {
        reject(mapBrowserFailure(error, "initialize", "DatabaseOpenFailed"));
        return;
      }
      request.onblocked = () => {
        if (!settled) {
          settled = true;
          reject(new SaveRepositoryError("DatabaseOpenFailed", "initialize", "IndexedDB open or upgrade is blocked."));
        }
      };
      request.onupgradeneeded = (event) => {
        try {
          const oldVersion = (event as IDBVersionChangeEvent).oldVersion;
          if (oldVersion !== 0) {
            throw new SaveRepositoryError(
              "UnsupportedRepositoryVersion",
              "initialize",
              "Only creation of repository schema V1 is supported."
            );
          }
          const database = request.result;
          database.createObjectStore(INDEXED_DB_SAVE_SLOTS_STORE);
          const metadata = database.createObjectStore(INDEXED_DB_REPOSITORY_METADATA_STORE);
          const markerRequest = metadata.put(1, INDEXED_DB_REPOSITORY_SCHEMA_MARKER_KEY);
          markerRequest.onerror = () => {
            upgradeFailure = mapBrowserFailure(markerRequest.error, "initialize", "DatabaseOpenFailed");
          };
        } catch (error) {
          upgradeFailure = mapBrowserFailure(error, "initialize", "DatabaseOpenFailed");
          try {
            request.transaction?.abort();
          } catch {
            // The original mapped upgrade failure remains authoritative.
          }
        }
      };
      request.onerror = () => {
        if (!settled) {
          settled = true;
          reject(upgradeFailure ?? mapBrowserFailure(request.error, "initialize", "DatabaseOpenFailed"));
        }
      };
      request.onsuccess = () => {
        if (settled) {
          request.result.close();
          return;
        }
        settled = true;
        resolve(request.result);
      };
    });
  }

  #validateSchemaAndReadMarker(database: IDBDatabase): Promise<unknown> {
    return new Promise((resolve, reject) => {
      let transaction: IDBTransaction;
      let request: IDBRequest<unknown>;
      let result: unknown;
      let requestFailure: unknown;
      try {
        transaction = database.transaction([
          INDEXED_DB_SAVE_SLOTS_STORE,
          INDEXED_DB_REPOSITORY_METADATA_STORE
        ], "readonly");
        const saveSlots = transaction.objectStore(INDEXED_DB_SAVE_SLOTS_STORE);
        const metadata = transaction.objectStore(INDEXED_DB_REPOSITORY_METADATA_STORE);
        if (
          saveSlots.keyPath !== null ||
          saveSlots.autoIncrement !== false ||
          metadata.keyPath !== null ||
          metadata.autoIncrement !== false
        ) {
          reject(new SaveRepositoryError(
            "DatabaseOpenFailed",
            "initialize",
            "IndexedDB repository store layout is incompatible with schema V1."
          ));
          return;
        }
        request = metadata.get(INDEXED_DB_REPOSITORY_SCHEMA_MARKER_KEY);
      } catch (error) {
        reject(mapBrowserFailure(error, "initialize", "DatabaseOpenFailed"));
        return;
      }
      request.onsuccess = () => {
        result = request.result;
      };
      request.onerror = () => {
        requestFailure = request.error;
      };
      transaction.oncomplete = () => resolve(result);
      transaction.onerror = () => undefined;
      transaction.onabort = () => reject(mapBrowserFailure(
        requestFailure ?? transaction.error,
        "initialize",
        "DatabaseOpenFailed"
      ));
    });
  }

  #readTransaction<T>(
    database: IDBDatabase,
    operation: string,
    makeRequest: (store: IDBObjectStore) => IDBRequest<T>
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      let transaction: IDBTransaction;
      let request: IDBRequest<T>;
      let result: T;
      let requestFailure: unknown;
      try {
        transaction = database.transaction(INDEXED_DB_SAVE_SLOTS_STORE, "readonly");
        request = makeRequest(transaction.objectStore(INDEXED_DB_SAVE_SLOTS_STORE));
      } catch (error) {
        reject(mapBrowserFailure(error, operation, "TransactionFailed"));
        return;
      }
      request.onsuccess = () => {
        result = request.result;
      };
      request.onerror = () => {
        requestFailure = request.error;
      };
      transaction.oncomplete = () => resolve(result!);
      transaction.onerror = () => undefined;
      transaction.onabort = () => reject(this.#transactionFailure(
        requestFailure ?? transaction.error,
        operation
      ));
    });
  }

  #readAllRecordsWithKeys(
    database: IDBDatabase
  ): Promise<{ readonly keys: readonly IDBValidKey[]; readonly records: readonly unknown[] }> {
    return new Promise((resolve, reject) => {
      let transaction: IDBTransaction;
      let recordsRequest: IDBRequest<unknown[]>;
      let keysRequest: IDBRequest<IDBValidKey[]>;
      let records: unknown[] | undefined;
      let keys: IDBValidKey[] | undefined;
      let requestFailure: unknown;
      try {
        transaction = database.transaction(INDEXED_DB_SAVE_SLOTS_STORE, "readonly");
        const store = transaction.objectStore(INDEXED_DB_SAVE_SLOTS_STORE);
        recordsRequest = store.getAll();
        keysRequest = store.getAllKeys();
      } catch (error) {
        reject(mapBrowserFailure(error, "listSlots", "TransactionFailed"));
        return;
      }
      recordsRequest.onsuccess = () => {
        records = recordsRequest.result;
      };
      recordsRequest.onerror = () => {
        requestFailure = recordsRequest.error;
      };
      keysRequest.onsuccess = () => {
        keys = keysRequest.result;
      };
      keysRequest.onerror = () => {
        requestFailure ??= keysRequest.error;
      };
      transaction.oncomplete = () => {
        if (!Array.isArray(records) || !Array.isArray(keys)) {
          reject(new SaveRepositoryError(
            "CorruptRecord",
            "listSlots",
            "IndexedDB did not return complete slot keys and records."
          ));
          return;
        }
        resolve({ keys, records });
      };
      transaction.onerror = () => undefined;
      transaction.onabort = () => reject(this.#transactionFailure(
        requestFailure ?? transaction.error,
        "listSlots"
      ));
    });
  }

  #writeTransaction<T>(
    database: IDBDatabase,
    slotId: SaveSlotId,
    operation: string,
    mutate: (currentValue: unknown, store: IDBObjectStore) => T
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      let transaction: IDBTransaction;
      let getRequest: IDBRequest<unknown>;
      let result: T;
      let domainFailure: SaveRepositoryError | undefined;
      let requestFailure: unknown;
      try {
        transaction = database.transaction(INDEXED_DB_SAVE_SLOTS_STORE, "readwrite");
        const store = transaction.objectStore(INDEXED_DB_SAVE_SLOTS_STORE);
        getRequest = store.get(slotId);
        getRequest.onsuccess = () => {
          try {
            result = mutate(getRequest.result, store);
          } catch (error) {
            domainFailure = mapBrowserFailure(error, operation, "TransactionFailed", slotId);
            try {
              transaction.abort();
            } catch (abortError) {
              reject(mapBrowserFailure(abortError, operation, "TransactionFailed", slotId));
            }
          }
        };
        getRequest.onerror = () => {
          requestFailure = getRequest.error;
        };
      } catch (error) {
        reject(mapBrowserFailure(error, operation, "TransactionFailed", slotId));
        return;
      }
      transaction.oncomplete = () => resolve(result!);
      transaction.onerror = (event) => {
        const target = event.target as IDBRequest<unknown> | null;
        requestFailure ??= target?.error;
      };
      transaction.onabort = () => reject(
        domainFailure ?? this.#transactionFailure(requestFailure ?? transaction.error, operation, slotId)
      );
    });
  }

  #transactionFailure(error: unknown, operation: string, slotId?: SaveSlotId): SaveRepositoryError {
    if (this.#state === "versionchanged") {
      return new SaveRepositoryError(
        "UnsupportedRepositoryVersion",
        operation,
        "Repository connection closed for a database version change.",
        slotId
      );
    }
    return mapBrowserFailure(error, operation, "TransactionFailed", slotId);
  }

  #currentState(): RepositoryState {
    return this.#state;
  }

  #requireDatabase(operation: string): IDBDatabase {
    if (this.#state === "closed") {
      throw new SaveRepositoryError("ClosedRepository", operation, "Repository instance is permanently closed.");
    }
    if (this.#state === "versionchanged") {
      throw new SaveRepositoryError(
        "UnsupportedRepositoryVersion",
        operation,
        "Repository connection closed for a database version change."
      );
    }
    if (this.#state !== "open" || this.#database === undefined) {
      throw new SaveRepositoryError("RepositoryUnavailable", operation, "Repository has not been initialized.");
    }
    return this.#database;
  }

  #importRevision(prepared: PreparedSaveImport, currentValue: unknown): SaveRecordRevision {
    const current = currentValue === undefined
      ? undefined
      : plainRecord(currentValue, "importSlot", prepared.targetSlotId);
    if (prepared.policy.kind === "RejectIfExists" || prepared.policy.kind === "CreateNewSlot") {
      if (current !== undefined) {
        throw new SaveRepositoryError(
          "ImportConflict",
          "importSlot",
          "Import target already exists.",
          prepared.targetSlotId
        );
      }
      return 1 as SaveRecordRevision;
    }
    if (current === undefined || current.metadata.recordRevision !== prepared.policy.expectedRevision) {
      throw new SaveRepositoryError(
        "ImportConflict",
        "importSlot",
        "Import replacement revision does not match.",
        prepared.targetSlotId
      );
    }
    return incrementRevision(current.metadata.recordRevision, "importSlot", prepared.targetSlotId);
  }
}

export const createIndexedDbSaveRepository = (
  definitionSnapshots: readonly DefinitionResolutionSnapshot[],
  configuration?: IndexedDbSaveRepositoryConfiguration
): IndexedDbSaveRepository => new IndexedDbSaveRepository(definitionSnapshots, configuration);

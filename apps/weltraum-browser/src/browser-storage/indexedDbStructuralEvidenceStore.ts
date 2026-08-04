import {
  createStructuralEvidenceStoredRecordV2,
  mapStructuralEvidenceBrowserFailure,
  StructuralEvidenceStoreError,
  structuralEvidencePutReceipt,
  validateStructuralEvidenceHashV2,
  type StructuralEvidencePutReceiptV2,
  type StructuralEvidenceRecordStoreV2,
  type StructuralEvidenceStoredRecordV2,
  validateStructuralEvidenceStoredRecordV2,
  DEFAULT_INDEXED_DB_STRUCTURAL_EVIDENCE_DATABASE_ID,
  INDEXED_DB_STRUCTURAL_EVIDENCE_METADATA_STORE,
  INDEXED_DB_STRUCTURAL_EVIDENCE_RECORDS_STORE,
  INDEXED_DB_STRUCTURAL_EVIDENCE_SCHEMA_MARKER_KEY,
  INDEXED_DB_STRUCTURAL_EVIDENCE_VERSION
} from "./structuralEvidenceStore";

type IndexedDbStructuralEvidenceStoreState = "new" | "open" | "versionchanged" | "closed";

export interface IndexedDbStructuralEvidenceStoreConfiguration {
  readonly databaseId?: string;
  readonly indexedDB?: IDBFactory;
}

const databaseIdFrom = (value: unknown): string => {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > 256 ||
    value.trim() !== value ||
    /[\u0000-\u001f\u007f]/.test(value)
  ) {
    throw new StructuralEvidenceStoreError("InvalidContract", "configureIndexedDb", "Database ID is not valid bounded text.");
  }
  return value;
};

export class IndexedDbStructuralEvidenceStore implements StructuralEvidenceRecordStoreV2 {
  readonly #databaseId: string;
  readonly #indexedDB: IDBFactory | undefined;
  #state: IndexedDbStructuralEvidenceStoreState = "new";
  #database: IDBDatabase | undefined;
  #initializePromise: Promise<void> | undefined;

  public constructor(configuration: IndexedDbStructuralEvidenceStoreConfiguration = {}) {
    this.#databaseId = databaseIdFrom(configuration.databaseId ?? DEFAULT_INDEXED_DB_STRUCTURAL_EVIDENCE_DATABASE_ID);
    this.#indexedDB = configuration.indexedDB ?? (typeof globalThis === "undefined" ? undefined : globalThis.indexedDB);
  }

  public async initialize(): Promise<void> {
    try {
      if (this.#state === "closed") {
        throw new StructuralEvidenceStoreError("ClosedRepository", "initialize", "Structural Evidence store is permanently closed.");
      }
      if (this.#state === "versionchanged") {
        throw new StructuralEvidenceStoreError("UnsupportedRepositoryVersion", "initialize", "Structural Evidence connection was closed for a database version change.");
      }
      if (this.#state === "open") return;
      if (this.#initializePromise !== undefined) return await this.#initializePromise;
      const initializing = this.#initializeCore();
      this.#initializePromise = initializing;
      try {
        await initializing;
      } finally {
        if (this.#initializePromise === initializing) this.#initializePromise = undefined;
      }
    } catch (error) {
      throw mapStructuralEvidenceBrowserFailure(error, "initialize", "DatabaseOpenFailed");
    }
  }

  public async resolve(hash: string): Promise<string | null> {
    try {
      const database = this.#requireDatabase("resolve", hash);
      validateStructuralEvidenceHashV2(hash, "resolve");
      const raw = await this.#readTransaction<unknown>(database, "resolve", (store) => store.get(hash));
      if (raw === undefined) return null;
      return validateStructuralEvidenceStoredRecordV2(hash, raw, "resolve").canonicalBytes;
    } catch (error) {
      throw mapStructuralEvidenceBrowserFailure(error, "resolve", "TransactionFailed", hash);
    }
  }

  public async putIfAbsent(hash: string, canonicalBytes: string): Promise<StructuralEvidencePutReceiptV2> {
    let record: StructuralEvidenceStoredRecordV2;
    try {
      const database = this.#requireDatabase("putIfAbsent", hash);
      record = createStructuralEvidenceStoredRecordV2(hash, canonicalBytes);
      return await this.#putTransaction(database, record);
    } catch (error) {
      throw mapStructuralEvidenceBrowserFailure(error, "putIfAbsent", "TransactionFailed", hash);
    }
  }

  public async close(): Promise<void> {
    if (this.#state === "closed") return;
    this.#state = "closed";
    const database = this.#database;
    this.#database = undefined;
    if (database !== undefined) {
      try {
        database.close();
      } catch (error) {
        throw mapStructuralEvidenceBrowserFailure(error, "close", "TransactionFailed");
      }
    }
  }

  async #initializeCore(): Promise<void> {
    if (this.#indexedDB === undefined) {
      throw new StructuralEvidenceStoreError("RepositoryUnavailable", "initialize", "IndexedDB capability is unavailable.");
    }
    const database = await this.#openDatabase(this.#indexedDB);
    if (this.#state === "closed") {
      database.close();
      throw new StructuralEvidenceStoreError("ClosedRepository", "initialize", "Structural Evidence store is permanently closed.");
    }
    try {
      if (!database.objectStoreNames.contains(INDEXED_DB_STRUCTURAL_EVIDENCE_RECORDS_STORE) || !database.objectStoreNames.contains(INDEXED_DB_STRUCTURAL_EVIDENCE_METADATA_STORE)) {
        throw new StructuralEvidenceStoreError("DatabaseOpenFailed", "initialize", "Structural Evidence database structure is incomplete.");
      }
      database.onversionchange = () => {
        database.close();
        if (this.#state !== "closed") this.#state = "versionchanged";
        if (this.#database === database) this.#database = undefined;
      };
      await this.#validateSchema(database);
      const publicationState = this.#currentState();
      if (publicationState === "closed") throw new StructuralEvidenceStoreError("ClosedRepository", "initialize", "Structural Evidence store is permanently closed.");
      if (publicationState === "versionchanged") throw new StructuralEvidenceStoreError("UnsupportedRepositoryVersion", "initialize", "Structural Evidence connection was closed for a database version change.");
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
      let upgradeFailure: StructuralEvidenceStoreError | undefined;
      let settled = false;
      try {
        request = factory.open(this.#databaseId, INDEXED_DB_STRUCTURAL_EVIDENCE_VERSION);
      } catch (error) {
        reject(mapStructuralEvidenceBrowserFailure(error, "initialize", "DatabaseOpenFailed"));
        return;
      }
      request.onblocked = () => {
        if (!settled) {
          settled = true;
          reject(new StructuralEvidenceStoreError("DatabaseOpenFailed", "initialize", "IndexedDB open or upgrade is blocked."));
        }
      };
      request.onupgradeneeded = (event) => {
        try {
          const oldVersion = (event as IDBVersionChangeEvent).oldVersion;
          if (oldVersion !== 0) {
            throw new StructuralEvidenceStoreError("UnsupportedRepositoryVersion", "initialize", "Only creation of Structural Evidence schema V1 is supported.");
          }
          const database = request.result;
          const records = database.createObjectStore(INDEXED_DB_STRUCTURAL_EVIDENCE_RECORDS_STORE);
          const metadata = database.createObjectStore(INDEXED_DB_STRUCTURAL_EVIDENCE_METADATA_STORE);
          if (records.keyPath !== null || records.autoIncrement || metadata.keyPath !== null || metadata.autoIncrement) {
            throw new StructuralEvidenceStoreError("DatabaseOpenFailed", "initialize", "Structural Evidence store layout is incompatible.");
          }
          const markerRequest = metadata.put(1, INDEXED_DB_STRUCTURAL_EVIDENCE_SCHEMA_MARKER_KEY);
          markerRequest.onerror = () => { upgradeFailure = mapStructuralEvidenceBrowserFailure(markerRequest.error, "initialize", "DatabaseOpenFailed"); };
        } catch (error) {
          upgradeFailure = mapStructuralEvidenceBrowserFailure(error, "initialize", "DatabaseOpenFailed");
          try { request.transaction?.abort(); } catch { /* retain the original failure */ }
        }
      };
      request.onerror = () => {
        if (!settled) {
          settled = true;
          reject(upgradeFailure ?? mapStructuralEvidenceBrowserFailure(request.error, "initialize", "DatabaseOpenFailed"));
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

  #validateSchema(database: IDBDatabase): Promise<void> {
    return new Promise((resolve, reject) => {
      let transaction: IDBTransaction;
      let markerRequest: IDBRequest<unknown>;
      let marker: unknown;
      let requestFailure: unknown;
      try {
        transaction = database.transaction([INDEXED_DB_STRUCTURAL_EVIDENCE_RECORDS_STORE, INDEXED_DB_STRUCTURAL_EVIDENCE_METADATA_STORE], "readonly");
        const records = transaction.objectStore(INDEXED_DB_STRUCTURAL_EVIDENCE_RECORDS_STORE);
        const metadata = transaction.objectStore(INDEXED_DB_STRUCTURAL_EVIDENCE_METADATA_STORE);
        if (records.keyPath !== null || records.autoIncrement || metadata.keyPath !== null || metadata.autoIncrement) {
          reject(new StructuralEvidenceStoreError("DatabaseOpenFailed", "initialize", "Structural Evidence store layout is incompatible."));
          return;
        }
        markerRequest = metadata.get(INDEXED_DB_STRUCTURAL_EVIDENCE_SCHEMA_MARKER_KEY);
      } catch (error) {
        reject(mapStructuralEvidenceBrowserFailure(error, "initialize", "DatabaseOpenFailed"));
        return;
      }
      markerRequest.onsuccess = () => { marker = markerRequest.result; };
      markerRequest.onerror = () => { requestFailure = markerRequest.error; };
      transaction.oncomplete = () => {
        if (marker !== 1) reject(new StructuralEvidenceStoreError("CorruptRecord", "initialize", "Structural Evidence schema marker is missing or corrupt."));
        else resolve();
      };
      transaction.onerror = () => undefined;
      transaction.onabort = () => reject(mapStructuralEvidenceBrowserFailure(requestFailure ?? transaction.error, "initialize", "DatabaseOpenFailed"));
    });
  }

  #readTransaction<T>(database: IDBDatabase, operation: string, makeRequest: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      let transaction: IDBTransaction;
      let request: IDBRequest<T>;
      let result: T | undefined;
      let requestFailure: unknown;
      try {
        transaction = database.transaction(INDEXED_DB_STRUCTURAL_EVIDENCE_RECORDS_STORE, "readonly");
        request = makeRequest(transaction.objectStore(INDEXED_DB_STRUCTURAL_EVIDENCE_RECORDS_STORE));
      } catch (error) {
        reject(mapStructuralEvidenceBrowserFailure(error, operation, "TransactionFailed"));
        return;
      }
      request.onsuccess = () => { result = request.result; };
      request.onerror = () => { requestFailure = request.error; };
      transaction.oncomplete = () => resolve(result as T);
      transaction.onerror = () => undefined;
      transaction.onabort = () => reject(this.#transactionFailure(requestFailure ?? transaction.error, operation));
    });
  }

  #putTransaction(database: IDBDatabase, record: StructuralEvidenceStoredRecordV2): Promise<StructuralEvidencePutReceiptV2> {
    return new Promise((resolve, reject) => {
      let transaction: IDBTransaction;
      let request: IDBRequest<unknown>;
      let result: StructuralEvidencePutReceiptV2 | undefined;
      let domainFailure: unknown;
      let requestFailure: unknown;
      try {
        transaction = database.transaction(INDEXED_DB_STRUCTURAL_EVIDENCE_RECORDS_STORE, "readwrite");
        const store = transaction.objectStore(INDEXED_DB_STRUCTURAL_EVIDENCE_RECORDS_STORE);
        request = store.get(record.hash);
        request.onsuccess = () => {
          try {
            if (request.result !== undefined) {
              const existing = validateStructuralEvidenceStoredRecordV2(record.hash, request.result, "putIfAbsent");
              if (existing.canonicalBytes !== record.canonicalBytes) {
                domainFailure = new StructuralEvidenceStoreError("RecordConflict", "putIfAbsent", "Structural Evidence key already stores different bytes.", record.hash);
                transaction.abort();
                return;
              }
              result = structuralEvidencePutReceipt(record.hash, record.byteLength, true);
              return;
            }
            const addRequest = store.add(record, record.hash);
            addRequest.onerror = () => { requestFailure = addRequest.error; };
            result = structuralEvidencePutReceipt(record.hash, record.byteLength, false);
          } catch (error) {
            domainFailure = error;
            try { transaction.abort(); } catch { /* original error remains authoritative */ }
          }
        };
        request.onerror = () => { requestFailure = request.error; };
      } catch (error) {
        reject(mapStructuralEvidenceBrowserFailure(error, "putIfAbsent", "TransactionFailed", record.hash));
        return;
      }
      transaction.oncomplete = () => resolve(result ?? structuralEvidencePutReceipt(record.hash, record.byteLength, false));
      transaction.onerror = () => undefined;
      transaction.onabort = () => reject(domainFailure ?? this.#transactionFailure(requestFailure ?? transaction.error, "putIfAbsent", record.hash));
    });
  }

  #currentState(): IndexedDbStructuralEvidenceStoreState {
    return this.#state;
  }

  #transactionFailure(error: unknown, operation: string, hash?: string): StructuralEvidenceStoreError {
    if (this.#state === "versionchanged") return new StructuralEvidenceStoreError("UnsupportedRepositoryVersion", operation, "Structural Evidence connection was closed for a database version change.", hash);
    return mapStructuralEvidenceBrowserFailure(error, operation, "TransactionFailed", hash);
  }

  #requireDatabase(operation: string, hash?: string): IDBDatabase {
    if (this.#state === "closed") throw new StructuralEvidenceStoreError("ClosedRepository", operation, "Structural Evidence store is permanently closed.", hash);
    if (this.#state === "versionchanged") throw new StructuralEvidenceStoreError("UnsupportedRepositoryVersion", operation, "Structural Evidence connection was closed for a database version change.", hash);
    if (this.#state !== "open" || this.#database === undefined) throw new StructuralEvidenceStoreError("RepositoryUnavailable", operation, "Structural Evidence store has not been initialized.", hash);
    return this.#database;
  }
}

export const createIndexedDbStructuralEvidenceStore = (configuration?: IndexedDbStructuralEvidenceStoreConfiguration): IndexedDbStructuralEvidenceStore =>
  new IndexedDbStructuralEvidenceStore(configuration);
export {
  INDEXED_DB_STRUCTURAL_EVIDENCE_VERSION,
  INDEXED_DB_STRUCTURAL_EVIDENCE_RECORDS_STORE
} from "./structuralEvidenceStore";

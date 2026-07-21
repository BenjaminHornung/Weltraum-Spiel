import { describe, expect, it } from "vitest";
import {
  createDefinitionResolutionFixture,
  createSaveGameEnvelopeV1Fixture
} from "../../src/persistence";
import {
  createIndexedDbSaveRepository,
  createMemorySaveRepository,
  INDEXED_DB_REPOSITORY_METADATA_STORE,
  INDEXED_DB_SAVE_SLOTS_STORE,
  SaveRepositoryError,
  type SaveExportBundle,
  type SaveImportPolicy,
  type SaveRepositoryErrorCode,
  type SaveWriteRequest
} from "../../src/browser-storage";

const expectCode = async (operation: Promise<unknown>, code: SaveRepositoryErrorCode): Promise<void> => {
  await expect(operation).rejects.toMatchObject({ code } satisfies Partial<SaveRepositoryError>);
};

const sourceBundle = async (): Promise<SaveExportBundle> => {
  const repository = createMemorySaveRepository(createDefinitionResolutionFixture());
  await repository.initialize();
  await repository.writeSlot({
    slotId: "source-slot",
    expectedRevision: null,
    envelope: createSaveGameEnvelopeV1Fixture(),
    lastWriteReason: "ManualSave"
  });
  return repository.exportSlot("source-slot");
};

interface ControlledStoreLayout {
  readonly keyPath?: IDBObjectStore["keyPath"];
  readonly autoIncrement?: boolean;
}

interface ControlledIndexedDbOptions {
  readonly saveSlots?: ControlledStoreLayout;
  readonly repositoryMetadata?: ControlledStoreLayout;
  readonly blockedOpen?: boolean;
}

interface ControlledRequest<T> {
  result: T;
  error: DOMException | null;
  onsuccess: ((event: Event) => void) | null;
  onerror: ((event: Event) => void) | null;
}

interface ControlledReadwriteTransaction {
  readonly operations: readonly string[];
  readCurrent(): void;
  complete(): void;
  abortWithRequestError(error: DOMException): void;
}

const createControlledIndexedDb = (options: ControlledIndexedDbOptions = {}) => {
  let closeCount = 0;
  let validationComplete = false;
  let activeReadwrite = false;
  let readonlyTransactionCount = 0;
  let readwriteTransactionCount = 0;
  let resolveValidationStarted!: () => void;
  const committedRecords = new Map<string, unknown>();
  const readonlyOperationHistory: string[][] = [];
  const queuedReadwriteTransactions: ControlledReadwriteTransaction[] = [];
  const readwriteWaiters: Array<(transaction: ControlledReadwriteTransaction) => void> = [];
  const validationStarted = new Promise<void>((resolve) => {
    resolveValidationStarted = resolve;
  });
  const markerRequest: ControlledRequest<unknown> = {
    result: 1,
    error: null,
    onsuccess: null,
    onerror: null
  };
  const validationSaveSlots = {
    keyPath: options.saveSlots?.keyPath ?? null,
    autoIncrement: options.saveSlots?.autoIncrement ?? false
  } as unknown as IDBObjectStore;
  const repositoryMetadata = {
    keyPath: options.repositoryMetadata?.keyPath ?? null,
    autoIncrement: options.repositoryMetadata?.autoIncrement ?? false,
    get(): IDBRequest<unknown> {
      return markerRequest as unknown as IDBRequest<unknown>;
    }
  } as unknown as IDBObjectStore;
  const validationTransaction = {
    error: null,
    oncomplete: null,
    onerror: null,
    onabort: null,
    objectStore(name: string): IDBObjectStore {
      if (name === INDEXED_DB_SAVE_SLOTS_STORE) {
        return validationSaveSlots;
      }
      if (name === INDEXED_DB_REPOSITORY_METADATA_STORE) {
        return repositoryMetadata;
      }
      throw new DOMException("Unknown controlled store.", "NotFoundError");
    }
  } as unknown as IDBTransaction;

  const publishReadwriteTransaction = (controlled: ControlledReadwriteTransaction): void => {
    const waiter = readwriteWaiters.shift();
    if (waiter === undefined) {
      queuedReadwriteTransactions.push(controlled);
    } else {
      waiter(controlled);
    }
  };

  const requireStringKey = (value: IDBValidKey | IDBKeyRange | undefined): string => {
    if (typeof value !== "string") {
      throw new DOMException("The controlled store accepts string keys only.", "DataError");
    }
    return value;
  };

  const createReadonlyTransaction = (): IDBTransaction => {
    readonlyTransactionCount += 1;
    const operations: string[] = [];
    readonlyOperationHistory.push(operations);
    let pendingRequests = 0;
    let settled = false;
    const transactionState = {
      error: null as DOMException | null,
      oncomplete: null as ((event: Event) => void) | null,
      onerror: null as ((event: Event) => void) | null,
      onabort: null as ((event: Event) => void) | null,
      objectStore(name: string): IDBObjectStore {
        if (name !== INDEXED_DB_SAVE_SLOTS_STORE) {
          throw new DOMException("Unknown controlled store.", "NotFoundError");
        }
        return store;
      }
    };
    const requestFor = <T>(operation: string, result: T): IDBRequest<T> => {
      operations.push(operation);
      pendingRequests += 1;
      const request: ControlledRequest<T> = {
        result,
        error: null,
        onsuccess: null,
        onerror: null
      };
      queueMicrotask(() => {
        request.onsuccess?.(new Event("success"));
        pendingRequests -= 1;
        if (pendingRequests === 0 && !settled) {
          settled = true;
          transactionState.oncomplete?.(new Event("complete"));
        }
      });
      return request as unknown as IDBRequest<T>;
    };
    const store = {
      keyPath: null,
      autoIncrement: false,
      get(query: IDBValidKey | IDBKeyRange): IDBRequest<unknown> {
        const key = requireStringKey(query);
        return requestFor(`get:${key}`, committedRecords.get(key));
      },
      getAll(): IDBRequest<unknown[]> {
        return requestFor("getAll", [...committedRecords.values()]);
      },
      getAllKeys(): IDBRequest<IDBValidKey[]> {
        return requestFor<IDBValidKey[]>("getAllKeys", [...committedRecords.keys()]);
      }
    } as unknown as IDBObjectStore;
    return transactionState as unknown as IDBTransaction;
  };

  const createReadwriteTransaction = (): IDBTransaction => {
    if (activeReadwrite) {
      throw new DOMException("Only one controlled readwrite transaction may be active.", "InvalidStateError");
    }
    activeReadwrite = true;
    readwriteTransactionCount += 1;
    const operations: string[] = [];
    let key: string | undefined;
    let readDispatched = false;
    let settled = false;
    let mutation:
      | { readonly kind: "put"; readonly key: string; readonly value: unknown; readonly request: ControlledRequest<IDBValidKey> }
      | { readonly kind: "delete"; readonly key: string; readonly request: ControlledRequest<undefined> }
      | undefined;
    const readRequest: ControlledRequest<unknown> = {
      result: undefined,
      error: null,
      onsuccess: null,
      onerror: null
    };
    const transactionState = {
      error: null as DOMException | null,
      oncomplete: null as ((event: Event) => void) | null,
      onerror: null as ((event: Event) => void) | null,
      onabort: null as ((event: Event) => void) | null,
      objectStore(name: string): IDBObjectStore {
        if (name !== INDEXED_DB_SAVE_SLOTS_STORE) {
          throw new DOMException("Unknown controlled store.", "NotFoundError");
        }
        return store;
      },
      abort(): void {
        if (settled) {
          throw new DOMException("Controlled transaction is already settled.", "InvalidStateError");
        }
        settled = true;
        activeReadwrite = false;
        transactionState.onabort?.(new Event("abort"));
      }
    };
    const store = {
      keyPath: null,
      autoIncrement: false,
      get(query: IDBValidKey | IDBKeyRange): IDBRequest<unknown> {
        if (key !== undefined) {
          throw new DOMException("The controlled transaction permits one read.", "InvalidStateError");
        }
        key = requireStringKey(query);
        operations.push(`get:${key}`);
        return readRequest as unknown as IDBRequest<unknown>;
      },
      put(value: unknown, suppliedKey?: IDBValidKey): IDBRequest<IDBValidKey> {
        const mutationKey = requireStringKey(suppliedKey);
        if (mutation !== undefined || mutationKey !== key) {
          throw new DOMException("Controlled put must follow its transaction read.", "InvalidStateError");
        }
        const request: ControlledRequest<IDBValidKey> = {
          result: mutationKey,
          error: null,
          onsuccess: null,
          onerror: null
        };
        mutation = { kind: "put", key: mutationKey, value, request };
        operations.push(`put:${mutationKey}`);
        return request as unknown as IDBRequest<IDBValidKey>;
      },
      delete(query: IDBValidKey | IDBKeyRange): IDBRequest<undefined> {
        const mutationKey = requireStringKey(query);
        if (mutation !== undefined || mutationKey !== key) {
          throw new DOMException("Controlled delete must follow its transaction read.", "InvalidStateError");
        }
        const request: ControlledRequest<undefined> = {
          result: undefined,
          error: null,
          onsuccess: null,
          onerror: null
        };
        mutation = { kind: "delete", key: mutationKey, request };
        operations.push(`delete:${mutationKey}`);
        return request as unknown as IDBRequest<undefined>;
      }
    } as unknown as IDBObjectStore;
    const controlled: ControlledReadwriteTransaction = {
      get operations(): readonly string[] {
        return Object.freeze([...operations]);
      },
      readCurrent(): void {
        if (settled || readDispatched || key === undefined) {
          throw new Error("Controlled read is unavailable.");
        }
        readDispatched = true;
        readRequest.result = committedRecords.get(key);
        readRequest.onsuccess?.(new Event("success"));
      },
      complete(): void {
        if (settled || !readDispatched || mutation === undefined) {
          throw new Error("Controlled transaction cannot complete without one staged mutation.");
        }
        if (mutation.kind === "put") {
          committedRecords.set(mutation.key, mutation.value);
        } else {
          committedRecords.delete(mutation.key);
        }
        settled = true;
        activeReadwrite = false;
        transactionState.oncomplete?.(new Event("complete"));
      },
      abortWithRequestError(error: DOMException): void {
        if (settled || !readDispatched || mutation === undefined) {
          throw new Error("Controlled transaction has no staged mutation to abort.");
        }
        mutation.request.error = error;
        transactionState.onerror?.({ target: mutation.request } as unknown as Event);
        transactionState.error = new DOMException("Controlled transaction aborted.", "AbortError");
        settled = true;
        activeReadwrite = false;
        transactionState.onabort?.(new Event("abort"));
      }
    };
    publishReadwriteTransaction(controlled);
    return transactionState as unknown as IDBTransaction;
  };

  const database = {
    objectStoreNames: {
      contains(name: string): boolean {
        return name === INDEXED_DB_SAVE_SLOTS_STORE || name === INDEXED_DB_REPOSITORY_METADATA_STORE;
      }
    },
    onversionchange: null,
    transaction(_storeNames: string | string[], mode: IDBTransactionMode = "readonly"): IDBTransaction {
      if (mode === "readonly" && !validationComplete) {
        resolveValidationStarted();
        return validationTransaction;
      }
      if (mode === "readonly" && validationComplete) {
        return createReadonlyTransaction();
      }
      if (mode === "readwrite" && validationComplete) {
        return createReadwriteTransaction();
      }
      throw new DOMException("Unsupported controlled transaction.", "InvalidStateError");
    },
    close(): void {
      closeCount += 1;
    }
  } as unknown as IDBDatabase;
  const openRequest = {
    result: database,
    error: null,
    transaction: null,
    onblocked: null,
    onupgradeneeded: null,
    onerror: null,
    onsuccess: null
  } as unknown as IDBOpenDBRequest;
  const factory = {
    open(): IDBOpenDBRequest {
      queueMicrotask(() => {
        if (options.blockedOpen === true) {
          openRequest.onblocked?.(new Event("blocked") as IDBVersionChangeEvent);
        } else {
          openRequest.onsuccess?.(new Event("success"));
        }
      });
      return openRequest;
    }
  } as unknown as IDBFactory;

  return {
    factory,
    validationStarted,
    closeCount: (): number => closeCount,
    readonlyTransactionCount: (): number => readonlyTransactionCount,
    readwriteTransactionCount: (): number => readwriteTransactionCount,
    lastReadonlyOperations: (): readonly string[] => Object.freeze([
      ...(readonlyOperationHistory.at(-1) ?? [])
    ]),
    record: (slotId: string): unknown => committedRecords.get(slotId),
    moveRecord(fromSlotId: string, toSlotId: string): void {
      const record = committedRecords.get(fromSlotId);
      if (record === undefined || committedRecords.has(toSlotId)) {
        throw new Error("Controlled record move is invalid.");
      }
      committedRecords.delete(fromSlotId);
      committedRecords.set(toSlotId, record);
    },
    nextReadwriteTransaction(): Promise<ControlledReadwriteTransaction> {
      const queued = queuedReadwriteTransactions.shift();
      if (queued !== undefined) {
        return Promise.resolve(queued);
      }
      return new Promise((resolve) => readwriteWaiters.push(resolve));
    },
    completeValidation(marker: unknown = 1): void {
      markerRequest.result = marker;
      markerRequest.onsuccess?.(new Event("success"));
      validationComplete = true;
      validationTransaction.oncomplete?.(new Event("complete"));
    }
  };
};

const createInitializedControlledRepository = async (databaseId: string) => {
  const controlled = createControlledIndexedDb();
  const repository = createIndexedDbSaveRepository(createDefinitionResolutionFixture(), {
    databaseId,
    indexedDB: controlled.factory
  });
  const initialization = repository.initialize();
  await controlled.validationStarted;
  controlled.completeValidation();
  await initialization;
  return { controlled, repository };
};

const commitControlledMutation = async <T>(
  operation: Promise<T>,
  controlled: ReturnType<typeof createControlledIndexedDb>
): Promise<T> => {
  const transaction = await controlled.nextReadwriteTransaction();
  transaction.readCurrent();
  transaction.complete();
  return operation;
};

describe("browser storage import and export", () => {
  it("supports all three conflict-safe import policies", async () => {
    const bundle = JSON.parse(JSON.stringify(await sourceBundle())) as unknown;
    const repository = createMemorySaveRepository(createDefinitionResolutionFixture());
    await repository.initialize();

    const created = await repository.importSlot(bundle, { kind: "RejectIfExists" });
    expect(created.metadata).toMatchObject({ slotId: "source-slot", recordRevision: 1 });
    await expectCode(repository.importSlot(bundle, { kind: "RejectIfExists" }), "ImportConflict");
    const beforeConflict = await repository.readSlot("source-slot");
    await expectCode(repository.importSlot(bundle, {
      kind: "ReplaceExpectedRevision",
      expectedRevision: 2
    }), "ImportConflict");
    const afterConflict = await repository.readSlot("source-slot");
    expect(afterConflict.metadata).toEqual(beforeConflict.metadata);
    expect(afterConflict.payloadBytes).toEqual(beforeConflict.payloadBytes);
    const replaced = await repository.importSlot(bundle, {
      kind: "ReplaceExpectedRevision",
      expectedRevision: 1
    });
    expect(replaced.metadata.recordRevision).toBe(2);

    const copied = await repository.importSlot(bundle, {
      kind: "CreateNewSlot",
      targetSlotId: "copied-slot"
    });
    expect(copied.metadata).toMatchObject({
      slotId: "copied-slot",
      displayName: "source-slot",
      recordRevision: 1
    });
    await expectCode(repository.importSlot(bundle, {
      kind: "CreateNewSlot",
      targetSlotId: "copied-slot"
    }), "ImportConflict");
  });

  it("executes IndexedDB RejectIfExists creation and conflict without replacing the old record", async () => {
    const bundle = JSON.parse(JSON.stringify(await sourceBundle())) as unknown;
    const { controlled, repository } = await createInitializedControlledRepository("unit-test-import-reject-if-exists");
    const importing = repository.importSlot(bundle, { kind: "RejectIfExists" });
    const createTransaction = await controlled.nextReadwriteTransaction();

    expect(createTransaction.operations).toEqual(["get:source-slot"]);
    createTransaction.readCurrent();
    expect(createTransaction.operations).toEqual(["get:source-slot", "put:source-slot"]);
    createTransaction.complete();
    await expect(importing).resolves.toMatchObject({
      metadata: { slotId: "source-slot", recordRevision: 1 }
    });

    const committed = controlled.record("source-slot");
    const conflicting = expectCode(repository.importSlot(bundle, { kind: "RejectIfExists" }), "ImportConflict");
    const conflictTransaction = await controlled.nextReadwriteTransaction();
    conflictTransaction.readCurrent();
    await conflicting;

    expect(conflictTransaction.operations).toEqual(["get:source-slot"]);
    expect(controlled.record("source-slot")).toBe(committed);
    expect(controlled.readwriteTransactionCount()).toBe(2);
  });

  it("executes IndexedDB ReplaceExpectedRevision missing, stale, and exact-revision branches", async () => {
    const bundle = JSON.parse(JSON.stringify(await sourceBundle())) as unknown;
    const { controlled, repository } = await createInitializedControlledRepository("unit-test-import-replace-revision");
    const missing = expectCode(repository.importSlot(bundle, {
      kind: "ReplaceExpectedRevision",
      expectedRevision: 1
    }), "ImportConflict");
    const missingTransaction = await controlled.nextReadwriteTransaction();
    missingTransaction.readCurrent();
    await missing;

    expect(missingTransaction.operations).toEqual(["get:source-slot"]);
    expect(controlled.record("source-slot")).toBeUndefined();

    await commitControlledMutation(repository.importSlot(bundle, { kind: "RejectIfExists" }), controlled);
    const committed = controlled.record("source-slot");
    const stale = expectCode(repository.importSlot(bundle, {
      kind: "ReplaceExpectedRevision",
      expectedRevision: 2
    }), "ImportConflict");
    const staleTransaction = await controlled.nextReadwriteTransaction();
    staleTransaction.readCurrent();
    await stale;

    expect(staleTransaction.operations).toEqual(["get:source-slot"]);
    expect(controlled.record("source-slot")).toBe(committed);

    const replacing = repository.importSlot(bundle, {
      kind: "ReplaceExpectedRevision",
      expectedRevision: 1
    });
    const replaceTransaction = await controlled.nextReadwriteTransaction();
    replaceTransaction.readCurrent();
    expect(replaceTransaction.operations).toEqual(["get:source-slot", "put:source-slot"]);
    replaceTransaction.complete();
    await expect(replacing).resolves.toMatchObject({
      metadata: { slotId: "source-slot", recordRevision: 2 }
    });

    expect(controlled.record("source-slot")).not.toBe(committed);
    expect(controlled.record("source-slot")).toMatchObject({ metadata: { recordRevision: 2 } });
    expect(controlled.readwriteTransactionCount()).toBe(4);
  });

  it("executes IndexedDB CreateNewSlot absent success and existing-target conflict", async () => {
    const bundle = JSON.parse(JSON.stringify(await sourceBundle())) as unknown;
    const { controlled, repository } = await createInitializedControlledRepository("unit-test-import-create-new-slot");
    const policy = { kind: "CreateNewSlot", targetSlotId: "copied-slot" } as const;
    const importing = repository.importSlot(bundle, policy);
    const createTransaction = await controlled.nextReadwriteTransaction();

    createTransaction.readCurrent();
    expect(createTransaction.operations).toEqual(["get:copied-slot", "put:copied-slot"]);
    createTransaction.complete();
    await expect(importing).resolves.toMatchObject({
      metadata: { slotId: "copied-slot", displayName: "source-slot", recordRevision: 1 }
    });

    const committed = controlled.record("copied-slot");
    const conflicting = expectCode(repository.importSlot(bundle, policy), "ImportConflict");
    const conflictTransaction = await controlled.nextReadwriteTransaction();
    conflictTransaction.readCurrent();
    await conflicting;

    expect(conflictTransaction.operations).toEqual(["get:copied-slot"]);
    expect(controlled.record("copied-slot")).toBe(committed);
    expect(controlled.readwriteTransactionCount()).toBe(2);
  });

  it("rejects byte-count, checksum, canonical, and future bundle failures without mutation", async () => {
    const original = await sourceBundle();
    const repository = createMemorySaveRepository(createDefinitionResolutionFixture());
    await repository.initialize();
    const cases: Array<[unknown, SaveRepositoryErrorCode]> = [
      [{ ...original, payloadBytes: original.payloadBytes + 1 }, "InvalidEnvelope"],
      [{ ...original, contentHash: `sha256:${"0".repeat(64)}` }, "InvalidEnvelope"],
      [{ ...original, canonicalPayload: ` ${original.canonicalPayload}` }, "InvalidEnvelope"],
      [{ ...original, bundleVersion: 2 }, "UnsupportedRepositoryVersion"],
      [{ ...original, repositorySchemaVersion: 2 }, "UnsupportedRepositoryVersion"],
      [{ ...original, saveSchemaVersion: 2 }, "UnsupportedSaveVersion"]
    ];

    for (const [bundle, code] of cases) {
      await expectCode(repository.importSlot(bundle, { kind: "RejectIfExists" }), code);
      expect(await repository.listSlots()).toEqual({ slots: [] });
    }
  });

  it("keeps export JSON-safe and detached from returned typed arrays", async () => {
    const repository = createMemorySaveRepository(createDefinitionResolutionFixture());
    await repository.initialize();
    const written = await repository.writeSlot({
      slotId: "json-slot",
      expectedRevision: null,
      envelope: createSaveGameEnvelopeV1Fixture(),
      lastWriteReason: "ManualSave"
    });
    written.payloadBytes.fill(0);

    const exported = await repository.exportSlot("json-slot");
    const reparsed = JSON.parse(JSON.stringify(exported)) as SaveExportBundle;
    expect(reparsed).toEqual(exported);
    expect(Object.values(reparsed).some((value) => value instanceof Uint8Array || value instanceof ArrayBuffer)).toBe(false);
  });

  it("maps unavailable IndexedDB and preserves terminal close semantics without raw browser errors", async () => {
    const repository = createIndexedDbSaveRepository(createDefinitionResolutionFixture(), {
      databaseId: "unit-test-unavailable",
      indexedDB: undefined
    });

    await expectCode(repository.initialize(), "RepositoryUnavailable");
    await repository.close();
    await repository.close();
    await expectCode(repository.initialize(), "ClosedRepository");
    await expectCode(repository.listSlots(), "ClosedRepository");
  });

  it("maps a raw browser open failure without exposing the DOMException", async () => {
    const rawFailure = new DOMException("browser-specific detail", "VersionError");
    const throwingFactory = {
      open(): IDBOpenDBRequest {
        throw rawFailure;
      }
    } as unknown as IDBFactory;
    const repository = createIndexedDbSaveRepository(createDefinitionResolutionFixture(), {
      databaseId: "unit-test-version-error",
      indexedDB: throwingFactory
    });

    try {
      await repository.initialize();
      throw new Error("Expected initialize to reject.");
    } catch (error) {
      expect(error).toBeInstanceOf(SaveRepositoryError);
      expect(error).not.toBe(rawFailure);
      expect(error).toMatchObject({ code: "UnsupportedRepositoryVersion" });
      expect((error as Error).message).not.toContain("browser-specific detail");
    }
  });

  it("maps a blocked IndexedDB open without publishing a connection and preserves terminal close", async () => {
    const controlled = createControlledIndexedDb({ blockedOpen: true });
    const repository = createIndexedDbSaveRepository(createDefinitionResolutionFixture(), {
      databaseId: "unit-test-blocked-open",
      indexedDB: controlled.factory
    });

    let initializationFailure: unknown;
    try {
      await repository.initialize();
    } catch (error) {
      initializationFailure = error;
    }

    expect(initializationFailure).toBeInstanceOf(SaveRepositoryError);
    expect(initializationFailure).toMatchObject({
      code: "DatabaseOpenFailed",
      operation: "initialize",
      name: "SaveRepositoryError"
    });
    expect((initializationFailure as Error).message).toBe("IndexedDB open or upgrade is blocked.");
    expect(controlled.closeCount()).toBe(0);

    let unpublishedConnectionFailure: unknown;
    try {
      await repository.listSlots();
    } catch (error) {
      unpublishedConnectionFailure = error;
    }

    expect(unpublishedConnectionFailure).toBeInstanceOf(SaveRepositoryError);
    expect(unpublishedConnectionFailure).toMatchObject({
      code: "RepositoryUnavailable",
      operation: "listSlots",
      name: "SaveRepositoryError"
    });

    await repository.close();
    await repository.close();
    await expect(repository.initialize()).rejects.toMatchObject({
      code: "ClosedRepository",
      operation: "initialize",
      name: "SaveRepositoryError"
    });
    await expect(repository.listSlots()).rejects.toMatchObject({
      code: "ClosedRepository",
      operation: "listSlots",
      name: "SaveRepositoryError"
    });
  });

  it("does not publish a connection when close wins during initialization", async () => {
    const controlled = createControlledIndexedDb();
    const repository = createIndexedDbSaveRepository(createDefinitionResolutionFixture(), {
      databaseId: "unit-test-close-during-initialize",
      indexedDB: controlled.factory
    });
    const initialization = expectCode(repository.initialize(), "ClosedRepository");

    await controlled.validationStarted;
    await repository.close();
    controlled.completeValidation();

    await initialization;
    expect(controlled.closeCount()).toBeGreaterThanOrEqual(1);
    await expectCode(repository.listSlots(), "ClosedRepository");
    await expectCode(repository.initialize(), "ClosedRepository");
  });

  it.each([
    ["saveSlots keyPath", { saveSlots: { keyPath: "slotId" } }],
    ["saveSlots autoIncrement", { saveSlots: { autoIncrement: true } }],
    ["repositoryMetadata keyPath", { repositoryMetadata: { keyPath: "key" } }],
    ["repositoryMetadata autoIncrement", { repositoryMetadata: { autoIncrement: true } }]
  ] satisfies ReadonlyArray<readonly [string, ControlledIndexedDbOptions]>)(
    "rejects an incompatible V1 %s during initialization",
    async (_label, options) => {
      const controlled = createControlledIndexedDb(options);
      const repository = createIndexedDbSaveRepository(createDefinitionResolutionFixture(), {
        databaseId: "unit-test-incompatible-layout",
        indexedDB: controlled.factory
      });
      const initialization = expectCode(repository.initialize(), "DatabaseOpenFailed");

      await controlled.validationStarted;
      await initialization;

      expect(controlled.closeCount()).toBeGreaterThanOrEqual(1);
    }
  );

  it("applies the same strict getter-safe import policy parsing in both adapters", async () => {
    const bundle = await sourceBundle();
    const controlled = createControlledIndexedDb();
    const indexed = createIndexedDbSaveRepository(createDefinitionResolutionFixture(), {
      databaseId: "unit-test-import-policy-parity",
      indexedDB: controlled.factory
    });
    const indexedInitialization = indexed.initialize();
    await controlled.validationStarted;
    controlled.completeValidation();
    await indexedInitialization;
    const memory = createMemorySaveRepository(createDefinitionResolutionFixture());
    await memory.initialize();
    let getterCalls = 0;
    const accessorPolicy = Object.defineProperty({}, "kind", {
      enumerable: true,
      get(): string {
        getterCalls += 1;
        throw new Error("Import policy getter must not run.");
      }
    });
    const accessorRevisionPolicy = Object.defineProperties({}, {
      kind: { value: "ReplaceExpectedRevision", enumerable: true },
      expectedRevision: {
        enumerable: true,
        get(): number {
          getterCalls += 1;
          throw new Error("Import policy revision getter must not run.");
        }
      }
    });
    const inheritedPolicy = Object.create({ kind: "RejectIfExists" }) as object;
    const policies: readonly unknown[] = [
      { kind: "Unknown" },
      { kind: "RejectIfExists", extra: true },
      accessorPolicy,
      accessorRevisionPolicy,
      inheritedPolicy
    ];

    for (const policy of policies) {
      await expectCode(memory.importSlot(bundle, policy as SaveImportPolicy), "InvalidEnvelope");
      await expectCode(indexed.importSlot(bundle, policy as SaveImportPolicy), "InvalidEnvelope");
    }

    expect(getterCalls).toBe(0);
    expect(await memory.listSlots()).toEqual({ slots: [] });
  });

  it("rejects unsafe write request fields in both adapters before stateful work", async () => {
    const fields = ["slotId", "expectedRevision", "lastWriteReason", "envelope"] as const;
    const invalidShapes = ["own-accessor", "inherited-data", "inherited-accessor", "missing"] as const;
    const validRequest: SaveWriteRequest = {
      slotId: "write-request-slot",
      expectedRevision: 1,
      envelope: createSaveGameEnvelopeV1Fixture(),
      lastWriteReason: "AutoSave"
    };
    const memory = createMemorySaveRepository(createDefinitionResolutionFixture());
    await memory.initialize();
    await memory.writeSlot({ ...validRequest, expectedRevision: null, lastWriteReason: "ManualSave" });
    const memoryBefore = await memory.readSlot("write-request-slot");
    const { controlled, repository: indexed } = await createInitializedControlledRepository(
      "unit-test-write-request-field-parity"
    );
    let getterCalls = 0;

    const getter = (): never => {
      getterCalls += 1;
      throw new Error("Write request getter must not run.");
    };
    const invalidRequest = (
      invalidField: typeof fields[number],
      invalidShape: typeof invalidShapes[number]
    ): SaveWriteRequest => {
      const prototype = Object.create(null) as Record<string, unknown>;
      if (invalidShape === "inherited-data") {
        Object.defineProperty(prototype, invalidField, {
          enumerable: true,
          value: validRequest[invalidField]
        });
      } else if (invalidShape === "inherited-accessor") {
        Object.defineProperty(prototype, invalidField, { enumerable: true, get: getter });
      }
      const candidate = Object.create(prototype) as Record<string, unknown>;
      for (const field of fields) {
        if (field !== invalidField) {
          Object.defineProperty(candidate, field, {
            enumerable: true,
            value: validRequest[field]
          });
        }
      }
      if (invalidShape === "own-accessor") {
        Object.defineProperty(candidate, invalidField, { enumerable: true, get: getter });
      }
      return candidate as unknown as SaveWriteRequest;
    };

    for (const field of fields) {
      for (const shape of invalidShapes) {
        const request = invalidRequest(field, shape);
        await expectCode(memory.writeSlot(request), "InvalidEnvelope");
        await expectCode(indexed.writeSlot(request), "InvalidEnvelope");
      }
    }

    const memoryAfter = await memory.readSlot("write-request-slot");
    expect(getterCalls).toBe(0);
    expect(memoryAfter.metadata).toEqual(memoryBefore.metadata);
    expect(memoryAfter.envelope).toEqual(memoryBefore.envelope);
    expect(memoryAfter.payloadBytes).toEqual(memoryBefore.payloadBytes);
    expect(controlled.readwriteTransactionCount()).toBe(0);
  });

  it("normalizes throwing write request descriptor traps in both adapters before stateful work", async () => {
    const validRequest: SaveWriteRequest = {
      slotId: "proxy-write-request-slot",
      expectedRevision: 1,
      envelope: createSaveGameEnvelopeV1Fixture(),
      lastWriteReason: "AutoSave"
    };
    const request = new Proxy(validRequest, {
      getOwnPropertyDescriptor(): never {
        throw new Error("Write request descriptor trap failed.");
      }
    });
    const memory = createMemorySaveRepository(createDefinitionResolutionFixture());
    await memory.initialize();
    await memory.writeSlot({ ...validRequest, expectedRevision: null, lastWriteReason: "ManualSave" });
    const memoryBefore = await memory.readSlot(validRequest.slotId);
    const { controlled, repository: indexed } = await createInitializedControlledRepository(
      "unit-test-write-request-proxy-parity"
    );
    const captureFailure = async (operation: Promise<unknown>): Promise<unknown> => {
      try {
        await operation;
      } catch (error) {
        return error;
      }
      throw new Error("Expected write request to fail.");
    };

    const [memoryFailure, indexedFailure] = await Promise.all([
      captureFailure(memory.writeSlot(request)),
      captureFailure(indexed.writeSlot(request))
    ]);

    expect(memoryFailure).toBeInstanceOf(SaveRepositoryError);
    expect(memoryFailure).toMatchObject({ code: "InvalidEnvelope" });
    expect(indexedFailure).toBeInstanceOf(SaveRepositoryError);
    expect(indexedFailure).toMatchObject({ code: "InvalidEnvelope" });
    expect(await memory.readSlot(validRequest.slotId)).toEqual(memoryBefore);
    expect(controlled.readwriteTransactionCount()).toBe(0);
  });

  it("normalizes a revoked write-request Proxy in both adapters before stateful work", async () => {
    const validRequest: SaveWriteRequest = {
      slotId: "revoked-write-request-slot",
      expectedRevision: 1,
      envelope: createSaveGameEnvelopeV1Fixture(),
      lastWriteReason: "AutoSave"
    };
    const revocable = Proxy.revocable(validRequest, {});
    revocable.revoke();
    const memory = createMemorySaveRepository(createDefinitionResolutionFixture());
    await memory.initialize();
    await memory.writeSlot({ ...validRequest, expectedRevision: null, lastWriteReason: "ManualSave" });
    const memoryBefore = await memory.readSlot(validRequest.slotId);
    const { controlled, repository: indexed } = await createInitializedControlledRepository(
      "unit-test-revoked-write-request-parity"
    );
    const captureFailure = async (operation: Promise<unknown>): Promise<unknown> => {
      try {
        await operation;
      } catch (error) {
        return error;
      }
      throw new Error("Expected revoked write request to fail.");
    };

    const [memoryFailure, indexedFailure] = await Promise.all([
      captureFailure(memory.writeSlot(revocable.proxy)),
      captureFailure(indexed.writeSlot(revocable.proxy))
    ]);

    for (const failure of [memoryFailure, indexedFailure]) {
      expect(failure).toBeInstanceOf(SaveRepositoryError);
      expect(failure).toMatchObject({ code: "InvalidEnvelope", operation: "writeSlot" });
    }
    expect(await memory.readSlot(validRequest.slotId)).toEqual(memoryBefore);
    expect(controlled.readwriteTransactionCount()).toBe(0);
  });

  it("normalizes hostile import-policy reflection traps before bundle decode or stateful work", async () => {
    const validBundle = await sourceBundle();
    let bundleReflectionCalls = 0;
    const observedBundle = new Proxy(validBundle, {
      getOwnPropertyDescriptor(target, property): PropertyDescriptor | undefined {
        bundleReflectionCalls += 1;
        return Reflect.getOwnPropertyDescriptor(target, property);
      },
      getPrototypeOf(target): object | null {
        bundleReflectionCalls += 1;
        return Reflect.getPrototypeOf(target);
      },
      ownKeys(target): ArrayLike<string | symbol> {
        bundleReflectionCalls += 1;
        return Reflect.ownKeys(target);
      }
    });
    let policyGetterCalls = 0;
    const basePolicy = { kind: "RejectIfExists" } as const;
    const getTrap = (): never => {
      policyGetterCalls += 1;
      throw new Error("Import policy getter trap must not run.");
    };
    const prototypeTrapPolicy = new Proxy(basePolicy, {
      get: getTrap,
      getPrototypeOf(): never {
        throw new Error("Import policy prototype trap failed.");
      }
    });
    const descriptorTrapPolicy = new Proxy(basePolicy, {
      get: getTrap,
      getOwnPropertyDescriptor(): never {
        throw new Error("Import policy descriptor trap failed.");
      }
    });
    const ownKeysTrapPolicy = new Proxy(basePolicy, {
      get: getTrap,
      ownKeys(): never {
        throw new Error("Import policy ownKeys trap failed.");
      }
    });
    const revokedPolicy = Proxy.revocable(basePolicy, {});
    revokedPolicy.revoke();
    const policies: readonly unknown[] = [
      prototypeTrapPolicy,
      descriptorTrapPolicy,
      ownKeysTrapPolicy,
      revokedPolicy.proxy
    ];
    const memory = createMemorySaveRepository(createDefinitionResolutionFixture());
    await memory.initialize();
    await memory.writeSlot({
      slotId: "protected-import-slot",
      expectedRevision: null,
      envelope: createSaveGameEnvelopeV1Fixture(),
      lastWriteReason: "ManualSave"
    });
    const memoryBefore = await memory.readSlot("protected-import-slot");
    const memoryListBefore = await memory.listSlots();
    const { controlled, repository: indexed } = await createInitializedControlledRepository(
      "unit-test-hostile-import-policy-parity"
    );
    const captureFailure = async (operation: Promise<unknown>): Promise<unknown> => {
      try {
        await operation;
      } catch (error) {
        return error;
      }
      throw new Error("Expected hostile import policy to fail.");
    };

    for (const policy of policies) {
      const [memoryFailure, indexedFailure] = await Promise.all([
        captureFailure(memory.importSlot(observedBundle, policy as SaveImportPolicy)),
        captureFailure(indexed.importSlot(observedBundle, policy as SaveImportPolicy))
      ]);
      for (const failure of [memoryFailure, indexedFailure]) {
        expect(failure).toBeInstanceOf(SaveRepositoryError);
        expect(failure).toMatchObject({ code: "InvalidEnvelope", operation: "importSlot" });
      }
    }

    expect(policyGetterCalls).toBe(0);
    expect(bundleReflectionCalls).toBe(0);
    expect(await memory.readSlot("protected-import-slot")).toEqual(memoryBefore);
    expect(await memory.listSlots()).toEqual(memoryListBefore);
    expect(controlled.readwriteTransactionCount()).toBe(0);
  });

  it("normalizes hostile imported bundles in both adapters before stateful work", async () => {
    const validBundle = await sourceBundle();
    let getterCalls = 0;
    const hostileProxy = (
      target: object,
      trap: "getPrototypeOf" | "getOwnPropertyDescriptor" | "ownKeys"
    ): object => {
      const handler: ProxyHandler<object> = {
        get(): never {
          getterCalls += 1;
          throw new Error("Imported bundle getters must not run.");
        }
      };
      const throwReflectionTrap = (): never => {
        throw new Error("Imported bundle reflection trap failed.");
      };
      if (trap === "getPrototypeOf") {
        handler.getPrototypeOf = throwReflectionTrap;
      } else if (trap === "getOwnPropertyDescriptor") {
        handler.getOwnPropertyDescriptor = throwReflectionTrap;
      } else {
        handler.ownKeys = throwReflectionTrap;
      }
      return new Proxy(target, handler);
    };
    const reflectionTraps = [
      "getPrototypeOf",
      "getOwnPropertyDescriptor",
      "ownKeys"
    ] as const;
    const revokedBundle = Proxy.revocable(validBundle, {});
    revokedBundle.revoke();
    const hostileBundles: readonly unknown[] = [
      ...reflectionTraps.map((trap) => hostileProxy(validBundle, trap)),
      ...reflectionTraps.map((trap) => ({
        ...validBundle,
        metadata: hostileProxy(validBundle.metadata, trap)
      })),
      revokedBundle.proxy
    ];
    const memory = createMemorySaveRepository(createDefinitionResolutionFixture());
    await memory.initialize();
    await memory.writeSlot({
      slotId: "protected-import-bundle-slot",
      expectedRevision: null,
      envelope: createSaveGameEnvelopeV1Fixture(),
      lastWriteReason: "ManualSave"
    });
    const memoryBefore = await memory.readSlot("protected-import-bundle-slot");
    const memoryListBefore = await memory.listSlots();
    const { controlled, repository: indexed } = await createInitializedControlledRepository(
      "unit-test-hostile-imported-bundle-parity"
    );
    const captureFailure = async (operation: Promise<unknown>): Promise<unknown> => {
      try {
        await operation;
      } catch (error) {
        return error;
      }
      throw new Error("Expected hostile imported bundle to fail.");
    };

    for (const hostileBundle of hostileBundles) {
      const [memoryFailure, indexedFailure] = await Promise.all([
        captureFailure(memory.importSlot(hostileBundle, { kind: "RejectIfExists" })),
        captureFailure(indexed.importSlot(hostileBundle, { kind: "RejectIfExists" }))
      ]);
      for (const failure of [memoryFailure, indexedFailure]) {
        expect(failure).toBeInstanceOf(SaveRepositoryError);
        expect(failure).toMatchObject({
          code: "InvalidEnvelope",
          operation: "decodeExportBundle"
        });
      }
    }

    expect(getterCalls).toBe(0);
    expect(await memory.readSlot("protected-import-bundle-slot")).toEqual(memoryBefore);
    expect(await memory.listSlots()).toEqual(memoryListBefore);
    expect(controlled.readwriteTransactionCount()).toBe(0);
  });

  it("commits create in one readwrite transaction and resolves only after transaction completion", async () => {
    const { controlled, repository } = await createInitializedControlledRepository("unit-test-create-transaction");
    let resolved = false;
    const writing = repository.writeSlot({
      slotId: "create-slot",
      expectedRevision: null,
      envelope: createSaveGameEnvelopeV1Fixture(),
      lastWriteReason: "ManualSave"
    }).then((result) => {
      resolved = true;
      return result;
    });
    const transaction = await controlled.nextReadwriteTransaction();

    expect(controlled.readwriteTransactionCount()).toBe(1);
    expect(transaction.operations).toEqual(["get:create-slot"]);
    transaction.readCurrent();
     await new Promise<void>((resolve) => setTimeout(resolve, 0));

    expect(transaction.operations).toEqual(["get:create-slot", "put:create-slot"]);
    expect(controlled.record("create-slot")).toBeUndefined();
    expect(resolved).toBe(false);

    transaction.complete();
    const result = await writing;

    expect(resolved).toBe(true);
    expect(result.metadata).toMatchObject({ slotId: "create-slot", recordRevision: 1 });
    expect(controlled.record("create-slot")).toMatchObject({
      metadata: { slotId: "create-slot", recordRevision: 1 }
    });
  });

  it("reads valid physical keys and lists valid records deterministically in one readonly transaction", async () => {
    const { controlled, repository } = await createInitializedControlledRepository("unit-test-read-list-valid-keys");
    await commitControlledMutation(repository.writeSlot({
      slotId: "z-slot",
      expectedRevision: null,
      envelope: createSaveGameEnvelopeV1Fixture(),
      lastWriteReason: "ManualSave"
    }), controlled);
    await commitControlledMutation(repository.writeSlot({
      slotId: "a-slot",
      expectedRevision: null,
      envelope: createSaveGameEnvelopeV1Fixture(),
      lastWriteReason: "ManualSave"
    }), controlled);

    await expect(repository.readSlot("z-slot")).resolves.toMatchObject({
      metadata: { slotId: "z-slot", recordRevision: 1 }
    });
    expect(controlled.lastReadonlyOperations()).toEqual(["get:z-slot"]);

    await expect(repository.listSlots()).resolves.toMatchObject({
      slots: [
        { slotId: "a-slot", recordRevision: 1 },
        { slotId: "z-slot", recordRevision: 1 }
      ]
    });
    expect(controlled.lastReadonlyOperations()).toEqual(["getAll", "getAllKeys"]);
    expect(controlled.readonlyTransactionCount()).toBe(2);
  });

  it("rejects read and list physical-key mismatches without returning a partial list", async () => {
    const { controlled, repository } = await createInitializedControlledRepository("unit-test-read-list-mismatched-keys");
    await commitControlledMutation(repository.writeSlot({
      slotId: "metadata-slot",
      expectedRevision: null,
      envelope: createSaveGameEnvelopeV1Fixture(),
      lastWriteReason: "ManualSave"
    }), controlled);
    controlled.moveRecord("metadata-slot", "physical-slot");

    await expectCode(repository.readSlot("physical-slot"), "CorruptRecord");
    expect(controlled.lastReadonlyOperations()).toEqual(["get:physical-slot"]);

    await commitControlledMutation(repository.writeSlot({
      slotId: "valid-slot",
      expectedRevision: null,
      envelope: createSaveGameEnvelopeV1Fixture(),
      lastWriteReason: "ManualSave"
    }), controlled);
    let partialList: unknown;
    const listing = repository.listSlots().then((result) => {
      partialList = result;
      return result;
    });

    await expectCode(listing, "CorruptRecord");
    expect(partialList).toBeUndefined();
    expect(controlled.lastReadonlyOperations()).toEqual(["getAll", "getAllKeys"]);
    expect(controlled.readonlyTransactionCount()).toBe(2);
  });

  it("updates at the matching revision and rejects stale CAS without staging a mutation", async () => {
    const { controlled, repository } = await createInitializedControlledRepository("unit-test-update-transaction");
    await commitControlledMutation(repository.writeSlot({
      slotId: "update-slot",
      expectedRevision: null,
      envelope: createSaveGameEnvelopeV1Fixture(),
      lastWriteReason: "ManualSave"
    }), controlled);
    const beforeUpdate = controlled.record("update-slot");
    const updating = repository.writeSlot({
      slotId: "update-slot",
      expectedRevision: 1,
      envelope: createSaveGameEnvelopeV1Fixture(),
      lastWriteReason: "AutoSave"
    });
    const updateTransaction = await controlled.nextReadwriteTransaction();

    updateTransaction.readCurrent();
    expect(updateTransaction.operations).toEqual(["get:update-slot", "put:update-slot"]);
    expect(controlled.record("update-slot")).toBe(beforeUpdate);
    updateTransaction.complete();
    const updated = await updating;

    expect(updated.metadata.recordRevision).toBe(2);
    const committedUpdate = controlled.record("update-slot");
    expect(committedUpdate).not.toBe(beforeUpdate);
    expect(committedUpdate).toMatchObject({ metadata: { recordRevision: 2 } });

    const stale = expectCode(repository.writeSlot({
      slotId: "update-slot",
      expectedRevision: 1,
      envelope: createSaveGameEnvelopeV1Fixture(),
      lastWriteReason: "StaleSave"
    }), "RevisionConflict");
    const staleTransaction = await controlled.nextReadwriteTransaction();
    staleTransaction.readCurrent();
    await stale;

    expect(staleTransaction.operations).toEqual(["get:update-slot"]);
    expect(controlled.record("update-slot")).toBe(committedUpdate);
    expect(controlled.readwriteTransactionCount()).toBe(3);
  });

  it("deletes only at the matching revision and preserves state for conflict or missing cases", async () => {
    const { controlled, repository } = await createInitializedControlledRepository("unit-test-delete-transaction");
    await commitControlledMutation(repository.writeSlot({
      slotId: "delete-slot",
      expectedRevision: null,
      envelope: createSaveGameEnvelopeV1Fixture(),
      lastWriteReason: "ManualSave"
    }), controlled);
    const committed = controlled.record("delete-slot");

    const conflict = expectCode(repository.deleteSlot("delete-slot", 2), "RevisionConflict");
    const conflictTransaction = await controlled.nextReadwriteTransaction();
    conflictTransaction.readCurrent();
    await conflict;
    expect(conflictTransaction.operations).toEqual(["get:delete-slot"]);
    expect(controlled.record("delete-slot")).toBe(committed);

    let resolved = false;
    const deleting = repository.deleteSlot("delete-slot", 1).then((result) => {
      resolved = true;
      return result;
    });
    const deleteTransaction = await controlled.nextReadwriteTransaction();
    deleteTransaction.readCurrent();
     await new Promise<void>((resolve) => setTimeout(resolve, 0));

    expect(deleteTransaction.operations).toEqual(["get:delete-slot", "delete:delete-slot"]);
    expect(controlled.record("delete-slot")).toBe(committed);
    expect(resolved).toBe(false);

    deleteTransaction.complete();
    await expect(deleting).resolves.toEqual({ slotId: "delete-slot", deletedRevision: 1 });
    expect(controlled.record("delete-slot")).toBeUndefined();

    const missing = expectCode(repository.deleteSlot("delete-slot", 1), "SlotNotFound");
    const missingTransaction = await controlled.nextReadwriteTransaction();
    missingTransaction.readCurrent();
    await missing;
    expect(missingTransaction.operations).toEqual(["get:delete-slot"]);
    expect(controlled.record("delete-slot")).toBeUndefined();
  });

  it("maps a quota-aborted staged write and preserves the prior committed record", async () => {
    const { controlled, repository } = await createInitializedControlledRepository("unit-test-quota-abort");
    await commitControlledMutation(repository.writeSlot({
      slotId: "quota-slot",
      expectedRevision: null,
      envelope: createSaveGameEnvelopeV1Fixture(),
      lastWriteReason: "ManualSave"
    }), controlled);
    const committed = controlled.record("quota-slot");
    const failedWrite = expectCode(repository.writeSlot({
      slotId: "quota-slot",
      expectedRevision: 1,
      envelope: createSaveGameEnvelopeV1Fixture(),
      lastWriteReason: "AutoSave"
    }), "QuotaExceeded");
    const transaction = await controlled.nextReadwriteTransaction();

    transaction.readCurrent();
    expect(transaction.operations).toEqual(["get:quota-slot", "put:quota-slot"]);
    expect(controlled.record("quota-slot")).toBe(committed);
    transaction.abortWithRequestError(new DOMException("browser quota detail", "QuotaExceededError"));
    await failedWrite;

    expect(controlled.record("quota-slot")).toBe(committed);
    expect(controlled.record("quota-slot")).toMatchObject({ metadata: { recordRevision: 1 } });
    expect(controlled.readwriteTransactionCount()).toBe(2);
  });
});

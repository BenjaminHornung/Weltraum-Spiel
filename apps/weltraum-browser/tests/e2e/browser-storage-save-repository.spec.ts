import { expect, test, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const evidenceDir = path.resolve(process.cwd(), "evidence");
const summaryPath = path.join(evidenceDir, "browser-indexeddb-save-repository-core-v1-summary.json");
const markdownPath = path.join(evidenceDir, "browser-indexeddb-save-repository-core-v1.md");
const browserStorageModulePath = "/src/browser-storage/index.ts";
const persistenceModulePath = "/src/persistence/index.ts";
const databaseId = "e2e-browser-storage-core-v1-isolated";
const lifecycleDatabaseId = "e2e-browser-storage-lifecycle-v1-isolated";
const blockedDeletionDatabaseId = "e2e-browser-storage-blocked-delete-v1-isolated";
const futureDatabaseVersionId = "e2e-browser-storage-future-database-version-isolated";
const futureMarkerDatabaseId = "e2e-browser-storage-future-marker-version-isolated";
const slotA = "e2e-slot-a";
const slotB = "e2e-slot-b";

interface BrowserHealth {
  readonly consoleErrors: string[];
  readonly pageErrors: string[];
  readonly requestFailures: string[];
  readonly httpErrors: string[];
}

interface NormalRouteGuard {
  readonly route: string;
  readonly testBridgeOwnProperty: boolean;
  readonly testBridgeInWindow: boolean;
}

type DatabaseDeletionOutcome = "deleted" | "error" | "blocked";

interface InitialWriteResult {
  readonly modulePath: string;
  readonly moduleLoaded: boolean;
  readonly writtenRevision: number;
  readonly readRevision: number;
  readonly writtenSignature: string;
  readonly readSignature: string;
  readonly slotId: string;
}

interface ReloadScenarioResult {
  readonly reloadedRevision: number;
  readonly reloadedSignature: string;
  readonly staleCasCode: string;
  readonly staleCasPreservedRevision: number;
  readonly staleCasPreservedSignature: string;
  readonly matchingCasRevision: number;
  readonly matchingCasSignature: string;
  readonly importedSlotId: string;
  readonly importedRevision: number;
  readonly importedSignature: string;
  readonly importedPayloadMatches: boolean;
  readonly importedContentSurvivedSourceCorruption: boolean;
  readonly corruptionCode: string;
  readonly databaseVersion: number;
  readonly objectStores: readonly string[];
  readonly deletedSlots: readonly string[];
  readonly remainingSlotCount: number;
}

interface BrowserStorageEvidence {
  readonly schemaVersion: 1;
  readonly feature: "browser-indexeddb-save-repository-core-v1";
  readonly route: NormalRouteGuard;
  readonly moduleLoad: {
    readonly path: string;
    readonly loaded: boolean;
  };
  readonly isolation: {
    readonly databaseId: string;
    readonly preRunDeletion: DatabaseDeletionOutcome;
  };
  readonly repositorySchema: {
    readonly version: number;
    readonly objectStores: readonly string[];
  };
  readonly slotA: {
    readonly slotId: string;
    readonly initialRevision: number;
    readonly signature: string;
    readonly reloadPreservedRevision: boolean;
    readonly reloadPreservedSignature: boolean;
  };
  readonly compareAndSwap: {
    readonly staleErrorCode: string;
    readonly staleWritePreservedRecord: boolean;
    readonly matchingRevisionBefore: number;
    readonly matchingRevisionAfter: number;
    readonly revisionAdvancedByOne: boolean;
  };
  readonly exportImport: {
    readonly policy: "CreateNewSlot";
    readonly targetSlotId: string;
    readonly targetRevision: number;
    readonly payloadMatchesExport: boolean;
    readonly targetSurvivedSourceCorruption: boolean;
  };
  readonly corruption: {
    readonly sourceSlotId: string;
    readonly mutation: "payload-byte-flipped-without-hash-update";
    readonly errorCode: string;
  };
  readonly cleanup: {
    readonly deletedSlots: readonly string[];
    readonly remainingSlotCount: number;
    readonly databaseDeletion: DatabaseDeletionOutcome;
  };
  readonly health: BrowserHealth;
  readonly status: "PASS";
}

const installBrowserHealthCollector = (page: Page): BrowserHealth => {
  const health: BrowserHealth = {
    consoleErrors: [],
    pageErrors: [],
    requestFailures: [],
    httpErrors: []
  };

  page.on("console", (message) => {
    if (message.type() === "error") {
      health.consoleErrors.push(message.text());
    }
  });
  page.on("pageerror", (error) => health.pageErrors.push(error.message));
  page.on("requestfailed", (request) => {
    health.requestFailures.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? "unknown"}`);
  });
  page.on("response", (response) => {
    if (response.status() >= 400) {
      health.httpErrors.push(`${response.status()} ${response.request().method()} ${response.url()}`);
    }
  });

  return health;
};

const readNormalRouteGuard = (page: Page): Promise<NormalRouteGuard> => page.evaluate(() => ({
  route: location.pathname,
  testBridgeOwnProperty: Object.prototype.hasOwnProperty.call(window, "TestBridge"),
  testBridgeInWindow: "TestBridge" in window
}));

const deleteDatabase = (page: Page, isolatedDatabaseId: string): Promise<DatabaseDeletionOutcome> =>
  page.evaluate((databaseName) => new Promise<DatabaseDeletionOutcome>((resolve) => {
    let settled = false;
    const finish = (outcome: DatabaseDeletionOutcome): void => {
      if (!settled) {
        settled = true;
        resolve(outcome);
      }
    };
    const request = indexedDB.deleteDatabase(databaseName);
    request.onsuccess = () => finish("deleted");
    request.onerror = () => finish("error");
    request.onblocked = () => finish("blocked");
  }), isolatedDatabaseId);

const expectHealthyBrowser = (health: BrowserHealth): void => {
  expect(health.consoleErrors, "console errors").toEqual([]);
  expect(health.pageErrors, "page errors").toEqual([]);
  expect(health.requestFailures, "failed requests").toEqual([]);
  expect(health.httpErrors, "HTTP responses with status >= 400").toEqual([]);
};

const openNormalRoute = async (page: Page): Promise<NormalRouteGuard> => {
  await page.goto("/");
  await page.waitForSelector("#debug-scene", { state: "visible" });
  await page.waitForLoadState("networkidle");
  const routeGuard = await readNormalRouteGuard(page);
  expect(routeGuard).toEqual({
    route: "/",
    testBridgeOwnProperty: false,
    testBridgeInWindow: false
  });
  return routeGuard;
};

const createMarkdown = (evidence: BrowserStorageEvidence): string => `# Browser IndexedDB Save Repository Core V1 Evidence

Status: **${evidence.status}**

## Normal route and public module

- Route: \`${evidence.route.route}\`
- TestBridge own property: \`${evidence.route.testBridgeOwnProperty}\`
- TestBridge present through the window prototype chain: \`${evidence.route.testBridgeInWindow}\`
- Dynamically imported module: \`${evidence.moduleLoad.path}\`
- Module loaded: \`${evidence.moduleLoad.loaded}\`

## Isolated repository schema

- Fixed test database: \`${evidence.isolation.databaseId}\`
- Pre-run database deletion: \`${evidence.isolation.preRunDeletion}\`
- Repository version: \`${evidence.repositorySchema.version}\`
- Object stores: ${evidence.repositorySchema.objectStores.map((store) => `\`${store}\``).join(", ")}

## Reload and compare-and-swap

- Slot: \`${evidence.slotA.slotId}\`
- Initial revision: \`${evidence.slotA.initialRevision}\`
- Deterministic signature: \`${evidence.slotA.signature}\`
- Revision survived reload: \`${evidence.slotA.reloadPreservedRevision}\`
- Signature survived reload: \`${evidence.slotA.reloadPreservedSignature}\`
- Stale CAS error: \`${evidence.compareAndSwap.staleErrorCode}\`
- Stale CAS preserved the record: \`${evidence.compareAndSwap.staleWritePreservedRecord}\`
- Matching CAS revision: \`${evidence.compareAndSwap.matchingRevisionBefore} -> ${evidence.compareAndSwap.matchingRevisionAfter}\`
- Revision advanced by one: \`${evidence.compareAndSwap.revisionAdvancedByOne}\`

## Export, import, and corruption

- Import policy: \`${evidence.exportImport.policy}\`
- Imported slot/revision: \`${evidence.exportImport.targetSlotId}\` / \`${evidence.exportImport.targetRevision}\`
- Imported payload matched export: \`${evidence.exportImport.payloadMatchesExport}\`
- Imported slot survived source corruption: \`${evidence.exportImport.targetSurvivedSourceCorruption}\`
- Controlled mutation: \`${evidence.corruption.mutation}\`
- Production read error: \`${evidence.corruption.errorCode}\`

## Cleanup and browser health

- Deleted slots: ${evidence.cleanup.deletedSlots.map((slotId) => `\`${slotId}\``).join(", ")}
- Remaining slot count: \`${evidence.cleanup.remainingSlotCount}\`
- Full database deletion: \`${evidence.cleanup.databaseDeletion}\`
- Console errors: \`${JSON.stringify(evidence.health.consoleErrors)}\`
- Page errors: \`${JSON.stringify(evidence.health.pageErrors)}\`
- Request failures: \`${JSON.stringify(evidence.health.requestFailures)}\`
- HTTP failures: \`${JSON.stringify(evidence.health.httpErrors)}\`
`;

test("normal route preserves an IndexedDB save across reload and detects controlled corruption", async ({ page }) => {
  const health = installBrowserHealthCollector(page);

  await page.goto("/");
  await page.waitForSelector("#debug-scene", { state: "visible" });
  await page.waitForLoadState("networkidle");

  const routeGuard = await readNormalRouteGuard(page);
  expect(routeGuard).toEqual({
    route: "/",
    testBridgeOwnProperty: false,
    testBridgeInWindow: false
  });

  const preRunDeletion = await deleteDatabase(page, databaseId);
  expect(preRunDeletion).toBe("deleted");

  let initialWrite: InitialWriteResult | undefined;
  let reloadScenario: ReloadScenarioResult | undefined;
  let scenarioFailure: unknown;
  let finalDatabaseDeletion: DatabaseDeletionOutcome = "error";

  try {
    initialWrite = await page.evaluate(async ({ databaseName, storagePath, persistencePath, primarySlot }) => {
      const browserStorage = await import(storagePath);
      const persistence = await import(persistencePath);
      const repository = browserStorage.createIndexedDbSaveRepository(
        persistence.createDefinitionResolutionFixture(),
        { databaseId: databaseName }
      );

      try {
        await repository.initialize();
        const written = await repository.writeSlot({
          slotId: primarySlot,
          expectedRevision: null,
          envelope: persistence.createSaveGameEnvelopeV1Fixture(),
          lastWriteReason: "E2EInitialWrite"
        });
        const read = await repository.readSlot(primarySlot);
        return {
          modulePath: storagePath,
          moduleLoaded:
            typeof browserStorage.createIndexedDbSaveRepository === "function"
            && typeof browserStorage.SaveRepositoryError === "function",
          writtenRevision: written.metadata.recordRevision,
          readRevision: read.metadata.recordRevision,
          writtenSignature: written.metadata.contentHash,
          readSignature: read.metadata.contentHash,
          slotId: read.metadata.slotId
        };
      } finally {
        await repository.close();
      }
    }, {
      databaseName: databaseId,
      storagePath: browserStorageModulePath,
      persistencePath: persistenceModulePath,
      primarySlot: slotA
    });

    expect(initialWrite).toMatchObject({
      modulePath: browserStorageModulePath,
      moduleLoaded: true,
      writtenRevision: 1,
      readRevision: 1,
      slotId: slotA
    });
    expect(initialWrite.writtenSignature).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(initialWrite.readSignature).toBe(initialWrite.writtenSignature);

    await page.reload();
    await page.waitForSelector("#debug-scene", { state: "visible" });
    await page.waitForLoadState("networkidle");
    expect(await readNormalRouteGuard(page)).toEqual(routeGuard);

    reloadScenario = await page.evaluate(async ({
      databaseName,
      storagePath,
      persistencePath,
      primarySlot,
      importedSlot
    }) => {
      const browserStorage = await import(storagePath);
      const persistence = await import(persistencePath);
      const repository = browserStorage.createIndexedDbSaveRepository(
        persistence.createDefinitionResolutionFixture(),
        { databaseId: databaseName }
      );

      const corruptRawPayload = async (): Promise<{ readonly version: number; readonly stores: readonly string[] }> => {
        const database = await new Promise<IDBDatabase>((resolve, reject) => {
          const request = indexedDB.open(databaseName, browserStorage.INDEXED_DB_SAVE_REPOSITORY_VERSION);
          request.onupgradeneeded = () => {
            request.transaction?.abort();
            reject(new Error("The isolated database unexpectedly required creation during corruption setup."));
          };
          request.onerror = () => reject(new Error("Opening the isolated database for corruption failed."));
          request.onblocked = () => reject(new Error("Opening the isolated database for corruption was blocked."));
          request.onsuccess = () => resolve(request.result);
        });

        try {
          const schema = {
            version: database.version,
            stores: Array.from(database.objectStoreNames).sort()
          };
          await new Promise<void>((resolve, reject) => {
            const transaction = database.transaction(browserStorage.INDEXED_DB_SAVE_SLOTS_STORE, "readwrite");
            const store = transaction.objectStore(browserStorage.INDEXED_DB_SAVE_SLOTS_STORE);
            const request = store.get(primarySlot);
            let operationFailure: Error | undefined;
            request.onsuccess = () => {
              const record = request.result as { readonly metadata?: unknown; readonly payloadBytes?: unknown } | undefined;
              if (record === undefined || !(record.payloadBytes instanceof Uint8Array) || record.payloadBytes.byteLength === 0) {
                operationFailure = new Error("The controlled source record is unavailable for corruption.");
                transaction.abort();
                return;
              }
              const corruptedPayload = new Uint8Array(record.payloadBytes);
              corruptedPayload[0] = corruptedPayload[0]! ^ 0xff;
              store.put({ metadata: record.metadata, payloadBytes: corruptedPayload }, primarySlot);
            };
            request.onerror = () => {
              operationFailure = new Error("Reading the controlled source record for corruption failed.");
            };
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => undefined;
            transaction.onabort = () => reject(operationFailure ?? new Error("The controlled corruption transaction failed."));
          });
          return schema;
        } finally {
          database.close();
        }
      };

      try {
        await repository.initialize();
        const reloaded = await repository.readSlot(primarySlot);

        let staleCasCode = "NO_ERROR";
        try {
          await repository.writeSlot({
            slotId: primarySlot,
            expectedRevision: 0,
            envelope: persistence.createSaveGameEnvelopeV1Fixture(),
            lastWriteReason: "E2EStaleWrite"
          });
        } catch (error) {
          staleCasCode = browserStorage.isSaveRepositoryError(error)
            ? (error as { readonly code: string }).code
            : "UNEXPECTED_ERROR";
        }
        const afterStaleCas = await repository.readSlot(primarySlot);

        const matchingWrite = await repository.writeSlot({
          slotId: primarySlot,
          expectedRevision: reloaded.metadata.recordRevision,
          envelope: persistence.createSaveGameEnvelopeV1Fixture(),
          lastWriteReason: "E2EMatchingWrite"
        });
        const exported = await repository.exportSlot(primarySlot);
        const imported = await repository.importSlot(JSON.parse(JSON.stringify(exported)), {
          kind: "CreateNewSlot",
          targetSlotId: importedSlot
        });
        const importedRead = await repository.readSlot(importedSlot);
        const schema = await corruptRawPayload();

        let corruptionCode = "NO_ERROR";
        try {
          await repository.readSlot(primarySlot);
        } catch (error) {
          corruptionCode = browserStorage.isSaveRepositoryError(error)
            ? (error as { readonly code: string }).code
            : "UNEXPECTED_ERROR";
        }
        const importedAfterCorruption = await repository.readSlot(importedSlot);

        const deletedA = await repository.deleteSlot(primarySlot, matchingWrite.metadata.recordRevision);
        const deletedB = await repository.deleteSlot(importedSlot, imported.metadata.recordRevision);
        const remaining = await repository.listSlots();

        return {
          reloadedRevision: reloaded.metadata.recordRevision,
          reloadedSignature: reloaded.metadata.contentHash,
          staleCasCode,
          staleCasPreservedRevision: afterStaleCas.metadata.recordRevision,
          staleCasPreservedSignature: afterStaleCas.metadata.contentHash,
          matchingCasRevision: matchingWrite.metadata.recordRevision,
          matchingCasSignature: matchingWrite.metadata.contentHash,
          importedSlotId: importedRead.metadata.slotId,
          importedRevision: importedRead.metadata.recordRevision,
          importedSignature: importedRead.metadata.contentHash,
          importedPayloadMatches:
            importedRead.metadata.contentHash === exported.contentHash
            && importedRead.metadata.payloadBytes === exported.payloadBytes,
          importedContentSurvivedSourceCorruption:
            importedAfterCorruption.metadata.contentHash === importedRead.metadata.contentHash
            && importedAfterCorruption.metadata.recordRevision === importedRead.metadata.recordRevision,
          corruptionCode,
          databaseVersion: schema.version,
          objectStores: schema.stores,
          deletedSlots: [deletedA.slotId, deletedB.slotId],
          remainingSlotCount: remaining.slots.length
        };
      } finally {
        await repository.close();
      }
    }, {
      databaseName: databaseId,
      storagePath: browserStorageModulePath,
      persistencePath: persistenceModulePath,
      primarySlot: slotA,
      importedSlot: slotB
    });

    expect(reloadScenario).toMatchObject({
      reloadedRevision: initialWrite.readRevision,
      reloadedSignature: initialWrite.readSignature,
      staleCasCode: "RevisionConflict",
      staleCasPreservedRevision: initialWrite.readRevision,
      staleCasPreservedSignature: initialWrite.readSignature,
      matchingCasRevision: initialWrite.readRevision + 1,
      matchingCasSignature: initialWrite.readSignature,
      importedSlotId: slotB,
      importedRevision: 1,
      importedSignature: initialWrite.readSignature,
      importedPayloadMatches: true,
      importedContentSurvivedSourceCorruption: true,
      corruptionCode: "ChecksumMismatch",
      databaseVersion: 1,
      objectStores: ["repositoryMetadata", "saveSlots"],
      deletedSlots: [slotA, slotB],
      remainingSlotCount: 0
    });
  } catch (error) {
    scenarioFailure = error;
  } finally {
    finalDatabaseDeletion = await deleteDatabase(page, databaseId);
  }

  if (scenarioFailure !== undefined) {
    throw scenarioFailure;
  }
  expect(initialWrite).toBeDefined();
  expect(reloadScenario).toBeDefined();
  expect(finalDatabaseDeletion).toBe("deleted");
  expect(health.consoleErrors, "console errors").toEqual([]);
  expect(health.pageErrors, "page errors").toEqual([]);
  expect(health.requestFailures, "failed requests").toEqual([]);
  expect(health.httpErrors, "HTTP responses with status >= 400").toEqual([]);

  const confirmedInitialWrite = initialWrite!;
  const confirmedReloadScenario = reloadScenario!;
  const evidence: BrowserStorageEvidence = {
    schemaVersion: 1,
    feature: "browser-indexeddb-save-repository-core-v1",
    route: routeGuard,
    moduleLoad: {
      path: confirmedInitialWrite.modulePath,
      loaded: confirmedInitialWrite.moduleLoaded
    },
    isolation: {
      databaseId,
      preRunDeletion
    },
    repositorySchema: {
      version: confirmedReloadScenario.databaseVersion,
      objectStores: confirmedReloadScenario.objectStores
    },
    slotA: {
      slotId: confirmedInitialWrite.slotId,
      initialRevision: confirmedInitialWrite.readRevision,
      signature: confirmedInitialWrite.readSignature,
      reloadPreservedRevision:
        confirmedReloadScenario.reloadedRevision === confirmedInitialWrite.readRevision,
      reloadPreservedSignature:
        confirmedReloadScenario.reloadedSignature === confirmedInitialWrite.readSignature
    },
    compareAndSwap: {
      staleErrorCode: confirmedReloadScenario.staleCasCode,
      staleWritePreservedRecord:
        confirmedReloadScenario.staleCasPreservedRevision === confirmedInitialWrite.readRevision
        && confirmedReloadScenario.staleCasPreservedSignature === confirmedInitialWrite.readSignature,
      matchingRevisionBefore: confirmedReloadScenario.reloadedRevision,
      matchingRevisionAfter: confirmedReloadScenario.matchingCasRevision,
      revisionAdvancedByOne:
        confirmedReloadScenario.matchingCasRevision === confirmedReloadScenario.reloadedRevision + 1
    },
    exportImport: {
      policy: "CreateNewSlot",
      targetSlotId: confirmedReloadScenario.importedSlotId,
      targetRevision: confirmedReloadScenario.importedRevision,
      payloadMatchesExport: confirmedReloadScenario.importedPayloadMatches,
      targetSurvivedSourceCorruption: confirmedReloadScenario.importedContentSurvivedSourceCorruption
    },
    corruption: {
      sourceSlotId: slotA,
      mutation: "payload-byte-flipped-without-hash-update",
      errorCode: confirmedReloadScenario.corruptionCode
    },
    cleanup: {
      deletedSlots: confirmedReloadScenario.deletedSlots,
      remainingSlotCount: confirmedReloadScenario.remainingSlotCount,
      databaseDeletion: finalDatabaseDeletion
    },
    health,
    status: "PASS"
  };

  await mkdir(evidenceDir, { recursive: true });
  await writeFile(summaryPath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  await writeFile(markdownPath, createMarkdown(evidence), "utf8");
});

test("versionchange closes the connection and explicit close remains terminal", async ({ page }) => {
  const health = installBrowserHealthCollector(page);
  await openNormalRoute(page);
  expect(await deleteDatabase(page, lifecycleDatabaseId)).toBe("deleted");

  let finalDatabaseDeletion: DatabaseDeletionOutcome = "error";
  try {
    const result = await page.evaluate(async ({ databaseName, storagePath, persistencePath }) => {
      const browserStorage = await import(storagePath);
      const persistence = await import(persistencePath);
      const repository = browserStorage.createIndexedDbSaveRepository(
        persistence.createDefinitionResolutionFixture(),
        { databaseId: databaseName }
      );
      let upgradedDatabase: IDBDatabase | undefined;

      const errorContract = async (operation: () => Promise<unknown>) => {
        try {
          await operation();
          return { code: "NO_ERROR", name: "NO_ERROR" };
        } catch (error) {
          return {
            code: browserStorage.isSaveRepositoryError(error)
              ? (error as { readonly code: string }).code
              : "UNEXPECTED_ERROR",
            name: error instanceof Error ? error.name : typeof error
          };
        }
      };

      try {
        await repository.initialize();
        upgradedDatabase = await new Promise<IDBDatabase>((resolve, reject) => {
          const request = indexedDB.open(databaseName, browserStorage.INDEXED_DB_SAVE_REPOSITORY_VERSION + 1);
          request.onerror = () => reject(new Error("Opening the future database version failed."));
          request.onblocked = () => reject(new Error("The repository did not close its connection for versionchange."));
          request.onsuccess = () => resolve(request.result);
        });

        const afterVersionChange = await errorContract(() => repository.listSlots());
        await repository.close();
        const afterExplicitClose = await errorContract(() => repository.listSlots());

        return {
          upgradedVersion: upgradedDatabase.version,
          afterVersionChange,
          afterExplicitClose
        };
      } finally {
        await repository.close();
        upgradedDatabase?.close();
      }
    }, {
      databaseName: lifecycleDatabaseId,
      storagePath: browserStorageModulePath,
      persistencePath: persistenceModulePath
    });

    expect(result).toEqual({
      upgradedVersion: 2,
      afterVersionChange: {
        code: "UnsupportedRepositoryVersion",
        name: "SaveRepositoryError"
      },
      afterExplicitClose: {
        code: "ClosedRepository",
        name: "SaveRepositoryError"
      }
    });
  } finally {
    finalDatabaseDeletion = await deleteDatabase(page, lifecycleDatabaseId);
  }

  expect(finalDatabaseDeletion).toBe("deleted");
  expectHealthyBrowser(health);
});

test("blocked database deletion settles and cleanup succeeds after the blocker closes", async ({ page }) => {
  const health = installBrowserHealthCollector(page);
  await openNormalRoute(page);
  expect(await deleteDatabase(page, blockedDeletionDatabaseId)).toBe("deleted");

  let finalDatabaseDeletion: DatabaseDeletionOutcome = "error";
  try {
    const blockedOutcome = await page.evaluate(async (databaseName) => {
      const blockingDatabase = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(databaseName, 1);
        request.onerror = () => reject(new Error("Creating the blocking database connection failed."));
        request.onsuccess = () => resolve(request.result);
      });
      blockingDatabase.onversionchange = () => undefined;

      try {
        return await new Promise<DatabaseDeletionOutcome>((resolve, reject) => {
          const timeoutId = window.setTimeout(
            () => reject(new Error("Blocked database deletion did not settle within two seconds.")),
            2_000
          );
          const request = indexedDB.deleteDatabase(databaseName);
          const finish = (outcome: DatabaseDeletionOutcome): void => {
            window.clearTimeout(timeoutId);
            resolve(outcome);
          };
          request.onsuccess = () => finish("deleted");
          request.onerror = () => finish("error");
          request.onblocked = () => finish("blocked");
        });
      } finally {
        blockingDatabase.close();
      }
    }, blockedDeletionDatabaseId);

    expect(blockedOutcome).toBe("blocked");
  } finally {
    finalDatabaseDeletion = await deleteDatabase(page, blockedDeletionDatabaseId);
  }

  expect(finalDatabaseDeletion).toBe("deleted");
  expectHealthyBrowser(health);
});

test("future database version and repository marker fail closed with product errors", async ({ page }) => {
  const health = installBrowserHealthCollector(page);
  await openNormalRoute(page);
  expect(await deleteDatabase(page, futureDatabaseVersionId)).toBe("deleted");
  expect(await deleteDatabase(page, futureMarkerDatabaseId)).toBe("deleted");

  let futureDatabaseDeletion: DatabaseDeletionOutcome = "error";
  let futureMarkerDeletion: DatabaseDeletionOutcome = "error";
  try {
    const result = await page.evaluate(async ({ futureDatabaseName, futureMarkerName, storagePath, persistencePath }) => {
      const browserStorage = await import(storagePath);
      const persistence = await import(persistencePath);

      const openDatabase = (
        databaseName: string,
        version: number,
        upgrade: (database: IDBDatabase, transaction: IDBTransaction) => void
      ): Promise<IDBDatabase> => new Promise((resolve, reject) => {
        const request = indexedDB.open(databaseName, version);
        request.onupgradeneeded = () => upgrade(request.result, request.transaction!);
        request.onerror = () => reject(new Error(`Creating controlled database ${databaseName} failed.`));
        request.onsuccess = () => resolve(request.result);
      });

      const futureDatabase = await openDatabase(
        futureDatabaseName,
        browserStorage.INDEXED_DB_SAVE_REPOSITORY_VERSION + 1,
        () => undefined
      );
      futureDatabase.close();

      const markerDatabase = await openDatabase(
        futureMarkerName,
        browserStorage.INDEXED_DB_SAVE_REPOSITORY_VERSION,
        (database, transaction) => {
          database.createObjectStore(browserStorage.INDEXED_DB_SAVE_SLOTS_STORE);
          const metadata = database.createObjectStore(browserStorage.INDEXED_DB_REPOSITORY_METADATA_STORE);
          metadata.put(2, browserStorage.INDEXED_DB_REPOSITORY_SCHEMA_MARKER_KEY);
          transaction.onerror = () => undefined;
        }
      );
      markerDatabase.close();

      const initializeContract = async (databaseName: string) => {
        const repository = browserStorage.createIndexedDbSaveRepository(
          persistence.createDefinitionResolutionFixture(),
          { databaseId: databaseName }
        );
        try {
          await repository.initialize();
          return { code: "NO_ERROR", name: "NO_ERROR", operation: "NO_ERROR" };
        } catch (error) {
          return {
            code: browserStorage.isSaveRepositoryError(error)
              ? (error as { readonly code: string }).code
              : "UNEXPECTED_ERROR",
            name: error instanceof Error ? error.name : typeof error,
            operation: browserStorage.isSaveRepositoryError(error)
              ? (error as { readonly operation: string }).operation
              : "UNEXPECTED_ERROR"
          };
        } finally {
          await repository.close();
        }
      };

      return {
        futureDatabase: await initializeContract(futureDatabaseName),
        futureMarker: await initializeContract(futureMarkerName)
      };
    }, {
      futureDatabaseName: futureDatabaseVersionId,
      futureMarkerName: futureMarkerDatabaseId,
      storagePath: browserStorageModulePath,
      persistencePath: persistenceModulePath
    });

    expect(result).toEqual({
      futureDatabase: {
        code: "UnsupportedRepositoryVersion",
        name: "SaveRepositoryError",
        operation: "initialize"
      },
      futureMarker: {
        code: "UnsupportedRepositoryVersion",
        name: "SaveRepositoryError",
        operation: "initialize"
      }
    });
  } finally {
    futureDatabaseDeletion = await deleteDatabase(page, futureDatabaseVersionId);
    futureMarkerDeletion = await deleteDatabase(page, futureMarkerDatabaseId);
  }

  expect(futureDatabaseDeletion).toBe("deleted");
  expect(futureMarkerDeletion).toBe("deleted");
  expectHealthyBrowser(health);
});

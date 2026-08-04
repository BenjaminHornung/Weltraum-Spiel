import { expect, test } from "@playwright/test";
type StorageModule = typeof import("../../src/browser-storage/indexedDbStructuralEvidenceStore");
type StructuralModule = typeof import("../../src/voxel/structural");

test("persists verified Structural Evidence records across IndexedDB reopen", async ({ page }) => {
  const databaseId = `e2e-structural-evidence-v2-${Date.now()}`;
  await page.goto("/?surfacePlay=1");
  const result = await page.evaluate(async (databaseIdValue) => {
    const load = new Function("specifier", "return import(specifier);") as (specifier: string) => Promise<unknown>;
    const storage = await load("/src/browser-storage/indexedDbStructuralEvidenceStore.ts") as StorageModule;
    const structural = await load("/src/voxel/structural/index.ts") as StructuralModule;
    const store = new storage.IndexedDbStructuralEvidenceStore({ databaseId: databaseIdValue });
    await store.initialize();
    const origin = structural.createStructuralEvidenceFreshOriginV2();
    const bytes = structural.serializeStructuralEvidenceOriginV2(origin);
    const first = await store.putIfAbsent(origin.originHash, bytes);
    const duplicate = await store.putIfAbsent(origin.originHash, bytes);
    await store.close();

    const reopened = new storage.IndexedDbStructuralEvidenceStore({ databaseId: databaseIdValue });
    await reopened.initialize();
    const recovered = await reopened.resolve(origin.originHash);
    const conflict = await reopened.putIfAbsent(origin.originHash, bytes + " ").then(() => "accepted", (error: unknown) => error instanceof Error ? error.name : "rejected");
    const raw = await new Promise<unknown>((resolve, reject) => {
      const request = indexedDB.open(databaseIdValue, storage.INDEXED_DB_STRUCTURAL_EVIDENCE_VERSION);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const database = request.result;
        const transaction = database.transaction(storage.INDEXED_DB_STRUCTURAL_EVIDENCE_RECORDS_STORE, "readwrite");
        transaction.objectStore(storage.INDEXED_DB_STRUCTURAL_EVIDENCE_RECORDS_STORE).put({ hash: origin.originHash, canonicalBytes: "{}", byteLength: 2 }, origin.originHash);
        transaction.oncomplete = () => { database.close(); resolve(true); };
        transaction.onabort = () => reject(transaction.error);
      };
    });
    const corruption = await reopened.resolve(origin.originHash).then(() => "accepted", (error: unknown) => error instanceof Error ? error.name : "rejected");
    await reopened.close();
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase(databaseIdValue);
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error("cleanup blocked"));
      request.onsuccess = () => resolve();
    });
    return { first, duplicate, recovered, bytes, conflict, raw, corruption };
  }, databaseId);

  expect(result.first).toMatchObject({ alreadyPresent: false });
  expect(result.duplicate).toMatchObject({ alreadyPresent: true });
  expect(result.recovered).toBe(result.bytes);
  expect(result.conflict).not.toBe("accepted");
  expect(result.raw).toBe(true);
  expect(result.corruption).not.toBe("accepted");
});
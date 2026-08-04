import { describe, expect, it } from "vitest";
import {
  STRUCTURAL_COMMAND_EVIDENCE_SCHEMA_VERSION,
  STRUCTURAL_FRAME_BINDING_SCHEMA_VERSION,
  STRUCTURAL_OBJECT_SCHEMA_VERSION,
  STRUCTURAL_SOURCE_BINDING_SCHEMA_VERSION,
  canonicalStructuralJson,
  hashStructuralEvidence,
  hashStructuralObjectContent,
  hydrateStructuralEvidenceCommandIdsV2,
  encodeStructuralObjectV2,
  decodeStructuralObjectV2,
  migrateStructuralObjectV1ToV2,
  projectStructuralObjectContent,
  type StructuralCommandEvidence,
  type StructuralEvidencePutReceiptV2,
  type StructuralEvidenceRecordStoreV2,
  type StructuralObject
} from "../../src/voxel/structural";

const hash = (digit: string) => `fnv1a64-v1:${digit.repeat(16)}`;

class Store implements StructuralEvidenceRecordStoreV2 {
  readonly records = new Map<string, string>();
  async resolve(key: string) { return this.records.get(key) ?? null; }
  async putIfAbsent(key: string, bytes: string): Promise<StructuralEvidencePutReceiptV2> {
    const previous = this.records.get(key);
    if (previous !== undefined && previous !== bytes) throw new Error("conflict");
    this.records.set(key, bytes);
    return { requestedHash: key, storedHash: key, byteLength: new TextEncoder().encode(bytes).byteLength, alreadyPresent: previous !== undefined };
  }
}

const makeObject = (count: number): StructuralObject => {
  const receipts = Array.from({ length: count }, (_, ordinal): StructuralCommandEvidence => ({
    schemaVersion: STRUCTURAL_COMMAND_EVIDENCE_SCHEMA_VERSION,
    commandId: `command.migrate.${ordinal}`,
    commandHash: hash("1"),
    status: "NoChange",
    previousObjectRevision: ordinal,
    resultingObjectRevision: ordinal + 1,
    previousEditRevision: 0,
    resultingEditRevision: 0,
    previousContentHash: hash("2"),
    resultingContentHash: hash("2"),
    changedBrickKeys: [],
    selectedVoxelCount: 0,
    changedVoxelCount: 0,
    adaptiveJournalDigest: hash("3")
  } as unknown as StructuralCommandEvidence));
  const partial = {
    schemaVersion: STRUCTURAL_OBJECT_SCHEMA_VERSION,
    objectId: "object.migration",
    frame: {
      schemaVersion: STRUCTURAL_FRAME_BINDING_SCHEMA_VERSION,
      bodyId: "body.test", surfaceFrameId: "frame.test", regionId: "region.test", generatorVersion: "generator.test",
      objectOriginQuantum: { x: 0, y: 0, z: 0 }
    },
    source: {
      schemaVersion: STRUCTURAL_SOURCE_BINDING_SCHEMA_VERSION,
      baseFieldIdentity: "base.test", baseFieldVersion: "base.v1", baseFieldDescriptorDigest: hash("4"),
      journalDigest: hash("3"), snapshotProjectionDigest: hash("5"), proofDigests: [],
      sourceRevision: 0, editRevision: 0, brickRevision: 0, planningEpoch: 0
    },
    materials: [], bricks: [], anchors: [], joints: [], objectRevision: count, editRevision: 0,
    contentHash: "", commandEvidence: receipts, evidenceHash: hashStructuralEvidence(receipts)
  } as unknown as StructuralObject;
  return { ...partial, contentHash: hashStructuralObjectContent(partial) } as StructuralObject;
};

describe("Structural Evidence V1 to V2 migration", () => {
  it.each([0, 1, 64, 65, 129])("groups deterministically by 64 and preserves semantic content at %i receipts", async (count) => {
    const source = makeObject(count);
    const firstStore = new Store();
    const secondStore = new Store();
    const first = await migrateStructuralObjectV1ToV2(source, firstStore);
    const second = await migrateStructuralObjectV1ToV2(source, secondStore);
    expect(first).toEqual(second);
    expect(firstStore.records).toEqual(secondStore.records);
    expect(first.objectRevision).toBe(source.objectRevision);
    expect(first.editRevision).toBe(source.editRevision);
    expect(first.contentHash).toBe(source.contentHash);
    expect(encodeStructuralObjectV2(decodeStructuralObjectV2(encodeStructuralObjectV2(first))))
      .toBe(encodeStructuralObjectV2(first));
    expect(canonicalStructuralJson(projectStructuralObjectContent(first)))
      .toBe(canonicalStructuralJson(projectStructuralObjectContent(source)));
    expect((await hydrateStructuralEvidenceCommandIdsV2(first.evidenceArchive, firstStore)).commandIds.size).toBe(count);
  });

  it("aborts before a partial result when receipt count and revision disagree", async () => {
    const source = { ...makeObject(1), objectRevision: 2 } as StructuralObject;
    const store = new Store();
    await expect(migrateStructuralObjectV1ToV2(source, store)).rejects.toThrow();
    expect(store.records.size).toBe(0);
  });
});

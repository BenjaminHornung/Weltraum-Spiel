import { describe, expect, it } from "vitest";
import {
  STRUCTURAL_COMMAND_EVIDENCE_SCHEMA_VERSION,
  STRUCTURAL_EVIDENCE_SEGMENT_MAX_RECEIPTS,
  createStructuralEvidenceArchiveManifestV2,
  createStructuralEvidenceFreshOriginV2,
  createStructuralEvidenceSegmentV2,
  encodeStructuralEvidenceOriginV2,
  exportStructuralEvidenceArchiveV2,
  hydrateStructuralEvidenceCommandIdsV2,
  importStructuralEvidenceArchiveV2,
  prepareStructuralEvidenceAppend,
  serializeStructuralEvidenceOriginV2,
  serializeStructuralEvidenceSegmentV2,
  type StructuralCommandEvidence,
  type StructuralEvidencePutReceiptV2,
  type StructuralEvidencePredecessorV2,
  type StructuralEvidenceRecordStoreV2
} from "../../src/voxel/structural";

const hash = (digit: string) => `fnv1a64-v1:${digit.repeat(16)}`;

class EvidenceStore implements StructuralEvidenceRecordStoreV2 {
  readonly records = new Map<string, string>();

  async resolve(value: string): Promise<string | null> {
    return this.records.get(value) ?? null;
  }

  async putIfAbsent(value: string, bytes: string): Promise<StructuralEvidencePutReceiptV2> {
    const previous = this.records.get(value);
    if (previous !== undefined && previous !== bytes) throw new Error("hash collision");
    this.records.set(value, bytes);
    return {
      requestedHash: value,
      storedHash: value,
      byteLength: new TextEncoder().encode(bytes).byteLength,
      alreadyPresent: previous !== undefined
    };
  }
}

const receipt = (ordinal: number): StructuralCommandEvidence => ({
  schemaVersion: STRUCTURAL_COMMAND_EVIDENCE_SCHEMA_VERSION,
  commandId: `command.archive.${ordinal}`,
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
} as unknown as StructuralCommandEvidence);

const archiveWith = async (count: number) => {
  const store = new EvidenceStore();
  const origin = createStructuralEvidenceFreshOriginV2();
  await store.putIfAbsent(origin.originHash, serializeStructuralEvidenceOriginV2(origin));
  let manifest = createStructuralEvidenceArchiveManifestV2(origin.originHash, null, 0);
  let predecessor: StructuralEvidencePredecessorV2 = { kind: "Origin", hash: origin.originHash };
  let head: string | null = null;
  for (let ordinal = 0; ordinal < count; ordinal += STRUCTURAL_EVIDENCE_SEGMENT_MAX_RECEIPTS) {
    const receipts = Array.from(
      { length: Math.min(STRUCTURAL_EVIDENCE_SEGMENT_MAX_RECEIPTS, count - ordinal) },
      (_, offset) => receipt(ordinal + offset)
    );
    const segment = createStructuralEvidenceSegmentV2(predecessor, ordinal, receipts);
    await store.putIfAbsent(segment.segmentHash, serializeStructuralEvidenceSegmentV2(segment));
    head = segment.segmentHash;
    predecessor = { kind: "Segment" as const, hash: segment.segmentHash };
  }
  manifest = createStructuralEvidenceArchiveManifestV2(origin.originHash, head, count);
  return { store, origin, manifest };
};

describe("Structural Evidence Archive V2", () => {
  it("keeps fresh Origin and manifest byte/hash deterministic", () => {
    const origin = createStructuralEvidenceFreshOriginV2();
    expect(encodeStructuralEvidenceOriginV2(origin)).toBe(serializeStructuralEvidenceOriginV2(origin));
    const manifest = createStructuralEvidenceArchiveManifestV2(origin.originHash, null, 0);
    expect(manifest).toEqual({
      originHash: origin.originHash,
      headSegmentHash: null,
      receiptCount: 0,
      archiveHash: manifest.archiveHash
    });
  });

  it.each([0, 1, 63, 64, 65, 4_097, 10_000])("hydrates exact command IDs without a total cap at %i receipts", async (count) => {
    const { store, manifest } = await archiveWith(count);
    const hydrated = await hydrateStructuralEvidenceCommandIdsV2(manifest, store, 7);
    expect(hydrated.status).toBe("Ready");
    expect(hydrated.commandIds.size).toBe(count);
    expect(manifest.receiptCount).toBe(count);
    expect(STRUCTURAL_EVIDENCE_SEGMENT_MAX_RECEIPTS).toBe(64);
  }, 60_000);

  it("fails closed for a missing or corrupt reachable head without advancing the source manifest", async () => {
    const { store, manifest } = await archiveWith(65);
    const original = { ...manifest };
    if (manifest.headSegmentHash === null) throw new Error("expected head");
    store.records.delete(manifest.headSegmentHash);
    await expect(hydrateStructuralEvidenceCommandIdsV2(manifest, store)).rejects.toThrow();
    await expect(prepareStructuralEvidenceAppend(manifest, receipt(65), store)).rejects.toThrow();
    expect(manifest).toEqual(original);
  });

  it("streams export/import records and reproduces the exact manifest truth", async () => {
    const { store, manifest } = await archiveWith(65);
    const records: Readonly<{ hash: string; bytes: string }>[] = [];
    for await (const record of exportStructuralEvidenceArchiveV2(manifest, store)) records.push(record);
    const imported = new EvidenceStore();
    async function* source() { for (const record of records) yield record; }
    expect(await importStructuralEvidenceArchiveV2(source(), imported)).toBe(records.length);
    const hydrated = await hydrateStructuralEvidenceCommandIdsV2(manifest, imported);
    expect(hydrated.commandIds.size).toBe(65);
    expect(imported.records).toEqual(store.records);
  });
});

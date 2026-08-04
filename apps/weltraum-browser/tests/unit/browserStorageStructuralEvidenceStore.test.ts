import { describe, expect, it } from "vitest";
import {
  STRUCTURAL_COMMAND_EVIDENCE_SCHEMA_VERSION,
  STRUCTURAL_EVIDENCE_SEGMENT_MAX_RECEIPTS,
  createStructuralEvidenceArchiveManifestV2,
  createStructuralEvidenceFreshOriginV2,
  createStructuralEvidenceSegmentV2,
  hydrateStructuralEvidenceCommandIdsV2,
  serializeStructuralEvidenceOriginV2,
  serializeStructuralEvidenceSegmentV2,
  type StructuralCommandEvidence,
  type StructuralEvidencePredecessorV2
} from "../../src/voxel/structural";
import {
  MemoryStructuralEvidenceStore,
  StructuralEvidenceStoreError
} from "../../src/browser-storage";

const hash = (digit: string) => `fnv1a64-v1:${digit.repeat(16)}`;

const receipt = (ordinal: number): StructuralCommandEvidence => ({
  schemaVersion: STRUCTURAL_COMMAND_EVIDENCE_SCHEMA_VERSION,
  commandId: `command.store.${ordinal}`,
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

const archiveWithStore = async (count: number) => {
  const store = new MemoryStructuralEvidenceStore();
  await store.initialize();
  const origin = createStructuralEvidenceFreshOriginV2();
  await store.putIfAbsent(origin.originHash, serializeStructuralEvidenceOriginV2(origin));
  let predecessor: StructuralEvidencePredecessorV2 = { kind: "Origin", hash: origin.originHash };
  let headSegmentHash: string | null = null;
  for (let ordinal = 0; ordinal < count; ordinal += STRUCTURAL_EVIDENCE_SEGMENT_MAX_RECEIPTS) {
    const segment = createStructuralEvidenceSegmentV2(
      predecessor,
      ordinal,
      Array.from({ length: Math.min(STRUCTURAL_EVIDENCE_SEGMENT_MAX_RECEIPTS, count - ordinal) }, (_, offset) => receipt(ordinal + offset))
    );
    await store.putIfAbsent(segment.segmentHash, serializeStructuralEvidenceSegmentV2(segment));
    predecessor = { kind: "Segment", hash: segment.segmentHash };
    headSegmentHash = segment.segmentHash;
  }
  return {
    store,
    origin,
    manifest: createStructuralEvidenceArchiveManifestV2(origin.originHash, headSegmentHash, count)
  };
};

describe("Structural Evidence browser-storage adapters", () => {
  it("enforces memory lifecycle, verified idempotency, and fail-closed conflicts", async () => {
    const store = new MemoryStructuralEvidenceStore();
    await expect(store.resolve(hash("1"))).rejects.toMatchObject({ code: "RepositoryUnavailable" });
    await store.initialize();
    const origin = createStructuralEvidenceFreshOriginV2();
    const bytes = serializeStructuralEvidenceOriginV2(origin);
    await expect(store.putIfAbsent(origin.originHash, bytes)).resolves.toMatchObject({ alreadyPresent: false });
    await expect(store.putIfAbsent(origin.originHash, bytes)).resolves.toMatchObject({ alreadyPresent: true });
    expect(await store.resolve(origin.originHash)).toBe(bytes);
    const before = store.records.get(origin.originHash);
    await expect(store.putIfAbsent(origin.originHash, bytes + " ")).rejects.toMatchObject({ code: "CorruptRecord" });
    expect(store.records.get(origin.originHash)).toBe(before);
    store.records.set(origin.originHash, { hash: origin.originHash, canonicalBytes: "{}", byteLength: 2 });
    await expect(store.resolve(origin.originHash)).rejects.toBeInstanceOf(StructuralEvidenceStoreError);
    await store.close();
    await expect(store.resolve(origin.originHash)).rejects.toMatchObject({ code: "ClosedRepository" });
    await expect(store.initialize()).rejects.toMatchObject({ code: "ClosedRepository" });
  });

  it.each([0, 1, 63, 64, 65, 4_097, 10_000])("stores and rehydrates archive count %i without a total cap", async (count) => {
    const { store, origin, manifest } = await archiveWithStore(count);
    const hydrated = await hydrateStructuralEvidenceCommandIdsV2(manifest, store, 7);
    expect(hydrated.status).toBe("Ready");
    expect(hydrated.commandIds.size).toBe(count);
    expect(await store.resolve(origin.originHash)).toBe(serializeStructuralEvidenceOriginV2(origin));
  }, 60_000);
});
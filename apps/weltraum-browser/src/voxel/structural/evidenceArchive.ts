import {
  canonicalAdaptiveJson,
  deepFreeze,
  hashAdaptiveCanonical,
  requireExactKeys,
  requirePlainRecord,
  stableAuthorityId,
  validateAdaptiveBrickKey
} from "../adaptive";
import { projectStructuralCommandEvidence, projectStructuralObjectContent } from "./canonical";
import {
  STRUCTURAL_COMMAND_EVIDENCE_SCHEMA_VERSION,
  STRUCTURAL_EVIDENCE_ORIGIN_SCHEMA_VERSION_V2,
  STRUCTURAL_EVIDENCE_SEGMENT_MAX_RECEIPTS,
  STRUCTURAL_EVIDENCE_SEGMENT_SCHEMA_VERSION_V2,
  STRUCTURAL_OBJECT_SCHEMA_VERSION,
  STRUCTURAL_OBJECT_SCHEMA_VERSION_V2,
  type StructuralCommandEvidence,
  type StructuralEvidenceArchiveManifestV2,
  type StructuralEvidenceOriginV2,
  type StructuralEvidencePredecessorV2,
  type StructuralEvidenceSegmentV2,
  type StructuralObject,
  type StructuralObjectV2
} from "./types";
import {
  requireStructuralHash,
  structuralNonNegativeSafeInteger,
  structuralRevision,
  structuralFail
} from "./validation";

const LEGACY_EVIDENCE_BYTES_DOMAIN = "structural-evidence-v1-exact-bytes-v2" as const;

const hashProjection = (value: unknown): string => hashAdaptiveCanonical(value);

type StructuralEvidenceOriginProjectionInputV2 =
  | { readonly schemaVersion: typeof STRUCTURAL_EVIDENCE_ORIGIN_SCHEMA_VERSION_V2; readonly kind: "Fresh" }
  | {
      readonly schemaVersion: typeof STRUCTURAL_EVIDENCE_ORIGIN_SCHEMA_VERSION_V2;
      readonly kind: "MigratedV1";
      readonly legacySchemaVersion: typeof STRUCTURAL_OBJECT_SCHEMA_VERSION;
      readonly legacyEvidenceBytesHash: string;
      readonly legacyReceiptCount: number;
    };

const originProjection = (origin: StructuralEvidenceOriginProjectionInputV2) => origin.kind === "Fresh"
  ? deepFreeze({ schemaVersion: origin.schemaVersion, kind: origin.kind })
  : deepFreeze({
      schemaVersion: origin.schemaVersion,
      kind: origin.kind,
      legacySchemaVersion: origin.legacySchemaVersion,
      legacyEvidenceBytesHash: origin.legacyEvidenceBytesHash,
      legacyReceiptCount: origin.legacyReceiptCount
    });

const predecessorProjection = (predecessor: StructuralEvidencePredecessorV2) => deepFreeze({
  kind: predecessor.kind,
  hash: predecessor.hash
});

const segmentProjection = (segment: Omit<StructuralEvidenceSegmentV2, "segmentHash">) => deepFreeze({
  schemaVersion: segment.schemaVersion,
  predecessor: predecessorProjection(segment.predecessor),
  firstReceiptOrdinal: segment.firstReceiptOrdinal,
  endReceiptOrdinalExclusive: segment.endReceiptOrdinalExclusive,
  receipts: segment.receipts.map(projectStructuralCommandEvidence)
});

const manifestProjection = (manifest: Omit<StructuralEvidenceArchiveManifestV2, "archiveHash">) => deepFreeze({
  originHash: manifest.originHash,
  headSegmentHash: manifest.headSegmentHash,
  receiptCount: manifest.receiptCount
});

export const hashStructuralLegacyEvidenceBytesV2 = (bytes: string): string => {
  if (typeof bytes !== "string") return structuralFail("InvalidContract", "legacyEvidenceBytes", "Legacy evidence bytes must be a string.");
  return hashProjection({ schemaVersion: LEGACY_EVIDENCE_BYTES_DOMAIN, bytes });
};

export const createStructuralEvidenceFreshOriginV2 = (): StructuralEvidenceOriginV2 => {
  const partial = deepFreeze({
    schemaVersion: STRUCTURAL_EVIDENCE_ORIGIN_SCHEMA_VERSION_V2,
    kind: "Fresh" as const
  });
  return deepFreeze({ ...partial, originHash: hashProjection(originProjection(partial)) });
};

export const createStructuralEvidenceMigrationOriginV2 = (
  legacyEvidenceBytes: string,
  legacyReceiptCount: number
): StructuralEvidenceOriginV2 => {
  const partial = deepFreeze({
    schemaVersion: STRUCTURAL_EVIDENCE_ORIGIN_SCHEMA_VERSION_V2,
    kind: "MigratedV1" as const,
    legacySchemaVersion: STRUCTURAL_OBJECT_SCHEMA_VERSION,
    legacyEvidenceBytesHash: hashStructuralLegacyEvidenceBytesV2(legacyEvidenceBytes),
    legacyReceiptCount: structuralNonNegativeSafeInteger(legacyReceiptCount, "origin/legacyReceiptCount")
  });
  return deepFreeze({ ...partial, originHash: hashProjection(originProjection(partial)) });
};

export const validateStructuralEvidenceOriginV2 = (value: unknown): StructuralEvidenceOriginV2 => {
  const record = requirePlainRecord(value, "origin");
  if (record.kind === "Fresh") {
    requireExactKeys(record, ["schemaVersion", "kind", "originHash"], "origin");
    if (record.schemaVersion !== STRUCTURAL_EVIDENCE_ORIGIN_SCHEMA_VERSION_V2) return structuralFail("InvalidContract", "origin/schemaVersion", "Unsupported Structural Evidence Origin schema.");
    const origin = deepFreeze({
      schemaVersion: STRUCTURAL_EVIDENCE_ORIGIN_SCHEMA_VERSION_V2,
      kind: "Fresh" as const,
      originHash: requireStructuralHash(record.originHash, "origin/originHash")
    });
    if (hashProjection(originProjection(origin)) !== origin.originHash) return structuralFail("InvalidContract", "origin/originHash", "Structural Evidence Origin hash mismatch.");
    return origin;
  }
  requireExactKeys(record, ["schemaVersion", "kind", "legacySchemaVersion", "legacyEvidenceBytesHash", "legacyReceiptCount", "originHash"], "origin");
  if (record.schemaVersion !== STRUCTURAL_EVIDENCE_ORIGIN_SCHEMA_VERSION_V2 || record.kind !== "MigratedV1" || record.legacySchemaVersion !== STRUCTURAL_OBJECT_SCHEMA_VERSION) {
    return structuralFail("InvalidContract", "origin", "Unsupported migrated Structural Evidence Origin.");
  }
  const origin = deepFreeze({
    schemaVersion: STRUCTURAL_EVIDENCE_ORIGIN_SCHEMA_VERSION_V2,
    kind: "MigratedV1" as const,
    legacySchemaVersion: STRUCTURAL_OBJECT_SCHEMA_VERSION,
    legacyEvidenceBytesHash: requireStructuralHash(record.legacyEvidenceBytesHash, "origin/legacyEvidenceBytesHash"),
    legacyReceiptCount: structuralNonNegativeSafeInteger(record.legacyReceiptCount, "origin/legacyReceiptCount"),
    originHash: requireStructuralHash(record.originHash, "origin/originHash")
  });
  if (hashProjection(originProjection(origin)) !== origin.originHash) return structuralFail("InvalidContract", "origin/originHash", "Structural Evidence Origin hash mismatch.");
  return origin;
};

const validateReceipt = (value: unknown, path: string): StructuralCommandEvidence => {
  const record = requirePlainRecord(value, path);
  requireExactKeys(record, [
    "schemaVersion", "commandId", "commandHash", "status", "previousObjectRevision",
    "resultingObjectRevision", "previousEditRevision", "resultingEditRevision",
    "previousContentHash", "resultingContentHash", "changedBrickKeys", "selectedVoxelCount",
    "changedVoxelCount", "adaptiveJournalDigest"
  ], path);
  if (record.schemaVersion !== STRUCTURAL_COMMAND_EVIDENCE_SCHEMA_VERSION || (record.status !== "Applied" && record.status !== "NoChange")) {
    return structuralFail("InvalidContract", path, "Unsupported Structural receipt schema or status.");
  }
  const changedBrickValues = record.changedBrickKeys;
  if (!Array.isArray(changedBrickValues) || changedBrickValues.length > 4_096) return structuralFail("InvalidContract", `${path}/changedBrickKeys`, "Invalid Structural changed-brick list.");
  const projectedInput = changedBrickValues.every((entry) => typeof entry === "string");
  const changedBrickKeys = changedBrickValues.map((entry, index) => {
    if (typeof entry !== "string") return validateAdaptiveBrickKey(entry);
    let parsed: unknown;
    try { parsed = JSON.parse(entry) as unknown; } catch { return structuralFail("InvalidContract", `${path}/changedBrickKeys/${index}`, "Projected changed-brick key is invalid JSON."); }
    return validateAdaptiveBrickKey(parsed);
  });
  const receipt = deepFreeze({
    schemaVersion: STRUCTURAL_COMMAND_EVIDENCE_SCHEMA_VERSION,
    commandId: stableAuthorityId(record.commandId as string, `${path}/commandId`),
    commandHash: requireStructuralHash(record.commandHash, `${path}/commandHash`),
    status: record.status,
    previousObjectRevision: structuralRevision(record.previousObjectRevision, `${path}/previousObjectRevision`),
    resultingObjectRevision: structuralRevision(record.resultingObjectRevision, `${path}/resultingObjectRevision`),
    previousEditRevision: structuralRevision(record.previousEditRevision, `${path}/previousEditRevision`),
    resultingEditRevision: structuralRevision(record.resultingEditRevision, `${path}/resultingEditRevision`),
    previousContentHash: requireStructuralHash(record.previousContentHash, `${path}/previousContentHash`),
    resultingContentHash: requireStructuralHash(record.resultingContentHash, `${path}/resultingContentHash`),
    changedBrickKeys: deepFreeze(changedBrickKeys),
    selectedVoxelCount: structuralNonNegativeSafeInteger(record.selectedVoxelCount, `${path}/selectedVoxelCount`),
    changedVoxelCount: structuralNonNegativeSafeInteger(record.changedVoxelCount, `${path}/changedVoxelCount`),
    adaptiveJournalDigest: requireStructuralHash(record.adaptiveJournalDigest, `${path}/adaptiveJournalDigest`)
  }) as StructuralCommandEvidence;
  if (projectedInput && canonicalAdaptiveJson(projectStructuralCommandEvidence(receipt)) !== canonicalAdaptiveJson(value)) {
    return structuralFail("InvalidContract", path, "Structural receipt is not canonical.");
  }
  return deepFreeze(receipt);
};

export const createStructuralEvidenceSegmentV2 = (
  predecessor: StructuralEvidencePredecessorV2,
  firstReceiptOrdinalValue: number,
  receiptValues: readonly StructuralCommandEvidence[]
): StructuralEvidenceSegmentV2 => {
  const firstReceiptOrdinal = structuralNonNegativeSafeInteger(firstReceiptOrdinalValue, "segment/firstReceiptOrdinal");
  if (receiptValues.length < 1 || receiptValues.length > STRUCTURAL_EVIDENCE_SEGMENT_MAX_RECEIPTS) {
    return structuralFail("InvalidContract", "segment/receipts", "Structural Evidence Segment must contain 1 through 64 receipts.");
  }
  const receipts = deepFreeze(receiptValues.map((receipt, index) => validateReceipt(receipt, `segment/receipts/${index}`)));
  const endReceiptOrdinalExclusive = firstReceiptOrdinal + receipts.length;
  if (!Number.isSafeInteger(endReceiptOrdinalExclusive)) return structuralFail("ArithmeticOverflow", "segment/endReceiptOrdinalExclusive", "Structural Evidence ordinal overflow.");
  const canonicalPredecessor = deepFreeze({
    kind: predecessor.kind,
    hash: requireStructuralHash(predecessor.hash, "segment/predecessor/hash")
  }) as StructuralEvidencePredecessorV2;
  const partial = deepFreeze({
    schemaVersion: STRUCTURAL_EVIDENCE_SEGMENT_SCHEMA_VERSION_V2,
    predecessor: canonicalPredecessor,
    firstReceiptOrdinal,
    endReceiptOrdinalExclusive,
    receipts
  });
  return deepFreeze({ ...partial, segmentHash: hashProjection(segmentProjection(partial)) });
};

export const validateStructuralEvidenceSegmentV2 = (value: unknown): StructuralEvidenceSegmentV2 => {
  const record = requirePlainRecord(value, "segment");
  requireExactKeys(record, ["schemaVersion", "predecessor", "firstReceiptOrdinal", "endReceiptOrdinalExclusive", "receipts", "segmentHash"], "segment");
  if (record.schemaVersion !== STRUCTURAL_EVIDENCE_SEGMENT_SCHEMA_VERSION_V2) return structuralFail("InvalidContract", "segment/schemaVersion", "Unsupported Structural Evidence Segment schema.");
  const predecessorRecord = requirePlainRecord(record.predecessor, "segment/predecessor");
  requireExactKeys(predecessorRecord, ["kind", "hash"], "segment/predecessor");
  if (predecessorRecord.kind !== "Origin" && predecessorRecord.kind !== "Segment") return structuralFail("InvalidContract", "segment/predecessor/kind", "Unsupported Structural Evidence predecessor kind.");
  const receiptsValue = record.receipts;
  if (!Array.isArray(receiptsValue) || receiptsValue.length < 1 || receiptsValue.length > STRUCTURAL_EVIDENCE_SEGMENT_MAX_RECEIPTS) {
    return structuralFail("InvalidContract", "segment/receipts", "Structural Evidence Segment must contain 1 through 64 receipts.");
  }
  const segment = createStructuralEvidenceSegmentV2(
    { kind: predecessorRecord.kind, hash: requireStructuralHash(predecessorRecord.hash, "segment/predecessor/hash") },
    structuralNonNegativeSafeInteger(record.firstReceiptOrdinal, "segment/firstReceiptOrdinal"),
    receiptsValue.map((receipt, index) => validateReceipt(receipt, `segment/receipts/${index}`))
  );
  const projectedEnd = structuralNonNegativeSafeInteger(record.endReceiptOrdinalExclusive, "segment/endReceiptOrdinalExclusive");
  const projectedHash = requireStructuralHash(record.segmentHash, "segment/segmentHash");
  if (segment.endReceiptOrdinalExclusive !== projectedEnd || segment.segmentHash !== projectedHash || canonicalAdaptiveJson(segment) !== canonicalAdaptiveJson(value)) {
    return structuralFail("InvalidContract", "segment", "Structural Evidence Segment commitment mismatch.");
  }
  return segment;
};

export const createStructuralEvidenceArchiveManifestV2 = (
  originHashValue: string,
  headSegmentHashValue: string | null,
  receiptCountValue: number
): StructuralEvidenceArchiveManifestV2 => {
  const partial = deepFreeze({
    originHash: requireStructuralHash(originHashValue, "manifest/originHash"),
    headSegmentHash: headSegmentHashValue === null ? null : requireStructuralHash(headSegmentHashValue, "manifest/headSegmentHash"),
    receiptCount: structuralNonNegativeSafeInteger(receiptCountValue, "manifest/receiptCount")
  });
  return deepFreeze({ ...partial, archiveHash: hashProjection(manifestProjection(partial)) });
};

export const validateStructuralEvidenceArchiveManifestV2 = (value: unknown): StructuralEvidenceArchiveManifestV2 => {
  const record = requirePlainRecord(value, "manifest");
  requireExactKeys(record, ["originHash", "headSegmentHash", "receiptCount", "archiveHash"], "manifest");
  const manifest = createStructuralEvidenceArchiveManifestV2(
    requireStructuralHash(record.originHash, "manifest/originHash"),
    record.headSegmentHash === null ? null : requireStructuralHash(record.headSegmentHash, "manifest/headSegmentHash"),
    structuralNonNegativeSafeInteger(record.receiptCount, "manifest/receiptCount")
  );
  if (manifest.archiveHash !== requireStructuralHash(record.archiveHash, "manifest/archiveHash") || canonicalAdaptiveJson(manifest) !== canonicalAdaptiveJson(value)) {
    return structuralFail("InvalidContract", "manifest", "Structural Evidence Archive manifest commitment mismatch.");
  }
  if ((manifest.receiptCount === 0) !== (manifest.headSegmentHash === null)) return structuralFail("InvalidContract", "manifest/headSegmentHash", "Empty archive alone has no Segment head.");
  return manifest;
};

export const serializeStructuralEvidenceOriginV2 = (origin: StructuralEvidenceOriginV2): string => canonicalAdaptiveJson(validateStructuralEvidenceOriginV2(origin));
export const serializeStructuralEvidenceSegmentV2 = (segment: StructuralEvidenceSegmentV2): string => canonicalAdaptiveJson(validateStructuralEvidenceSegmentV2(segment));

export interface StructuralEvidenceRecordResolverV2 {
  resolve(hash: string): Promise<string | null>;
}

export interface StructuralEvidencePutReceiptV2 {
  readonly requestedHash: string;
  readonly storedHash: string;
  readonly byteLength: number;
  readonly alreadyPresent: boolean;
}

export interface StructuralEvidenceRecordStoreV2 extends StructuralEvidenceRecordResolverV2 {
  putIfAbsent(hash: string, canonicalBytes: string): Promise<StructuralEvidencePutReceiptV2>;
}

const requireVerifiedPut = async (
  store: StructuralEvidenceRecordStoreV2,
  hash: string,
  bytes: string
): Promise<void> => {
  const receipt = await store.putIfAbsent(hash, bytes);
  const byteLength = new TextEncoder().encode(bytes).byteLength;
  if (receipt.requestedHash !== hash || receipt.storedHash !== hash || receipt.byteLength !== byteLength) {
    return structuralFail("InvalidContract", "storeReceipt", "Structural Evidence store receipt does not bind the requested bytes.");
  }
  if (!receipt.alreadyPresent) {
    const stored = await store.resolve(hash);
    if (stored !== bytes) return structuralFail("InvalidContract", "storeReceipt", "Structural Evidence stored bytes failed read-back verification.");
  }
};

const resolveOrigin = async (resolver: StructuralEvidenceRecordResolverV2, hash: string): Promise<StructuralEvidenceOriginV2> => {
  const bytes = await resolver.resolve(hash);
  if (bytes === null) return structuralFail("InvalidContract", "origin", "Missing Structural Evidence Origin.");
  let parsed: unknown;
  try { parsed = JSON.parse(bytes) as unknown; } catch { return structuralFail("InvalidContract", "origin", "Corrupt Structural Evidence Origin JSON."); }
  const origin = validateStructuralEvidenceOriginV2(parsed);
  if (origin.originHash !== hash || serializeStructuralEvidenceOriginV2(origin) !== bytes) return structuralFail("InvalidContract", "origin", "Structural Evidence Origin bytes/hash mismatch.");
  return origin;
};

const resolveSegment = async (resolver: StructuralEvidenceRecordResolverV2, hash: string): Promise<StructuralEvidenceSegmentV2> => {
  const bytes = await resolver.resolve(hash);
  if (bytes === null) return structuralFail("InvalidContract", "segment", "Missing Structural Evidence Segment.");
  let parsed: unknown;
  try { parsed = JSON.parse(bytes) as unknown; } catch { return structuralFail("InvalidContract", "segment", "Corrupt Structural Evidence Segment JSON."); }
  const segment = validateStructuralEvidenceSegmentV2(parsed);
  if (segment.segmentHash !== hash || serializeStructuralEvidenceSegmentV2(segment) !== bytes) return structuralFail("InvalidContract", "segment", "Structural Evidence Segment bytes/hash mismatch.");
  return segment;
};

export const prepareStructuralEvidenceAppend = async (
  manifestValue: StructuralEvidenceArchiveManifestV2,
  receipt: StructuralCommandEvidence,
  store: StructuralEvidenceRecordStoreV2
): Promise<Readonly<{ manifest: StructuralEvidenceArchiveManifestV2; segment: StructuralEvidenceSegmentV2 }>> => {
  const manifest = validateStructuralEvidenceArchiveManifestV2(manifestValue);
  await resolveOrigin(store, manifest.originHash);
  let segment: StructuralEvidenceSegmentV2;
  if (manifest.headSegmentHash === null) {
    segment = createStructuralEvidenceSegmentV2({ kind: "Origin", hash: manifest.originHash }, 0, [receipt]);
  } else {
    const head = await resolveSegment(store, manifest.headSegmentHash);
    if (head.endReceiptOrdinalExclusive !== manifest.receiptCount) return structuralFail("InvalidContract", "manifest/headSegmentHash", "Structural Evidence head ordinal does not match receipt count.");
    segment = head.receipts.length < STRUCTURAL_EVIDENCE_SEGMENT_MAX_RECEIPTS
      ? createStructuralEvidenceSegmentV2(head.predecessor, head.firstReceiptOrdinal, [...head.receipts, receipt])
      : createStructuralEvidenceSegmentV2({ kind: "Segment", hash: head.segmentHash }, manifest.receiptCount, [receipt]);
  }
  await requireVerifiedPut(store, segment.segmentHash, serializeStructuralEvidenceSegmentV2(segment));
  return deepFreeze({
    manifest: createStructuralEvidenceArchiveManifestV2(manifest.originHash, segment.segmentHash, manifest.receiptCount + 1),
    segment
  });
};

export interface StructuralEvidenceHydrationV2 {
  readonly status: "Preparing" | "Ready";
  readonly commandIds: ReadonlySet<string>;
}

export const createStructuralEvidencePreparingHydrationV2 = (): StructuralEvidenceHydrationV2 =>
  deepFreeze({ status: "Preparing" as const, commandIds: new Set<string>() });

export const hydrateStructuralEvidenceCommandIdsV2 = async (
  manifestValue: StructuralEvidenceArchiveManifestV2,
  resolver: StructuralEvidenceRecordResolverV2,
  maxSegmentsPerSlice = 64
): Promise<StructuralEvidenceHydrationV2> => {
  const manifest = validateStructuralEvidenceArchiveManifestV2(manifestValue);
  if (!Number.isSafeInteger(maxSegmentsPerSlice) || maxSegmentsPerSlice < 1) return structuralFail("InvalidContract", "maxSegmentsPerSlice", "Hydration slice must be positive.");
  const origin = await resolveOrigin(resolver, manifest.originHash);
  const segments: StructuralEvidenceSegmentV2[] = [];
  let next = manifest.headSegmentHash;
  while (next !== null) {
    const segment = await resolveSegment(resolver, next);
    segments.push(segment);
    if (segments.length % maxSegmentsPerSlice === 0) await Promise.resolve();
    if (segment.predecessor.kind === "Origin") {
      if (segment.predecessor.hash !== origin.originHash) return structuralFail("InvalidContract", "segment/predecessor", "First Segment must link to the manifest Origin.");
      next = null;
    } else next = segment.predecessor.hash;
  }
  segments.reverse();
  let ordinal = 0;
  const commandIds = new Set<string>();
  let previousReceipt: StructuralCommandEvidence | undefined;
  for (const segment of segments) {
    if (segment.firstReceiptOrdinal !== ordinal) return structuralFail("InvalidContract", "segment/firstReceiptOrdinal", "Structural Evidence Segment ordinal gap or overlap.");
    for (const receipt of segment.receipts) {
      if (receipt.previousObjectRevision !== ordinal || receipt.resultingObjectRevision !== ordinal + 1) {
        return structuralFail("InvalidRevision", "receipt/objectRevision", "Structural Evidence receipt revision must match its exact archive ordinal.");
      }
      if (previousReceipt !== undefined && (
        receipt.previousContentHash !== previousReceipt.resultingContentHash
        || receipt.previousEditRevision !== previousReceipt.resultingEditRevision
      )) return structuralFail("InvalidRevision", "receipt", "Structural Evidence receipt chain is discontinuous.");
      if (commandIds.has(receipt.commandId)) return structuralFail("InvalidContract", "receipt/commandId", "Duplicate Structural command ID in archive.");
      commandIds.add(receipt.commandId);
      previousReceipt = receipt;
      ordinal += 1;
    }
    if (segment.endReceiptOrdinalExclusive !== ordinal) return structuralFail("InvalidContract", "segment/endReceiptOrdinalExclusive", "Structural Evidence Segment ordinal mismatch.");
  }
  if (ordinal !== manifest.receiptCount) return structuralFail("InvalidContract", "manifest/receiptCount", "Structural Evidence reachable receipt count mismatch.");
  return deepFreeze({ status: "Ready" as const, commandIds });
};

export async function* streamStructuralEvidenceReceiptsV2(
  manifest: StructuralEvidenceArchiveManifestV2,
  resolver: StructuralEvidenceRecordResolverV2
): AsyncGenerator<StructuralCommandEvidence> {
  const segments: StructuralEvidenceSegmentV2[] = [];
  let next = validateStructuralEvidenceArchiveManifestV2(manifest).headSegmentHash;
  while (next !== null) {
    const segment = await resolveSegment(resolver, next);
    segments.push(segment);
    next = segment.predecessor.kind === "Segment" ? segment.predecessor.hash : null;
  }
  for (const segment of segments.reverse()) for (const receipt of segment.receipts) yield receipt;
}

export async function* exportStructuralEvidenceArchiveV2(
  manifestValue: StructuralEvidenceArchiveManifestV2,
  resolver: StructuralEvidenceRecordResolverV2
): AsyncGenerator<Readonly<{ hash: string; bytes: string }>> {
  const manifest = validateStructuralEvidenceArchiveManifestV2(manifestValue);
  const originBytes = await resolver.resolve(manifest.originHash);
  if (originBytes === null) return structuralFail("InvalidContract", "origin", "Missing Structural Evidence Origin.");
  await resolveOrigin(resolver, manifest.originHash);
  yield deepFreeze({ hash: manifest.originHash, bytes: originBytes });
  const hashes: string[] = [];
  let next = manifest.headSegmentHash;
  while (next !== null) {
    const segment = await resolveSegment(resolver, next);
    hashes.push(segment.segmentHash);
    next = segment.predecessor.kind === "Segment" ? segment.predecessor.hash : null;
  }
  for (const hash of hashes.reverse()) {
    const bytes = await resolver.resolve(hash);
    if (bytes === null) return structuralFail("InvalidContract", "segment", "Missing Structural Evidence Segment.");
    yield deepFreeze({ hash, bytes });
  }
}

export const importStructuralEvidenceArchiveV2 = async (
  records: AsyncIterable<Readonly<{ hash: string; bytes: string }>>,
  store: StructuralEvidenceRecordStoreV2
): Promise<number> => {
  let count = 0;
  for await (const record of records) {
    const parsed = JSON.parse(record.bytes) as unknown;
    const hash = (parsed as { schemaVersion?: unknown }).schemaVersion === STRUCTURAL_EVIDENCE_ORIGIN_SCHEMA_VERSION_V2
      ? validateStructuralEvidenceOriginV2(parsed).originHash
      : validateStructuralEvidenceSegmentV2(parsed).segmentHash;
    if (hash !== record.hash) return structuralFail("InvalidContract", "bundle/hash", "Structural Evidence bundle record hash mismatch.");
    await requireVerifiedPut(store, hash, record.bytes);
    count += 1;
  }
  return count;
};

export const migrateStructuralObjectV1ToV2 = async (
  object: StructuralObject,
  store: StructuralEvidenceRecordStoreV2
): Promise<StructuralObjectV2> => {
  if (object.commandEvidence.length !== object.objectRevision) return structuralFail("InvalidRevision", "object/commandEvidence", "V1 evidence count must equal object revision before migration.");
  const legacyEvidenceBytes = canonicalAdaptiveJson(object.commandEvidence.map(projectStructuralCommandEvidence));
  const origin = createStructuralEvidenceMigrationOriginV2(legacyEvidenceBytes, object.commandEvidence.length);
  const semanticProbe = deepFreeze({
    schemaVersion: STRUCTURAL_OBJECT_SCHEMA_VERSION_V2,
    objectId: object.objectId,
    frame: object.frame,
    source: object.source,
    materials: object.materials,
    bricks: object.bricks,
    anchors: object.anchors,
    joints: object.joints,
    objectRevision: object.objectRevision,
    editRevision: object.editRevision,
    contentHash: object.contentHash,
    evidenceArchive: createStructuralEvidenceArchiveManifestV2(origin.originHash, null, 0)
  }) as StructuralObjectV2;
  if (canonicalAdaptiveJson(projectStructuralObjectContent(semanticProbe)) !== canonicalAdaptiveJson(projectStructuralObjectContent(object))) {
    return structuralFail("InvalidContract", "object/content", "V1 and V2 Structural semantic content projections are incompatible.");
  }
  await requireVerifiedPut(store, origin.originHash, serializeStructuralEvidenceOriginV2(origin));
  let predecessor: StructuralEvidencePredecessorV2 = { kind: "Origin", hash: origin.originHash };
  let headSegmentHash: string | null = null;
  for (let first = 0; first < object.commandEvidence.length; first += STRUCTURAL_EVIDENCE_SEGMENT_MAX_RECEIPTS) {
    const segment = createStructuralEvidenceSegmentV2(
      predecessor,
      first,
      object.commandEvidence.slice(first, first + STRUCTURAL_EVIDENCE_SEGMENT_MAX_RECEIPTS)
    );
    await requireVerifiedPut(store, segment.segmentHash, serializeStructuralEvidenceSegmentV2(segment));
    headSegmentHash = segment.segmentHash;
    predecessor = { kind: "Segment", hash: segment.segmentHash };
  }
  const migrated = deepFreeze({
    ...object,
    schemaVersion: STRUCTURAL_OBJECT_SCHEMA_VERSION_V2,
    evidenceArchive: createStructuralEvidenceArchiveManifestV2(origin.originHash, headSegmentHash, object.commandEvidence.length),
    commandEvidence: undefined,
    evidenceHash: undefined
  }) as unknown as StructuralObjectV2;
  return deepFreeze({
    schemaVersion: migrated.schemaVersion,
    objectId: migrated.objectId,
    frame: migrated.frame,
    source: migrated.source,
    materials: migrated.materials,
    bricks: migrated.bricks,
    anchors: migrated.anchors,
    joints: migrated.joints,
    objectRevision: structuralRevision(migrated.objectRevision, "object/objectRevision"),
    editRevision: structuralRevision(migrated.editRevision, "object/editRevision"),
    contentHash: migrated.contentHash,
    evidenceArchive: migrated.evidenceArchive
  });
};

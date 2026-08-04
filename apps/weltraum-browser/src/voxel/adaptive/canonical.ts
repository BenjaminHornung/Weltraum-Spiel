import {
  adaptiveLevel,
  adaptivePlanningEpoch,
  authorityRevision,
  compareCanonicalCodeUnits,
  deepFreeze,
  fail,
  globalQuantumCoordinate,
  requireCanonicalString,
  requireExactKeys,
  requireDenseDataPropertyArray,
  requireFinite,
  requirePlainRecord,
  stableAuthorityId
} from "./validation";
import { brickExtentQuantumForLevel, compareAdaptiveBrickKeys, quantumBoundsForKey, validateAdaptiveBrickKey, validateQuantumBounds } from "./coordinates";
import { ADAPTIVE_MAX_JOURNAL_RECORDS, createAdaptiveEditJournal, validateAdaptiveEditJournal } from "./edits";
import { hasDeepFrozenIdentity } from "./immutability";
import { validateMaterializedAdaptiveBrick } from "./materialization";
import type {
  AdaptiveBaseFieldDescriptor,
  AdaptiveAuthorityAdoptionCommitment,
  AdaptiveAuthorityAdoptionCommitmentInput,
  AdaptiveAuthorityAdoptionCommitmentPayload,
  AdaptiveAuthorityProtocol,
  AdaptiveAuthoritySnapshot,
  AdaptiveAuthoritySnapshotInput,
  AdaptiveAuthoritySnapshotPayload,
  AdaptiveAuthoritySnapshotBrick,
  AdaptiveBaseFieldSample,
  AdaptiveBrickKey,
  AdaptiveEditRecord,
  AdaptiveEditJournal,
  AdaptivePlannerSnapshot,
  AdaptivePlanResult,
  AdaptiveRefinementReason,
  AdaptiveRefinementRequest,
  AdaptiveResidentValidationProof,
  MaterializedAdaptiveBrick,
  QuantumBounds
} from "./types";
import {
  ADAPTIVE_BASE_FIELD_DESCRIPTOR_DIGEST_SCHEMA_VERSION,
  ADAPTIVE_AUTHORITY_COMMITMENT_SCHEMA_VERSION,
  ADAPTIVE_AUTHORITY_DERIVATION_ALGORITHM_VERSION,
  ADAPTIVE_AUTHORITY_MATERIAL_TABLE_VERSION,
  ADAPTIVE_AUTHORITY_PROTOCOL_SCHEMA_VERSION,
  ADAPTIVE_AUTHORITY_SNAPSHOT_SCHEMA_VERSION,
  ADAPTIVE_RESIDENT_VALIDATION_PROOF_SCHEMA_VERSION,
  ADAPTIVE_RESIDENT_VALIDATION_PROOF_VERSION,
  ADAPTIVE_SNAPSHOT_PROJECTION_SCHEMA_VERSION
} from "./types";

export const ADAPTIVE_MAX_RESIDENT_SUMMARIES = 4_096;
export const ADAPTIVE_MAX_ACTIVE_COVERAGE_ENTRIES = 4_096;
export const ADAPTIVE_MAX_REFINEMENT_REQUESTS = 4_096;
export const ADAPTIVE_MAX_PLAN_ARRAY_ENTRIES = 4_096;
export const ADAPTIVE_MAX_PLAN_AGGREGATE_ENTRIES = 65_536;

export type AdaptiveCanonicalValue =
  | null
  | boolean
  | number
  | string
  | readonly AdaptiveCanonicalValue[]
  | { readonly [key: string]: AdaptiveCanonicalValue };

const canonicalValueByDeepFrozenIdentity = new WeakMap<object, AdaptiveCanonicalValue>();
const serializedCanonicalByIdentity = new WeakMap<object, string>();

const canonicalize = (value: unknown, path: string, ancestors: WeakSet<object>): AdaptiveCanonicalValue => {
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "string") return requireCanonicalString(value, path);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return fail("InvalidCanonicalValue", path, "Non-finite numbers are not canonical.");
    return Object.is(value, -0) ? 0 : value;
  }
  if (typeof value === "function" || typeof value === "symbol" || typeof value === "bigint" || value === undefined) {
    return fail("InvalidCanonicalValue", path, "Unsupported canonical value.");
  }
  const cached = hasDeepFrozenIdentity(value)
    ? canonicalValueByDeepFrozenIdentity.get(value)
    : undefined;
  if (cached !== undefined) return cached;
  if (Array.isArray(value)) {
    if (ancestors.has(value)) return fail("InvalidCanonicalValue", path, "Cycles are not canonical.");
    const array = requireDenseDataPropertyArray(value, path, "InvalidCanonicalValue");
    ancestors.add(value);
    const result = Array.prototype.map.call(
      array,
      (entry: unknown, index: number) => canonicalize(entry, `${path}/${index}`, ancestors)
    ) as AdaptiveCanonicalValue[];
    ancestors.delete(value);
    const canonical = deepFreeze(result);
    if (hasDeepFrozenIdentity(value)) canonicalValueByDeepFrozenIdentity.set(value, canonical);
    return canonical;
  }
  const record = requirePlainRecord(value, path);
  if (ancestors.has(record)) return fail("InvalidCanonicalValue", path, "Cycles are not canonical.");
  ancestors.add(record);
  const result = Object.create(null) as Record<string, AdaptiveCanonicalValue>;
  for (const key of Object.keys(record).sort(compareCanonicalCodeUnits)) {
    result[key] = canonicalize(record[key], `${path}/${key}`, ancestors);
  }
  ancestors.delete(record);
  const canonical = deepFreeze(result);
  if (hasDeepFrozenIdentity(record)) canonicalValueByDeepFrozenIdentity.set(record, canonical);
  return canonical;
};

const serialize = (value: AdaptiveCanonicalValue): string => {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  const cached = serializedCanonicalByIdentity.get(value);
  if (cached !== undefined) return cached;
  const serialized = Array.isArray(value)
    ? `[${value.map(serialize).join(",")}]`
    : `{${Object.keys(value)
      .sort(compareCanonicalCodeUnits)
      .map((key) => `${JSON.stringify(key)}:${serialize((value as Record<string, AdaptiveCanonicalValue>)[key])}`)
      .join(",")}}`;
  serializedCanonicalByIdentity.set(value, serialized);
  return serialized;
};

export const canonicalAdaptiveJson = (value: unknown): string => serialize(canonicalize(value, "", new WeakSet<object>()));

export const hashAdaptiveCanonical = (value: unknown): string => {
  const bytes = new TextEncoder().encode(canonicalAdaptiveJson(value));
  let high = 0xcbf29ce4;
  let low = 0x84222325;
  for (const byte of bytes) {
    low = (low ^ byte) >>> 0;
    const lowProduct = low * 0x1b3;
    const nextLow = lowProduct >>> 0;
    const carry = Math.floor(lowProduct / 0x1_0000_0000);
    const nextHigh = (high * 0x1b3 + carry) >>> 0;
    high = (nextHigh + ((low << 8) >>> 0)) >>> 0;
    low = nextLow;
  }
  return `fnv1a64-v1:${high.toString(16).padStart(8, "0")}${low.toString(16).padStart(8, "0")}`;
};

const validateAdaptiveBaseFieldSample = (value: AdaptiveBaseFieldSample): AdaptiveBaseFieldSample => {
  const record = requirePlainRecord(value, "baseField/sample");
  requireExactKeys(
    record,
    ["density", "occupancy", "materialId", ...(Object.hasOwn(record, "semanticId") ? ["semanticId"] : [])],
    "baseField/sample"
  );
  if (Object.hasOwn(record, "semanticId") && record.semanticId === undefined) {
    return fail("InvalidBaseField", "baseField/sample/semanticId", "Present sample fields may not be undefined.");
  }
  const density = requireFinite(record.density as number, "baseField/sample/density");
  const occupancy = requireFinite(record.occupancy as number, "baseField/sample/occupancy");
  if (occupancy < 0 || occupancy > 1) {
    return fail("InvalidBaseField", "baseField/sample/occupancy", "Occupancy must be in [0, 1].");
  }
  return deepFreeze({
    density,
    occupancy,
    materialId: record.materialId === null
      ? null
      : stableAuthorityId(record.materialId as string, "baseField/sample/materialId"),
    semanticId: record.semanticId === undefined || record.semanticId === null
      ? null
      : stableAuthorityId(record.semanticId as string, "baseField/sample/semanticId")
  });
};

export const validateAdaptiveBaseFieldDescriptor = (
  value: AdaptiveBaseFieldDescriptor
): AdaptiveBaseFieldDescriptor => {
  const record = requirePlainRecord(value, "baseField");
  requireExactKeys(record, ["kind", "identity", "version", "sourceRevision", "sample"], "baseField");
  if (record.kind !== "constant-v1") {
    return fail("InvalidBaseField", "baseField/kind", "Unsupported base-field descriptor kind.");
  }
  return deepFreeze({
    kind: "constant-v1",
    identity: stableAuthorityId(record.identity as string, "baseField/identity"),
    version: stableAuthorityId(record.version as string, "baseField/version"),
    sourceRevision: authorityRevision(record.sourceRevision as number),
    sample: validateAdaptiveBaseFieldSample(record.sample as AdaptiveBaseFieldSample)
  });
};

export const createAdaptiveBaseFieldDescriptor = validateAdaptiveBaseFieldDescriptor;

export const evaluateAdaptiveBaseFieldDescriptor = (
  value: AdaptiveBaseFieldDescriptor
): AdaptiveBaseFieldSample => {
  const descriptor = validateAdaptiveBaseFieldDescriptor(value);
  switch (descriptor.kind) {
    case "constant-v1":
      return descriptor.sample;
    default:
      return fail("InvalidBaseField", "baseField/kind", "Unsupported base-field descriptor kind.");
  }
};

export const hashAdaptiveBaseFieldDescriptor = (value: AdaptiveBaseFieldDescriptor): string =>
  hashAdaptiveCanonical({
    schemaVersion: ADAPTIVE_BASE_FIELD_DESCRIPTOR_DIGEST_SCHEMA_VERSION,
    descriptor: validateAdaptiveBaseFieldDescriptor(value)
  });

export const serializeAdaptiveKey = (key: AdaptiveBrickKey): string => {
  return canonicalAdaptiveJson(validateAdaptiveBrickKey(key));
};

export const serializeAdaptiveEditJournal = (journal: AdaptiveEditJournal): string => {
  return canonicalAdaptiveJson(validateAdaptiveEditJournal(journal));
};

export const serializeMaterializedAdaptiveBrick = (brick: MaterializedAdaptiveBrick): string => {
  return canonicalAdaptiveJson(validateMaterializedAdaptiveBrick(brick));
};

const hashPattern = /^fnv1a64-v1:[0-9a-f]{16}$/;

const requireDenseArray = (value: unknown, path: string, maximumLength?: number): readonly unknown[] =>
  requireDenseDataPropertyArray(value, path, "InvalidPlannerInput", { maximumLength });

const issuedResidentValidationProofs = new WeakSet<object>();

const plannerHash = (value: unknown, path: string): string => {
  if (typeof value !== "string" || !hashPattern.test(value)) {
    return fail("InvalidPlannerInput", path, "Expected a canonical adaptive hash.");
  }
  return value;
};

export const ADAPTIVE_AUTHORITY_PROTOCOL: AdaptiveAuthorityProtocol = deepFreeze({
  schemaVersion: ADAPTIVE_AUTHORITY_PROTOCOL_SCHEMA_VERSION,
  derivationAlgorithmVersion: ADAPTIVE_AUTHORITY_DERIVATION_ALGORITHM_VERSION,
  materialTableVersion: ADAPTIVE_AUTHORITY_MATERIAL_TABLE_VERSION
});

const validateAdaptiveAuthorityProtocol = (value: unknown): AdaptiveAuthorityProtocol => {
  const record = requirePlainRecord(value, "authority/protocol");
  requireExactKeys(record, ["schemaVersion", "derivationAlgorithmVersion", "materialTableVersion"], "authority/protocol");
  if (
    record.schemaVersion !== ADAPTIVE_AUTHORITY_PROTOCOL_SCHEMA_VERSION
    || record.derivationAlgorithmVersion !== ADAPTIVE_AUTHORITY_DERIVATION_ALGORITHM_VERSION
    || record.materialTableVersion !== ADAPTIVE_AUTHORITY_MATERIAL_TABLE_VERSION
  ) return fail("InvalidPlannerInput", "authority/protocol", "Unsupported Adaptive authority protocol or version.");
  return ADAPTIVE_AUTHORITY_PROTOCOL;
};

const canonicalAdaptiveAuthorityBricks = (
  value: unknown,
  path: string
): readonly AdaptiveAuthoritySnapshotBrick[] => {
  const entries = requireDenseDataPropertyArray(value, path, "InvalidPlannerInput", {
    maximumLength: ADAPTIVE_MAX_RESIDENT_SUMMARIES
  }).map((entry, index) => {
    const entryPath = `${path}/${index}`;
    const record = requirePlainRecord(entry, entryPath);
    requireExactKeys(record, ["role", "brick"], entryPath);
    return deepFreeze({
      role: stableAuthorityId(record.role as string, `${entryPath}/role`),
      brick: validateMaterializedAdaptiveBrick(record.brick as MaterializedAdaptiveBrick)
    });
  }).sort((left, right) => compareAdaptiveBrickKeys(left.brick.key, right.brick.key) || compareCanonicalCodeUnits(left.role, right.role));
  for (let index = 1; index < entries.length; index += 1) {
    if (serializeAdaptiveKey(entries[index - 1].brick.key) === serializeAdaptiveKey(entries[index].brick.key)) {
      return fail("InvalidPlannerInput", path, "Adaptive authority brick keys must be unique.");
    }
  }
  return deepFreeze(entries);
};

const validateAdaptiveAuthorityBrickBindings = (
  bricks: readonly AdaptiveAuthoritySnapshotBrick[],
  journal: AdaptiveEditJournal,
  revision: number,
  path: string
): void => {
  const first = bricks[0]?.brick;
  if (first === undefined) return;
  const expectedKey = first.key;
  const expectedProvenance = first.provenance;
  for (let index = 0; index < bricks.length; index += 1) {
    const brick = bricks[index].brick;
    const brickPath = `${path}/${index}/brick`;
    if (
      brick.key.bodyId !== expectedKey.bodyId
      || brick.key.surfaceFrameId !== expectedKey.surfaceFrameId
      || brick.key.regionId !== expectedKey.regionId
      || brick.key.generatorVersion !== expectedKey.generatorVersion
    ) return fail("InvalidPlannerInput", `${brickPath}/key`, "Adaptive authority bricks must share one source tuple.");
    if (
      brick.baseFieldDescriptorDigest !== expectedProvenance.baseFieldDescriptorDigest
      || brick.provenance.baseFieldIdentity !== expectedProvenance.baseFieldIdentity
      || brick.provenance.baseFieldVersion !== expectedProvenance.baseFieldVersion
      || brick.provenance.baseFieldDescriptorDigest !== expectedProvenance.baseFieldDescriptorDigest
      || brick.sourceRevision !== expectedProvenance.sourceRevision
      || brick.provenance.sourceRevision !== expectedProvenance.sourceRevision
      || brick.editRevision !== revision
      || brick.provenance.editRevision !== revision
      || brick.provenance.journalDigest !== journal.digest
    ) return fail("InvalidPlannerInput", brickPath, "Adaptive authority brick provenance does not match the snapshot authority.");
  }
};

const adaptiveAuthoritySnapshotPayload = (
  value: Readonly<{
    readonly authorityId: string;
    readonly revision: number;
    readonly bricks: unknown;
    readonly orderedInputs: unknown;
  }>,
  path: string
): AdaptiveAuthoritySnapshotPayload => {
  const authorityId = stableAuthorityId(value.authorityId, `${path}/authorityId`);
  const revision = authorityRevision(value.revision);
  const bricks = canonicalAdaptiveAuthorityBricks(value.bricks, `${path}/bricks`);
  const inputValues = requireDenseDataPropertyArray(value.orderedInputs, `${path}/orderedInputs`, "InvalidPlannerInput", {
    maximumLength: ADAPTIVE_MAX_JOURNAL_RECORDS
  });
  const journal = createAdaptiveEditJournal(inputValues as readonly AdaptiveEditRecord[]);
  if (journal.revision !== revision) {
    return fail("InvalidPlannerInput", `${path}/revision`, "Adaptive authority revision must equal its ordered input revision.");
  }
  validateAdaptiveAuthorityBrickBindings(bricks, journal, revision, `${path}/bricks`);
  return deepFreeze({
    schemaVersion: ADAPTIVE_AUTHORITY_SNAPSHOT_SCHEMA_VERSION,
    protocol: ADAPTIVE_AUTHORITY_PROTOCOL,
    authorityId,
    revision,
    bricks,
    orderedInputs: journal.records
  });
};

export const validateAdaptiveAuthoritySnapshot = (value: AdaptiveAuthoritySnapshot): AdaptiveAuthoritySnapshot => {
  const record = requirePlainRecord(value, "authority");
  requireExactKeys(record, ["schemaVersion", "protocol", "authorityId", "revision", "bricks", "orderedInputs", "contentHash"], "authority");
  if (record.schemaVersion !== ADAPTIVE_AUTHORITY_SNAPSHOT_SCHEMA_VERSION) {
    return fail("InvalidPlannerInput", "authority/schemaVersion", "Unsupported Adaptive authority snapshot schema.");
  }
  const payload = adaptiveAuthoritySnapshotPayload({
    authorityId: record.authorityId as string,
    revision: record.revision as number,
    bricks: record.bricks,
    orderedInputs: record.orderedInputs
  }, "authority");
  validateAdaptiveAuthorityProtocol(record.protocol);
  const contentHash = plannerHash(record.contentHash, "authority/contentHash");
  if (hashAdaptiveCanonical(payload) !== contentHash) {
    return fail("InvalidPlannerInput", "authority/contentHash", "Adaptive authority snapshot content hash mismatch.");
  }
  return deepFreeze({ ...payload, contentHash });
};

export const createAdaptiveAuthoritySnapshot = (input: AdaptiveAuthoritySnapshotInput): AdaptiveAuthoritySnapshot => {
  const record = requirePlainRecord(input, "authorityInput");
  requireExactKeys(record, ["authorityId", "revision", "bricks", "orderedInputs"], "authorityInput");
  const payload = adaptiveAuthoritySnapshotPayload({
    authorityId: input.authorityId,
    revision: input.revision,
    bricks: input.bricks,
    orderedInputs: input.orderedInputs
  }, "authorityInput");
  return deepFreeze({
    ...payload,
    contentHash: hashAdaptiveCanonical(payload)
  });
};

const adaptiveAuthorityAdoptionPayload = (
  value: AdaptiveAuthorityAdoptionCommitmentPayload | AdaptiveAuthorityAdoptionCommitment
): AdaptiveAuthorityAdoptionCommitmentPayload => ({
  schemaVersion: value.schemaVersion,
  protocol: value.protocol,
  authorityId: value.authorityId,
  predecessorRevision: value.predecessorRevision,
  predecessorHash: value.predecessorHash,
  candidateRevision: value.candidateRevision,
  candidateHash: value.candidateHash
});

export const hashAdaptiveAuthorityAdoptionCommitment = (
  value: AdaptiveAuthorityAdoptionCommitmentPayload | AdaptiveAuthorityAdoptionCommitment
): string => hashAdaptiveCanonical(adaptiveAuthorityAdoptionPayload(value));

const validateAdaptiveAuthorityAdoptionCommitment = (
  value: AdaptiveAuthorityAdoptionCommitment
): AdaptiveAuthorityAdoptionCommitment => {
  const record = requirePlainRecord(value, "adoption");
  requireExactKeys(record, ["schemaVersion", "protocol", "authorityId", "predecessorRevision", "predecessorHash", "candidateRevision", "candidateHash", "commitmentHash"], "adoption");
  if (record.schemaVersion !== ADAPTIVE_AUTHORITY_COMMITMENT_SCHEMA_VERSION) {
    return fail("InvalidPlannerInput", "adoption/schemaVersion", "Unsupported Adaptive authority adoption commitment schema.");
  }
  const protocol = validateAdaptiveAuthorityProtocol(record.protocol);
  const payload = deepFreeze({
    schemaVersion: ADAPTIVE_AUTHORITY_COMMITMENT_SCHEMA_VERSION,
    protocol,
    authorityId: stableAuthorityId(record.authorityId as string, "adoption/authorityId"),
    predecessorRevision: authorityRevision(record.predecessorRevision as number),
    predecessorHash: plannerHash(record.predecessorHash, "adoption/predecessorHash"),
    candidateRevision: authorityRevision(record.candidateRevision as number),
    candidateHash: plannerHash(record.candidateHash, "adoption/candidateHash")
  });
  const commitmentHash = plannerHash(record.commitmentHash, "adoption/commitmentHash");
  if (hashAdaptiveAuthorityAdoptionCommitment(payload) !== commitmentHash) {
    return fail("InvalidPlannerInput", "adoption/commitmentHash", "Adaptive authority adoption commitment hash mismatch.");
  }
  if (payload.candidateRevision !== payload.predecessorRevision + 1) {
    return fail("InvalidPlannerInput", "adoption/candidateRevision", "Adaptive authority adoption must advance exactly one revision.");
  }
  return deepFreeze({ ...payload, commitmentHash });
};

export const createAdaptiveAuthorityAdoptionCommitment = (
  input: AdaptiveAuthorityAdoptionCommitmentInput
): AdaptiveAuthorityAdoptionCommitment => {
  const record = requirePlainRecord(input, "adoptionInput");
  requireExactKeys(record, ["predecessorSnapshot", "candidateSnapshot"], "adoptionInput");
  const predecessor = validateAdaptiveAuthoritySnapshot(input.predecessorSnapshot);
  const candidate = validateAdaptiveAuthoritySnapshot(input.candidateSnapshot);
  if (predecessor.protocol.schemaVersion !== candidate.protocol.schemaVersion
    || predecessor.protocol.derivationAlgorithmVersion !== candidate.protocol.derivationAlgorithmVersion
    || predecessor.protocol.materialTableVersion !== candidate.protocol.materialTableVersion) {
    return fail("InvalidPlannerInput", "adoptionInput", "Adaptive authority snapshots must use one protocol and version tuple.");
  }
  if (candidate.authorityId !== predecessor.authorityId) {
    return fail("InvalidPlannerInput", "adoptionInput/candidateSnapshot/authorityId", "Adaptive authority adoption candidate belongs to a different authority.");
  }
  if (candidate.revision !== predecessor.revision + 1) {
    return fail("InvalidPlannerInput", "adoptionInput/candidateSnapshot/revision", "Adaptive authority adoption must advance exactly one revision.");
  }
  const payload = deepFreeze({
    schemaVersion: ADAPTIVE_AUTHORITY_COMMITMENT_SCHEMA_VERSION,
    protocol: ADAPTIVE_AUTHORITY_PROTOCOL,
    authorityId: predecessor.authorityId,
    predecessorRevision: predecessor.revision,
    predecessorHash: predecessor.contentHash,
    candidateRevision: candidate.revision,
    candidateHash: candidate.contentHash
  });
  return deepFreeze({
    ...payload,
    commitmentHash: hashAdaptiveAuthorityAdoptionCommitment(payload)
  });
};

export const validateAdaptiveAuthorityAdoption = (
  predecessorValue: AdaptiveAuthoritySnapshot,
  candidateValue: AdaptiveAuthoritySnapshot,
  commitmentValue: AdaptiveAuthorityAdoptionCommitment
): AdaptiveAuthorityAdoptionCommitment => {
  const predecessor = validateAdaptiveAuthoritySnapshot(predecessorValue);
  const candidate = validateAdaptiveAuthoritySnapshot(candidateValue);
  const commitment = validateAdaptiveAuthorityAdoptionCommitment(commitmentValue);
  if (
    candidate.orderedInputs.length !== predecessor.orderedInputs.length + 1
    || canonicalAdaptiveJson(candidate.orderedInputs.slice(0, predecessor.orderedInputs.length))
      !== canonicalAdaptiveJson(predecessor.orderedInputs)
  ) return fail("InvalidPlannerInput", "adoption/candidate/orderedInputs", "Adaptive authority adoption history must extend the predecessor by exactly one input.");
  if (
    candidate.bricks.length !== predecessor.bricks.length
    || candidate.bricks.some((entry, index) =>
      entry.role !== predecessor.bricks[index]?.role
      || serializeAdaptiveKey(entry.brick.key) !== serializeAdaptiveKey(predecessor.bricks[index]?.brick.key as AdaptiveBrickKey)
    )
  ) return fail("InvalidPlannerInput", "adoption/candidate/bricks", "Adaptive authority adoption candidate must preserve the predecessor brick role and key set.");
  if (
    candidate.authorityId !== predecessor.authorityId
    || candidate.revision !== predecessor.revision + 1
    || commitment.authorityId !== predecessor.authorityId
    || commitment.predecessorRevision !== predecessor.revision
    || commitment.predecessorHash !== predecessor.contentHash
    || commitment.candidateRevision !== candidate.revision
    || commitment.candidateHash !== candidate.contentHash
    || commitment.protocol.schemaVersion !== predecessor.protocol.schemaVersion
    || commitment.protocol.schemaVersion !== candidate.protocol.schemaVersion
    || commitment.protocol.derivationAlgorithmVersion !== predecessor.protocol.derivationAlgorithmVersion
    || commitment.protocol.derivationAlgorithmVersion !== candidate.protocol.derivationAlgorithmVersion
    || commitment.protocol.materialTableVersion !== predecessor.protocol.materialTableVersion
    || commitment.protocol.materialTableVersion !== candidate.protocol.materialTableVersion
  ) return fail("InvalidPlannerInput", "adoption", "Adaptive authority adoption does not match the predecessor, candidate, or protocol authority.");
  return commitment;
};

const plannerNonNegativeInteger = (value: unknown, path: string): number => {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || Object.is(value, -0) || value < 0) {
    return fail("InvalidPlannerInput", path, "Expected a non-negative safe integer.");
  }
  return value;
};

const copyCanonicalRecord = (value: unknown, path: string): Record<string, AdaptiveCanonicalValue> => {
  const canonical = canonicalize(value, path, new WeakSet<object>());
  if (canonical === null || Array.isArray(canonical) || typeof canonical !== "object") {
    return fail("InvalidPlannerInput", path, "Expected a canonical record.");
  }
  return canonical as Record<string, AdaptiveCanonicalValue>;
};

/**
 * Canonical, non-circular planner input projection. Validation proofs and every
 * proof-derived digest are deliberately omitted.
 */
export const createAdaptivePlannerSnapshotProjection = (snapshot: AdaptivePlannerSnapshot) => {
  const record = requirePlainRecord(snapshot, "snapshot");
  requireExactKeys(record, ["schemaVersion", "bodyId", "surfaceFrameId", "regionId", "generatorVersion", "authority", "planningEpoch", "resident", "activeCoverage", "refinementRequests", "budgets"], "snapshot");
  if (record.schemaVersion !== "adaptive-microvoxel-planner-snapshot-v1") {
    return fail("InvalidPlannerInput", "snapshot/schemaVersion", "Unsupported planner snapshot schema.");
  }
  const bodyId = stableAuthorityId(record.bodyId as string, "snapshot/bodyId");
  const surfaceFrameId = stableAuthorityId(record.surfaceFrameId as string, "snapshot/surfaceFrameId");
  const regionId = stableAuthorityId(record.regionId as string, "snapshot/regionId");
  const generatorVersion = stableAuthorityId(record.generatorVersion as string, "snapshot/generatorVersion");
  const planningEpoch = adaptivePlanningEpoch(record.planningEpoch as number);

  const authorityRecord = requirePlainRecord(record.authority, "snapshot/authority");
  requireExactKeys(authorityRecord, ["schemaVersion", "baseField", "editJournal", "brickRevision"], "snapshot/authority");
  if (authorityRecord.schemaVersion !== "adaptive-microvoxel-planner-authority-v1") {
    return fail("InvalidPlannerInput", "snapshot/authority/schemaVersion", "Unsupported planner authority schema.");
  }
  const baseField = validateAdaptiveBaseFieldDescriptor(authorityRecord.baseField as AdaptiveBaseFieldDescriptor);
  const editJournal = validateAdaptiveEditJournal(authorityRecord.editJournal as AdaptiveEditJournal);
  const brickRevision = authorityRevision(authorityRecord.brickRevision as number);
  const baseFieldDescriptorDigest = hashAdaptiveBaseFieldDescriptor(baseField);

  const readinessValues = new Set(["ready", "stale", "invalid", "incomplete", "cancelled"]);
  const residents = requireDenseArray(record.resident, "snapshot/resident", ADAPTIVE_MAX_RESIDENT_SUMMARIES).map((value, index) => {
    const path = `snapshot/resident/${index}`;
    const entry = requirePlainRecord(value, path);
    const hasProof = Object.hasOwn(entry, "validationProof");
    requireExactKeys(entry, ["key", "readiness", "byteSize", "work", "contentHash", "provenanceHash", "baseFieldDescriptorDigest", "journalDigest", "sourceRevision", "editRevision", "brickRevision", ...(hasProof ? ["validationProof"] : [])], path);
    if (typeof entry.readiness !== "string" || !readinessValues.has(entry.readiness)) {
      return fail("InvalidPlannerInput", `${path}/readiness`, "Unsupported resident readiness.");
    }
    if (entry.readiness !== "ready" && hasProof) {
      return fail("InvalidPlannerInput", `${path}/validationProof`, "Only ready residency may carry a validation proof.");
    }
    const key = validateAdaptiveBrickKey(entry.key);
    if (key.bodyId !== bodyId || key.surfaceFrameId !== surfaceFrameId || key.regionId !== regionId || key.generatorVersion !== generatorVersion) {
      return fail("InvalidPlannerInput", `${path}/key`, "Resident key does not belong to the snapshot authority.");
    }
    return deepFreeze({
      key,
      readiness: entry.readiness,
      byteSize: plannerNonNegativeInteger(entry.byteSize, `${path}/byteSize`),
      work: plannerNonNegativeInteger(entry.work, `${path}/work`),
      contentHash: plannerHash(entry.contentHash, `${path}/contentHash`),
      provenanceHash: plannerHash(entry.provenanceHash, `${path}/provenanceHash`),
      baseFieldDescriptorDigest: plannerHash(entry.baseFieldDescriptorDigest, `${path}/baseFieldDescriptorDigest`),
      journalDigest: plannerHash(entry.journalDigest, `${path}/journalDigest`),
      sourceRevision: authorityRevision(entry.sourceRevision as number),
      editRevision: authorityRevision(entry.editRevision as number),
      brickRevision: authorityRevision(entry.brickRevision as number)
    });
  }).sort((left, right) => compareAdaptiveBrickKeys(left.key, right.key));
  for (let index = 1; index < residents.length; index += 1) {
    if (canonicalAdaptiveJson(residents[index - 1].key) === canonicalAdaptiveJson(residents[index].key)) {
      return fail("InvalidPlannerInput", "snapshot/resident", "Duplicate resident keys are rejected.");
    }
  }

  const activeCoverage = requireDenseArray(record.activeCoverage, "snapshot/activeCoverage", ADAPTIVE_MAX_ACTIVE_COVERAGE_ENTRIES).map((value, index) => {
    const path = `snapshot/activeCoverage/${index}`;
    const entry = requirePlainRecord(value, path);
    requireExactKeys(entry, ["bounds", "key", "kind"], path);
    if (entry.kind !== "selected" && entry.kind !== "fallback") return fail("InvalidPlannerInput", `${path}/kind`, "Unsupported coverage kind.");
    return deepFreeze({ bounds: validateQuantumBounds(entry.bounds, `${path}/bounds`), key: validateAdaptiveBrickKey(entry.key), kind: entry.kind });
  }).sort((left, right) => compareCanonicalCodeUnits(canonicalAdaptiveJson(left), canonicalAdaptiveJson(right)));

  const refinementRequests = requireDenseArray(record.refinementRequests, "snapshot/refinementRequests", ADAPTIVE_MAX_REFINEMENT_REQUESTS)
    .map((value, index) => copyCanonicalRecord(value, `snapshot/refinementRequests/${index}`))
    .sort((left, right) => compareCanonicalCodeUnits(canonicalAdaptiveJson(left), canonicalAdaptiveJson(right)));
  const budgetsRecord = requirePlainRecord(record.budgets, "snapshot/budgets");
  requireExactKeys(budgetsRecord, ["maxBricks", "maxBytes", "maxWork", "maxCoverageQuantum"], "snapshot/budgets");
  const budgets = deepFreeze({
    maxBricks: plannerNonNegativeInteger(budgetsRecord.maxBricks, "snapshot/budgets/maxBricks"),
    maxBytes: plannerNonNegativeInteger(budgetsRecord.maxBytes, "snapshot/budgets/maxBytes"),
    maxWork: plannerNonNegativeInteger(budgetsRecord.maxWork, "snapshot/budgets/maxWork"),
    maxCoverageQuantum: plannerNonNegativeInteger(budgetsRecord.maxCoverageQuantum, "snapshot/budgets/maxCoverageQuantum")
  });
  return deepFreeze({
    schemaVersion: ADAPTIVE_SNAPSHOT_PROJECTION_SCHEMA_VERSION,
    authority: deepFreeze({
      schemaVersion: "adaptive-microvoxel-planner-authority-v1" as const,
      bodyId,
      surfaceFrameId,
      regionId,
      generatorVersion,
      baseField,
      baseFieldDescriptorDigest,
      editJournal,
      journalDigest: editJournal.digest,
      sourceRevision: baseField.sourceRevision,
      editRevision: editJournal.revision,
      brickRevision,
      planningEpoch
    }),
    resident: deepFreeze(residents),
    activeCoverage: deepFreeze(activeCoverage),
    refinementRequests: deepFreeze(refinementRequests),
    budgets
  });
};

export const hashAdaptivePlannerSnapshotProjection = (snapshot: AdaptivePlannerSnapshot): string =>
  hashAdaptiveCanonical(createAdaptivePlannerSnapshotProjection(snapshot));

const semanticAxes = ["x", "y", "z"] as const;
const refinementReasons = new Set<AdaptiveRefinementReason>([
  "Inspection", "PlayerProximity", "CollisionRequired", "ToolInteraction", "Explosion", "ProjectileImpact", "MeteorImpact", "StructuralFracture"
]);

const semanticSafeSpan = (min: number, max: number, path: string): number => {
  const result = max - min;
  if (!Number.isSafeInteger(result) || result <= 0) return fail("InvalidPlannerInput", path, "Planner bounds arithmetic exceeded safe integers.");
  return result;
};

const semanticSafeProduct = (values: readonly number[], path: string): number => {
  let result = 1;
  for (const value of values) {
    if (!Number.isSafeInteger(value) || value < 0) return fail("InvalidPlannerInput", path, "Planner arithmetic exceeded safe integers.");
    result *= value;
    if (!Number.isSafeInteger(result)) return fail("InvalidPlannerInput", path, "Planner arithmetic exceeded safe integers.");
  }
  return result;
};

const alignedSphereBound = (center: number, radius: number, extent: number, edge: "min" | "max", path: string): number => {
  const offset = edge === "min" ? center - radius : center + radius;
  if (!Number.isSafeInteger(offset)) return fail("InvalidPlannerInput", path, "Sphere bound arithmetic must remain within safe integers.");
  const aligned = (edge === "min" ? Math.floor(offset / extent) : Math.ceil(offset / extent)) * extent;
  if (!Number.isSafeInteger(aligned)) return fail("InvalidPlannerInput", path, "Aligned sphere bounds must remain within safe integers.");
  return globalQuantumCoordinate(aligned, path);
};

export interface AdaptiveValidatedRefinementRequest {
  readonly request: AdaptiveRefinementRequest;
  readonly bounds: QuantumBounds;
  readonly count: number;
}

export const validateAdaptiveRefinementRequest = (
  value: AdaptiveRefinementRequest,
  index: number,
  pathRoot = "snapshot/refinementRequests"
): AdaptiveValidatedRefinementRequest => {
  const path = `${pathRoot}/${index}`;
  const record = requirePlainRecord(value, path);
  const optionalDeadline = Object.hasOwn(record, "deadlinePlanningEpoch") ? ["deadlinePlanningEpoch"] : [];
  requireExactKeys(record, ["requestId", "region", "targetLevel", "reason", "requiredForCoverage", ...optionalDeadline, "priority"], path);
  const requestId = stableAuthorityId(value.requestId, `${path}/requestId`);
  const targetLevel = adaptiveLevel(value.targetLevel, `${path}/targetLevel`);
  if (!refinementReasons.has(value.reason)) return fail("InvalidPlannerInput", `${path}/reason`, "Unsupported refinement reason.");
  if (typeof value.requiredForCoverage !== "boolean") return fail("InvalidPlannerInput", `${path}/requiredForCoverage`, "Coverage requirement must be boolean.");
  if (!Number.isFinite(value.priority)) return fail("InvalidPlannerInput", `${path}/priority`, "Priority must be finite.");
  const deadlinePlanningEpoch = value.deadlinePlanningEpoch === undefined
    ? undefined
    : adaptivePlanningEpoch(value.deadlinePlanningEpoch, `${path}/deadlinePlanningEpoch`);
  const regionRecord = requirePlainRecord(value.region, `${path}/region`);
  const extent = brickExtentQuantumForLevel(targetLevel);
  let bounds: QuantumBounds;
  let region: AdaptiveRefinementRequest["region"];
  if (regionRecord.kind === "aabb") {
    requireExactKeys(regionRecord, ["kind", "bounds"], `${path}/region`);
    bounds = validateQuantumBounds(regionRecord.bounds, `${path}/region/bounds`);
    for (const axis of semanticAxes) if (bounds.min[axis] % extent !== 0 || bounds.max[axis] % extent !== 0) {
      return fail("InvalidPlannerInput", `${path}/region/bounds/${axis}`, "AABB coverage must align to target bricks.");
    }
    region = { kind: "aabb", bounds };
  } else if (regionRecord.kind === "sphere") {
    requireExactKeys(regionRecord, ["kind", "center", "radiusQuantum"], `${path}/region`);
    const centerRecord = requirePlainRecord(regionRecord.center, `${path}/region/center`);
    requireExactKeys(centerRecord, ["x", "y", "z"], `${path}/region/center`);
    const center = deepFreeze({
      x: globalQuantumCoordinate(centerRecord.x as number, `${path}/region/center/x`),
      y: globalQuantumCoordinate(centerRecord.y as number, `${path}/region/center/y`),
      z: globalQuantumCoordinate(centerRecord.z as number, `${path}/region/center/z`)
    });
    const radius = globalQuantumCoordinate(regionRecord.radiusQuantum as number, `${path}/region/radiusQuantum`);
    if (radius <= 0) return fail("InvalidPlannerInput", `${path}/region/radiusQuantum`, "Sphere radius must be positive.");
    bounds = validateQuantumBounds({
      min: {
        x: alignedSphereBound(center.x, radius, extent, "min", `${path}/region/sphereBounds/min/x`),
        y: alignedSphereBound(center.y, radius, extent, "min", `${path}/region/sphereBounds/min/y`),
        z: alignedSphereBound(center.z, radius, extent, "min", `${path}/region/sphereBounds/min/z`)
      },
      max: {
        x: alignedSphereBound(center.x, radius, extent, "max", `${path}/region/sphereBounds/max/x`),
        y: alignedSphereBound(center.y, radius, extent, "max", `${path}/region/sphereBounds/max/y`),
        z: alignedSphereBound(center.z, radius, extent, "max", `${path}/region/sphereBounds/max/z`)
      }
    }, `${path}/region/sphereBounds`);
    region = { kind: "sphere", center, radiusQuantum: radius };
  } else {
    return fail("InvalidPlannerInput", `${path}/region/kind`, "Refinement region must be an aabb or sphere.");
  }
  const count = semanticSafeProduct(semanticAxes.map((axis) => semanticSafeSpan(bounds.min[axis], bounds.max[axis], `${path}/region/${axis}`) / extent), `${path}/region`);
  const request = deepFreeze({ requestId, region, targetLevel, reason: value.reason, requiredForCoverage: value.requiredForCoverage, ...(deadlinePlanningEpoch === undefined ? {} : { deadlinePlanningEpoch }), priority: value.priority });
  return deepFreeze({ request, bounds, count });
};

const validateIssuedResidentProof = (
  value: unknown,
  residentPath: string,
  projectionResident: ReturnType<typeof createAdaptivePlannerSnapshotProjection>["resident"][number],
  projection: ReturnType<typeof createAdaptivePlannerSnapshotProjection>,
  snapshotProjectionDigest: string
): void => {
  const path = `${residentPath}/validationProof`;
  if (typeof value !== "object" || value === null || !issuedResidentValidationProofs.has(value)) {
    return fail("InvalidPlannerInput", path, "Resident validation proof was not issued by the trusted constructor.");
  }
  const proof = requirePlainRecord(value, path);
  requireExactKeys(proof, ["schemaVersion", "proofVersion", "key", "contentHash", "provenanceHash", "baseFieldDescriptorDigest", "journalDigest", "sourceRevision", "editRevision", "brickRevision", "planningEpoch", "snapshotProjectionDigest", "proofDigest"], path);
  if (proof.schemaVersion !== ADAPTIVE_RESIDENT_VALIDATION_PROOF_SCHEMA_VERSION || proof.proofVersion !== ADAPTIVE_RESIDENT_VALIDATION_PROOF_VERSION) {
    return fail("InvalidPlannerInput", path, "Unsupported resident validation proof schema or version.");
  }
  const proofKey = validateAdaptiveBrickKey(proof.key);
  const payload = {
    schemaVersion: ADAPTIVE_RESIDENT_VALIDATION_PROOF_SCHEMA_VERSION,
    proofVersion: ADAPTIVE_RESIDENT_VALIDATION_PROOF_VERSION,
    key: proofKey,
    contentHash: plannerHash(proof.contentHash, `${path}/contentHash`),
    provenanceHash: plannerHash(proof.provenanceHash, `${path}/provenanceHash`),
    baseFieldDescriptorDigest: plannerHash(proof.baseFieldDescriptorDigest, `${path}/baseFieldDescriptorDigest`),
    journalDigest: plannerHash(proof.journalDigest, `${path}/journalDigest`),
    sourceRevision: plannerNonNegativeInteger(proof.sourceRevision, `${path}/sourceRevision`),
    editRevision: plannerNonNegativeInteger(proof.editRevision, `${path}/editRevision`),
    brickRevision: plannerNonNegativeInteger(proof.brickRevision, `${path}/brickRevision`),
    planningEpoch: plannerNonNegativeInteger(proof.planningEpoch, `${path}/planningEpoch`),
    snapshotProjectionDigest: plannerHash(proof.snapshotProjectionDigest, `${path}/snapshotProjectionDigest`)
  };
  const authority = projection.authority;
  if (
    canonicalAdaptiveJson(payload.key) !== canonicalAdaptiveJson(projectionResident.key) ||
    payload.contentHash !== projectionResident.contentHash ||
    payload.provenanceHash !== projectionResident.provenanceHash ||
    payload.baseFieldDescriptorDigest !== projectionResident.baseFieldDescriptorDigest ||
    payload.journalDigest !== projectionResident.journalDigest ||
    payload.sourceRevision !== projectionResident.sourceRevision ||
    payload.editRevision !== projectionResident.editRevision ||
    payload.brickRevision !== projectionResident.brickRevision ||
    payload.baseFieldDescriptorDigest !== authority.baseFieldDescriptorDigest ||
    payload.journalDigest !== authority.journalDigest ||
    payload.sourceRevision !== authority.sourceRevision ||
    payload.editRevision !== authority.editRevision ||
    payload.brickRevision !== authority.brickRevision ||
    payload.planningEpoch !== authority.planningEpoch ||
    payload.snapshotProjectionDigest !== snapshotProjectionDigest ||
    hashAdaptiveCanonical(payload) !== plannerHash(proof.proofDigest, `${path}/proofDigest`)
  ) return fail("InvalidPlannerInput", path, "Resident validation proof does not match the exact snapshot authority projection.");
};

export interface ValidateAdaptivePlannerSnapshotSemanticsOptions {
  readonly allowProoflessReadyResidents?: boolean;
}

/** Shared complete semantic gate used by both proof issuance and planning. */
export const validateAdaptivePlannerSnapshotSemantics = (
  snapshot: AdaptivePlannerSnapshot,
  options: ValidateAdaptivePlannerSnapshotSemanticsOptions = {}
) => {
  const projection = createAdaptivePlannerSnapshotProjection(snapshot);
  const snapshotProjectionDigest = hashAdaptiveCanonical(projection);

  for (let index = 0; index < snapshot.resident.length; index += 1) {
    const entry = snapshot.resident[index];
    const path = `snapshot/resident/${index}`;
    const projected = projection.resident.find((candidate) => canonicalAdaptiveJson(candidate.key) === canonicalAdaptiveJson(entry.key));
    if (projected === undefined) return fail("InvalidPlannerInput", `${path}/key`, "Resident key is absent from the canonical snapshot projection.");
    const hasProof = Object.hasOwn(entry, "validationProof");
    if (entry.readiness === "ready" && !hasProof && options.allowProoflessReadyResidents !== true) {
      return fail("InvalidPlannerInput", `${path}/validationProof`, "Ready residency requires a validation proof.");
    }
    if (hasProof) validateIssuedResidentProof(entry.validationProof, path, projected, projection, snapshotProjectionDigest);
  }

  for (let index = 0; index < snapshot.activeCoverage.length; index += 1) {
    const path = `snapshot/activeCoverage/${index}`;
    const entry = snapshot.activeCoverage[index];
    const key = validateAdaptiveBrickKey(entry.key);
    if (key.bodyId !== projection.authority.bodyId || key.surfaceFrameId !== projection.authority.surfaceFrameId || key.regionId !== projection.authority.regionId || key.generatorVersion !== projection.authority.generatorVersion) {
      return fail("InvalidPlannerInput", `${path}/key`, "Brick identity does not belong to the planner snapshot region.");
    }
    if (canonicalAdaptiveJson(validateQuantumBounds(entry.bounds, `${path}/bounds`)) !== canonicalAdaptiveJson(quantumBoundsForKey(key))) {
      return fail("InvalidPlannerInput", `${path}/bounds`, "Active coverage bounds must exactly match its key.");
    }
  }

  const refinementRequests = (
    requireDenseArray(
      snapshot.refinementRequests,
      "snapshot/refinementRequests",
      ADAPTIVE_MAX_REFINEMENT_REQUESTS
    ) as readonly AdaptiveRefinementRequest[]
  ).map((value, index) => validateAdaptiveRefinementRequest(value, index));
  const requestIds = new Set<string>();
  for (const { request } of refinementRequests) {
    if (requestIds.has(request.requestId)) return fail("InvalidPlannerInput", "snapshot/refinementRequests", "Duplicate request IDs are rejected.");
    requestIds.add(request.requestId);
  }

  return deepFreeze({ projection, snapshotProjectionDigest, refinementRequests, budgets: projection.budgets });
};

export interface CreateAdaptiveResidentValidationProofInput {
  readonly brick: MaterializedAdaptiveBrick;
  readonly brickRevision: number;
  readonly snapshot: AdaptivePlannerSnapshot;
}

const issueAdaptiveResidentValidationProof = (
  value: MaterializedAdaptiveBrick,
  revisionValue: number,
  projection: ReturnType<typeof createAdaptivePlannerSnapshotProjection>,
  snapshotProjectionDigest: string
): AdaptiveResidentValidationProof => {
  const brick = validateMaterializedAdaptiveBrick(value);
  const brickRevision = authorityRevision(revisionValue);
  const expected = projection.resident.find((entry) => canonicalAdaptiveJson(entry.key) === canonicalAdaptiveJson(brick.key));
  if (expected === undefined || expected.readiness !== "ready") {
    return fail("InvalidPlannerInput", "proof/brick", "Validated brick must have one ready resident summary in the snapshot projection.");
  }
  const authority = projection.authority;
  if (
    expected.contentHash !== brick.contentHash ||
    expected.provenanceHash !== brick.provenance.provenanceHash ||
    expected.baseFieldDescriptorDigest !== brick.baseFieldDescriptorDigest ||
    expected.journalDigest !== brick.provenance.journalDigest ||
    expected.sourceRevision !== brick.sourceRevision ||
    expected.editRevision !== brick.editRevision ||
    expected.brickRevision !== brickRevision ||
    authority.baseFieldDescriptorDigest !== brick.baseFieldDescriptorDigest ||
    authority.journalDigest !== brick.provenance.journalDigest ||
    authority.sourceRevision !== brick.sourceRevision ||
    authority.editRevision !== brick.editRevision ||
    authority.brickRevision !== brickRevision
  ) {
    return fail("InvalidPlannerInput", "proof/brick", "Materialized brick does not match the projected resident and authority context.");
  }
  const payload = {
    schemaVersion: ADAPTIVE_RESIDENT_VALIDATION_PROOF_SCHEMA_VERSION,
    proofVersion: ADAPTIVE_RESIDENT_VALIDATION_PROOF_VERSION,
    key: brick.key,
    contentHash: brick.contentHash,
    provenanceHash: brick.provenance.provenanceHash,
    baseFieldDescriptorDigest: brick.baseFieldDescriptorDigest,
    journalDigest: brick.provenance.journalDigest,
    sourceRevision: brick.sourceRevision,
    editRevision: brick.editRevision,
    brickRevision,
    planningEpoch: authority.planningEpoch,
    snapshotProjectionDigest
  };
  const proof = deepFreeze({
    ...payload,
    proofDigest: hashAdaptiveCanonical(payload)
  }) as unknown as AdaptiveResidentValidationProof;
  issuedResidentValidationProofs.add(proof as object);
  return proof;
};

export const createAdaptiveResidentValidationProof = ({ brick, brickRevision, snapshot }: CreateAdaptiveResidentValidationProofInput): AdaptiveResidentValidationProof => {
  const { projection, snapshotProjectionDigest } = validateAdaptivePlannerSnapshotSemantics(snapshot, { allowProoflessReadyResidents: true });
  return issueAdaptiveResidentValidationProof(brick, brickRevision, projection, snapshotProjectionDigest);
};

export interface CreateAdaptiveResidentValidationProofsInput {
  readonly bricks: readonly MaterializedAdaptiveBrick[];
  readonly brickRevision: number;
  readonly snapshot: AdaptivePlannerSnapshot;
}

/** Issues several proofs against one exact projection without recomputing it per resident. */
export const createAdaptiveResidentValidationProofs = ({ bricks, brickRevision, snapshot }: CreateAdaptiveResidentValidationProofsInput): readonly AdaptiveResidentValidationProof[] => {
  const proofBricks = requireDenseArray(bricks, "proofs/bricks", ADAPTIVE_MAX_RESIDENT_SUMMARIES) as readonly MaterializedAdaptiveBrick[];
  const { projection, snapshotProjectionDigest } = validateAdaptivePlannerSnapshotSemantics(snapshot, { allowProoflessReadyResidents: true });
  return deepFreeze(proofBricks.map((brick) => issueAdaptiveResidentValidationProof(brick, brickRevision, projection, snapshotProjectionDigest)));
};

export const hasAdaptiveResidentValidationProofBrand = (value: unknown): value is AdaptiveResidentValidationProof =>
  typeof value === "object" && value !== null && issuedResidentValidationProofs.has(value);

const validatePlanKeyArray = (value: unknown, path: string): readonly AdaptiveBrickKey[] =>
  requireDenseArray(value, path).map((entry) => validateAdaptiveBrickKey(entry));

const validatePlanCoverage = (value: unknown, path: string) =>
  requireDenseArray(value, path).map((entry, index) => {
    const entryPath = `${path}/${index}`;
    const record = requirePlainRecord(entry, entryPath);
    requireExactKeys(record, ["bounds", "key", "kind"], entryPath);
    if (record.kind !== "selected" && record.kind !== "fallback") {
      return fail("InvalidPlannerInput", `${entryPath}/kind`, "Unsupported coverage kind.");
    }
    return deepFreeze({
      bounds: validateQuantumBounds(record.bounds, `${entryPath}/bounds`),
      key: validateAdaptiveBrickKey(record.key),
      kind: record.kind
    });
  });

const validatePlanReasons = (value: unknown, path: string): readonly string[] =>
  requireDenseArray(value, path).map((entry, index) => {
    if (typeof entry !== "string") return fail("InvalidPlannerInput", `${path}/${index}`, "Plan reasons must be strings.");
    return requireCanonicalString(entry, `${path}/${index}`);
  });

const preflightAdaptivePlanArrayLimits = (record: Record<string, unknown>): void => {
  let aggregateEntries = 0;
  const account = (value: unknown, path: string): readonly unknown[] => {
    const entries = requireDenseArray(value, path, ADAPTIVE_MAX_PLAN_ARRAY_ENTRIES);
    if (entries.length > ADAPTIVE_MAX_PLAN_AGGREGATE_ENTRIES - aggregateEntries) {
      return fail(
        "InvalidPlannerInput",
        path,
        `Plan array aggregate exceeds the finite limit ${ADAPTIVE_MAX_PLAN_AGGREGATE_ENTRIES}.`
      );
    }
    aggregateEntries += entries.length;
    return entries;
  };

  for (const field of [
    "desired",
    "keep",
    "materialize",
    "evict",
    "coverage",
    "reasons",
    "desiredKeys",
    "keepKeys",
    "materializeRequests",
    "evictCandidates",
    "parentFallbackKeys",
    "deterministicReasons"
  ] as const) {
    account(record[field], `plan/${field}`);
  }

  const fallback = account(record.fallback, "plan/fallback");
  for (let index = 0; index < fallback.length; index += 1) {
    const path = `plan/fallback/${index}`;
    const entry = requirePlainRecord(fallback[index], path);
    requireExactKeys(entry, ["ancestor", "requiredChildren", "coverage"], path);
    account(entry.requiredChildren, `${path}/requiredChildren`);
  }

  const coverageStatus = requirePlainRecord(record.coverageStatus, "plan/coverageStatus");
  requireExactKeys(coverageStatus, ["coverage", "complete", "uncoveredRequiredKeyCount"], "plan/coverageStatus");
  account(coverageStatus.coverage, "plan/coverageStatus/coverage");
};

/** Cycle-safe structural validator for already-produced refinement plans. */
export const validateAdaptivePlanResult = (plan: AdaptivePlanResult): AdaptivePlanResult => {
  const record = requirePlainRecord(plan, "plan");
  const shared = ["schemaVersion", "status", "desired", "keep", "materialize", "evict", "fallback", "coverage", "reasons", "desiredKeys", "keepKeys", "materializeRequests", "evictCandidates", "parentFallbackKeys", "coverageStatus", "deterministicReasons", "snapshotProjectionDigest", "planHash"];
  requireExactKeys(record, record.status === "accepted" ? shared : [...shared, "code", "budget", "required", "limit"], "plan");
  if (record.schemaVersion !== "adaptive-microvoxel-plan-v1" || (record.status !== "accepted" && record.status !== "rejected")) {
    return fail("InvalidPlannerInput", "plan", "Unsupported plan schema or status.");
  }
  preflightAdaptivePlanArrayLimits(record);
  const desired = validatePlanKeyArray(record.desired, "plan/desired");
  const keep = validatePlanKeyArray(record.keep, "plan/keep");
  const materialize = validatePlanKeyArray(record.materialize, "plan/materialize");
  const evict = validatePlanKeyArray(record.evict, "plan/evict");
  const fallback = requireDenseArray(record.fallback, "plan/fallback").map((entry, index) => {
    const path = `plan/fallback/${index}`;
    const fallbackRecord = requirePlainRecord(entry, path);
    requireExactKeys(fallbackRecord, ["ancestor", "requiredChildren", "coverage"], path);
    return deepFreeze({
      ancestor: validateAdaptiveBrickKey(fallbackRecord.ancestor),
      requiredChildren: validatePlanKeyArray(fallbackRecord.requiredChildren, `${path}/requiredChildren`),
      coverage: validateQuantumBounds(fallbackRecord.coverage, `${path}/coverage`)
    });
  });
  const coverage = validatePlanCoverage(record.coverage, "plan/coverage");
  const reasons = validatePlanReasons(record.reasons, "plan/reasons");
  const desiredKeys = validatePlanKeyArray(record.desiredKeys, "plan/desiredKeys");
  const keepKeys = validatePlanKeyArray(record.keepKeys, "plan/keepKeys");
  const materializeRequests = validatePlanKeyArray(record.materializeRequests, "plan/materializeRequests");
  const evictCandidates = validatePlanKeyArray(record.evictCandidates, "plan/evictCandidates");
  const parentFallbackKeys = validatePlanKeyArray(record.parentFallbackKeys, "plan/parentFallbackKeys");
  const deterministicReasons = validatePlanReasons(record.deterministicReasons, "plan/deterministicReasons");
  const snapshotProjectionDigest = plannerHash(record.snapshotProjectionDigest, "plan/snapshotProjectionDigest");
  const coverageStatusRecord = requirePlainRecord(record.coverageStatus, "plan/coverageStatus");
  requireExactKeys(coverageStatusRecord, ["coverage", "complete", "uncoveredRequiredKeyCount"], "plan/coverageStatus");
  const statusCoverage = validatePlanCoverage(coverageStatusRecord.coverage, "plan/coverageStatus/coverage");
  if (typeof coverageStatusRecord.complete !== "boolean") {
    return fail("InvalidPlannerInput", "plan/coverageStatus", "Malformed coverage status.");
  }
  const uncoveredRequiredKeyCount = plannerNonNegativeInteger(coverageStatusRecord.uncoveredRequiredKeyCount, "plan/coverageStatus/uncoveredRequiredKeyCount");
  if (typeof record.planHash !== "string" || !hashPattern.test(record.planHash)) {
    return fail("InvalidPlannerInput", "plan/planHash", "Malformed plan hash.");
  }
  const commonPayload = {
    schemaVersion: "adaptive-microvoxel-plan-v1" as const,
    status: record.status,
    desired,
    keep,
    materialize,
    evict,
    fallback,
    coverage,
    reasons,
    desiredKeys,
    keepKeys,
    materializeRequests,
    evictCandidates,
    parentFallbackKeys,
    coverageStatus: deepFreeze({ coverage: statusCoverage, complete: coverageStatusRecord.complete, uncoveredRequiredKeyCount }),
    deterministicReasons,
    snapshotProjectionDigest
  };
  const payload = record.status === "accepted"
    ? commonPayload
    : (() => {
        if (record.code !== "BudgetExceeded" || !["brick-count", "bytes", "work", "coverage"].includes(record.budget as string)) {
          return fail("InvalidPlannerInput", "plan", "Unsupported plan rejection.");
        }
        const required = plannerNonNegativeInteger(record.required, "plan/required");
        const limit = plannerNonNegativeInteger(record.limit, "plan/limit");
        if (required <= limit) {
          return fail("InvalidPlannerInput", "plan", "Budget rejection requires the required amount to exceed its limit.");
        }
        const rejectionReason = `Required ${record.budget as string} budget ${required} exceeds limit ${limit}.`;
        if (
          desired.length !== 0 || keep.length !== 0 || materialize.length !== 0 || evict.length !== 0 || fallback.length !== 0 || coverage.length !== 0 ||
          desiredKeys.length !== 0 || keepKeys.length !== 0 || materializeRequests.length !== 0 || evictCandidates.length !== 0 || parentFallbackKeys.length !== 0 ||
          statusCoverage.length !== 0 || coverageStatusRecord.complete !== false || uncoveredRequiredKeyCount !== 0 ||
          canonicalAdaptiveJson(reasons) !== canonicalAdaptiveJson([rejectionReason]) ||
          canonicalAdaptiveJson(deterministicReasons) !== canonicalAdaptiveJson([rejectionReason])
        ) {
          return fail("InvalidPlannerInput", "plan", "Rejected plans must contain only the canonical empty rejection decision and reason.");
        }
        return { ...commonPayload, status: "rejected" as const, code: "BudgetExceeded" as const, budget: record.budget, required, limit };
      })();
  if (canonicalAdaptiveJson(desired) !== canonicalAdaptiveJson(desiredKeys) || canonicalAdaptiveJson(keep) !== canonicalAdaptiveJson(keepKeys) || canonicalAdaptiveJson(materialize) !== canonicalAdaptiveJson(materializeRequests) || canonicalAdaptiveJson(evict) !== canonicalAdaptiveJson(evictCandidates) || canonicalAdaptiveJson(coverage) !== canonicalAdaptiveJson(statusCoverage) || canonicalAdaptiveJson(reasons) !== canonicalAdaptiveJson(deterministicReasons)) {
    return fail("InvalidPlannerInput", "plan", "Plan aliases must carry identical canonical authority values.");
  }
  if (hashAdaptiveCanonical(payload) !== record.planHash) return fail("InvalidPlannerInput", "plan/planHash", "Plan hash mismatch.");
  return deepFreeze({ ...payload, planHash: record.planHash }) as AdaptivePlanResult;
};

export const serializeAdaptivePlan = (plan: AdaptivePlanResult): string => {
  return canonicalAdaptiveJson(validateAdaptivePlanResult(plan));
};

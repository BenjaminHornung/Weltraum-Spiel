import {
  ADAPTIVE_MAX_PLAN_AGGREGATE_ENTRIES,
  ADAPTIVE_MAX_PLAN_ARRAY_ENTRIES,
  ADAPTIVE_MAX_RESIDENT_SUMMARIES,
  ADAPTIVE_AUTHORITY_PROTOCOL,
  canonicalAdaptiveJson,
  hashAdaptiveCanonical,
  validateAdaptiveAuthoritySnapshot
} from "./canonical";
import { compareAdaptiveBrickKeys, validateAdaptiveBrickKey } from "./coordinates";
import { createAdaptiveEdit, createAdaptiveEditJournal } from "./edits";
import {
  ADAPTIVE_AUTHORITY_DERIVATION_ALGORITHM_VERSION,
  ADAPTIVE_AUTHORITY_MATERIAL_TABLE_VERSION,
  ADAPTIVE_AUTHORITY_PROTOCOL_SCHEMA_VERSION,
  ADAPTIVE_EDIT_SCHEMA_VERSION,
  ADAPTIVE_MATERIALIZATION_VERSION,
  type AdaptiveAuthorityProtocol,
  type AdaptiveAuthoritySnapshot,
  type AdaptiveBrickKey,
  type AdaptiveEditRecord,
  type AdaptivePlanningEpoch,
  type StableAuthorityId
} from "./types";
import {
  adaptivePlanningEpoch,
  deepFreeze,
  fail,
  requireCanonicalString,
  requireDenseDataPropertyArray,
  requireExactKeys,
  requirePlainRecord,
  stableAuthorityId
} from "./validation";
import {
  fnv1aBytes,
  validateTransferableBundle,
  type TransferableBufferBundle
} from "../../workers/protocol";
import { workerEpoch, workerJobId, type WorkerEpoch, type WorkerJobId } from "../../workers/ids";

export const ADAPTIVE_DIRTY_DELTA_SCHEMA_VERSION = "hestia-unified-adaptive-dirty-delta-v1" as const;
export const ADAPTIVE_DIRTY_DELTA_COMMITMENT_SCHEMA_VERSION = "hestia-unified-adaptive-dirty-delta-commitment-v1" as const;
export const ADAPTIVE_DIRTY_DELTA_MAX_PAYLOAD_BYTES = 16_777_216 as const;

const HASH_PATTERN = /^fnv1a64-v1:[0-9a-f]{16}$/;
const DIRTY_CHANNELS = ["density", "occupancy", "material", "semantic"] as const;
const NEIGHBOR_RELATIONS = ["face", "edge", "corner"] as const;
// Keep this bound before canonical scanning; workers/protocol.ts validates ASCII view names with stableAsciiId(..., 128).
const MAX_TRANSFERABLE_VIEW_NAME_LENGTH = 128;
export type AdaptiveDirtyBrickChannel = (typeof DIRTY_CHANNELS)[number];
export type AdaptiveDirtyBrickNeighborRelation = (typeof NEIGHBOR_RELATIONS)[number];

export interface AdaptiveDirtyBrickTarget {
  readonly key: AdaptiveBrickKey;
  readonly keyHash: string;
  readonly role: StableAuthorityId;
  readonly requiredNeighborKeyHashes: readonly string[];
}

export interface AdaptiveDirtyBrickTargetInput {
  readonly key: AdaptiveBrickKey;
  readonly role: string;
  readonly requiredNeighborKeyHashes: readonly string[];
}

export interface AdaptiveDirtyBrickNeighbor {
  readonly key: AdaptiveBrickKey;
  readonly keyHash: string;
  readonly role: StableAuthorityId;
  readonly relation: AdaptiveDirtyBrickNeighborRelation;
}

export interface AdaptiveDirtyBrickNeighborInput {
  readonly key: AdaptiveBrickKey;
  readonly role: string;
  readonly relation: AdaptiveDirtyBrickNeighborRelation;
}

export interface AdaptiveDirtyBrickChannelDescriptor {
  readonly targetKeyHash: string;
  readonly channel: AdaptiveDirtyBrickChannel;
  readonly viewName: string;
}

export interface AdaptiveDirtyBrickFragmentDescriptor {
  readonly targetKeyHash: string;
  readonly fragmentId: StableAuthorityId;
  readonly viewName: string;
}

export interface AdaptiveDirtyBrickDelta {
  readonly schemaVersion: typeof ADAPTIVE_DIRTY_DELTA_SCHEMA_VERSION;
  readonly authorityId: StableAuthorityId;
  readonly targets: readonly AdaptiveDirtyBrickTarget[];
  readonly neighborManifest: readonly AdaptiveDirtyBrickNeighbor[];
  readonly changedChannels: readonly AdaptiveDirtyBrickChannelDescriptor[];
  readonly fragments: readonly AdaptiveDirtyBrickFragmentDescriptor[];
  readonly predecessorRevision: number;
  readonly predecessorHash: string;
  readonly resultRevision: number;
  readonly resultHash: string;
  readonly journalDigest: string;
  readonly baseFieldDescriptorDigest: string;
  readonly protocol: AdaptiveAuthorityProtocol;
  readonly materializationVersion: typeof ADAPTIVE_MATERIALIZATION_VERSION;
  readonly edit: AdaptiveEditRecord;
  readonly commandHash: string;
  readonly planningEpoch: AdaptivePlanningEpoch;
  readonly workerEpoch: WorkerEpoch;
  readonly rootJobId: WorkerJobId;
  readonly cancellationId: StableAuthorityId;
  readonly payload: TransferableBufferBundle;
  readonly byteLength: number;
  readonly payloadHash: string;
  readonly deltaHash: string;
}

export interface CreateAdaptiveDirtyBrickDeltaInput {
  readonly authorityId: string;
  readonly targets: readonly AdaptiveDirtyBrickTargetInput[];
  readonly neighborManifest: readonly AdaptiveDirtyBrickNeighborInput[];
  readonly changedChannels: readonly AdaptiveDirtyBrickChannelDescriptor[];
  readonly fragments: readonly Readonly<{
    readonly targetKeyHash: string;
    readonly fragmentId: string;
    readonly viewName: string;
  }>[];
  readonly predecessorRevision: number;
  readonly predecessorHash: string;
  readonly resultRevision: number;
  readonly resultHash: string;
  readonly journalDigest: string;
  readonly baseFieldDescriptorDigest: string;
  readonly protocol: AdaptiveAuthorityProtocol;
  readonly materializationVersion: string;
  readonly edit: AdaptiveEditRecord;
  readonly planningEpoch: number;
  readonly workerEpoch: number;
  readonly rootJobId: string;
  readonly cancellationId: string;
  readonly payload: TransferableBufferBundle;
  readonly byteLength: number;
}

export interface AdaptiveDirtyDeltaAdoptionContext {
  readonly predecessor: AdaptiveAuthoritySnapshot;
  readonly planningEpoch: number;
  readonly workerEpoch: number;
  readonly rootJobId: string;
  readonly cancellationId: string;
  readonly cancelled: boolean;
  readonly expectedResultHash: string;
}

const compareStrings = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;

const requireHash = (value: unknown, path: string): string => {
  if (typeof value !== "string" || !HASH_PATTERN.test(value)) {
    return fail("InvalidPlannerInput", path, "Expected a canonical Adaptive hash.");
  }
  return value;
};

const requireSafeNonNegativeInteger = (value: unknown, path: string): number => {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || Object.is(value, -0) || value < 0) {
    return fail("InvalidPlannerInput", path, "Expected a non-negative safe integer.");
  }
  return value;
};

const validateProtocol = (value: unknown): AdaptiveAuthorityProtocol => {
  const record = requirePlainRecord(value, "delta/protocol");
  requireExactKeys(record, ["schemaVersion", "derivationAlgorithmVersion", "materialTableVersion"], "delta/protocol");
  if (record.schemaVersion !== ADAPTIVE_AUTHORITY_PROTOCOL_SCHEMA_VERSION
    || record.derivationAlgorithmVersion !== ADAPTIVE_AUTHORITY_DERIVATION_ALGORITHM_VERSION
    || record.materialTableVersion !== ADAPTIVE_AUTHORITY_MATERIAL_TABLE_VERSION) {
    return fail("InvalidPlannerInput", "delta/protocol", "Adaptive protocol or derivation/material version is unsupported.");
  }
  return ADAPTIVE_AUTHORITY_PROTOCOL;
};

const validateEdit = (value: AdaptiveEditRecord): AdaptiveEditRecord => {
  const record = requirePlainRecord(value, "delta/edit");
  if (record.schemaVersion !== ADAPTIVE_EDIT_SCHEMA_VERSION) {
    return fail("InvalidPlannerInput", "delta/edit/schemaVersion", "Unsupported Adaptive edit schema.");
  }
  requireExactKeys(record, [
    "schemaVersion", "editId", "sequence", "expectedRegionRevision", "resultRegionRevision",
    "actorId", "sourceId", "operation", ...(Object.hasOwn(record, "sphere") ? ["sphere"] : []),
    ...(Object.hasOwn(record, "box") ? ["box"] : []), ...(Object.hasOwn(record, "materialId") ? ["materialId"] : []),
    ...(Object.hasOwn(record, "semanticId") ? ["semanticId"] : [])
  ], "delta/edit");
  return createAdaptiveEdit({
    editId: value.editId,
    sequence: value.sequence,
    expectedRegionRevision: value.expectedRegionRevision,
    resultRegionRevision: value.resultRegionRevision,
    actorId: value.actorId,
    sourceId: value.sourceId,
    operation: value.operation,
    ...(value.sphere === undefined ? {} : { sphere: value.sphere }),
    ...(value.box === undefined ? {} : { box: value.box }),
    ...(value.materialId === undefined ? {} : { materialId: value.materialId }),
    ...(value.semanticId === undefined ? {} : { semanticId: value.semanticId })
  });
};

const keyHash = (key: AdaptiveBrickKey): string => hashAdaptiveCanonical(validateAdaptiveBrickKey(key));

const validateRequiredNeighborHashes = (value: unknown, path: string, priorCount = 0): readonly string[] => {
  const entries = requireDenseDataPropertyArray(value, path, "InvalidPlannerInput", {
    maximumLength: ADAPTIVE_MAX_PLAN_ARRAY_ENTRIES
  });
  if (priorCount + entries.length > ADAPTIVE_MAX_PLAN_AGGREGATE_ENTRIES) {
    return fail("InvalidPlannerInput", path, "Dirty delta neighbor entries exceed the finite Adaptive aggregate limit.");
  }
  const hashes = entries.map((entry, index) =>
    requireHash(entry, `${path}/${index}`)
  );
  const ordered = [...hashes].sort(compareStrings);
  if (new Set(ordered).size !== ordered.length || ordered.some((entry, index) => entry !== hashes[index])) {
    return fail("InvalidPlannerInput", path, "Neighbor key hashes must be unique and canonicalized.");
  }
  return deepFreeze(ordered);
};

const validateTarget = (value: AdaptiveDirtyBrickTargetInput, index: number, priorNeighborCount = 0): AdaptiveDirtyBrickTarget => {
  const path = `delta/targets/${index}`;
  const record = requirePlainRecord(value, path);
  requireExactKeys(record, ["key", "role", "requiredNeighborKeyHashes"], path);
  const key = validateAdaptiveBrickKey(value.key);
  return deepFreeze({
    key,
    keyHash: keyHash(key),
    role: stableAuthorityId(value.role, `${path}/role`),
    requiredNeighborKeyHashes: validateRequiredNeighborHashes(value.requiredNeighborKeyHashes, `${path}/requiredNeighborKeyHashes`, priorNeighborCount)
  });
};

const validateNeighbor = (value: AdaptiveDirtyBrickNeighborInput, index: number): AdaptiveDirtyBrickNeighbor => {
  const path = `delta/neighborManifest/${index}`;
  const record = requirePlainRecord(value, path);
  requireExactKeys(record, ["key", "role", "relation"], path);
  if (!(NEIGHBOR_RELATIONS as readonly string[]).includes(value.relation)) {
    return fail("InvalidPlannerInput", `${path}/relation`, "Unsupported dirty-brick neighbor relation.");
  }
  const key = validateAdaptiveBrickKey(value.key);
  return deepFreeze({
    key,
    keyHash: keyHash(key),
    role: stableAuthorityId(value.role, `${path}/role`),
    relation: value.relation
  });
};

const validateChangedChannels = (value: unknown): readonly AdaptiveDirtyBrickChannelDescriptor[] => {
  const descriptors = requireDenseDataPropertyArray(value, "delta/changedChannels", "InvalidPlannerInput", {
    maximumLength: ADAPTIVE_MAX_PLAN_ARRAY_ENTRIES
  }).map((entry, index) => {
    const path = `delta/changedChannels/${index}`;
    const record = requirePlainRecord(entry, path);
    requireExactKeys(record, ["targetKeyHash", "channel", "viewName"], path);
    if (!(DIRTY_CHANNELS as readonly string[]).includes(record.channel as string)) {
      return fail("InvalidPlannerInput", `${path}/channel`, "Unsupported Adaptive dirty channel.");
    }
    if (typeof record.viewName !== "string") {
      return fail("InvalidPlannerInput", `${path}/viewName`, "Dirty channel view names must be strings.");
    }
    if (record.viewName.length > MAX_TRANSFERABLE_VIEW_NAME_LENGTH) {
      return fail("InvalidPlannerInput", `${path}/viewName`, "Dirty channel view names exceed the generic transfer limit.");
    }
    return deepFreeze({
      targetKeyHash: requireHash(record.targetKeyHash, `${path}/targetKeyHash`),
      channel: record.channel as AdaptiveDirtyBrickChannel,
      viewName: requireCanonicalString(record.viewName, `${path}/viewName`)
    });
  });
  const ordered = descriptors.sort((left, right) =>
    compareStrings(left.targetKeyHash, right.targetKeyHash)
    || compareStrings(left.channel, right.channel)
    || compareStrings(left.viewName, right.viewName)
  );
  for (let index = 1; index < ordered.length; index += 1) {
    const previous = ordered[index - 1]!;
    const current = ordered[index]!;
    if (previous.targetKeyHash === current.targetKeyHash && previous.channel === current.channel) {
      return fail("InvalidPlannerInput", "delta/changedChannels", "Dirty channel descriptor identities must be unique.");
    }
  }
  return deepFreeze(ordered);
};

const validateFragments = (value: unknown): readonly AdaptiveDirtyBrickFragmentDescriptor[] => {
  const descriptors = requireDenseDataPropertyArray(value, "delta/fragments", "InvalidPlannerInput", {
    maximumLength: ADAPTIVE_MAX_PLAN_ARRAY_ENTRIES
  }).map((entry, index) => {
    const path = `delta/fragments/${index}`;
    const record = requirePlainRecord(entry, path);
    requireExactKeys(record, ["targetKeyHash", "fragmentId", "viewName"], path);
    if (typeof record.viewName !== "string") {
      return fail("InvalidPlannerInput", `${path}/viewName`, "Dirty fragment view names must be strings.");
    }
    if (record.viewName.length > MAX_TRANSFERABLE_VIEW_NAME_LENGTH) {
      return fail("InvalidPlannerInput", `${path}/viewName`, "Dirty fragment view names exceed the generic transfer limit.");
    }
    return deepFreeze({
      targetKeyHash: requireHash(record.targetKeyHash, `${path}/targetKeyHash`),
      fragmentId: stableAuthorityId(record.fragmentId as string, `${path}/fragmentId`),
      viewName: requireCanonicalString(record.viewName, `${path}/viewName`)
    });
  });
  const ordered = descriptors.sort((left, right) =>
    compareStrings(left.targetKeyHash, right.targetKeyHash)
    || compareStrings(left.fragmentId, right.fragmentId)
    || compareStrings(left.viewName, right.viewName)
  );
  for (let index = 1; index < ordered.length; index += 1) {
    const previous = ordered[index - 1]!;
    const current = ordered[index]!;
    if (previous.targetKeyHash === current.targetKeyHash && previous.fragmentId === current.fragmentId) {
      return fail("InvalidPlannerInput", "delta/fragments", "Dirty fragment descriptor identities must be unique.");
    }
  }
  return deepFreeze(ordered);
};

const payloadCommitment = (bundle: TransferableBufferBundle): unknown => {
  const buffers = bundle.buffers.map((buffer) => ({
    byteLength: buffer.byteLength,
    byteHash: fnv1aBytes([buffer])
  }));
  const views = bundle.views.map((view) => ({
    name: view.name,
    kind: view.kind,
    bufferIndex: view.bufferIndex,
    byteOffset: view.byteOffset,
    elementCount: view.elementCount
  }));
  return {
    schemaVersion: "adaptive-dirty-delta-payload-v1",
    ownership: bundle.ownership,
    revision: bundle.revision,
    byteLength: bundle.byteLength,
    contentHash: bundle.contentHash === undefined ? null : bundle.contentHash,
    buffers,
    views
  };
};

const payloadHash = (bundle: TransferableBufferBundle): string =>
  hashAdaptiveCanonical(payloadCommitment(bundle));

const validatePayload = (
  value: unknown,
  resultRevision: number,
  byteLengthValue: unknown
): Readonly<{ readonly payload: TransferableBufferBundle; readonly byteLength: number; readonly payloadHash: string }> => {
  const record = requirePlainRecord(value, "delta/payload");
  const buffers = requireDenseDataPropertyArray(record.buffers, "delta/payload/buffers", "InvalidPlannerInput", {
    maximumLength: ADAPTIVE_MAX_PLAN_ARRAY_ENTRIES
  });
  const views = requireDenseDataPropertyArray(record.views, "delta/payload/views", "InvalidPlannerInput", {
    maximumLength: ADAPTIVE_MAX_PLAN_ARRAY_ENTRIES
  });
  if (buffers.length + views.length > ADAPTIVE_MAX_PLAN_AGGREGATE_ENTRIES) {
    return fail("InvalidPlannerInput", "delta/payload", "Dirty payload validation entries exceed the finite Adaptive aggregate limit.");
  }
  const byteLength = requireSafeNonNegativeInteger(byteLengthValue, "delta/byteLength");
  if (byteLength > ADAPTIVE_DIRTY_DELTA_MAX_PAYLOAD_BYTES) {
    return fail("InvalidPlannerInput", "delta/byteLength", "Dirty payload exceeds the 16 MiB page ceiling.");
  }
  const payload = validateTransferableBundle(value as TransferableBufferBundle);
  if (payload.ownership !== "WorkerToConsumer") {
    return fail("InvalidPlannerInput", "delta/payload/ownership", "Adaptive dirty deltas must be WorkerToConsumer payloads.");
  }
  if (payload.revision !== resultRevision) {
    return fail("InvalidPlannerInput", "delta/payload/revision", "Dirty delta payload revision must match its result.");
  }
  if (byteLength !== payload.byteLength) {
    return fail("InvalidPlannerInput", "delta/byteLength", "Declared dirty payload bytes do not match the transfer bundle.");
  }
  if (payload.byteLength > ADAPTIVE_DIRTY_DELTA_MAX_PAYLOAD_BYTES) {
    return fail("InvalidPlannerInput", "delta/byteLength", "Dirty payload exceeds the 16 MiB page ceiling.");
  }
  if (payload.contentHash !== undefined && payload.contentHash !== fnv1aBytes(payload.buffers)) {
    return fail("InvalidPlannerInput", "delta/payload/contentHash", "Dirty payload content hash does not match its buffers.");
  }
  return Object.freeze({ payload, byteLength, payloadHash: payloadHash(payload) });
};

const deltaCommitment = (delta: Omit<AdaptiveDirtyBrickDelta, "deltaHash">): unknown => ({
  schemaVersion: ADAPTIVE_DIRTY_DELTA_COMMITMENT_SCHEMA_VERSION,
  delta: {
    schemaVersion: delta.schemaVersion,
    authorityId: delta.authorityId,
    targets: delta.targets,
    neighborManifest: delta.neighborManifest,
    changedChannels: delta.changedChannels,
    fragments: delta.fragments,
    predecessorRevision: delta.predecessorRevision,
    predecessorHash: delta.predecessorHash,
    resultRevision: delta.resultRevision,
    resultHash: delta.resultHash,
    journalDigest: delta.journalDigest,
    baseFieldDescriptorDigest: delta.baseFieldDescriptorDigest,
    protocol: delta.protocol,
    materializationVersion: delta.materializationVersion,
    edit: delta.edit,
    commandHash: delta.commandHash,
    planningEpoch: delta.planningEpoch,
    workerEpoch: delta.workerEpoch,
    rootJobId: delta.rootJobId,
    cancellationId: delta.cancellationId,
    byteLength: delta.byteLength,
    payloadHash: delta.payloadHash,
    payload: payloadCommitment(delta.payload)
  }
});

const buildDelta = (input: CreateAdaptiveDirtyBrickDeltaInput): AdaptiveDirtyBrickDelta => {
  const record = requirePlainRecord(input, "deltaInput");
  requireExactKeys(record, [
    "authorityId", "targets", "neighborManifest", "changedChannels", "fragments", "predecessorRevision",
    "predecessorHash", "resultRevision", "resultHash", "journalDigest", "baseFieldDescriptorDigest", "protocol",
    "materializationVersion", "edit", "planningEpoch", "workerEpoch", "rootJobId", "cancellationId", "payload", "byteLength"
  ], "deltaInput");
  const predecessorRevision = requireSafeNonNegativeInteger(input.predecessorRevision, "delta/predecessorRevision");
  const resultRevision = requireSafeNonNegativeInteger(input.resultRevision, "delta/resultRevision");
  if (resultRevision !== predecessorRevision + 1) {
    return fail("InvalidPlannerInput", "delta/resultRevision", "Dirty delta result revision must advance exactly once.");
  }
  let requiredNeighborEntryCount = 0;
  const targets = requireDenseDataPropertyArray(input.targets, "delta/targets", "InvalidPlannerInput", {
    maximumLength: ADAPTIVE_MAX_RESIDENT_SUMMARIES
  }).map((entry, index) => {
    const target = validateTarget(entry as AdaptiveDirtyBrickTargetInput, index, requiredNeighborEntryCount);
    requiredNeighborEntryCount += target.requiredNeighborKeyHashes.length;
    return target;
  }).sort((left, right) => compareAdaptiveBrickKeys(left.key, right.key) || compareStrings(left.role, right.role));
  if (targets.length === 0) return fail("InvalidPlannerInput", "delta/targets", "Dirty deltas require at least one target brick.");
  if (targets.some((entry, index) => index > 0 && entry.keyHash === targets[index - 1]!.keyHash)) {
    return fail("InvalidPlannerInput", "delta/targets", "Dirty delta target brick keys must be unique.");
  }
  const neighborManifest = requireDenseDataPropertyArray(input.neighborManifest, "delta/neighborManifest", "InvalidPlannerInput", {
    maximumLength: ADAPTIVE_MAX_RESIDENT_SUMMARIES
  }).map((entry, index) =>
    validateNeighbor(entry as AdaptiveDirtyBrickNeighborInput, index)
  ).sort((left, right) => compareAdaptiveBrickKeys(left.key, right.key) || compareStrings(left.role, right.role));
  if (neighborManifest.some((entry, index) => index > 0 && entry.keyHash === neighborManifest[index - 1]!.keyHash)) {
    return fail("InvalidPlannerInput", "delta/neighborManifest", "Dirty delta neighbor keys must be unique.");
  }
  const baseAggregateEntryCount = targets.length + neighborManifest.length + requiredNeighborEntryCount;
  if (baseAggregateEntryCount > ADAPTIVE_MAX_PLAN_AGGREGATE_ENTRIES) {
    return fail("InvalidPlannerInput", "delta", "Dirty delta validation entries exceed the finite Adaptive aggregate limit.");
  }
  const requiredNeighbors = [...new Set(targets.flatMap((target) => target.requiredNeighborKeyHashes))].sort(compareStrings);
  const manifestHashes = neighborManifest.map((entry) => entry.keyHash).sort(compareStrings);
  if (requiredNeighbors.length !== manifestHashes.length || requiredNeighbors.some((entry, index) => entry !== manifestHashes[index])) {
    return fail("InvalidPlannerInput", "delta/neighborManifest", "Dirty delta neighbor manifest is incomplete or contains an undeclared neighbor.");
  }
  const changedChannels = validateChangedChannels(input.changedChannels);
  const fragments = validateFragments(input.fragments);
  const aggregateEntryCount = baseAggregateEntryCount + changedChannels.length + fragments.length;
  if (aggregateEntryCount > ADAPTIVE_MAX_PLAN_AGGREGATE_ENTRIES) {
    return fail("InvalidPlannerInput", "delta", "Dirty delta validation entries exceed the finite Adaptive aggregate limit.");
  }
  if (changedChannels.length + fragments.length === 0) {
    return fail("InvalidPlannerInput", "delta", "Dirty delta must declare changed channels or fragments.");
  }
  const payload = validatePayload(input.payload, resultRevision, input.byteLength);
  const viewNames = [...changedChannels.map((entry) => entry.viewName), ...fragments.map((entry) => entry.viewName)];
  const payloadViewNames = payload.payload.views.map((view) => view.name).sort(compareStrings);
  const orderedViewNames = [...viewNames].sort(compareStrings);
  if (new Set(viewNames).size !== viewNames.length
    || orderedViewNames.length !== payloadViewNames.length
    || orderedViewNames.some((name, index) => name !== payloadViewNames[index])) {
    return fail("InvalidPlannerInput", "delta/payload/views", "Dirty delta descriptors must cover each transfer view exactly once.");
  }
  const protocol = validateProtocol(input.protocol);
  if (input.materializationVersion !== ADAPTIVE_MATERIALIZATION_VERSION) {
    return fail("InvalidPlannerInput", "delta/materializationVersion", "Unsupported Adaptive materialization version.");
  }
  const edit = validateEdit(input.edit);
  const result: Omit<AdaptiveDirtyBrickDelta, "deltaHash"> = {
    schemaVersion: ADAPTIVE_DIRTY_DELTA_SCHEMA_VERSION,
    authorityId: stableAuthorityId(input.authorityId, "delta/authorityId"),
    targets: deepFreeze(targets),
    neighborManifest: deepFreeze(neighborManifest),
    changedChannels,
    fragments,
    predecessorRevision,
    predecessorHash: requireHash(input.predecessorHash, "delta/predecessorHash"),
    resultRevision,
    resultHash: requireHash(input.resultHash, "delta/resultHash"),
    journalDigest: requireHash(input.journalDigest, "delta/journalDigest"),
    baseFieldDescriptorDigest: requireHash(input.baseFieldDescriptorDigest, "delta/baseFieldDescriptorDigest"),
    protocol,
    materializationVersion: ADAPTIVE_MATERIALIZATION_VERSION,
    edit,
    commandHash: hashAdaptiveCanonical(edit),
    planningEpoch: adaptivePlanningEpoch(input.planningEpoch, "delta/planningEpoch"),
    workerEpoch: workerEpoch(input.workerEpoch),
    rootJobId: workerJobId(input.rootJobId),
    cancellationId: stableAuthorityId(input.cancellationId, "delta/cancellationId"),
    payload: payload.payload,
    byteLength: payload.byteLength,
    payloadHash: payload.payloadHash
  };
  const { payload: externalPayload, ...metadataSource } = result;
  const metadata = deepFreeze(metadataSource);
  const candidate = Object.freeze({ ...metadata, payload: externalPayload });
  return Object.freeze({ ...candidate, deltaHash: hashAdaptiveCanonical(deltaCommitment(candidate)) });
};

export const createAdaptiveDirtyBrickDelta = (input: CreateAdaptiveDirtyBrickDeltaInput): AdaptiveDirtyBrickDelta =>
  buildDelta(input);

export const hashAdaptiveDirtyBrickDelta = (value: AdaptiveDirtyBrickDelta): string => {
  const { deltaHash: _deltaHash, ...metadata } = value;
  return hashAdaptiveCanonical(deltaCommitment(metadata));
};

export const validateAdaptiveDirtyBrickDelta = (value: AdaptiveDirtyBrickDelta): AdaptiveDirtyBrickDelta => {
  const record = requirePlainRecord(value, "delta");
  requireExactKeys(record, [
    "schemaVersion", "authorityId", "targets", "neighborManifest", "changedChannels", "fragments", "predecessorRevision",
    "predecessorHash", "resultRevision", "resultHash", "journalDigest", "baseFieldDescriptorDigest", "protocol",
    "materializationVersion", "edit", "commandHash", "planningEpoch", "workerEpoch", "rootJobId", "cancellationId",
    "payload", "byteLength", "payloadHash", "deltaHash"
  ], "delta");
  if (value.schemaVersion !== ADAPTIVE_DIRTY_DELTA_SCHEMA_VERSION) {
    return fail("InvalidPlannerInput", "delta/schemaVersion", "Unsupported Adaptive dirty delta schema.");
  }
  const targetEntries = requireDenseDataPropertyArray(value.targets, "delta/targets", "InvalidPlannerInput", {
    maximumLength: ADAPTIVE_MAX_RESIDENT_SUMMARIES
  });
  const neighborEntries = requireDenseDataPropertyArray(value.neighborManifest, "delta/neighborManifest", "InvalidPlannerInput", {
    maximumLength: ADAPTIVE_MAX_RESIDENT_SUMMARIES
  });
  for (const [index, targetValue] of targetEntries.entries()) {
    const target = targetValue as AdaptiveDirtyBrickTarget;
    if (target.keyHash !== keyHash(target.key)) {
      return fail("InvalidPlannerInput", `delta/targets/${index}/keyHash`, "Dirty delta target key hash mismatch.");
    }
  }
  for (const [index, neighborValue] of neighborEntries.entries()) {
    const neighbor = neighborValue as AdaptiveDirtyBrickNeighbor;
    if (neighbor.keyHash !== keyHash(neighbor.key)) {
      return fail("InvalidPlannerInput", `delta/neighborManifest/${index}/keyHash`, "Dirty delta neighbor key hash mismatch.");
    }
  }
  const candidate = buildDelta({
    authorityId: value.authorityId,
    targets: targetEntries.map((targetValue) => {
      const target = targetValue as AdaptiveDirtyBrickTarget;
      return {
        key: target.key,
        role: target.role,
        requiredNeighborKeyHashes: target.requiredNeighborKeyHashes
      };
    }),
    neighborManifest: neighborEntries.map((neighborValue) => {
      const neighbor = neighborValue as AdaptiveDirtyBrickNeighbor;
      return {
        key: neighbor.key,
        role: neighbor.role,
        relation: neighbor.relation
      };
    }),
    changedChannels: value.changedChannels,
    fragments: value.fragments,
    predecessorRevision: value.predecessorRevision,
    predecessorHash: value.predecessorHash,
    resultRevision: value.resultRevision,
    resultHash: value.resultHash,
    journalDigest: value.journalDigest,
    baseFieldDescriptorDigest: value.baseFieldDescriptorDigest,
    protocol: value.protocol,
    materializationVersion: value.materializationVersion,
    edit: value.edit,
    planningEpoch: value.planningEpoch,
    workerEpoch: value.workerEpoch,
    rootJobId: value.rootJobId,
    cancellationId: value.cancellationId,
    payload: value.payload,
    byteLength: value.byteLength
  });
  if (value.commandHash !== candidate.commandHash) {
    return fail("InvalidPlannerInput", "delta/commandHash", "Dirty delta command hash does not match its edit.");
  }
  if (value.payloadHash !== candidate.payloadHash) {
    return fail("InvalidPlannerInput", "delta/payloadHash", "Dirty delta payload hash does not match its bytes and descriptors.");
  }
  if (value.deltaHash !== candidate.deltaHash) {
    return fail("InvalidPlannerInput", "delta/deltaHash", "Dirty delta commitment hash mismatch.");
  }
  return candidate;
};

const validateAuthorityBindings = (
  delta: AdaptiveDirtyBrickDelta,
  predecessor: AdaptiveAuthoritySnapshot
): void => {
  if (delta.authorityId !== predecessor.authorityId
    || delta.predecessorRevision !== predecessor.revision
    || delta.predecessorHash !== predecessor.contentHash) {
    return fail("InvalidPlannerInput", "delta/predecessor", "Dirty delta predecessor does not match the Adaptive authority.");
  }
  if (canonicalAdaptiveJson(delta.protocol) !== canonicalAdaptiveJson(predecessor.protocol)) {
    return fail("InvalidPlannerInput", "delta/protocol", "Dirty delta protocol does not match the Adaptive authority.");
  }
  const firstBrick = predecessor.bricks[0]?.brick;
  if (firstBrick === undefined) return fail("InvalidPlannerInput", "predecessor/bricks", "Dirty delta adoption requires authority brick digest commitments.");
  for (const entry of predecessor.bricks) {
    if (entry.brick.baseFieldDescriptorDigest !== firstBrick.baseFieldDescriptorDigest
      || entry.brick.provenance.journalDigest !== firstBrick.provenance.journalDigest) {
      return fail("InvalidPlannerInput", "predecessor/bricks", "Adaptive authority brick digest commitments are inconsistent.");
    }
  }
  if (delta.journalDigest !== firstBrick.provenance.journalDigest
    || delta.baseFieldDescriptorDigest !== firstBrick.baseFieldDescriptorDigest) {
    return fail("InvalidPlannerInput", "delta/digests", "Dirty delta journal or base-field digest is stale.");
  }
  const bricksByHash = new Map(predecessor.bricks.map((entry) => [keyHash(entry.brick.key), entry] as const));
  const targetsByHash = new Map(delta.targets.map((target) => [target.keyHash, target] as const));
  if (targetsByHash.size !== delta.targets.length) return fail("InvalidPlannerInput", "delta/targets", "Dirty delta target keys are duplicated.");
  for (const target of delta.targets) {
    const authorityEntry = bricksByHash.get(target.keyHash);
    if (authorityEntry === undefined
      || authorityEntry.role !== target.role
      || canonicalAdaptiveJson(authorityEntry.brick.key) !== canonicalAdaptiveJson(target.key)
      || target.keyHash !== keyHash(target.key)) {
      return fail("InvalidPlannerInput", "delta/targets", "Dirty delta target is not a matching authority brick.");
    }
  }
  const neighborsByHash = new Map(delta.neighborManifest.map((neighbor) => [neighbor.keyHash, neighbor] as const));
  for (const neighbor of delta.neighborManifest) {
    const authorityEntry = bricksByHash.get(neighbor.keyHash);
    if (authorityEntry === undefined
      || authorityEntry.role !== neighbor.role
      || canonicalAdaptiveJson(authorityEntry.brick.key) !== canonicalAdaptiveJson(neighbor.key)
      || neighbor.keyHash !== keyHash(neighbor.key)
      || targetsByHash.has(neighbor.keyHash)) {
      return fail("InvalidPlannerInput", "delta/neighborManifest", "Dirty delta neighbor is not a matching non-target authority brick.");
    }
  }
  const requiredNeighbors = [...new Set(delta.targets.flatMap((target) => target.requiredNeighborKeyHashes))].sort(compareStrings);
  const declaredNeighbors = [...neighborsByHash.keys()].sort(compareStrings);
  if (requiredNeighbors.length !== declaredNeighbors.length || requiredNeighbors.some((hash, index) => hash !== declaredNeighbors[index])) {
    return fail("InvalidPlannerInput", "delta/neighborManifest", "Dirty delta seam-neighbor manifest is incomplete.");
  }
  const payloadViews = new Set(delta.payload.views.map((view) => view.name));
  for (const descriptor of [...delta.changedChannels, ...delta.fragments]) {
    if (!targetsByHash.has(descriptor.targetKeyHash) || !payloadViews.has(descriptor.viewName)) {
      return fail("InvalidPlannerInput", "delta/descriptors", "Dirty delta descriptor is missing its target or payload view.");
    }
  }
  const journal = predecessor.orderedInputs.length === 0
    ? createAdaptiveEditJournal([delta.edit])
    : createAdaptiveEditJournal([...predecessor.orderedInputs, delta.edit]);
  if (journal.revision !== delta.resultRevision || hashAdaptiveCanonical(delta.edit) !== delta.commandHash) {
    return fail("InvalidPlannerInput", "delta/edit", "Dirty delta edit does not append exactly one authority revision.");
  }
};

export const validateAdaptiveDirtyBrickDeltaForAtomicAdoption = (
  value: AdaptiveDirtyBrickDelta,
  context: AdaptiveDirtyDeltaAdoptionContext
): AdaptiveDirtyBrickDelta => {
  const delta = validateAdaptiveDirtyBrickDelta(value);
  const predecessor = validateAdaptiveAuthoritySnapshot(context.predecessor);
  if (context.cancelled) return fail("InvalidPlannerInput", "context/cancelled", "Cancelled dirty delta results cannot be adopted.");
  if (delta.planningEpoch !== adaptivePlanningEpoch(context.planningEpoch, "context/planningEpoch")
    || delta.workerEpoch !== workerEpoch(context.workerEpoch)
    || delta.rootJobId !== workerJobId(context.rootJobId)
    || delta.cancellationId !== stableAuthorityId(context.cancellationId, "context/cancellationId")) {
    return fail("InvalidPlannerInput", "context", "Dirty delta worker epoch, root job, planning epoch, or cancellation identity is stale.");
  }
  if (delta.resultHash !== requireHash(context.expectedResultHash, "context/expectedResultHash")) {
    return fail("InvalidPlannerInput", "delta/resultHash", "Dirty delta result hash does not match the expected candidate.");
  }
  validateAuthorityBindings(delta, predecessor);
  return delta;
};

export const canAdoptAdaptiveDirtyBrickDelta = (
  value: AdaptiveDirtyBrickDelta,
  context: AdaptiveDirtyDeltaAdoptionContext
): boolean => {
  try {
    validateAdaptiveDirtyBrickDeltaForAtomicAdoption(value, context);
    return true;
  } catch {
    return false;
  }
};

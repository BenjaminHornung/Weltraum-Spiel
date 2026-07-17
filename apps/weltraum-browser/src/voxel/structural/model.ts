import {
  ADAPTIVE_BRICK_CELL_COUNT,
  ADAPTIVE_BRICK_CELLS_PER_AXIS,
  adaptivePlanningEpoch as adaptiveAuthorityPlanningEpoch,
  authorityRevision as adaptiveAuthorityRevision,
  canonicalAdaptiveJson as adaptiveCanonicalJson,
  compareAdaptiveBrickKeys as adaptiveCompareBrickKeys,
  createAdaptiveAuthorityRetention as adaptiveCreateAuthorityRetention,
  deepFreeze,
  hashAdaptiveBaseFieldDescriptor as adaptiveHashBaseFieldDescriptor,
  serializeAdaptiveKey as adaptiveSerializeKey,
  stableAuthorityId as adaptiveStableAuthorityId,
  validateAdaptiveBrickKey as adaptiveValidateBrickKey,
  validateAdaptivePlannerSnapshotSemantics as adaptiveValidatePlannerSnapshotSemantics,
  validateMaterializedAdaptiveBrick as adaptiveValidateMaterializedBrick,
  type AdaptivePlannerSnapshot,
  type MaterializedAdaptiveBrick,
  type StableAuthorityId
} from "../adaptive";
import { hashStructuralEvidence, hashStructuralObjectContent } from "./canonical";
import {
  assertStructuralAddressMatchesFrame,
  createStructuralCellAddress,
  localCellOffsetFromIndex,
  structuralLocalCellIndex,
  validateStructuralCellAddress
} from "./coordinates";
import {
  STRUCTURAL_BRICK_SCHEMA_VERSION,
  STRUCTURAL_OBJECT_SCHEMA_VERSION,
  STRUCTURAL_SOURCE_BINDING_SCHEMA_VERSION,
  type StructuralAdaptiveIngestInput,
  type StructuralAdaptiveMaterialBinding,
  type StructuralAdaptiveSourceBinding,
  type StructuralAnchor,
  type StructuralBrick,
  type StructuralBrickCell,
  type StructuralFrameBinding,
  type StructuralJoint,
  type StructuralJointEndpoint,
  type StructuralMaterialDefinition,
  type StructuralObject,
  type StructuralVoxelState
} from "./types";
import {
  assertStructuralKeyMatchesFrame,
  normalizeAdaptiveAuthorityFunction,
  requireStructuralHash,
  structuralCanonicalString,
  structuralFail,
  structuralMaterialId,
  structuralNonNegativeSafeInteger,
  structuralRevision,
  validateStructuralCommandEvidenceSemanticsInternal,
  validateStructuralFrameBinding,
  validateStructuralMaterialDefinition,
  validateStructuralVoxelState
} from "./validation";
import {
  requireExactKeys as adaptiveRequireExactKeys,
  requirePlainRecord as adaptiveRequirePlainRecord
} from "../adaptive";

const adaptivePlanningEpoch = normalizeAdaptiveAuthorityFunction(adaptiveAuthorityPlanningEpoch);
const authorityRevision = normalizeAdaptiveAuthorityFunction(adaptiveAuthorityRevision);
const canonicalAdaptiveJson = normalizeAdaptiveAuthorityFunction(adaptiveCanonicalJson);
const compareAdaptiveBrickKeys = normalizeAdaptiveAuthorityFunction(adaptiveCompareBrickKeys);
const createAdaptiveAuthorityRetention = normalizeAdaptiveAuthorityFunction(adaptiveCreateAuthorityRetention);
const hashAdaptiveBaseFieldDescriptor = normalizeAdaptiveAuthorityFunction(adaptiveHashBaseFieldDescriptor);
const serializeAdaptiveKey = normalizeAdaptiveAuthorityFunction(adaptiveSerializeKey);
const stableAuthorityId = normalizeAdaptiveAuthorityFunction(adaptiveStableAuthorityId);
const validateAdaptiveBrickKey = normalizeAdaptiveAuthorityFunction(adaptiveValidateBrickKey);
const validateAdaptivePlannerSnapshotSemantics = normalizeAdaptiveAuthorityFunction(adaptiveValidatePlannerSnapshotSemantics);
const validateMaterializedAdaptiveBrick = normalizeAdaptiveAuthorityFunction(adaptiveValidateMaterializedBrick);
const requireExactKeys = normalizeAdaptiveAuthorityFunction(adaptiveRequireExactKeys);
const requirePlainRecord = normalizeAdaptiveAuthorityFunction(adaptiveRequirePlainRecord);

const denseArray = (value: unknown, path: string): readonly unknown[] => {
  if (!Array.isArray(value)) return structuralFail("InvalidContract", path, "Expected a dense array.");
  for (let index = 0; index < value.length; index += 1) {
    if (!Object.hasOwn(value, index)) return structuralFail("InvalidContract", `${path}/${index}`, "Sparse arrays are rejected.");
  }
  return value;
};

const compareStrings = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;

export const createStructuralMaterialTable = (values: readonly unknown[]): readonly StructuralMaterialDefinition[] => {
  const materials = denseArray(values, "materials")
    .map((value, index) => validateStructuralMaterialDefinition(value, `materials/${index}`))
    .sort((left, right) => left.materialId - right.materialId);
  for (let index = 1; index < materials.length; index += 1) {
    if (materials[index - 1].materialId === materials[index].materialId) {
      return structuralFail("InvalidMaterial", "materials", "Material definitions must have unique IDs.");
    }
  }
  return deepFreeze(materials);
};

const materialIds = (materials: readonly StructuralMaterialDefinition[]): ReadonlySet<number> =>
  new Set(materials.map((material) => material.materialId));

export const createStructuralBrick = (
  value: unknown,
  materials: readonly StructuralMaterialDefinition[],
  frame: StructuralFrameBinding,
  path = "brick"
): StructuralBrick => {
  const record = requirePlainRecord(value, path);
  requireExactKeys(record, ["schemaVersion", "key", "cells"], path);
  if (record.schemaVersion !== STRUCTURAL_BRICK_SCHEMA_VERSION) return structuralFail("InvalidContract", `${path}/schemaVersion`, "Unsupported Structural brick schema.");
  const key = validateAdaptiveBrickKey(record.key);
  assertStructuralKeyMatchesFrame(key, frame, `${path}/key`);
  const knownMaterials = materialIds(materials);
  const cells = denseArray(record.cells, `${path}/cells`).map((entry, index): StructuralBrickCell => {
    const cellPath = `${path}/cells/${index}`;
    const cell = requirePlainRecord(entry, cellPath);
    requireExactKeys(cell, ["localIndex", "state"], cellPath);
    const localIndex = structuralLocalCellIndex(cell.localIndex, `${cellPath}/localIndex`);
    const state = validateStructuralVoxelState(cell.state, `${cellPath}/state`);
    if (!knownMaterials.has(state.materialId)) return structuralFail("InvalidMaterial", `${cellPath}/state/materialId`, "Occupied cells require an explicit material definition.");
    return deepFreeze({ localIndex, state });
  });
  for (let index = 1; index < cells.length; index += 1) {
    if (cells[index - 1].localIndex >= cells[index].localIndex) return structuralFail("InvalidContract", `${path}/cells`, "Sparse cells must be sorted by unique local index.");
  }
  return deepFreeze({ schemaVersion: STRUCTURAL_BRICK_SCHEMA_VERSION, key, cells: deepFreeze(cells) });
};

export const validateStructuralAdaptiveSourceBinding = (value: unknown, path = "source"): StructuralAdaptiveSourceBinding => {
  const record = requirePlainRecord(value, path);
  const keys = ["schemaVersion", "baseFieldIdentity", "baseFieldVersion", "baseFieldDescriptorDigest", "journalDigest", "snapshotProjectionDigest", "proofDigests", "sourceRevision", "editRevision", "brickRevision", "planningEpoch"] as const;
  requireExactKeys(record, keys, path);
  if (record.schemaVersion !== STRUCTURAL_SOURCE_BINDING_SCHEMA_VERSION) return structuralFail("InvalidAdaptiveBinding", `${path}/schemaVersion`, "Unsupported Structural source binding schema.");
  const proofDigests = denseArray(record.proofDigests, `${path}/proofDigests`).map((digest, index) => requireStructuralHash(digest, `${path}/proofDigests/${index}`));
  for (let index = 1; index < proofDigests.length; index += 1) {
    if (proofDigests[index - 1] >= proofDigests[index]) return structuralFail("InvalidAdaptiveBinding", `${path}/proofDigests`, "Proof digests must be sorted and unique.");
  }
  return deepFreeze({
    schemaVersion: STRUCTURAL_SOURCE_BINDING_SCHEMA_VERSION,
    baseFieldIdentity: stableAuthorityId(record.baseFieldIdentity as string, `${path}/baseFieldIdentity`),
    baseFieldVersion: stableAuthorityId(record.baseFieldVersion as string, `${path}/baseFieldVersion`),
    baseFieldDescriptorDigest: requireStructuralHash(record.baseFieldDescriptorDigest, `${path}/baseFieldDescriptorDigest`),
    journalDigest: requireStructuralHash(record.journalDigest, `${path}/journalDigest`),
    snapshotProjectionDigest: requireStructuralHash(record.snapshotProjectionDigest, `${path}/snapshotProjectionDigest`),
    proofDigests: deepFreeze(proofDigests),
    sourceRevision: authorityRevision(structuralNonNegativeSafeInteger(record.sourceRevision, `${path}/sourceRevision`)),
    editRevision: authorityRevision(structuralNonNegativeSafeInteger(record.editRevision, `${path}/editRevision`)),
    brickRevision: authorityRevision(structuralNonNegativeSafeInteger(record.brickRevision, `${path}/brickRevision`)),
    planningEpoch: adaptivePlanningEpoch(structuralNonNegativeSafeInteger(record.planningEpoch, `${path}/planningEpoch`))
  });
};

const validateAnchor = (value: unknown, frame: StructuralFrameBinding, path: string): StructuralAnchor => {
  const record = requirePlainRecord(value, path);
  requireExactKeys(record, ["anchorId", "cell"], path);
  const cell = validateStructuralCellAddress(record.cell, `${path}/cell`);
  assertStructuralAddressMatchesFrame(cell, frame);
  return deepFreeze({ anchorId: stableAuthorityId(record.anchorId as string, `${path}/anchorId`), cell });
};

const validateEndpoint = (value: unknown, frame: StructuralFrameBinding, path: string): StructuralJointEndpoint => {
  const record = requirePlainRecord(value, path);
  requireExactKeys(record, ["cell", "role"], path);
  const cell = validateStructuralCellAddress(record.cell, `${path}/cell`);
  assertStructuralAddressMatchesFrame(cell, frame);
  return deepFreeze({ cell, role: structuralCanonicalString<string>(record.role, `${path}/role`) });
};

const validateJoint = (value: unknown, frame: StructuralFrameBinding, path: string): StructuralJoint => {
  const record = requirePlainRecord(value, path);
  requireExactKeys(record, ["jointId", "jointClass", "endpointA", "endpointB"], path);
  return deepFreeze({
    jointId: stableAuthorityId(record.jointId as string, `${path}/jointId`),
    jointClass: structuralCanonicalString<string>(record.jointClass, `${path}/jointClass`),
    endpointA: validateEndpoint(record.endpointA, frame, `${path}/endpointA`),
    endpointB: validateEndpoint(record.endpointB, frame, `${path}/endpointB`)
  });
};

export interface InternalStructuralObjectReconstructionInput {
  readonly objectId: unknown;
  readonly frame: unknown;
  readonly source: unknown;
  readonly materials: readonly unknown[];
  readonly bricks: readonly unknown[];
  readonly anchors: readonly unknown[];
  readonly joints: readonly unknown[];
  readonly objectRevision: unknown;
  readonly editRevision: unknown;
  readonly commandEvidence: readonly unknown[];
}

export const reconstructStructuralObjectInternal = (value: unknown): StructuralObject => {
  const input = requirePlainRecord(value, "objectInput");
  requireExactKeys(input, ["objectId", "frame", "source", "materials", "bricks", "anchors", "joints", "objectRevision", "editRevision", "commandEvidence"], "objectInput");
  const frame = validateStructuralFrameBinding(input.frame);
  const source = validateStructuralAdaptiveSourceBinding(input.source);
  const materials = createStructuralMaterialTable(input.materials as readonly unknown[]);
  const bricks = denseArray(input.bricks, "bricks").map((brick, index) => createStructuralBrick(brick, materials, frame, `bricks/${index}`)).sort((left, right) => compareAdaptiveBrickKeys(left.key, right.key));
  for (let index = 1; index < bricks.length; index += 1) {
    if (serializeAdaptiveKey(bricks[index - 1].key) === serializeAdaptiveKey(bricks[index].key)) return structuralFail("InvalidContract", "bricks", "Structural brick keys must be unique.");
  }
  const brickKeys = new Set(bricks.map((brick) => serializeAdaptiveKey(brick.key)));
  const anchors = denseArray(input.anchors, "anchors").map((anchor, index) => validateAnchor(anchor, frame, `anchors/${index}`)).sort((left, right) => compareStrings(left.anchorId, right.anchorId));
  const joints = denseArray(input.joints, "joints").map((joint, index) => validateJoint(joint, frame, `joints/${index}`)).sort((left, right) => compareStrings(left.jointId, right.jointId));
  for (const [kind, entries] of [["anchors", anchors], ["joints", joints]] as const) {
    for (let index = 1; index < entries.length; index += 1) {
      const previous = kind === "anchors" ? (entries[index - 1] as StructuralAnchor).anchorId : (entries[index - 1] as StructuralJoint).jointId;
      const current = kind === "anchors" ? (entries[index] as StructuralAnchor).anchorId : (entries[index] as StructuralJoint).jointId;
      if (previous === current) return structuralFail("InvalidContract", kind, `${kind} IDs must be unique.`);
    }
  }
  for (const anchor of anchors) if (!brickKeys.has(serializeAdaptiveKey(anchor.cell.brickKey))) return structuralFail("InvalidContract", "anchors", "Anchor endpoints require a present Structural brick.");
  for (const joint of joints) for (const endpoint of [joint.endpointA, joint.endpointB]) {
    if (!brickKeys.has(serializeAdaptiveKey(endpoint.cell.brickKey))) return structuralFail("InvalidContract", "joints", "Joint endpoints require a present Structural brick.");
  }
  const objectRevision = structuralRevision(input.objectRevision, "objectRevision");
  const editRevision = structuralRevision(input.editRevision, "editRevision");
  if (editRevision > objectRevision) return structuralFail("InvalidRevision", "editRevision", "Edit revision may not exceed object revision.");
  const contentCandidate = deepFreeze({
    schemaVersion: STRUCTURAL_OBJECT_SCHEMA_VERSION,
    objectId: stableAuthorityId(input.objectId as string, "objectId"),
    frame,
    source,
    materials,
    bricks: deepFreeze(bricks),
    anchors: deepFreeze(anchors),
    joints: deepFreeze(joints),
    objectRevision,
    editRevision,
    contentHash: "",
    commandEvidence: deepFreeze([]),
    evidenceHash: ""
  }) as StructuralObject;
  const contentHash = hashStructuralObjectContent(contentCandidate);
  const commandEvidence = validateStructuralCommandEvidenceSemanticsInternal(
    input.commandEvidence,
    source,
    frame,
    objectRevision,
    editRevision,
    contentHash
  );
  const evidenceHash = hashStructuralEvidence(commandEvidence);
  return deepFreeze({ ...contentCandidate, contentHash, commandEvidence, evidenceHash });
};

const validateMaterialBindings = (
  values: readonly unknown[],
  materials: readonly StructuralMaterialDefinition[]
): ReadonlyMap<StableAuthorityId, number> => {
  const knownMaterials = materialIds(materials);
  const entries = denseArray(values, "materialBindings").map((value, index): StructuralAdaptiveMaterialBinding => {
    const path = `materialBindings/${index}`;
    const record = requirePlainRecord(value, path);
    requireExactKeys(record, ["adaptiveMaterialId", "structuralMaterialId"], path);
    const structuralId = structuralMaterialId(record.structuralMaterialId, `${path}/structuralMaterialId`, false);
    if (!knownMaterials.has(structuralId)) return structuralFail("InvalidMaterial", `${path}/structuralMaterialId`, "Material bindings require an explicit Structural material definition.");
    return deepFreeze({ adaptiveMaterialId: stableAuthorityId(record.adaptiveMaterialId as string, `${path}/adaptiveMaterialId`), structuralMaterialId: structuralId });
  }).sort((left, right) => compareStrings(left.adaptiveMaterialId, right.adaptiveMaterialId));
  for (let index = 1; index < entries.length; index += 1) {
    if (entries[index - 1].adaptiveMaterialId === entries[index].adaptiveMaterialId) return structuralFail("InvalidMaterial", "materialBindings", "Adaptive material bindings must be unique.");
  }
  return new Map(entries.map((entry) => [entry.adaptiveMaterialId, entry.structuralMaterialId]));
};

const structuralBrickFromAdaptive = (
  brickValue: unknown,
  materialBindings: ReadonlyMap<StableAuthorityId, number>,
  materials: readonly StructuralMaterialDefinition[],
  frame: StructuralFrameBinding,
  path: string
): StructuralBrick => {
  const brick = validateMaterializedAdaptiveBrick(brickValue as MaterializedAdaptiveBrick);
  assertStructuralKeyMatchesFrame(brick.key, frame, `${path}/key`);
  const cells: StructuralBrickCell[] = [];
  for (let index = 0; index < ADAPTIVE_BRICK_CELL_COUNT; index += 1) {
    const occupancy = brick.occupancy[index];
    if (occupancy !== 0 && occupancy !== 1) return structuralFail("InvalidAdaptiveBinding", `${path}/occupancy/${index}`, "Structural V1 accepts only binary Adaptive occupancy 0 or 1.");
    const adaptiveMaterial = brick.material[index];
    if (occupancy === 0) {
      continue;
    }
    if (adaptiveMaterial === null) return structuralFail("InvalidAdaptiveBinding", `${path}/material/${index}`, "Occupied Adaptive cells require an explicit material binding.");
    const materialId = materialBindings.get(adaptiveMaterial);
    if (materialId === undefined) return structuralFail("InvalidMaterial", `${path}/material/${index}`, "Occupied Adaptive material has no Structural material binding.");
    const semantic = brick.semantic[index];
    const state: StructuralVoxelState = deepFreeze({
      materialId: structuralMaterialId(materialId, `${path}/material/${index}`, false),
      partId: null,
      semanticKey: semantic === null ? null : structuralCanonicalString(semantic, `${path}/semantic/${index}`),
      damageKey: null
    });
    cells.push(deepFreeze({ localIndex: structuralLocalCellIndex(index), state }));
  }
  return createStructuralBrick({ schemaVersion: STRUCTURAL_BRICK_SCHEMA_VERSION, key: brick.key, cells }, materials, frame, path);
};

export const createStructuralObjectFromAdaptive = (value: unknown): StructuralObject => {
  const input = requirePlainRecord(value, "ingest");
  requireExactKeys(input, ["objectId", "frame", "authority", "snapshot", "materials", "materialBindings", "bricks", "anchors", "joints", "objectRevision", "editRevision", "commandEvidence"], "ingest");
  const frame = validateStructuralFrameBinding(input.frame);
  const authority = createAdaptiveAuthorityRetention(input.authority as StructuralAdaptiveIngestInput["authority"]);
  const snapshot = input.snapshot as AdaptivePlannerSnapshot;
  const { projection, snapshotProjectionDigest } = validateAdaptivePlannerSnapshotSemantics(snapshot);
  if (
    canonicalAdaptiveJson(authority.baseField) !== canonicalAdaptiveJson(projection.authority.baseField) ||
    canonicalAdaptiveJson(authority.editJournal) !== canonicalAdaptiveJson(projection.authority.editJournal)
  ) return structuralFail("InvalidAdaptiveBinding", "ingest/authority", "Retained Adaptive authority does not match the validated planner snapshot.");
  if (frame.bodyId !== projection.authority.bodyId || frame.surfaceFrameId !== projection.authority.surfaceFrameId || frame.regionId !== projection.authority.regionId || frame.generatorVersion !== projection.authority.generatorVersion) {
    return structuralFail("InvalidAdaptiveBinding", "ingest/frame", "Structural frame does not match the Adaptive planner snapshot authority.");
  }
  const materials = createStructuralMaterialTable(input.materials as readonly unknown[]);
  const bindings = validateMaterialBindings(input.materialBindings as readonly unknown[], materials);
  const adaptiveBricks = denseArray(input.bricks, "ingest/bricks").map((brick) => validateMaterializedAdaptiveBrick(brick as MaterializedAdaptiveBrick));
  const proofDigests: string[] = [];
  for (let index = 0; index < adaptiveBricks.length; index += 1) {
    const brick = adaptiveBricks[index];
    const resident = snapshot.resident.find((entry) => serializeAdaptiveKey(entry.key) === serializeAdaptiveKey(brick.key));
    if (resident === undefined || resident.readiness !== "ready" || resident.validationProof === undefined) return structuralFail("InvalidAdaptiveBinding", `ingest/bricks/${index}`, "Adaptive brick requires one ready resident with a constructor-issued proof.");
    if (resident.contentHash !== brick.contentHash || resident.provenanceHash !== brick.provenance.provenanceHash || resident.baseFieldDescriptorDigest !== brick.baseFieldDescriptorDigest || resident.journalDigest !== brick.provenance.journalDigest || resident.sourceRevision !== brick.sourceRevision || resident.editRevision !== brick.editRevision) {
      return structuralFail("InvalidAdaptiveBinding", `ingest/bricks/${index}`, "Adaptive brick does not match its validated resident source binding.");
    }
    proofDigests.push(resident.validationProof.proofDigest);
  }
  proofDigests.sort(compareStrings);
  for (let index = 1; index < proofDigests.length; index += 1) if (proofDigests[index - 1] === proofDigests[index]) return structuralFail("InvalidAdaptiveBinding", "ingest/bricks", "Adaptive proof digests must be unique.");
  const source: StructuralAdaptiveSourceBinding = deepFreeze({
    schemaVersion: STRUCTURAL_SOURCE_BINDING_SCHEMA_VERSION,
    baseFieldIdentity: projection.authority.baseField.identity,
    baseFieldVersion: projection.authority.baseField.version,
    baseFieldDescriptorDigest: hashAdaptiveBaseFieldDescriptor(authority.baseField),
    journalDigest: authority.editJournal.digest,
    snapshotProjectionDigest,
    proofDigests: deepFreeze(proofDigests),
    sourceRevision: projection.authority.sourceRevision,
    editRevision: projection.authority.editRevision,
    brickRevision: projection.authority.brickRevision,
    planningEpoch: projection.authority.planningEpoch
  });
  const structuralBricks = adaptiveBricks.map((brick, index) => structuralBrickFromAdaptive(brick, bindings, materials, frame, `ingest/bricks/${index}`));
  return reconstructStructuralObjectInternal({
    objectId: input.objectId,
    frame,
    source,
    materials,
    bricks: structuralBricks,
    anchors: input.anchors,
    joints: input.joints,
    objectRevision: input.objectRevision,
    editRevision: input.editRevision,
    commandEvidence: input.commandEvidence
  });
};

export const getStructuralVoxel = (object: StructuralObject, addressValue: unknown): StructuralVoxelState | null | undefined => {
  const address = validateStructuralCellAddress(addressValue);
  const brick = object.bricks.find((entry) => serializeAdaptiveKey(entry.key) === serializeAdaptiveKey(address.brickKey));
  if (brick === undefined) return undefined;
  const localIndex = structuralLocalCellIndex(
    address.local.x + ADAPTIVE_BRICK_CELLS_PER_AXIS * (
      address.local.y + ADAPTIVE_BRICK_CELLS_PER_AXIS * address.local.z
    )
  );
  return brick.cells.find((cell) => cell.localIndex === localIndex)?.state ?? null;
};

export const structuralAddressForBrickCell = (brick: StructuralBrick, localIndex: number) =>
  createStructuralCellAddress(brick.key, localCellOffsetFromIndex(localIndex));

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
import { structuralCanonicalHashSteps, structuralEvidenceHashSteps, structuralObjectContentHashSteps } from "./canonical";
import { adaptiveAuthorityRetentionSteps } from "../adaptive/residency";
import { adaptivePlannerSnapshotSemanticsSteps, adaptiveBaseFieldDescriptorHashSteps } from "../adaptive/canonical";
import { adaptiveValidateMaterializedBrickSteps } from "../adaptive/materialization";
import type { AdaptiveOwnedJournalOptions } from "../adaptive/edits";
import type { StructuralCursorStep } from "./occupiedEntries";
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
  STRUCTURAL_MAX_ANCHORS,
  STRUCTURAL_MAX_BRICKS,
  STRUCTURAL_MAX_BRICK_CELLS,
  STRUCTURAL_MAX_JOINTS,
  STRUCTURAL_MAX_MATERIAL_BINDINGS,
  STRUCTURAL_MAX_MATERIAL_DEFINITIONS,
  STRUCTURAL_MAX_PROOF_DIGESTS,
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
  normalizeAdaptiveAuthorityError,
  normalizeAdaptiveAuthorityFunction,
  requireStructuralHash,
  structuralCanonicalString,
  structuralFail,
  structuralMaterialId,
  structuralNonNegativeSafeInteger,
  structuralRevision,
  drainStructuralSteps,
  freezeStructuralProduced,
  structuralCommandEvidenceSemanticsSteps,
  structuralMapSteps,
  structuralSortSteps,
  structuralFreezeArraySteps,
  structuralMaterialDefinitionSteps,
  structuralPositiveBudget,
  type StructuralOwnedReserve,
  validateStructuralFrameBinding,
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


const compareStrings = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;

export const createStructuralMaterialTable = (values: readonly unknown[]): readonly StructuralMaterialDefinition[] =>
  drainStructuralSteps(structuralMaterialTableSteps(values));

export function* structuralMaterialTableSteps(values: readonly unknown[], reserve?: StructuralOwnedReserve): Generator<void, readonly StructuralMaterialDefinition[], void> {
  const materials = yield* structuralSortSteps(yield* structuralMapSteps(values, "materials", STRUCTURAL_MAX_MATERIAL_DEFINITIONS,
    (value, index) => structuralMaterialDefinitionSteps(value, `materials/${index}`, reserve), reserve), (left, right) => left.materialId - right.materialId, reserve);
  for (let index = 1; index < materials.length; index += 1) {
    if (materials[index - 1].materialId === materials[index].materialId) {
      return structuralFail("InvalidMaterial", "materials", "Material definitions must have unique IDs.");
    }
    if (reserve !== undefined) { yield; }
  }
  return yield* structuralFreezeArraySteps(materials, reserve);
}

const materialIds = (materials: readonly StructuralMaterialDefinition[]): ReadonlySet<number> =>
  new Set(materials.map((material) => material.materialId));

export const createStructuralBrick = (
  value: unknown,
  materials: readonly StructuralMaterialDefinition[],
  frame: StructuralFrameBinding,
  path = "brick"
): StructuralBrick => drainStructuralSteps(structuralBrickSteps(value, materials, frame, path));

function* structuralBrickSteps(value: unknown, materials: readonly StructuralMaterialDefinition[], frame: StructuralFrameBinding,
  path: string, reserve?: StructuralOwnedReserve, retainedMaterialIds?: ReadonlySet<number>): Generator<void, StructuralBrick, void> {
  reserve?.(3_328, true);
  const record = requirePlainRecord(value, path);
  requireExactKeys(record, ["schemaVersion", "key", "cells"], path);
  if (record.schemaVersion !== STRUCTURAL_BRICK_SCHEMA_VERSION) return structuralFail("InvalidContract", `${path}/schemaVersion`, "Unsupported Structural brick schema.");
  const key = validateAdaptiveBrickKey(record.key);
  assertStructuralKeyMatchesFrame(key, frame, `${path}/key`);
  const knownMaterials = retainedMaterialIds ?? materialIds(materials);
  const cells = yield* structuralMapSteps(record.cells, `${path}/cells`, STRUCTURAL_MAX_BRICK_CELLS, function* (entry, index): Generator<void, StructuralBrickCell, void> {
    reserve?.(512, true);
    const cellPath = `${path}/cells/${index}`;
    const cell = requirePlainRecord(entry, cellPath);
    requireExactKeys(cell, ["localIndex", "state"], cellPath);
    const localIndex = structuralLocalCellIndex(cell.localIndex, `${cellPath}/localIndex`);
    const state = validateStructuralVoxelState(cell.state, `${cellPath}/state`);
    if (!knownMaterials.has(state.materialId)) return structuralFail("InvalidMaterial", `${cellPath}/state/materialId`, "Occupied cells require an explicit material definition.");
    return freezeStructuralProduced({ localIndex, state }, reserve);
  }, reserve);
  for (let index = 1; index < cells.length; index += 1) {
    if (cells[index - 1].localIndex >= cells[index].localIndex) return structuralFail("InvalidContract", `${path}/cells`, "Sparse cells must be sorted by unique local index.");
    if (reserve !== undefined) { yield; }
  }
  return freezeStructuralProduced({ schemaVersion: STRUCTURAL_BRICK_SCHEMA_VERSION, key, cells: yield* structuralFreezeArraySteps(cells, reserve) }, reserve);
}

export const validateStructuralAdaptiveSourceBinding = (value: unknown, path = "source"): StructuralAdaptiveSourceBinding =>
  drainStructuralSteps(structuralSourceBindingSteps(value, path));

function* structuralSourceBindingSteps(value: unknown, path: string, reserve?: StructuralOwnedReserve): Generator<void, StructuralAdaptiveSourceBinding, void> {
  reserve?.(512, true);
  const record = requirePlainRecord(value, path);
  const keys = ["schemaVersion", "baseFieldIdentity", "baseFieldVersion", "baseFieldDescriptorDigest", "journalDigest", "snapshotProjectionDigest", "proofDigests", "sourceRevision", "editRevision", "brickRevision", "planningEpoch"] as const;
  requireExactKeys(record, keys, path);
  if (record.schemaVersion !== STRUCTURAL_SOURCE_BINDING_SCHEMA_VERSION) return structuralFail("InvalidAdaptiveBinding", `${path}/schemaVersion`, "Unsupported Structural source binding schema.");
  const proofDigests = yield* structuralMapSteps(record.proofDigests, `${path}/proofDigests`, STRUCTURAL_MAX_PROOF_DIGESTS,
    function* (digest, index) { return requireStructuralHash(digest, `${path}/proofDigests/${index}`); }, reserve);
  for (let index = 1; index < proofDigests.length; index += 1) {
    if (proofDigests[index - 1] >= proofDigests[index]) return structuralFail("InvalidAdaptiveBinding", `${path}/proofDigests`, "Proof digests must be sorted and unique.");
    if (reserve !== undefined) { yield; }
  }
  return freezeStructuralProduced({
    schemaVersion: STRUCTURAL_SOURCE_BINDING_SCHEMA_VERSION,
    baseFieldIdentity: stableAuthorityId(record.baseFieldIdentity as string, `${path}/baseFieldIdentity`),
    baseFieldVersion: stableAuthorityId(record.baseFieldVersion as string, `${path}/baseFieldVersion`),
    baseFieldDescriptorDigest: requireStructuralHash(record.baseFieldDescriptorDigest, `${path}/baseFieldDescriptorDigest`),
    journalDigest: requireStructuralHash(record.journalDigest, `${path}/journalDigest`),
    snapshotProjectionDigest: requireStructuralHash(record.snapshotProjectionDigest, `${path}/snapshotProjectionDigest`),
    proofDigests: yield* structuralFreezeArraySteps(proofDigests, reserve),
    sourceRevision: authorityRevision(structuralNonNegativeSafeInteger(record.sourceRevision, `${path}/sourceRevision`)),
    editRevision: authorityRevision(structuralNonNegativeSafeInteger(record.editRevision, `${path}/editRevision`)),
    brickRevision: authorityRevision(structuralNonNegativeSafeInteger(record.brickRevision, `${path}/brickRevision`)),
    planningEpoch: adaptivePlanningEpoch(structuralNonNegativeSafeInteger(record.planningEpoch, `${path}/planningEpoch`))
  }, reserve);
}

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

// Provenance only: no derived payload or caller-supplied clone is retained.
const issuedObjects=new WeakSet<object>();
// A command-local derivation capability is NOT final Structural/evidence/World issuance.
const preliminarySources = new WeakMap<object, StructuralObject>();
export const isIssuedStructuralObject=(value:unknown):value is StructuralObject=>
  value!==null&&typeof value==="object"&&issuedObjects.has(value);

export const isOwnedStructuralDerivationCandidate = (value: unknown): value is StructuralObject =>
  value !== null && typeof value === "object" && preliminarySources.has(value);

export const releaseOwnedStructuralDerivationCandidate = (value: StructuralObject): void => { preliminarySources.delete(value); };

/** Only command-produced index-only, locked brick/cell arrays; source metadata stays borrowed. */
export function* ownedStructuralDerivationCandidateSteps(source: StructuralObject, bricks: readonly StructuralBrick[],
  objectRevision: number, editRevision: number, reserve: StructuralOwnedReserve): Generator<void, StructuralObject, void> {
  if (!isIssuedStructuralObject(source)) { return structuralFail("InvalidContract", "cursor/source", "Owned derivation requires an issued source."); }
  reserve(2_048);
  const candidate = Object.freeze({ ...source, bricks, objectRevision: structuralRevision(objectRevision, "objectRevision"),
    editRevision: structuralRevision(editRevision, "editRevision"), contentHash: "" });
  yield;
  const result = Object.freeze({ ...candidate, contentHash: yield* structuralObjectContentHashSteps(candidate, reserve) });
  preliminarySources.set(result, source);
  return result;
}

/** Nested reconstruction BORROWS its caller's aggregate ledger; it never releases that ledger. */
export function* ownedStructuralReconstructionSteps(source: StructuralObject, value: InternalStructuralObjectReconstructionInput,
  reserve: StructuralOwnedReserve): Generator<void, StructuralObject, void> {
  if (!isIssuedStructuralObject(source) || value.frame !== source.frame || value.source !== source.source || value.materials !== source.materials) {
    return structuralFail("InvalidContract", "cursor/source", "Owned reconstruction requires an issued source and its exact borrowed metadata.");
  }
  return yield* structuralReconstructionSteps(value, reserve);
}

/** Existing synchronous entry drains the single reconstruction algorithm, with native generic observations. */
export const reconstructStructuralObjectInternal = (value: unknown): StructuralObject =>
  drainStructuralSteps(structuralReconstructionSteps(value));

function* structuralReconstructionSteps(value: unknown, reserve?: StructuralOwnedReserve): Generator<void, StructuralObject, void> {
  const input = requirePlainRecord(value, "objectInput");
  requireExactKeys(input, ["objectId", "frame", "source", "materials", "bricks", "anchors", "joints", "objectRevision", "editRevision", "commandEvidence"], "objectInput");
  reserve?.(1_024, true);
  const frame = validateStructuralFrameBinding(input.frame);
  if (reserve !== undefined) { yield; }
  const source = yield* structuralSourceBindingSteps(input.source, "source", reserve);
  const materials = yield* structuralMaterialTableSteps(input.materials as readonly unknown[], reserve);
  let retainedMaterialIds: Set<number> | undefined;
  if (reserve !== undefined) {
    reserve(64 + materials.length * 64);
    retainedMaterialIds = new Set<number>();
    for (const material of materials) { retainedMaterialIds.add(material.materialId); yield; }
  }
  const bricks = yield* structuralSortSteps(yield* structuralMapSteps(input.bricks, "bricks", STRUCTURAL_MAX_BRICKS,
    (brick, index) => structuralBrickSteps(brick, materials, frame, `bricks/${index}`, reserve, retainedMaterialIds), reserve),
    (left, right) => compareAdaptiveBrickKeys(left.key, right.key), reserve);
  for (let index = 1; index < bricks.length; index += 1) {
    if (serializeAdaptiveKey(bricks[index - 1].key) === serializeAdaptiveKey(bricks[index].key)) return structuralFail("InvalidContract", "bricks", "Structural brick keys must be unique.");
    if (reserve !== undefined) { yield; }
  }
  let brickKeys: Set<string>;
  if (reserve === undefined) { brickKeys = new Set(bricks.map((brick) => serializeAdaptiveKey(brick.key))); }
  else {
    reserve(64 + bricks.length * 3_328);
    brickKeys = new Set<string>();
    for (const brick of bricks) { brickKeys.add(serializeAdaptiveKey(brick.key)); yield; }
  }
  const anchors = yield* structuralSortSteps(yield* structuralMapSteps(input.anchors, "anchors", STRUCTURAL_MAX_ANCHORS,
    function* (anchor, index) { reserve?.(4_096, true); return validateAnchor(anchor, frame, `anchors/${index}`); }, reserve),
    (left, right) => compareStrings(left.anchorId, right.anchorId), reserve);
  const joints = yield* structuralSortSteps(yield* structuralMapSteps(input.joints, "joints", STRUCTURAL_MAX_JOINTS,
    function* (joint, index) { reserve?.(8_192, true); return validateJoint(joint, frame, `joints/${index}`); }, reserve),
    (left, right) => compareStrings(left.jointId, right.jointId), reserve);
  for (const [kind, entries] of [["anchors", anchors], ["joints", joints]] as const) {
    for (let index = 1; index < entries.length; index += 1) {
      const previous = kind === "anchors" ? (entries[index - 1] as StructuralAnchor).anchorId : (entries[index - 1] as StructuralJoint).jointId;
      const current = kind === "anchors" ? (entries[index] as StructuralAnchor).anchorId : (entries[index] as StructuralJoint).jointId;
      if (previous === current) return structuralFail("InvalidContract", kind, `${kind} IDs must be unique.`);
      if (reserve !== undefined) { yield; }
    }
  }
  for (const anchor of anchors) {
    if (!brickKeys.has(serializeAdaptiveKey(anchor.cell.brickKey))) { return structuralFail("InvalidContract", "anchors", "Anchor endpoints require a present Structural brick."); }
    if (reserve !== undefined) { yield; }
  }
  for (const joint of joints) for (const endpoint of [joint.endpointA, joint.endpointB]) {
    if (!brickKeys.has(serializeAdaptiveKey(endpoint.cell.brickKey))) return structuralFail("InvalidContract", "joints", "Joint endpoints require a present Structural brick.");
    if (reserve !== undefined) { yield; }
  }
  const objectRevision = structuralRevision(input.objectRevision, "objectRevision");
  const editRevision = structuralRevision(input.editRevision, "editRevision");
  if (editRevision > objectRevision) return structuralFail("InvalidRevision", "editRevision", "Edit revision may not exceed object revision.");
  reserve?.(1_024, true);
  const contentCandidate = freezeStructuralProduced({
    schemaVersion: STRUCTURAL_OBJECT_SCHEMA_VERSION,
    objectId: stableAuthorityId(input.objectId as string, "objectId"),
    frame,
    source,
    materials,
    bricks: yield* structuralFreezeArraySteps(bricks, reserve),
    anchors: yield* structuralFreezeArraySteps(anchors, reserve),
    joints: yield* structuralFreezeArraySteps(joints, reserve),
    objectRevision,
    editRevision,
    contentHash: "",
    commandEvidence: deepFreeze([]),
    evidenceHash: ""
  }, reserve) as StructuralObject;
  if (reserve !== undefined) { yield; }
  const contentHash = yield* structuralObjectContentHashSteps(contentCandidate, reserve);
  const commandEvidence = yield* structuralCommandEvidenceSemanticsSteps(
    input.commandEvidence,
    source,
    frame,
    objectRevision,
    editRevision,
    contentHash,
    "commandEvidence",
    reserve
  );
  const evidenceHash = yield* structuralEvidenceHashSteps(commandEvidence, reserve);
  reserve?.(512, true);
  const result=freezeStructuralProduced({ ...contentCandidate, contentHash, commandEvidence, evidenceHash }, reserve);
  issuedObjects.add(result);
  return result;
}

const reconstructionCursor = (value: unknown, reserve?: StructuralOwnedReserve, release: (completed?: boolean) => void = () => {}) => {
  let steps: Generator<void, StructuralObject, void> | undefined = structuralReconstructionSteps(value, reserve);
  let state: "open" | "done" | "failed" | "disposed" = "open", failure: unknown;
  return {
    advance(maxUnitsValue: number): StructuralCursorStep<StructuralObject> {
      if (state === "failed") { throw failure; }
      if (state !== "open" || steps === undefined) { return structuralFail("InvalidContract", "cursor", "Reconstruction cursor is finished or disposed."); }
      try {
        const maxUnits = structuralPositiveBudget(maxUnitsValue, "cursor/maxUnits");
        for (let unit = 0; unit < maxUnits; unit += 1) {
          const step = steps.next();
          if (step.done) { state = "done"; steps = undefined; release(true); return { done: true, value: step.value }; }
        }
        return { done: false };
      } catch (error) {
        const open = steps;
        state = "failed"; failure = error; steps = undefined;
        try { open?.return(undefined as never); } catch { /* Cleanup cannot replace the first failure. */ }
        release();
        throw error;
      }
    },
    dispose(): void {
      const open = state === "open" ? steps : undefined;
      steps = undefined;
      if (state === "open") { state = "disposed"; }
      try { open?.return(undefined as never); } catch { /* Original failure/result owns the outcome. */ }
      release();
    }
  };
};

/** Generic observations are compatible, but its native map/sort/deepFreeze/hash atoms are NOT bounded owner work. */
export const createStructuralReconstructionCursor = (value: unknown) => reconstructionCursor(value);

/**
 * INACTIVE, module-private owner entry. The issuer binds borrowed metadata; `value` and replacement
 * arrays/records MUST be first-party unpublished literals, immutable for the cursor lifetime, not
 * public getters/proxies/Species products. Frozen alone is never authority. No World/plan is issued.
 * residentBytes includes the retained source, old/result coexistence and other owner allocations.
 */
export const createStructuralOwnerLedger = (residentBytesValue: number, prepareLimitValue = 96 * 1024 * 1024, hashUnits: 1 | 128 = 1) => {
  const residentBytes = structuralNonNegativeSafeInteger(residentBytesValue, "cursor/residentBytes");
  const prepareLimitBytes = structuralPositiveBudget(prepareLimitValue, "cursor/prepareLimitBytes");
  if (prepareLimitBytes > 96 * 1024 * 1024) { return structuralFail("InvalidBudget", "cursor/prepareLimitBytes", "Prepare limit cannot exceed Prepare96MiB."); }
  if (hashUnits !== 1 && hashUnits !== 128) { return structuralFail("InvalidBudget", "cursor/hashUnits", "Owned hash quantum must be 1 or 128."); }
  let reservedBytes = 0, retainedEstimateBytes = 0, transferredResultEstimateBytes = 0, peakEstimateBytes = residentBytes, hashReservations = 0;
  const reserve: StructuralOwnedReserve = (bytes, retained = false, kind) => {
    const next = reservedBytes + bytes;
    if (!Number.isSafeInteger(next) || next > prepareLimitBytes || residentBytes + next > 256 * 1024 * 1024) {
      return structuralFail("InvalidBudget", "cursor/prepareBytes", "Owned reconstruction exceeds Prepare96MiB or CPU256MiB coexistence.");
    }
    reservedBytes = next;
    if (retained) { retainedEstimateBytes += bytes; }
    peakEstimateBytes = Math.max(peakEstimateBytes, residentBytes + next);
    if (kind === "hash") { hashReservations += 1; }
  };
  if (hashUnits === 128) { Object.defineProperty(reserve, "hashUnits", { value: 128 }); }
  return {
    reserve,
    release(completed = false): void {
      if (completed) { transferredResultEstimateBytes = retainedEstimateBytes; }
      reservedBytes = 0; retainedEstimateBytes = 0;
    },
    get resources() {
      return Object.freeze({ residentBytes, reservedBytes, retainedEstimateBytes, transferredResultEstimateBytes, peakEstimateBytes, hashReservations,
        hashBackingBufferBytesPerCursor: 4_096, pendingUtf16BytesPerCursor: 2_048, physicalHeap: "NOT_PROVEN" as const });
    }
  };
};

export const createOwnedStructuralReconstructionCursor = (source: StructuralObject, value: InternalStructuralObjectReconstructionInput, residentBytesValue: number) => {
  if (!isIssuedStructuralObject(source) || value.frame !== source.frame || value.source !== source.source || value.materials !== source.materials) {
    return structuralFail("InvalidContract", "cursor/source", "Owned reconstruction requires an issued source and its exact borrowed metadata.");
  }
  const ledger = createStructuralOwnerLedger(residentBytesValue);
  ledger.reserve(16_384);
  const cursor = reconstructionCursor(value, ledger.reserve, (completed) => ledger.release(completed));
  return { ...cursor, get resources() { return ledger.resources; } };
};

const validateMaterialBindings = (
  values: readonly unknown[],
  materials: readonly StructuralMaterialDefinition[]
): ReadonlyMap<StableAuthorityId, number> => drainStructuralSteps(materialBindingsSteps(values, materials));

function* materialBindingsSteps(values: readonly unknown[], materials: readonly StructuralMaterialDefinition[],
  reserve?: StructuralOwnedReserve): Generator<void, ReadonlyMap<StableAuthorityId, number>, void> {
  let knownMaterials: ReadonlySet<number>;
  if (reserve === undefined) { knownMaterials = materialIds(materials); }
  else {
    reserve(64 + materials.length * 64);
    const ids = new Set<number>();
    for (const material of materials) { ids.add(material.materialId); yield; }
    knownMaterials = ids;
  }
  const entries = yield* structuralSortSteps(yield* structuralMapSteps(values, "materialBindings", STRUCTURAL_MAX_MATERIAL_BINDINGS,
    function* (value, index): Generator<void, StructuralAdaptiveMaterialBinding, void> {
    reserve?.(3_072, true);
    const path = `materialBindings/${index}`;
    const record = requirePlainRecord(value, path);
    requireExactKeys(record, ["adaptiveMaterialId", "structuralMaterialId"], path);
    const structuralId = structuralMaterialId(record.structuralMaterialId, `${path}/structuralMaterialId`, false);
    if (!knownMaterials.has(structuralId)) { return structuralFail("InvalidMaterial", `${path}/structuralMaterialId`, "Material bindings require an explicit Structural material definition."); }
    return freezeStructuralProduced({ adaptiveMaterialId: stableAuthorityId(record.adaptiveMaterialId as string, `${path}/adaptiveMaterialId`), structuralMaterialId: structuralId }, reserve);
  }, reserve), (left, right) => compareStrings(left.adaptiveMaterialId, right.adaptiveMaterialId), reserve);
  for (let index = 1; index < entries.length; index += 1) {
    if (entries[index - 1].adaptiveMaterialId === entries[index].adaptiveMaterialId) { return structuralFail("InvalidMaterial", "materialBindings", "Adaptive material bindings must be unique."); }
    if (reserve !== undefined) { yield; }
  }
  if (reserve === undefined) { return new Map(entries.map((entry) => [entry.adaptiveMaterialId, entry.structuralMaterialId])); }
  reserve(64 + entries.length * 3_072);
  const bindings = new Map<StableAuthorityId, number>();
  for (const entry of entries) { bindings.set(entry.adaptiveMaterialId, entry.structuralMaterialId); yield; }
  return bindings;
}

/** Original Adaptive-to-Structural error boundary, including failures after an owned yield. */
function* adaptiveBoundarySteps<T>(steps: Generator<void, T, void>): Generator<void, T, void> {
  try { return yield* steps; }
  catch (error) { return normalizeAdaptiveAuthorityError(() => { throw error; }); }
}

const structuralBrickFromAdaptive = (
  brickValue: unknown,
  materialBindings: ReadonlyMap<StableAuthorityId, number>,
  materials: readonly StructuralMaterialDefinition[],
  frame: StructuralFrameBinding,
  path: string
): StructuralBrick => drainStructuralSteps(structuralBrickFromAdaptiveSteps(brickValue, materialBindings, materials, frame, path));

function* structuralBrickFromAdaptiveSteps(brickValue: unknown, materialBindings: ReadonlyMap<StableAuthorityId, number>,
  materials: readonly StructuralMaterialDefinition[], frame: StructuralFrameBinding, path: string,
  owned?: AdaptiveOwnedJournalOptions, validatedBrick?: MaterializedAdaptiveBrick): Generator<void, StructuralBrick, void> {
  const reserve = owned?.reserve;
  reserve?.(8_192);
  // Only the enclosing ingest may reuse its own complete, immutable validated result. The public
  // generic route retains the original second full revalidation and its native observation order.
  const brick = owned === undefined ? validateMaterializedAdaptiveBrick(brickValue as MaterializedAdaptiveBrick)
    : validatedBrick ?? (yield* adaptiveBoundarySteps(adaptiveValidateMaterializedBrickSteps(brickValue as MaterializedAdaptiveBrick, owned)));
  assertStructuralKeyMatchesFrame(brick.key, frame, `${path}/key`);
  reserve?.(64, true);
  const cells: StructuralBrickCell[] = [];
  for (let index = 0; index < ADAPTIVE_BRICK_CELL_COUNT; index += 1) {
    const occupancy = brick.occupancy[index];
    if (occupancy !== 0 && occupancy !== 1) { return structuralFail("InvalidAdaptiveBinding", `${path}/occupancy/${index}`, "Structural V1 accepts only binary Adaptive occupancy 0 or 1."); }
    const adaptiveMaterial = brick.material[index];
    if (occupancy === 0) {
      if (reserve !== undefined) { yield; }
      continue;
    }
    if (adaptiveMaterial === null) { return structuralFail("InvalidAdaptiveBinding", `${path}/material/${index}`, "Occupied Adaptive cells require an explicit material binding."); }
    const materialId = materialBindings.get(adaptiveMaterial);
    if (materialId === undefined) { return structuralFail("InvalidMaterial", `${path}/material/${index}`, "Occupied Adaptive material has no Structural material binding."); }
    const semantic = brick.semantic[index];
    reserve?.(1_024, true);
    const state: StructuralVoxelState = freezeStructuralProduced({
      materialId: structuralMaterialId(materialId, `${path}/material/${index}`, false),
      partId: null,
      semanticKey: semantic === null ? null : structuralCanonicalString(semantic, `${path}/semantic/${index}`),
      damageKey: null
    }, reserve);
    cells.push(freezeStructuralProduced({ localIndex: structuralLocalCellIndex(index), state }, reserve));
    if (reserve !== undefined) { yield; }
  }
  reserve?.(512);
  let knownMaterials: ReadonlySet<number> | undefined;
  if (reserve !== undefined) {
    reserve(64 + materials.length * 64);
    const ids = new Set<number>();
    for (const material of materials) { ids.add(material.materialId); yield; }
    knownMaterials = ids;
  }
  return yield* structuralBrickSteps({ schemaVersion: STRUCTURAL_BRICK_SCHEMA_VERSION, key: brick.key, cells }, materials, frame, path, reserve, knownMaterials);
}

/** Complete retained-value equality, not digest equality or a cross-context validation cache. */
function* retainedAdaptiveAuthorityMatchesSteps(left: StructuralAdaptiveIngestInput["authority"],
  right: StructuralAdaptiveIngestInput["authority"]): Generator<void, boolean, void> {
  if (canonicalAdaptiveJson(left.baseField) !== canonicalAdaptiveJson(right.baseField)) { return false; }
  const a = left.editJournal, b = right.editJournal;
  if (a.schemaVersion !== b.schemaVersion || a.initialRegionRevision !== b.initialRegionRevision
    || a.revision !== b.revision || a.digest !== b.digest || a.records.length !== b.records.length) { return false; }
  yield;
  for (let index = 0; index < a.records.length; index += 1) {
    // Validated edit records have bounded fixed schemas and IDs. Compare EVERY original record
    // field with the unchanged serializer; never stringify the whole4096-entry journal in a unit.
    if (canonicalAdaptiveJson(a.records[index]) !== canonicalAdaptiveJson(b.records[index])) { return false; }
    yield;
  }
  return true;
}

export const createStructuralObjectFromAdaptive = (value: unknown): StructuralObject =>
  drainStructuralSteps(structuralAdaptiveIngestSteps(value));

/** Direct-module, INACTIVE caller edge. The higher producer owns first-party plain/index-only
 * fixed-schema inputs immutable for THIS lifetime, including genuine resident proofs. This is
 * the original fresh Structural issuer, not an already-issued parent reconstruction shortcut.
 * Borrowed reservations never release the caller's aggregate ledger or issue a World/plan. */
export function* ownedStructuralAdaptiveIngestSteps(value: StructuralAdaptiveIngestInput,
  reserve: StructuralOwnedReserve): Generator<void, StructuralObject, void> {
  reserve(16_384);
  const owned: AdaptiveOwnedJournalOptions = Object.freeze({ reserve,
    hash: (payload: unknown) => structuralCanonicalHashSteps(payload, reserve) });
  return yield* structuralAdaptiveIngestSteps(value, owned);
}

function* structuralAdaptiveIngestSteps(value: unknown,
  owned?: AdaptiveOwnedJournalOptions): Generator<void, StructuralObject, void> {
  const reserve = owned?.reserve;
  reserve?.(32_768); // Fixed-schema initialization, descriptor/path and serial comparison scratch.
  const input = requirePlainRecord(value, "ingest");
  requireExactKeys(input, ["objectId", "frame", "authority", "snapshot", "materials", "materialBindings", "bricks", "anchors", "joints", "objectRevision", "editRevision", "commandEvidence"], "ingest");
  const frame = validateStructuralFrameBinding(input.frame);
  const authority = owned === undefined ? createAdaptiveAuthorityRetention(input.authority as StructuralAdaptiveIngestInput["authority"])
    : yield* adaptiveBoundarySteps(adaptiveAuthorityRetentionSteps(input.authority as StructuralAdaptiveIngestInput["authority"], owned));
  const snapshot = input.snapshot as AdaptivePlannerSnapshot;
  const { projection, snapshotProjectionDigest } = owned === undefined ? validateAdaptivePlannerSnapshotSemantics(snapshot)
    : yield* adaptiveBoundarySteps(adaptivePlannerSnapshotSemanticsSteps(snapshot, {}, owned));
  const authorityMatches = owned === undefined
    ? canonicalAdaptiveJson(authority.baseField) === canonicalAdaptiveJson(projection.authority.baseField)
      && canonicalAdaptiveJson(authority.editJournal) === canonicalAdaptiveJson(projection.authority.editJournal)
    : yield* retainedAdaptiveAuthorityMatchesSteps(authority, projection.authority);
  if (!authorityMatches) { return structuralFail("InvalidAdaptiveBinding", "ingest/authority", "Retained Adaptive authority does not match the validated planner snapshot."); }
  if (frame.bodyId !== projection.authority.bodyId || frame.surfaceFrameId !== projection.authority.surfaceFrameId || frame.regionId !== projection.authority.regionId || frame.generatorVersion !== projection.authority.generatorVersion) {
    return structuralFail("InvalidAdaptiveBinding", "ingest/frame", "Structural frame does not match the Adaptive planner snapshot authority.");
  }
  const materials = owned === undefined ? createStructuralMaterialTable(input.materials as readonly unknown[])
    : yield* structuralMaterialTableSteps(input.materials as readonly unknown[], reserve);
  const bindings = owned === undefined ? validateMaterialBindings(input.materialBindings as readonly unknown[], materials)
    : yield* materialBindingsSteps(input.materialBindings as readonly unknown[], materials, reserve);
  const adaptiveBricks = yield* structuralMapSteps(input.bricks, "ingest/bricks", STRUCTURAL_MAX_BRICKS,
    function* (brick): Generator<void, MaterializedAdaptiveBrick, void> {
      return owned === undefined ? validateMaterializedAdaptiveBrick(brick as MaterializedAdaptiveBrick)
        : yield* adaptiveBoundarySteps(adaptiveValidateMaterializedBrickSteps(brick as MaterializedAdaptiveBrick, owned));
    }, reserve);
  reserve?.(64, true);
  const proofDigests: string[] = [];
  for (let index = 0; index < adaptiveBricks.length; index += 1) {
    const brick = adaptiveBricks[index];
    let resident: AdaptivePlannerSnapshot["resident"][number] | undefined;
    if (reserve === undefined) {
      resident = snapshot.resident.find((entry) => serializeAdaptiveKey(entry.key) === serializeAdaptiveKey(brick.key));
    } else {
      for (let candidate = 0; candidate < snapshot.resident.length; candidate += 1) {
        const entry = snapshot.resident[candidate];
        if (serializeAdaptiveKey(entry.key) === serializeAdaptiveKey(brick.key)) { resident = entry; break; }
        yield;
      }
    }
    if (resident === undefined || resident.readiness !== "ready" || resident.validationProof === undefined) { return structuralFail("InvalidAdaptiveBinding", `ingest/bricks/${index}`, "Adaptive brick requires one ready resident with a constructor-issued proof."); }
    if (resident.contentHash !== brick.contentHash || resident.provenanceHash !== brick.provenance.provenanceHash || resident.baseFieldDescriptorDigest !== brick.baseFieldDescriptorDigest || resident.journalDigest !== brick.provenance.journalDigest || resident.sourceRevision !== brick.sourceRevision || resident.editRevision !== brick.editRevision) {
      return structuralFail("InvalidAdaptiveBinding", `ingest/bricks/${index}`, "Adaptive brick does not match its validated resident source binding.");
    }
    reserve?.(128, true);
    proofDigests.push(resident.validationProof.proofDigest);
    if (reserve !== undefined) { yield; }
  }
  yield* structuralSortSteps(proofDigests, compareStrings, reserve);
  for (let index = 1; index < proofDigests.length; index += 1) {
    if (proofDigests[index - 1] === proofDigests[index]) { return structuralFail("InvalidAdaptiveBinding", "ingest/bricks", "Adaptive proof digests must be unique."); }
    if (reserve !== undefined) { yield; }
  }
  reserve?.(4_096, true);
  const source: StructuralAdaptiveSourceBinding = freezeStructuralProduced({
    schemaVersion: STRUCTURAL_SOURCE_BINDING_SCHEMA_VERSION,
    baseFieldIdentity: projection.authority.baseField.identity,
    baseFieldVersion: projection.authority.baseField.version,
    baseFieldDescriptorDigest: owned === undefined ? hashAdaptiveBaseFieldDescriptor(authority.baseField)
      : yield* adaptiveBoundarySteps(adaptiveBaseFieldDescriptorHashSteps(authority.baseField, owned)),
    journalDigest: authority.editJournal.digest,
    snapshotProjectionDigest,
    proofDigests: yield* structuralFreezeArraySteps(proofDigests, reserve),
    sourceRevision: projection.authority.sourceRevision,
    editRevision: projection.authority.editRevision,
    brickRevision: projection.authority.brickRevision,
    planningEpoch: projection.authority.planningEpoch
  }, reserve);
  let structuralBricks: StructuralBrick[];
  if (owned === undefined) {
    structuralBricks = adaptiveBricks.map((brick, index) => structuralBrickFromAdaptive(brick, bindings, materials, frame, `ingest/bricks/${index}`));
  } else {
    owned.reserve(64 + adaptiveBricks.length * 128, true);
    structuralBricks = [];
    for (let index = 0; index < adaptiveBricks.length; index += 1) {
      structuralBricks.push(yield* structuralBrickFromAdaptiveSteps(adaptiveBricks[index], bindings, materials, frame,
        `ingest/bricks/${index}`, owned, adaptiveBricks[index]));
      yield;
    }
  }
  reserve?.(4_096);
  return yield* structuralReconstructionSteps({
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
  }, reserve);
}

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

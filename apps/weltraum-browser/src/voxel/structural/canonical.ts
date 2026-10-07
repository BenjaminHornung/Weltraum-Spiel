import {
  canonicalAdaptiveJson as adaptiveCanonicalJson,
  deepFreeze,
  hashAdaptiveCanonical as adaptiveHashCanonical,
  serializeAdaptiveKey as adaptiveSerializeKey
} from "../adaptive";
import { localCellIndexFromOffset, validateStructuralCellAddress } from "./coordinates";
import {
  STRUCTURAL_COMPONENT_ID_VERSION,
  STRUCTURAL_FRAGMENT_ID_VERSION,
  STRUCTURAL_FRAGMENT_SCHEMA_VERSION,
  STRUCTURAL_MAX_ANCHORS,
  STRUCTURAL_MAX_BRICKS,
  STRUCTURAL_MAX_BRICK_CELLS,
  STRUCTURAL_MAX_CHANGED_BRICK_KEYS,
  STRUCTURAL_MAX_COMMAND_EVIDENCE,
  STRUCTURAL_MAX_INVALIDATIONS,
  STRUCTURAL_MAX_JOINTS,
  STRUCTURAL_MAX_MATERIAL_DEFINITIONS,
  STRUCTURAL_MAX_PROOF_DIGESTS
} from "./types";
import type {
  StructuralBrick,
  StructuralCellAddress,
  StructuralCommandEvidence,
  StructuralCommandResult,
  StructuralComponentId,
  StructuralDestructionCommand,
  StructuralFragmentId,
  StructuralObject
} from "./types";
import { drainStructuralSteps, freezeStructuralProduced, structuralFreezeArraySteps, normalizeAdaptiveAuthorityFunction, structuralDenseArray, structuralDenseArraySteps, structuralMapSteps,
  validateStructuralDestructionCommand, structuralDestructionCommandValidationSteps, structuralFail, type StructuralOwnedReserve } from "./validation";
import { createOwnedCanonicalHashCursor } from "../adaptive/ownedCanonicalHashSteps";

const canonicalAdaptiveJson = normalizeAdaptiveAuthorityFunction(adaptiveCanonicalJson);
const hashAdaptiveCanonical = normalizeAdaptiveAuthorityFunction(adaptiveHashCanonical);
const serializeAdaptiveKey = normalizeAdaptiveAuthorityFunction(adaptiveSerializeKey);

const projectCell = (cell: StructuralCellAddress) => {
  const validated = validateStructuralCellAddress(cell);
  return deepFreeze({
    brickKey: serializeAdaptiveKey(validated.brickKey),
    localIndex: localCellIndexFromOffset(validated.local)
  });
};

function* projectBrickSteps(brick: StructuralBrick, reserve?: StructuralOwnedReserve) {
  reserve?.(3_328);
  const schemaVersion = brick.schemaVersion, key = serializeAdaptiveKey(brick.key);
  const cells = yield* structuralMapSteps(brick.cells, "brick/cells", STRUCTURAL_MAX_BRICK_CELLS,
    function* (cell) {
      reserve?.(128);
      const structuralCell = cell as StructuralBrick["cells"][number];
      return freezeStructuralProduced({ localIndex: structuralCell.localIndex, state: structuralCell.state }, reserve);
    }, reserve);
  if (reserve !== undefined) { yield* structuralFreezeArraySteps(cells, reserve); }
  return freezeStructuralProduced({ schemaVersion, key, cells }, reserve);
}

export const projectStructuralObjectContent = (object: StructuralObject) => drainStructuralSteps(projectStructuralObjectContentSteps(object));

function* projectStructuralObjectContentSteps(object: StructuralObject, reserve?: StructuralOwnedReserve) {
  reserve?.(1_024);
  const schemaVersion = object.schemaVersion, objectId = object.objectId, frame = object.frame;
  const source = freezeStructuralProduced({
    ...object.source,
    proofDigests: yield* structuralDenseArraySteps(object.source.proofDigests, "object/source/proofDigests", STRUCTURAL_MAX_PROOF_DIGESTS, reserve)
  }, reserve);
  const materials = yield* structuralDenseArraySteps(object.materials, "object/materials", STRUCTURAL_MAX_MATERIAL_DEFINITIONS, reserve);
  const bricks = yield* structuralMapSteps(object.bricks, "object/bricks", STRUCTURAL_MAX_BRICKS,
    (brick) => projectBrickSteps(brick as StructuralBrick, reserve), reserve);
  const anchors = yield* structuralMapSteps(object.anchors, "object/anchors", STRUCTURAL_MAX_ANCHORS, function* (entry) {
    reserve?.(4_096);
    const anchor = entry as StructuralObject["anchors"][number];
    return freezeStructuralProduced({ anchorId: anchor.anchorId, cell: projectCell(anchor.cell) }, reserve);
  }, reserve);
  const joints = yield* structuralMapSteps(object.joints, "object/joints", STRUCTURAL_MAX_JOINTS, function* (entry) {
    reserve?.(8_192);
    const joint = entry as StructuralObject["joints"][number];
    return freezeStructuralProduced({
      jointId: joint.jointId,
      jointClass: joint.jointClass,
      endpointA: deepFreeze({ cell: projectCell(joint.endpointA.cell), role: joint.endpointA.role }),
      endpointB: deepFreeze({ cell: projectCell(joint.endpointB.cell), role: joint.endpointB.role })
    }, reserve);
  }, reserve);
  if (reserve !== undefined) {
    yield* structuralFreezeArraySteps(bricks, reserve);
    yield* structuralFreezeArraySteps(anchors, reserve);
    yield* structuralFreezeArraySteps(joints, reserve);
  }
  return freezeStructuralProduced({ schemaVersion, objectId, frame, source, materials, bricks, anchors, joints }, reserve);
}

export const projectStructuralCommandEvidence = (evidence: StructuralCommandEvidence) => drainStructuralSteps(projectStructuralCommandEvidenceSteps(evidence));

function* projectStructuralCommandEvidenceSteps(evidence: StructuralCommandEvidence, reserve?: StructuralOwnedReserve) {
  reserve?.(512);
  const projection = { ...evidence,
    changedBrickKeys: yield* structuralMapSteps(evidence.changedBrickKeys, "evidence/changedBrickKeys", STRUCTURAL_MAX_CHANGED_BRICK_KEYS,
      function* (key) { reserve?.(3_072); return serializeAdaptiveKey(key as StructuralCommandEvidence["changedBrickKeys"][number]); }, reserve)
  };
  if (reserve !== undefined) { yield* structuralFreezeArraySteps(projection.changedBrickKeys, reserve); }
  return freezeStructuralProduced(projection, reserve);
}

export const projectStructuralObject = (object: StructuralObject) => drainStructuralSteps(projectStructuralObjectSteps(object));

function* projectStructuralObjectSteps(object: StructuralObject, reserve?: StructuralOwnedReserve) {
  reserve?.(1_024);
  return freezeStructuralProduced({
    ...(yield* projectStructuralObjectContentSteps(object, reserve)),
    objectRevision: object.objectRevision,
    editRevision: object.editRevision,
    contentHash: object.contentHash,
    commandEvidence: yield* projectObjectEvidenceSteps(object.commandEvidence, reserve),
    evidenceHash: object.evidenceHash
  }, reserve);
}

function* projectObjectEvidenceSteps(evidence: readonly StructuralCommandEvidence[], reserve?: StructuralOwnedReserve) {
  const values = yield* structuralMapSteps(evidence, "object/commandEvidence", STRUCTURAL_MAX_COMMAND_EVIDENCE,
    (entry) => projectStructuralCommandEvidenceSteps(entry as StructuralCommandEvidence, reserve), reserve);
  return reserve === undefined ? values : yield* structuralFreezeArraySteps(values, reserve);
}

export const projectStructuralResult = (result: StructuralCommandResult) => deepFreeze(
  result.status === "Rejected" ? {
    schemaVersion: result.schemaVersion,
    status: result.status,
    commandId: result.commandId,
    object: projectStructuralObject(result.object),
    code: result.code,
    path: result.path,
    resultHash: result.resultHash
  } : {
    schemaVersion: result.schemaVersion,
    status: result.status,
    commandId: result.commandId,
    object: projectStructuralObject(result.object),
    changedBrickKeys: structuralDenseArray(result.changedBrickKeys, "result/changedBrickKeys", STRUCTURAL_MAX_CHANGED_BRICK_KEYS).map((key) => serializeAdaptiveKey(key as StructuralCommandEvidence["changedBrickKeys"][number])),
    selectedVoxelCount: result.selectedVoxelCount,
    changedVoxelCount: result.changedVoxelCount,
    invalidations: structuralDenseArray(result.invalidations, "result/invalidations", STRUCTURAL_MAX_INVALIDATIONS),
    resultHash: result.resultHash
  }
);

export const canonicalStructuralJson = (value: unknown): string => canonicalAdaptiveJson(value);

export const serializeStructuralCellAddress = (cell: StructuralCellAddress): string =>
  canonicalAdaptiveJson(projectCell(cell));

export const serializeStructuralObject = (object: StructuralObject): string =>
  canonicalAdaptiveJson(projectStructuralObject(object));

export const serializeStructuralCommand = (command: StructuralDestructionCommand): string =>
  canonicalAdaptiveJson(validateStructuralDestructionCommand(command));

export const serializeStructuralResult = (result: StructuralCommandResult): string =>
  canonicalAdaptiveJson(projectStructuralResult(result));

export const hashStructuralObjectContent = (object: StructuralObject): string =>
  hashAdaptiveCanonical(projectStructuralObjectContent(object));

export const hashStructuralEvidence = (evidence: readonly StructuralCommandEvidence[]): string =>
  hashAdaptiveCanonical(deepFreeze(
    structuralDenseArray(evidence, "commandEvidence", STRUCTURAL_MAX_COMMAND_EVIDENCE)
      .map((entry) => projectStructuralCommandEvidence(entry as StructuralCommandEvidence))
  ));

/** Same projections and existing UTF-8/FNV cursor; no whole JSON/hash/freeze finalizer on owner work. */
export function* structuralCanonicalHashSteps(payload: unknown, reserve?: StructuralOwnedReserve): Generator<void, string, void> {
  if (reserve === undefined) { return hashAdaptiveCanonical(payload); }
  // Includes actual 4096-byte backing buffer, <=2048 pending UTF-16 bytes, encoder/state and bounded schema-depth/key/path stack estimates.
  reserve(32_768, false, "hash");
  const quantum = Object.getOwnPropertyDescriptor(reserve, "hashUnits");
  const hashUnits = quantum === undefined ? 1 : quantum.value;
  if (quantum !== undefined && (!("value" in quantum) || quantum.writable || quantum.configurable || (hashUnits !== 1 && hashUnits !== 128))) {
    return structuralFail("InvalidBudget", "cursor/hashUnits", "Owned hash quantum requires an immutable own value of 1 or 128.");
  }
  const cursor = createOwnedCanonicalHashCursor(payload, undefined, hashUnits === 128);
  try {
    for (;;) {
      const result = normalizeAdaptiveAuthorityFunction(() => cursor.advance(hashUnits))();
      if (result !== undefined) { return result.contentHash; }
      yield;
    }
  } finally { cursor.dispose(); }
}

export function* structuralObjectContentHashSteps(object: StructuralObject, reserve?: StructuralOwnedReserve): Generator<void, string, void> {
  if (reserve === undefined) { return hashStructuralObjectContent(object); }
  return yield* structuralCanonicalHashSteps(yield* projectStructuralObjectContentSteps(object, reserve), reserve);
}

export function* structuralEvidenceHashSteps(evidence: readonly StructuralCommandEvidence[], reserve?: StructuralOwnedReserve): Generator<void, string, void> {
  if (reserve === undefined) { return hashStructuralEvidence(evidence); }
  const projection = yield* structuralMapSteps(evidence, "commandEvidence", STRUCTURAL_MAX_COMMAND_EVIDENCE,
    (entry) => projectStructuralCommandEvidenceSteps(entry as StructuralCommandEvidence, reserve), reserve);
  return yield* structuralCanonicalHashSteps(yield* structuralFreezeArraySteps(projection, reserve), reserve);
}

export function* structuralCommandHashSteps(command: StructuralDestructionCommand, reserve?: StructuralOwnedReserve): Generator<void, string, void> {
  if (reserve === undefined) { return hashStructuralCommand(command); }
  return yield* structuralCanonicalHashSteps(yield* structuralDestructionCommandValidationSteps(command, "command", reserve), reserve);
}

/** Complete result object/evidence projection; never a subset digest or a whole-input finalizer. */
export function* structuralResultHashSteps(result: StructuralCommandResult, reserve?: StructuralOwnedReserve): Generator<void, string, void> {
  if (reserve === undefined) { return hashStructuralResult(result); }
  reserve(1_024);
  const payload = result.status === "Rejected" ? {
    schemaVersion: result.schemaVersion,
    status: result.status,
    commandId: result.commandId,
    object: yield* projectStructuralObjectSteps(result.object, reserve),
    code: result.code,
    path: result.path
  } : {
    schemaVersion: result.schemaVersion,
    status: result.status,
    commandId: result.commandId,
    object: yield* projectStructuralObjectSteps(result.object, reserve),
    changedBrickKeys: yield* structuralFreezeArraySteps(yield* structuralMapSteps(result.changedBrickKeys, "result/changedBrickKeys", STRUCTURAL_MAX_CHANGED_BRICK_KEYS,
      function* (key) { reserve(3_072); return serializeAdaptiveKey(key as StructuralCommandEvidence["changedBrickKeys"][number]); }, reserve), reserve),
    selectedVoxelCount: result.selectedVoxelCount,
    changedVoxelCount: result.changedVoxelCount,
    // reserve is present: dense steps produced this fresh private mutable array, not a borrowed input.
    invalidations: yield* structuralFreezeArraySteps((yield* structuralDenseArraySteps(result.invalidations, "result/invalidations", STRUCTURAL_MAX_INVALIDATIONS, reserve)) as unknown[], reserve)
  };
  return yield* structuralCanonicalHashSteps(Object.freeze(payload), reserve);
}

export const hashStructuralCommand = (command: StructuralDestructionCommand): string =>
  hashAdaptiveCanonical(validateStructuralDestructionCommand(command));

export const hashStructuralResult = (result: StructuralCommandResult): string =>
  hashAdaptiveCanonical(result.status === "Rejected" ? {
    schemaVersion: result.schemaVersion,
    status: result.status,
    commandId: result.commandId,
    object: projectStructuralObject(result.object),
    code: result.code,
    path: result.path
  } : {
    schemaVersion: result.schemaVersion,
    status: result.status,
    commandId: result.commandId,
    object: projectStructuralObject(result.object),
    changedBrickKeys: structuralDenseArray(result.changedBrickKeys, "result/changedBrickKeys", STRUCTURAL_MAX_CHANGED_BRICK_KEYS).map((key) => serializeAdaptiveKey(key as StructuralCommandEvidence["changedBrickKeys"][number])),
    selectedVoxelCount: result.selectedVoxelCount,
    changedVoxelCount: result.changedVoxelCount,
    invalidations: structuralDenseArray(result.invalidations, "result/invalidations", STRUCTURAL_MAX_INVALIDATIONS)
  });

export const hashStructuralAdaptiveAuthorityBinding = (source: StructuralObject["source"]): string =>
  hashAdaptiveCanonical(source);

export const hashStructuralComponentId = (value: Readonly<{
  readonly objectId: string;
  readonly objectRevision: number;
  readonly sourceContentHash: string;
  readonly sourceAdaptiveAuthorityDigest: string;
  readonly smallestOccupiedCellKey: string;
  readonly componentContentHash: string;
}>): StructuralComponentId => hashAdaptiveCanonical({
  schemaVersion: STRUCTURAL_COMPONENT_ID_VERSION,
  objectId: value.objectId,
  objectRevision: value.objectRevision,
  sourceContentHash: value.sourceContentHash,
  sourceAdaptiveAuthorityDigest: value.sourceAdaptiveAuthorityDigest,
  smallestOccupiedCellKey: value.smallestOccupiedCellKey,
  componentContentHash: value.componentContentHash
}) as StructuralComponentId;

export const hashStructuralFragmentContent = (value: Readonly<{
  readonly componentId: StructuralComponentId;
  readonly sourceContentHash: string;
  readonly sourceAdaptiveAuthorityDigest: string;
  readonly componentContentHash: string;
  readonly occupiedCellKeys: readonly string[];
}>): string => hashAdaptiveCanonical({
  schemaVersion: STRUCTURAL_FRAGMENT_SCHEMA_VERSION,
  ...value
});

export const hashStructuralFragmentId = (value: Readonly<{
  readonly objectId: string;
  readonly objectRevision: number;
  readonly componentId: StructuralComponentId;
  readonly fragmentContentHash: string;
}>): StructuralFragmentId => hashAdaptiveCanonical({
  schemaVersion: STRUCTURAL_FRAGMENT_ID_VERSION,
  ...value
}) as StructuralFragmentId;

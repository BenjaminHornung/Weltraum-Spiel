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
import { normalizeAdaptiveAuthorityFunction, structuralDenseArray, validateStructuralDestructionCommand } from "./validation";

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

const projectBrick = (brick: StructuralBrick) => deepFreeze({
  schemaVersion: brick.schemaVersion,
  key: serializeAdaptiveKey(brick.key),
  cells: structuralDenseArray(brick.cells, "brick/cells", STRUCTURAL_MAX_BRICK_CELLS)
    .map((cell) => {
      const structuralCell = cell as StructuralBrick["cells"][number];
      return deepFreeze({ localIndex: structuralCell.localIndex, state: structuralCell.state });
    })
});

export const projectStructuralObjectContent = (object: StructuralObject) => deepFreeze({
  schemaVersion: object.schemaVersion,
  objectId: object.objectId,
  frame: object.frame,
  source: deepFreeze({
    ...object.source,
    proofDigests: structuralDenseArray(object.source.proofDigests, "object/source/proofDigests", STRUCTURAL_MAX_PROOF_DIGESTS)
  }),
  materials: structuralDenseArray(object.materials, "object/materials", STRUCTURAL_MAX_MATERIAL_DEFINITIONS),
  bricks: structuralDenseArray(object.bricks, "object/bricks", STRUCTURAL_MAX_BRICKS)
    .map((brick) => projectBrick(brick as StructuralBrick)),
  anchors: structuralDenseArray(object.anchors, "object/anchors", STRUCTURAL_MAX_ANCHORS).map((entry) => {
    const anchor = entry as StructuralObject["anchors"][number];
    return deepFreeze({ anchorId: anchor.anchorId, cell: projectCell(anchor.cell) });
  }),
  joints: structuralDenseArray(object.joints, "object/joints", STRUCTURAL_MAX_JOINTS).map((entry) => {
    const joint = entry as StructuralObject["joints"][number];
    return deepFreeze({
      jointId: joint.jointId,
      jointClass: joint.jointClass,
      endpointA: deepFreeze({ cell: projectCell(joint.endpointA.cell), role: joint.endpointA.role }),
      endpointB: deepFreeze({ cell: projectCell(joint.endpointB.cell), role: joint.endpointB.role })
    });
  })
});

export const projectStructuralCommandEvidence = (evidence: StructuralCommandEvidence) => deepFreeze({
  ...evidence,
  changedBrickKeys: structuralDenseArray(evidence.changedBrickKeys, "evidence/changedBrickKeys", STRUCTURAL_MAX_CHANGED_BRICK_KEYS).map((key) => serializeAdaptiveKey(key as StructuralCommandEvidence["changedBrickKeys"][number]))
});

export const projectStructuralObject = (object: StructuralObject) => deepFreeze({
  ...projectStructuralObjectContent(object),
  objectRevision: object.objectRevision,
  editRevision: object.editRevision,
  contentHash: object.contentHash,
  commandEvidence: structuralDenseArray(object.commandEvidence, "object/commandEvidence", STRUCTURAL_MAX_COMMAND_EVIDENCE).map((entry) => projectStructuralCommandEvidence(entry as StructuralCommandEvidence)),
  evidenceHash: object.evidenceHash
});

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

import {
  canonicalAdaptiveJson as adaptiveCanonicalJson,
  deepFreeze,
  hashAdaptiveCanonical as adaptiveHashCanonical,
  serializeAdaptiveKey as adaptiveSerializeKey
} from "../adaptive";
import { localCellIndexFromOffset, validateStructuralCellAddress } from "./coordinates";
import { STRUCTURAL_COMPONENT_ID_VERSION } from "./types";
import type {
  StructuralBrick,
  StructuralCellAddress,
  StructuralCommandEvidence,
  StructuralCommandResult,
  StructuralComponentId,
  StructuralDestructionCommand,
  StructuralObject
} from "./types";
import { normalizeAdaptiveAuthorityFunction } from "./validation";

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
  cells: brick.cells.map((cell) => deepFreeze({ localIndex: cell.localIndex, state: cell.state }))
});

export const projectStructuralObjectContent = (object: StructuralObject) => deepFreeze({
  schemaVersion: object.schemaVersion,
  objectId: object.objectId,
  frame: object.frame,
  source: object.source,
  materials: object.materials,
  bricks: object.bricks.map(projectBrick),
  anchors: object.anchors.map((anchor) => deepFreeze({ anchorId: anchor.anchorId, cell: projectCell(anchor.cell) })),
  joints: object.joints.map((joint) => deepFreeze({
    jointId: joint.jointId,
    jointClass: joint.jointClass,
    endpointA: deepFreeze({ cell: projectCell(joint.endpointA.cell), role: joint.endpointA.role }),
    endpointB: deepFreeze({ cell: projectCell(joint.endpointB.cell), role: joint.endpointB.role })
  }))
});

export const projectStructuralCommandEvidence = (evidence: StructuralCommandEvidence) => deepFreeze({
  ...evidence,
  changedBrickKeys: evidence.changedBrickKeys.map(serializeAdaptiveKey)
});

export const projectStructuralObject = (object: StructuralObject) => deepFreeze({
  ...projectStructuralObjectContent(object),
  objectRevision: object.objectRevision,
  editRevision: object.editRevision,
  contentHash: object.contentHash,
  commandEvidence: object.commandEvidence.map(projectStructuralCommandEvidence),
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
    changedBrickKeys: result.changedBrickKeys.map(serializeAdaptiveKey),
    selectedVoxelCount: result.selectedVoxelCount,
    changedVoxelCount: result.changedVoxelCount,
    invalidations: result.invalidations,
    resultHash: result.resultHash
  }
);

export const canonicalStructuralJson = (value: unknown): string => canonicalAdaptiveJson(value);

export const serializeStructuralCellAddress = (cell: StructuralCellAddress): string =>
  canonicalAdaptiveJson(projectCell(cell));

export const serializeStructuralObject = (object: StructuralObject): string =>
  canonicalAdaptiveJson(projectStructuralObject(object));

export const serializeStructuralCommand = (command: StructuralDestructionCommand): string =>
  canonicalAdaptiveJson(command);

export const serializeStructuralResult = (result: StructuralCommandResult): string =>
  canonicalAdaptiveJson(projectStructuralResult(result));

export const hashStructuralObjectContent = (object: StructuralObject): string =>
  hashAdaptiveCanonical(projectStructuralObjectContent(object));

export const hashStructuralEvidence = (evidence: readonly StructuralCommandEvidence[]): string =>
  hashAdaptiveCanonical(deepFreeze(evidence.map(projectStructuralCommandEvidence)));

export const hashStructuralCommand = (command: StructuralDestructionCommand): string =>
  hashAdaptiveCanonical(command);

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
    changedBrickKeys: result.changedBrickKeys.map(serializeAdaptiveKey),
    selectedVoxelCount: result.selectedVoxelCount,
    changedVoxelCount: result.changedVoxelCount,
    invalidations: result.invalidations
  });

export const hashStructuralComponentId = (value: Readonly<{
  readonly objectId: string;
  readonly objectRevision: number;
  readonly smallestOccupiedCellKey: string;
  readonly componentContentHash: string;
}>): StructuralComponentId => hashAdaptiveCanonical({
  schemaVersion: STRUCTURAL_COMPONENT_ID_VERSION,
  objectId: value.objectId,
  objectRevision: value.objectRevision,
  smallestOccupiedCellKey: value.smallestOccupiedCellKey,
  componentContentHash: value.componentContentHash
}) as StructuralComponentId;

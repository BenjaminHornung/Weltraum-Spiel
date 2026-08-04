import {
  canonicalAdaptiveJson as adaptiveCanonicalJson,
  deepFreeze,
  hashAdaptiveCanonical as adaptiveHashCanonical,
  serializeAdaptiveKey as adaptiveSerializeKey
} from "../adaptive";
import { hasDeepFrozenIdentity } from "../adaptive/immutability";
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
  StructuralComponentClassification,
  StructuralComponentId,
  StructuralDestructionCommand,
  StructuralFragmentId,
  StructuralTransferDetachedComponentsCommand,
  StructuralTransferDetachedComponentsCommandV2,
  StructuralObject,
  StructuralObjectV2,
  StructuralResultV2
} from "./types";
import {
  normalizeAdaptiveAuthorityFunction,
  structuralDenseArray,
  validateStructuralDestructionCommand,
  validateStructuralTransferDetachedComponentsCommand,
  validateStructuralTransferDetachedComponentsCommandV2
} from "./validation";

const canonicalAdaptiveJson = normalizeAdaptiveAuthorityFunction(adaptiveCanonicalJson);
const hashAdaptiveCanonical = normalizeAdaptiveAuthorityFunction(adaptiveHashCanonical);
const serializeAdaptiveKey = normalizeAdaptiveAuthorityFunction(adaptiveSerializeKey);

const createCellProjection = (cell: StructuralCellAddress) => {
  const validated = validateStructuralCellAddress(cell);
  return deepFreeze({
    brickKey: serializeAdaptiveKey(validated.brickKey),
    localIndex: localCellIndexFromOffset(validated.local)
  });
};

const cellProjectionByIdentity = new WeakMap<object, ReturnType<typeof createCellProjection>>();

const projectCell = (cell: StructuralCellAddress): ReturnType<typeof createCellProjection> => {
  const cached = cellProjectionByIdentity.get(cell);
  if (cached !== undefined) return cached;
  const projection = createCellProjection(cell);
  if (hasDeepFrozenIdentity(cell)) cellProjectionByIdentity.set(cell, projection);
  return projection;
};

const createBrickProjection = (brick: StructuralBrick) => deepFreeze({
  schemaVersion: brick.schemaVersion,
  key: serializeAdaptiveKey(brick.key),
  cells: structuralDenseArray(brick.cells, "brick/cells", STRUCTURAL_MAX_BRICK_CELLS)
    .map((cell) => {
      const structuralCell = cell as StructuralBrick["cells"][number];
      return deepFreeze({ localIndex: structuralCell.localIndex, state: structuralCell.state });
    })
});

const brickProjectionByIdentity = new WeakMap<object, ReturnType<typeof createBrickProjection>>();

const projectBrick = (brick: StructuralBrick): ReturnType<typeof createBrickProjection> => {
  const cached = brickProjectionByIdentity.get(brick);
  if (cached !== undefined) return cached;
  const projection = createBrickProjection(brick);
  if (hasDeepFrozenIdentity(brick)) brickProjectionByIdentity.set(brick, projection);
  return projection;
};

const createStructuralObjectContentProjection = (object: StructuralObject | StructuralObjectV2) => deepFreeze({
  // V2 deliberately retains the V1 semantic content projection and content hash.
  schemaVersion: "structural-microvoxel-object-v1" as const,
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

interface StructuralObjectContentProjectionCacheEntry {
  readonly objectId: StructuralObject["objectId"];
  readonly frame: StructuralObject["frame"];
  readonly source: StructuralObject["source"];
  readonly materials: StructuralObject["materials"];
  readonly anchors: StructuralObject["anchors"];
  readonly joints: StructuralObject["joints"];
  readonly projection: ReturnType<typeof createStructuralObjectContentProjection>;
}

const objectContentProjectionByBricks = new WeakMap<object, StructuralObjectContentProjectionCacheEntry>();

export const projectStructuralObjectContent = (
  object: StructuralObject | StructuralObjectV2
): ReturnType<typeof createStructuralObjectContentProjection> => {
  const cached = objectContentProjectionByBricks.get(object.bricks);
  if (
    cached !== undefined
    && cached.objectId === object.objectId
    && cached.frame === object.frame
    && cached.source === object.source
    && cached.materials === object.materials
    && cached.anchors === object.anchors
    && cached.joints === object.joints
  ) return cached.projection;
  const projection = createStructuralObjectContentProjection(object);
  if (hasDeepFrozenIdentity(object.bricks)) {
    objectContentProjectionByBricks.set(object.bricks, {
      objectId: object.objectId,
      frame: object.frame,
      source: object.source,
      materials: object.materials,
      anchors: object.anchors,
      joints: object.joints,
      projection
    });
  }
  return projection;
};

const createStructuralCommandEvidenceProjection = (evidence: StructuralCommandEvidence) => deepFreeze({
  ...evidence,
  changedBrickKeys: structuralDenseArray(evidence.changedBrickKeys, "evidence/changedBrickKeys", STRUCTURAL_MAX_CHANGED_BRICK_KEYS).map((key) => serializeAdaptiveKey(key as StructuralCommandEvidence["changedBrickKeys"][number]))
});

const evidenceProjectionByIdentity = new WeakMap<object, ReturnType<typeof createStructuralCommandEvidenceProjection>>();

export const projectStructuralCommandEvidence = (
  evidence: StructuralCommandEvidence
): ReturnType<typeof createStructuralCommandEvidenceProjection> => {
  const cached = evidenceProjectionByIdentity.get(evidence);
  if (cached !== undefined) return cached;
  const projection = createStructuralCommandEvidenceProjection(evidence);
  if (hasDeepFrozenIdentity(evidence)) evidenceProjectionByIdentity.set(evidence, projection);
  return projection;
};

export const projectStructuralObject = (object: StructuralObject) => deepFreeze({
  ...projectStructuralObjectContent(object),
  objectRevision: object.objectRevision,
  editRevision: object.editRevision,
  contentHash: object.contentHash,
  commandEvidence: structuralDenseArray(object.commandEvidence, "object/commandEvidence", STRUCTURAL_MAX_COMMAND_EVIDENCE).map((entry) => projectStructuralCommandEvidence(entry as StructuralCommandEvidence)),
  evidenceHash: object.evidenceHash
});

export const projectStructuralObjectV2 = (object: StructuralObjectV2) => deepFreeze({
  ...projectStructuralObjectContent(object),
  schemaVersion: object.schemaVersion,
  objectRevision: object.objectRevision,
  editRevision: object.editRevision,
  contentHash: object.contentHash,
  evidenceArchive: object.evidenceArchive
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

export const projectStructuralResultV2 = (result: StructuralResultV2) => deepFreeze(
  result.status === "Rejected" ? {
    schemaVersion: result.schemaVersion,
    status: result.status,
    commandId: result.commandId,
    object: projectStructuralObjectV2(result.object),
    code: result.code,
    path: result.path,
    resultHash: result.resultHash
  } : {
    schemaVersion: result.schemaVersion,
    status: result.status,
    commandId: result.commandId,
    object: projectStructuralObjectV2(result.object),
    changedBrickKeys: result.changedBrickKeys.map((key) => serializeAdaptiveKey(key)),
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
  canonicalAdaptiveJson(validateStructuralDestructionCommand(command));

export const serializeStructuralTransferCommand = (
  command: StructuralTransferDetachedComponentsCommand
): string => canonicalAdaptiveJson(validateStructuralTransferDetachedComponentsCommand(command));

export const serializeStructuralTransferCommandV2 = (
  command: StructuralTransferDetachedComponentsCommandV2
): string => canonicalAdaptiveJson(validateStructuralTransferDetachedComponentsCommandV2(command));

export const serializeStructuralObjectV2 = (object: StructuralObjectV2): string =>
  canonicalAdaptiveJson(projectStructuralObjectV2(object));

export const serializeStructuralResultV2 = (result: StructuralResultV2): string =>
  canonicalAdaptiveJson(projectStructuralResultV2(result));

export const serializeStructuralResult = (result: StructuralCommandResult): string =>
  canonicalAdaptiveJson(projectStructuralResult(result));

export const hashStructuralObjectContent = (object: StructuralObject | StructuralObjectV2): string =>
  hashAdaptiveCanonical(projectStructuralObjectContent(object));

export const hashStructuralEvidence = (evidence: readonly StructuralCommandEvidence[]): string =>
  hashAdaptiveCanonical(deepFreeze(
    structuralDenseArray(evidence, "commandEvidence", STRUCTURAL_MAX_COMMAND_EVIDENCE)
      .map((entry) => projectStructuralCommandEvidence(entry as StructuralCommandEvidence))
  ));

export const hashStructuralCommand = (command: StructuralDestructionCommand): string =>
  hashAdaptiveCanonical(validateStructuralDestructionCommand(command));

export const hashStructuralTransferCommand = (
  command: StructuralTransferDetachedComponentsCommand
): string => hashAdaptiveCanonical(validateStructuralTransferDetachedComponentsCommand(command));

export const hashStructuralTransferCommandV2 = (
  command: StructuralTransferDetachedComponentsCommandV2
): string => hashAdaptiveCanonical(validateStructuralTransferDetachedComponentsCommandV2(command));

export const hashStructuralOrderedFragmentIdsV2 = (
  fragmentIds: readonly StructuralFragmentId[]
): string => hashAdaptiveCanonical({
  schemaVersion: "structural-microvoxel-ordered-fragment-ids-v2",
  fragmentIds: [...fragmentIds]
});

export const hashStructuralClassificationV2 = (
  object: StructuralObject | StructuralObjectV2,
  classification: StructuralComponentClassification
): string => hashAdaptiveCanonical({
  schemaVersion: "structural-microvoxel-classification-v2",
  objectId: object.objectId,
  objectRevision: object.objectRevision,
  editRevision: object.editRevision,
  contentHash: object.contentHash,
  authorityHash: hashStructuralAdaptiveAuthorityBinding(object.source),
  fragments: classification.fragments.map((fragment) => ({
    schemaVersion: fragment.schemaVersion,
    fragmentIdVersion: fragment.fragmentIdVersion,
    fragmentId: fragment.fragmentId,
    componentId: fragment.componentId,
    objectId: fragment.objectId,
    objectRevision: fragment.objectRevision,
    sourceContentHash: fragment.sourceContentHash,
    sourceAdaptiveAuthorityDigest: fragment.sourceAdaptiveAuthorityDigest,
    occupiedCells: fragment.occupiedCells.map(projectCell),
    fragmentContentHash: fragment.fragmentContentHash
  }))
});

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

export const hashStructuralResultV2 = (result: StructuralResultV2): string =>
  hashAdaptiveCanonical(result.status === "Rejected" ? {
    schemaVersion: result.schemaVersion,
    status: result.status,
    commandId: result.commandId,
    object: projectStructuralObjectV2(result.object),
    code: result.code,
    path: result.path
  } : {
    schemaVersion: result.schemaVersion,
    status: result.status,
    commandId: result.commandId,
    object: projectStructuralObjectV2(result.object),
    changedBrickKeys: result.changedBrickKeys.map((key) => serializeAdaptiveKey(key)),
    selectedVoxelCount: result.selectedVoxelCount,
    changedVoxelCount: result.changedVoxelCount,
    invalidations: result.invalidations
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

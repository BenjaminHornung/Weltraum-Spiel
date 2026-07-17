import {
  ADAPTIVE_BRICK_CELLS_PER_AXIS,
  adaptiveLevel as adaptiveAuthorityLevel,
  compareAdaptiveBrickKeys as adaptiveCompareBrickKeys,
  deepFreeze,
  globalQuantumCoordinate as adaptiveGlobalQuantumCoordinate,
  keyFromGlobalQuantum as adaptiveKeyFromGlobalQuantum,
  serializeAdaptiveKey as adaptiveSerializeKey,
  stableAuthorityId as adaptiveStableAuthorityId,
  type AdaptiveBrickKey,
  type QuantumBounds,
  type QuantumPoint,
  type StableAuthorityId
} from "../adaptive";
import {
  globalBoundsForObjectLocal,
  globalQuantumForObjectLocal,
  globalQuantumForStructuralCell
} from "./coordinates";
import {
  hashStructuralCommand,
  hashStructuralObjectContent,
  hashStructuralResult
} from "./canonical";
import { deriveStructuralComponentClassification, StructuralConnectivityError } from "./connectivity";
import { reconstructStructuralObjectInternal, structuralAddressForBrickCell } from "./model";
import { deriveStructuralObjectMassProperties, StructuralMassError } from "./massProperties";
import {
  STRUCTURAL_BRICK_SCHEMA_VERSION,
  STRUCTURAL_COMMAND_EVIDENCE_SCHEMA_VERSION,
  STRUCTURAL_RESULT_SCHEMA_VERSION,
  type StructuralAcceptedCommandResult,
  type StructuralBrick,
  type StructuralCommandEvidence,
  type StructuralCommandResult,
  type StructuralDestructionCommand,
  type StructuralMaterialDefinition,
  type StructuralObject,
  type StructuralRejectedCommandResult,
  type StructuralRejectionCode,
  type StructuralVoxelState
} from "./types";
import {
  StructuralValidationError,
  normalizeAdaptiveAuthorityFunction,
  structuralRevision,
  validateStructuralDestructionCommand
} from "./validation";

const adaptiveLevel = normalizeAdaptiveAuthorityFunction(adaptiveAuthorityLevel);
const compareAdaptiveBrickKeys = normalizeAdaptiveAuthorityFunction(adaptiveCompareBrickKeys);
const globalQuantumCoordinate = normalizeAdaptiveAuthorityFunction(adaptiveGlobalQuantumCoordinate);
const keyFromGlobalQuantum = normalizeAdaptiveAuthorityFunction(adaptiveKeyFromGlobalQuantum);
const serializeAdaptiveKey = normalizeAdaptiveAuthorityFunction(adaptiveSerializeKey);
const stableAuthorityId = normalizeAdaptiveAuthorityFunction(adaptiveStableAuthorityId);

class StructuralCommandError extends Error {
  readonly code: StructuralRejectionCode;
  readonly path: string;

  constructor(code: StructuralRejectionCode, path: string, message: string) {
    super(message);
    this.name = "StructuralCommandError";
    this.code = code;
    this.path = path;
  }
}

interface GlobalSelection {
  readonly bounds: QuantumBounds;
  readonly sphere: Readonly<{ center: QuantumPoint; radius: number }> | null;
}

const safeInteger = (value: number, path: string): number => {
  if (!Number.isSafeInteger(value) || Object.is(value, -0)) {
    throw new StructuralCommandError("ArithmeticOverflow", path, "Structural command arithmetic exceeded safe integers.");
  }
  return value;
};

const safeAdd = (left: number, right: number, path: string): number => safeInteger(left + right, path);
const safeMultiply = (left: number, right: number, path: string): number => safeInteger(left * right, path);

const safeSquaredDistance = (dx: number, dy: number, dz: number, path: string): number => {
  const xx = safeMultiply(dx, dx, `${path}/x`);
  const yy = safeMultiply(dy, dy, `${path}/y`);
  const zz = safeMultiply(dz, dz, `${path}/z`);
  return safeAdd(safeAdd(xx, yy, path), zz, path);
};

const globalSelection = (command: StructuralDestructionCommand, object: StructuralObject): GlobalSelection => {
  if (command.shape.kind === "box") {
    const bounds = command.shape.space === "global-quantum"
      ? command.shape.boundsQuantum
      : globalBoundsForObjectLocal(command.shape.boundsQuantum, object.frame);
    return deepFreeze({ bounds, sphere: null });
  }
  const center = command.shape.space === "global-quantum"
    ? command.shape.centerQuantum
    : globalQuantumForObjectLocal(command.shape.centerQuantum, object.frame);
  const radius = command.shape.radiusQuantum;
  const bounds = deepFreeze({
    min: deepFreeze({
      x: safeAdd(center.x, -radius, "command/shape/bounds/min/x"),
      y: safeAdd(center.y, -radius, "command/shape/bounds/min/y"),
      z: safeAdd(center.z, -radius, "command/shape/bounds/min/z")
    }),
    max: deepFreeze({
      x: safeAdd(center.x, radius, "command/shape/bounds/max/x"),
      y: safeAdd(center.y, radius, "command/shape/bounds/max/y"),
      z: safeAdd(center.z, radius, "command/shape/bounds/max/z")
    })
  }) as QuantumBounds;
  safeMultiply(radius, 2, "command/shape/radiusQuantum");
  return deepFreeze({ bounds, sphere: deepFreeze({ center, radius }) });
};

const doubledCenterDelta = (cellOrigin: number, center: number, path: string): number =>
  safeAdd(safeAdd(safeMultiply(cellOrigin, 2, path), 1, path), -safeMultiply(center, 2, path), path);

const sphereContainsCell = (sphere: NonNullable<GlobalSelection["sphere"]>, cell: QuantumPoint): boolean => {
  const dx = doubledCenterDelta(cell.x, sphere.center.x, "command/shape/distance/x");
  const dy = doubledCenterDelta(cell.y, sphere.center.y, "command/shape/distance/y");
  const dz = doubledCenterDelta(cell.z, sphere.center.z, "command/shape/distance/z");
  const diameter = safeMultiply(sphere.radius, 2, "command/shape/radiusQuantum");
  return safeSquaredDistance(dx, dy, dz, "command/shape/distance") <= safeMultiply(diameter, diameter, "command/shape/radiusSquared");
};

const nearestDoubledCellDelta = (origin: number, center: number, path: string): number => {
  const first = safeAdd(safeMultiply(origin, 2, path), 1, path);
  const lastOrigin = safeAdd(origin, ADAPTIVE_BRICK_CELLS_PER_AXIS - 1, path);
  const last = safeAdd(safeMultiply(lastOrigin, 2, path), 1, path);
  const doubledCenter = safeMultiply(center, 2, path);
  if (doubledCenter < first) return safeAdd(first, -doubledCenter, path);
  if (doubledCenter > last) return safeAdd(doubledCenter, -last, path);
  return 1;
};

const sphereIntersectsBrickCells = (sphere: NonNullable<GlobalSelection["sphere"]>, key: AdaptiveBrickKey): boolean => {
  const dx = nearestDoubledCellDelta(key.originQuantum.x, sphere.center.x, "command/coverage/x");
  const dy = nearestDoubledCellDelta(key.originQuantum.y, sphere.center.y, "command/coverage/y");
  const dz = nearestDoubledCellDelta(key.originQuantum.z, sphere.center.z, "command/coverage/z");
  const diameter = safeMultiply(sphere.radius, 2, "command/shape/radiusQuantum");
  return safeSquaredDistance(dx, dy, dz, "command/coverage") <= safeMultiply(diameter, diameter, "command/coverage/radiusSquared");
};

const requiredBrickKeys = (
  object: StructuralObject,
  selection: GlobalSelection,
  maxVisitedBricks: number
): readonly AdaptiveBrickKey[] => {
  const maxCell = deepFreeze({
    x: safeAdd(selection.bounds.max.x, -1, "command/shape/bounds/max/x"),
    y: safeAdd(selection.bounds.max.y, -1, "command/shape/bounds/max/y"),
    z: safeAdd(selection.bounds.max.z, -1, "command/shape/bounds/max/z")
  });
  const first = keyFromGlobalQuantum(object.frame.bodyId, object.frame.surfaceFrameId, object.frame.regionId, object.frame.generatorVersion, adaptiveLevel(4), selection.bounds.min);
  const last = keyFromGlobalQuantum(object.frame.bodyId, object.frame.surfaceFrameId, object.frame.regionId, object.frame.generatorVersion, adaptiveLevel(4), maxCell);
  const axisCount = (start: number, end: number, path: string): number =>
    safeAdd(safeInteger((end - start) / ADAPTIVE_BRICK_CELLS_PER_AXIS, path), 1, path);
  const countX = axisCount(first.originQuantum.x, last.originQuantum.x, "command/coverage/x");
  const countY = axisCount(first.originQuantum.y, last.originQuantum.y, "command/coverage/y");
  const countZ = axisCount(first.originQuantum.z, last.originQuantum.z, "command/coverage/z");
  const boundingCount = safeMultiply(safeMultiply(countX, countY, "command/coverage/count"), countZ, "command/coverage/count");
  if (boundingCount > maxVisitedBricks) {
    throw new StructuralCommandError("BudgetExceeded", "command/budgets/maxVisitedBricks", "Shape coverage exceeded the explicit visited-brick budget.");
  }
  const keys: AdaptiveBrickKey[] = [];
  for (let z: number = first.originQuantum.z; z <= last.originQuantum.z; z = safeAdd(z, ADAPTIVE_BRICK_CELLS_PER_AXIS, "command/coverage/z")) {
    for (let y: number = first.originQuantum.y; y <= last.originQuantum.y; y = safeAdd(y, ADAPTIVE_BRICK_CELLS_PER_AXIS, "command/coverage/y")) {
      for (let x: number = first.originQuantum.x; x <= last.originQuantum.x; x = safeAdd(x, ADAPTIVE_BRICK_CELLS_PER_AXIS, "command/coverage/x")) {
        const key = keyFromGlobalQuantum(object.frame.bodyId, object.frame.surfaceFrameId, object.frame.regionId, object.frame.generatorVersion, adaptiveLevel(4), {
          x: globalQuantumCoordinate(x, "command/coverage/x"),
          y: globalQuantumCoordinate(y, "command/coverage/y"),
          z: globalQuantumCoordinate(z, "command/coverage/z")
        });
        if (selection.sphere === null || sphereIntersectsBrickCells(selection.sphere, key)) keys.push(key);
      }
    }
  }
  if (keys.length > maxVisitedBricks) {
    throw new StructuralCommandError("BudgetExceeded", "command/budgets/maxVisitedBricks", "Shape coverage exceeded the explicit visited-brick budget.");
  }
  return deepFreeze(keys.sort(compareAdaptiveBrickKeys));
};

const materialPasses = (command: StructuralDestructionCommand, materialId: number): boolean =>
  command.materialFilter === null || command.materialFilter.materialIds.some((candidate) => candidate === materialId);

const selectedByShape = (selection: GlobalSelection, cell: QuantumPoint): boolean => selection.sphere === null
  ? cell.x >= selection.bounds.min.x && cell.x < selection.bounds.max.x &&
    cell.y >= selection.bounds.min.y && cell.y < selection.bounds.max.y &&
    cell.z >= selection.bounds.min.z && cell.z < selection.bounds.max.z
  : sphereContainsCell(selection.sphere, cell);

const changedState = (
  command: StructuralDestructionCommand,
  state: StructuralVoxelState,
  material: StructuralMaterialDefinition
): StructuralVoxelState | null | undefined => {
  if (!materialPasses(command, state.materialId)) return undefined;
  if (command.kind === "SubtractSphere" || command.kind === "SubtractBox") return material.destructible ? null : undefined;
  if (state.materialId === command.materialId) return undefined;
  return deepFreeze({ ...state, materialId: command.materialId });
};

const rebuildBricks = (
  object: StructuralObject,
  changes: ReadonlyMap<string, ReadonlyMap<number, StructuralVoxelState | null>>
): readonly StructuralBrick[] => deepFreeze(object.bricks.map((brick) => {
  const brickChanges = changes.get(serializeAdaptiveKey(brick.key));
  if (brickChanges === undefined) return brick;
  const cells = brick.cells.flatMap((cell) => {
    const replacement = brickChanges.get(cell.localIndex);
    if (replacement === undefined) return [cell];
    return replacement === null ? [] : [deepFreeze({ localIndex: cell.localIndex, state: replacement })];
  });
  return deepFreeze({ schemaVersion: STRUCTURAL_BRICK_SCHEMA_VERSION, key: brick.key, cells: deepFreeze(cells) });
}));

const publishStructuralObject = (
  previous: StructuralObject,
  bricks: readonly StructuralBrick[],
  objectRevision: number,
  editRevision: number,
  evidence: readonly StructuralCommandEvidence[]
): StructuralObject => reconstructStructuralObjectInternal({
  objectId: previous.objectId,
  frame: previous.frame,
  source: previous.source,
  materials: previous.materials,
  bricks,
  anchors: previous.anchors,
  joints: previous.joints,
  objectRevision,
  editRevision,
  commandEvidence: evidence
});

const buildDerivationCandidate = (
  previous: StructuralObject,
  bricks: readonly StructuralBrick[],
  objectRevision: number,
  editRevision: number
): StructuralObject => {
  const candidate = deepFreeze({
    ...previous,
    bricks,
    objectRevision,
    editRevision,
    contentHash: ""
  }) as StructuralObject;
  return deepFreeze({ ...candidate, contentHash: hashStructuralObjectContent(candidate) });
};

const commandIdFromUnknown = (value: unknown): StableAuthorityId | null => {
  if (typeof value !== "object" || value === null || !Object.hasOwn(value, "commandId")) return null;
  const candidate = (value as { readonly commandId?: unknown }).commandId;
  if (typeof candidate !== "string") return null;
  try {
    return stableAuthorityId(candidate, "command/commandId");
  } catch {
    return null;
  }
};

const rejected = (
  object: StructuralObject,
  commandId: StableAuthorityId | null,
  code: StructuralRejectionCode,
  path: string
): StructuralRejectedCommandResult => {
  const partial = deepFreeze({
    schemaVersion: STRUCTURAL_RESULT_SCHEMA_VERSION,
    status: "Rejected" as const,
    commandId,
    object,
    code,
    path,
    resultHash: ""
  });
  return deepFreeze({ ...partial, resultHash: hashStructuralResult(partial) });
};

const rejectionFromError = (object: StructuralObject, commandId: StableAuthorityId | null, error: unknown): StructuralRejectedCommandResult => {
  if (error instanceof StructuralCommandError) return rejected(object, commandId, error.code, error.path);
  if (error instanceof StructuralConnectivityError) return rejected(object, commandId, "ConnectivityRejected", error.path);
  if (error instanceof StructuralMassError) return rejected(object, commandId, error.code === "BudgetExceeded" ? "BudgetExceeded" : "MassRejected", error.path);
  if (error instanceof StructuralValidationError) {
    const code: StructuralRejectionCode = error.code === "InvalidMaterial"
      ? "InvalidMaterial"
      : error.code === "ArithmeticOverflow"
        ? "ArithmeticOverflow"
        : error.code === "InvalidAdaptiveBinding"
          ? "StaleAdaptiveAuthority"
          : "InvalidContract";
    return rejected(object, commandId, code, error.path);
  }
  const path = typeof error === "object" && error !== null && "path" in error && typeof error.path === "string" ? error.path : "command";
  return rejected(object, commandId, "InvalidContract", path);
};

export const applyStructuralDestructionCommand = (
  object: StructuralObject,
  commandValue: unknown
): StructuralCommandResult => {
  const fallbackCommandId = commandIdFromUnknown(commandValue);
  try {
    const command = validateStructuralDestructionCommand(commandValue);
    if (command.targetObjectId !== object.objectId) throw new StructuralCommandError("WrongTarget", "command/targetObjectId", "Command target does not match the Structural object.");
    if (command.expectedObjectRevision !== object.objectRevision) throw new StructuralCommandError("RevisionConflict", "command/expectedObjectRevision", "Command expected revision does not match the Structural object.");
    const expectedResultingRevision = safeAdd(command.expectedObjectRevision, 1, "command/resultingObjectRevision");
    if (command.resultingObjectRevision !== expectedResultingRevision) throw new StructuralCommandError("RevisionConflict", "command/resultingObjectRevision", "Resulting object revision must equal expected revision plus one.");
    if (object.commandEvidence.some((entry) => entry.commandId === command.commandId)) throw new StructuralCommandError("DuplicateCommand", "command/commandId", "Command ID was already consumed.");
    if ((command.kind === "SetMaterialSphere" || command.kind === "SetMaterialBox") && !object.materials.some((material) => material.materialId === command.materialId)) {
      throw new StructuralCommandError("InvalidMaterial", "command/materialId", "SetMaterial target requires an explicit Structural material definition.");
    }

    const selection = globalSelection(command, object);
    const requiredKeys = requiredBrickKeys(object, selection, command.budgets.maxVisitedBricks);
    const bricksByKey = new Map(object.bricks.map((brick) => [serializeAdaptiveKey(brick.key), brick]));
    for (const key of requiredKeys) {
      if (!bricksByKey.has(serializeAdaptiveKey(key))) {
        throw new StructuralCommandError("MissingBrickCoverage", "command/shape", "Selected shape intersects a missing Structural brick.");
      }
    }

    const materials = new Map(object.materials.map((material) => [material.materialId, material]));
    const changes = new Map<string, Map<number, StructuralVoxelState | null>>();
    let visitedVoxelCount = 0;
    let selectedVoxelCount = 0;
    let changedVoxelCount = 0;
    for (const key of requiredKeys) {
      const serializedKey = serializeAdaptiveKey(key);
      const brick = bricksByKey.get(serializedKey);
      if (brick === undefined) throw new StructuralCommandError("MissingBrickCoverage", "command/shape", "Selected shape intersects a missing Structural brick.");
      for (const cell of brick.cells) {
        visitedVoxelCount += 1;
        if (visitedVoxelCount > command.budgets.maxVisitedCells) throw new StructuralCommandError("BudgetExceeded", "command/budgets/maxVisitedCells", "Sparse cell traversal exceeded the explicit visited-cell budget.");
        const address = structuralAddressForBrickCell(brick, cell.localIndex);
        if (!selectedByShape(selection, globalQuantumForStructuralCell(address))) continue;
        selectedVoxelCount += 1;
        if (selectedVoxelCount > command.budgets.maxSelectedCells) throw new StructuralCommandError("BudgetExceeded", "command/budgets/maxSelectedCells", "Selected cells exceeded the explicit selection budget.");
        const material = materials.get(cell.state.materialId);
        if (material === undefined) throw new StructuralCommandError("InvalidMaterial", "object/bricks/cells/materialId", "Occupied cell material has no Structural definition.");
        const replacement = changedState(command, cell.state, material);
        if (replacement === undefined) continue;
        changedVoxelCount += 1;
        if (changedVoxelCount > command.budgets.maxChangedCells) throw new StructuralCommandError("BudgetExceeded", "command/budgets/maxChangedCells", "Changed cells exceeded the explicit mutation budget.");
        let brickChanges = changes.get(serializedKey);
        if (brickChanges === undefined) {
          brickChanges = new Map();
          changes.set(serializedKey, brickChanges);
        }
        brickChanges.set(cell.localIndex, replacement);
      }
    }

    const applied = changedVoxelCount > 0;
    const status = applied ? "Applied" as const : "NoChange" as const;
    const resultingEditRevision = applied
      ? structuralRevision(safeAdd(object.editRevision, 1, "object/editRevision"), "object/editRevision")
      : object.editRevision;
    const candidateBricks = applied ? rebuildBricks(object, changes) : object.bricks;
    const preliminary = buildDerivationCandidate(object, candidateBricks, command.resultingObjectRevision, resultingEditRevision);
    deriveStructuralComponentClassification(preliminary, {
      maxVisitedCells: command.budgets.maxConnectivityCells,
      maxComponents: command.budgets.maxComponents
    });
    deriveStructuralObjectMassProperties(preliminary, { maxVisitedCells: command.budgets.maxMassCells });

    const changedBrickKeys = deepFreeze(requiredKeys.filter((key) => changes.has(serializeAdaptiveKey(key))));
    const evidence: StructuralCommandEvidence = deepFreeze({
      schemaVersion: STRUCTURAL_COMMAND_EVIDENCE_SCHEMA_VERSION,
      commandId: command.commandId,
      commandHash: hashStructuralCommand(command),
      status,
      previousObjectRevision: object.objectRevision,
      resultingObjectRevision: command.resultingObjectRevision,
      previousEditRevision: object.editRevision,
      resultingEditRevision,
      previousContentHash: object.contentHash,
      resultingContentHash: preliminary.contentHash,
      changedBrickKeys,
      selectedVoxelCount,
      changedVoxelCount,
      adaptiveJournalDigest: object.source.journalDigest
    });
    const resultObject = publishStructuralObject(object, candidateBricks, command.resultingObjectRevision, resultingEditRevision, deepFreeze([...object.commandEvidence, evidence]));
    const invalidations = applied ? deepFreeze([
      deepFreeze({ kind: "Components" as const, sourceObjectRevision: object.objectRevision, sourceContentHash: object.contentHash }),
      deepFreeze({ kind: "MassProperties" as const, sourceObjectRevision: object.objectRevision, sourceContentHash: object.contentHash }),
      deepFreeze({ kind: "Mesh" as const, sourceObjectRevision: object.objectRevision, sourceContentHash: object.contentHash })
    ]) : deepFreeze([]);
    const partial: StructuralAcceptedCommandResult = deepFreeze({
      schemaVersion: STRUCTURAL_RESULT_SCHEMA_VERSION,
      status,
      commandId: command.commandId,
      object: resultObject,
      changedBrickKeys,
      selectedVoxelCount,
      changedVoxelCount,
      invalidations,
      resultHash: ""
    });
    return deepFreeze({ ...partial, resultHash: hashStructuralResult(partial) });
  } catch (error) {
    return rejectionFromError(object, fallbackCommandId, error);
  }
};

import {
  ADAPTIVE_BRICK_CELLS_PER_AXIS,
  adaptiveLevel as adaptiveAuthorityLevel,
  compareAdaptiveBrickKeys as adaptiveCompareBrickKeys,
  canonicalAdaptiveJson as adaptiveCanonicalJson,
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
  hashStructuralObjectContent,
  structuralCommandHashSteps,
  structuralResultHashSteps
} from "./canonical";
import { deriveStructuralComponentClassification, StructuralConnectivityError } from "./connectivity";
import { reconstructStructuralObjectInternal, structuralAddressForBrickCell, isIssuedStructuralObject,
  createStructuralOwnerLedger, ownedStructuralDerivationCandidateSteps, releaseOwnedStructuralDerivationCandidate,
  ownedStructuralReconstructionSteps } from "./model";
import { deriveStructuralObjectMassProperties, structuralOwnedObjectMassSteps, StructuralMassError } from "./massProperties";
import { structuralOwnedComponentClassificationSteps } from "./classificationSteps";
import type { StructuralCursorStep } from "./occupiedEntries";
import {
  STRUCTURAL_BRICK_SCHEMA_VERSION,
  STRUCTURAL_COMMAND_EVIDENCE_SCHEMA_VERSION,
  STRUCTURAL_RESULT_SCHEMA_VERSION,
  STRUCTURAL_MAX_COMMAND_EVIDENCE,
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
  structuralDestructionCommandValidationSteps,
  structuralDenseArraySteps,
  structuralFreezeArraySteps,
  structuralSortSteps,
  freezeStructuralProduced,
  structuralPositiveBudget,
  structuralFail,
  type StructuralOwnedReserve
} from "./validation";

const adaptiveLevel = normalizeAdaptiveAuthorityFunction(adaptiveAuthorityLevel);
const compareAdaptiveBrickKeys = normalizeAdaptiveAuthorityFunction(adaptiveCompareBrickKeys);
const canonicalAdaptiveJson = normalizeAdaptiveAuthorityFunction(adaptiveCanonicalJson);
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

function* requiredBrickKeySteps(
  object: StructuralObject,
  selection: GlobalSelection,
  maxVisitedBricks: number,
  reserve?: StructuralOwnedReserve
): Generator<void, readonly AdaptiveBrickKey[], void> {
  reserve?.(8_192);
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
        reserve?.(2_048);
        const key = keyFromGlobalQuantum(object.frame.bodyId, object.frame.surfaceFrameId, object.frame.regionId, object.frame.generatorVersion, adaptiveLevel(4), {
          x: globalQuantumCoordinate(x, "command/coverage/x"),
          y: globalQuantumCoordinate(y, "command/coverage/y"),
          z: globalQuantumCoordinate(z, "command/coverage/z")
        });
        if (selection.sphere === null || sphereIntersectsBrickCells(selection.sphere, key)) keys.push(key);
        if (reserve !== undefined) { yield; }
      }
    }
  }
  if (keys.length > maxVisitedBricks) {
    throw new StructuralCommandError("BudgetExceeded", "command/budgets/maxVisitedBricks", "Shape coverage exceeded the explicit visited-brick budget.");
  }
  return yield* structuralFreezeArraySteps(yield* structuralSortSteps(keys, compareAdaptiveBrickKeys, reserve), reserve);
}

const materialPasses = (command: StructuralDestructionCommand, materialId: number, ownedFilter?: ReadonlySet<number>): boolean =>
  command.materialFilter === null || (ownedFilter === undefined
    ? command.materialFilter.materialIds.some((candidate) => candidate === materialId) : ownedFilter.has(materialId));

const selectedByShape = (selection: GlobalSelection, cell: QuantumPoint): boolean => selection.sphere === null
  ? cell.x >= selection.bounds.min.x && cell.x < selection.bounds.max.x &&
    cell.y >= selection.bounds.min.y && cell.y < selection.bounds.max.y &&
    cell.z >= selection.bounds.min.z && cell.z < selection.bounds.max.z
  : sphereContainsCell(selection.sphere, cell);

const changedState = (
  command: StructuralDestructionCommand,
  state: StructuralVoxelState,
  material: StructuralMaterialDefinition,
  ownedFilter?: ReadonlySet<number>
): StructuralVoxelState | null | undefined => {
  if (!materialPasses(command, state.materialId, ownedFilter)) return undefined;
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

function* rebuildBrickSteps(object: StructuralObject, changes: ReadonlyMap<string, ReadonlyMap<number, StructuralVoxelState | null>>,
  reserve?: StructuralOwnedReserve): Generator<void, readonly StructuralBrick[], void> {
  if (reserve === undefined) { return rebuildBricks(object, changes); }
  reserve(64);
  const bricks: StructuralBrick[] = [];
  for (const brick of object.bricks) {
    reserve(3_072);
    const brickChanges = changes.get(serializeAdaptiveKey(brick.key));
    if (brickChanges === undefined) { bricks.push(brick); yield; continue; }
    const cells: StructuralBrick["cells"][number][] = [];
    for (const cell of brick.cells) {
      reserve(512);
      const replacement = brickChanges.get(cell.localIndex);
      if (replacement === undefined) { cells.push(cell); }
      else if (replacement !== null) { cells.push(Object.freeze({ localIndex: cell.localIndex, state: replacement })); }
      yield;
    }
    bricks.push(Object.freeze({ schemaVersion: STRUCTURAL_BRICK_SCHEMA_VERSION, key: brick.key,
      cells: yield* structuralFreezeArraySteps(cells, reserve) }));
    yield;
  }
  return yield* structuralFreezeArraySteps(bricks, reserve);
}

function* sameOwnedSourceSteps(command: StructuralDestructionCommand, object: StructuralObject): Generator<void, boolean, void> {
  const expected = command.expectedAdaptiveSource, actual = object.source;
  for (const field of ["schemaVersion", "baseFieldIdentity", "baseFieldVersion", "baseFieldDescriptorDigest", "journalDigest",
    "snapshotProjectionDigest", "sourceRevision", "editRevision", "brickRevision", "planningEpoch"] as const) {
    if (expected[field] !== actual[field]) { return false; }
    yield;
  }
  if (expected.proofDigests.length !== actual.proofDigests.length) { return false; }
  for (let index = 0; index < expected.proofDigests.length; index += 1) {
    if (expected.proofDigests[index] !== actual.proofDigests[index]) { return false; }
    yield;
  }
  return true;
}

function* evidenceContainsSteps(evidence: readonly unknown[], commandId: StableAuthorityId, reserve?: StructuralOwnedReserve): Generator<void, boolean, void> {
  if (reserve === undefined) { return evidence.some((entry) => (entry as StructuralCommandEvidence).commandId === commandId); }
  for (const entry of evidence) {
    if ((entry as StructuralCommandEvidence).commandId === commandId) { return true; }
    yield;
  }
  return false;
}

function* materialExistsSteps(object: StructuralObject, materialId: number, reserve?: StructuralOwnedReserve): Generator<void, boolean, void> {
  if (reserve === undefined) { return object.materials.some((material) => material.materialId === materialId); }
  for (const material of object.materials) {
    if (material.materialId === materialId) { return true; }
    yield;
  }
  return false;
}

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
  if (typeof value !== "object" || value === null) return null;
  const descriptor = Object.getOwnPropertyDescriptor(value, "commandId");
  if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) return null;
  const candidate = descriptor.value;
  if (typeof candidate !== "string") return null;
  try {
    return stableAuthorityId(candidate, "command/commandId");
  } catch {
    return null;
  }
};

function* rejectedSteps(
  object: StructuralObject,
  commandId: StableAuthorityId | null,
  code: StructuralRejectionCode,
  path: string,
  reserve?: StructuralOwnedReserve
): Generator<void, StructuralRejectedCommandResult, void> {
  reserve?.(2_048, true);
  const partial = freezeStructuralProduced({
    schemaVersion: STRUCTURAL_RESULT_SCHEMA_VERSION,
    status: "Rejected" as const,
    commandId,
    object,
    code,
    path,
    resultHash: ""
  }, reserve);
  return freezeStructuralProduced({ ...partial, resultHash: yield* structuralResultHashSteps(partial, reserve) }, reserve);
}

function* rejectionFromErrorSteps(object: StructuralObject, commandId: StableAuthorityId | null, error: unknown,
  reserve?: StructuralOwnedReserve): Generator<void, StructuralRejectedCommandResult, void> {
  if (error instanceof StructuralCommandError) { return yield* rejectedSteps(object, commandId, error.code, error.path, reserve); }
  if (error instanceof StructuralConnectivityError) { return yield* rejectedSteps(object, commandId, "ConnectivityRejected", error.path, reserve); }
  if (error instanceof StructuralMassError) { return yield* rejectedSteps(object, commandId, error.code === "BudgetExceeded" ? "BudgetExceeded" : "MassRejected", error.path, reserve); }
  if (error instanceof StructuralValidationError) {
    const code: StructuralRejectionCode = error.code === "InvalidMaterial"
      ? "InvalidMaterial"
      : error.code === "ArithmeticOverflow"
        ? "ArithmeticOverflow"
        : error.code === "InvalidAdaptiveBinding"
          ? "StaleAdaptiveAuthority"
          : "InvalidContract";
    return yield* rejectedSteps(object, commandId, code, error.path, reserve);
  }
  const path = typeof error === "object" && error !== null && "path" in error && typeof error.path === "string" ? error.path : "command";
  return yield* rejectedSteps(object, commandId, "InvalidContract", path, reserve);
}

function* structuralCommandSteps(
  object: StructuralObject,
  commandValue: unknown,
  reserve?: StructuralOwnedReserve
): Generator<void | string, StructuralCommandResult, void> {
  const fallbackCommandId = commandIdFromUnknown(commandValue);
  try {
    const command = yield* structuralDestructionCommandValidationSteps(commandValue, "command", reserve);
    reserve?.(512);
    if (reserve === undefined ? canonicalAdaptiveJson(command.expectedAdaptiveSource) !== canonicalAdaptiveJson(object.source)
      : !(yield* sameOwnedSourceSteps(command, object))) {
      throw new StructuralCommandError("StaleAdaptiveAuthority", "command/expectedAdaptiveSource", "Command Adaptive source/revisions/epoch/digests do not match the Structural object.");
    }
    const commandEvidence = yield* structuralDenseArraySteps(object.commandEvidence, "object/commandEvidence", STRUCTURAL_MAX_COMMAND_EVIDENCE, reserve);
    if (commandEvidence.length >= STRUCTURAL_MAX_COMMAND_EVIDENCE) {
      throw new StructuralCommandError("BudgetExceeded", "object/commandEvidence", "Structural command evidence reached the fixed V1 history cap before append.");
    }
    if (command.targetObjectId !== object.objectId) throw new StructuralCommandError("WrongTarget", "command/targetObjectId", "Command target does not match the Structural object.");
    if (command.expectedObjectRevision !== object.objectRevision) throw new StructuralCommandError("RevisionConflict", "command/expectedObjectRevision", "Command expected revision does not match the Structural object.");
    const expectedResultingRevision = safeAdd(command.expectedObjectRevision, 1, "command/resultingObjectRevision");
    if (command.resultingObjectRevision !== expectedResultingRevision) throw new StructuralCommandError("RevisionConflict", "command/resultingObjectRevision", "Resulting object revision must equal expected revision plus one.");
    if (yield* evidenceContainsSteps(commandEvidence, command.commandId, reserve)) { throw new StructuralCommandError("DuplicateCommand", "command/commandId", "Command ID was already consumed."); }
    if ((command.kind === "SetMaterialSphere" || command.kind === "SetMaterialBox") && !(yield* materialExistsSteps(object, command.materialId, reserve))) {
      throw new StructuralCommandError("InvalidMaterial", "command/materialId", "SetMaterial target requires an explicit Structural material definition.");
    }

    reserve?.(8_192);
    const selection = globalSelection(command, object);
    if (reserve !== undefined) { yield; }
    const requiredKeys = yield* requiredBrickKeySteps(object, selection, command.budgets.maxVisitedBricks, reserve);
    let bricksByKey: Map<string, StructuralBrick>;
    if (reserve === undefined) { bricksByKey = new Map(object.bricks.map((brick) => [serializeAdaptiveKey(brick.key), brick])); }
    else {
      reserve(64);
      bricksByKey = new Map();
      for (const brick of object.bricks) {
        reserve(3_072);
        bricksByKey.set(serializeAdaptiveKey(brick.key), brick);
        yield;
      }
    }
    for (const key of requiredKeys) {
      reserve?.(3_072);
      if (!bricksByKey.has(serializeAdaptiveKey(key))) {
        throw new StructuralCommandError("MissingBrickCoverage", "command/shape", "Selected shape intersects a missing Structural brick.");
      }
      if (reserve !== undefined) { yield; }
    }

    let materials: Map<number, StructuralMaterialDefinition>;
    if (reserve === undefined) { materials = new Map(object.materials.map((material) => [material.materialId, material])); }
    else {
      reserve(64);
      materials = new Map();
      for (const material of object.materials) {
        reserve(128);
        materials.set(material.materialId, material);
        yield;
      }
    }
    let ownedFilter: Set<number> | undefined;
    if (reserve !== undefined && command.materialFilter !== null) {
      reserve(64);
      ownedFilter = new Set();
      for (const id of command.materialFilter.materialIds) { reserve(128); ownedFilter.add(id); yield; }
    }
    reserve?.(64);
    const changes = new Map<string, Map<number, StructuralVoxelState | null>>();
    let visitedVoxelCount = 0;
    let selectedVoxelCount = 0;
    let changedVoxelCount = 0;
    for (const key of requiredKeys) {
      reserve?.(3_072);
      const serializedKey = serializeAdaptiveKey(key);
      const brick = bricksByKey.get(serializedKey);
      if (brick === undefined) throw new StructuralCommandError("MissingBrickCoverage", "command/shape", "Selected shape intersects a missing Structural brick.");
      for (const cell of brick.cells) {
        visitedVoxelCount += 1;
        if (visitedVoxelCount > command.budgets.maxVisitedCells) throw new StructuralCommandError("BudgetExceeded", "command/budgets/maxVisitedCells", "Sparse cell traversal exceeded the explicit visited-cell budget.");
        reserve?.(2_048);
        const address = structuralAddressForBrickCell(brick, cell.localIndex);
        if (!selectedByShape(selection, globalQuantumForStructuralCell(address))) {
          if (reserve !== undefined) { yield; }
          continue;
        }
        selectedVoxelCount += 1;
        if (selectedVoxelCount > command.budgets.maxSelectedCells) throw new StructuralCommandError("BudgetExceeded", "command/budgets/maxSelectedCells", "Selected cells exceeded the explicit selection budget.");
        const material = materials.get(cell.state.materialId);
        if (material === undefined) throw new StructuralCommandError("InvalidMaterial", "object/bricks/cells/materialId", "Occupied cell material has no Structural definition.");
        reserve?.(512);
        const replacement = changedState(command, cell.state, material, ownedFilter);
        if (replacement === undefined) { if (reserve !== undefined) { yield; } continue; }
        changedVoxelCount += 1;
        if (changedVoxelCount > command.budgets.maxChangedCells) throw new StructuralCommandError("BudgetExceeded", "command/budgets/maxChangedCells", "Changed cells exceeded the explicit mutation budget.");
        let brickChanges = changes.get(serializedKey);
        reserve?.(256);
        if (brickChanges === undefined) {
          brickChanges = new Map();
          changes.set(serializedKey, brickChanges);
        }
        brickChanges.set(cell.localIndex, replacement);
        if (reserve !== undefined) { yield; }
      }
      if (reserve !== undefined) { yield; }
    }

    const applied = changedVoxelCount > 0;
    const status = applied ? "Applied" as const : "NoChange" as const;
    const resultingEditRevision = applied
      ? structuralRevision(safeAdd(object.editRevision, 1, "object/editRevision"), "object/editRevision")
      : object.editRevision;
    const candidateBricks = applied ? yield* rebuildBrickSteps(object, changes, reserve) : object.bricks;
    const preliminary = reserve === undefined ? buildDerivationCandidate(object, candidateBricks, command.resultingObjectRevision, resultingEditRevision)
      : yield* ownedStructuralDerivationCandidateSteps(object, candidateBricks, command.resultingObjectRevision, resultingEditRevision, reserve);
    try {
    const connectivityBudgets = {
      maxVisitedCells: command.budgets.maxConnectivityCells,
      maxIndexedFacts: command.budgets.maxConnectivityFacts,
      maxComponents: command.budgets.maxComponents
    };
    if (reserve === undefined) {
      deriveStructuralComponentClassification(preliminary, connectivityBudgets);
      deriveStructuralObjectMassProperties(preliminary, { maxVisitedCells: command.budgets.maxMassCells });
    } else {
      yield* structuralOwnedComponentClassificationSteps(preliminary, connectivityBudgets, reserve);
      yield* structuralOwnedObjectMassSteps(preliminary, { maxVisitedCells: command.budgets.maxMassCells }, reserve);
    }

    let changedBrickKeys: readonly AdaptiveBrickKey[];
    if (reserve === undefined) { changedBrickKeys = deepFreeze(requiredKeys.filter((key) => changes.has(serializeAdaptiveKey(key)))); }
    else {
      reserve(64);
      const changed: AdaptiveBrickKey[] = [];
      for (const key of requiredKeys) { reserve(3_072); if (changes.has(serializeAdaptiveKey(key))) { changed.push(key); } yield; }
      changedBrickKeys = yield* structuralFreezeArraySteps(changed, reserve);
    }
    reserve?.(2_048, true);
    const evidence: StructuralCommandEvidence = freezeStructuralProduced({
      schemaVersion: STRUCTURAL_COMMAND_EVIDENCE_SCHEMA_VERSION,
      commandId: command.commandId,
      commandHash: yield* structuralCommandHashSteps(command, reserve),
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
    }, reserve);
    let resultObject: StructuralObject;
    if (reserve === undefined) {
      resultObject = publishStructuralObject(object, candidateBricks, command.resultingObjectRevision, resultingEditRevision, deepFreeze([...(commandEvidence as readonly StructuralCommandEvidence[]), evidence]));
    } else {
      reserve(1_024 + (commandEvidence.length + 1) * 32, true);
      const history: StructuralCommandEvidence[] = [];
      for (const entry of commandEvidence) { history.push(entry as StructuralCommandEvidence); yield; }
      history.push(evidence);
      resultObject = yield* ownedStructuralReconstructionSteps(object, {
        objectId: object.objectId, frame: object.frame, source: object.source, materials: object.materials,
        bricks: candidateBricks, anchors: object.anchors, joints: object.joints,
        objectRevision: command.resultingObjectRevision, editRevision: resultingEditRevision,
        commandEvidence: yield* structuralFreezeArraySteps(history, reserve)
      }, reserve);
    }
    reserve?.(2_048, true);
    let invalidations: StructuralAcceptedCommandResult["invalidations"];
    if (reserve === undefined) { invalidations = applied ? deepFreeze([
      deepFreeze({ kind: "Components" as const, sourceObjectRevision: object.objectRevision, sourceContentHash: object.contentHash }),
      deepFreeze({ kind: "MassProperties" as const, sourceObjectRevision: object.objectRevision, sourceContentHash: object.contentHash }),
      deepFreeze({ kind: "Mesh" as const, sourceObjectRevision: object.objectRevision, sourceContentHash: object.contentHash })
    ]) : deepFreeze([]); }
    else {
      const values: StructuralAcceptedCommandResult["invalidations"][number][] = [];
      if (applied) {
        for (const kind of ["Components", "MassProperties", "Mesh"] as const) {
          values.push(Object.freeze({ kind, sourceObjectRevision: object.objectRevision, sourceContentHash: object.contentHash }));
          yield;
        }
      }
      invalidations = yield* structuralFreezeArraySteps(values, reserve);
    }
    const partial: StructuralAcceptedCommandResult = freezeStructuralProduced({
      schemaVersion: STRUCTURAL_RESULT_SCHEMA_VERSION,
      status,
      commandId: command.commandId,
      object: resultObject,
      changedBrickKeys,
      selectedVoxelCount,
      changedVoxelCount,
      invalidations,
      resultHash: ""
    }, reserve);
    return freezeStructuralProduced({ ...partial, resultHash: yield* structuralResultHashSteps(partial, reserve) }, reserve);
    } finally { if (reserve !== undefined) { releaseOwnedStructuralDerivationCandidate(preliminary); } }
  } catch (error) {
    // Resource failure is not a command rejection: do not mask it with more allocation/hashing.
    if (reserve !== undefined && error instanceof StructuralValidationError && error.path.startsWith("cursor/")) { throw error; }
    return yield* rejectionFromErrorSteps(object, fallbackCommandId, error, reserve);
  }
}

export const applyStructuralDestructionCommand = (object: StructuralObject, commandValue: unknown): StructuralCommandResult => {
  const steps = structuralCommandSteps(object, commandValue);
  for (;;) { const step = steps.next(); if (step.done) { return step.value; } }
};

/** INACTIVE first-party module route. The caller retains issued source, command and other live
 * results immutable for the cursor lifetime and includes ALL of them in residentBytesValue.
 * New containers above are plain index-only producers locked before publication. No Worker caller. */
export const createOwnedStructuralCommandCursor = (source: StructuralObject, commandValue: unknown,
  residentBytesValue: number, prepareLimitBytes = 96 * 1024 * 1024) => {
  if (!isIssuedStructuralObject(source)) { return structuralFail("InvalidContract", "cursor/source", "Owned commands require a first-party issued source."); }
  const ledger = createStructuralOwnerLedger(residentBytesValue, prepareLimitBytes);
  ledger.reserve(16_384);
  let steps: ReturnType<typeof structuralCommandSteps> | undefined;
  let state: "open" | "done" | "failed" | "disposed" = "open", failure: unknown;
  let consumedUnits = 0;
  const stop = (): void => { try { steps?.return(undefined as never); } catch { /* original failure wins */ } steps = undefined; };
  return {
    advance(maxUnitsValue: number): StructuralCursorStep<StructuralCommandResult> {
      if (state === "failed") { throw failure; }
      if (state !== "open") { throw new Error(`Structural command cursor is ${state}; result issuance is once-only.`); }
      try {
        const maxUnits = structuralPositiveBudget(maxUnitsValue, "cursor/maxUnits");
        steps ??= structuralCommandSteps(source, commandValue, ledger.reserve);
        for (let unit = 0; unit < maxUnits; unit += 1) {
          consumedUnits += 1;
          const step = steps.next();
          if (step.done) { state = "done"; stop(); ledger.release(true); return { done: true, value: step.value }; }
        }
        return { done: false };
      } catch (error) { failure = error; state = "failed"; stop(); ledger.release(); throw error; }
    },
    dispose(): void { if (state !== "failed") { state = "disposed"; } stop(); ledger.release(); },
    get consumedUnits() { return consumedUnits; },
    get resources() { return ledger.resources; }
  };
};

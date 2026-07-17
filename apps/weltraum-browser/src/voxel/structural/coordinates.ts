import {
  ADAPTIVE_BRICK_CELLS_PER_AXIS,
  adaptiveLevel as adaptiveAuthorityLevel,
  deepFreeze,
  globalQuantumCoordinate as adaptiveGlobalQuantumCoordinate,
  requireExactKeys as adaptiveRequireExactKeys,
  requirePlainRecord as adaptiveRequirePlainRecord,
  serializeAdaptiveKey as adaptiveSerializeKey,
  validateAdaptiveBrickKey as adaptiveValidateBrickKey,
  type QuantumBounds,
  type QuantumPoint
} from "../adaptive";
import type {
  StructuralCellAddress,
  StructuralFrameBinding,
  StructuralLocalCellIndex,
  StructuralLocalCellOffset
} from "./types";
import {
  assertStructuralKeyMatchesFrame,
  normalizeAdaptiveAuthorityFunction,
  structuralFail,
  validateStructuralFrameBinding
} from "./validation";

const adaptiveLevel = normalizeAdaptiveAuthorityFunction(adaptiveAuthorityLevel);
const globalQuantumCoordinate = normalizeAdaptiveAuthorityFunction(adaptiveGlobalQuantumCoordinate);
const requireExactKeys = normalizeAdaptiveAuthorityFunction(adaptiveRequireExactKeys);
const requirePlainRecord = normalizeAdaptiveAuthorityFunction(adaptiveRequirePlainRecord);
const serializeAdaptiveKey = normalizeAdaptiveAuthorityFunction(adaptiveSerializeKey);
const validateAdaptiveBrickKey = normalizeAdaptiveAuthorityFunction(adaptiveValidateBrickKey);

const axis = (value: unknown, path: string): number => {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || Object.is(value, -0) || value < 0 || value >= ADAPTIVE_BRICK_CELLS_PER_AXIS) {
    return structuralFail("InvalidCoordinate", path, `Local cell coordinates must be integers in [0, ${ADAPTIVE_BRICK_CELLS_PER_AXIS}).`);
  }
  return value;
};

const safeTranslate = (value: number, offset: number, path: string): number => {
  const result = value + offset;
  if (!Number.isSafeInteger(result) || Object.is(result, -0)) return structuralFail("ArithmeticOverflow", path, "Quantum translation exceeded safe integers.");
  return result;
};

export const validateStructuralLocalCellOffset = (value: unknown, path = "local"): StructuralLocalCellOffset => {
  const record = requirePlainRecord(value, path);
  requireExactKeys(record, ["x", "y", "z"], path);
  return deepFreeze({ x: axis(record.x, `${path}/x`), y: axis(record.y, `${path}/y`), z: axis(record.z, `${path}/z`) });
};

export const structuralLocalCellIndex = (value: unknown, path = "localIndex"): StructuralLocalCellIndex => {
  const cellCount = ADAPTIVE_BRICK_CELLS_PER_AXIS ** 3;
  if (typeof value !== "number" || !Number.isSafeInteger(value) || Object.is(value, -0) || value < 0 || value >= cellCount) {
    return structuralFail("InvalidCoordinate", path, `Local cell index must be an integer in [0, ${cellCount}).`);
  }
  return value as StructuralLocalCellIndex;
};

export const localCellIndexFromOffset = (value: unknown): StructuralLocalCellIndex => {
  const local = validateStructuralLocalCellOffset(value);
  return structuralLocalCellIndex(
    local.x + ADAPTIVE_BRICK_CELLS_PER_AXIS * (local.y + ADAPTIVE_BRICK_CELLS_PER_AXIS * local.z)
  );
};

export const localCellOffsetFromIndex = (value: unknown): StructuralLocalCellOffset => {
  const index = structuralLocalCellIndex(value);
  const x = index % ADAPTIVE_BRICK_CELLS_PER_AXIS;
  const y = Math.floor(index / ADAPTIVE_BRICK_CELLS_PER_AXIS) % ADAPTIVE_BRICK_CELLS_PER_AXIS;
  const z = Math.floor(index / (ADAPTIVE_BRICK_CELLS_PER_AXIS ** 2));
  return deepFreeze({ x, y, z });
};

export const createStructuralCellAddress = (brickKeyValue: unknown, localValue: unknown): StructuralCellAddress => {
  const brickKey = validateAdaptiveBrickKey(brickKeyValue);
  if (brickKey.level !== adaptiveLevel(4)) return structuralFail("InvalidAdaptiveBinding", "brickKey/level", "Structural cell addresses require Adaptive level 4.");
  return deepFreeze({ brickKey, local: validateStructuralLocalCellOffset(localValue) });
};

export const validateStructuralCellAddress = (value: unknown, path = "cell"): StructuralCellAddress => {
  const record = requirePlainRecord(value, path);
  requireExactKeys(record, ["brickKey", "local"], path);
  return createStructuralCellAddress(record.brickKey, record.local);
};

export const globalQuantumForStructuralCell = (addressValue: unknown): QuantumPoint => {
  const address = validateStructuralCellAddress(addressValue);
  return deepFreeze({
    x: globalQuantumCoordinate(safeTranslate(address.brickKey.originQuantum.x, address.local.x, "globalCell/x"), "globalCell/x"),
    y: globalQuantumCoordinate(safeTranslate(address.brickKey.originQuantum.y, address.local.y, "globalCell/y"), "globalCell/y"),
    z: globalQuantumCoordinate(safeTranslate(address.brickKey.originQuantum.z, address.local.z, "globalCell/z"), "globalCell/z")
  });
};

export const objectLocalQuantumForGlobal = (point: QuantumPoint, frameValue: unknown): QuantumPoint => {
  const frame = validateStructuralFrameBinding(frameValue);
  return deepFreeze({
    x: globalQuantumCoordinate(safeTranslate(point.x, -frame.objectOriginQuantum.x, "objectLocal/x"), "objectLocal/x"),
    y: globalQuantumCoordinate(safeTranslate(point.y, -frame.objectOriginQuantum.y, "objectLocal/y"), "objectLocal/y"),
    z: globalQuantumCoordinate(safeTranslate(point.z, -frame.objectOriginQuantum.z, "objectLocal/z"), "objectLocal/z")
  });
};

export const globalQuantumForObjectLocal = (point: QuantumPoint, frameValue: unknown): QuantumPoint => {
  const frame = validateStructuralFrameBinding(frameValue);
  return deepFreeze({
    x: globalQuantumCoordinate(safeTranslate(point.x, frame.objectOriginQuantum.x, "global/x"), "global/x"),
    y: globalQuantumCoordinate(safeTranslate(point.y, frame.objectOriginQuantum.y, "global/y"), "global/y"),
    z: globalQuantumCoordinate(safeTranslate(point.z, frame.objectOriginQuantum.z, "global/z"), "global/z")
  });
};

export const globalBoundsForObjectLocal = (bounds: QuantumBounds, frameValue: unknown): QuantumBounds =>
  deepFreeze({ min: globalQuantumForObjectLocal(bounds.min, frameValue), max: globalQuantumForObjectLocal(bounds.max, frameValue) });

export const compareStructuralCellAddresses = (leftValue: StructuralCellAddress, rightValue: StructuralCellAddress): number => {
  const left = validateStructuralCellAddress(leftValue);
  const right = validateStructuralCellAddress(rightValue);
  const leftKey = serializeAdaptiveKey(left.brickKey);
  const rightKey = serializeAdaptiveKey(right.brickKey);
  if (leftKey !== rightKey) return leftKey < rightKey ? -1 : 1;
  return localCellIndexFromOffset(left.local) - localCellIndexFromOffset(right.local);
};

export const assertStructuralAddressMatchesFrame = (addressValue: unknown, frameValue: StructuralFrameBinding): void => {
  const address = validateStructuralCellAddress(addressValue);
  assertStructuralKeyMatchesFrame(address.brickKey, frameValue, "cell/brickKey");
};

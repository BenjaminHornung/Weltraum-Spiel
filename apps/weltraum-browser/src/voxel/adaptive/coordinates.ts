import { serializeAdaptiveKey } from "./canonical";
import {
  ADAPTIVE_BRICK_CELLS_PER_AXIS,
  ADAPTIVE_KEY_SCHEMA_VERSION,
  MICROVOXEL_BASE_QUANTUM_METERS,
  type AdaptiveBrickKey,
  type AdaptiveLevel,
  type MeterBounds,
  type QuantumBounds,
  type QuantumPoint,
  type StableAuthorityId
} from "./types";
import {
  adaptiveLevel,
  deepFreeze,
  fail,
  globalQuantumCoordinate,
  requireExactKeys,
  requirePlainRecord,
  stableAuthorityId
} from "./validation";
import { hasDeepFrozenIdentity } from "./immutability";

export const cellSizeQuantumForLevel = (level: AdaptiveLevel): number => 2 ** (4 - adaptiveLevel(level));
export const cellSizeMetersForLevel = (level: AdaptiveLevel): number =>
  MICROVOXEL_BASE_QUANTUM_METERS * cellSizeQuantumForLevel(level);
export const brickExtentQuantumForLevel = (level: AdaptiveLevel): number =>
  ADAPTIVE_BRICK_CELLS_PER_AXIS * cellSizeQuantumForLevel(level);

const point = (value: { readonly x: number; readonly y: number; readonly z: number }, path: string): QuantumPoint =>
  deepFreeze({
    x: globalQuantumCoordinate(value.x, `${path}/x`),
    y: globalQuantumCoordinate(value.y, `${path}/y`),
    z: globalQuantumCoordinate(value.z, `${path}/z`)
  });

const coordinateNumber = (value: unknown, path: string): number => {
  if (typeof value !== "number") return fail("InvalidCoordinate", path, "Bounds coordinates must be numbers.");
  return value;
};

const safeAdd = (left: number, right: number, path: string): number => {
  const result = left + right;
  if (!Number.isSafeInteger(result)) return fail("InvalidCoordinate", path, "Coordinate arithmetic exceeded safe integers.");
  return result;
};

const floorToMultiple = (value: number, multiple: number): number => Math.floor(value / multiple) * multiple;

const validateAdaptiveBrickKeyDomain = (
  level: AdaptiveLevel,
  originQuantum: QuantumPoint,
  path = "originQuantum"
): QuantumPoint => {
  for (let ancestorLevel: number = level; ancestorLevel >= 0; ancestorLevel -= 1) {
    const extent = brickExtentQuantumForLevel(adaptiveLevel(ancestorLevel));
    for (const axis of ["x", "y", "z"] as const) {
      const ancestorOrigin = floorToMultiple(originQuantum[axis], extent);
      if (!Number.isSafeInteger(ancestorOrigin) || ancestorOrigin % extent !== 0) {
        return fail("InvalidKey", `${path}/${axis}`, "Brick ancestry must have aligned safe-integer origins through level 0.");
      }
      const ancestorMax = ancestorOrigin + extent;
      if (!Number.isSafeInteger(ancestorMax)) {
        return fail("InvalidKey", `${path}/${axis}`, "Brick ancestry must have safe-integer exclusive bounds through level 0.");
      }
      if (ancestorLevel === level && ancestorOrigin !== originQuantum[axis]) {
        return fail("InvalidKey", `${path}/${axis}`, `Brick origins must align to ${extent} base quanta.`);
      }
    }
  }
  return originQuantum;
};

export interface AdaptiveBrickKeyInput {
  readonly bodyId: string;
  readonly surfaceFrameId: string;
  readonly regionId: string;
  readonly generatorVersion: string;
  readonly level: number;
  readonly originQuantum: { readonly x: number; readonly y: number; readonly z: number };
}

export const createAdaptiveBrickKey = (input: AdaptiveBrickKeyInput): AdaptiveBrickKey => {
  const inputRecord = requirePlainRecord(input, "keyInput");
  requireExactKeys(inputRecord, ["bodyId", "surfaceFrameId", "regionId", "generatorVersion", "level", "originQuantum"], "keyInput");
  const originRecord = requirePlainRecord(inputRecord.originQuantum, "keyInput/originQuantum");
  requireExactKeys(originRecord, ["x", "y", "z"], "keyInput/originQuantum");
  const level = adaptiveLevel(input.level);
  const originQuantum = validateAdaptiveBrickKeyDomain(level, point(input.originQuantum, "originQuantum"));
  return deepFreeze({
    schemaVersion: ADAPTIVE_KEY_SCHEMA_VERSION,
    bodyId: stableAuthorityId(input.bodyId, "bodyId"),
    surfaceFrameId: stableAuthorityId(input.surfaceFrameId, "surfaceFrameId"),
    regionId: stableAuthorityId(input.regionId, "regionId"),
    generatorVersion: stableAuthorityId(input.generatorVersion, "generatorVersion"),
    level,
    originQuantum
  });
};

const validatedBrickKeyByDeepFrozenIdentity = new WeakMap<object, AdaptiveBrickKey>();

export const validateAdaptiveBrickKey = (value: unknown): AdaptiveBrickKey => {
  if (typeof value === "object" && value !== null && hasDeepFrozenIdentity(value)) {
    const cached = validatedBrickKeyByDeepFrozenIdentity.get(value);
    if (cached !== undefined) return cached;
  }
  const record = requirePlainRecord(value, "key");
  requireExactKeys(record, ["schemaVersion", "bodyId", "surfaceFrameId", "regionId", "generatorVersion", "level", "originQuantum"], "key");
  if (record.schemaVersion !== ADAPTIVE_KEY_SCHEMA_VERSION) return fail("InvalidKey", "key/schemaVersion", "Unsupported key schema.");
  const origin = requirePlainRecord(record.originQuantum, "key/originQuantum");
  requireExactKeys(origin, ["x", "y", "z"], "key/originQuantum");
  const validated = createAdaptiveBrickKey({
    bodyId: record.bodyId as string,
    surfaceFrameId: record.surfaceFrameId as string,
    regionId: record.regionId as string,
    generatorVersion: record.generatorVersion as string,
    level: record.level as number,
    originQuantum: origin as unknown as { readonly x: number; readonly y: number; readonly z: number }
  });
  if (hasDeepFrozenIdentity(record)) validatedBrickKeyByDeepFrozenIdentity.set(record, validated);
  return validated;
};

export const keyFromGlobalQuantum = (
  bodyId: StableAuthorityId | string,
  surfaceFrameId: StableAuthorityId | string,
  regionId: StableAuthorityId | string,
  generatorVersion: StableAuthorityId | string,
  levelValue: AdaptiveLevel | number,
  coordinate: { readonly x: number; readonly y: number; readonly z: number }
): AdaptiveBrickKey => {
  const level = adaptiveLevel(levelValue);
  const coordinatePoint = point(coordinate, "coordinate");
  const extent = brickExtentQuantumForLevel(level);
  const originQuantum = validateAdaptiveBrickKeyDomain(level, point({
    x: floorToMultiple(coordinatePoint.x, extent),
    y: floorToMultiple(coordinatePoint.y, extent),
    z: floorToMultiple(coordinatePoint.z, extent)
  }, "originQuantum"));
  return createAdaptiveBrickKey({
    bodyId,
    surfaceFrameId,
    regionId,
    generatorVersion,
    level,
    originQuantum
  });
};

export const quantumBoundsForKey = (keyValue: AdaptiveBrickKey): QuantumBounds => {
  const key = validateAdaptiveBrickKey(keyValue);
  const extent = brickExtentQuantumForLevel(key.level);
  return deepFreeze({
    min: key.originQuantum,
    max: point(
      {
        x: safeAdd(key.originQuantum.x, extent, "bounds/max/x"),
        y: safeAdd(key.originQuantum.y, extent, "bounds/max/y"),
        z: safeAdd(key.originQuantum.z, extent, "bounds/max/z")
      },
      "bounds/max"
    )
  });
};

export const meterBoundsForKey = (key: AdaptiveBrickKey): MeterBounds => {
  const bounds = quantumBoundsForKey(key);
  return deepFreeze({
    min: {
      x: bounds.min.x * MICROVOXEL_BASE_QUANTUM_METERS,
      y: bounds.min.y * MICROVOXEL_BASE_QUANTUM_METERS,
      z: bounds.min.z * MICROVOXEL_BASE_QUANTUM_METERS
    },
    max: {
      x: bounds.max.x * MICROVOXEL_BASE_QUANTUM_METERS,
      y: bounds.max.y * MICROVOXEL_BASE_QUANTUM_METERS,
      z: bounds.max.z * MICROVOXEL_BASE_QUANTUM_METERS
    }
  });
};

export const containsQuantumCoordinate = (
  key: AdaptiveBrickKey,
  coordinate: { readonly x: number; readonly y: number; readonly z: number }
): boolean => {
  const bounds = quantumBoundsForKey(key);
  const candidate = point(coordinate, "coordinate");
  return (["x", "y", "z"] as const).every(
    (axis) => candidate[axis] >= bounds.min[axis] && candidate[axis] < bounds.max[axis]
  );
};

export const parentOf = (keyValue: AdaptiveBrickKey): AdaptiveBrickKey | null => {
  const key = validateAdaptiveBrickKey(keyValue);
  if (key.level === 0) return null;
  const parentLevel = adaptiveLevel(key.level - 1);
  return keyFromGlobalQuantum(key.bodyId, key.surfaceFrameId, key.regionId, key.generatorVersion, parentLevel, key.originQuantum);
};

export const childrenOf = (keyValue: AdaptiveBrickKey): readonly AdaptiveBrickKey[] => {
  const key = validateAdaptiveBrickKey(keyValue);
  if (key.level === 4) return deepFreeze([]);
  const childLevel = adaptiveLevel(key.level + 1);
  const childExtent = brickExtentQuantumForLevel(childLevel);
  const result: AdaptiveBrickKey[] = [];
  for (let z = 0; z < 2; z += 1) {
    for (let y = 0; y < 2; y += 1) {
      for (let x = 0; x < 2; x += 1) {
        result.push(
          createAdaptiveBrickKey({
            bodyId: key.bodyId,
            surfaceFrameId: key.surfaceFrameId,
            regionId: key.regionId,
            generatorVersion: key.generatorVersion,
            level: childLevel,
            originQuantum: {
              x: safeAdd(key.originQuantum.x, x * childExtent, "child/x"),
              y: safeAdd(key.originQuantum.y, y * childExtent, "child/y"),
              z: safeAdd(key.originQuantum.z, z * childExtent, "child/z")
            }
          })
        );
      }
    }
  }
  return deepFreeze(result.sort(compareAdaptiveBrickKeys));
};

export const ancestorsOf = (key: AdaptiveBrickKey): readonly AdaptiveBrickKey[] => {
  const result: AdaptiveBrickKey[] = [];
  let current = parentOf(key);
  while (current !== null) {
    result.push(current);
    current = parentOf(current);
  }
  return deepFreeze(result);
};

export const compareAdaptiveBrickKeys = (left: AdaptiveBrickKey, right: AdaptiveBrickKey): number =>
  serializeAdaptiveKey(validateAdaptiveBrickKey(left)) < serializeAdaptiveKey(validateAdaptiveBrickKey(right))
    ? -1
    : serializeAdaptiveKey(validateAdaptiveBrickKey(left)) > serializeAdaptiveKey(validateAdaptiveBrickKey(right))
      ? 1
      : 0;

export const sameAdaptiveBrickKey = (left: AdaptiveBrickKey, right: AdaptiveBrickKey): boolean =>
  serializeAdaptiveKey(left) === serializeAdaptiveKey(right);

export const validateQuantumBounds = (value: unknown, path = "bounds"): QuantumBounds => {
  const record = requirePlainRecord(value, path);
  requireExactKeys(record, ["min", "max"], path);
  const minRecord = requirePlainRecord(record.min, `${path}/min`);
  const maxRecord = requirePlainRecord(record.max, `${path}/max`);
  requireExactKeys(minRecord, ["x", "y", "z"], `${path}/min`);
  requireExactKeys(maxRecord, ["x", "y", "z"], `${path}/max`);
  const min = point({
    x: coordinateNumber(minRecord.x, `${path}/min/x`),
    y: coordinateNumber(minRecord.y, `${path}/min/y`),
    z: coordinateNumber(minRecord.z, `${path}/min/z`)
  }, `${path}/min`);
  const max = point({
    x: coordinateNumber(maxRecord.x, `${path}/max/x`),
    y: coordinateNumber(maxRecord.y, `${path}/max/y`),
    z: coordinateNumber(maxRecord.z, `${path}/max/z`)
  }, `${path}/max`);
  for (const axis of ["x", "y", "z"] as const) {
    if (min[axis] >= max[axis]) return fail("InvalidBounds", `${path}/${axis}`, "Bounds must be non-empty and half-open.");
  }
  return deepFreeze({ min, max });
};

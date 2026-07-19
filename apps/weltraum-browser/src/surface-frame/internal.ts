import {
  SurfaceLocalFrameError,
  type SurfaceCanonicalValue,
  type SurfaceQuaternion,
  type SurfaceVector3
} from "./types";

export const normalizeZero = (value: number): number => (Object.is(value, -0) ? 0 : value);

export const finiteNumber = (value: number, label: string): number => {
  if (!Number.isFinite(value)) {
    throw new SurfaceLocalFrameError("InvalidNumber", `${label} must be finite.`);
  }
  return normalizeZero(value);
};

export const positiveFiniteNumber = (value: number, label: string): number => {
  const result = finiteNumber(value, label);
  if (result <= 0) {
    throw new SurfaceLocalFrameError("InvalidNumber", `${label} must be greater than zero.`);
  }
  return result;
};

export const identifier = (value: string, label: string): string => {
  if (typeof value !== "string" || value.length === 0 || value !== value.trim()) {
    throw new SurfaceLocalFrameError("InvalidIdentifier", `${label} must be a non-empty identifier without surrounding whitespace.`);
  }
  return value;
};

export const revision = (value: number, label: string): number => {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new SurfaceLocalFrameError("InvalidRevision", `${label} must be a non-negative safe integer.`);
  }
  return normalizeZero(value);
};

export const vector3 = (value: SurfaceVector3, label: string): SurfaceVector3 => {
  if (value === null || typeof value !== "object") {
    throw new SurfaceLocalFrameError("InvalidVector", `${label} must be a vector.`);
  }
  return Object.freeze({
    x: finiteNumber(value.x, `${label}.x`),
    y: finiteNumber(value.y, `${label}.y`),
    z: finiteNumber(value.z, `${label}.z`)
  });
};

export const dot = (left: SurfaceVector3, right: SurfaceVector3): number =>
  finiteNumber(left.x * right.x + left.y * right.y + left.z * right.z, "Vector dot product");

export const cross = (left: SurfaceVector3, right: SurfaceVector3): SurfaceVector3 =>
  vector3(
    {
      x: left.y * right.z - left.z * right.y,
      y: left.z * right.x - left.x * right.z,
      z: left.x * right.y - left.y * right.x
    },
    "Vector cross product"
  );

export const subtract = (left: SurfaceVector3, right: SurfaceVector3): SurfaceVector3 =>
  vector3({ x: left.x - right.x, y: left.y - right.y, z: left.z - right.z }, "Vector difference");

export const add = (left: SurfaceVector3, right: SurfaceVector3): SurfaceVector3 =>
  vector3({ x: left.x + right.x, y: left.y + right.y, z: left.z + right.z }, "Vector sum");

export const magnitude = (value: SurfaceVector3): number => finiteNumber(Math.hypot(value.x, value.y, value.z), "Vector magnitude");

export const requireDenseCanonicalArray = (value: readonly unknown[], label: string): void => {
  for (let index = 0; index < value.length; index += 1) {
    if (!Object.hasOwn(value, index)) {
      throw new SurfaceLocalFrameError("InvalidCanonicalValue", `${label} cannot contain sparse arrays.`);
    }
  }
};

const shouldFlipQuaternion = (value: SurfaceQuaternion): boolean =>
  value.w < 0 ||
  (value.w === 0 && value.x < 0) ||
  (value.w === 0 && value.x === 0 && value.y < 0) ||
  (value.w === 0 && value.x === 0 && value.y === 0 && value.z < 0);

export const quaternion = (value: SurfaceQuaternion, label: string, requireUnit = true): SurfaceQuaternion => {
  if (value === null || typeof value !== "object") {
    throw new SurfaceLocalFrameError("InvalidQuaternion", `${label} must be a quaternion.`);
  }
  const raw = {
    x: finiteNumber(value.x, `${label}.x`),
    y: finiteNumber(value.y, `${label}.y`),
    z: finiteNumber(value.z, `${label}.z`),
    w: finiteNumber(value.w, `${label}.w`)
  };
  const length = finiteNumber(Math.hypot(raw.x, raw.y, raw.z, raw.w), `${label} magnitude`);
  if (length === 0 || (requireUnit && Math.abs(length - 1) > 1e-10)) {
    throw new SurfaceLocalFrameError("InvalidQuaternion", `${label} must be a unit quaternion.`);
  }
  const normalized = {
    x: normalizeZero(raw.x / length),
    y: normalizeZero(raw.y / length),
    z: normalizeZero(raw.z / length),
    w: normalizeZero(raw.w / length)
  };
  const sign = shouldFlipQuaternion(normalized) ? -1 : 1;
  return Object.freeze({
    x: normalizeZero(normalized.x * sign),
    y: normalizeZero(normalized.y * sign),
    z: normalizeZero(normalized.z * sign),
    w: normalizeZero(normalized.w * sign)
  });
};

export const multiplyQuaternions = (left: SurfaceQuaternion, right: SurfaceQuaternion): SurfaceQuaternion =>
  quaternion(
    {
      x: left.w * right.x + left.x * right.w + left.y * right.z - left.z * right.y,
      y: left.w * right.y - left.x * right.z + left.y * right.w + left.z * right.x,
      z: left.w * right.z + left.x * right.y - left.y * right.x + left.z * right.w,
      w: left.w * right.w - left.x * right.x - left.y * right.y - left.z * right.z
    },
    "Quaternion product",
    false
  );

export const inverseQuaternion = (value: SurfaceQuaternion): SurfaceQuaternion =>
  quaternion({ x: -value.x, y: -value.y, z: -value.z, w: value.w }, "Quaternion inverse", false);

const cloneCanonicalInternal = (value: SurfaceCanonicalValue, active: WeakSet<object>, label: string): SurfaceCanonicalValue => {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return finiteNumber(value, label);
  }
  if (Array.isArray(value)) {
    if (active.has(value)) {
      throw new SurfaceLocalFrameError("InvalidCanonicalValue", `${label} cannot contain cycles.`);
    }
    requireDenseCanonicalArray(value, label);
    active.add(value);
    try {
      return Object.freeze(value.map((entry, index) => cloneCanonicalInternal(entry, active, `${label}[${index}]`)));
    } finally {
      active.delete(value);
    }
  }
  if (typeof value === "object") {
    const object = value as object;
    const prototype = Object.getPrototypeOf(object);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new SurfaceLocalFrameError("InvalidCanonicalValue", `${label} must contain only plain objects.`);
    }
    if (Object.getOwnPropertySymbols(object).length > 0) {
      throw new SurfaceLocalFrameError("InvalidCanonicalValue", `${label} cannot contain symbol keys.`);
    }
    if (active.has(object)) {
      throw new SurfaceLocalFrameError("InvalidCanonicalValue", `${label} cannot contain cycles.`);
    }
    active.add(object);
    try {
      const output: Record<string, SurfaceCanonicalValue> = {};
      for (const key of Object.keys(object).sort()) {
        const entry = (value as Record<string, SurfaceCanonicalValue | undefined>)[key];
        if (entry === undefined) {
          throw new SurfaceLocalFrameError("InvalidCanonicalValue", `${label}.${key} cannot be undefined.`);
        }
        output[key] = cloneCanonicalInternal(entry, active, `${label}.${key}`);
      }
      return Object.freeze(output);
    } finally {
      active.delete(object);
    }
  }
  throw new SurfaceLocalFrameError("InvalidCanonicalValue", `${label} is not canonical JSON data.`);
};

export const cloneCanonicalValue = (value: SurfaceCanonicalValue, label: string): SurfaceCanonicalValue =>
  cloneCanonicalInternal(value, new WeakSet<object>(), label);

const canonicalValuesEqualInternal = (left: SurfaceCanonicalValue, right: SurfaceCanonicalValue): boolean => {
  if (left === null || right === null || typeof left !== "object" || typeof right !== "object") {
    return left === right;
  }
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) {
      return false;
    }
    return left.every((entry, index) => canonicalValuesEqualInternal(entry, right[index]));
  }
  const leftRecord = left as Readonly<Record<string, SurfaceCanonicalValue>>;
  const rightRecord = right as Readonly<Record<string, SurfaceCanonicalValue>>;
  const leftKeys = Object.keys(leftRecord);
  const rightKeys = Object.keys(rightRecord);
  return leftKeys.length === rightKeys.length && leftKeys.every((key, index) =>
    key === rightKeys[index] &&
    canonicalValuesEqualInternal(leftRecord[key], rightRecord[key])
  );
};

export const canonicalValuesEqual = (left: SurfaceCanonicalValue, right: SurfaceCanonicalValue): boolean =>
  canonicalValuesEqualInternal(
    cloneCanonicalValue(left, "Left canonical value"),
    cloneCanonicalValue(right, "Right canonical value")
  );

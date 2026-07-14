import { failSpatial } from "./errors";
import type { SpatialQuaternion, SpatialVector3 } from "./types";

const canonicalNumber = (value: number): number => (Object.is(value, -0) ? 0 : value);

const finiteNumber = (value: unknown, path: string): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return failSpatial("NONFINITE_VALUE", path, "Spatial components must be finite numbers.");
  }
  return canonicalNumber(value);
};

const recordValue = (value: unknown, path: string): Readonly<Record<string, unknown>> => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return failSpatial("INVALID_INPUT", path, "Expected a spatial value object.");
  }
  return value as Readonly<Record<string, unknown>>;
};

export const createSpatialVector3 = (value: unknown, path = ""): SpatialVector3 => {
  const record = recordValue(value, path);
  return Object.freeze({
    x: finiteNumber(record.x, `${path}/x`),
    y: finiteNumber(record.y, `${path}/y`),
    z: finiteNumber(record.z, `${path}/z`)
  });
};

export const spatialVector3 = (x = 0, y = 0, z = 0): SpatialVector3 => createSpatialVector3({ x, y, z });

export const addSpatialVectors = (a: SpatialVector3, b: SpatialVector3): SpatialVector3 =>
  spatialVector3(a.x + b.x, a.y + b.y, a.z + b.z);

export const subtractSpatialVectors = (a: SpatialVector3, b: SpatialVector3): SpatialVector3 =>
  spatialVector3(a.x - b.x, a.y - b.y, a.z - b.z);

export const scaleSpatialVector = (value: SpatialVector3, factor: number): SpatialVector3 => {
  const parsedFactor = finiteNumber(factor, "/factor");
  return spatialVector3(value.x * parsedFactor, value.y * parsedFactor, value.z * parsedFactor);
};

export const dotSpatialVectors = (a: SpatialVector3, b: SpatialVector3): number =>
  canonicalNumber(a.x * b.x + a.y * b.y + a.z * b.z);

export const crossSpatialVectors = (a: SpatialVector3, b: SpatialVector3): SpatialVector3 =>
  spatialVector3(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);

export const spatialVectorMagnitude = (value: SpatialVector3): number => Math.hypot(value.x, value.y, value.z);

export const normalizeSpatialVector = (value: SpatialVector3, path = ""): SpatialVector3 => {
  const parsed = createSpatialVector3(value, path);
  const magnitude = spatialVectorMagnitude(parsed);
  if (!Number.isFinite(magnitude)) {
    return failSpatial("NONFINITE_VALUE", path, "Spatial vector magnitude must be finite.");
  }
  if (magnitude === 0) {
    return failSpatial("INVALID_INPUT", path, "Cannot normalize a zero spatial vector.");
  }
  return scaleSpatialVector(parsed, 1 / magnitude);
};

const chooseQuaternionSign = (x: number, y: number, z: number, w: number): number => {
  for (const component of [w, x, y, z]) {
    if (component !== 0) {
      return component < 0 ? -1 : 1;
    }
  }
  return 1;
};

export const createSpatialQuaternion = (value: unknown, path = ""): SpatialQuaternion => {
  const record = recordValue(value, path);
  const rawX = finiteNumber(record.x, `${path}/x`);
  const rawY = finiteNumber(record.y, `${path}/y`);
  const rawZ = finiteNumber(record.z, `${path}/z`);
  const rawW = finiteNumber(record.w, `${path}/w`);
  const norm = Math.hypot(rawX, rawY, rawZ, rawW);
  if (norm === 0) {
    return failSpatial("ZERO_QUATERNION", path, "Spatial quaternion must have nonzero length.");
  }
  if (!Number.isFinite(norm)) {
    return failSpatial("NONFINITE_VALUE", path, "Spatial quaternion norm must be finite.");
  }
  const sign = chooseQuaternionSign(rawX / norm, rawY / norm, rawZ / norm, rawW / norm);
  return Object.freeze({
    x: canonicalNumber((rawX / norm) * sign),
    y: canonicalNumber((rawY / norm) * sign),
    z: canonicalNumber((rawZ / norm) * sign),
    w: canonicalNumber((rawW / norm) * sign)
  });
};

export const spatialQuaternion = (x: number, y: number, z: number, w: number): SpatialQuaternion =>
  createSpatialQuaternion({ x, y, z, w });

export const IDENTITY_SPATIAL_QUATERNION: SpatialQuaternion = spatialQuaternion(0, 0, 0, 1);
export const ZERO_SPATIAL_VECTOR: SpatialVector3 = spatialVector3(0, 0, 0);

export const conjugateSpatialQuaternion = (value: SpatialQuaternion): SpatialQuaternion =>
  spatialQuaternion(-value.x, -value.y, -value.z, value.w);

export const multiplySpatialQuaternions = (a: SpatialQuaternion, b: SpatialQuaternion): SpatialQuaternion =>
  spatialQuaternion(
    a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
    a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z
  );

export const rotateSpatialVector = (orientation: SpatialQuaternion, value: SpatialVector3): SpatialVector3 => {
  const q = createSpatialQuaternion(orientation);
  const v = createSpatialVector3(value);
  const qVector = spatialVector3(q.x, q.y, q.z);
  const twiceCross = scaleSpatialVector(crossSpatialVectors(qVector, v), 2);
  return addSpatialVectors(v, addSpatialVectors(scaleSpatialVector(twiceCross, q.w), crossSpatialVectors(qVector, twiceCross)));
};

export const createQuaternionFromAxisAngle = (axis: SpatialVector3, angleRadians: number): SpatialQuaternion => {
  const normalizedAxis = normalizeSpatialVector(axis, "/axis");
  const angle = finiteNumber(angleRadians, "/angleRadians");
  const halfAngle = angle / 2;
  const sine = Math.sin(halfAngle);
  return spatialQuaternion(
    normalizedAxis.x * sine,
    normalizedAxis.y * sine,
    normalizedAxis.z * sine,
    Math.cos(halfAngle)
  );
};

export const createQuaternionFromBasis = (
  xAxis: SpatialVector3,
  yAxis: SpatialVector3,
  zAxis: SpatialVector3
): SpatialQuaternion => {
  const m00 = xAxis.x;
  const m01 = yAxis.x;
  const m02 = zAxis.x;
  const m10 = xAxis.y;
  const m11 = yAxis.y;
  const m12 = zAxis.y;
  const m20 = xAxis.z;
  const m21 = yAxis.z;
  const m22 = zAxis.z;
  const trace = m00 + m11 + m22;
  let x: number;
  let y: number;
  let z: number;
  let w: number;
  if (trace > 0) {
    const s = 2 * Math.sqrt(trace + 1);
    w = s / 4;
    x = (m21 - m12) / s;
    y = (m02 - m20) / s;
    z = (m10 - m01) / s;
  } else if (m00 > m11 && m00 > m22) {
    const s = 2 * Math.sqrt(1 + m00 - m11 - m22);
    w = (m21 - m12) / s;
    x = s / 4;
    y = (m01 + m10) / s;
    z = (m02 + m20) / s;
  } else if (m11 > m22) {
    const s = 2 * Math.sqrt(1 + m11 - m00 - m22);
    w = (m02 - m20) / s;
    x = (m01 + m10) / s;
    y = s / 4;
    z = (m12 + m21) / s;
  } else {
    const s = 2 * Math.sqrt(1 + m22 - m00 - m11);
    w = (m10 - m01) / s;
    x = (m02 + m20) / s;
    y = (m12 + m21) / s;
    z = s / 4;
  }
  return spatialQuaternion(x, y, z, w);
};

export const quaternionAngularDistanceRadians = (a: SpatialQuaternion, b: SpatialQuaternion): number => {
  const relative = multiplySpatialQuaternions(conjugateSpatialQuaternion(a), b);
  const vectorMagnitude = Math.hypot(relative.x, relative.y, relative.z);
  return 2 * Math.atan2(vectorMagnitude, Math.abs(relative.w));
};

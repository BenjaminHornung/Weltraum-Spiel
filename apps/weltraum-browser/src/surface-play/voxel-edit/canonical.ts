import type { SurfaceVoxelCoordinate } from "./types";

const encoder = new TextEncoder();

const canonicalValue = (value: unknown): string => {
  if (value === null) return "null";
  if (typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value) || Object.is(value, -0)) throw new TypeError("Canonical numbers must be finite and not negative zero.");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalValue).join(",")}]`;
  if (typeof value !== "object") throw new TypeError("Canonical values must be plain data.");
  const record = value as Record<string, unknown>;
  const prototype = Object.getPrototypeOf(record);
  if (prototype !== Object.prototype && prototype !== null) throw new TypeError("Canonical objects must be plain records.");
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalValue(record[key])}`).join(",")}}`;
};

export const hashSurfaceVoxelValue = (value: unknown): string => {
  let hash = 0xcbf29ce484222325n;
  for (const byte of encoder.encode(canonicalValue(value))) {
    hash ^= BigInt(byte);
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return `fnv1a64-v1:${hash.toString(16).padStart(16, "0")}`;
};

export const compareSurfaceVoxelCoordinates = (
  left: Readonly<SurfaceVoxelCoordinate>,
  right: Readonly<SurfaceVoxelCoordinate>
): number => left.x - right.x || left.y - right.y || left.z - right.z;

export const surfaceVoxelBrickKey = (coordinate: Readonly<SurfaceVoxelCoordinate>): string =>
  `brick:${coordinate.x},${coordinate.y},${coordinate.z}`;

export const cloneCoordinate = (
  coordinate: Readonly<SurfaceVoxelCoordinate>
): Readonly<SurfaceVoxelCoordinate> => Object.freeze({ x: coordinate.x, y: coordinate.y, z: coordinate.z });

export const freezePlain = <T>(value: T): Readonly<T> => {
  if (value === null || typeof value !== "object" || ArrayBuffer.isView(value)) return value;
  const record = value as Record<string, unknown>;
  for (const child of Object.values(record)) freezePlain(child);
  return Object.freeze(value);
};

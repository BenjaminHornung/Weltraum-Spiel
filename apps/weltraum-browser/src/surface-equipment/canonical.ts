import { fnv1aHash } from "../core/hash";
import type { SurfaceEquipmentSignature } from "./ids";
import {
  isSurfaceEquipmentPlainRecord,
  surfaceEquipmentDataError,
  surfaceEquipmentDataPath,
  type SurfaceEquipmentJsonValue
} from "./validation";

const canonicalize = (value: unknown, path: string, ancestors: Set<object>): SurfaceEquipmentJsonValue => {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value) || (Number.isInteger(value) && !Number.isSafeInteger(value))) {
      throw surfaceEquipmentDataError("InvalidJson", path, "JSON numbers must be finite and safe when integral.");
    }
    return Object.is(value, -0) ? 0 : value;
  }
  if (Array.isArray(value)) {
    if (ancestors.has(value)) {
      throw surfaceEquipmentDataError("InvalidJson", path, "Plain JSON data cannot contain cycles.");
    }
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key === "symbol" || (key !== "length" && !/^(0|[1-9][0-9]*)$/.test(key))) {
        throw surfaceEquipmentDataError("InvalidJson", path, "JSON arrays cannot contain extra properties.");
      }
    }
    ancestors.add(value);
    try {
      const result: SurfaceEquipmentJsonValue[] = [];
      for (let index = 0; index < value.length; index += 1) {
        if (!Object.hasOwn(value, index)) {
          throw surfaceEquipmentDataError("InvalidJson", surfaceEquipmentDataPath(path, index), "JSON arrays must be dense.");
        }
        const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
        if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
          throw surfaceEquipmentDataError("InvalidJson", surfaceEquipmentDataPath(path, index), "Expected an enumerable data property.");
        }
        result.push(canonicalize(descriptor.value, surfaceEquipmentDataPath(path, index), ancestors));
      }
      return Object.freeze(result);
    } finally {
      ancestors.delete(value);
    }
  }
  if (!isSurfaceEquipmentPlainRecord(value)) {
    throw surfaceEquipmentDataError("InvalidJson", path, "Expected plain JSON data.");
  }
  if (ancestors.has(value)) {
    throw surfaceEquipmentDataError("InvalidJson", path, "Plain JSON data cannot contain cycles.");
  }
  const keys = Reflect.ownKeys(value);
  if (keys.some((key) => typeof key === "symbol")) {
    throw surfaceEquipmentDataError("InvalidJson", path, "JSON objects cannot contain symbol properties.");
  }
  ancestors.add(value);
  try {
    const result = Object.create(null) as Record<string, SurfaceEquipmentJsonValue>;
    for (const key of (keys as string[]).sort()) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
        throw surfaceEquipmentDataError(
          "InvalidJson",
          surfaceEquipmentDataPath(path, key),
          "Expected an enumerable data property."
        );
      }
      Object.defineProperty(result, key, {
        configurable: false,
        enumerable: true,
        value: canonicalize(descriptor.value, surfaceEquipmentDataPath(path, key), ancestors),
        writable: false
      });
    }
    return Object.freeze(result);
  } finally {
    ancestors.delete(value);
  }
};

export const canonicalizeSurfaceEquipmentValue = <T = SurfaceEquipmentJsonValue>(value: unknown): Readonly<T> =>
  canonicalize(value, "", new Set<object>()) as Readonly<T>;

export const canonicalSurfaceEquipmentJson = (value: unknown): string =>
  JSON.stringify(canonicalizeSurfaceEquipmentValue(value));

export const createSurfaceEquipmentSignature = (value: unknown): SurfaceEquipmentSignature =>
  fnv1aHash(canonicalSurfaceEquipmentJson(value)) as SurfaceEquipmentSignature;

export const cloneAndFreezeSurfaceEquipmentValue = <T>(value: T): Readonly<T> =>
  canonicalizeSurfaceEquipmentValue<T>(value);

import { fnv1aHash } from "../core/hash";
import { dataError, dataPath, isPlainObject } from "./validation";
import type { JsonObject, JsonValue } from "./validation";

const canonicalizeJsonValue = (value: unknown, path: string, ancestors: Set<object>): JsonValue => {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw dataError("InvalidCanonicalJson", path, "Canonical JSON only accepts finite numbers.");
    }

    return Object.is(value, -0) ? 0 : value;
  }

  if (Array.isArray(value)) {
    if (ancestors.has(value)) {
      throw dataError("InvalidCanonicalJson", path, "Canonical JSON must not contain cycles.");
    }

    ancestors.add(value);
    try {
      const result: JsonValue[] = [];
      for (let index = 0; index < value.length; index += 1) {
        result.push(canonicalizeJsonValue(value[index], dataPath(path, index), ancestors));
      }
      return result;
    } finally {
      ancestors.delete(value);
    }
  }

  if (isPlainObject(value)) {
    if (ancestors.has(value)) {
      throw dataError("InvalidCanonicalJson", path, "Canonical JSON must not contain cycles.");
    }

    ancestors.add(value);
    try {
      const result: Record<string, JsonValue> = Object.create(null) as Record<string, JsonValue>;
      for (const key of Object.keys(value).sort()) {
        result[key] = canonicalizeJsonValue(value[key], dataPath(path, key), ancestors);
      }
      return result;
    } finally {
      ancestors.delete(value);
    }
  }

  throw dataError("InvalidCanonicalJson", path, "Canonical JSON only accepts plain JSON values.");
};

/**
 * Recursively validates JSON data, lexically orders every object key, and
 * normalizes negative zero. It intentionally performs no domain-array sorting.
 */
export const canonicalizeJson = (value: unknown): JsonValue => canonicalizeJsonValue(value, "", new Set<object>());

/** Emits compact, deterministic JSON without planner-specific rounding or omissions. */
export const canonicalJsonStringify = (value: unknown): string => JSON.stringify(canonicalizeJson(value));

/** Hashes canonical JSON exclusively through the shared core FNV-1a primitive. */
export const canonicalJsonHash = (value: unknown): string => fnv1aHash(canonicalJsonStringify(value));

export const isCanonicalPlainJsonObject = (value: unknown): value is JsonObject => {
  try {
    const canonical = canonicalizeJson(value);
    return isPlainObject(canonical);
  } catch {
    return false;
  }
};

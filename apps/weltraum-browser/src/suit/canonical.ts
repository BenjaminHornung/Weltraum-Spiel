import { fnv1aHash } from "../core/hash";
import { failSuitValidation } from "./errors";
import type { SuitCanonicalValue, SuitSignature } from "./types";

const isPlainRecord = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

export const deepFreezeSuit = <T>(value: T, seen = new WeakSet<object>()): T => {
  if (value === null || typeof value !== "object" || seen.has(value as object)) return value;
  seen.add(value as object);
  for (const key of Reflect.ownKeys(value as object)) {
    const descriptor = Object.getOwnPropertyDescriptor(value as object, key);
    if (descriptor !== undefined && "value" in descriptor) deepFreezeSuit(descriptor.value, seen);
  }
  return Object.freeze(value);
};

const canonicalize = (value: unknown, path: string, ancestors: WeakSet<object>): SuitCanonicalValue => {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value) || Object.is(value, -0)) {
      return failSuitValidation("InvalidCanonicalValue", path, "Canonical suit numbers must be safe integers and cannot be -0.");
    }
    return value;
  }
  if (Array.isArray(value)) {
    if (Object.getPrototypeOf(value) !== Array.prototype || ancestors.has(value)) {
      return failSuitValidation("InvalidCanonicalValue", path, "Canonical suit arrays must be plain, dense, and acyclic.");
    }
    for (let index = 0; index < value.length; index += 1) {
      if (!Object.hasOwn(value, index)) {
        return failSuitValidation("InvalidCanonicalValue", `${path}/${index}`, "Canonical suit arrays must be dense.");
      }
    }
    ancestors.add(value);
    const result = value.map((entry, index) => canonicalize(entry, `${path}/${index}`, ancestors));
    ancestors.delete(value);
    return Object.freeze(result);
  }
  if (!isPlainRecord(value) || ancestors.has(value)) {
    return failSuitValidation("InvalidCanonicalValue", path, "Canonical suit values must be acyclic plain JSON.");
  }
  ancestors.add(value);
  const result = Object.create(null) as Record<string, SuitCanonicalValue>;
  for (const key of Object.keys(value).sort()) {
    const entry = value[key];
    if (entry === undefined) {
      return failSuitValidation("InvalidCanonicalValue", `${path}/${key}`, "Canonical suit JSON rejects undefined values.");
    }
    result[key] = canonicalize(entry, `${path}/${key}`, ancestors);
  }
  ancestors.delete(value);
  return Object.freeze(result);
};

export const canonicalizeSuitValue = (value: unknown): SuitCanonicalValue =>
  canonicalize(value, "", new WeakSet<object>());

export const canonicalSuitJson = (value: unknown): string => JSON.stringify(canonicalizeSuitValue(value));

export const createSuitSignature = (value: unknown): SuitSignature =>
  `fnv1a32:${fnv1aHash(canonicalSuitJson(value))}` as SuitSignature;

export const lexicalSuitCompare = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;

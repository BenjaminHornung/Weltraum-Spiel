import { fnv1aHash } from "../core/hash";
import { validateSaveGameEnvelopeV1 } from "./saveSchema";
import type { DefinitionResolutionSnapshot, JsonValue, SaveGameEnvelopeV1 } from "./types";
import { deepFreeze, isPlainObject, parsePersistenceJson, persistencePath } from "./validation";

export type PersistenceCanonicalErrorCode =
  | "UNSUPPORTED_CANONICAL_VALUE"
  | "NONFINITE_CANONICAL_NUMBER"
  | "SPARSE_CANONICAL_ARRAY"
  | "CYCLIC_CANONICAL_VALUE";

export class PersistenceCanonicalError extends Error {
  public constructor(
    public readonly code: PersistenceCanonicalErrorCode,
    public readonly path: string,
    message: string
  ) {
    super(message);
    this.name = "PersistenceCanonicalError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export type PersistenceSignature = `fnv1a32:${string}`;

const failCanonical = (code: PersistenceCanonicalErrorCode, path: string, message: string): never => {
  throw new PersistenceCanonicalError(code, path, message);
};

const canonicalizeValue = (value: unknown, path: string, ancestors: Set<object>): JsonValue => {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      return failCanonical("NONFINITE_CANONICAL_NUMBER", path, "Canonical numbers must be finite.");
    }
    return Object.is(value, -0) ? 0 : value;
  }
  if (Array.isArray(value)) {
    if (Object.getPrototypeOf(value) !== Array.prototype) {
      return failCanonical("UNSUPPORTED_CANONICAL_VALUE", path, "Canonical arrays must be plain Array instances.");
    }
    if (ancestors.has(value)) {
      return failCanonical("CYCLIC_CANONICAL_VALUE", path, "Canonical values must not contain cycles.");
    }
    const ownKeys = Reflect.ownKeys(value);
    for (const key of ownKeys) {
      if (typeof key === "symbol" || (key !== "length" && !/^(0|[1-9][0-9]*)$/.test(key))) {
        return failCanonical("UNSUPPORTED_CANONICAL_VALUE", path, "Canonical arrays cannot contain extra properties.");
      }
    }
    for (let index = 0; index < value.length; index += 1) {
      if (!Object.prototype.hasOwnProperty.call(value, index)) {
        return failCanonical("SPARSE_CANONICAL_ARRAY", persistencePath(path, index), "Canonical arrays must be dense.");
      }
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (descriptor === undefined || !("value" in descriptor) || descriptor.enumerable !== true) {
        return failCanonical("UNSUPPORTED_CANONICAL_VALUE", persistencePath(path, index), "Canonical array entries must be enumerable data properties.");
      }
    }
    ancestors.add(value);
    try {
      return value.map((entry, index) => canonicalizeValue(entry, persistencePath(path, index), ancestors));
    } finally {
      ancestors.delete(value);
    }
  }
  if (isPlainObject(value)) {
    if (ancestors.has(value)) {
      return failCanonical("CYCLIC_CANONICAL_VALUE", path, "Canonical values must not contain cycles.");
    }
    const ownKeys = Reflect.ownKeys(value);
    if (ownKeys.some((key) => typeof key === "symbol")) {
      return failCanonical("UNSUPPORTED_CANONICAL_VALUE", path, "Canonical objects cannot contain symbol keys.");
    }
    ancestors.add(value);
    try {
      const result = Object.create(null) as Record<string, JsonValue>;
      for (const key of (ownKeys as string[]).sort()) {
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (descriptor === undefined || !("value" in descriptor) || descriptor.enumerable !== true) {
          return failCanonical(
            "UNSUPPORTED_CANONICAL_VALUE",
            persistencePath(path, key),
            "Canonical objects require enumerable data properties."
          );
        }
        result[key] = canonicalizeValue(descriptor.value, persistencePath(path, key), ancestors);
      }
      return result;
    } finally {
      ancestors.delete(value);
    }
  }
  return failCanonical("UNSUPPORTED_CANONICAL_VALUE", path, "Value is not supported by persistence canonical JSON.");
};

/** Canonicalizes arbitrary plain JSON without guessing whether arrays are sets. */
export const canonicalizePersistenceValue = <T = JsonValue>(value: unknown): Readonly<T> =>
  deepFreeze(canonicalizeValue(value, "", new Set<object>())) as Readonly<T>;

export const serializeCanonicalPersistenceValue = (value: unknown): string =>
  JSON.stringify(canonicalizePersistenceValue(value));

export const createPersistenceSignature = (value: unknown): PersistenceSignature =>
  `fnv1a32:${fnv1aHash(serializeCanonicalPersistenceValue(value))}` as PersistenceSignature;

/** Applies schema-aware set ordering before the generic persistence canonicalizer. */
export const canonicalizeSaveGameEnvelopeV1 = (
  value: unknown,
  definitionSnapshots: readonly DefinitionResolutionSnapshot[]
): SaveGameEnvelopeV1 =>
  canonicalizePersistenceValue<SaveGameEnvelopeV1>(
    validateSaveGameEnvelopeV1(value, definitionSnapshots) as unknown as JsonValue
  ) as SaveGameEnvelopeV1;

export const serializeSaveGameEnvelopeV1 = (
  value: unknown,
  definitionSnapshots: readonly DefinitionResolutionSnapshot[]
): string => JSON.stringify(canonicalizeSaveGameEnvelopeV1(value, definitionSnapshots));

export const deserializeSaveGameEnvelopeV1 = (
  serialized: string,
  definitionSnapshots: readonly DefinitionResolutionSnapshot[]
): SaveGameEnvelopeV1 => canonicalizeSaveGameEnvelopeV1(parsePersistenceJson(serialized), definitionSnapshots);

export const createSaveGameSignature = (
  value: unknown,
  definitionSnapshots: readonly DefinitionResolutionSnapshot[]
): PersistenceSignature =>
  `fnv1a32:${fnv1aHash(serializeSaveGameEnvelopeV1(value, definitionSnapshots))}` as PersistenceSignature;

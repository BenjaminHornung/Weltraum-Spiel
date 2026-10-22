import type { JsonObject, JsonValue } from "./types";

export type PersistenceValidationIssueCode =
  | "INVALID_JSON"
  | "INVALID_TYPE"
  | "MISSING_REQUIRED_FIELD"
  | "UNKNOWN_FIELD"
  | "INVALID_VALUE"
  | "INVALID_ID"
  | "INVALID_NUMBER"
  | "INVALID_INTEGER"
  | "DUPLICATE_ID"
  | "UNKNOWN_REFERENCE"
  | "MISSING_DEFINITIONS_VERSION"
  | "DEFINITIONS_VERSION_MISMATCH"
  | "MISSING_DEFINITION_SNAPSHOT"
  | "MISSING_DEFINITION"
  | "UNSUPPORTED_SCHEMA_VERSION"
  | "UNSUPPORTED_FUTURE_SCHEMA_VERSION";

export interface PersistenceValidationIssue {
  readonly code: PersistenceValidationIssueCode;
  readonly path: string;
  readonly message: string;
}

export class PersistenceValidationError extends Error {
  public readonly issues: readonly PersistenceValidationIssue[];
  public readonly code: PersistenceValidationIssueCode;
  public readonly path: string;

  public constructor(issue: PersistenceValidationIssue) {
    super(issue.message);
    this.name = "PersistenceValidationError";
    const frozenIssue = Object.freeze({ ...issue });
    this.issues = Object.freeze([frozenIssue]);
    this.code = issue.code;
    this.path = issue.path;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export const failPersistenceValidation = (
  code: PersistenceValidationIssueCode,
  path: string,
  message: string
): never => {
  throw new PersistenceValidationError({ code, path, message });
};

const escapeJsonPointerSegment = (segment: string): string => segment.replace(/~/g, "~0").replace(/\//g, "~1");

export const persistencePath = (parentPath: string, segment: string | number): string =>
  `${parentPath}/${escapeJsonPointerSegment(String(segment))}`;

export const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

const readEnumerableDataPropertyKeys = (
  object: Readonly<Record<string, unknown>>,
  path: string
): readonly string[] => {
  const ownKeys = Reflect.ownKeys(object);
  if (ownKeys.some((key) => typeof key === "symbol")) {
    return failPersistenceValidation("INVALID_JSON", path, "Plain JSON objects cannot contain symbol properties.");
  }

  const keys = (ownKeys as string[]).sort();
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(object, key);
    if (descriptor === undefined || !("value" in descriptor) || descriptor.enumerable !== true) {
      return failPersistenceValidation(
        "INVALID_JSON",
        persistencePath(path, key),
        "Plain JSON object fields must be enumerable data properties."
      );
    }
  }
  return keys;
};

const readEnumerableDataProperty = (
  object: Readonly<Record<string, unknown>>,
  key: string,
  path: string
): unknown => {
  const descriptor = Object.getOwnPropertyDescriptor(object, key);
  if (descriptor === undefined) {
    return failPersistenceValidation("MISSING_REQUIRED_FIELD", persistencePath(path, key), "Required field is missing.");
  }
  if (!("value" in descriptor) || descriptor.enumerable !== true) {
    return failPersistenceValidation(
      "INVALID_JSON",
      persistencePath(path, key),
      "Plain JSON object fields must be enumerable data properties."
    );
  }
  return descriptor.value;
};

export const readPlainObject = (value: unknown, path: string): Readonly<Record<string, unknown>> => {
  if (!isPlainObject(value)) {
    return failPersistenceValidation("INVALID_TYPE", path, "Expected a plain object.");
  }
  readEnumerableDataPropertyKeys(value, path);
  return value;
};

export const assertAllowedFields = (
  object: Readonly<Record<string, unknown>>,
  path: string,
  fields: readonly string[]
): void => {
  for (const key of readEnumerableDataPropertyKeys(object, path)) {
    if (!fields.includes(key)) {
      failPersistenceValidation("UNKNOWN_FIELD", persistencePath(path, key), "Unexpected field in persistence data.");
    }
  }
};

export const readRequired = (object: Readonly<Record<string, unknown>>, key: string, path: string): unknown =>
  readEnumerableDataProperty(object, key, path);

export const readArray = (value: unknown, path: string): readonly unknown[] => {
  if (!Array.isArray(value)) {
    return failPersistenceValidation("INVALID_TYPE", path, "Expected an array.");
  }
  if (Object.getPrototypeOf(value) !== Array.prototype) {
    return failPersistenceValidation("INVALID_TYPE", path, "Expected a plain Array instance.");
  }

  const ownKeys = Reflect.ownKeys(value);
  if (ownKeys.some((key) => typeof key === "symbol")) {
    return failPersistenceValidation("INVALID_JSON", path, "JSON arrays cannot contain symbol properties.");
  }
  const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
  if (
    lengthDescriptor === undefined ||
    !("value" in lengthDescriptor) ||
    lengthDescriptor.enumerable !== false ||
    lengthDescriptor.configurable !== false ||
    typeof lengthDescriptor.value !== "number" ||
    !Number.isSafeInteger(lengthDescriptor.value) ||
    lengthDescriptor.value < 0
  ) {
    return failPersistenceValidation("INVALID_JSON", path, "JSON arrays require a normal length property.");
  }
  const length = lengthDescriptor.value;
  for (const key of (ownKeys as string[]).sort()) {
    if (key === "length") {
      continue;
    }
    if (!/^(0|[1-9][0-9]*)$/.test(key) || Number(key) >= length) {
      return failPersistenceValidation(
        "INVALID_JSON",
        persistencePath(path, key),
        "JSON arrays cannot contain extra properties."
      );
    }
  }
  for (let index = 0; index < length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (descriptor === undefined) {
      return failPersistenceValidation("INVALID_JSON", persistencePath(path, index), "Sparse arrays are not JSON-safe.");
    }
    if (!("value" in descriptor) || descriptor.enumerable !== true) {
      return failPersistenceValidation(
        "INVALID_JSON",
        persistencePath(path, index),
        "JSON array entries must be enumerable data properties."
      );
    }
  }
  return value;
};

export const readString = (value: unknown, path: string): string => {
  if (typeof value !== "string") {
    return failPersistenceValidation("INVALID_TYPE", path, "Expected a string.");
  }
  return value;
};

export const readNonEmptyString = (value: unknown, path: string): string => {
  const result = readString(value, path);
  if (result.length === 0 || result.trim() !== result) {
    return failPersistenceValidation("INVALID_VALUE", path, "Expected a nonempty string without surrounding whitespace.");
  }
  return result;
};

export const readBoolean = (value: unknown, path: string): boolean => {
  if (typeof value !== "boolean") {
    return failPersistenceValidation("INVALID_TYPE", path, "Expected a boolean.");
  }
  return value;
};

export const readFiniteNumber = (value: unknown, path: string, nonnegative = false): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return failPersistenceValidation("INVALID_NUMBER", path, "Expected a finite number.");
  }
  if (nonnegative && value < 0) {
    return failPersistenceValidation("INVALID_NUMBER", path, "Expected a nonnegative finite number.");
  }
  return Object.is(value, -0) ? 0 : value;
};

export const readNonNegativeSafeInteger = (value: unknown, path: string): number => {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    return failPersistenceValidation("INVALID_INTEGER", path, "Expected a nonnegative safe integer.");
  }
  return value;
};

const cloneJsonValueInternal = (value: unknown, path: string, ancestors: Set<object>): JsonValue => {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return readFiniteNumber(value, path);
  }
  if (Array.isArray(value)) {
    const array = readArray(value, path);
    if (ancestors.has(value)) {
      return failPersistenceValidation("INVALID_JSON", path, "JSON data must not contain cycles.");
    }
    ancestors.add(value);
    try {
      const result: JsonValue[] = [];
      for (let index = 0; index < array.length; index += 1) {
        const descriptor = Object.getOwnPropertyDescriptor(array, String(index));
        if (descriptor === undefined || !("value" in descriptor)) {
          return failPersistenceValidation("INVALID_JSON", persistencePath(path, index), "Invalid JSON array entry.");
        }
        result.push(cloneJsonValueInternal(descriptor.value, persistencePath(path, index), ancestors));
      }
      return result;
    } finally {
      ancestors.delete(value);
    }
  }
  if (isPlainObject(value)) {
    const object = readPlainObject(value, path);
    if (ancestors.has(value)) {
      return failPersistenceValidation("INVALID_JSON", path, "JSON data must not contain cycles.");
    }
    ancestors.add(value);
    try {
      const result = Object.create(null) as Record<string, JsonValue>;
      for (const key of readEnumerableDataPropertyKeys(object, path)) {
        const descriptor = Object.getOwnPropertyDescriptor(object, key);
        if (descriptor === undefined || !("value" in descriptor)) {
          return failPersistenceValidation("INVALID_JSON", persistencePath(path, key), "Invalid JSON object field.");
        }
        result[key] = cloneJsonValueInternal(descriptor.value, persistencePath(path, key), ancestors);
      }
      return result;
    } finally {
      ancestors.delete(value);
    }
  }
  return failPersistenceValidation("INVALID_JSON", path, "Expected plain JSON-safe data.");
};

export const cloneJsonValue = (value: unknown, path = ""): JsonValue =>
  cloneJsonValueInternal(value, path, new Set<object>());

export const cloneJsonObject = (value: unknown, path: string): JsonObject => {
  readPlainObject(value, path);
  return cloneJsonValue(value, path) as JsonObject;
};

/** Deeply freezes a newly constructed public snapshot. */
export const deepFreeze = <T>(value: T): Readonly<T> => {
  const seen = new Set<object>();
  const visit = (current: unknown): void => {
    if (current === null || typeof current !== "object" || seen.has(current)) {
      return;
    }
    seen.add(current);
    for (const key of Reflect.ownKeys(current)) {
      const descriptor = Object.getOwnPropertyDescriptor(current, key);
      if (descriptor !== undefined && "value" in descriptor) {
        visit(descriptor.value);
      }
    }
    Object.freeze(current);
  };
  visit(value);
  return value as Readonly<T>;
};

export const parsePersistenceJson = (text: string): unknown => {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return failPersistenceValidation("INVALID_JSON", "", "Persistence JSON could not be parsed.");
  }
};

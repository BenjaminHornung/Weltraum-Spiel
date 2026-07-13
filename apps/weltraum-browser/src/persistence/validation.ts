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

export const readPlainObject = (value: unknown, path: string): Readonly<Record<string, unknown>> => {
  if (!isPlainObject(value)) {
    return failPersistenceValidation("INVALID_TYPE", path, "Expected a plain object.");
  }
  return value;
};

export const assertAllowedFields = (
  object: Readonly<Record<string, unknown>>,
  path: string,
  fields: readonly string[]
): void => {
  for (const key of Object.keys(object).sort()) {
    if (!fields.includes(key)) {
      failPersistenceValidation("UNKNOWN_FIELD", persistencePath(path, key), "Unexpected field in persistence data.");
    }
  }
};

export const readRequired = (object: Readonly<Record<string, unknown>>, key: string, path: string): unknown => {
  if (!Object.prototype.hasOwnProperty.call(object, key)) {
    return failPersistenceValidation("MISSING_REQUIRED_FIELD", persistencePath(path, key), "Required field is missing.");
  }
  return object[key];
};

export const readArray = (value: unknown, path: string): readonly unknown[] => {
  if (!Array.isArray(value)) {
    return failPersistenceValidation("INVALID_TYPE", path, "Expected an array.");
  }
  for (let index = 0; index < value.length; index += 1) {
    if (!Object.prototype.hasOwnProperty.call(value, index)) {
      return failPersistenceValidation("INVALID_JSON", persistencePath(path, index), "Sparse arrays are not JSON-safe.");
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
    readArray(value, path);
    if (ancestors.has(value)) {
      return failPersistenceValidation("INVALID_JSON", path, "JSON data must not contain cycles.");
    }
    ancestors.add(value);
    try {
      return value.map((entry, index) => cloneJsonValueInternal(entry, persistencePath(path, index), ancestors));
    } finally {
      ancestors.delete(value);
    }
  }
  if (isPlainObject(value)) {
    if (ancestors.has(value)) {
      return failPersistenceValidation("INVALID_JSON", path, "JSON data must not contain cycles.");
    }
    ancestors.add(value);
    try {
      const result = Object.create(null) as Record<string, JsonValue>;
      for (const key of Object.keys(value).sort()) {
        result[key] = cloneJsonValueInternal(value[key], persistencePath(path, key), ancestors);
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

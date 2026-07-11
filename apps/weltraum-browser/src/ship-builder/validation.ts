/** JSON values accepted at ship-builder serialization boundaries. */
export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonArray | JsonObject;
export type JsonArray = readonly JsonValue[];

export interface JsonObject {
  readonly [key: string]: JsonValue;
}

export type ShipBuilderDataErrorCode =
  | "InvalidJson"
  | "InvalidType"
  | "MissingRequiredField"
  | "InvalidValue"
  | "InvalidId"
  | "InvalidVersion"
  | "UnsupportedVersion"
  | "UnsupportedSchemaVersion"
  | "DuplicateId"
  | "UnknownReference"
  | "UnknownCategory"
  | "UnknownSocket"
  | "UnknownComponent"
  | "UnknownInstance"
  | "UnsupportedRotation"
  | "InvalidNumber"
  | "OutOfRange"
  | "InvalidInteger"
  | "InvalidVector"
  | "InvalidExtension"
  | "InvalidCanonicalJson";

/**
 * Stable error payload used for every untrusted ship-builder data boundary.
 * Paths use JSON Pointer-style segments; the root is the empty string.
 */
export class ShipBuilderDataError extends Error {
  public readonly code: ShipBuilderDataErrorCode;
  public readonly path: string;
  public readonly details?: JsonValue;

  public constructor(code: ShipBuilderDataErrorCode, path: string, message: string, details?: JsonValue) {
    super(message);
    this.name = "ShipBuilderDataError";
    this.code = code;
    this.path = path;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export const dataError = (
  code: ShipBuilderDataErrorCode,
  path: string,
  message: string,
  details?: JsonValue
): ShipBuilderDataError => new ShipBuilderDataError(code, path, message, details);

const escapePathSegment = (segment: string): string => segment.replace(/~/g, "~0").replace(/\//g, "~1");

export const dataPath = (parentPath: string, segment: string | number): string =>
  `${parentPath}/${escapePathSegment(String(segment))}`;

export const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

export const readPlainObject = (value: unknown, path: string): Readonly<Record<string, unknown>> => {
  if (!isPlainObject(value)) {
    throw dataError("InvalidType", path, "Expected a plain object.");
  }

  return value;
};

/** Rejects unknown object keys in lexical order for deterministic schema readers. */
export const assertAllowedObjectFields = (
  object: Readonly<Record<string, unknown>>,
  path: string,
  allowedFields: readonly string[]
): void => {
  for (const key of Object.keys(object).sort()) {
    if (!allowedFields.includes(key)) {
      throw dataError("InvalidValue", dataPath(path, key), "Unexpected field in v1 ship-builder data.");
    }
  }
};

export const readRequiredProperty = (
  object: Readonly<Record<string, unknown>>,
  key: string,
  path: string
): unknown => {
  if (!Object.prototype.hasOwnProperty.call(object, key)) {
    throw dataError("MissingRequiredField", dataPath(path, key), "Required field is missing.");
  }

  return object[key];
};

export const readOptionalProperty = (
  object: Readonly<Record<string, unknown>>,
  key: string
): unknown | undefined => (Object.prototype.hasOwnProperty.call(object, key) ? object[key] : undefined);

export const readString = (value: unknown, path: string): string => {
  if (typeof value !== "string") {
    throw dataError("InvalidType", path, "Expected a string.");
  }

  return value;
};

export const readBoolean = (value: unknown, path: string): boolean => {
  if (typeof value !== "boolean") {
    throw dataError("InvalidType", path, "Expected a boolean.");
  }

  return value;
};

export const readArray = (value: unknown, path: string): readonly unknown[] => {
  if (!Array.isArray(value)) {
    throw dataError("InvalidType", path, "Expected an array.");
  }

  return value;
};

export interface NumberRange {
  readonly minimum?: number;
  readonly maximum?: number;
  readonly exclusiveMinimum?: boolean;
  readonly exclusiveMaximum?: boolean;
}

export const readFiniteNumber = (value: unknown, path: string, range?: NumberRange): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw dataError("InvalidNumber", path, "Expected a finite number.");
  }

  if (range?.minimum !== undefined) {
    const violatesMinimum = range.exclusiveMinimum ? value <= range.minimum : value < range.minimum;
    if (violatesMinimum) {
      throw dataError("OutOfRange", path, "Number is below the allowed minimum.", {
        minimum: range.minimum,
        exclusive: range.exclusiveMinimum ?? false
      });
    }
  }

  if (range?.maximum !== undefined) {
    const violatesMaximum = range.exclusiveMaximum ? value >= range.maximum : value > range.maximum;
    if (violatesMaximum) {
      throw dataError("OutOfRange", path, "Number is above the allowed maximum.", {
        maximum: range.maximum,
        exclusive: range.exclusiveMaximum ?? false
      });
    }
  }

  return Object.is(value, -0) ? 0 : value;
};

export const readInteger = (value: unknown, path: string, range?: NumberRange): number => {
  const numberValue = readFiniteNumber(value, path, range);
  if (!Number.isInteger(numberValue)) {
    throw dataError("InvalidInteger", path, "Expected an integer.");
  }

  return numberValue;
};

export const readNonNegativeFiniteNumber = (value: unknown, path: string): number =>
  readFiniteNumber(value, path, { minimum: 0 });

export const readPositiveFiniteNumber = (value: unknown, path: string): number =>
  readFiniteNumber(value, path, { minimum: 0, exclusiveMinimum: true });

export const readPositiveInteger = (value: unknown, path: string): number =>
  readInteger(value, path, { minimum: 0, exclusiveMinimum: true });

export interface FiniteVector3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface FiniteEulerDegrees {
  readonly yaw: number;
  readonly pitch: number;
  readonly roll: number;
}

export interface FiniteQuaternion {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly w: number;
}

export const readFiniteVector3 = (value: unknown, path: string): FiniteVector3 => {
  const object = readPlainObject(value, path);
  assertAllowedObjectFields(object, path, ["x", "y", "z"]);
  return {
    x: readFiniteNumber(readRequiredProperty(object, "x", path), dataPath(path, "x")),
    y: readFiniteNumber(readRequiredProperty(object, "y", path), dataPath(path, "y")),
    z: readFiniteNumber(readRequiredProperty(object, "z", path), dataPath(path, "z"))
  };
};

export const isNonZeroVector3 = (value: FiniteVector3): boolean => value.x !== 0 || value.y !== 0 || value.z !== 0;

/** Reads a finite direction without normalizing or substituting a fallback. */
export const readNonZeroVector3 = (value: unknown, path: string): FiniteVector3 => {
  const vector = readFiniteVector3(value, path);
  if (!isNonZeroVector3(vector)) {
    throw dataError("InvalidVector", path, "Expected a nonzero direction vector.");
  }

  return vector;
};

export const readFiniteEulerDegrees = (value: unknown, path: string): FiniteEulerDegrees => {
  const object = readPlainObject(value, path);
  return {
    yaw: readFiniteNumber(readRequiredProperty(object, "yaw", path), dataPath(path, "yaw")),
    pitch: readFiniteNumber(readRequiredProperty(object, "pitch", path), dataPath(path, "pitch")),
    roll: readFiniteNumber(readRequiredProperty(object, "roll", path), dataPath(path, "roll"))
  };
};

export const readNormalizedQuaternion = (value: unknown, path: string): FiniteQuaternion => {
  const object = readPlainObject(value, path);
  assertAllowedObjectFields(object, path, ["x", "y", "z", "w"]);
  const quaternion: FiniteQuaternion = {
    x: readFiniteNumber(readRequiredProperty(object, "x", path), dataPath(path, "x")),
    y: readFiniteNumber(readRequiredProperty(object, "y", path), dataPath(path, "y")),
    z: readFiniteNumber(readRequiredProperty(object, "z", path), dataPath(path, "z")),
    w: readFiniteNumber(readRequiredProperty(object, "w", path), dataPath(path, "w"))
  };
  const lengthSquared =
    quaternion.x * quaternion.x + quaternion.y * quaternion.y + quaternion.z * quaternion.z + quaternion.w * quaternion.w;

  if (Math.abs(lengthSquared - 1) > 1e-6) {
    throw dataError("InvalidVector", path, "Expected a normalized quaternion.");
  }

  return quaternion;
};

const extensionSegment = "[a-z][a-z0-9]*(?:[-_][a-z0-9]+)*";
const namespacedExtensionKeyPattern = new RegExp(
  `^${extensionSegment}(?:[.:/]${extensionSegment})+$`
);

/** A namespace and key are required; e.g. `weltraum.balance` or `vendor:feature`. */
export const isNamespacedExtensionKey = (value: string): boolean => namespacedExtensionKeyPattern.test(value);

const readJsonValueInternal = (value: unknown, path: string, ancestors: Set<object>): JsonValue => {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw dataError("InvalidExtension", path, "Extension JSON numbers must be finite.");
    }

    return Object.is(value, -0) ? 0 : value;
  }

  if (Array.isArray(value)) {
    if (ancestors.has(value)) {
      throw dataError("InvalidExtension", path, "Extension JSON must not contain cycles.");
    }

    ancestors.add(value);
    try {
      const result: JsonValue[] = [];
      for (let index = 0; index < value.length; index += 1) {
        result.push(readJsonValueInternal(value[index], dataPath(path, index), ancestors));
      }
      return result;
    } finally {
      ancestors.delete(value);
    }
  }

  if (isPlainObject(value)) {
    if (ancestors.has(value)) {
      throw dataError("InvalidExtension", path, "Extension JSON must not contain cycles.");
    }

    ancestors.add(value);
    try {
      const result: Record<string, JsonValue> = Object.create(null) as Record<string, JsonValue>;
      for (const key of Object.keys(value).sort()) {
        result[key] = readJsonValueInternal(value[key], dataPath(path, key), ancestors);
      }
      return result;
    } finally {
      ancestors.delete(value);
    }
  }

  throw dataError("InvalidExtension", path, "Extension values must be plain JSON data.");
};

export const readJsonValue = (value: unknown, path: string): JsonValue => readJsonValueInternal(value, path, new Set<object>());

/**
 * Validates and copies a JSON-safe extension object. Its top-level keys must
 * be namespace-qualified; nested object keys remain normal JSON keys.
 */
export const readNamespacedExtensions = (value: unknown, path: string): JsonObject => {
  const object = readPlainObject(value, path);
  const result: Record<string, JsonValue> = Object.create(null) as Record<string, JsonValue>;

  for (const key of Object.keys(object).sort()) {
    const keyPath = dataPath(path, key);
    if (!isNamespacedExtensionKey(key)) {
      throw dataError("InvalidExtension", keyPath, "Extension keys must use a lower-ASCII namespace.");
    }

    result[key] = readJsonValue(object[key], keyPath);
  }

  return result;
};

export const readOptionalNamespacedExtensions = (value: unknown, path: string): JsonObject | undefined =>
  value === undefined ? undefined : readNamespacedExtensions(value, path);

/** Recursively freezes arrays and ordinary objects without altering their values. */
export const deepFreeze = <T>(value: T): Readonly<T> => {
  const seen = new Set<object>();

  const freeze = (current: unknown): void => {
    if (current === null || typeof current !== "object" || seen.has(current)) {
      return;
    }

    seen.add(current);
    for (const key of Reflect.ownKeys(current)) {
      const descriptor = Object.getOwnPropertyDescriptor(current, key);
      if (descriptor && "value" in descriptor) {
        freeze(descriptor.value);
      }
    }
    Object.freeze(current);
  };

  freeze(value);
  return value as Readonly<T>;
};

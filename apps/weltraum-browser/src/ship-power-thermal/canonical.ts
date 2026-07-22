import type { ShipPowerThermalJsonValue } from "./types";

export type ShipPowerThermalCanonicalErrorCode =
  | "UNSUPPORTED_CANONICAL_VALUE"
  | "NONFINITE_CANONICAL_NUMBER"
  | "SPARSE_CANONICAL_ARRAY"
  | "CYCLIC_CANONICAL_VALUE";

export class ShipPowerThermalCanonicalError extends Error {
  public constructor(
    public readonly code: ShipPowerThermalCanonicalErrorCode,
    public readonly path: string,
    message: string
  ) {
    super(message);
    this.name = "ShipPowerThermalCanonicalError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export type ShipPowerThermalSignature = `fnv1a32:${string}`;

const canonicalPath = (parent: string, segment: string | number): string =>
  `${parent}/${String(segment).replace(/~/g, "~0").replace(/\//g, "~1")}`;

const failCanonical = (
  code: ShipPowerThermalCanonicalErrorCode,
  path: string,
  message: string
): never => {
  throw new ShipPowerThermalCanonicalError(code, path, message);
};

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

const MAX_ARRAY_INDEX = 0xffff_fffe;

/** Implements the ECMAScript array-index key rules and excludes keys outside the current array bounds. */
export const isCanonicalShipPowerThermalArrayIndex = (key: string, length: number): boolean => {
  if (!/^(0|[1-9][0-9]*)$/.test(key)) return false;
  const index = Number(key);
  return Number.isInteger(index)
    && index >= 0
    && index <= MAX_ARRAY_INDEX
    && index < length
    && String(index) === key;
};

const canonicalizeValue = (
  value: unknown,
  path: string,
  ancestors: Set<object>
): ShipPowerThermalJsonValue => {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
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
    const indexKeys: string[] = [];
    for (const key of ownKeys) {
      if (key === "length") continue;
      if (typeof key === "symbol" || !isCanonicalShipPowerThermalArrayIndex(key, value.length)) {
        return failCanonical("UNSUPPORTED_CANONICAL_VALUE", path, "Canonical arrays cannot contain extra properties.");
      }
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor === undefined || !("value" in descriptor) || descriptor.enumerable !== true) {
        return failCanonical(
          "UNSUPPORTED_CANONICAL_VALUE",
          canonicalPath(path, key),
          "Canonical array entries must be enumerable data properties."
        );
      }
      indexKeys.push(key);
    }
    indexKeys.sort((left, right) => Number(left) - Number(right));
    for (let index = 0; index < indexKeys.length; index += 1) {
      if (indexKeys[index] !== String(index)) {
        return failCanonical("SPARSE_CANONICAL_ARRAY", canonicalPath(path, index), "Canonical arrays must be dense.");
      }
    }
    if (indexKeys.length !== value.length) {
      return failCanonical(
        "SPARSE_CANONICAL_ARRAY",
        canonicalPath(path, indexKeys.length),
        "Canonical arrays must be dense."
      );
    }
    ancestors.add(value);
    try {
      const result: ShipPowerThermalJsonValue[] = [];
      for (const key of indexKeys) {
        const descriptor = Object.getOwnPropertyDescriptor(value, key) as PropertyDescriptor & { readonly value: unknown };
        result.push(canonicalizeValue(descriptor.value, canonicalPath(path, key), ancestors));
      }
      return result;
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
      const result = Object.create(null) as Record<string, ShipPowerThermalJsonValue>;
      for (const key of (ownKeys as string[]).sort()) {
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (descriptor === undefined || !("value" in descriptor) || descriptor.enumerable !== true) {
          return failCanonical(
            "UNSUPPORTED_CANONICAL_VALUE",
            canonicalPath(path, key),
            "Canonical objects require enumerable data properties."
          );
        }
        result[key] = canonicalizeValue(descriptor.value, canonicalPath(path, key), ancestors);
      }
      return result;
    } finally {
      ancestors.delete(value);
    }
  }

  return failCanonical(
    "UNSUPPORTED_CANONICAL_VALUE",
    path,
    "Canonical JSON accepts only null, booleans, strings, finite numbers, dense arrays, and plain objects."
  );
};

const freezeRecursively = <T>(value: T): Readonly<T> => {
  const seen = new Set<object>();
  const visit = (current: unknown): void => {
    if (current === null || typeof current !== "object" || seen.has(current)) return;
    seen.add(current);
    for (const key of Reflect.ownKeys(current)) {
      const descriptor = Object.getOwnPropertyDescriptor(current, key);
      if (descriptor !== undefined && "value" in descriptor) visit(descriptor.value);
    }
    Object.freeze(current);
  };
  visit(value);
  return value as Readonly<T>;
};

/**
 * Clones supported plain data, sorts object keys, preserves dense array order,
 * normalizes negative zero, and recursively freezes the returned clone.
 */
export const canonicalizeShipPowerThermalValue = <T = ShipPowerThermalJsonValue>(value: unknown): Readonly<T> =>
  freezeRecursively(canonicalizeValue(value, "", new Set<object>())) as Readonly<T>;

const serializeCanonicalValue = (value: ShipPowerThermalJsonValue): string => {
  if (value === null || typeof value === "boolean" || typeof value === "number" || typeof value === "string") {
    const serialized = JSON.stringify(value);
    if (serialized === undefined) {
      return failCanonical("UNSUPPORTED_CANONICAL_VALUE", "", "Value cannot be represented as canonical JSON.");
    }
    return serialized;
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => serializeCanonicalValue(entry)).join(",")}]`;
  }
  const record = value as Readonly<Record<string, ShipPowerThermalJsonValue>>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${serializeCanonicalValue(record[key])}`)
    .join(",")}}`;
};

/** Uses native JSON number spelling, preserving finite IEEE-754 values without rounding. */
export const serializeCanonicalShipPowerThermalValue = (value: unknown): string =>
  serializeCanonicalValue(canonicalizeShipPowerThermalValue<ShipPowerThermalJsonValue>(value));

export const fnv1a32ShipPowerThermal = (input: string): string => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
};

export const createShipPowerThermalSignature = (value: unknown): ShipPowerThermalSignature =>
  `fnv1a32:${fnv1a32ShipPowerThermal(serializeCanonicalShipPowerThermalValue(value))}` as ShipPowerThermalSignature;

/** Defensive clone/freeze for public plain-data snapshots. */
export const cloneAndFreezeShipPowerThermalValue = <T>(value: T): Readonly<T> =>
  canonicalizeShipPowerThermalValue<T>(value);

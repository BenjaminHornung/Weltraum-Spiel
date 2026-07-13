import { fnv1aHash } from "../core/hash";
import { failCelestial } from "./errors";

export interface CelestialCanonicalArray extends ReadonlyArray<CelestialCanonicalValue> {}

export interface CelestialCanonicalObject {
  readonly [key: string]: CelestialCanonicalValue;
}

export type CelestialCanonicalValue =
  | null
  | boolean
  | number
  | string
  | CelestialCanonicalArray
  | CelestialCanonicalObject;

const isPlainRecord = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

const requireDenseArray = (value: readonly unknown[], path: string): void => {
  for (let index = 0; index < value.length; index += 1) {
    if (!Object.hasOwn(value, index)) {
      return failCelestial("InvalidCanonicalJson", `${path}/${index}`, "Canonical celestial JSON rejects sparse arrays.");
    }
  }
};

const canonicalize = (
  value: unknown,
  path: string,
  ancestors: WeakSet<object>
): CelestialCanonicalValue => {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      return failCelestial("InvalidCanonicalJson", path, "Canonical celestial JSON rejects non-finite numbers.");
    }
    return Object.is(value, -0) ? 0 : value;
  }
  if (Array.isArray(value)) {
    if (ancestors.has(value)) {
      return failCelestial("InvalidCanonicalJson", path, "Canonical celestial JSON rejects cycles.");
    }
    requireDenseArray(value, path);
    ancestors.add(value);
    const result = value.map((entry, index) => canonicalize(entry, `${path}/${index}`, ancestors));
    ancestors.delete(value);
    return Object.freeze(result);
  }
  if (!isPlainRecord(value)) {
    return failCelestial("InvalidCanonicalJson", path, "Canonical celestial JSON accepts only plain JSON values.");
  }
  if (ancestors.has(value)) {
    return failCelestial("InvalidCanonicalJson", path, "Canonical celestial JSON rejects cycles.");
  }

  ancestors.add(value);
  const result = Object.create(null) as Record<string, CelestialCanonicalValue>;
  for (const key of Object.keys(value).sort()) {
    const entry = value[key];
    if (entry === undefined) {
      return failCelestial("InvalidCanonicalJson", `${path}/${key}`, "Canonical celestial JSON rejects undefined values.");
    }
    Object.defineProperty(result, key, {
      configurable: false,
      enumerable: true,
      value: canonicalize(entry, `${path}/${key}`, ancestors),
      writable: false
    });
  }
  ancestors.delete(value);
  return Object.freeze(result);
};

export const canonicalizeCelestialValue = (value: unknown): CelestialCanonicalValue =>
  canonicalize(value, "", new WeakSet<object>());

const serialize = (value: CelestialCanonicalValue): string => {
  if (value === null || typeof value === "string" || typeof value === "boolean" || typeof value === "number") {
    const serialized = JSON.stringify(value);
    return serialized ?? failCelestial("InvalidCanonicalJson", "", "Canonical celestial JSON could not serialize a value.");
  }
  if (Array.isArray(value)) {
    return `[${value.map(serialize).join(",")}]`;
  }
  const record = value as CelestialCanonicalObject;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${serialize(record[key])}`)
    .join(",")}}`;
};

/** Byte-stable JSON with no numeric rounding or planner-field omissions. */
export const canonicalCelestialJson = (value: unknown): string => serialize(canonicalizeCelestialValue(value));

export const celestialSignature = (value: unknown): string => fnv1aHash(canonicalCelestialJson(value));

import { fnv1aHash } from "../core/hash";

export interface CanonicalJsonArray extends ReadonlyArray<CanonicalJsonValue> {}

export interface CanonicalJsonObject {
  readonly [key: string]: CanonicalJsonValue;
}

export type CanonicalJsonValue = null | boolean | number | string | CanonicalJsonArray | CanonicalJsonObject;

export class CanonicalSerializationError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "CanonicalSerializationError";
  }
}

const codeUnitCompare = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

const isPlainRecord = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

const fail = (message: string): never => {
  throw new CanonicalSerializationError(message);
};

const requireDenseArray = (value: readonly unknown[]): void => {
  for (let index = 0; index < value.length; index += 1) {
    if (!Object.hasOwn(value, index)) {
      return fail("Canonical JSON does not permit sparse arrays");
    }
  }
};

const createCanonicalRecord = (): Record<string, CanonicalJsonValue> => Object.create(null) as Record<string, CanonicalJsonValue>;

const defineCanonicalProperty = (
  target: Record<string, CanonicalJsonValue>,
  key: string,
  value: CanonicalJsonValue
): void => {
  Object.defineProperty(target, key, {
    configurable: false,
    enumerable: true,
    value,
    writable: false
  });
};

const canonicalize = (value: unknown, parents: WeakSet<object>): CanonicalJsonValue => {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      return fail("Canonical JSON does not permit non-finite numbers");
    }

    return Object.is(value, -0) ? 0 : value;
  }

  if (Array.isArray(value)) {
    if (parents.has(value)) {
      return fail("Canonical JSON does not permit cyclic values");
    }

    requireDenseArray(value);
    parents.add(value);
    const result: CanonicalJsonValue[] = [];
    for (const entry of value) {
      result.push(canonicalize(entry, parents));
    }
    parents.delete(value);
    return Object.freeze(result);
  }

  if (!isPlainRecord(value)) {
    return fail("Canonical JSON only accepts JSON-compatible plain objects and arrays");
  }

  if (parents.has(value)) {
    return fail("Canonical JSON does not permit cyclic values");
  }

  parents.add(value);
  const result = createCanonicalRecord();
  for (const key of Object.keys(value).sort(codeUnitCompare)) {
    defineCanonicalProperty(result, key, canonicalize(value[key], parents));
  }
  parents.delete(value);
  return Object.freeze(result);
};

/** Recursively sorts object keys while intentionally preserving array order. */
export const canonicalizeJsonValue = (value: unknown): CanonicalJsonValue => canonicalize(value, new WeakSet<object>());

const serializeCanonicalJson = (value: CanonicalJsonValue): string => {
  if (value === null) {
    return "null";
  }
  if (typeof value === "string" || typeof value === "boolean" || typeof value === "number") {
    const serialized = JSON.stringify(value);
    return serialized ?? fail("Canonical JSON could not serialize a primitive value");
  }
  if (Array.isArray(value)) {
    return `[${value.map(serializeCanonicalJson).join(",")}]`;
  }

  const record = value as CanonicalJsonObject;
  return `{${Object.keys(record)
    .sort(codeUnitCompare)
    .map((key) => `${JSON.stringify(key)}:${serializeCanonicalJson(record[key])}`)
    .join(",")}}`;
};

/** Byte-stable JSON for persistent resource data; unlike planner hashing, numeric precision is never rounded. */
export const canonicalJson = (value: unknown): string => serializeCanonicalJson(canonicalizeJsonValue(value));

/** Deterministic synchronous signature over canonical JSON with no clock, random, or global registry state. */
export const canonicalSignature = (value: unknown): string => fnv1aHash(canonicalJson(value));

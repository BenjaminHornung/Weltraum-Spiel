export class PlanetaryEnvironmentCanonicalError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "PlanetaryEnvironmentCanonicalError";
  }
}

type CanonicalValue = null | boolean | number | string | readonly CanonicalValue[] | { readonly [key: string]: CanonicalValue };

const fail = (message: string): never => {
  throw new PlanetaryEnvironmentCanonicalError(message);
};

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

const readDataDescriptor = (owner: object, key: PropertyKey, context: string): PropertyDescriptor & { readonly value: unknown } => {
  const descriptor = Object.getOwnPropertyDescriptor(owner, key);
  if (descriptor === undefined || !("value" in descriptor)) return fail(`${context} cannot contain accessors.`);
  if (!descriptor.enumerable) fail(`${context} cannot contain non-enumerable data fields.`);
  return descriptor as PropertyDescriptor & { readonly value: unknown };
};

const readCanonicalArrayEntries = (value: readonly unknown[]): readonly unknown[] => {
  if (Object.getPrototypeOf(value) !== Array.prototype) fail("Canonical arrays must use the ordinary Array prototype.");
  const ownKeys = Reflect.ownKeys(value);
  for (const key of ownKeys) {
    if (typeof key === "symbol") return fail("Canonical arrays cannot contain symbol keys.");
    if (key === "length") continue;
    if (!/^(?:0|[1-9]\d*)$/.test(key)) fail("Canonical arrays can contain only exact canonical index keys.");
    const index = Number(key);
    if (!Number.isSafeInteger(index) || index >= value.length || String(index) !== key) {
      fail("Canonical arrays can contain only exact canonical index keys.");
    }
    readDataDescriptor(value, key, "Canonical arrays");
  }
  const entries: unknown[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (descriptor === undefined) return fail("Canonical arrays must be dense.");
    if (!("value" in descriptor) || !descriptor.enumerable) return fail("Canonical array indices must be enumerable data fields.");
    entries.push(descriptor.value);
  }
  return entries;
};

const canonicalize = (value: unknown, parents: WeakSet<object>): CanonicalValue => {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value) || Math.abs(value) > Number.MAX_SAFE_INTEGER) fail("Canonical numbers must be finite and safe.");
    return Object.is(value, -0) ? 0 : value;
  }
  if (Array.isArray(value)) {
    if (parents.has(value)) fail("Canonical values cannot contain cycles.");
    const entries = readCanonicalArrayEntries(value);
    parents.add(value);
    const result = entries.map((entry) => canonicalize(entry, parents));
    parents.delete(value);
    return Object.freeze(result);
  }
  if (!isPlainObject(value)) return fail("Canonical values must be JSON-compatible plain data.");
  if (parents.has(value)) fail("Canonical values cannot contain cycles.");
  parents.add(value);
  const result: Record<string, CanonicalValue> = Object.create(null) as Record<string, CanonicalValue>;
  const keys = Reflect.ownKeys(value);
  if (keys.some((key) => typeof key === "symbol")) fail("Canonical objects cannot contain symbol keys.");
  for (const key of (keys as string[]).sort()) {
    const descriptor = readDataDescriptor(value, key, "Canonical objects");
    result[key] = canonicalize(descriptor.value, parents);
  }
  parents.delete(value);
  return Object.freeze(result);
};

const serialize = (value: CanonicalValue): string => {
  if (value === null || typeof value === "string" || typeof value === "boolean" || typeof value === "number") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(serialize).join(",")}]`;
  const record = value as { readonly [key: string]: CanonicalValue };
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${serialize(record[key])}`).join(",")}}`;
};

export const canonicalEnvironmentJson = (value: unknown): string => serialize(canonicalize(value, new WeakSet<object>()));

export const environmentSignature = (value: unknown): string => {
  const bytes = canonicalEnvironmentJson(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < bytes.length; index += 1) {
    hash ^= bytes.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, "0")}`;
};

export const deepFreeze = <T>(value: T): Readonly<T> => {
  const seen = new Set<object>();
  const visit = (current: unknown): void => {
    if (current === null || typeof current !== "object" || seen.has(current)) return;
    seen.add(current);
    for (const key of Reflect.ownKeys(current)) {
      const descriptor = Object.getOwnPropertyDescriptor(current, key);
      if (descriptor && "value" in descriptor) visit(descriptor.value);
    }
    Object.freeze(current);
  };
  visit(value);
  return value as Readonly<T>;
};

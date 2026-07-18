import { fnv1aHash } from "../core/hash";

export type InteractionCanonicalValue =
  | null
  | boolean
  | number
  | string
  | readonly InteractionCanonicalValue[]
  | { readonly [key: string]: InteractionCanonicalValue };

export class InteractionCanonicalError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "InteractionCanonicalError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

const fail = (message: string): never => {
  throw new InteractionCanonicalError(message);
};

const isPlainRecord = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

const canonicalize = (value: unknown, ancestors: Set<object>): InteractionCanonicalValue => {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      return fail("Canonical interaction values require finite numbers.");
    }
    return Object.is(value, -0) ? 0 : value;
  }
  if (Array.isArray(value)) {
    if (ancestors.has(value)) {
      return fail("Canonical interaction values cannot contain cycles.");
    }
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key === "symbol" || (key !== "length" && !/^(0|[1-9][0-9]*)$/.test(key))) {
        return fail("Canonical interaction arrays cannot contain extra properties.");
      }
    }
    for (let index = 0; index < value.length; index += 1) {
      if (!Object.hasOwn(value, index)) {
        return fail("Canonical interaction arrays must be dense.");
      }
      const entry = Object.getOwnPropertyDescriptor(value, String(index));
      if (entry === undefined || !("value" in entry) || !entry.enumerable) {
        return fail("Canonical interaction arrays require enumerable data properties.");
      }
    }
    ancestors.add(value);
    try {
      return Object.freeze(value.map((entry) => canonicalize(entry, ancestors)));
    } finally {
      ancestors.delete(value);
    }
  }
  if (!isPlainRecord(value)) {
    return fail("Canonical interaction values accept plain JSON data only.");
  }
  if (ancestors.has(value)) {
    return fail("Canonical interaction values cannot contain cycles.");
  }
  ancestors.add(value);
  try {
    const result = Object.create(null) as Record<string, InteractionCanonicalValue>;
    const ownKeys = Reflect.ownKeys(value);
    if (ownKeys.some((key) => typeof key === "symbol")) {
      return fail("Canonical interaction objects cannot contain symbol properties.");
    }
    for (const key of (ownKeys as string[]).sort()) {
      const entry = Object.getOwnPropertyDescriptor(value, key);
      if (entry === undefined || !("value" in entry) || !entry.enumerable) {
        return fail("Canonical interaction objects require enumerable data properties.");
      }
      Object.defineProperty(result, key, {
        configurable: false,
        enumerable: true,
        value: canonicalize(entry.value, ancestors),
        writable: false
      });
    }
    return Object.freeze(result);
  } finally {
    ancestors.delete(value);
  }
};

export const canonicalizeInteractionValue = <T = InteractionCanonicalValue>(value: unknown): Readonly<T> =>
  canonicalize(value, new Set<object>()) as Readonly<T>;

export const canonicalInteractionJson = (value: unknown): string =>
  JSON.stringify(canonicalizeInteractionValue(value));

export const interactionHash = (value: unknown): `fnv1a32:${string}` =>
  `fnv1a32:${fnv1aHash(canonicalInteractionJson(value))}`;

/** Clones caller-owned JSON data before recursively freezing the result. */
export const cloneAndFreezeInteractionValue = <T>(value: T): Readonly<T> =>
  canonicalizeInteractionValue<T>(value);

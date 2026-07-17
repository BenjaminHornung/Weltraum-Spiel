import type {
  AdaptiveLevel,
  AdaptivePlanningEpoch,
  AdaptiveRegionId,
  AuthorityRevision,
  EditSequence,
  GlobalQuantumCoordinate,
  StableAuthorityId
} from "./types";

export type AdaptiveAuthorityErrorCode =
  | "InvalidCanonicalValue"
  | "InvalidCoordinate"
  | "InvalidIdentity"
  | "InvalidLevel"
  | "InvalidQuantum"
  | "InvalidRevision"
  | "InvalidBounds"
  | "InvalidKey"
  | "InvalidBaseField"
  | "InvalidEditJournal"
  | "InvalidPlannerInput";

export class AdaptiveAuthorityError extends Error {
  readonly code: AdaptiveAuthorityErrorCode;
  readonly path: string;

  constructor(code: AdaptiveAuthorityErrorCode, path: string, message: string) {
    super(message);
    this.name = "AdaptiveAuthorityError";
    this.code = code;
    this.path = path;
  }
}

export const fail = (code: AdaptiveAuthorityErrorCode, path: string, message: string): never => {
  throw new AdaptiveAuthorityError(code, path, message);
};

export const adaptiveLevel = (value: number): AdaptiveLevel => {
  if (!Number.isSafeInteger(value) || Object.is(value, -0) || value < 0 || value > 4) {
    return fail("InvalidLevel", "level", "Adaptive level must be one of the integers 0, 1, 2, 3, or 4.");
  }
  return value as AdaptiveLevel;
};

export const adaptiveRefinementLevel = adaptiveLevel;

export const globalQuantumCoordinate = (value: number, path = "coordinate"): GlobalQuantumCoordinate => {
  if (!Number.isSafeInteger(value) || Object.is(value, -0)) {
    return fail("InvalidCoordinate", path, "Global quantum coordinates must be safe integers and may not be negative zero.");
  }
  return value as GlobalQuantumCoordinate;
};

const nonNegativeSafeInteger = (value: number, path: string): number => {
  if (!Number.isSafeInteger(value) || Object.is(value, -0) || value < 0) {
    return fail("InvalidRevision", path, "Revision and sequence values must be non-negative safe integers.");
  }
  return value;
};

export const authorityRevision = (value: number): AuthorityRevision =>
  nonNegativeSafeInteger(value, "revision") as AuthorityRevision;

export const adaptiveBrickRevision = authorityRevision;
export const adaptivePlanningEpoch = (value: number): AdaptivePlanningEpoch =>
  nonNegativeSafeInteger(value, "planningEpoch") as AdaptivePlanningEpoch;
export const adaptiveEditRevision = authorityRevision;

export const editSequence = (value: number): EditSequence => {
  const sequence = nonNegativeSafeInteger(value, "sequence");
  if (sequence < 1) return fail("InvalidRevision", "sequence", "Edit sequence starts at one.");
  return sequence as EditSequence;
};

const requireCanonicalStringWithErrorCode = (
  value: string,
  path: string,
  errorCode: AdaptiveAuthorityErrorCode
): string => {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!Number.isInteger(next) || next < 0xdc00 || next > 0xdfff) {
        return fail(errorCode, path, "Canonical strings may not contain unpaired UTF-16 surrogates.");
      }
      index += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      return fail(errorCode, path, "Canonical strings may not contain unpaired UTF-16 surrogates.");
    }
  }
  return value;
};

export const requireCanonicalString = (value: string, path: string): string =>
  requireCanonicalStringWithErrorCode(value, path, "InvalidCanonicalValue");

export const stableAuthorityId = (value: string, path = "id"): StableAuthorityId => {
  if (typeof value !== "string" || value.length === 0 || value.trim() !== value || value.length > 256) {
    return fail("InvalidIdentity", path, "Stable authority IDs must be non-empty, trimmed strings of at most 256 characters.");
  }
  return requireCanonicalStringWithErrorCode(value, path, "InvalidIdentity") as StableAuthorityId;
};

export const adaptiveRegionId = (value: string): AdaptiveRegionId => stableAuthorityId(value, "regionId") as AdaptiveRegionId;
export const adaptiveEditId = (value: string) => stableAuthorityId(value, "editId");

export const requireFinite = (value: number, path: string): number => {
  if (!Number.isFinite(value)) return fail("InvalidBaseField", path, "Authority numbers must be finite.");
  return Object.is(value, -0) ? 0 : value;
};

export const requirePlainRecord = (value: unknown, path: string): Record<string, unknown> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return fail("InvalidCanonicalValue", path, "Expected a plain object.");
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    return fail("InvalidCanonicalValue", path, "Only plain objects are accepted.");
  }
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== "string") {
      return fail("InvalidCanonicalValue", path, "Symbol fields are not canonical.");
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
      return fail("InvalidCanonicalValue", `${path}/${key}`, "Canonical fields must be enumerable data properties.");
    }
  }
  return value as Record<string, unknown>;
};

export const requireExactKeys = (value: Record<string, unknown>, keys: readonly string[], path: string): void => {
  const expected = [...keys].sort();
  const actual = Object.keys(value).sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    fail("InvalidCanonicalValue", path, `Expected exactly these fields: ${expected.join(", ")}.`);
  }
};

export const deepFreeze = <T>(value: T, seen = new WeakSet<object>()): T => {
  if (typeof value !== "object" || value === null || seen.has(value)) return value;
  seen.add(value);
  for (const descriptor of Object.values(Object.getOwnPropertyDescriptors(value))) {
    if ("value" in descriptor) deepFreeze(descriptor.value, seen);
  }
  return Object.freeze(value);
};

export const isDeepFrozen = (value: unknown, seen = new WeakSet<object>()): boolean => {
  if (typeof value !== "object" || value === null || seen.has(value)) return true;
  if (!Object.isFrozen(value)) return false;
  seen.add(value);
  return Object.values(Object.getOwnPropertyDescriptors(value)).every(
    (descriptor) => !("value" in descriptor) || isDeepFrozen(descriptor.value, seen)
  );
};

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

/** Locale-independent lexicographic ordering over UTF-16 code units. */
export const compareCanonicalCodeUnits = (left: string, right: string): number => {
  const sharedLength = Math.min(left.length, right.length);
  for (let index = 0; index < sharedLength; index += 1) {
    const difference = left.charCodeAt(index) - right.charCodeAt(index);
    if (difference !== 0) return difference;
  }
  return left.length - right.length;
};

export interface DenseDataPropertyArrayOptions {
  readonly exactLength?: number;
  readonly maximumLength?: number;
}

export const requireDenseDataPropertyArray = (
  value: unknown,
  path: string,
  errorCode: AdaptiveAuthorityErrorCode,
  options: DenseDataPropertyArrayOptions = {}
): readonly unknown[] => adaptiveDrainSteps(adaptiveDenseArraySteps(value, path, errorCode, options));

/** Internal borrowed accounting only; no runtime dependency on a higher-layer owner. */
export type AdaptiveOwnedReserve = (bytes: number, retained?: boolean, kind?: "hash") => void;

export const adaptiveDrainSteps = <T>(steps: Generator<void, T, void>): T => {
  for (;;) {
    const step = steps.next();
    if (step.done) { return step.value; }
  }
};

/** Owned inputs are first-party plain/index-only arrays held immutable by their producer. */
let validatedFrozenDenseArrays: WeakSet<object> | undefined;
/** Private shape witness only: neither values, provenance nor a cached digest. */
export const isValidatedFrozenDenseArray = (value: object): boolean => validatedFrozenDenseArrays?.has(value) ?? false;
export const validatedFrozenDenseArrayInitializationBytes = (): number => validatedFrozenDenseArrays === undefined ? 0 : 64;
const retainValidatedFrozenDenseArray=(value:object,reserve:AdaptiveOwnedReserve):void=>{
  if(validatedFrozenDenseArrays?.has(value)){return;}
  reserve((validatedFrozenDenseArrays===undefined?64:0)+64,true);
  validatedFrozenDenseArrays??=new WeakSet<object>();
  validatedFrozenDenseArrays.add(value);
};

export function adaptiveDenseArraySteps(value: unknown, path: string, errorCode: AdaptiveAuthorityErrorCode,
  options: DenseDataPropertyArrayOptions, reserve: AdaptiveOwnedReserve, retainFrozen: true): Generator<void, readonly unknown[], void>;
export function adaptiveDenseArraySteps(value: unknown, path: string, errorCode: AdaptiveAuthorityErrorCode,
  options?: DenseDataPropertyArrayOptions, reserve?: AdaptiveOwnedReserve, retainFrozen?: false): Generator<void, unknown[], void>;
export function* adaptiveDenseArraySteps(value: unknown, path: string, errorCode: AdaptiveAuthorityErrorCode,
  options: DenseDataPropertyArrayOptions = {}, reserve?: AdaptiveOwnedReserve, retainFrozen = false): Generator<void, readonly unknown[], void> {
  reserve?.(1_024);
  if (!Array.isArray(value)) { return fail(errorCode, path, "Expected an array."); }
  const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
  if (lengthDescriptor === undefined || !("value" in lengthDescriptor) || !Number.isSafeInteger(lengthDescriptor.value)) {
    return fail(errorCode, path, "Array length must be a safe data property.");
  }
  const length = lengthDescriptor.value as number;
  if (options.exactLength !== undefined && length !== options.exactLength) {
    return fail(errorCode, path, `Array must contain exactly ${options.exactLength} entries.`);
  }
  if (options.maximumLength !== undefined && length > options.maximumLength) {
    return fail(errorCode, path, `Array length ${length} exceeds the finite limit ${options.maximumLength}.`);
  }

  if (retainFrozen && reserve !== undefined && isValidatedFrozenDenseArray(value)) {
    reserve(64 + length * 128);
    yield;
    return value;
  }

  let frozen = retainFrozen && reserve !== undefined && Object.getPrototypeOf(value) === Array.prototype
    && !Object.isExtensible(value) && !lengthDescriptor.configurable && !lengthDescriptor.writable;
  let firstHole = -1;
  if (reserve === undefined) {
    for (const key of Reflect.ownKeys(value)) {
      if (key === "length") { continue; }
      if (typeof key !== "string" || !/^(0|[1-9]\d*)$/.test(key)) {
        return fail(errorCode, path, "Arrays may contain only indexed entries and length.");
      }
      const index = Number(key);
      if (!Number.isSafeInteger(index) || index < 0 || index >= length || String(index) !== key) {
        return fail(errorCode, path, "Array index is outside the declared dense length.");
      }
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
        return fail(errorCode, `${path}/${key}`, "Array entries must be enumerable data properties.");
      }
    }
  } else {
    // The supported producer excludes named/symbol keys and Proxies. Preserve the original
    // descriptor-before-hole precedence without a whole own-key read over a large array.
    for (let index = 0; index < length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (descriptor === undefined && firstHole < 0) { firstHole = index; }
      if (descriptor !== undefined && (!descriptor.enumerable || !("value" in descriptor))) {
        return fail(errorCode, `${path}/${index}`, "Array entries must be enumerable data properties.");
      }
      if (frozen && descriptor !== undefined && (descriptor.configurable || descriptor.writable)) { frozen = false; }
      yield;
    }
  }
  reserve?.(64 + length * 128);
  const copy = frozen ? undefined : new Array<unknown>(length);
  if (reserve !== undefined) { yield; }
  if (frozen && firstHole >= 0) { return fail(errorCode, `${path}/${firstHole}`, "Sparse arrays are rejected."); }
  if (!frozen) { for (let index = 0; index < length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (descriptor === undefined) { return fail(errorCode, `${path}/${index}`, "Sparse arrays are rejected."); }
    if (!descriptor.enumerable || !("value" in descriptor)) {
      return fail(errorCode, `${path}/${index}`, "Array entries must be enumerable data properties.");
    }
    if (copy !== undefined) { copy[index] = descriptor.value; }
    if (reserve !== undefined) { yield; }
  } }
  if (frozen) { retainValidatedFrozenDenseArray(value,reserve!); }
  return frozen ? value : copy!;
}

/** Same native generic map and sort; owner loops consume only private produced arrays. */
export function* adaptiveMapSteps<T, R>(values: readonly T[], project: (value: T, index: number) => R,
  reserve?: AdaptiveOwnedReserve): Generator<void, R[], void> {
  if (reserve === undefined) { return values.map(project); }
  reserve(64 + values.length * 128);
  const result: R[] = [];
  for (let index = 0; index < values.length; index += 1) {
    result.push(project(values[index], index));
    yield;
  }
  return result;
}

export function* adaptiveSortSteps<T>(values: T[], compare: (left: T, right: T) => number,
  reserve?: AdaptiveOwnedReserve): Generator<void, T[], void> {
  if (reserve === undefined) { return values.sort(compare); }
  reserve(64 + values.length * 16);
  let source = values, target = new Array<T>(values.length);
  yield;
  for (let width = 1; width < values.length; width *= 2) {
    for (let start = 0; start < values.length; start += width * 2) {
      const middle = Math.min(start + width, values.length), end = Math.min(start + width * 2, values.length);
      let left = start, right = middle;
      for (let output = start; output < end; output += 1) {
        target[output] = right >= end || (left < middle && compare(source[left], source[right]) <= 0)
          ? source[left++] : source[right++];
        yield;
      }
    }
    const swap = source; source = target; target = swap;
  }
  if (source !== values) {
    for (let index = 0; index < values.length; index += 1) { values[index] = source[index]; yield; }
  }
  return values;
}

export function* adaptiveFreezeArraySteps<T>(values: T[], reserve?: AdaptiveOwnedReserve): Generator<void, readonly T[], void> {
  if (reserve === undefined) { return deepFreeze(values); }
  reserve(512);
  Object.preventExtensions(values);
  yield;
  // Only the immutable opt-in canonical hash reserve uses produced-shape witnesses.
  // Other bounded consumers (including binary mesh packing) retain their exact prequoted work.
  const hashUnits=Object.getOwnPropertyDescriptor(reserve,"hashUnits");
  let dense=hashUnits?.value===128&&hashUnits.writable===false&&hashUnits.configurable===false
    &&Array.isArray(values)&&Object.getPrototypeOf(values)===Array.prototype;
  // Measured shallow native tail, bounded to the largest private body source array.
  // Full shape proof still yields per entry; unpublished larger/unsupported arrays keep native locks.
  if(dense&&values.length<=32768){
    for(let index=0;index<values.length;index+=1){
      const entry=Object.getOwnPropertyDescriptor(values,String(index));
      if(entry===undefined||!entry.enumerable||!("value" in entry)){dense=false;break;}
      yield;
    }
    if(dense){Object.freeze(values);retainValidatedFrozenDenseArray(values,reserve);return values;}
  }
  for (let index = 0; index < values.length; index += 1) {
    if(dense){
      const entry=Object.getOwnPropertyDescriptor(values,String(index));
      dense=entry!==undefined&&entry.enumerable===true&&"value" in entry;
    }
    Object.defineProperty(values, String(index), { writable: false, configurable: false });
    yield;
  }
  Object.defineProperty(values, "length", { writable: false });
  if(dense){retainValidatedFrozenDenseArray(values,reserve);}
  return values;
}

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
  const expected = [...keys].sort(compareCanonicalCodeUnits);
  const actual = Object.keys(value).sort(compareCanonicalCodeUnits);
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

export const isDeepFrozen = (value: unknown, seen = new WeakSet<object>()): boolean =>
  adaptiveDrainSteps(adaptiveIsDeepFrozenSteps(value, seen));

/** Internal original predicate, not provenance. Owned arrays are first-party/index-only and
 * fixed records have <=32 own keys, held immutable for the entire recursive generator lifetime. */
export function* adaptiveIsDeepFrozenSteps(value: unknown, seenValue?: WeakSet<object>,
  reserve?: AdaptiveOwnedReserve): Generator<void, boolean, void> {
  reserve?.(512);
  const seen = seenValue === undefined ? new WeakSet<object>() : seenValue;
  if (typeof value !== "object" || value === null || seen.has(value)) { return true; }
  if (reserve === undefined) {
    if (!Object.isFrozen(value)) { return false; }
    seen.add(value);
    return Object.values(Object.getOwnPropertyDescriptors(value)).every(
      descriptor => !("value" in descriptor) || adaptiveDrainSteps(adaptiveIsDeepFrozenSteps(descriptor.value, seen))
    );
  }
  // Same frozen-before-seen and complete flag pass before descendant recursion. No whole-array
  // Object.isFrozen/getOwnPropertyDescriptors/Object.values work is hidden in a cursor unit.
  if (Object.isExtensible(value)) { return false; }
  reserve(4_160);
  const array = Array.isArray(value);
  const lengthDescriptor = array ? Object.getOwnPropertyDescriptor(value, "length") : undefined;
  const keys = array ? undefined : Reflect.ownKeys(value);
  if (keys !== undefined && keys.length > 32) {
    return fail("InvalidCanonicalValue", "frozen", "Owned frozen records require a bounded first-party shape.");
  }
  const length = array ? lengthDescriptor?.value as number : keys!.length;
  if (array && (lengthDescriptor === undefined || lengthDescriptor.configurable || lengthDescriptor.writable)) { return false; }
  yield;
  for (let index = 0; index < length; index += 1) {
    const key = array ? String(index) : keys![index];
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor !== undefined && (descriptor.configurable || ("value" in descriptor && descriptor.writable))) { return false; }
    yield;
  }
  seen.add(value);
  yield;
  for (let index = 0; index < length; index += 1) {
    const key = array ? String(index) : keys![index];
    // Object.values of the descriptor map deliberately excludes Symbol keys, including their
    // mutable values. Accessor descriptors never cause their getters to be invoked.
    if (typeof key === "string") {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor !== undefined && "value" in descriptor
        && !(yield* adaptiveIsDeepFrozenSteps(descriptor.value, seen, reserve))) { return false; }
    }
    yield;
  }
  return true;
}

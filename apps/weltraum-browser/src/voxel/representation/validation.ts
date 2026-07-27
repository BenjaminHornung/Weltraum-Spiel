import {
  AdaptiveAuthorityError,
  adaptiveLevel,
  deepFreeze,
  requireCanonicalString,
  requireDenseDataPropertyArray,
  requireExactKeys,
  requirePlainRecord,
  stableAuthorityId
} from "../adaptive";

export type RepresentationValidationErrorCode =
  | "InvalidContract"
  | "InvalidDescriptor"
  | "InvalidIdentity"
  | "InvalidProjection"
  | "InvalidSelection"
  | "InvalidFallback";

export class RepresentationValidationError extends Error {
  readonly code: RepresentationValidationErrorCode;
  readonly path: string;

  constructor(code: RepresentationValidationErrorCode, path: string, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "RepresentationValidationError";
    this.code = code;
    this.path = path;
  }
}

export const representationFail = (
  code: RepresentationValidationErrorCode,
  path: string,
  message: string
): never => {
  throw new RepresentationValidationError(code, path, message);
};

const fromAdaptive = <T>(operation: () => T): T => {
  try {
    return operation();
  } catch (error) {
    if (error instanceof AdaptiveAuthorityError) {
      throw new RepresentationValidationError("InvalidContract", error.path, error.message, { cause: error });
    }
    throw error;
  }
};

export const representationRecord = (value: unknown, path: string): Record<string, unknown> =>
  fromAdaptive(() => requirePlainRecord(value, path));

export const representationExactKeys = (record: Record<string, unknown>, keys: readonly string[], path: string): void =>
  fromAdaptive(() => requireExactKeys(record, keys, path));

export const representationDenseArray = (value: unknown, path: string, maximumLength: number): readonly unknown[] =>
  fromAdaptive(() => requireDenseDataPropertyArray(value, path, "InvalidCanonicalValue", { maximumLength }));

export const representationId = (value: unknown, path: string): string => {
  if (typeof value !== "string") return representationFail("InvalidIdentity", path, "Expected a stable string ID.");
  return fromAdaptive(() => stableAuthorityId(value, path));
};

export const representationString = (value: unknown, path: string): string => {
  if (typeof value !== "string" || value.length === 0 || value.trim() !== value || value.length > 256) {
    return representationFail("InvalidIdentity", path, "Expected a non-empty, trimmed string of at most 256 characters.");
  }
  return fromAdaptive(() => requireCanonicalString(value, path));
};

export const representationNonNegativeSafeInteger = (value: unknown, path: string): number => {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || Object.is(value, -0) || value < 0) {
    return representationFail("InvalidContract", path, "Expected a non-negative safe integer without negative zero.");
  }
  return value;
};

export const representationPositiveFinite = (value: unknown, path: string): number => {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0 || Object.is(value, -0)) {
    return representationFail("InvalidContract", path, "Expected a positive finite number.");
  }
  return value;
};

export const representationFinite = (value: unknown, path: string): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return representationFail("InvalidContract", path, "Expected a finite number.");
  }
  return Object.is(value, -0) ? 0 : value;
};

export const representationAdaptiveLevel = (value: unknown, path: string) => {
  if (typeof value !== "number") return representationFail("InvalidContract", path, "Expected an Adaptive level.");
  return fromAdaptive(() => adaptiveLevel(value));
};

export { deepFreeze };

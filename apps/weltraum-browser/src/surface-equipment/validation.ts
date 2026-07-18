export type SurfaceEquipmentJsonPrimitive = string | number | boolean | null;
export type SurfaceEquipmentJsonValue =
  | SurfaceEquipmentJsonPrimitive
  | readonly SurfaceEquipmentJsonValue[]
  | SurfaceEquipmentJsonObject;

export interface SurfaceEquipmentJsonObject {
  readonly [key: string]: SurfaceEquipmentJsonValue;
}

export type SurfaceEquipmentDataErrorCode =
  | "InvalidJson"
  | "InvalidType"
  | "MissingRequiredField"
  | "UnexpectedField"
  | "InvalidValue"
  | "InvalidId"
  | "InvalidInteger"
  | "DuplicateId"
  | "UnknownReference"
  | "SignatureMismatch";

export class SurfaceEquipmentDataError extends Error {
  public readonly code: SurfaceEquipmentDataErrorCode;
  public readonly path: string;

  public constructor(code: SurfaceEquipmentDataErrorCode, path: string, message: string) {
    super(message);
    this.name = "SurfaceEquipmentDataError";
    this.code = code;
    this.path = path;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export const surfaceEquipmentDataError = (
  code: SurfaceEquipmentDataErrorCode,
  path: string,
  message: string
): SurfaceEquipmentDataError => new SurfaceEquipmentDataError(code, path, message);

const escapePathSegment = (segment: string): string => segment.replace(/~/g, "~0").replace(/\//g, "~1");

export const surfaceEquipmentDataPath = (parent: string, segment: string | number): string =>
  `${parent}/${escapePathSegment(String(segment))}`;

export const isSurfaceEquipmentPlainRecord = (value: unknown): value is Record<string, unknown> => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

export const readSurfaceEquipmentRecord = (value: unknown, path: string): Readonly<Record<string, unknown>> => {
  if (!isSurfaceEquipmentPlainRecord(value)) {
    throw surfaceEquipmentDataError("InvalidType", path, "Expected a plain JSON object.");
  }
  return value;
};

export const assertSurfaceEquipmentFields = (
  value: Readonly<Record<string, unknown>>,
  path: string,
  allowed: readonly string[]
): void => {
  for (const key of Object.keys(value).sort()) {
    if (!allowed.includes(key)) {
      throw surfaceEquipmentDataError(
        "UnexpectedField",
        surfaceEquipmentDataPath(path, key),
        "Unexpected field in V1 surface-equipment data."
      );
    }
  }
};

export const readSurfaceEquipmentRequired = (
  value: Readonly<Record<string, unknown>>,
  key: string,
  path: string
): unknown => {
  if (!Object.hasOwn(value, key)) {
    throw surfaceEquipmentDataError(
      "MissingRequiredField",
      surfaceEquipmentDataPath(path, key),
      "Required field is missing."
    );
  }
  return value[key];
};

export const readSurfaceEquipmentString = (value: unknown, path: string): string => {
  if (typeof value !== "string") {
    throw surfaceEquipmentDataError("InvalidType", path, "Expected a string.");
  }
  return value;
};

export const readSurfaceEquipmentNonEmptyString = (value: unknown, path: string): string => {
  const result = readSurfaceEquipmentString(value, path);
  if (result.length === 0) {
    throw surfaceEquipmentDataError("InvalidValue", path, "Expected a non-empty string.");
  }
  return result;
};

export const readSurfaceEquipmentBoolean = (value: unknown, path: string): boolean => {
  if (typeof value !== "boolean") {
    throw surfaceEquipmentDataError("InvalidType", path, "Expected a boolean.");
  }
  return value;
};

export const readSurfaceEquipmentArray = (value: unknown, path: string): readonly unknown[] => {
  if (!Array.isArray(value)) {
    throw surfaceEquipmentDataError("InvalidType", path, "Expected an array.");
  }
  return value;
};

export const readSurfaceEquipmentSafeInteger = (
  value: unknown,
  path: string,
  minimum = 0,
  allowMinimum = true
): number => {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    (allowMinimum ? value < minimum : value <= minimum)
  ) {
    throw surfaceEquipmentDataError("InvalidInteger", path, "Expected a safe integer in the allowed range.");
  }
  return Object.is(value, -0) ? 0 : value;
};

export const readSurfaceEquipmentEnum = <T extends string>(
  value: unknown,
  allowed: readonly T[],
  path: string
): T => {
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    throw surfaceEquipmentDataError("InvalidValue", path, `Expected one of: ${allowed.join(", ")}.`);
  }
  return value as T;
};

export const compareSurfaceEquipmentText = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;

export const rejectSurfaceEquipmentDuplicates = (
  values: readonly string[],
  path: string,
  label: string
): void => {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) {
      throw surfaceEquipmentDataError("DuplicateId", path, `${label} '${value}' is duplicated.`);
    }
    seen.add(value);
  }
};

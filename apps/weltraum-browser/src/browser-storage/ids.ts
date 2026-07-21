import { SaveRepositoryError } from "./errors";

declare const saveSlotIdBrand: unique symbol;
declare const saveRecordRevisionBrand: unique symbol;
declare const saveRepositorySchemaVersionBrand: unique symbol;

export type SaveSlotId = string & { readonly [saveSlotIdBrand]: "SaveSlotId" };
export type SaveRecordRevision = number & { readonly [saveRecordRevisionBrand]: "SaveRecordRevision" };
export type SaveRepositorySchemaVersion = 1 & {
  readonly [saveRepositorySchemaVersionBrand]: "SaveRepositorySchemaVersion";
};

export const SAVE_REPOSITORY_SCHEMA_VERSION = 1 as SaveRepositorySchemaVersion;
export const MAX_SAVE_SLOT_ID_LENGTH = 64;

const slotIdPattern = /^[a-z0-9][a-z0-9._-]*$/;

export const parseSaveSlotId = (value: unknown, operation = "validateSlotId"): SaveSlotId => {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > MAX_SAVE_SLOT_ID_LENGTH ||
    !slotIdPattern.test(value)
  ) {
    throw new SaveRepositoryError(
      "InvalidEnvelope",
      operation,
      "Slot ID must be 1-64 normalized lowercase ASCII identifier characters."
    );
  }
  return value as SaveSlotId;
};

export const parseSaveRecordRevision = (
  value: unknown,
  operation = "validateRevision",
  allowZero = true
): SaveRecordRevision => {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < (allowZero ? 0 : 1)) {
    throw new SaveRepositoryError(
      "InvalidEnvelope",
      operation,
      allowZero
        ? "Record revision must be a nonnegative safe integer."
        : "Stored record revision must be a positive safe integer."
    );
  }
  return value as SaveRecordRevision;
};

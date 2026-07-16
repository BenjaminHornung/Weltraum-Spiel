import { MAX_SAVE_WRITE_REASON_LENGTH } from "./codec";
import { SaveRepositoryError } from "./errors";
import {
  parseSaveRecordRevision,
  parseSaveSlotId,
  type SaveRecordRevision,
  type SaveSlotId
} from "./ids";
import type { SaveWriteRequest } from "./types";

export interface ParsedSaveWriteRequest {
  readonly slotId: SaveSlotId;
  readonly expectedRevision: SaveRecordRevision | null;
  readonly envelope: unknown;
  readonly lastWriteReason: string;
}

const ownDataField = (request: object, field: keyof SaveWriteRequest): unknown => {
  let descriptor: PropertyDescriptor | undefined;
  try {
    descriptor = Object.getOwnPropertyDescriptor(request, field);
  } catch {
    throw new SaveRepositoryError(
      "InvalidEnvelope",
      "writeSlot",
      `Write request field ${field} could not be inspected.`
    );
  }
  if (descriptor === undefined || !("value" in descriptor)) {
    throw new SaveRepositoryError(
      "InvalidEnvelope",
      "writeSlot",
      `Write request field ${field} must be an own data property.`
    );
  }
  return descriptor.value;
};

const boundedWriteReason = (value: unknown): string => {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > MAX_SAVE_WRITE_REASON_LENGTH ||
    value.trim() !== value ||
    /[\u0000-\u001f\u007f]/.test(value)
  ) {
    throw new SaveRepositoryError(
      "InvalidEnvelope",
      "writeSlot",
      "Last write reason is not valid bounded text."
    );
  }
  return value;
};

export const parseSaveWriteRequest = (value: unknown): ParsedSaveWriteRequest => {
  if (value === null || typeof value !== "object") {
    throw new SaveRepositoryError("InvalidEnvelope", "writeSlot", "Write request must be an object.");
  }
  let isArray: boolean;
  try {
    isArray = Array.isArray(value);
  } catch {
    throw new SaveRepositoryError(
      "InvalidEnvelope",
      "writeSlot",
      "Write request shape could not be inspected."
    );
  }
  if (isArray) {
    throw new SaveRepositoryError("InvalidEnvelope", "writeSlot", "Write request must be an object.");
  }

  const slotId = parseSaveSlotId(ownDataField(value, "slotId"), "writeSlot");
  const expectedRevisionValue = ownDataField(value, "expectedRevision");
  const expectedRevision = expectedRevisionValue === null
    ? null
    : parseSaveRecordRevision(expectedRevisionValue, "writeSlot");
  const lastWriteReason = boundedWriteReason(ownDataField(value, "lastWriteReason"));
  const envelope = ownDataField(value, "envelope");

  return Object.freeze({ slotId, expectedRevision, envelope, lastWriteReason });
};

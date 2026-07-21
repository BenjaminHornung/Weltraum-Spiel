import {
  PersistenceCanonicalError,
  PersistenceValidationError,
  type DefinitionResolutionSnapshot,
  type SaveGameEnvelopeV1,
  type SimulationTick
} from "../persistence";
import {
  captureDefinitionResolutionSnapshots,
  createCanonicalSavePayload,
  encodeUtf8,
  parseCanonicalSavePayload
} from "./canonical";
import { computeSaveContentHash, parseSaveContentHash, verifySaveContentHash } from "./checksum";
import { SaveRepositoryError, isSaveRepositoryError, type SaveRepositoryErrorCode } from "./errors";
import {
  SAVE_REPOSITORY_SCHEMA_VERSION,
  parseSaveRecordRevision,
  parseSaveSlotId,
  type SaveRecordRevision,
  type SaveSlotId
} from "./ids";
import type {
  DecodedExportBundle,
  EncodedSavePayload,
  SaveCodec,
  SaveContentHash,
  SaveExportBundle,
  SaveReadResult,
  SaveSlotMetadata,
  StoredSaveRecord
} from "./types";

export const MAX_SAVE_PAYLOAD_BYTES = 16 * 1024 * 1024;
export const MAX_SAVE_DISPLAY_NAME_LENGTH = 128;
export const MAX_SAVE_WRITE_REASON_LENGTH = 128;

type DecodeContext = "stored" | "input";

const codeForContext = (context: DecodeContext): SaveRepositoryErrorCode =>
  context === "stored" ? "CorruptRecord" : "InvalidEnvelope";

const plainObject = (value: unknown, operation: string, code: SaveRepositoryErrorCode): Record<string, unknown> => {
  if (value === null || typeof value !== "object") {
    throw new SaveRepositoryError(code, operation, "Expected a plain object.");
  }
  let isArray: boolean;
  let prototype: object | null = null;
  try {
    isArray = Array.isArray(value);
    if (!isArray) {
      prototype = Object.getPrototypeOf(value);
    }
  } catch {
    throw new SaveRepositoryError(code, operation, "Object shape could not be inspected.");
  }
  if (isArray || (prototype !== Object.prototype && prototype !== null)) {
    throw new SaveRepositoryError(code, operation, "Expected a plain object.");
  }
  return value as Record<string, unknown>;
};

const dataProperty = (
  object: Record<string, unknown>,
  key: string,
  operation: string,
  code: SaveRepositoryErrorCode
): unknown => {
  let descriptor: PropertyDescriptor | undefined;
  try {
    descriptor = Object.getOwnPropertyDescriptor(object, key);
  } catch {
    throw new SaveRepositoryError(code, operation, "Data field " + key + " could not be inspected.");
  }
  if (descriptor === undefined || !("value" in descriptor) || descriptor.enumerable !== true) {
    throw new SaveRepositoryError(code, operation, `Required data field ${key} is missing or invalid.`);
  }
  return descriptor.value;
};

const exactFields = (
  object: Record<string, unknown>,
  fields: readonly string[],
  operation: string,
  code: SaveRepositoryErrorCode
): void => {
  let ownKeys: readonly PropertyKey[];
  try {
    ownKeys = Reflect.ownKeys(object);
  } catch {
    throw new SaveRepositoryError(code, operation, "Object fields could not be inspected.");
  }
  if (ownKeys.some((key) => typeof key !== "string" || !fields.includes(key))) {
    throw new SaveRepositoryError(code, operation, "Object contains unsupported fields.");
  }
  for (const field of fields) {
    dataProperty(object, field, operation, code);
  }
};

const boundedText = (
  value: unknown,
  maximumLength: number,
  label: string,
  operation: string,
  code: SaveRepositoryErrorCode
): string => {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > maximumLength ||
    value.trim() !== value ||
    /[\u0000-\u001f\u007f]/.test(value)
  ) {
    throw new SaveRepositoryError(code, operation, `${label} is not valid bounded text.`);
  }
  return value;
};

const nonEmptyTrimStableText = (
  value: unknown,
  label: string,
  operation: string,
  code: SaveRepositoryErrorCode
): string => {
  if (typeof value !== "string" || value.length === 0 || value.trim() !== value) {
    throw new SaveRepositoryError(code, operation, `${label} must be a nonempty string without surrounding whitespace.`);
  }
  return value;
};

const nonnegativeSafeInteger = (
  value: unknown,
  label: string,
  operation: string,
  code: SaveRepositoryErrorCode
): number => {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new SaveRepositoryError(code, operation, `${label} must be a nonnegative safe integer.`);
  }
  return value;
};

const saveSchemaVersion = (
  value: unknown,
  operation: string,
  context: DecodeContext
): 1 => {
  if (typeof value === "number" && Number.isFinite(value) && value > 1) {
    throw new SaveRepositoryError("UnsupportedSaveVersion", operation, "Future save schema versions are unsupported.");
  }
  if (value !== 1) {
    throw new SaveRepositoryError(codeForContext(context), operation, "Save schema version must be exactly 1.");
  }
  return 1;
};

const repositorySchemaVersion = (value: unknown, operation: string): typeof SAVE_REPOSITORY_SCHEMA_VERSION => {
  if (typeof value === "number" && Number.isFinite(value) && value > 1) {
    throw new SaveRepositoryError(
      "UnsupportedRepositoryVersion",
      operation,
      "Future repository schema versions are unsupported."
    );
  }
  if (value !== 1) {
    throw new SaveRepositoryError("InvalidEnvelope", operation, "Repository schema version must be exactly 1.");
  }
  return SAVE_REPOSITORY_SCHEMA_VERSION;
};

const parseMetadata = (
  value: unknown,
  operation: string,
  context: DecodeContext
): SaveSlotMetadata => {
  const code = codeForContext(context);
  const object = plainObject(value, operation, code);
  const fields = [
    "slotId",
    "displayName",
    "recordRevision",
    "saveSchemaVersion",
    "gameVersion",
    "universeTick",
    "payloadBytes",
    "contentHash",
    "lastWriteReason"
  ] as const;
  exactFields(object, fields, operation, code);
  let slotId: SaveSlotId;
  let recordRevision: SaveRecordRevision;
  try {
    slotId = parseSaveSlotId(dataProperty(object, "slotId", operation, code), operation);
    recordRevision = parseSaveRecordRevision(dataProperty(object, "recordRevision", operation, code), operation, false);
  } catch (error) {
    if (isSaveRepositoryError(error)) {
      throw new SaveRepositoryError(code, operation, error.message);
    }
    throw error;
  }
  const payloadByteCount = nonnegativeSafeInteger(dataProperty(object, "payloadBytes", operation, code), "Payload length", operation, code);
  if (payloadByteCount > MAX_SAVE_PAYLOAD_BYTES) {
    throw new SaveRepositoryError(code, operation, "Payload length exceeds the V1 safety limit.");
  }
  return Object.freeze({
    slotId,
    displayName: boundedText(
      dataProperty(object, "displayName", operation, code),
      MAX_SAVE_DISPLAY_NAME_LENGTH,
      "Display name",
      operation,
      code
    ),
    recordRevision,
    saveSchemaVersion: saveSchemaVersion(dataProperty(object, "saveSchemaVersion", operation, code), operation, context),
    gameVersion: nonEmptyTrimStableText(dataProperty(object, "gameVersion", operation, code), "Game version", operation, code),
    universeTick: nonnegativeSafeInteger(
      dataProperty(object, "universeTick", operation, code),
      "Universe tick",
      operation,
      code
    ) as SimulationTick,
    payloadBytes: payloadByteCount,
    contentHash: parseSaveContentHash(dataProperty(object, "contentHash", operation, code), operation, code),
    lastWriteReason: boundedText(
      dataProperty(object, "lastWriteReason", operation, code),
      MAX_SAVE_WRITE_REASON_LENGTH,
      "Last write reason",
      operation,
      code
    )
  });
};

const parseByteArray = (value: unknown, operation: string, code: SaveRepositoryErrorCode): Uint8Array => {
  let payloadBytes: Uint8Array | undefined;
  try {
    if (ArrayBuffer.isView(value) && Object.getPrototypeOf(value) === Uint8Array.prototype) {
      payloadBytes = new Uint8Array(value as Uint8Array);
    }
  } catch {
    throw new SaveRepositoryError(code, operation, "Payload shape could not be inspected.");
  }
  if (payloadBytes === undefined) {
    throw new SaveRepositoryError(code, operation, "Payload must be a Uint8Array.");
  }
  if (payloadBytes.byteLength > MAX_SAVE_PAYLOAD_BYTES) {
    throw new SaveRepositoryError(code, operation, "Payload exceeds the V1 safety limit.");
  }
  return payloadBytes;
};

const mapCanonicalFailure = (error: unknown, operation: string, context: DecodeContext): never => {
  if (isSaveRepositoryError(error)) {
    throw error;
  }
  if (error instanceof PersistenceValidationError && error.code === "UNSUPPORTED_FUTURE_SCHEMA_VERSION") {
    throw new SaveRepositoryError("UnsupportedSaveVersion", operation, "Future save schema versions are unsupported.");
  }
  if (error instanceof PersistenceValidationError || error instanceof PersistenceCanonicalError || error instanceof Error) {
    throw new SaveRepositoryError(codeForContext(context), operation, "Save envelope is invalid or noncanonical.");
  }
  throw new SaveRepositoryError(codeForContext(context), operation, "Save envelope validation failed.");
};

const assertMetadataMatchesEnvelope = (
  metadata: SaveSlotMetadata,
  envelope: SaveGameEnvelopeV1,
  operation: string,
  context: DecodeContext
): void => {
  if (
    metadata.saveSchemaVersion !== envelope.schemaVersion ||
    metadata.gameVersion !== envelope.gameVersion ||
    metadata.universeTick !== envelope.universeTime.tick
  ) {
    throw new SaveRepositoryError(codeForContext(context), operation, "Record metadata does not match the save envelope.");
  }
};

export const copySaveSlotMetadata = (metadata: SaveSlotMetadata): SaveSlotMetadata => Object.freeze({ ...metadata });

export const createStoredSaveRecord = (
  metadata: SaveSlotMetadata,
  payloadBytes: Uint8Array
): StoredSaveRecord => Object.freeze({
  metadata: copySaveSlotMetadata(metadata),
  payloadBytes: new Uint8Array(payloadBytes)
});

const readResult = (
  metadata: SaveSlotMetadata,
  envelope: SaveGameEnvelopeV1,
  payloadBytes: Uint8Array
): SaveReadResult => Object.freeze({
  metadata: copySaveSlotMetadata(metadata),
  envelope,
  payloadBytes: new Uint8Array(payloadBytes)
});

export const createSaveCodec = (definitionSnapshots: readonly DefinitionResolutionSnapshot[]): SaveCodec => {
  const capturedSnapshots = captureDefinitionResolutionSnapshots(definitionSnapshots);

  const decodeBytes = async (
    payloadBytes: Uint8Array,
    expectedHash: SaveContentHash,
    operation: string,
    context: DecodeContext
  ): Promise<EncodedSavePayload> => {
    await verifySaveContentHash(payloadBytes, expectedHash, operation);
    try {
      const canonical = parseCanonicalSavePayload(payloadBytes, capturedSnapshots);
      return Object.freeze({
        envelope: canonical.envelope,
        canonicalPayload: canonical.canonicalPayload,
        payloadBytes: new Uint8Array(canonical.payloadBytes),
        contentHash: expectedHash
      });
    } catch (error) {
      return mapCanonicalFailure(error, operation, context);
    }
  };

  return Object.freeze({
    definitionSnapshots: capturedSnapshots,

    async encode(value: unknown): Promise<EncodedSavePayload> {
      let canonical;
      try {
        canonical = createCanonicalSavePayload(value, capturedSnapshots);
      } catch (error) {
        return mapCanonicalFailure(error, "encode", "input");
      }
      if (canonical.payloadBytes.byteLength > MAX_SAVE_PAYLOAD_BYTES) {
        throw new SaveRepositoryError("InvalidEnvelope", "encode", "Save payload exceeds the V1 safety limit.");
      }
      const contentHash = await computeSaveContentHash(canonical.payloadBytes);
      return Object.freeze({
        envelope: canonical.envelope,
        canonicalPayload: canonical.canonicalPayload,
        payloadBytes: new Uint8Array(canonical.payloadBytes),
        contentHash
      });
    },

    async decodeStoredRecord(value: unknown): Promise<SaveReadResult> {
      const operation = "decodeStoredRecord";
      const object = plainObject(value, operation, "CorruptRecord");
      exactFields(object, ["metadata", "payloadBytes"], operation, "CorruptRecord");
      const metadata = parseMetadata(dataProperty(object, "metadata", operation, "CorruptRecord"), operation, "stored");
      const payloadBytes = parseByteArray(dataProperty(object, "payloadBytes", operation, "CorruptRecord"), operation, "CorruptRecord");
      if (metadata.payloadBytes !== payloadBytes.byteLength) {
        throw new SaveRepositoryError("CorruptRecord", operation, "Stored payload length does not match metadata.");
      }
      const decoded = await decodeBytes(payloadBytes, metadata.contentHash, operation, "stored");
      assertMetadataMatchesEnvelope(metadata, decoded.envelope, operation, "stored");
      return readResult(metadata, decoded.envelope, payloadBytes);
    },

    async decodeExportBundle(value: unknown): Promise<DecodedExportBundle> {
      const operation = "decodeExportBundle";
      const object = plainObject(value, operation, "InvalidEnvelope");
      const fields = [
        "bundleVersion",
        "repositorySchemaVersion",
        "saveSchemaVersion",
        "metadata",
        "canonicalPayload",
        "payloadBytes",
        "contentHash"
      ] as const;
      exactFields(object, fields, operation, "InvalidEnvelope");
      const bundleVersionValue = dataProperty(object, "bundleVersion", operation, "InvalidEnvelope");
      if (typeof bundleVersionValue === "number" && Number.isFinite(bundleVersionValue) && bundleVersionValue > 1) {
        throw new SaveRepositoryError("UnsupportedRepositoryVersion", operation, "Future export bundle versions are unsupported.");
      }
      if (bundleVersionValue !== 1) {
        throw new SaveRepositoryError("InvalidEnvelope", operation, "Export bundle version must be exactly 1.");
      }
      const repositoryVersion = repositorySchemaVersion(
        dataProperty(object, "repositorySchemaVersion", operation, "InvalidEnvelope"),
        operation
      );
      const bundleSaveVersion = saveSchemaVersion(
        dataProperty(object, "saveSchemaVersion", operation, "InvalidEnvelope"),
        operation,
        "input"
      );
      const metadata = parseMetadata(dataProperty(object, "metadata", operation, "InvalidEnvelope"), operation, "input");
      const canonicalPayload = dataProperty(object, "canonicalPayload", operation, "InvalidEnvelope");
      if (typeof canonicalPayload !== "string") {
        throw new SaveRepositoryError("InvalidEnvelope", operation, "Canonical payload must be a string.");
      }
      if (canonicalPayload.length > MAX_SAVE_PAYLOAD_BYTES) {
        throw new SaveRepositoryError("InvalidEnvelope", operation, "Canonical payload exceeds the V1 safety limit.");
      }
      const payloadBytes = encodeUtf8(canonicalPayload);
      const declaredPayloadBytes = nonnegativeSafeInteger(
        dataProperty(object, "payloadBytes", operation, "InvalidEnvelope"),
        "Bundle payload length",
        operation,
        "InvalidEnvelope"
      );
      if (declaredPayloadBytes > MAX_SAVE_PAYLOAD_BYTES || declaredPayloadBytes !== payloadBytes.byteLength) {
        throw new SaveRepositoryError("InvalidEnvelope", operation, "Bundle payload length is invalid.");
      }
      const contentHash = parseSaveContentHash(
        dataProperty(object, "contentHash", operation, "InvalidEnvelope"),
        operation,
        "InvalidEnvelope"
      );
      if (
        metadata.payloadBytes !== declaredPayloadBytes ||
        metadata.contentHash !== contentHash ||
        metadata.saveSchemaVersion !== bundleSaveVersion
      ) {
        throw new SaveRepositoryError("InvalidEnvelope", operation, "Bundle fields and metadata disagree.");
      }
      const decoded = await decodeBytes(payloadBytes, contentHash, operation, "input");
      assertMetadataMatchesEnvelope(metadata, decoded.envelope, operation, "input");
      const bundle: SaveExportBundle = Object.freeze({
        bundleVersion: 1,
        repositorySchemaVersion: repositoryVersion,
        saveSchemaVersion: bundleSaveVersion,
        metadata: copySaveSlotMetadata(metadata),
        canonicalPayload,
        payloadBytes: declaredPayloadBytes,
        contentHash
      });
      return Object.freeze({ bundle, envelope: decoded.envelope, payloadBytes: new Uint8Array(payloadBytes) });
    }
  });
};

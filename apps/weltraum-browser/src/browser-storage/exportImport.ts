import type { SimulationTick } from "../persistence";
import { decodeUtf8Fatal } from "./canonical";
import {
  copySaveSlotMetadata,
  MAX_SAVE_DISPLAY_NAME_LENGTH
} from "./codec";
import { SaveRepositoryError } from "./errors";
import {
  SAVE_REPOSITORY_SCHEMA_VERSION,
  parseSaveRecordRevision,
  parseSaveSlotId,
  type SaveRecordRevision,
  type SaveSlotId
} from "./ids";
import type {
  DecodedExportBundle,
  SaveCodec,
  SaveExportBundle,
  SaveImportPolicy,
  SaveReadResult,
  SaveSlotMetadata,
  SaveWriteResult
} from "./types";

export type ParsedSaveImportPolicy =
  | { readonly kind: "RejectIfExists" }
  | { readonly kind: "ReplaceExpectedRevision"; readonly expectedRevision: SaveRecordRevision }
  | { readonly kind: "CreateNewSlot"; readonly targetSlotId: SaveSlotId };

export interface PreparedSaveImport {
  readonly decoded: DecodedExportBundle;
  readonly policy: ParsedSaveImportPolicy;
  readonly targetSlotId: SaveSlotId;
  readonly displayName: string;
}

const assertExactFields = (
  value: object,
  expectedFields: readonly string[],
  operation: string
): void => {
  let keys: readonly PropertyKey[];
  try {
    keys = Reflect.ownKeys(value);
  } catch {
    throw new SaveRepositoryError(
      "InvalidEnvelope",
      operation,
      "Import policy fields could not be inspected."
    );
  }
  if (
    keys.length !== expectedFields.length ||
    keys.some((key) => typeof key !== "string" || !expectedFields.includes(key))
  ) {
    throw new SaveRepositoryError("InvalidEnvelope", operation, "Import policy contains unsupported fields.");
  }
};

const importPolicyDescriptor = (
  policy: object,
  field: string,
  operation: string
): PropertyDescriptor | undefined => {
  try {
    return Object.getOwnPropertyDescriptor(policy, field);
  } catch {
    throw new SaveRepositoryError(
      "InvalidEnvelope",
      operation,
      `Import policy field ${field} could not be inspected.`
    );
  }
};

const boundedDisplayName = (value: unknown, operation: string): string => {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > MAX_SAVE_DISPLAY_NAME_LENGTH ||
    value.trim() !== value ||
    /[\u0000-\u001f\u007f]/.test(value)
  ) {
    throw new SaveRepositoryError("InvalidEnvelope", operation, "Display name is not valid bounded text.");
  }
  return value;
};

export const parseSaveImportPolicy = (value: unknown): ParsedSaveImportPolicy => {
  const operation = "importSlot";
  if (value === null || typeof value !== "object") {
    throw new SaveRepositoryError("InvalidEnvelope", operation, "Import policy must be a plain object.");
  }
  let isArray: boolean;
  let prototype: object | null = null;
  try {
    isArray = Array.isArray(value);
    if (!isArray) {
      prototype = Object.getPrototypeOf(value);
    }
  } catch {
    throw new SaveRepositoryError(
      "InvalidEnvelope",
      operation,
      "Import policy shape could not be inspected."
    );
  }
  if (isArray || (prototype !== Object.prototype && prototype !== null)) {
    throw new SaveRepositoryError("InvalidEnvelope", operation, "Import policy must be a plain object.");
  }

  const policy = value as Record<string, unknown>;
  const kindDescriptor = importPolicyDescriptor(policy, "kind", operation);
  if (kindDescriptor === undefined || !("value" in kindDescriptor) || kindDescriptor.enumerable !== true) {
    throw new SaveRepositoryError("InvalidEnvelope", operation, "Import policy kind is missing.");
  }

  if (kindDescriptor.value === "RejectIfExists") {
    assertExactFields(policy, ["kind"], operation);
    return Object.freeze({ kind: "RejectIfExists" });
  }
  if (kindDescriptor.value === "ReplaceExpectedRevision") {
    assertExactFields(policy, ["kind", "expectedRevision"], operation);
    const expectedRevision = importPolicyDescriptor(policy, "expectedRevision", operation)?.value;
    return Object.freeze({
      kind: "ReplaceExpectedRevision",
      expectedRevision: parseSaveRecordRevision(expectedRevision, operation, false)
    });
  }
  if (kindDescriptor.value === "CreateNewSlot") {
    assertExactFields(policy, ["kind", "targetSlotId"], operation);
    const targetSlotId = importPolicyDescriptor(policy, "targetSlotId", operation)?.value;
    return Object.freeze({
      kind: "CreateNewSlot",
      targetSlotId: parseSaveSlotId(targetSlotId, operation)
    });
  }
  throw new SaveRepositoryError("InvalidEnvelope", operation, "Import policy kind is unsupported.");
};

export const createSaveExportBundle = (read: SaveReadResult): SaveExportBundle => Object.freeze({
  bundleVersion: 1,
  repositorySchemaVersion: SAVE_REPOSITORY_SCHEMA_VERSION,
  saveSchemaVersion: 1,
  metadata: copySaveSlotMetadata(read.metadata),
  canonicalPayload: decodeUtf8Fatal(new Uint8Array(read.payloadBytes)),
  payloadBytes: read.payloadBytes.byteLength,
  contentHash: read.metadata.contentHash
});

export const prepareSaveImport = async (
  codec: SaveCodec,
  bundle: unknown,
  policyValue: SaveImportPolicy
): Promise<PreparedSaveImport> => {
  const policy = parseSaveImportPolicy(policyValue);
  const decoded = await codec.decodeExportBundle(bundle);
  const targetSlotId = policy.kind === "CreateNewSlot"
    ? policy.targetSlotId
    : decoded.bundle.metadata.slotId;
  return Object.freeze({
    decoded,
    policy,
    targetSlotId,
    displayName: boundedDisplayName(decoded.bundle.metadata.displayName, "importSlot")
  });
};

export const createImportedMetadata = (
  prepared: PreparedSaveImport,
  recordRevision: SaveRecordRevision
): SaveSlotMetadata => Object.freeze({
  slotId: prepared.targetSlotId,
  displayName: prepared.displayName,
  recordRevision,
  saveSchemaVersion: 1,
  gameVersion: prepared.decoded.envelope.gameVersion,
  universeTick: prepared.decoded.envelope.universeTime.tick as SimulationTick,
  payloadBytes: prepared.decoded.payloadBytes.byteLength,
  contentHash: prepared.decoded.bundle.contentHash,
  lastWriteReason: "Import"
});

export const createImportedWriteResult = (
  prepared: PreparedSaveImport,
  metadata: SaveSlotMetadata
): SaveWriteResult => Object.freeze({
  metadata: copySaveSlotMetadata(metadata),
  envelope: prepared.decoded.envelope,
  payloadBytes: new Uint8Array(prepared.decoded.payloadBytes)
});

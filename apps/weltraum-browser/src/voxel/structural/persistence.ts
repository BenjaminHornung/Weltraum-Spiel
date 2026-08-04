import {
  canonicalAdaptiveJson as adaptiveCanonicalJson,
  deepFreeze,
  requireExactKeys as adaptiveRequireExactKeys,
  requirePlainRecord as adaptiveRequirePlainRecord,
  stableAuthorityId as adaptiveStableAuthorityId
} from "../adaptive";
import {
  hashStructuralResult,
  hashStructuralResultV2,
  projectStructuralResult,
  projectStructuralResultV2,
  serializeStructuralObject,
  serializeStructuralObjectV2,
  serializeStructuralResult
  ,serializeStructuralResultV2
} from "./canonical";
import { validateStructuralAcceptedCommandResultProjection } from "./commands";
import { validateStructuralObjectProjection, validateStructuralObjectV2Projection } from "./model";
import {
  serializeStructuralEvidenceOriginV2,
  serializeStructuralEvidenceSegmentV2,
  validateStructuralEvidenceOriginV2,
  validateStructuralEvidenceSegmentV2
} from "./evidenceArchive";
import {
  STRUCTURAL_RESULT_SCHEMA_VERSION,
  STRUCTURAL_RESULT_SCHEMA_VERSION_V2,
  STRUCTURAL_MAX_PERSISTENCE_UTF8_BYTES,
  type StructuralCommandResult,
  type StructuralObject,
  type StructuralObjectV2,
  type StructuralResultV2,
  type StructuralEvidenceOriginV2,
  type StructuralEvidenceSegmentV2,
  type StructuralRejectedCommandResult,
  type StructuralRejectionCode
} from "./types";
import {
  requireStructuralHash,
  normalizeAdaptiveAuthorityFunction,
  structuralCanonicalString,
  structuralNonNegativeSafeInteger,
  structuralFail
} from "./validation";

const canonicalAdaptiveJson = normalizeAdaptiveAuthorityFunction(adaptiveCanonicalJson);
const requireExactKeys = normalizeAdaptiveAuthorityFunction(adaptiveRequireExactKeys);
const requirePlainRecord = normalizeAdaptiveAuthorityFunction(adaptiveRequirePlainRecord);
const stableAuthorityId = normalizeAdaptiveAuthorityFunction(adaptiveStableAuthorityId);

const utf8Encoder = new TextEncoder();

const requirePersistenceByteLength = (serialized: string, path: string): string => {
  if (serialized.length > STRUCTURAL_MAX_PERSISTENCE_UTF8_BYTES) {
    return structuralFail("InvalidContract", path, `Structural persistence input exceeds the ${STRUCTURAL_MAX_PERSISTENCE_UTF8_BYTES}-byte UTF-8 limit.`);
  }
  if (utf8Encoder.encode(serialized).byteLength > STRUCTURAL_MAX_PERSISTENCE_UTF8_BYTES) {
    return structuralFail("InvalidContract", path, `Structural persistence input exceeds the ${STRUCTURAL_MAX_PERSISTENCE_UTF8_BYTES}-byte UTF-8 limit.`);
  }
  return serialized;
};

const parseJson = (serialized: string, path: string): unknown => {
  if (typeof serialized !== "string") return structuralFail("InvalidContract", path, "Structural persistence input must be a string.");
  requirePersistenceByteLength(serialized, path);
  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized) as unknown;
  } catch {
    return structuralFail("InvalidContract", path, "Structural persistence input is not valid JSON.");
  }
  if (canonicalAdaptiveJson(parsed) !== serialized) {
    return structuralFail("InvalidContract", path, "Structural persistence input must use byte-exact Adaptive canonical JSON.");
  }
  return parsed;
};

const objectFromProjection = validateStructuralObjectProjection;

const rejectionCodes: readonly StructuralRejectionCode[] = deepFreeze([
  "InvalidContract", "WrongTarget", "RevisionConflict", "DuplicateCommand", "InvalidMaterial",
  "MissingBrickCoverage", "StaleAdaptiveAuthority", "ArithmeticOverflow", "BudgetExceeded",
  "ConnectivityRejected", "MassRejected"
]);

const resultFromProjection = (value: unknown): StructuralCommandResult => {
  const record = requirePlainRecord(value, "result");
  if (record.status !== "Applied" && record.status !== "NoChange" && record.status !== "Rejected") {
    return structuralFail("InvalidContract", "result/status", "Unsupported Structural result status.");
  }
  const status = record.status;
  if (status !== "Rejected") return validateStructuralAcceptedCommandResultProjection(value);
  requireExactKeys(record, ["schemaVersion", "status", "commandId", "object", "code", "path", "resultHash"], "result");
  if (record.schemaVersion !== STRUCTURAL_RESULT_SCHEMA_VERSION) {
    return structuralFail("InvalidContract", "result/schemaVersion", "Unsupported Structural result persistence version.");
  }
  const object = objectFromProjection(record.object);
  const persistedHash = requireStructuralHash(record.resultHash, "result/resultHash");
  if (record.commandId !== null && typeof record.commandId !== "string") return structuralFail("InvalidContract", "result/commandId", "Rejected result commandId must be a stable ID or null.");
  if (typeof record.code !== "string" || !rejectionCodes.includes(record.code as StructuralRejectionCode)) return structuralFail("InvalidContract", "result/code", "Unsupported Structural rejection code.");
  const result: StructuralCommandResult = deepFreeze({
    schemaVersion: STRUCTURAL_RESULT_SCHEMA_VERSION,
    status: "Rejected",
    commandId: record.commandId === null ? null : stableAuthorityId(record.commandId, "result/commandId"),
    object,
    code: record.code as StructuralRejectionCode,
    path: structuralCanonicalString<string>(record.path, "result/path"),
    resultHash: persistedHash
  } satisfies StructuralRejectedCommandResult);
  if (hashStructuralResult(result) !== persistedHash) return structuralFail("InvalidContract", "result/resultHash", "Persisted Structural receipt hash does not match reconstructed result.");
  if (canonicalAdaptiveJson(projectStructuralResult(result)) !== canonicalAdaptiveJson(value)) {
    return structuralFail("InvalidContract", "result", "Persisted Structural result ordering or representation is noncanonical.");
  }
  return result;
};

const resultV2FromProjection = (value: unknown): StructuralResultV2 => {
  const record = requirePlainRecord(value, "result");
  if (record.schemaVersion !== STRUCTURAL_RESULT_SCHEMA_VERSION_V2 || (record.status !== "Applied" && record.status !== "NoChange" && record.status !== "Rejected")) {
    return structuralFail("InvalidContract", "result", "Unsupported Structural Result V2 projection.");
  }
  const object = validateStructuralObjectV2Projection(record.object);
  const resultHash = requireStructuralHash(record.resultHash, "result/resultHash");
  let result: StructuralResultV2;
  if (record.status === "Rejected") {
    requireExactKeys(record, ["schemaVersion", "status", "commandId", "object", "code", "path", "resultHash"], "result");
    if (typeof record.code !== "string" || !rejectionCodes.includes(record.code as StructuralRejectionCode)) return structuralFail("InvalidContract", "result/code", "Unsupported Structural rejection code.");
    result = deepFreeze({
      schemaVersion: STRUCTURAL_RESULT_SCHEMA_VERSION_V2,
      status: "Rejected",
      commandId: record.commandId === null ? null : stableAuthorityId(record.commandId as string, "result/commandId"),
      object,
      code: record.code as StructuralRejectionCode,
      path: structuralCanonicalString<string>(record.path, "result/path"),
      resultHash
    });
  } else {
    requireExactKeys(record, ["schemaVersion", "status", "commandId", "object", "changedBrickKeys", "selectedVoxelCount", "changedVoxelCount", "invalidations", "resultHash"], "result");
    const changedBrickKeys = (record.changedBrickKeys as unknown[]).map((serialized, index) => {
      if (typeof serialized !== "string") return structuralFail("InvalidContract", `result/changedBrickKeys/${index}`, "Expected canonical Adaptive brick key string.");
      let parsed: unknown;
      try { parsed = JSON.parse(serialized) as unknown; } catch { return structuralFail("InvalidContract", `result/changedBrickKeys/${index}`, "Invalid Adaptive brick key JSON."); }
      return parsed as StructuralResultV2 extends { changedBrickKeys: readonly (infer Key)[] } ? Key : never;
    });
    result = deepFreeze({
      schemaVersion: STRUCTURAL_RESULT_SCHEMA_VERSION_V2,
      status: record.status,
      commandId: stableAuthorityId(record.commandId as string, "result/commandId"),
      object,
      changedBrickKeys,
      selectedVoxelCount: structuralNonNegativeSafeInteger(record.selectedVoxelCount, "result/selectedVoxelCount"),
      changedVoxelCount: structuralNonNegativeSafeInteger(record.changedVoxelCount, "result/changedVoxelCount"),
      invalidations: record.invalidations as StructuralResultV2 extends { invalidations: infer Invalidations } ? Invalidations : never,
      resultHash
    });
  }
  if (hashStructuralResultV2(result) !== resultHash || canonicalAdaptiveJson(projectStructuralResultV2(result)) !== canonicalAdaptiveJson(value)) {
    return structuralFail("InvalidContract", "result", "Structural Result V2 commitment mismatch.");
  }
  return result;
};

export const decodeStructuralObject = (serialized: string): StructuralObject =>
  objectFromProjection(parseJson(serialized, "object"));

export const encodeStructuralObject = (object: StructuralObject): string => {
  const serialized = requirePersistenceByteLength(serializeStructuralObject(object), "object");
  decodeStructuralObject(serialized);
  return serialized;
};

export const decodeStructuralResult = (serialized: string): StructuralCommandResult =>
  resultFromProjection(parseJson(serialized, "result"));

export const encodeStructuralResult = (result: StructuralCommandResult): string => {
  const serialized = requirePersistenceByteLength(serializeStructuralResult(result), "result");
  decodeStructuralResult(serialized);
  return serialized;
};

export const rehydrateStructuralObject = decodeStructuralObject;
export const rehydrateStructuralResult = decodeStructuralResult;

export const decodeStructuralObjectV2 = (serialized: string): StructuralObjectV2 =>
  validateStructuralObjectV2Projection(parseJson(serialized, "object"));

export const encodeStructuralObjectV2 = (object: StructuralObjectV2): string => {
  const serialized = requirePersistenceByteLength(serializeStructuralObjectV2(object), "object");
  decodeStructuralObjectV2(serialized);
  return serialized;
};

export const decodeStructuralResultV2 = (serialized: string): StructuralResultV2 =>
  resultV2FromProjection(parseJson(serialized, "result"));

export const encodeStructuralResultV2 = (result: StructuralResultV2): string => {
  const serialized = requirePersistenceByteLength(serializeStructuralResultV2(result), "result");
  decodeStructuralResultV2(serialized);
  return serialized;
};

export const decodeStructuralEvidenceOriginV2 = (serialized: string): StructuralEvidenceOriginV2 =>
  validateStructuralEvidenceOriginV2(parseJson(serialized, "origin"));

export const encodeStructuralEvidenceOriginV2 = (origin: StructuralEvidenceOriginV2): string => {
  const serialized = requirePersistenceByteLength(serializeStructuralEvidenceOriginV2(origin), "origin");
  decodeStructuralEvidenceOriginV2(serialized);
  return serialized;
};

export const decodeStructuralEvidenceSegmentV2 = (serialized: string): StructuralEvidenceSegmentV2 =>
  validateStructuralEvidenceSegmentV2(parseJson(serialized, "segment"));

export const encodeStructuralEvidenceSegmentV2 = (segment: StructuralEvidenceSegmentV2): string => {
  const serialized = requirePersistenceByteLength(serializeStructuralEvidenceSegmentV2(segment), "segment");
  decodeStructuralEvidenceSegmentV2(serialized);
  return serialized;
};

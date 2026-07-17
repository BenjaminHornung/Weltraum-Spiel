import {
  canonicalAdaptiveJson as adaptiveCanonicalJson,
  deepFreeze,
  requireExactKeys as adaptiveRequireExactKeys,
  requirePlainRecord as adaptiveRequirePlainRecord,
  serializeAdaptiveKey as adaptiveSerializeKey,
  stableAuthorityId as adaptiveStableAuthorityId,
  validateAdaptiveBrickKey as adaptiveValidateBrickKey,
  type AdaptiveBrickKey
} from "../adaptive";
import {
  hashStructuralEvidence,
  hashStructuralObjectContent,
  hashStructuralResult,
  projectStructuralObject,
  projectStructuralResult,
  serializeStructuralObject,
  serializeStructuralResult
} from "./canonical";
import { localCellOffsetFromIndex, validateStructuralCellAddress } from "./coordinates";
import { reconstructStructuralObjectInternal } from "./model";
import {
  STRUCTURAL_OBJECT_SCHEMA_VERSION,
  STRUCTURAL_RESULT_SCHEMA_VERSION,
  type StructuralCommandResult,
  type StructuralDerivedInvalidation,
  type StructuralObject,
  type StructuralRejectedCommandResult,
  type StructuralRejectionCode
} from "./types";
import {
  requireStructuralHash,
  normalizeAdaptiveAuthorityFunction,
  structuralCanonicalString,
  structuralFail,
  structuralNonNegativeSafeInteger,
  structuralRevision
} from "./validation";

const canonicalAdaptiveJson = normalizeAdaptiveAuthorityFunction(adaptiveCanonicalJson);
const requireExactKeys = normalizeAdaptiveAuthorityFunction(adaptiveRequireExactKeys);
const requirePlainRecord = normalizeAdaptiveAuthorityFunction(adaptiveRequirePlainRecord);
const serializeAdaptiveKey = normalizeAdaptiveAuthorityFunction(adaptiveSerializeKey);
const stableAuthorityId = normalizeAdaptiveAuthorityFunction(adaptiveStableAuthorityId);
const validateAdaptiveBrickKey = normalizeAdaptiveAuthorityFunction(adaptiveValidateBrickKey);

const denseArray = (value: unknown, path: string): readonly unknown[] => {
  if (!Array.isArray(value)) return structuralFail("InvalidContract", path, "Expected a dense array.");
  for (let index = 0; index < value.length; index += 1) {
    if (!Object.hasOwn(value, index)) return structuralFail("InvalidContract", `${path}/${index}`, "Sparse arrays are rejected.");
  }
  return value;
};

const parseJson = (serialized: string, path: string): unknown => {
  if (typeof serialized !== "string") return structuralFail("InvalidContract", path, "Structural persistence input must be a string.");
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

const adaptiveKeyFromProjection = (value: unknown, path: string): AdaptiveBrickKey => {
  if (typeof value !== "string") return structuralFail("InvalidContract", path, "Persisted Adaptive brick keys must be canonical strings.");
  let parsed: unknown;
  try {
    parsed = JSON.parse(value) as unknown;
  } catch {
    return structuralFail("InvalidContract", path, "Persisted Adaptive brick key is not valid JSON.");
  }
  const key = validateAdaptiveBrickKey(parsed);
  if (serializeAdaptiveKey(key) !== value) return structuralFail("InvalidContract", path, "Persisted Adaptive brick key is not canonical.");
  return key;
};

const addressFromProjection = (value: unknown, path: string) => {
  const record = requirePlainRecord(value, path);
  requireExactKeys(record, ["brickKey", "localIndex"], path);
  return validateStructuralCellAddress({
    brickKey: adaptiveKeyFromProjection(record.brickKey, `${path}/brickKey`),
    local: localCellOffsetFromIndex(record.localIndex)
  }, path);
};

const objectFromProjection = (value: unknown): StructuralObject => {
  const record = requirePlainRecord(value, "object");
  requireExactKeys(record, [
    "schemaVersion", "objectId", "frame", "source", "materials", "bricks", "anchors", "joints",
    "objectRevision", "editRevision", "contentHash", "commandEvidence", "evidenceHash"
  ], "object");
  if (record.schemaVersion !== STRUCTURAL_OBJECT_SCHEMA_VERSION) {
    return structuralFail("InvalidContract", "object/schemaVersion", "Unsupported Structural object persistence version.");
  }

  const bricks = denseArray(record.bricks, "object/bricks").map((value, index) => {
    const path = `object/bricks/${index}`;
    const brick = requirePlainRecord(value, path);
    requireExactKeys(brick, ["schemaVersion", "key", "cells"], path);
    return {
      schemaVersion: brick.schemaVersion,
      key: adaptiveKeyFromProjection(brick.key, `${path}/key`),
      cells: brick.cells
    };
  });
  const anchors = denseArray(record.anchors, "object/anchors").map((value, index) => {
    const path = `object/anchors/${index}`;
    const anchor = requirePlainRecord(value, path);
    requireExactKeys(anchor, ["anchorId", "cell"], path);
    return { anchorId: anchor.anchorId, cell: addressFromProjection(anchor.cell, `${path}/cell`) };
  });
  const joints = denseArray(record.joints, "object/joints").map((value, index) => {
    const path = `object/joints/${index}`;
    const joint = requirePlainRecord(value, path);
    requireExactKeys(joint, ["jointId", "jointClass", "endpointA", "endpointB"], path);
    const endpoint = (candidate: unknown, endpointPath: string) => {
      const projected = requirePlainRecord(candidate, endpointPath);
      requireExactKeys(projected, ["cell", "role"], endpointPath);
      return { cell: addressFromProjection(projected.cell, `${endpointPath}/cell`), role: projected.role };
    };
    return {
      jointId: joint.jointId,
      jointClass: joint.jointClass,
      endpointA: endpoint(joint.endpointA, `${path}/endpointA`),
      endpointB: endpoint(joint.endpointB, `${path}/endpointB`)
    };
  });
  const commandEvidence = denseArray(record.commandEvidence, "object/commandEvidence").map((value, index) => {
    const path = `object/commandEvidence/${index}`;
    const evidence = requirePlainRecord(value, path);
    requireExactKeys(evidence, [
      "schemaVersion", "commandId", "commandHash", "status", "previousObjectRevision", "resultingObjectRevision",
      "previousEditRevision", "resultingEditRevision", "previousContentHash", "resultingContentHash",
      "changedBrickKeys", "selectedVoxelCount", "changedVoxelCount", "adaptiveJournalDigest"
    ], path);
    return {
      ...evidence,
      changedBrickKeys: denseArray(evidence.changedBrickKeys, `${path}/changedBrickKeys`)
        .map((key, keyIndex) => adaptiveKeyFromProjection(key, `${path}/changedBrickKeys/${keyIndex}`))
    };
  });

  const rebuilt = reconstructStructuralObjectInternal({
    objectId: record.objectId,
    frame: record.frame,
    source: record.source,
    materials: record.materials,
    bricks,
    anchors,
    joints,
    objectRevision: record.objectRevision,
    editRevision: record.editRevision,
    commandEvidence
  });
  const persistedContentHash = requireStructuralHash(record.contentHash, "object/contentHash");
  const persistedEvidenceHash = requireStructuralHash(record.evidenceHash, "object/evidenceHash");
  if (hashStructuralObjectContent(rebuilt) !== persistedContentHash || rebuilt.contentHash !== persistedContentHash) {
    return structuralFail("InvalidContract", "object/contentHash", "Persisted Structural content hash does not match reconstructed authority.");
  }
  if (hashStructuralEvidence(rebuilt.commandEvidence) !== persistedEvidenceHash || rebuilt.evidenceHash !== persistedEvidenceHash) {
    return structuralFail("InvalidContract", "object/evidenceHash", "Persisted Structural evidence hash does not match reconstructed evidence.");
  }
  if (canonicalAdaptiveJson(projectStructuralObject(rebuilt)) !== canonicalAdaptiveJson(value)) {
    return structuralFail("InvalidContract", "object", "Persisted Structural object ordering or representation is noncanonical.");
  }
  return rebuilt;
};

const invalidationFromProjection = (value: unknown, path: string): StructuralDerivedInvalidation => {
  const record = requirePlainRecord(value, path);
  requireExactKeys(record, ["kind", "sourceObjectRevision", "sourceContentHash"], path);
  if (record.kind !== "Components" && record.kind !== "MassProperties" && record.kind !== "Mesh") {
    return structuralFail("InvalidContract", `${path}/kind`, "Unsupported Structural invalidation kind.");
  }
  return deepFreeze({
    kind: record.kind,
    sourceObjectRevision: structuralRevision(record.sourceObjectRevision, `${path}/sourceObjectRevision`),
    sourceContentHash: requireStructuralHash(record.sourceContentHash, `${path}/sourceContentHash`)
  });
};

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
  const accepted = status !== "Rejected";
  requireExactKeys(record, accepted
    ? ["schemaVersion", "status", "commandId", "object", "changedBrickKeys", "selectedVoxelCount", "changedVoxelCount", "invalidations", "resultHash"]
    : ["schemaVersion", "status", "commandId", "object", "code", "path", "resultHash"], "result");
  if (record.schemaVersion !== STRUCTURAL_RESULT_SCHEMA_VERSION) {
    return structuralFail("InvalidContract", "result/schemaVersion", "Unsupported Structural result persistence version.");
  }
  const object = objectFromProjection(record.object);
  const persistedHash = requireStructuralHash(record.resultHash, "result/resultHash");
  let result: StructuralCommandResult;
  if (!accepted) {
    if (record.commandId !== null && typeof record.commandId !== "string") return structuralFail("InvalidContract", "result/commandId", "Rejected result commandId must be a stable ID or null.");
    if (typeof record.code !== "string" || !rejectionCodes.includes(record.code as StructuralRejectionCode)) return structuralFail("InvalidContract", "result/code", "Unsupported Structural rejection code.");
    result = deepFreeze({
      schemaVersion: STRUCTURAL_RESULT_SCHEMA_VERSION,
      status: "Rejected",
      commandId: record.commandId === null ? null : stableAuthorityId(record.commandId, "result/commandId"),
      object,
      code: record.code as StructuralRejectionCode,
      path: structuralCanonicalString<string>(record.path, "result/path"),
      resultHash: persistedHash
    } satisfies StructuralRejectedCommandResult);
  } else {
    const changedBrickKeys = denseArray(record.changedBrickKeys, "result/changedBrickKeys")
      .map((key, index) => adaptiveKeyFromProjection(key, `result/changedBrickKeys/${index}`));
    for (let index = 1; index < changedBrickKeys.length; index += 1) {
      if (serializeAdaptiveKey(changedBrickKeys[index - 1]) >= serializeAdaptiveKey(changedBrickKeys[index])) {
        return structuralFail("InvalidContract", "result/changedBrickKeys", "Result changed brick keys must be canonical sorted and unique.");
      }
    }
    const invalidations = denseArray(record.invalidations, "result/invalidations")
      .map((entry, index) => invalidationFromProjection(entry, `result/invalidations/${index}`));
    const selectedVoxelCount = structuralNonNegativeSafeInteger(record.selectedVoxelCount, "result/selectedVoxelCount");
    const changedVoxelCount = structuralNonNegativeSafeInteger(record.changedVoxelCount, "result/changedVoxelCount");
    const commandId = stableAuthorityId(record.commandId as string, "result/commandId");
    const evidence = object.commandEvidence.at(-1);
    if (
      evidence === undefined || evidence.commandId !== commandId || evidence.status !== status ||
      evidence.selectedVoxelCount !== selectedVoxelCount || evidence.changedVoxelCount !== changedVoxelCount ||
      canonicalAdaptiveJson(evidence.changedBrickKeys.map(serializeAdaptiveKey)) !== canonicalAdaptiveJson(changedBrickKeys.map(serializeAdaptiveKey))
    ) return structuralFail("InvalidContract", "result", "Accepted result must match its final persisted command evidence receipt.");
    if (status === "NoChange") {
      if (invalidations.length !== 0) return structuralFail("InvalidContract", "result/invalidations", "NoChange result must not invalidate derived products.");
    } else {
      const kinds = ["Components", "MassProperties", "Mesh"] as const;
      if (invalidations.length !== kinds.length || invalidations.some((entry, index) =>
        entry.kind !== kinds[index] || entry.sourceObjectRevision !== evidence.previousObjectRevision || entry.sourceContentHash !== evidence.previousContentHash
      )) return structuralFail("InvalidContract", "result/invalidations", "Applied result invalidations must use the canonical previous-state receipt order.");
    }
    result = deepFreeze({
      schemaVersion: STRUCTURAL_RESULT_SCHEMA_VERSION,
      status,
      commandId,
      object,
      changedBrickKeys: deepFreeze(changedBrickKeys),
      selectedVoxelCount,
      changedVoxelCount,
      invalidations: deepFreeze(invalidations),
      resultHash: persistedHash
    });
  }
  if (hashStructuralResult(result) !== persistedHash) return structuralFail("InvalidContract", "result/resultHash", "Persisted Structural receipt hash does not match reconstructed result.");
  if (canonicalAdaptiveJson(projectStructuralResult(result)) !== canonicalAdaptiveJson(value)) {
    return structuralFail("InvalidContract", "result", "Persisted Structural result ordering or representation is noncanonical.");
  }
  return result;
};

export const decodeStructuralObject = (serialized: string): StructuralObject =>
  objectFromProjection(parseJson(serialized, "object"));

export const encodeStructuralObject = (object: StructuralObject): string => {
  const serialized = serializeStructuralObject(object);
  decodeStructuralObject(serialized);
  return serialized;
};

export const decodeStructuralResult = (serialized: string): StructuralCommandResult =>
  resultFromProjection(parseJson(serialized, "result"));

export const encodeStructuralResult = (result: StructuralCommandResult): string => {
  const serialized = serializeStructuralResult(result);
  decodeStructuralResult(serialized);
  return serialized;
};

export const rehydrateStructuralObject = decodeStructuralObject;
export const rehydrateStructuralResult = decodeStructuralResult;

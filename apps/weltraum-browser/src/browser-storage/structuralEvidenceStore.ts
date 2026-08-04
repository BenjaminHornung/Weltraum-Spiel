import {
  decodeStructuralEvidenceOriginV2,
  decodeStructuralEvidenceSegmentV2,
  encodeStructuralEvidenceOriginV2,
  encodeStructuralEvidenceSegmentV2
} from "../voxel/structural/persistence";
import { requireStructuralHash } from "../voxel/structural/validation";
import type {
  StructuralEvidencePutReceiptV2,
  StructuralEvidenceRecordStoreV2
} from "../voxel/structural/evidenceArchive";

export type { StructuralEvidencePutReceiptV2, StructuralEvidenceRecordStoreV2 };

export const STRUCTURAL_EVIDENCE_STORE_ERROR_CODES = Object.freeze([
  "RepositoryUnavailable",
  "DatabaseOpenFailed",
  "TransactionFailed",
  "QuotaExceeded",
  "CorruptRecord",
  "ChecksumMismatch",
  "RecordConflict",
  "UnsupportedRepositoryVersion",
  "ClosedRepository",
  "InvalidContract"
] as const);

export type StructuralEvidenceStoreErrorCode = (typeof STRUCTURAL_EVIDENCE_STORE_ERROR_CODES)[number];

export class StructuralEvidenceStoreError extends Error {
  public constructor(
    public readonly code: StructuralEvidenceStoreErrorCode,
    public readonly operation: string,
    message: string,
    public readonly recordHash?: string
  ) {
    super(message);
    this.name = "StructuralEvidenceStoreError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export const isStructuralEvidenceStoreError = (value: unknown): value is StructuralEvidenceStoreError =>
  value instanceof StructuralEvidenceStoreError;

export interface StructuralEvidenceStoredRecordV2 {
  readonly hash: string;
  readonly canonicalBytes: string;
  readonly byteLength: number;
}

export const DEFAULT_INDEXED_DB_STRUCTURAL_EVIDENCE_DATABASE_ID = "weltraum-structural-evidence-v2";
export const INDEXED_DB_STRUCTURAL_EVIDENCE_VERSION = 1;
export const INDEXED_DB_STRUCTURAL_EVIDENCE_RECORDS_STORE = "structuralEvidenceRecords";
export const INDEXED_DB_STRUCTURAL_EVIDENCE_METADATA_STORE = "repositoryMetadata";
export const INDEXED_DB_STRUCTURAL_EVIDENCE_SCHEMA_MARKER_KEY = "structuralEvidenceSchemaVersion";

const encoder = new TextEncoder();

const mapValidationFailure = (error: unknown, operation: string, recordHash?: string): StructuralEvidenceStoreError => {
  if (isStructuralEvidenceStoreError(error)) return error;
  return new StructuralEvidenceStoreError("CorruptRecord", operation, "Structural Evidence record is invalid.", recordHash);
};

const requireHash = (value: unknown, operation: string): string => {
  try {
    return requireStructuralHash(value, `${operation}/hash`);
  } catch (error) {
    throw mapValidationFailure(error, operation, typeof value === "string" ? value : undefined);
  }
};

export const validateStructuralEvidenceHashV2 = (value: unknown, operation = "validateHash"): string => requireHash(value, operation);

const validateCanonicalBytes = (
  hash: string,
  canonicalBytes: unknown,
  operation: string
): StructuralEvidenceStoredRecordV2 => {
  if (typeof canonicalBytes !== "string") {
    throw new StructuralEvidenceStoreError("CorruptRecord", operation, "Structural Evidence bytes must be text.", hash);
  }
  const byteLength = encoder.encode(canonicalBytes).byteLength;
  let parsed: unknown;
  try {
    parsed = JSON.parse(canonicalBytes) as unknown;
  } catch {
    throw new StructuralEvidenceStoreError("CorruptRecord", operation, "Structural Evidence bytes are not JSON.", hash);
  }
  let encoded: string;
  try {
    const schemaVersion = parsed !== null && typeof parsed === "object"
      ? (parsed as { readonly schemaVersion?: unknown }).schemaVersion
      : undefined;
    if (schemaVersion === "structural-evidence-origin-v2") {
      const origin = decodeStructuralEvidenceOriginV2(canonicalBytes);
      if (origin.originHash !== hash) {
        throw new StructuralEvidenceStoreError("ChecksumMismatch", operation, "Structural Evidence Origin hash does not match its key.", hash);
      }
      encoded = encodeStructuralEvidenceOriginV2(origin);
    } else if (schemaVersion === "structural-evidence-segment-v2") {
      const segment = decodeStructuralEvidenceSegmentV2(canonicalBytes);
      if (segment.segmentHash !== hash) {
        throw new StructuralEvidenceStoreError("ChecksumMismatch", operation, "Structural Evidence Segment hash does not match its key.", hash);
      }
      encoded = encodeStructuralEvidenceSegmentV2(segment);
    } else {
      throw new StructuralEvidenceStoreError("CorruptRecord", operation, "Unsupported Structural Evidence record schema.", hash);
    }
  } catch (error) {
    if (isStructuralEvidenceStoreError(error)) throw error;
    throw mapValidationFailure(error, operation, hash);
  }
  if (encoded !== canonicalBytes) {
    throw new StructuralEvidenceStoreError("CorruptRecord", operation, "Structural Evidence bytes are not canonical.", hash);
  }
  return Object.freeze({ hash, canonicalBytes, byteLength });
};

export const validateStructuralEvidenceStoredRecordV2 = (
  key: unknown,
  value: unknown,
  operation = "validateRecord"
): StructuralEvidenceStoredRecordV2 => {
  if (typeof key !== "string") {
    throw new StructuralEvidenceStoreError("CorruptRecord", operation, "Structural Evidence physical key must be text.");
  }
  const hash = requireHash(key, operation);
  if (value === null || typeof value !== "object" || Array.isArray(value) || (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)) {
    throw new StructuralEvidenceStoreError("CorruptRecord", operation, "Structural Evidence record must be a plain object.", hash);
  }
  const record = value as Record<string, unknown>;
  const keys = Reflect.ownKeys(record);
  if (keys.length !== 3 || !keys.every((entry) => typeof entry === "string" && ["hash", "canonicalBytes", "byteLength"].includes(entry))) {
    throw new StructuralEvidenceStoreError("CorruptRecord", operation, "Structural Evidence record shape is invalid.", hash);
  }
  if (record.hash !== hash) {
    throw new StructuralEvidenceStoreError("ChecksumMismatch", operation, "Structural Evidence record hash does not match its key.", hash);
  }
  if (typeof record.byteLength !== "number" || !Number.isSafeInteger(record.byteLength) || record.byteLength < 0) {
    throw new StructuralEvidenceStoreError("CorruptRecord", operation, "Structural Evidence byte length is invalid.", hash);
  }
  const validated = validateCanonicalBytes(hash, record.canonicalBytes, operation);
  if (validated.byteLength !== record.byteLength) {
    throw new StructuralEvidenceStoreError("ChecksumMismatch", operation, "Structural Evidence byte length does not match its bytes.", hash);
  }
  return validated;
};

export const createStructuralEvidenceStoredRecordV2 = (
  hashValue: string,
  canonicalBytes: string,
  operation = "putIfAbsent"
): StructuralEvidenceStoredRecordV2 => {
  const hash = requireHash(hashValue, operation);
  return validateStructuralEvidenceStoredRecordV2(hash, validateCanonicalBytes(hash, canonicalBytes, operation), operation);
};

export const structuralEvidencePutReceipt = (
  hash: string,
  byteLength: number,
  alreadyPresent: boolean
): StructuralEvidencePutReceiptV2 => Object.freeze({
  requestedHash: hash,
  storedHash: hash,
  byteLength,
  alreadyPresent
});

export const mapStructuralEvidenceBrowserFailure = (
  error: unknown,
  operation: string,
  fallbackCode: StructuralEvidenceStoreErrorCode,
  recordHash?: string
): StructuralEvidenceStoreError => {
  if (isStructuralEvidenceStoreError(error)) return error;
  const name = error !== null && typeof error === "object" && "name" in error && typeof (error as { readonly name?: unknown }).name === "string"
    ? (error as { readonly name: string }).name
    : undefined;
  if (name === "QuotaExceededError") return new StructuralEvidenceStoreError("QuotaExceeded", operation, "IndexedDB storage quota was exceeded.", recordHash);
  if (name === "VersionError") return new StructuralEvidenceStoreError("UnsupportedRepositoryVersion", operation, "IndexedDB schema version is unsupported.", recordHash);
  if (name === "ConstraintError") return new StructuralEvidenceStoreError("RecordConflict", operation, "Structural Evidence record already exists with a conflicting value.", recordHash);
  return new StructuralEvidenceStoreError(fallbackCode, operation, "IndexedDB Structural Evidence operation failed.", recordHash);
};

export type StructuralEvidenceStoreState = "new" | "open" | "versionchanged" | "closed";

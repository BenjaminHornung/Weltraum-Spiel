import { SaveRepositoryError, type SaveRepositoryErrorCode } from "./errors";
import type { SaveContentHash } from "./types";

const sha256Pattern = /^sha256:[0-9a-f]{64}$/;

const bytesToHex = (bytes: Uint8Array): string => {
  let result = "";
  for (const byte of bytes) {
    result += byte.toString(16).padStart(2, "0");
  }
  return result;
};

export const parseSaveContentHash = (
  value: unknown,
  operation: string,
  invalidCode: SaveRepositoryErrorCode
): SaveContentHash => {
  if (typeof value !== "string" || !sha256Pattern.test(value)) {
    throw new SaveRepositoryError(invalidCode, operation, "Content hash must be a lowercase SHA-256 value.");
  }
  return value as SaveContentHash;
};

export const computeSaveContentHash = async (payloadBytes: Uint8Array): Promise<SaveContentHash> => {
  const subtle = globalThis.crypto?.subtle;
  if (subtle === undefined) {
    throw new SaveRepositoryError(
      "RepositoryUnavailable",
      "checksum",
      "SHA-256 WebCrypto capability is unavailable."
    );
  }
  try {
    const digestInput = new Uint8Array(payloadBytes.byteLength);
    digestInput.set(payloadBytes);
    const digest = await subtle.digest("SHA-256", digestInput.buffer);
    return `sha256:${bytesToHex(new Uint8Array(digest))}` as SaveContentHash;
  } catch {
    throw new SaveRepositoryError(
      "RepositoryUnavailable",
      "checksum",
      "SHA-256 WebCrypto operation is unavailable."
    );
  }
};

export const verifySaveContentHash = async (
  payloadBytes: Uint8Array,
  expectedHash: SaveContentHash,
  operation: string
): Promise<void> => {
  const actualHash = await computeSaveContentHash(payloadBytes);
  if (actualHash !== expectedHash) {
    throw new SaveRepositoryError("ChecksumMismatch", operation, "Stored payload bytes do not match their SHA-256 hash.");
  }
};

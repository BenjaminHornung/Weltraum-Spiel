import type { CacheSnapshot } from "./memoryContentCache";
import { compareStableAscii } from "./contentKey";

export type ContentHash = `fnv1a32:${string}`;

export const computeContentHash = (buffer: ArrayBuffer, byteOffset = 0, byteLength = buffer.byteLength): ContentHash => {
  if (!(buffer instanceof ArrayBuffer)) {
    throw new TypeError("Content hashing requires an ArrayBuffer.");
  }
  if (
    !Number.isSafeInteger(byteOffset) ||
    byteOffset < 0 ||
    !Number.isSafeInteger(byteLength) ||
    byteLength < 0 ||
    byteOffset + byteLength > buffer.byteLength
  ) {
    throw new RangeError("Content hash byte range is invalid.");
  }
  let hash = 0x811c9dc5;
  const bytes = new Uint8Array(buffer, byteOffset, byteLength);
  for (const byte of bytes) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `fnv1a32:${hash.toString(16).padStart(8, "0")}`;
};

export const isContentHash = (value: unknown): value is ContentHash =>
  typeof value === "string" && /^fnv1a32:[0-9a-f]{8}$/.test(value);

export interface CanonicalCacheSnapshot {
  readonly version: 1;
  readonly maxBytes: number;
  readonly totalBytes: number;
  readonly entries: readonly {
    readonly key: string;
    readonly contentHash: ContentHash;
    readonly byteLength: number;
    readonly pinCount: number;
    readonly leaseCount: number;
  }[];
}

export const canonicalizeCacheSnapshot = (snapshot: CacheSnapshot): CanonicalCacheSnapshot =>
  Object.freeze({
    version: 1 as const,
    maxBytes: snapshot.maxBytes,
    totalBytes: snapshot.totalBytes,
    entries: Object.freeze(
      snapshot.entries
        .map((entry) =>
          Object.freeze({
            key: entry.canonicalKey,
            contentHash: entry.contentHash,
            byteLength: entry.byteLength,
            pinCount: entry.pinCount,
            leaseCount: entry.leaseCount
          })
        )
        .sort((left, right) => compareStableAscii(left.key, right.key))
    )
  });

export const serializeCanonicalCacheSnapshot = (snapshot: CacheSnapshot): string =>
  JSON.stringify(canonicalizeCacheSnapshot(snapshot));

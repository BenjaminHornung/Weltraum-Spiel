import { computeContentHash, type ContentHash } from "./canonical";
import { createContentKey, type ContentKey } from "./contentKey";

export interface ContentRequest {
  readonly key: ContentKey;
  readonly expectedContentHash?: ContentHash;
  readonly maxBytes?: number;
}

export interface ContentProviderRequest extends ContentRequest {
  readonly signal: AbortSignal;
}

export interface ContentProviderResult {
  readonly key: ContentKey;
  readonly buffer: ArrayBuffer;
  readonly byteLength: number;
  readonly contentHash: ContentHash;
  readonly layout: string;
}

export interface ContentProvider {
  load(request: ContentProviderRequest): Promise<ContentProviderResult>;
}

export interface DeterministicContentProviderOptions {
  readonly byteLength: number | ((key: ContentKey) => number);
  readonly layout?: string;
  readonly chunkBytes?: number;
}

const abortError = (): Error => {
  const error = new Error("Content provider operation was aborted.");
  error.name = "AbortError";
  return error;
};

const fixtureSeed = (key: ContentKey): number => {
  const text = `${key.namespace}\u0000${key.contentId}\u0000${key.inputRevision}\u0000${key.algorithmVersion}\u0000${key.outputRevision}`;
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
};

/** Creates neutral deterministic bytes for tests; it carries no gameplay or world semantics. */
export const createDeterministicContentProvider = (
  options: DeterministicContentProviderOptions
): ContentProvider => {
  const chunkBytes = options.chunkBytes ?? 64 * 1024;
  if (!Number.isSafeInteger(chunkBytes) || chunkBytes <= 0) {
    throw new RangeError("chunkBytes must be a positive safe integer.");
  }
  return Object.freeze({
    async load(request: ContentProviderRequest): Promise<ContentProviderResult> {
      if (request.signal.aborted) {
        throw abortError();
      }
      const key = createContentKey(request.key);
      const byteLength = typeof options.byteLength === "function" ? options.byteLength(key) : options.byteLength;
      if (!Number.isSafeInteger(byteLength) || byteLength < 0) {
        throw new RangeError("Fixture byteLength must be a nonnegative safe integer.");
      }
      const buffer = new ArrayBuffer(byteLength);
      const bytes = new Uint8Array(buffer);
      let state = fixtureSeed(key);
      for (let start = 0; start < byteLength; start += chunkBytes) {
        if (request.signal.aborted) {
          throw abortError();
        }
        const end = Math.min(start + chunkBytes, byteLength);
        for (let index = start; index < end; index += 1) {
          state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
          bytes[index] = state >>> 24;
        }
        if (end < byteLength) {
          await new Promise<void>((resolve) => setTimeout(resolve, 0));
        }
      }
      return Object.freeze({
        key,
        buffer,
        byteLength,
        contentHash: computeContentHash(buffer),
        layout: options.layout ?? "bytes/u8"
      });
    }
  });
};

export type StreamingBrand<T, Name extends string> = T & {
  readonly __streamingBrand: Name;
};

export type ContentNamespace = StreamingBrand<string, "ContentNamespace">;
export type ContentId = StreamingBrand<string, "ContentId">;
export type ContentKeyCanonical = StreamingBrand<string, "ContentKeyCanonical">;

export interface ContentKey {
  readonly namespace: ContentNamespace;
  readonly contentId: ContentId;
  readonly inputRevision: number;
  readonly algorithmVersion: number;
  readonly outputRevision: number;
}

export type ContentKeyErrorCode = "INVALID_IDENTIFIER" | "INVALID_REVISION" | "INVALID_CONTENT_KEY";

export class ContentKeyError extends Error {
  public constructor(
    public readonly code: ContentKeyErrorCode,
    public readonly path: string,
    message: string
  ) {
    super(message);
    this.name = "ContentKeyError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export const MAX_CONTENT_IDENTIFIER_LENGTH = 128;

const stableAsciiPattern = /^[\x21-\x7e]+$/;

const parseIdentifier = <T extends string>(value: unknown, path: string): T => {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > MAX_CONTENT_IDENTIFIER_LENGTH ||
    !stableAsciiPattern.test(value)
  ) {
    throw new ContentKeyError(
      "INVALID_IDENTIFIER",
      path,
      `Expected 1-${MAX_CONTENT_IDENTIFIER_LENGTH} printable ASCII characters.`
    );
  }
  return value as T;
};

export const parseContentNamespace = (value: unknown, path = "/namespace"): ContentNamespace =>
  parseIdentifier<ContentNamespace>(value, path);

export const parseContentId = (value: unknown, path = "/contentId"): ContentId =>
  parseIdentifier<ContentId>(value, path);

export const parseContentRevision = (value: unknown, path: string): number => {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new ContentKeyError("INVALID_REVISION", path, "Expected a nonnegative safe integer.");
  }
  return value as number;
};

export const createContentKey = (value: {
  readonly namespace: unknown;
  readonly contentId: unknown;
  readonly inputRevision: unknown;
  readonly algorithmVersion: unknown;
  readonly outputRevision: unknown;
}): ContentKey =>
  Object.freeze({
    namespace: parseContentNamespace(value.namespace),
    contentId: parseContentId(value.contentId),
    inputRevision: parseContentRevision(value.inputRevision, "/inputRevision"),
    algorithmVersion: parseContentRevision(value.algorithmVersion, "/algorithmVersion"),
    outputRevision: parseContentRevision(value.outputRevision, "/outputRevision")
  });

export const canonicalizeContentKey = (key: ContentKey): ContentKeyCanonical => {
  const snapshot = createContentKey(key);
  return JSON.stringify([
    snapshot.namespace,
    snapshot.contentId,
    snapshot.inputRevision,
    snapshot.algorithmVersion,
    snapshot.outputRevision
  ]) as ContentKeyCanonical;
};

/** Compares stable ASCII strings by code unit without locale or host collation. */
export const compareStableAscii = (left: string, right: string): number => (left < right ? -1 : left > right ? 1 : 0);

export const compareContentKeys = (left: ContentKey, right: ContentKey): number =>
  compareStableAscii(canonicalizeContentKey(left), canonicalizeContentKey(right));

export const contentKeysEqual = (left: ContentKey, right: ContentKey): boolean =>
  canonicalizeContentKey(left) === canonicalizeContentKey(right);

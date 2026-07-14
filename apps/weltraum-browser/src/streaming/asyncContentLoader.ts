import { parseByteLength } from "./budgets";
import { computeContentHash, isContentHash, type ContentHash } from "./canonical";
import { canonicalizeContentKey, contentKeysEqual, createContentKey, type ContentKeyCanonical } from "./contentKey";
import type { ContentProvider, ContentProviderResult, ContentRequest } from "./contentProvider";
import { MemoryContentCache, type ContentLease } from "./memoryContentCache";

export type ContentLoaderErrorCode =
  | "INVALID_REQUEST"
  | "PROVIDER_KEY_MISMATCH"
  | "PROVIDER_BYTE_LENGTH_MISMATCH"
  | "PROVIDER_LAYOUT_INVALID"
  | "PROVIDER_HASH_MISMATCH"
  | "RESULT_OVER_BUDGET";

export class ContentLoaderError extends Error {
  public constructor(
    public readonly code: ContentLoaderErrorCode,
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "ContentLoaderError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export type ContentLoadResult =
  | Readonly<{
      readonly kind: "Loaded";
      readonly source: "Cache" | "Provider";
      readonly lease: ContentLease;
    }>
  | Readonly<{
      readonly kind: "Cancelled";
      readonly key: ContentKeyCanonical;
    }>
  | Readonly<{
      readonly kind: "Failed";
      readonly key: ContentKeyCanonical;
      readonly error: unknown;
    }>;

export type ContentLoaderEvent = Readonly<
  | { readonly kind: "Request"; readonly key: ContentKeyCanonical }
  | { readonly kind: "CacheHit"; readonly key: ContentKeyCanonical; readonly byteLength: number }
  | { readonly kind: "CacheMiss"; readonly key: ContentKeyCanonical }
  | { readonly kind: "Deduplicated"; readonly key: ContentKeyCanonical }
  | { readonly kind: "Loaded"; readonly key: ContentKeyCanonical; readonly byteLength: number }
  | { readonly kind: "Cancelled"; readonly key: ContentKeyCanonical }
  | { readonly kind: "Failed"; readonly key: ContentKeyCanonical; readonly error: unknown }
>;

export interface AsyncContentLoaderOptions {
  readonly observer?: (event: ContentLoaderEvent) => void;
}

interface RequestSnapshot {
  readonly key: ReturnType<typeof createContentKey>;
  readonly canonicalKey: ContentKeyCanonical;
  readonly expectedContentHash?: ContentHash;
  readonly maxBytes?: number;
  readonly signature: string;
}

interface Subscriber {
  settled: boolean;
  readonly resolve: (result: ContentLoadResult) => void;
  readonly signal?: AbortSignal;
  onAbort?: () => void;
}

interface InFlight {
  readonly request: RequestSnapshot;
  readonly controller: AbortController;
  readonly subscribers: Set<Subscriber>;
}

const stableAsciiLayout = /^[\x21-\x7e]+$/;

export class AsyncContentLoader {
  readonly #inFlight = new Map<string, InFlight>();
  readonly #observer?: (event: ContentLoaderEvent) => void;

  public constructor(
    public readonly cache: MemoryContentCache,
    public readonly provider: ContentProvider,
    options: AsyncContentLoaderOptions = {}
  ) {
    this.#observer = options.observer;
  }

  public get inFlightCount(): number {
    return this.#inFlight.size;
  }

  public load(request: ContentRequest, signal?: AbortSignal): Promise<ContentLoadResult> {
    const snapshot = this.#snapshotRequest(request);
    this.#emit(Object.freeze({ kind: "Request", key: snapshot.canonicalKey }));
    if (signal?.aborted === true) {
      this.#emit(Object.freeze({ kind: "Cancelled", key: snapshot.canonicalKey }));
      return Promise.resolve(Object.freeze({ kind: "Cancelled", key: snapshot.canonicalKey }));
    }

    let cached: ContentLease | undefined;
    try {
      cached = this.cache.get(snapshot.key, snapshot.expectedContentHash);
    } catch (error) {
      const failed = Object.freeze({ kind: "Failed" as const, key: snapshot.canonicalKey, error });
      this.#emit(failed);
      return Promise.resolve(failed);
    }
    if (cached !== undefined) {
      if (snapshot.maxBytes !== undefined && cached.byteLength > snapshot.maxBytes) {
        cached.release();
        const error = new ContentLoaderError("RESULT_OVER_BUDGET", "Cached content exceeds the request byte budget.");
        const failed = Object.freeze({ kind: "Failed" as const, key: snapshot.canonicalKey, error });
        this.#emit(failed);
        return Promise.resolve(failed);
      }
      this.#emit(Object.freeze({ kind: "CacheHit", key: snapshot.canonicalKey, byteLength: cached.byteLength }));
      return Promise.resolve(Object.freeze({ kind: "Loaded", source: "Cache", lease: cached }));
    }
    this.#emit(Object.freeze({ kind: "CacheMiss", key: snapshot.canonicalKey }));

    let operation = this.#inFlight.get(snapshot.signature);
    let startsProvider = false;
    if (operation === undefined) {
      operation = {
        request: snapshot,
        controller: new AbortController(),
        subscribers: new Set<Subscriber>()
      };
      this.#inFlight.set(snapshot.signature, operation);
      startsProvider = true;
    } else {
      this.#emit(Object.freeze({ kind: "Deduplicated", key: snapshot.canonicalKey }));
    }
    const subscription = this.#subscribe(operation, signal);
    if (startsProvider && operation.subscribers.size > 0 && !operation.controller.signal.aborted) {
      void this.#run(operation);
    }
    return subscription;
  }

  #snapshotRequest(request: ContentRequest): RequestSnapshot {
    if (request === null || typeof request !== "object") {
      throw new ContentLoaderError("INVALID_REQUEST", "Content request must be an object.");
    }
    const key = createContentKey(request.key);
    const canonicalKey = canonicalizeContentKey(key);
    const expectedContentHash = request.expectedContentHash;
    if (expectedContentHash !== undefined && !isContentHash(expectedContentHash)) {
      throw new ContentLoaderError("INVALID_REQUEST", "Expected content hash is invalid.");
    }
    const maxBytes = request.maxBytes === undefined ? undefined : parseByteLength(request.maxBytes, "/maxBytes");
    return Object.freeze({
      key,
      canonicalKey,
      expectedContentHash,
      maxBytes,
      signature: JSON.stringify([canonicalKey, expectedContentHash ?? null, maxBytes ?? null])
    });
  }

  #subscribe(operation: InFlight, signal?: AbortSignal): Promise<ContentLoadResult> {
    return new Promise<ContentLoadResult>((resolve) => {
      const subscriber: Subscriber = { settled: false, resolve, signal };
      if (signal !== undefined) {
        subscriber.onAbort = (): void => this.#cancelSubscriber(operation, subscriber);
        signal.addEventListener("abort", subscriber.onAbort, { once: true });
      }
      operation.subscribers.add(subscriber);
      if (signal?.aborted === true) {
        this.#cancelSubscriber(operation, subscriber);
      }
    });
  }

  #cancelSubscriber(operation: InFlight, subscriber: Subscriber): void {
    if (subscriber.settled) {
      return;
    }
    subscriber.settled = true;
    operation.subscribers.delete(subscriber);
    this.#detachAbort(subscriber);
    const result = Object.freeze({ kind: "Cancelled" as const, key: operation.request.canonicalKey });
    subscriber.resolve(result);
    this.#emit(result);
    if (operation.subscribers.size === 0) {
      if (this.#inFlight.get(operation.request.signature) === operation) {
        this.#inFlight.delete(operation.request.signature);
      }
      operation.controller.abort();
    }
  }

  async #run(operation: InFlight): Promise<void> {
    try {
      const result = await this.provider.load(
        Object.freeze({
          key: operation.request.key,
          expectedContentHash: operation.request.expectedContentHash,
          maxBytes: operation.request.maxBytes,
          signal: operation.controller.signal
        })
      );
      if (operation.subscribers.size === 0 || operation.controller.signal.aborted) {
        return;
      }
      const validated = this.#validateProviderResult(operation.request, result);
      this.cache.put(validated);
      const subscribers = [...operation.subscribers];
      for (const subscriber of subscribers) {
        if (subscriber.settled) {
          continue;
        }
        const lease = this.cache.get(operation.request.key, validated.contentHash);
        if (lease === undefined) {
          throw new ContentLoaderError("INVALID_REQUEST", "Newly admitted content was not available from cache.");
        }
        subscriber.settled = true;
        operation.subscribers.delete(subscriber);
        this.#detachAbort(subscriber);
        subscriber.resolve(Object.freeze({ kind: "Loaded", source: "Provider", lease }));
      }
      this.#emit(
        Object.freeze({ kind: "Loaded", key: operation.request.canonicalKey, byteLength: validated.byteLength })
      );
    } catch (error) {
      if (operation.subscribers.size > 0) {
        const failed = Object.freeze({ kind: "Failed" as const, key: operation.request.canonicalKey, error });
        for (const subscriber of [...operation.subscribers]) {
          if (!subscriber.settled) {
            subscriber.settled = true;
            this.#detachAbort(subscriber);
            subscriber.resolve(failed);
          }
        }
        operation.subscribers.clear();
        this.#emit(failed);
      }
    } finally {
      if (this.#inFlight.get(operation.request.signature) === operation) {
        this.#inFlight.delete(operation.request.signature);
      }
    }
  }

  #validateProviderResult(request: RequestSnapshot, result: ContentProviderResult): ContentProviderResult {
    if (!contentKeysEqual(request.key, result.key)) {
      throw new ContentLoaderError("PROVIDER_KEY_MISMATCH", "Provider result key or revision is stale.");
    }
    if (!(result.buffer instanceof ArrayBuffer) || result.buffer.byteLength !== result.byteLength) {
      throw new ContentLoaderError(
        "PROVIDER_BYTE_LENGTH_MISMATCH",
        "Provider buffer and declared byte length must match exactly."
      );
    }
    parseByteLength(result.byteLength);
    if (request.maxBytes !== undefined && result.byteLength > request.maxBytes) {
      throw new ContentLoaderError("RESULT_OVER_BUDGET", "Provider result exceeds the request byte budget.");
    }
    if (typeof result.layout !== "string" || result.layout.length === 0 || result.layout.length > 128 || !stableAsciiLayout.test(result.layout)) {
      throw new ContentLoaderError("PROVIDER_LAYOUT_INVALID", "Provider result layout is invalid.");
    }
    if (!isContentHash(result.contentHash) || computeContentHash(result.buffer) !== result.contentHash) {
      throw new ContentLoaderError("PROVIDER_HASH_MISMATCH", "Provider result content hash is invalid.");
    }
    if (request.expectedContentHash !== undefined && result.contentHash !== request.expectedContentHash) {
      throw new ContentLoaderError("PROVIDER_HASH_MISMATCH", "Provider result does not match the requested hash.");
    }
    return Object.freeze({
      key: createContentKey(result.key),
      buffer: result.buffer,
      byteLength: result.byteLength,
      contentHash: result.contentHash,
      layout: result.layout
    });
  }

  #detachAbort(subscriber: Subscriber): void {
    if (subscriber.signal !== undefined && subscriber.onAbort !== undefined) {
      subscriber.signal.removeEventListener("abort", subscriber.onAbort);
    }
  }

  #emit(event: ContentLoaderEvent): void {
    try {
      this.#observer?.(event);
    } catch {
      // Diagnostics cannot alter loading decisions.
    }
  }
}

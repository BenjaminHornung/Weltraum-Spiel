import { createCacheBudget, type CacheBudget } from "./budgets";
import { computeContentHash, isContentHash, type ContentHash } from "./canonical";
import {
  canonicalizeContentKey,
  compareStableAscii,
  createContentKey,
  type ContentKey,
  type ContentKeyCanonical
} from "./contentKey";

export type MemoryContentCacheErrorCode =
  | "INVALID_ENTRY"
  | "CONTENT_HASH_MISMATCH"
  | "ENTRY_OVER_BUDGET"
  | "BUDGET_EXHAUSTED"
  | "ACCESS_SEQUENCE_EXHAUSTED";

export class MemoryContentCacheError extends Error {
  public constructor(
    public readonly code: MemoryContentCacheErrorCode,
    message: string
  ) {
    super(message);
    this.name = "MemoryContentCacheError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export interface CacheEntryInput {
  readonly key: ContentKey;
  readonly buffer: ArrayBuffer;
  readonly byteLength: number;
  readonly contentHash: ContentHash;
  readonly layout: string;
}

/** The buffer is shared without a per-hit copy and is contractually readonly for lease consumers. */
export interface ReadonlyContentData {
  readonly key: ContentKey;
  readonly buffer: ArrayBuffer;
  readonly byteLength: number;
  readonly contentHash: ContentHash;
  readonly layout: string;
}

export interface ContentLease extends ReadonlyContentData {
  readonly canonicalKey: ContentKeyCanonical;
  readonly isValid: boolean;
  readonly isReleased: boolean;
  release(): void;
}

export interface ContentPin {
  readonly canonicalKey: ContentKeyCanonical;
  readonly isValid: boolean;
  readonly isReleased: boolean;
  release(): void;
}

export interface CacheEntrySnapshot {
  readonly canonicalKey: ContentKeyCanonical;
  readonly key: ContentKey;
  readonly contentHash: ContentHash;
  readonly layout: string;
  readonly byteLength: number;
  readonly pinCount: number;
  readonly leaseCount: number;
  readonly lastAccessSequence: number;
}

export interface CacheSnapshot {
  readonly version: 1;
  readonly maxBytes: number;
  readonly totalBytes: number;
  readonly entryCount: number;
  readonly pinnedEntries: number;
  readonly leasedEntries: number;
  readonly evictionCount: number;
  readonly generation: number;
  readonly entries: readonly CacheEntrySnapshot[];
}

export interface MemoryContentCacheObserver {
  (event: Readonly<
    | { readonly kind: "Hit"; readonly canonicalKey: ContentKeyCanonical; readonly byteLength: number }
    | { readonly kind: "Miss"; readonly canonicalKey: ContentKeyCanonical }
    | { readonly kind: "Admitted"; readonly canonicalKey: ContentKeyCanonical; readonly byteLength: number }
    | { readonly kind: "Evicted"; readonly canonicalKey: ContentKeyCanonical; readonly byteLength: number }
    | { readonly kind: "Cleared"; readonly entries: number; readonly bytes: number }
  >): void;
}

interface MutableEntry {
  readonly canonicalKey: ContentKeyCanonical;
  readonly data: ReadonlyContentData;
  pinCount: number;
  leaseCount: number;
  lastAccessSequence: number;
  active: boolean;
  readonly generation: number;
}

const stableAsciiLayout = /^[\x21-\x7e]+$/;

export class MemoryContentCache {
  readonly #entries = new Map<ContentKeyCanonical, MutableEntry>();
  readonly #budget: CacheBudget;
  readonly #observer?: MemoryContentCacheObserver;
  #totalBytes = 0;
  #accessSequence = 0;
  #evictionCount = 0;
  #generation = 0;

  public constructor(budget: CacheBudget | number, observer?: MemoryContentCacheObserver) {
    this.#budget = createCacheBudget(budget);
    this.#observer = observer;
  }

  public get maxBytes(): number {
    return this.#budget.maxBytes;
  }

  public get totalBytes(): number {
    return this.#totalBytes;
  }

  public get size(): number {
    return this.#entries.size;
  }

  public has(key: ContentKey): boolean {
    return this.#entries.has(canonicalizeContentKey(key));
  }

  public get(key: ContentKey, expectedHash?: ContentHash): ContentLease | undefined {
    const canonicalKey = canonicalizeContentKey(key);
    const entry = this.#entries.get(canonicalKey);
    if (entry === undefined) {
      this.#emit(Object.freeze({ kind: "Miss", canonicalKey }));
      return undefined;
    }
    if (expectedHash !== undefined && entry.data.contentHash !== expectedHash) {
      throw new MemoryContentCacheError(
        "CONTENT_HASH_MISMATCH",
        `Cached content for ${canonicalKey} does not match the expected hash.`
      );
    }
    this.#touch(entry);
    entry.leaseCount += 1;
    this.#emit(Object.freeze({ kind: "Hit", canonicalKey, byteLength: entry.data.byteLength }));
    return this.#createLease(entry);
  }

  public put(input: CacheEntryInput): void {
    const data = this.#validateEntry(input);
    const canonicalKey = canonicalizeContentKey(data.key);
    const existing = this.#entries.get(canonicalKey);
    if (existing !== undefined) {
      if (existing.data.contentHash !== data.contentHash) {
        throw new MemoryContentCacheError(
          "CONTENT_HASH_MISMATCH",
          `Content key ${canonicalKey} is already associated with a different hash.`
        );
      }
      this.#touch(existing);
      return;
    }
    if (data.byteLength > this.maxBytes) {
      throw new MemoryContentCacheError("ENTRY_OVER_BUDGET", "Content entry exceeds the cache byte budget.");
    }
    const requiredBytes = this.#totalBytes + data.byteLength - this.maxBytes;
    const victims = requiredBytes > 0 ? this.#selectVictims(requiredBytes) : [];
    for (const victim of victims) {
      this.#evict(victim);
    }
    const entry: MutableEntry = {
      canonicalKey,
      data,
      pinCount: 0,
      leaseCount: 0,
      lastAccessSequence: this.#nextAccessSequence(),
      active: true,
      generation: this.#generation
    };
    this.#entries.set(canonicalKey, entry);
    this.#totalBytes += data.byteLength;
    this.#emit(Object.freeze({ kind: "Admitted", canonicalKey, byteLength: data.byteLength }));
  }

  public acquire(key: ContentKey, expectedHash?: ContentHash): ContentLease | undefined {
    return this.get(key, expectedHash);
  }

  public pin(key: ContentKey): ContentPin | undefined {
    const canonicalKey = canonicalizeContentKey(key);
    const entry = this.#entries.get(canonicalKey);
    if (entry === undefined) {
      return undefined;
    }
    this.#touch(entry);
    entry.pinCount += 1;
    return this.#createPin(entry);
  }

  public trim(): number {
    if (this.#totalBytes <= this.maxBytes) {
      return 0;
    }
    const victims = this.#selectVictims(this.#totalBytes - this.maxBytes);
    for (const victim of victims) {
      this.#evict(victim);
    }
    return victims.length;
  }

  public delete(key: ContentKey): boolean {
    const entry = this.#entries.get(canonicalizeContentKey(key));
    if (entry === undefined || entry.pinCount > 0 || entry.leaseCount > 0) {
      return false;
    }
    this.#evict(entry);
    return true;
  }

  public clear(): void {
    const entries = this.#entries.size;
    const bytes = this.#totalBytes;
    for (const entry of this.#entries.values()) {
      entry.active = false;
    }
    this.#entries.clear();
    this.#totalBytes = 0;
    this.#generation = this.#generation === Number.MAX_SAFE_INTEGER ? 0 : this.#generation + 1;
    this.#accessSequence = 0;
    this.#emit(Object.freeze({ kind: "Cleared", entries, bytes }));
  }

  public snapshot(): CacheSnapshot {
    const entries = [...this.#entries.values()]
      .sort((left, right) => compareStableAscii(left.canonicalKey, right.canonicalKey))
      .map((entry): CacheEntrySnapshot =>
        Object.freeze({
          canonicalKey: entry.canonicalKey,
          key: entry.data.key,
          contentHash: entry.data.contentHash,
          layout: entry.data.layout,
          byteLength: entry.data.byteLength,
          pinCount: entry.pinCount,
          leaseCount: entry.leaseCount,
          lastAccessSequence: entry.lastAccessSequence
        })
      );
    return Object.freeze({
      version: 1 as const,
      maxBytes: this.maxBytes,
      totalBytes: this.#totalBytes,
      entryCount: entries.length,
      pinnedEntries: entries.filter((entry) => entry.pinCount > 0).length,
      leasedEntries: entries.filter((entry) => entry.leaseCount > 0).length,
      evictionCount: this.#evictionCount,
      generation: this.#generation,
      entries: Object.freeze(entries)
    });
  }

  #validateEntry(input: CacheEntryInput): ReadonlyContentData {
    const key = createContentKey(input.key);
    if (!(input.buffer instanceof ArrayBuffer) || input.buffer.byteLength !== input.byteLength) {
      throw new MemoryContentCacheError("INVALID_ENTRY", "Content buffer and declared byte length must match exactly.");
    }
    if (!Number.isSafeInteger(input.byteLength) || input.byteLength < 0) {
      throw new MemoryContentCacheError("INVALID_ENTRY", "Content byte length must be a nonnegative safe integer.");
    }
    if (!isContentHash(input.contentHash) || computeContentHash(input.buffer) !== input.contentHash) {
      throw new MemoryContentCacheError("CONTENT_HASH_MISMATCH", "Content hash does not match the supplied bytes.");
    }
    if (typeof input.layout !== "string" || input.layout.length === 0 || input.layout.length > 128 || !stableAsciiLayout.test(input.layout)) {
      throw new MemoryContentCacheError("INVALID_ENTRY", "Content layout must be a nonempty bounded printable ASCII identifier.");
    }
    return Object.freeze({
      key,
      buffer: input.buffer,
      byteLength: input.byteLength,
      contentHash: input.contentHash,
      layout: input.layout
    });
  }

  #selectVictims(requiredBytes: number): MutableEntry[] {
    const candidates = [...this.#entries.values()]
      .filter((entry) => entry.pinCount === 0 && entry.leaseCount === 0)
      .sort(
        (left, right) =>
          left.lastAccessSequence - right.lastAccessSequence ||
          compareStableAscii(left.canonicalKey, right.canonicalKey)
      );
    const victims: MutableEntry[] = [];
    let reclaimed = 0;
    for (const entry of candidates) {
      victims.push(entry);
      reclaimed += entry.data.byteLength;
      if (reclaimed >= requiredBytes) {
        return victims;
      }
    }
    throw new MemoryContentCacheError(
      "BUDGET_EXHAUSTED",
      "Cache budget cannot be satisfied because remaining entries are pinned or leased."
    );
  }

  #evict(entry: MutableEntry): void {
    if (!this.#entries.delete(entry.canonicalKey)) {
      return;
    }
    entry.active = false;
    this.#totalBytes -= entry.data.byteLength;
    this.#evictionCount = Math.min(Number.MAX_SAFE_INTEGER, this.#evictionCount + 1);
    this.#emit(Object.freeze({ kind: "Evicted", canonicalKey: entry.canonicalKey, byteLength: entry.data.byteLength }));
  }

  #touch(entry: MutableEntry): void {
    entry.lastAccessSequence = this.#nextAccessSequence();
  }

  #nextAccessSequence(): number {
    if (this.#accessSequence === Number.MAX_SAFE_INTEGER) {
      const ordered = [...this.#entries.values()].sort(
        (left, right) =>
          left.lastAccessSequence - right.lastAccessSequence ||
          compareStableAscii(left.canonicalKey, right.canonicalKey)
      );
      if (ordered.length >= Number.MAX_SAFE_INTEGER) {
        throw new MemoryContentCacheError("ACCESS_SEQUENCE_EXHAUSTED", "Cache access sequence is exhausted.");
      }
      ordered.forEach((entry, index) => {
        entry.lastAccessSequence = index + 1;
      });
      this.#accessSequence = ordered.length;
    }
    this.#accessSequence += 1;
    return this.#accessSequence;
  }

  #createLease(entry: MutableEntry): ContentLease {
    let released = false;
    const cache = this;
    return Object.freeze({
      ...entry.data,
      canonicalKey: entry.canonicalKey,
      get isValid(): boolean {
        return !released && entry.active && entry.generation === cache.#generation;
      },
      get isReleased(): boolean {
        return released;
      },
      release(): void {
        if (released) {
          return;
        }
        released = true;
        if (entry.active && entry.generation === cache.#generation && entry.leaseCount > 0) {
          entry.leaseCount -= 1;
        }
      }
    });
  }

  #createPin(entry: MutableEntry): ContentPin {
    let released = false;
    const cache = this;
    return Object.freeze({
      canonicalKey: entry.canonicalKey,
      get isValid(): boolean {
        return !released && entry.active && entry.generation === cache.#generation;
      },
      get isReleased(): boolean {
        return released;
      },
      release(): void {
        if (released) {
          return;
        }
        released = true;
        if (entry.active && entry.generation === cache.#generation && entry.pinCount > 0) {
          entry.pinCount -= 1;
        }
      }
    });
  }

  #emit(event: Parameters<MemoryContentCacheObserver>[0]): void {
    try {
      this.#observer?.(event);
    } catch {
      // Observability cannot alter cache decisions.
    }
  }
}

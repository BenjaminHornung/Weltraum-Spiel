import { describe, expect, it } from "vitest";
import {
  MemoryContentCache,
  MemoryContentCacheError,
  canonicalizeContentKey,
  canonicalizeCacheSnapshot,
  computeContentHash,
  createContentKey,
  type MemoryContentCacheObserver
} from "../../src/streaming";

const key = (id: string) => createContentKey({
  namespace: "fixture",
  contentId: id,
  inputRevision: 1,
  algorithmVersion: 2,
  outputRevision: 3
});

const entry = (id: string, bytes: number, fill: number) => {
  const buffer = new ArrayBuffer(bytes);
  new Uint8Array(buffer).fill(fill);
  return { key: key(id), buffer, byteLength: bytes, contentHash: computeContentHash(buffer), layout: "bytes/u8" };
};

describe("MemoryContentCache", () => {
  it("enforces the byte budget with deterministic LRU eviction", () => {
    const cache = new MemoryContentCache(8);
    cache.put(entry("b", 4, 2));
    cache.put(entry("a", 4, 1));
    cache.get(key("b"))?.release();
    cache.put(entry("c", 4, 3));

    expect(cache.has(key("a"))).toBe(false);
    expect(cache.has(key("b"))).toBe(true);
    expect(cache.has(key("c"))).toBe(true);
    expect(cache.totalBytes).toBe(8);
  });

  it("does not evict pinned or leased entries and release is idempotent", () => {
    const cache = new MemoryContentCache(8);
    cache.put(entry("pinned", 4, 1));
    cache.put(entry("leased", 4, 2));
    const pin = cache.pin(key("pinned"));
    const lease = cache.get(key("leased"));
    expect(() => cache.put(entry("blocked", 4, 3))).toThrowError(MemoryContentCacheError);

    pin?.release();
    pin?.release();
    lease?.release();
    lease?.release();
    cache.put(entry("allowed", 4, 4));
    expect(cache.totalBytes).toBeLessThanOrEqual(8);
    expect(cache.has(key("allowed"))).toBe(true);
  });

  it("publishes frozen canonical events only for distinct pin transitions", () => {
    const events: Parameters<MemoryContentCacheObserver>[0][] = [];
    const observedPinCounts: number[] = [];
    let cache: MemoryContentCache;
    cache = new MemoryContentCache(16, (event) => {
      events.push(event);
      if (event.kind === "Pinned" || event.kind === "Unpinned") {
        observedPinCounts.push(
          cache.snapshot().entries.find((entry) => entry.canonicalKey === event.canonicalKey)?.pinCount ?? -1
        );
      }
    });
    cache.put(entry("first", 4, 1));
    cache.put(entry("second", 4, 2));
    events.length = 0;

    const firstPin = cache.pin(key("first"));
    const duplicateFirstPin = cache.pin(key("first"));
    const secondPin = cache.pin(key("second"));
    expect(cache.pin(key("missing"))).toBeUndefined();

    duplicateFirstPin?.release();
    duplicateFirstPin?.release();
    firstPin?.release();
    firstPin?.release();
    secondPin?.release();

    expect(events).toEqual([
      { kind: "Pinned", canonicalKey: canonicalizeContentKey(key("first")) },
      { kind: "Pinned", canonicalKey: canonicalizeContentKey(key("second")) },
      { kind: "Unpinned", canonicalKey: canonicalizeContentKey(key("first")) },
      { kind: "Unpinned", canonicalKey: canonicalizeContentKey(key("second")) }
    ]);
    expect(observedPinCounts).toEqual([1, 1, 0, 0]);
    expect(events.every(Object.isFrozen)).toBe(true);
    expect(cache.snapshot().pinnedEntries).toBe(0);
  });

  it("emits one clear reset and keeps stale pin releases silent", () => {
    const events: Parameters<MemoryContentCacheObserver>[0][] = [];
    const cache = new MemoryContentCache(16, (event) => events.push(event));
    cache.put(entry("clear-pinned", 4, 1));
    const pin = cache.pin(key("clear-pinned"));
    events.length = 0;

    cache.clear();
    pin?.release();
    pin?.release();

    expect(events).toEqual([{ kind: "Cleared", entries: 1, bytes: 4 }]);
    expect(Object.isFrozen(events[0])).toBe(true);
    expect(pin?.isValid).toBe(false);
    expect(pin?.isReleased).toBe(true);
  });

  it("isolates observer failures from pin release, clear, and later eviction", () => {
    const cache = new MemoryContentCache(4, () => { throw new Error("observer failure"); });
    expect(() => cache.put(entry("pinned", 4, 1))).not.toThrow();
    const pin = cache.pin(key("pinned"));
    expect(pin).toBeDefined();
    expect(cache.snapshot().pinnedEntries).toBe(1);
    expect(() => pin?.release()).not.toThrow();
    expect(() => pin?.release()).not.toThrow();
    expect(cache.snapshot().pinnedEntries).toBe(0);

    expect(() => cache.put(entry("replacement", 4, 2))).not.toThrow();
    expect(cache.has(key("pinned"))).toBe(false);
    expect(cache.has(key("replacement"))).toBe(true);
    expect(cache.snapshot().evictionCount).toBe(1);
    expect(() => cache.clear()).not.toThrow();
    expect(cache.snapshot()).toMatchObject({ entryCount: 0, totalBytes: 0, pinnedEntries: 0 });
  });

  it("rejects the same key with different content", () => {
    const cache = new MemoryContentCache(16);
    cache.put(entry("same", 4, 1));
    expect(() => cache.put(entry("same", 4, 2))).toThrowError(
      expect.objectContaining({ code: "CONTENT_HASH_MISMATCH" })
    );
  });

  it("takes ownership by copying admitted content buffers", () => {
    const cache = new MemoryContentCache(16);
    const admitted = entry("owned", 4, 7);
    cache.put(admitted);

    new Uint8Array(admitted.buffer).fill(9);
    const lease = cache.get(admitted.key, admitted.contentHash);

    expect([...new Uint8Array(lease?.buffer ?? new ArrayBuffer())]).toEqual([7, 7, 7, 7]);
    expect(lease?.contentHash).toBe(admitted.contentHash);
    lease?.release();
  });

  it("clears reconstructable state and invalidates handles", () => {
    const cache = new MemoryContentCache(16);
    cache.put(entry("clear", 4, 1));
    const lease = cache.get(key("clear"));
    cache.clear();
    expect(cache.snapshot()).toMatchObject({ entryCount: 0, totalBytes: 0 });
    expect(lease?.isValid).toBe(false);
    expect(() => lease?.release()).not.toThrow();
  });

  it("produces canonical snapshots independent of insertion order", () => {
    const build = (ids: readonly string[]) => {
      const cache = new MemoryContentCache(16);
      for (const id of ids) cache.put(entry(id, 4, id.charCodeAt(0)));
      return canonicalizeCacheSnapshot(cache.snapshot());
    };
    expect(build(["a", "b"])).toEqual(build(["b", "a"]));
  });
});

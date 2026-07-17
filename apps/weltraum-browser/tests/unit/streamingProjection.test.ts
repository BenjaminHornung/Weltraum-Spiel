import { describe, expect, it } from "vitest";
import {
  PerformanceTelemetry,
  createMemoryContentCacheTelemetryObserver
} from "../../src/diagnostics/performance";
import {
  MemoryContentCache,
  computeContentHash,
  createContentKey
} from "../../src/streaming";

const key = (id: string) => createContentKey({
  namespace: "projection-fixture",
  contentId: id,
  inputRevision: 1,
  algorithmVersion: 2,
  outputRevision: 3
});

const entry = (id: string, fill: number) => {
  const buffer = new ArrayBuffer(4);
  new Uint8Array(buffer).fill(fill);
  return { key: key(id), buffer, byteLength: 4, contentHash: computeContentHash(buffer), layout: "bytes/u8" };
};

describe("memory content cache telemetry projection", () => {
  it("projects distinct pinned entries in O(1) while preserving existing cache telemetry", () => {
    const telemetry = new PerformanceTelemetry();
    const cache = new MemoryContentCache(8, createMemoryContentCacheTelemetryObserver(telemetry));

    cache.put(entry("first", 1));
    expect(cache.get(key("missing"))).toBeUndefined();
    cache.get(key("first"))?.release();
    expect(telemetry.snapshot()).toMatchObject({
      cacheEntries: 1,
      cacheBytes: 4,
      pinnedEntries: 0,
      cacheHits: 1,
      cacheMisses: 1,
      cacheEvictions: 0
    });

    const firstPin = cache.pin(key("first"));
    const duplicateFirstPin = cache.pin(key("first"));
    expect(telemetry.snapshot().pinnedEntries).toBe(1);

    cache.put(entry("second", 2));
    const secondPin = cache.pin(key("second"));
    expect(telemetry.snapshot()).toMatchObject({ cacheEntries: 2, cacheBytes: 8, pinnedEntries: 2 });

    duplicateFirstPin?.release();
    duplicateFirstPin?.release();
    expect(telemetry.snapshot().pinnedEntries).toBe(2);
    firstPin?.release();
    firstPin?.release();
    expect(telemetry.snapshot().pinnedEntries).toBe(1);

    secondPin?.release();
    expect(telemetry.snapshot().pinnedEntries).toBe(0);
    expect(cache.delete(key("first"))).toBe(true);
    expect(telemetry.snapshot()).toMatchObject({
      cacheEntries: 1,
      cacheBytes: 4,
      pinnedEntries: 0,
      cacheHits: 1,
      cacheMisses: 1,
      cacheEvictions: 1
    });
  });

  it("resets all cache gauges on clear without underflow from stale handles", () => {
    const telemetry = new PerformanceTelemetry();
    const cache = new MemoryContentCache(8, createMemoryContentCacheTelemetryObserver(telemetry));
    cache.put(entry("clear", 1));
    const pin = cache.pin(key("clear"));
    expect(telemetry.snapshot()).toMatchObject({ cacheEntries: 1, cacheBytes: 4, pinnedEntries: 1 });

    cache.clear();
    pin?.release();
    pin?.release();

    expect(telemetry.snapshot()).toMatchObject({
      cacheEntries: 0,
      cacheBytes: 0,
      pinnedEntries: 0,
      cacheHits: 0,
      cacheMisses: 0,
      cacheEvictions: 0
    });
  });
});

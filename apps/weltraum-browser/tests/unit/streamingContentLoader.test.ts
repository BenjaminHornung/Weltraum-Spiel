import { describe, expect, it } from "vitest";
import {
  AsyncContentLoader,
  MemoryContentCache,
  computeContentHash,
  createContentKey,
  type ContentProvider,
  type ContentProviderRequest
} from "../../src/streaming";

const contentKey = createContentKey({
  namespace: "fixture",
  contentId: "loader",
  inputRevision: 4,
  algorithmVersion: 2,
  outputRevision: 1
});

const resultFor = (request: ContentProviderRequest, fill = 7) => {
  const buffer = new ArrayBuffer(16);
  new Uint8Array(buffer).fill(fill);
  return Object.freeze({
    key: request.key,
    buffer,
    byteLength: buffer.byteLength,
    contentHash: computeContentHash(buffer),
    layout: "bytes/u8"
  });
};

describe("AsyncContentLoader", () => {
  it("deduplicates identical in-flight requests", async () => {
    let calls = 0;
    let release!: () => void;
    const barrier = new Promise<void>((resolve) => { release = resolve; });
    const provider: ContentProvider = {
      async load(request) {
        calls += 1;
        await barrier;
        return resultFor(request);
      }
    };
    const events: string[] = [];
    const loader = new AsyncContentLoader(new MemoryContentCache(64), provider, {
      observer: (event) => events.push(event.kind)
    });
    const first = loader.load({ key: contentKey });
    const second = loader.load({ key: contentKey });
    release();
    const [a, b] = await Promise.all([first, second]);

    expect(calls).toBe(1);
    expect(a.kind).toBe("Loaded");
    expect(b.kind).toBe("Loaded");
    expect(events).toContain("Deduplicated");
    if (a.kind === "Loaded") a.lease.release();
    if (b.kind === "Loaded") b.lease.release();
  });

  it("serves cache hits without provider work", async () => {
    let calls = 0;
    const provider: ContentProvider = { async load(request) { calls += 1; return resultFor(request); } };
    const loader = new AsyncContentLoader(new MemoryContentCache(64), provider);
    const miss = await loader.load({ key: contentKey });
    if (miss.kind === "Loaded") miss.lease.release();
    const hit = await loader.load({ key: contentKey });
    expect(calls).toBe(1);
    expect(hit).toMatchObject({ kind: "Loaded", source: "Cache" });
    if (hit.kind === "Loaded") hit.lease.release();
  });

  it("cancels one subscriber without cancelling shared provider work", async () => {
    let release!: () => void;
    const barrier = new Promise<void>((resolve) => { release = resolve; });
    const provider: ContentProvider = { async load(request) { await barrier; return resultFor(request); } };
    const loader = new AsyncContentLoader(new MemoryContentCache(64), provider);
    const controller = new AbortController();
    const cancelled = loader.load({ key: contentKey }, controller.signal);
    const survivor = loader.load({ key: contentKey });
    controller.abort();
    release();
    expect(await cancelled).toMatchObject({ kind: "Cancelled" });
    const loaded = await survivor;
    expect(loaded.kind).toBe("Loaded");
    if (loaded.kind === "Loaded") loaded.lease.release();
  });

  it("starts fresh provider work after every subscriber cancels", async () => {
    let calls = 0;
    const provider: ContentProvider = {
      async load(request) {
        calls += 1;
        if (calls === 1) {
          await new Promise<void>((_resolve, reject) => {
            request.signal.addEventListener("abort", () => queueMicrotask(() => reject(new Error("aborted"))), { once: true });
          });
        }
        return resultFor(request, 9);
      }
    };
    const loader = new AsyncContentLoader(new MemoryContentCache(64), provider);
    const controller = new AbortController();
    const cancelled = loader.load({ key: contentKey }, controller.signal);
    controller.abort();
    const reloaded = loader.load({ key: contentKey });

    expect(await cancelled).toMatchObject({ kind: "Cancelled" });
    const loaded = await reloaded;
    expect(loaded).toMatchObject({ kind: "Loaded", source: "Provider" });
    expect(calls).toBe(2);
    if (loaded.kind === "Loaded") loaded.lease.release();
  });

  it("settles the first subscriber when provider setup throws synchronously", async () => {
    const failure = new Error("synchronous provider failure");
    const provider: ContentProvider = { load() { throw failure; } };
    const loader = new AsyncContentLoader(new MemoryContentCache(64), provider);
    const result = await loader.load({ key: contentKey });
    expect(result).toMatchObject({ kind: "Failed", error: failure });
    expect(loader.inFlightCount).toBe(0);
  });

  it("propagates stale provider revisions as failure", async () => {
    const stale = createContentKey({ ...contentKey, inputRevision: contentKey.inputRevision + 1 });
    const provider: ContentProvider = { async load(request) { return { ...resultFor(request), key: stale }; } };
    const loader = new AsyncContentLoader(new MemoryContentCache(64), provider);
    const loaded = await loader.load({ key: contentKey });
    expect(loaded).toMatchObject({ kind: "Failed", error: { code: "PROVIDER_KEY_MISMATCH" } });
    expect(loader.cache.size).toBe(0);
  });
});

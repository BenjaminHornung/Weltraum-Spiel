import { describe, expect, it } from "vitest";
import {
  InMemoryPublicationStore,
  PUBLICATION_CRASH_PHASES,
  type Pointer,
  type SlotSnapshot
} from "../src/publication";

const bytes = (...values: number[]): Uint8Array => new Uint8Array(values);
const acceptCandidate = async (): Promise<void> => undefined;

async function seededStore(): Promise<{ store: InMemoryPublicationStore; pointer: Pointer; legacy: Uint8Array }> {
  const store = new InMemoryPublicationStore();
  const legacy = bytes(0, 1, 2, 255);
  const pointer = await store.seedLegacy("legacy-v021", legacy);
  return { store, pointer, legacy };
}

describe("publication simulator", () => {
  it.each(PUBLICATION_CRASH_PHASES)("keeps legacy bytes readable at crash phase %s", async phase => {
    const { store, pointer, legacy } = await seededStore();
    const candidate = bytes(9, 8, 7);

    await expect(store.publish({
      slotId: "candidate-v1",
      bytes: candidate,
      expectedPointer: pointer,
      validate: acceptCandidate,
      crashAt: phase
    })).rejects.toMatchObject({ code: "SIMULATED_CRASH", phase });

    expect((await store.readSlot("legacy-v021"))?.bytes).toEqual(legacy);
    if (phase === "afterPointer") {
      expect(await store.getPointer()).toMatchObject({ slotId: "candidate-v1", revision: 1 });
    } else {
      expect(await store.getPointer()).toEqual(pointer);
    }
    if (phase === "beforeWrite") {
      expect(await store.readSlot("candidate-v1")).toBeUndefined();
    } else {
      expect((await store.readSlot("candidate-v1"))?.bytes).toEqual(candidate);
    }
  });

  it("rejects stale revision, slot, or digest and rolls back by advancing the revision", async () => {
    const { store, pointer, legacy } = await seededStore();
    const badDigest: Pointer = { ...pointer, digest: "sha256:stale" };
    await expect(store.publish({
      slotId: "never-written",
      bytes: bytes(3),
      expectedPointer: badDigest,
      validate: acceptCandidate
    })).rejects.toMatchObject({ code: "STALE_POINTER" });
    expect(await store.readSlot("never-written")).toBeUndefined();

    const published = await store.publish({
      slotId: "candidate-v1",
      bytes: bytes(3, 4),
      expectedPointer: pointer,
      validate: acceptCandidate
    });
    await expect(store.publish({
      slotId: "candidate-v2",
      bytes: bytes(5),
      expectedPointer: pointer,
      validate: acceptCandidate
    })).rejects.toMatchObject({ code: "STALE_POINTER" });

    const rolledBack = await store.compareAndSwapPointer(published, "legacy-v021");
    expect(rolledBack).toEqual({ ...pointer, revision: published.revision + 1 });
    expect(await store.getPointer()).toEqual(rolledBack);
    expect((await store.readSlot("legacy-v021"))?.bytes).toEqual(legacy);
    expect((await store.readSlot("candidate-v1"))?.bytes).toEqual(bytes(3, 4));
    await expect(store.publish({
      slotId: "post-rollback",
      bytes: bytes(6),
      expectedPointer: pointer,
      validate: acceptCandidate
    })).rejects.toMatchObject({ code: "STALE_POINTER" });
    expect(await store.readSlot("post-rollback")).toBeUndefined();
  });

  it("lets only one concurrent writer win the final CAS", async () => {
    let writersAtWrite = 0;
    let releaseWriters!: () => void;
    const writersReleased = new Promise<void>(resolve => { releaseWriters = resolve; });
    class ConcurrentStore extends InMemoryPublicationStore {
      protected override async writeNewSlot(record: SlotSnapshot): Promise<void> {
        writersAtWrite++;
        if (writersAtWrite === 2) releaseWriters();
        await writersReleased;
        await super.writeNewSlot(record);
      }
    }
    const store = new ConcurrentStore();
    const pointer = await store.seedLegacy("legacy", bytes(1));
    const publish = (slotId: string, value: number) => store.publish({
      slotId,
      bytes: bytes(value),
      expectedPointer: pointer,
      validate: acceptCandidate
    });

    const results = await Promise.allSettled([publish("writer-a", 2), publish("writer-b", 3)]);
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find(result => result.status === "rejected");
    expect(rejected).toMatchObject({ status: "rejected", reason: { code: "STALE_POINTER" } });
    expect(await store.readSlot("writer-a")).toBeDefined();
    expect(await store.readSlot("writer-b")).toBeDefined();
    expect((await store.getPointer())?.revision).toBe(1);
  });

  it("never reuses a slot ID and validates before writing", async () => {
    const { store, pointer } = await seededStore();
    const first = await store.publish({
      slotId: "candidate-v1",
      bytes: bytes(4),
      expectedPointer: pointer,
      validate: acceptCandidate
    });
    await expect(store.publish({
      slotId: "candidate-v1",
      bytes: bytes(4),
      expectedPointer: first,
      validate: acceptCandidate
    })).rejects.toMatchObject({ code: "SLOT_ID_REUSED" });

    await expect(store.publish({
      slotId: "rejected-candidate",
      bytes: bytes(5),
      expectedPointer: first,
      validate: () => { throw new Error("candidate rejected"); }
    })).rejects.toThrow("candidate rejected");
    expect(await store.readSlot("rejected-candidate")).toBeUndefined();
    expect(await store.getPointer()).toEqual(first);
  });

  it("isolates candidate bytes from caller and validator mutation", async () => {
    const { store, pointer } = await seededStore();
    const candidate = bytes(10, 11, 12);
    const expected = new Uint8Array(candidate);
    await store.publish({
      slotId: "candidate-v1",
      bytes: candidate,
      expectedPointer: pointer,
      validate: validationBytes => { validationBytes.fill(0); }
    });
    expect(candidate).toEqual(expected);
    expect((await store.readSlot("candidate-v1"))?.bytes).toEqual(expected);
  });

  it("rejects corrupted read-back before moving the pointer", async () => {
    class CorruptReadBackStore extends InMemoryPublicationStore {
      #corruptNextRead = false;
      protected override async writeNewSlot(record: SlotSnapshot): Promise<void> {
        await super.writeNewSlot(record);
        this.#corruptNextRead = true;
      }
      override async readSlot(slotId: string): Promise<SlotSnapshot | undefined> {
        const record = await super.readSlot(slotId);
        if (record && this.#corruptNextRead) {
          this.#corruptNextRead = false;
          record.bytes[0] ^= 0xff;
        }
        return record;
      }
    }
    const store = new CorruptReadBackStore();
    const legacy = bytes(1, 2);
    const pointer = await store.seedLegacy("legacy", legacy);
    await expect(store.publish({
      slotId: "candidate-v1",
      bytes: bytes(3, 4),
      expectedPointer: pointer,
      validate: acceptCandidate
    })).rejects.toMatchObject({ code: "READBACK_MISMATCH" });
    expect(await store.getPointer()).toEqual(pointer);
    expect((await store.readSlot("legacy"))?.bytes).toEqual(legacy);
    expect((await store.readSlot("candidate-v1"))?.bytes).toEqual(bytes(3, 4));
  });

  it("rejects direct rollback when target bytes disagree with their stored digest", async () => {
    class CorruptTargetStore extends InMemoryPublicationStore {
      override async readSlot(slotId: string): Promise<SlotSnapshot | undefined> {
        const record = await super.readSlot(slotId);
        if (slotId === "legacy" && record) record.bytes[0] ^= 0xff;
        return record;
      }
    }
    const store = new CorruptTargetStore();
    const initial = await store.seedLegacy("legacy", bytes(1, 2));
    const published = await store.publish({
      slotId: "candidate",
      bytes: bytes(3, 4),
      expectedPointer: initial,
      validate: acceptCandidate
    });

    await expect(store.compareAndSwapPointer(published, "legacy")).rejects.toMatchObject({ code: "SLOT_INTEGRITY_ERROR" });
    expect(await store.getPointer()).toEqual(published);
  });

  it("rejects target bytes changed between digest and atomic CAS recheck", async () => {
    class ChangedAfterDigestStore extends InMemoryPublicationStore {
      #candidateReads = 0;
      override async readSlot(slotId: string): Promise<SlotSnapshot | undefined> {
        const record = await super.readSlot(slotId);
        if (slotId === "candidate" && record && ++this.#candidateReads === 3) record.bytes[0] ^= 0xff;
        return record;
      }
    }
    const store = new ChangedAfterDigestStore();
    const initial = await store.seedLegacy("legacy", bytes(1, 2));

    await expect(store.publish({
      slotId: "candidate",
      bytes: bytes(3, 4),
      expectedPointer: initial,
      validate: acceptCandidate
    })).rejects.toMatchObject({ code: "SLOT_INTEGRITY_ERROR" });
    expect(await store.getPointer()).toEqual(initial);
  });

  it("seeds only an empty store", async () => {
    const { store, pointer, legacy } = await seededStore();
    await expect(store.seedLegacy("replacement", bytes(9))).rejects.toMatchObject({ code: "ALREADY_SEEDED" });
    expect(await store.getPointer()).toEqual(pointer);
    expect((await store.readSlot("legacy-v021"))?.bytes).toEqual(legacy);
    expect(await store.readSlot("replacement")).toBeUndefined();
  });
});

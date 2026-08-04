import { describe, expect, it } from "vitest";
import {
  PREPARED_STRUCTURAL_FIRE_PAGE_BYTES,
  PREPARED_STRUCTURAL_FIRE_RETAINED_IN_FLIGHT_BYTES,
  type PreparedStructuralFireHash,
  type PreparedStructuralFireLogicalViewName,
  type PreparedStructuralFirePageEnvelope,
  type PreparedStructuralFireRequest
} from "../../src/surface-play/workers/preparedStructuralFireWire";
import {
  createPreparedStructuralFirePageEnvelope,
  createPreparedStructuralFirePageHeader,
  createPreparedStructuralFireRequest
} from "../../src/surface-play/workers/preparedStructuralFireWireCodec";
import { PreparedStructuralFirePageStore } from "../../src/surface-play/workers/preparedStructuralFirePageStore";

const fixtureHash = (suffix: string): PreparedStructuralFireHash =>
  `fnv1a64-v1:${suffix.padStart(16, "0").slice(-16)}`;

const request = (
  callerNonce = "0123456789abcdef0123456789abcdef"
): PreparedStructuralFireRequest => createPreparedStructuralFireRequest({
  seedHash: fixtureHash("1"),
  commandHash: fixtureHash("2"),
  callerNonce,
  source: {
    objectId: "tree:page-store-fixture",
    objectRevision: 1,
    editRevision: 1,
    contentHash: fixtureHash("3")
  },
  activationTick: 7,
  deadlineTick: 67
});

const page = (
  job: Readonly<PreparedStructuralFireRequest>,
  workerEpoch: number,
  logicalByteLength: number,
  pageIndex: number,
  fill: number,
  logicalViewName: PreparedStructuralFireLogicalViewName = "result.work"
): PreparedStructuralFirePageEnvelope => {
  const byteOffset = pageIndex * PREPARED_STRUCTURAL_FIRE_PAGE_BYTES;
  const bytes = new Uint8Array(Math.min(
    PREPARED_STRUCTURAL_FIRE_PAGE_BYTES,
    logicalByteLength - byteOffset
  ));
  bytes.fill(fill);
  const logical = {
    logicalViewName,
    cardinality: "Singleton" as const,
    itemCount: 1,
    byteLength: logicalByteLength,
    logicalViewRoot: fixtureHash("4")
  };
  return createPreparedStructuralFirePageEnvelope(
    job,
    workerEpoch,
    createPreparedStructuralFirePageHeader(
      logical,
      logicalViewName.startsWith("seed.") ? "Seed" : "PreparedResult",
      pageIndex,
      bytes
    ),
    bytes
  );
};

const key = (value: Readonly<PreparedStructuralFirePageEnvelope>) => ({
  workerEpoch: value.workerEpoch,
  rootJobId: value.rootJobId,
  direction: value.header.direction,
  logicalViewName: value.header.logicalViewName,
  pageIndex: value.header.pageIndex
});

describe("PreparedStructuralFirePageStore", () => {
  it("keys retained pages by direction, logical view, and page index", () => {
    const job = request("00000000000000000000000000000000");
    const store = new PreparedStructuralFirePageStore(3);
    const pages = [
      page(job, 3, 1, 0, 1, "result.work"),
      page(job, 3, 1, 0, 2, "result.collision"),
      page(job, 3, 1, 0, 3, "seed.authority")
    ];

    for (const envelope of pages) {
      expect(store.accept(job, envelope)).toMatchObject({ kind: "Accepted" });
    }
    expect(store.readState()).toMatchObject({ retainedBytes: 3, retainedPageCount: 3 });
    for (const envelope of pages) {
      expect(store.consume(key(envelope))?.header.logicalViewName)
        .toBe(envelope.header.logicalViewName);
    }
    expect(store.readState()).toMatchObject({ retainedBytes: 0, retainedPageCount: 0 });
  });

  it("retains sparse out-of-order pages and fails closed on a conflicting retry", () => {
    const job = request();
    const store = new PreparedStructuralFirePageStore(4);
    const logicalByteLength = PREPARED_STRUCTURAL_FIRE_PAGE_BYTES + 1;
    const second = page(job, 4, logicalByteLength, 1, 2);
    const first = page(job, 4, logicalByteLength, 0, 1);

    expect(store.accept(job, second)).toEqual({ kind: "Accepted", retainedBytes: 1 });
    expect(store.accept(job, second)).toEqual({ kind: "AlreadyPresent", retainedBytes: 1 });
    expect(store.accept(job, first)).toEqual({
      kind: "Accepted",
      retainedBytes: logicalByteLength
    });
    expect(store.consume(key(second))?.header.pageIndex).toBe(1);
    expect(store.readState()).toMatchObject({
      retainedBytes: PREPARED_STRUCTURAL_FIRE_PAGE_BYTES,
      retainedPageCount: 1
    });

    const conflict = page(job, 4, logicalByteLength, 0, 9);
    expect(store.accept(job, conflict)).toEqual({
      kind: "Refused",
      reason: "PageConflict"
    });
    expect(store.readState()).toMatchObject({
      retainedBytes: 0,
      retainedPageCount: 0,
      terminalRootCount: 1
    });
    expect(store.accept(job, first)).toEqual({
      kind: "Refused",
      reason: "PageConflict"
    });
  }, 30_000);

  it("defers the byte after 64 MiB before ownership and accepts it after consumption", () => {
    const job = request("11111111111111111111111111111111");
    const store = new PreparedStructuralFirePageStore(5);
    const logicalByteLength = PREPARED_STRUCTURAL_FIRE_RETAINED_IN_FLIGHT_BYTES + 1;
    let first: PreparedStructuralFirePageEnvelope | undefined;
    for (let pageIndex = 0; pageIndex < 4; pageIndex += 1) {
      const envelope = page(job, 5, logicalByteLength, pageIndex, pageIndex);
      if (pageIndex === 0) first = envelope;
      expect(store.accept(job, envelope)).toMatchObject({ kind: "Accepted" });
    }
    expect(store.readState().retainedBytes).toBe(
      PREPARED_STRUCTURAL_FIRE_RETAINED_IN_FLIGHT_BYTES
    );

    const final = page(job, 5, logicalByteLength, 4, 4);
    class CopyDetectingBytes extends Uint8Array {
      copied = false;

      override slice(start?: number, end?: number): Uint8Array<ArrayBuffer> {
        this.copied = true;
        return super.slice(start, end);
      }
    }
    const deferredBytes = new CopyDetectingBytes(final.bytes);
    const deferred = { ...final, bytes: deferredBytes };
    expect(store.accept(job, deferred)).toEqual({
      kind: "Deferred",
      reason: "RetainedInFlightBackpressure"
    });
    expect(deferredBytes.copied).toBe(false);
    expect(store.readState()).toMatchObject({
      retainedBytes: PREPARED_STRUCTURAL_FIRE_RETAINED_IN_FLIGHT_BYTES,
      retainedPageCount: 4
    });

    expect(first).toBeDefined();
    store.consume(key(first!));
    expect(store.accept(job, final)).toEqual({
      kind: "Accepted",
      retainedBytes:
        PREPARED_STRUCTURAL_FIRE_RETAINED_IN_FLIGHT_BYTES
        - PREPARED_STRUCTURAL_FIRE_PAGE_BYTES
        + 1
    });
    store.dispose();
    store.dispose();
    expect(store.readState()).toMatchObject({
      retainedBytes: 0,
      retainedPageCount: 0,
      disposed: true
    });
    expect(store.accept(job, final)).toEqual({ kind: "Refused", reason: "Disposed" });
  }, 60_000);

  it("releases roots idempotently for cancellation, stale, refusal, restart, and disposal", () => {
    const store = new PreparedStructuralFirePageStore(6);
    const jobs = [
      request("22222222222222222222222222222222"),
      request("33333333333333333333333333333333"),
      request("44444444444444444444444444444444")
    ];
    const envelopes = jobs.map((job, index) => page(job, 6, 1, 0, index));
    for (let index = 0; index < jobs.length; index += 1) {
      expect(store.accept(jobs[index], envelopes[index])).toMatchObject({ kind: "Accepted" });
    }

    store.cancel(jobs[0].rootJobId);
    store.cancel(jobs[0].rootJobId);
    store.markStale(jobs[1].rootJobId);
    store.markStale(jobs[1].rootJobId);
    store.refuse(jobs[2].rootJobId);
    store.refuse(jobs[2].rootJobId);
    expect(store.readState()).toMatchObject({
      retainedBytes: 0,
      retainedPageCount: 0,
      terminalRootCount: 3
    });
    expect(store.accept(jobs[0], envelopes[0])).toEqual({ kind: "Cancelled" });
    expect(store.accept(jobs[1], envelopes[1])).toEqual({ kind: "Stale" });
    expect(store.accept(jobs[2], envelopes[2])).toEqual({
      kind: "Refused",
      reason: "Refused"
    });

    const activeJob = request("55555555555555555555555555555555");
    const oldEpoch = page(activeJob, 6, 1, 0, 7);
    expect(store.accept(activeJob, oldEpoch)).toMatchObject({ kind: "Accepted" });
    expect(store.restart(7)).toBe(true);
    expect(store.restart(7)).toBe(false);
    expect(store.readState()).toMatchObject({
      workerEpoch: 7,
      retainedBytes: 0,
      retainedPageCount: 0,
      terminalRootCount: 0
    });
    expect(store.accept(activeJob, oldEpoch)).toEqual({ kind: "Stale" });

    const newEpoch = page(activeJob, 7, 1, 0, 7);
    expect(store.accept(activeJob, newEpoch)).toMatchObject({ kind: "Accepted" });
    store.dispose();
    expect(store.readState()).toMatchObject({
      retainedBytes: 0,
      retainedPageCount: 0,
      disposed: true
    });
  }, 30_000);
});

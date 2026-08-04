import { describe, expect, it } from "vitest";
import {
  WorkerHandle,
  isWorkerToHostMessage,
  workerEpoch,
  type HostToWorkerMessage,
  type WorkerTransport
} from "../../src/workers";
import {
  PreparedStructuralFireDedicatedWorkerRuntime
} from "../../src/surface-play/workers/preparedStructuralFireWorker";
import {
  createPreparedStructuralFireCanonicalItemSource,
  createPreparedStructuralFireLogicalViewFacts,
  createPreparedStructuralFirePageEnvelope,
  createPreparedStructuralFireRequest,
  hashPreparedStructuralFireCanonical,
  streamPreparedStructuralFireLogicalView,
  streamPreparedStructuralFirePages
} from "../../src/surface-play/workers/preparedStructuralFireWireCodec";
import type { PreparedStructuralFireHash } from "../../src/surface-play/workers/preparedStructuralFireWire";

const completed = (protocolDetails: unknown) => ({
  type: "JobCompleted",
  result: {
    jobId: "prepared-fire:protocol-gate",
    targetKey: "tree:protocol-gate",
    planningEpoch: 1,
    workerEpoch: 2,
    inputRevision: 1,
    outputRevision: 2,
    algorithmVersion: 1,
    outputBytes: 1,
    contentHash: "hash",
    protocolDetails
  }
});

describe("Prepared Structural Fire worker protocol-details gate", () => {
  it("admits bounded plain receipts and rejects unbounded or non-plain values", () => {
    expect(isWorkerToHostMessage(completed({
      kind: "PreparedStructuralFireResult",
      progress: { completedUnits: 1, totalUnits: 3 }
    }))).toBe(true);
    expect(isWorkerToHostMessage(completed({ payload: "x".repeat(32 * 1024 + 1) })))
      .toBe(false);
    expect(isWorkerToHostMessage(completed({ payload: new Date(0) }))).toBe(false);
    let nested: unknown = "leaf";
    for (let index = 0; index < 10; index += 1) nested = { nested };
    expect(isWorkerToHostMessage(completed(nested))).toBe(false);
  });

  it("carries a transferred private V2 page through WorkerHandle and the real dedicated bridge", async () => {
    class InProcessTransport implements WorkerTransport {
      onmessage: ((event: MessageEvent<unknown>) => void) | null = null;
      onerror: ((event: ErrorEvent) => void) | null = null;
      onmessageerror: ((event: MessageEvent<unknown>) => void) | null = null;
      readonly runtime = new PreparedStructuralFireDedicatedWorkerRuntime((message, transfer = []) => {
        const output = structuredClone(message, { transfer: [...transfer] });
        queueMicrotask(() => this.onmessage?.({ data: output } as MessageEvent<unknown>));
      });

      postMessage(message: HostToWorkerMessage, transfer: Transferable[] = []): void {
        const input = structuredClone(message, { transfer });
        queueMicrotask(() => this.runtime.handleMessage(input));
      }

      terminate(): void {}
    }

    const transport = new InProcessTransport();
    const handle = new WorkerHandle(0, workerEpoch(7), () => transport, {
      onCompleted: () => { throw new Error("Unexpected V1 completion."); },
      onCancelled: () => { throw new Error("Unexpected V1 cancellation."); },
      onFailed: () => { throw new Error("Unexpected V1 failure."); },
      onFault: (_handle, reason) => { throw new Error(reason); }
    });
    await handle.start();
    const seedHash = hashPreparedStructuralFireCanonical(
      "prepared-private-bridge-test/seed/v1",
      { value: 1 }
    );
    const commandHash = hashPreparedStructuralFireCanonical(
      "prepared-private-bridge-test/command/v1",
      { value: 2 }
    );
    const request = createPreparedStructuralFireRequest({
      seedHash,
      commandHash,
      callerNonce: "0123456789abcdef0123456789abcdef",
      source: {
        objectId: "tree:private-bridge",
        objectRevision: 0,
        editRevision: 0,
        contentHash: hashPreparedStructuralFireCanonical(
          "prepared-private-bridge-test/source/v1",
          { value: 3 }
        )
      },
      activationTick: 0,
      deadlineTick: 1
    });
    const openItems = () => [createPreparedStructuralFireCanonicalItemSource(
      "seed.authority",
      { key: "@", payload: { objectId: "tree:private-bridge" } }
    )];
    const logical = createPreparedStructuralFireLogicalViewFacts(
      "seed.authority",
      openItems
    );
    const page = [...streamPreparedStructuralFirePages(
      logical,
      "Seed",
      () => streamPreparedStructuralFireLogicalView("seed.authority", openItems)
    )][0];
    const envelope = createPreparedStructuralFirePageEnvelope(
      request,
      7,
      page.header,
      page.bytes
    );
    let complete!: (value: unknown) => void;
    const output = new Promise<unknown>((resolve) => { complete = resolve; });
    const session = handle.openPrivateSession(
      request.rootJobId,
      (message) => complete(message.payload),
      (reason) => { throw new Error(reason); }
    );
    session.post({ kind: "SeedPage", request, envelope }, [envelope.bytes.buffer]);
    expect(envelope.bytes.byteLength).toBe(0);
    await expect(output).resolves.toMatchObject({
      kind: "SeedPageDecision",
      decision: { kind: "Accepted" }
    });
    expect(session.workerEpoch).toBe(7);
    expect(session.close()).toBe(true);
    handle.terminate();
    expect(seedHash).toMatch(/^fnv1a64-v1:/);
    expect(commandHash as PreparedStructuralFireHash).toMatch(/^fnv1a64-v1:/);
  });
});

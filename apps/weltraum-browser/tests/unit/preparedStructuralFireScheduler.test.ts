import { describe, expect, it } from "vitest";
import {
  createPreparedStructuralFireCommand,
  createPreparedStructuralFireRequest,
  hashPreparedStructuralFireCanonical
} from "../../src/surface-play/workers/preparedStructuralFireWireCodec";
import {
  PreparedStructuralFireScheduler,
  type PreparedStructuralFireSourceFacts
} from "../../src/surface-play/workers/preparedStructuralFireScheduler";

const fixture = (
  ordinal: number,
  objectId = `tree:scheduler:${ordinal}`,
  deadlineTick = 20
) => {
  const seedHash = hashPreparedStructuralFireCanonical(
    "prepared-scheduler-test/seed/v1",
    { objectId, revision: ordinal }
  );
  const command = createPreparedStructuralFireCommand({
    seedHash,
    fireCommandId: `fire:scheduler:${ordinal}`,
    structuralCommandId: `structural:scheduler:${ordinal}`,
    hit: { address: ordinal },
    simulationTick: 10
  });
  const request = createPreparedStructuralFireRequest({
    seedHash,
    commandHash: command.commandHash,
    callerNonce: ordinal.toString(16).padStart(32, "0"),
    source: {
      objectId,
      objectRevision: ordinal,
      editRevision: ordinal + 1,
      contentHash: hashPreparedStructuralFireCanonical(
        "prepared-scheduler-test/source/v1",
        { objectId, revision: ordinal }
      )
    },
    activationTick: 10,
    deadlineTick
  });
  return Object.freeze({ request, command });
};

const sourceFacts = (
  value: ReturnType<typeof fixture>
): PreparedStructuralFireSourceFacts => value.request.source;

describe("Prepared Structural Fire scheduler V2", () => {
  it("keeps only bounded request facts and serializes commands per object", () => {
    let now = 100;
    const scheduler = new PreparedStructuralFireScheduler({ now: () => now });
    const first = fixture(1, "tree:shared", 30);
    const second = fixture(2, "tree:shared", 10);
    const independent = fixture(3, "tree:independent", 20);

    expect(scheduler.enqueue(first.request, first.command).state).toBe("Queued");
    now = 105;
    expect(scheduler.enqueue(second.request, second.command).state).toBe("Queued");
    expect(scheduler.enqueue(independent.request, independent.command).state).toBe("Queued");

    expect(scheduler.startNext(10, second.request.rootJobId)).toBeNull();
    const independentStart = scheduler.startNext(10, independent.request.rootJobId);
    expect(independentStart).toMatchObject({
      state: "Ready",
      rootJobId: independent.request.rootJobId,
      dispatchIndex: 0,
      attemptIndex: 0
    });
    expect(independentStart?.request).toEqual(independent.request);
    expect(independentStart?.command).toEqual(independent.command);
    const firstStart = scheduler.startNext(10, first.request.rootJobId);
    expect(firstStart?.rootJobId).toBe(first.request.rootJobId);
    expect(scheduler.bindWorkerDispatch(
      independent.request.rootJobId,
      8,
      independentStart?.jobId ?? ""
    )).toBe(true);
    expect(scheduler.bindWorkerDispatch(
      first.request.rootJobId,
      7,
      firstStart?.jobId ?? ""
    )).toBe(true);
    expect(scheduler.readTelemetry()).toMatchObject({ queueDepth: 1, inFlight: 2 });

    expect(scheduler.cancel(first.request.rootJobId)).toEqual({
      state: "Cancelled",
      rootJobId: first.request.rootJobId,
      signalWorker: true
    });
    expect(scheduler.acknowledgeCancellation(first.request.rootJobId)).toBe(true);
    expect(scheduler.startNext(10, second.request.rootJobId)?.rootJobId)
      .toBe(second.request.rootJobId);
    expect(scheduler.cancel(second.request.rootJobId)?.signalWorker).toBe(true);
    expect(scheduler.acknowledgeCancellation(second.request.rootJobId)).toBe(true);
    expect(scheduler.cancel(independent.request.rootJobId)?.signalWorker).toBe(true);
    expect(scheduler.acknowledgeCancellation(independent.request.rootJobId)).toBe(true);
    expect(scheduler.readTelemetry()).toMatchObject({
      queueDepth: 0,
      inFlight: 0,
      cancelCount: 3
    });
  });

  it("defers without retaining caller payloads and admits a retry after capacity drains", () => {
    const scheduler = new PreparedStructuralFireScheduler({ maxRetainedRoots: 1 });
    const retained = fixture(10);
    const deferred = fixture(11);
    expect(scheduler.enqueue(retained.request, retained.command).state).toBe("Queued");
    expect(scheduler.enqueue(deferred.request, deferred.command)).toEqual({
      state: "Deferred",
      rootJobId: deferred.request.rootJobId,
      reason: "RetainedRootCapacity"
    });
    expect(scheduler.cancel(retained.request.rootJobId)?.signalWorker).toBe(false);
    expect(scheduler.enqueue(deferred.request, deferred.command).state).toBe("Queued");
  });

  it("fails closed for tamper, stale source, and mismatched worker epochs", () => {
    const scheduler = new PreparedStructuralFireScheduler();
    const value = fixture(20);
    expect(scheduler.enqueue(value.request, {
      ...value.command,
      commandHash: hashPreparedStructuralFireCanonical("tamper/v1", { value: 1 })
    })).toMatchObject({ state: "Rejected", reason: "InvalidInput" });

    expect(scheduler.enqueue(value.request, value.command).state).toBe("Queued");
    const started = scheduler.startNext(10);
    expect(started?.state).toBe("Ready");
    expect(scheduler.bindWorkerDispatch(value.request.rootJobId, 7, started?.jobId ?? ""))
      .toBe(true);
    expect(scheduler.bindWorkerDispatch(value.request.rootJobId, 8, started?.jobId ?? ""))
      .toBe(false);
    const changed = { ...sourceFacts(value), editRevision: value.request.source.editRevision + 1 };
    expect(scheduler.invalidateObject(changed)).toEqual([{
      state: "Stale",
      rootJobId: value.request.rootJobId,
      signalWorker: true
    }]);
    expect(scheduler.acknowledgeWorkerFailure(value.request.rootJobId)).toBe(true);
    expect(scheduler.readTelemetry()).toMatchObject({ staleCount: 1, inFlight: 0 });
  });
});

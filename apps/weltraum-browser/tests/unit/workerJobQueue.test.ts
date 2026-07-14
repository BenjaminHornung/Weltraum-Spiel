import { describe, expect, it } from "vitest";
import {
  StableWorkerJobQueue,
  algorithmVersion,
  byteCount,
  contentRevision,
  jobDeadline,
  planningEpoch,
  workerEpoch,
  workerJobId,
  workerJobKind,
  workerTargetKey,
  type JobPriority,
  type WorkerJobRequest
} from "../../src/workers";

const request = (
  id: string,
  priority: JobPriority,
  deadline = 10,
  target = "target"
): WorkerJobRequest<{ readonly value: number }> => ({
  jobId: workerJobId(id),
  jobKind: workerJobKind("TransformBuffer"),
  targetKey: workerTargetKey(target),
  planningEpoch: planningEpoch(1),
  workerEpoch: workerEpoch(0),
  inputRevision: contentRevision(1),
  algorithmVersion: algorithmVersion(1),
  priority,
  deadline: jobDeadline(deadline),
  estimatedInputBytes: byteCount(1),
  estimatedOutputBytes: byteCount(1),
  payload: { value: 1 }
});

const dispatchIds = (items: readonly WorkerJobRequest[]) => {
  const queue = new StableWorkerJobQueue(64);
  for (const item of items) expect(queue.enqueue(item).kind).toBe("Accepted");
  const ids: string[] = [];
  while (queue.size > 0) ids.push(queue.dispatchNext()!.jobId);
  return ids;
};

describe("StableWorkerJobQueue", () => {
  it("sorts deterministically by class, deadline, target, and job ID", () => {
    const items = [
      request("n", "Normal", 1), request("u-z", "Urgent", 2, "z"), request("u-a2", "Urgent", 2, "a"),
      request("u-a1", "Urgent", 2, "a"), request("u-first", "Urgent", 1, "z"), request("h", "High", 1)
    ];
    const expected = ["u-first", "u-a1", "u-a2", "u-z", "h", "n"];
    expect(dispatchIds(items)).toEqual(expected);
    expect(dispatchIds([...items].reverse())).toEqual(expected);
  });

  it("forces High after four Urgent dispatches", () => {
    const items = Array.from({ length: 6 }, (_, index) => request(`u-${index}`, "Urgent", index));
    items.push(request("high", "High", 0));
    expect(dispatchIds(items).slice(0, 6)).toEqual(["u-0", "u-1", "u-2", "u-3", "high", "u-4"]);
  });

  it("forces Normal after eight non-Normal dispatches", () => {
    const items: WorkerJobRequest[] = [];
    for (let index = 0; index < 8; index += 1) {
      items.push(request(`u-${index}`, "Urgent", index));
      if (index === 3) items.push(request("high", "High", 0));
    }
    items.push(request("normal", "Normal", 0));
    expect(dispatchIds(items).slice(0, 10)).toEqual([
      "u-0", "u-1", "u-2", "u-3", "high", "u-4", "u-5", "u-6", "normal", "u-7"
    ]);
  });

  it("does not idle when forced lower lanes are empty", () => {
    const queue = new StableWorkerJobQueue(16);
    for (let index = 0; index < 6; index += 1) queue.enqueue(request(`u-${index}`, "Urgent", index));
    expect(Array.from({ length: 6 }, () => queue.dispatchNext()?.jobId)).toEqual([
      "u-0", "u-1", "u-2", "u-3", "u-4", "u-5"
    ]);
  });

  it("fails closed at capacity and for duplicates", () => {
    const queue = new StableWorkerJobQueue(1);
    expect(queue.enqueue(request("a", "Normal")).kind).toBe("Accepted");
    expect(queue.enqueue(request("a", "Urgent")).kind).toBe("RejectedDuplicateJob");
    expect(queue.enqueue(request("b", "Urgent")).kind).toBe("RejectedQueueFull");
  });

  it("cancels queued jobs without changing dispatch counters", () => {
    const queue = new StableWorkerJobQueue(4);
    queue.enqueue(request("cancel", "Urgent"));
    expect(queue.cancel(workerJobId("cancel"))?.jobId).toBe("cancel");
    expect(queue.snapshot()).toMatchObject({ size: 0, consecutiveUrgentDispatches: 0, consecutiveNonNormalDispatches: 0 });
  });

  it("snapshots caller input and never uses later mutation", () => {
    const mutable = request("immutable", "Normal") as WorkerJobRequest<{ value: number }>;
    const queue = new StableWorkerJobQueue(2);
    queue.enqueue(mutable);
    (mutable.payload as { value: number }).value = 99;
    const queued = queue.snapshot().jobs[0];
    expect(queued.payload).toEqual({ value: 1 });
    expect(Object.isFrozen(queued)).toBe(true);
    expect(Object.isFrozen(queued.payload)).toBe(true);
  });
});

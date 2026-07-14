import type { WorkerJobId } from "./ids";
import { snapshotWorkerJobRequest, type JobPriority, type WorkerJobRequest } from "./protocol";

export type QueueEnqueueDecision =
  | { readonly kind: "Accepted"; readonly request: WorkerJobRequest }
  | { readonly kind: "RejectedQueueFull" }
  | { readonly kind: "RejectedDuplicateJob" };

export interface WorkerJobQueueSnapshot {
  readonly capacity: number;
  readonly size: number;
  readonly urgentDepth: number;
  readonly highDepth: number;
  readonly normalDepth: number;
  readonly consecutiveUrgentDispatches: number;
  readonly consecutiveNonNormalDispatches: number;
  readonly jobs: readonly WorkerJobRequest[];
}

const compareAscii = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;

export const compareWorkerJobs = (left: WorkerJobRequest, right: WorkerJobRequest): number =>
  left.deadline - right.deadline || compareAscii(left.targetKey, right.targetKey) || compareAscii(left.jobId, right.jobId);

export class StableWorkerJobQueue {
  private readonly lanes: Record<JobPriority, WorkerJobRequest[]> = { Urgent: [], High: [], Normal: [] };
  private readonly queuedIds = new Set<WorkerJobId>();
  private urgentBurst = 0;
  private nonNormalBurst = 0;

  public constructor(public readonly capacity: number) {
    if (!Number.isSafeInteger(capacity) || capacity <= 0) throw new RangeError("Queue capacity must be a positive safe integer.");
  }

  public get size(): number { return this.queuedIds.size; }

  public has(jobId: WorkerJobId): boolean { return this.queuedIds.has(jobId); }

  public enqueue(source: WorkerJobRequest): QueueEnqueueDecision {
    if (this.queuedIds.has(source.jobId)) return Object.freeze({ kind: "RejectedDuplicateJob" });
    if (this.size >= this.capacity) return Object.freeze({ kind: "RejectedQueueFull" });
    const request = snapshotWorkerJobRequest(source);
    this.lanes[request.priority].push(request);
    this.lanes[request.priority].sort(compareWorkerJobs);
    this.queuedIds.add(request.jobId);
    return Object.freeze({ kind: "Accepted", request });
  }

  public cancel(jobId: WorkerJobId): WorkerJobRequest | undefined {
    for (const priority of ["Urgent", "High", "Normal"] as const) {
      const index = this.lanes[priority].findIndex((request) => request.jobId === jobId);
      if (index >= 0) {
        const [removed] = this.lanes[priority].splice(index, 1);
        this.queuedIds.delete(jobId);
        return removed;
      }
    }
    return undefined;
  }

  public dispatchNext(): WorkerJobRequest | undefined {
    const priority = this.selectPriority();
    if (!priority) return undefined;
    const request = this.lanes[priority].shift();
    if (!request) return undefined;
    this.queuedIds.delete(request.jobId);
    this.recordSuccessfulDispatch(priority);
    return request;
  }

  public drain(): readonly WorkerJobRequest[] {
    const removed = [...this.lanes.Urgent, ...this.lanes.High, ...this.lanes.Normal];
    this.lanes.Urgent.length = 0;
    this.lanes.High.length = 0;
    this.lanes.Normal.length = 0;
    this.queuedIds.clear();
    return Object.freeze(removed);
  }

  public snapshot(): WorkerJobQueueSnapshot {
    const jobs = ([...this.lanes.Urgent, ...this.lanes.High, ...this.lanes.Normal]).map((request) => request);
    return Object.freeze({
      capacity: this.capacity, size: this.size,
      urgentDepth: this.lanes.Urgent.length, highDepth: this.lanes.High.length, normalDepth: this.lanes.Normal.length,
      consecutiveUrgentDispatches: this.urgentBurst, consecutiveNonNormalDispatches: this.nonNormalBurst,
      jobs: Object.freeze(jobs),
    });
  }

  private selectPriority(): JobPriority | undefined {
    if (this.nonNormalBurst >= 8 && this.lanes.Normal.length > 0) return "Normal";
    if (this.urgentBurst >= 4) {
      if (this.lanes.High.length > 0) return "High";
      if (this.lanes.Normal.length > 0) return "Normal";
    }
    if (this.lanes.Urgent.length > 0) return "Urgent";
    if (this.lanes.High.length > 0) return "High";
    if (this.lanes.Normal.length > 0) return "Normal";
    return undefined;
  }

  private recordSuccessfulDispatch(priority: JobPriority): void {
    if (priority === "Urgent") this.urgentBurst += 1;
    else this.urgentBurst = 0;
    if (priority === "Normal") this.nonNormalBurst = 0;
    else this.nonNormalBurst += 1;
  }
}

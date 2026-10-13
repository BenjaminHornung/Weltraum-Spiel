import type { WorkerJobId } from "./ids";

export class CooperativeCancellationToken {
  private cancelled = false;
  public get isCancellationRequested(): boolean { return this.cancelled; }
  public cancel(): void { this.cancelled = true; }
}

export class WorkerCancellationRegistry {
  private readonly tokens = new Map<WorkerJobId, CooperativeCancellationToken>();

  public register(jobId: WorkerJobId): CooperativeCancellationToken {
    if (this.tokens.has(jobId)) throw new RangeError(`Cancellation token already registered for ${jobId}.`);
    const token = new CooperativeCancellationToken();
    this.tokens.set(jobId, token);
    return token;
  }

  public cancel(jobId: WorkerJobId): boolean {
    const token = this.tokens.get(jobId);
    if (!token) return false;
    token.cancel();
    return true;
  }

  public release(jobId: WorkerJobId): void { this.tokens.delete(jobId); }
  public clear(): void { this.tokens.clear(); }
}

export const yieldToWorkerEventLoop = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

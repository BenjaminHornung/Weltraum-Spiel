import type {
  PreparedStructuralFireCommand,
  PreparedStructuralFireReady,
  PreparedStructuralFireRequest,
  PreparedStructuralFireSourceIdentity
} from "./preparedStructuralFireWire";
import {
  preparedStructuralFireJobId,
  validatePreparedStructuralFireCommand,
  validatePreparedStructuralFireReadyAgainstRequest,
  validatePreparedStructuralFireRequest
} from "./preparedStructuralFireWireCodec";

export type PreparedStructuralFireLifecycle =
  | "Queued"
  | "Dispatched"
  | "Completed"
  | "Cancelled"
  | "Stale"
  | "Rejected";

export type PreparedStructuralFireSourceFacts = PreparedStructuralFireSourceIdentity;

export interface PreparedStructuralFireTelemetry {
  readonly queueDepth: number;
  readonly inFlight: number;
  readonly oldestQueuedAgeMs: number;
  readonly staleCount: number;
  readonly cancelCount: number;
  readonly completedCount: number;
  readonly latencyMs: Readonly<{
    readonly prepare: number;
    readonly validation: number;
  }>;
}

export interface PreparedStructuralFireSchedulerOptions {
  readonly now?: () => number;
  readonly maxRetainedRoots?: number;
  readonly maxReplayTombstones?: number;
}

interface ReplayTombstone {
  readonly rootJobId: string;
  readonly requestHash: string;
}

interface CommandRecord {
  readonly request: PreparedStructuralFireRequest;
  readonly command: PreparedStructuralFireCommand;
  readonly jobId: string;
  readonly sequence: number;
  state: "Queued" | "Dispatched" | "Cancelled" | "Stale";
  expectedWorkerEpoch: number | null;
  queuedAtMs: number;
}

export type PreparedStructuralFireEnqueueDecision =
  | Readonly<{ readonly state: "Queued"; readonly rootJobId: string }>
  | Readonly<{
      readonly state: "Deferred";
      readonly rootJobId: string;
      readonly reason: "RetainedRootCapacity" | "DeferredEpochRollover";
    }>
  | Readonly<{
      readonly state: "Rejected";
      readonly rootJobId: string;
      readonly reason: "DuplicateJob" | "InvalidInput";
    }>;

export type PreparedStructuralFireStartDecision = Readonly<{
  readonly state: "Ready";
  readonly rootJobId: string;
  readonly jobId: string;
  readonly request: PreparedStructuralFireRequest;
  readonly command: PreparedStructuralFireCommand;
  readonly dispatchIndex: 0;
  readonly attemptIndex: 0;
}> | null;

export type PreparedStructuralFireCancelDecision = Readonly<{
  readonly state: "Cancelled";
  readonly rootJobId: string;
  readonly signalWorker: boolean;
}> | null;

export type PreparedStructuralFireResultDecision =
  | Readonly<{
      readonly state: "Completed";
      readonly rootJobId: string;
      readonly jobId: string;
      readonly ready: PreparedStructuralFireReady;
    }>
  | Readonly<{ readonly state: "Cancelled"; readonly rootJobId: string }>
  | Readonly<{ readonly state: "Stale"; readonly rootJobId: string }>
  | Readonly<{ readonly state: "Rejected"; readonly rootJobId: string; readonly reason: string }>;

const DEFAULT_MAX_RETAINED_ROOTS = 64;
const DEFAULT_MAX_REPLAY_TOMBSTONES = 4096;

const positiveCapacity = (value: number, field: string): number => {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(`${field} must be a positive safe integer.`);
  }
  return value;
};

const finiteMonotonicTime = (value: number): number =>
  Number.isFinite(value) && value >= 0 ? value : 0;

const safeTick = (value: number): number => {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError("currentTick must be a non-negative safe integer.");
  }
  return value;
};

const sameSource = (
  request: Readonly<PreparedStructuralFireRequest>,
  source: Readonly<PreparedStructuralFireSourceFacts>
): boolean => request.source.objectId === source.objectId
  && request.source.objectRevision === source.objectRevision
  && request.source.editRevision === source.editRevision
  && request.source.contentHash === source.contentHash;

const compareRecords = (left: CommandRecord, right: CommandRecord): number =>
  left.request.deadlineTick - right.request.deadlineTick
  || (left.request.source.objectId < right.request.source.objectId
    ? -1
    : left.request.source.objectId > right.request.source.objectId ? 1 : 0)
  || left.sequence - right.sequence;

export class PreparedStructuralFireScheduler {
  readonly #now: () => number;
  readonly #records = new Map<string, CommandRecord>();
  readonly #replayTombstones: ReplayTombstone[] = [];
  readonly #maxRetainedRoots: number;
  readonly #maxReplayTombstones: number;
  #nextSequence = 0;
  #staleCount = 0;
  #cancelCount = 0;
  #completedCount = 0;
  #prepareLatencyMs = 0;
  #validationLatencyMs = 0;

  constructor(options: Readonly<PreparedStructuralFireSchedulerOptions> = {}) {
    this.#now = options.now ?? (() => globalThis.performance?.now() ?? 0);
    this.#maxRetainedRoots = positiveCapacity(
      options.maxRetainedRoots ?? DEFAULT_MAX_RETAINED_ROOTS,
      "maxRetainedRoots"
    );
    this.#maxReplayTombstones = positiveCapacity(
      options.maxReplayTombstones ?? DEFAULT_MAX_REPLAY_TOMBSTONES,
      "maxReplayTombstones"
    );
  }

  enqueue(
    requestValue: Readonly<PreparedStructuralFireRequest>,
    commandValue: Readonly<PreparedStructuralFireCommand>
  ): PreparedStructuralFireEnqueueDecision {
    const started = this.#readNow();
    let request: PreparedStructuralFireRequest;
    let command: PreparedStructuralFireCommand;
    try {
      request = validatePreparedStructuralFireRequest(requestValue);
      command = validatePreparedStructuralFireCommand(commandValue);
      if (request.seedHash !== command.seedHash
        || request.commandHash !== command.commandHash) {
        throw new RangeError("Prepared request does not bind its command.");
      }
    } catch {
      this.#prepareLatencyMs = this.#elapsed(started);
      return Object.freeze({
        state: "Rejected",
        rootJobId: typeof requestValue.rootJobId === "string" ? requestValue.rootJobId : "invalid-root",
        reason: "InvalidInput"
      });
    }
    this.#prepareLatencyMs = this.#elapsed(started);
    if (this.#records.has(request.rootJobId)
      || this.#replayTombstones.some((entry) => entry.rootJobId === request.rootJobId
        || entry.requestHash === request.requestHash)) {
      return Object.freeze({
        state: "Rejected",
        rootJobId: request.rootJobId,
        reason: "DuplicateJob"
      });
    }
    if (this.#records.size + this.#replayTombstones.length >= this.#maxReplayTombstones) {
      return Object.freeze({
        state: "Deferred",
        rootJobId: request.rootJobId,
        reason: "DeferredEpochRollover"
      });
    }
    if (this.#records.size >= this.#maxRetainedRoots) {
      return Object.freeze({
        state: "Deferred",
        rootJobId: request.rootJobId,
        reason: "RetainedRootCapacity"
      });
    }
    const record: CommandRecord = {
      request,
      command,
      jobId: preparedStructuralFireJobId(request, 0, 0),
      sequence: this.#nextSequence,
      state: "Queued",
      expectedWorkerEpoch: null,
      queuedAtMs: this.#readNow()
    };
    this.#nextSequence += 1;
    this.#records.set(request.rootJobId, record);
    return Object.freeze({ state: "Queued", rootJobId: request.rootJobId });
  }

  startNext(
    currentTickValue: number,
    preferredRootJobId?: string
  ): PreparedStructuralFireStartDecision {
    const currentTick = safeTick(currentTickValue);
    const record = [...this.#records.values()]
      .filter((candidate) => candidate.state === "Queued"
        && (preferredRootJobId === undefined
          || candidate.request.rootJobId === preferredRootJobId)
        && currentTick >= candidate.request.activationTick
        && !this.#hasEarlierCommandForObject(candidate))
      .sort(compareRecords)[0];
    if (record === undefined) return null;
    record.state = "Dispatched";
    return Object.freeze({
      state: "Ready",
      rootJobId: record.request.rootJobId,
      jobId: record.jobId,
      request: record.request,
      command: record.command,
      dispatchIndex: 0,
      attemptIndex: 0
    });
  }

  bindWorkerDispatch(rootJobId: string, workerEpoch: number, jobId: string): boolean {
    const record = this.#records.get(rootJobId);
    if (record === undefined
      || record.state !== "Dispatched"
      || record.jobId !== jobId
      || !Number.isSafeInteger(workerEpoch)
      || workerEpoch < 0) {
      return false;
    }
    if (record.expectedWorkerEpoch === null) {
      record.expectedWorkerEpoch = workerEpoch;
      return true;
    }
    return record.expectedWorkerEpoch === workerEpoch;
  }

  cancel(rootJobId: string): PreparedStructuralFireCancelDecision {
    const record = this.#records.get(rootJobId);
    if (record === undefined) return null;
    const signalWorker = record.state === "Dispatched";
    this.#cancelCount += 1;
    if (!signalWorker) this.#release(record);
    else record.state = "Cancelled";
    return Object.freeze({ state: "Cancelled", rootJobId, signalWorker });
  }

  acknowledgeCancellation(rootJobId: string): boolean {
    const record = this.#records.get(rootJobId);
    if (record === undefined || record.state !== "Cancelled") return false;
    this.#release(record);
    return true;
  }

  acknowledgeWorkerFailure(rootJobId: string): boolean {
    const record = this.#records.get(rootJobId);
    if (record === undefined || record.state === "Queued") return false;
    this.#release(record);
    return true;
  }

  invalidateObject(
    source: Readonly<PreparedStructuralFireSourceFacts>
  ): readonly Readonly<{ readonly state: "Stale"; readonly rootJobId: string; readonly signalWorker: boolean }>[] {
    const invalidated = [...this.#records.values()]
      .filter((record) => record.request.source.objectId === source.objectId
        && !sameSource(record.request, source))
      .sort((left, right) => left.sequence - right.sequence)
      .map((record) => {
        const signalWorker = record.state === "Dispatched" || record.state === "Cancelled";
        if (record.state !== "Stale") this.#staleCount += 1;
        record.state = "Stale";
        return Object.freeze({ state: "Stale" as const, rootJobId: record.request.rootJobId, signalWorker });
      });
    return Object.freeze(invalidated);
  }

  acceptReady(
    rootJobId: string,
    readyValue: Readonly<PreparedStructuralFireReady>,
    currentSource: Readonly<PreparedStructuralFireSourceFacts>,
    workerEpoch: number
  ): PreparedStructuralFireResultDecision {
    const started = this.#readNow();
    const record = this.#records.get(rootJobId);
    if (record === undefined) return this.#rejected(started, rootJobId, "RejectedUnknownJob");
    if (record.state === "Cancelled") {
      this.#release(record);
      this.#validationLatencyMs = this.#elapsed(started);
      return Object.freeze({ state: "Cancelled", rootJobId });
    }
    if (record.state === "Stale" || !sameSource(record.request, currentSource)) {
      if (record.state !== "Stale") this.#staleCount += 1;
      this.#release(record);
      this.#validationLatencyMs = this.#elapsed(started);
      return Object.freeze({ state: "Stale", rootJobId });
    }
    if (record.state !== "Dispatched"
      || record.expectedWorkerEpoch === null
      || record.expectedWorkerEpoch !== workerEpoch) {
      return this.#rejected(started, rootJobId, "StaleOrUnboundWorkerEpoch");
    }
    let ready: PreparedStructuralFireReady;
    try {
      ready = validatePreparedStructuralFireReadyAgainstRequest(
        record.request,
        readyValue,
        0,
        0
      );
    } catch {
      this.#release(record);
      return this.#rejected(started, rootJobId, "InvalidPreparedReady");
    }
    const jobId = record.jobId;
    this.#completedCount += 1;
    this.#release(record);
    this.#validationLatencyMs = this.#elapsed(started);
    return Object.freeze({ state: "Completed", rootJobId, jobId, ready });
  }

  readTelemetry(): PreparedStructuralFireTelemetry {
    const now = this.#readNow();
    const queued = [...this.#records.values()].filter((record) => record.state === "Queued");
    return Object.freeze({
      queueDepth: queued.length,
      inFlight: [...this.#records.values()].filter((record) => record.state === "Dispatched").length,
      oldestQueuedAgeMs: queued.length === 0
        ? 0
        : Math.max(0, now - Math.min(...queued.map((record) => record.queuedAtMs))),
      staleCount: this.#staleCount,
      cancelCount: this.#cancelCount,
      completedCount: this.#completedCount,
      latencyMs: Object.freeze({
        prepare: this.#prepareLatencyMs,
        validation: this.#validationLatencyMs
      })
    });
  }

  #hasEarlierCommandForObject(candidate: CommandRecord): boolean {
    return [...this.#records.values()].some((record) => record !== candidate
      && record.request.source.objectId === candidate.request.source.objectId
      && record.sequence < candidate.sequence);
  }

  #release(record: CommandRecord): void {
    this.#records.delete(record.request.rootJobId);
    this.#replayTombstones.push(Object.freeze({
      rootJobId: record.request.rootJobId,
      requestHash: record.request.requestHash
    }));
  }

  #rejected(started: number, rootJobId: string, reason: string): PreparedStructuralFireResultDecision {
    this.#validationLatencyMs = this.#elapsed(started);
    return Object.freeze({ state: "Rejected", rootJobId, reason });
  }

  #readNow(): number {
    return finiteMonotonicTime(this.#now());
  }

  #elapsed(started: number): number {
    return Math.max(0, this.#readNow() - started);
  }
}

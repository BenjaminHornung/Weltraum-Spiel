export type Brand<T, Name extends string> = T & { readonly __brand: Name };

export type WorkerJobId = Brand<string, "WorkerJobId">;
export type WorkerJobKind = Brand<string, "WorkerJobKind">;
export type WorkerTargetKey = Brand<string, "WorkerTargetKey">;
export type PlanningEpoch = Brand<number, "PlanningEpoch">;
export type WorkerEpoch = Brand<number, "WorkerEpoch">;
export type ContentRevision = Brand<number, "ContentRevision">;
export type AlgorithmVersion = Brand<number, "AlgorithmVersion">;
export type JobDeadline = Brand<number, "JobDeadline">;
export type ByteCount = Brand<number, "ByteCount">;

const STABLE_ASCII = /^[\x21-\x7e]+$/;

export const stableAsciiId = <T extends string>(value: string, field: string, maximumLength = 256): T => {
  if (typeof value !== "string" || !STABLE_ASCII.test(value) || value.length > maximumLength) {
    throw new RangeError(`${field} must be a non-empty stable ASCII identifier of at most ${maximumLength} bytes.`);
  }
  return value as T;
};

export const safeNonNegativeInteger = <T extends number>(value: number, field: string): T => {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${field} must be a non-negative safe integer.`);
  }
  return value as T;
};

export const workerJobId = (value: string): WorkerJobId => stableAsciiId<WorkerJobId>(value, "jobId");
export const workerJobKind = (value: string): WorkerJobKind => stableAsciiId<WorkerJobKind>(value, "jobKind", 64);
export const workerTargetKey = (value: string): WorkerTargetKey => stableAsciiId<WorkerTargetKey>(value, "targetKey");
export const planningEpoch = (value: number): PlanningEpoch => safeNonNegativeInteger<PlanningEpoch>(value, "planningEpoch");
export const workerEpoch = (value: number): WorkerEpoch => safeNonNegativeInteger<WorkerEpoch>(value, "workerEpoch");
export const contentRevision = (value: number, field = "revision"): ContentRevision => safeNonNegativeInteger<ContentRevision>(value, field);
export const algorithmVersion = (value: number): AlgorithmVersion => safeNonNegativeInteger<AlgorithmVersion>(value, "algorithmVersion");
export const jobDeadline = (value: number): JobDeadline => safeNonNegativeInteger<JobDeadline>(value, "deadline");
export const byteCount = (value: number, field = "byteCount"): ByteCount => safeNonNegativeInteger<ByteCount>(value, field);

export const nextWorkerEpoch = (current: WorkerEpoch): WorkerEpoch => {
  if (current >= Number.MAX_SAFE_INTEGER) {
    throw new RangeError("Worker epoch space is exhausted.");
  }
  return workerEpoch(current + 1);
};

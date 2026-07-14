import type { ByteCount, WorkerEpoch, WorkerJobId } from "./ids";
import { validateTransferableBundle, type TransferableBufferBundle, type WorkerJobFailure, type WorkerJobRequest, type WorkerJobResult } from "./protocol";

export type WorkerControlRequest =
  | { readonly type: "InitializeWorker"; readonly workerEpoch: WorkerEpoch }
  | { readonly type: "EnqueueJob"; readonly request: WorkerJobRequest }
  | { readonly type: "CancelJob"; readonly jobId: WorkerJobId; readonly workerEpoch: WorkerEpoch }
  | { readonly type: "ReleaseResult"; readonly jobId: WorkerJobId; readonly workerEpoch: WorkerEpoch }
  | { readonly type: "ReadStatus"; readonly workerEpoch: WorkerEpoch }
  | { readonly type: "ShutdownWorker"; readonly workerEpoch: WorkerEpoch };

export type WorkerControlResponse =
  | { readonly type: "WorkerReady"; readonly workerEpoch: WorkerEpoch }
  | { readonly type: "JobAccepted"; readonly jobId: WorkerJobId; readonly workerEpoch: WorkerEpoch }
  | { readonly type: "JobCancelled"; readonly jobId: WorkerJobId; readonly workerEpoch: WorkerEpoch; readonly reason: "CancelledDuringExecution" }
  | { readonly type: "JobCompleted"; readonly result: WorkerJobResult }
  | { readonly type: "JobFailed"; readonly failure: WorkerJobFailure }
  | { readonly type: "WorkerStatus"; readonly workerEpoch: WorkerEpoch; readonly state: "Ready" | "Busy" | "Stopping"; readonly jobId?: WorkerJobId }
  | { readonly type: "WorkerStopped"; readonly workerEpoch: WorkerEpoch };

export interface JobInputDataMessage {
  readonly type: "JobInputData";
  readonly jobId: WorkerJobId;
  readonly workerEpoch: WorkerEpoch;
  readonly bundle: TransferableBufferBundle;
}

export interface JobOutputDataMessage {
  readonly type: "JobOutputData";
  readonly jobId: WorkerJobId;
  readonly workerEpoch: WorkerEpoch;
  readonly outputBytes: ByteCount;
  readonly bundle: TransferableBufferBundle;
}

export type HostToWorkerMessage = WorkerControlRequest | JobInputDataMessage;
export type WorkerToHostMessage = WorkerControlResponse | JobOutputDataMessage;

export const isMessageRecord = (value: unknown): value is { readonly type: string } =>
  isRecord(value) && typeof value.type === "string";

const ASCII_ID = /^[\x21-\x7e]+$/;
const FAILURE_CODES = new Set([
  "QueueFull", "DuplicateJob", "InvalidRequest", "InvalidInput", "WorkerFault",
  "ProtocolFault", "WrongWorkerEpoch", "UnknownJob", "Shutdown", "JobExecutionFailed",
]);

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null;

const isSafeNonNegativeInteger = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0;

const isStableAscii = (value: unknown, maximumLength = 256): value is string =>
  typeof value === "string" && value.length <= maximumLength && ASCII_ID.test(value);

const isOptionalStableAscii = (value: unknown, maximumLength = 256): value is string | undefined =>
  value === undefined || isStableAscii(value, maximumLength);

const isWorkerJobResult = (value: unknown): value is WorkerJobResult => {
  if (!isRecord(value)) return false;
  return isStableAscii(value.jobId)
    && isStableAscii(value.targetKey)
    && isSafeNonNegativeInteger(value.planningEpoch)
    && isSafeNonNegativeInteger(value.workerEpoch)
    && isSafeNonNegativeInteger(value.inputRevision)
    && isSafeNonNegativeInteger(value.outputRevision)
    && isSafeNonNegativeInteger(value.algorithmVersion)
    && isSafeNonNegativeInteger(value.outputBytes)
    && isOptionalStableAscii(value.contentHash, 128);
};

const isWorkerJobFailure = (value: unknown): value is WorkerJobFailure => {
  if (!isRecord(value)) return false;
  return isStableAscii(value.jobId)
    && typeof value.code === "string"
    && FAILURE_CODES.has(value.code)
    && typeof value.message === "string"
    && (value.workerEpoch === undefined || isSafeNonNegativeInteger(value.workerEpoch));
};

const isValidBundle = (value: unknown): value is TransferableBufferBundle => {
  if (!isRecord(value)) return false;
  try {
    validateTransferableBundle(value as unknown as TransferableBufferBundle);
    return true;
  } catch {
    return false;
  }
};

export const isWorkerToHostMessage = (value: unknown): value is WorkerToHostMessage => {
  if (!isMessageRecord(value)) return false;
  const record = value as Readonly<Record<string, unknown>> & { readonly type: string };
  switch (record.type) {
    case "WorkerReady":
    case "WorkerStopped":
      return isSafeNonNegativeInteger(record.workerEpoch);
    case "JobAccepted":
      return isStableAscii(record.jobId) && isSafeNonNegativeInteger(record.workerEpoch);
    case "JobCancelled":
      return isStableAscii(record.jobId)
        && isSafeNonNegativeInteger(record.workerEpoch)
        && record.reason === "CancelledDuringExecution";
    case "JobCompleted":
      return isWorkerJobResult(record.result);
    case "JobFailed":
      return isWorkerJobFailure(record.failure);
    case "WorkerStatus":
      return isSafeNonNegativeInteger(record.workerEpoch)
        && (record.state === "Ready" || record.state === "Busy" || record.state === "Stopping")
        && isOptionalStableAscii(record.jobId);
    case "JobOutputData":
      return isStableAscii(record.jobId)
        && isSafeNonNegativeInteger(record.workerEpoch)
        && isSafeNonNegativeInteger(record.outputBytes)
        && isValidBundle(record.bundle)
        && record.bundle.byteLength === record.outputBytes;
    default:
      return false;
  }
};
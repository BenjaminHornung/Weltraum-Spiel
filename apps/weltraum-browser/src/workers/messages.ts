import type { ByteCount, WorkerEpoch, WorkerJobId } from "./ids";
import { validateHestiaVoxelBrickMeshResultDetails, validateTransferableBundle, type TransferableBufferBundle, type WorkerJobFailure, type WorkerJobRequest, type WorkerJobResult, type WorkerResultReleaseScope } from "./protocol";

export type WorkerControlRequest =
  | { readonly type: "InitializeWorker"; readonly workerEpoch: WorkerEpoch }
  | { readonly type: "EnqueueJob"; readonly request: WorkerJobRequest }
  | { readonly type: "CancelJob"; readonly jobId: WorkerJobId; readonly workerEpoch: WorkerEpoch }
  | ({ readonly type: "ReleaseResult"; readonly jobId: WorkerJobId; readonly workerEpoch: WorkerEpoch }
    & WorkerResultReleaseScope)
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

export interface PreparedStructuralFirePrivateInputMessage {
  readonly type: "PreparedStructuralFirePrivateInput";
  readonly workerEpoch: WorkerEpoch;
  readonly rootJobId: string;
  readonly payload: unknown;
}

export interface PreparedStructuralFirePrivateOutputMessage {
  readonly type: "PreparedStructuralFirePrivateOutput";
  readonly workerEpoch: WorkerEpoch;
  readonly rootJobId: string;
  readonly payload: unknown;
}

export type HostToWorkerMessage =
  | WorkerControlRequest
  | JobInputDataMessage
  | PreparedStructuralFirePrivateInputMessage;
export type WorkerToHostMessage =
  | WorkerControlResponse
  | JobOutputDataMessage
  | PreparedStructuralFirePrivateOutputMessage;

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

const isOptionalResultDetails = (value: unknown): boolean => {
  if (value === undefined) return true;
  try {
    validateHestiaVoxelBrickMeshResultDetails(value);
    return true;
  } catch {
    return false;
  }
};

interface BoundedProtocolDetailsBudget {
  remainingNodes: number;
  remainingStringCodeUnits: number;
}

const isBoundedJsonDetails = (
  value: unknown,
  depth: number,
  budget: BoundedProtocolDetailsBudget
): boolean => {
  if (depth > 8 || budget.remainingNodes <= 0 || budget.remainingStringCodeUnits < 0) {
    return false;
  }
  budget.remainingNodes -= 1;
  if (value === null || typeof value === "boolean") return true;
  if (typeof value === "string") {
    budget.remainingStringCodeUnits -= value.length;
    return budget.remainingStringCodeUnits >= 0;
  }
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) {
    return value.every((entry) => isBoundedJsonDetails(entry, depth + 1, budget));
  }
  if (!isRecord(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return false;
  return Object.keys(value).every((key) => isStableAscii(key, 128)
    && isBoundedJsonDetails(value[key], depth + 1, budget));
};

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
    && isOptionalStableAscii(value.contentHash, 128)
    && isOptionalResultDetails(value.details)
    && isOptionalBoundedProtocolDetails(value.protocolDetails)
    && !(value.details !== undefined && value.protocolDetails !== undefined);
};

const isOptionalBoundedProtocolDetails = (value: unknown): boolean =>
  value === undefined || isBoundedJsonDetails(value, 0, {
    remainingNodes: 256,
    remainingStringCodeUnits: 32 * 1024
  });

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
    case "PreparedStructuralFirePrivateOutput":
      return isSafeNonNegativeInteger(record.workerEpoch)
        && isStableAscii(record.rootJobId)
        && isRecord(record.payload)
        && typeof record.payload.kind === "string";
    default:
      return false;
  }
};

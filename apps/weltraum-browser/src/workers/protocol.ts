import {
  type AlgorithmVersion,
  type ByteCount,
  type ContentRevision,
  type JobDeadline,
  type PlanningEpoch,
  type WorkerEpoch,
  type WorkerJobId,
  type WorkerJobKind,
  type WorkerTargetKey,
  algorithmVersion,
  byteCount,
  contentRevision,
  jobDeadline,
  planningEpoch,
  stableAsciiId,
  workerEpoch,
  workerJobId,
  workerJobKind,
  workerTargetKey,
} from "./ids";

export const JOB_PRIORITIES = ["Urgent", "High", "Normal"] as const;
export type JobPriority = (typeof JOB_PRIORITIES)[number];
export type TransferOwnership = "SenderToWorker" | "WorkerToConsumer";
export const TYPED_ARRAY_KINDS = [
  "Int8Array", "Uint8Array", "Uint8ClampedArray", "Int16Array", "Uint16Array",
  "Int32Array", "Uint32Array", "Float32Array", "Float64Array",
] as const;
export type TypedArrayKind = (typeof TYPED_ARRAY_KINDS)[number];

export interface TypedArrayViewDescriptor {
  readonly name: string;
  readonly bufferIndex: number;
  readonly kind: TypedArrayKind;
  readonly byteOffset: number;
  readonly elementCount: number;
}

export interface TransferableBufferBundle {
  readonly ownership: TransferOwnership;
  readonly revision: ContentRevision;
  readonly byteLength: ByteCount;
  readonly buffers: readonly ArrayBuffer[];
  readonly views: readonly TypedArrayViewDescriptor[];
  readonly contentHash?: string;
}

export interface TransformBufferPayload {
  readonly xorMask: number;
  readonly chunkBytes: number;
  readonly outputRevision: ContentRevision;
}

export interface WorkerJobRequest<Payload = unknown> {
  readonly jobId: WorkerJobId;
  readonly jobKind: WorkerJobKind;
  readonly targetKey: WorkerTargetKey;
  readonly planningEpoch: PlanningEpoch;
  readonly workerEpoch: WorkerEpoch;
  readonly inputRevision: ContentRevision;
  readonly algorithmVersion: AlgorithmVersion;
  readonly priority: JobPriority;
  readonly deadline: JobDeadline;
  readonly estimatedInputBytes: ByteCount;
  readonly estimatedOutputBytes: ByteCount;
  readonly payload: Readonly<Payload>;
}

export interface WorkerJobResult {
  readonly jobId: WorkerJobId;
  readonly targetKey: WorkerTargetKey;
  readonly planningEpoch: PlanningEpoch;
  readonly workerEpoch: WorkerEpoch;
  readonly inputRevision: ContentRevision;
  readonly outputRevision: ContentRevision;
  readonly algorithmVersion: AlgorithmVersion;
  readonly outputBytes: ByteCount;
  readonly contentHash?: string;
}

export type WorkerFailureCode =
  | "QueueFull" | "DuplicateJob" | "InvalidRequest" | "InvalidInput" | "WorkerFault"
  | "ProtocolFault" | "WrongWorkerEpoch" | "UnknownJob" | "Shutdown" | "JobExecutionFailed";

export interface WorkerJobFailure {
  readonly jobId: WorkerJobId;
  readonly code: WorkerFailureCode;
  readonly message: string;
  readonly workerEpoch?: WorkerEpoch;
}

type JsonRecord = { readonly [key: string]: unknown };

const cloneFreeze = (value: unknown, seen = new WeakSet<object>()): unknown => {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new RangeError("Job payload numbers must be finite.");
    return value;
  }
  if (Array.isArray(value)) {
    if (seen.has(value)) throw new RangeError("Job payloads cannot contain cycles.");
    seen.add(value);
    const clone = value.map((entry) => cloneFreeze(entry, seen));
    seen.delete(value);
    return Object.freeze(clone);
  }
  if (typeof value === "object" && value !== undefined) {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new RangeError("Job payload objects must be plain records.");
    }
    if (seen.has(value)) throw new RangeError("Job payloads cannot contain cycles.");
    seen.add(value);
    const clone = Object.create(null) as Record<string, unknown>;
    for (const key of Object.keys(value as JsonRecord).sort()) {
      const entry = (value as JsonRecord)[key];
      if (entry !== undefined) clone[key] = cloneFreeze(entry, seen);
    }
    seen.delete(value);
    return Object.freeze(clone);
  }
  throw new RangeError("Job payloads must be JSON-serializable.");
};

export const validatePriority = (value: unknown): JobPriority => {
  if (value !== "Urgent" && value !== "High" && value !== "Normal") throw new RangeError("priority is invalid.");
  return value;
};

export const snapshotWorkerJobRequest = <Payload>(source: WorkerJobRequest<Payload>): WorkerJobRequest<Payload> => Object.freeze({
  jobId: workerJobId(source.jobId),
  jobKind: workerJobKind(source.jobKind),
  targetKey: workerTargetKey(source.targetKey),
  planningEpoch: planningEpoch(source.planningEpoch),
  workerEpoch: workerEpoch(source.workerEpoch),
  inputRevision: contentRevision(source.inputRevision, "inputRevision"),
  algorithmVersion: algorithmVersion(source.algorithmVersion),
  priority: validatePriority(source.priority),
  deadline: jobDeadline(source.deadline),
  estimatedInputBytes: byteCount(source.estimatedInputBytes, "estimatedInputBytes"),
  estimatedOutputBytes: byteCount(source.estimatedOutputBytes, "estimatedOutputBytes"),
  payload: cloneFreeze(source.payload) as Readonly<Payload>,
});

const BYTES_PER_ELEMENT: Readonly<Record<TypedArrayKind, number>> = Object.freeze({
  Int8Array: 1, Uint8Array: 1, Uint8ClampedArray: 1, Int16Array: 2, Uint16Array: 2,
  Int32Array: 4, Uint32Array: 4, Float32Array: 4, Float64Array: 8,
});

export const validateTransferableBundle = (bundle: TransferableBufferBundle): TransferableBufferBundle => {
  if (bundle.ownership !== "SenderToWorker" && bundle.ownership !== "WorkerToConsumer") throw new RangeError("Invalid transfer ownership.");
  const revision = contentRevision(bundle.revision);
  const declaredBytes = byteCount(bundle.byteLength, "bundle.byteLength");
  let actualBytes = 0;
  const uniqueBuffers = new Set<ArrayBuffer>();
  const buffers = bundle.buffers.map((buffer) => {
    if (!(buffer instanceof ArrayBuffer)) throw new RangeError("Only ArrayBuffer payloads are transferable.");
    if (uniqueBuffers.has(buffer)) throw new RangeError("Transfer bundles cannot list the same ArrayBuffer more than once.");
    uniqueBuffers.add(buffer);
    actualBytes += buffer.byteLength;
    if (!Number.isSafeInteger(actualBytes)) throw new RangeError("Bundle byte length overflow.");
    return buffer;
  });
  if (actualBytes !== declaredBytes) throw new RangeError("Declared bundle byte length does not match buffers.");
  const names = new Set<string>();
  const views = bundle.views.map((view) => {
    const name = stableAsciiId<string>(view.name, "view.name", 128);
    if (names.has(name)) throw new RangeError(`Duplicate view name: ${name}`);
    names.add(name);
    if (!Number.isSafeInteger(view.bufferIndex) || view.bufferIndex < 0 || view.bufferIndex >= buffers.length) throw new RangeError("View bufferIndex is out of range.");
    if (!(TYPED_ARRAY_KINDS as readonly string[]).includes(view.kind)) throw new RangeError("Unsupported typed array kind.");
    const byteOffset = Number(view.byteOffset);
    const elementCount = Number(view.elementCount);
    if (!Number.isSafeInteger(byteOffset) || byteOffset < 0 || !Number.isSafeInteger(elementCount) || elementCount < 0) throw new RangeError("Invalid view range.");
    const elementBytes = BYTES_PER_ELEMENT[view.kind];
    if (byteOffset % elementBytes !== 0) throw new RangeError("View byteOffset is not aligned.");
    const viewBytes = elementCount * elementBytes;
    if (!Number.isSafeInteger(viewBytes) || byteOffset + viewBytes > buffers[view.bufferIndex].byteLength) throw new RangeError("View exceeds its buffer.");
    return Object.freeze({ name, bufferIndex: view.bufferIndex, kind: view.kind, byteOffset, elementCount });
  });
  const contentHash = bundle.contentHash === undefined ? undefined : stableAsciiId<string>(bundle.contentHash, "contentHash", 128);
  return Object.freeze({ ownership: bundle.ownership, revision, byteLength: declaredBytes, buffers: Object.freeze(buffers), views: Object.freeze(views), ...(contentHash ? { contentHash } : {}) });
};

export const transferListFor = (bundle: TransferableBufferBundle): Transferable[] => [...bundle.buffers];

export const fnv1aBytes = (buffers: readonly ArrayBuffer[]): string => {
  let hash = 0x811c9dc5;
  for (const buffer of buffers) {
    const bytes = new Uint8Array(buffer);
    for (let index = 0; index < bytes.length; index += 1) {
      hash ^= bytes[index];
      hash = Math.imul(hash, 0x01000193);
    }
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
};

export const validateTransformPayload = (payload: unknown): TransformBufferPayload => {
  if (!payload || typeof payload !== "object") throw new RangeError("TransformBuffer payload is required.");
  const record = payload as Record<string, unknown>;
  const xorMask = Number(record.xorMask);
  const chunkBytes = Number(record.chunkBytes);
  if (!Number.isInteger(xorMask) || xorMask < 0 || xorMask > 255) throw new RangeError("xorMask must be an unsigned byte.");
  if (!Number.isSafeInteger(chunkBytes) || chunkBytes <= 0) throw new RangeError("chunkBytes must be a positive safe integer.");
  return Object.freeze({ xorMask, chunkBytes, outputRevision: contentRevision(Number(record.outputRevision), "outputRevision") });
};

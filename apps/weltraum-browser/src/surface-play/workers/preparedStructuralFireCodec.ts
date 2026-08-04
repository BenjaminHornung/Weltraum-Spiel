import {
  byteCount,
  contentRevision,
  fnv1aBytes,
  validateTransferableBundle,
  type TransferableBufferBundle,
  type TypedArrayViewDescriptor
} from "../../workers";
import {
  decodeStructuralResult,
  decodeStructuralObject,
  encodeStructuralObject,
  encodeStructuralResult,
  serializeStructuralCommand,
  validateStructuralDestructionCommand,
  type StructuralAcceptedCommandResult,
  type StructuralDestructionCommand,
  type StructuralObject
} from "../../voxel/structural";
import {
  canonicalAdaptiveJson,
  serializeAdaptiveKey
} from "../../voxel/adaptive";
import {
  preparedStructuralFireInputCommitmentHash,
  validatePreparedStructuralFireInput,
  type PreparedStructuralFireJob
} from "./preparedStructuralFireProtocol";

export const PREPARED_STRUCTURAL_FIRE_SEED_VIEW =
  "preparedStructuralFireSeed" as const;
export const PREPARED_STRUCTURAL_FIRE_COMMAND_VIEW =
  "preparedStructuralFireCommand" as const;
export const PREPARED_STRUCTURAL_FIRE_ADOPTION_VIEW =
  "preparedStructuralFireAdoption" as const;
export const PREPARED_STRUCTURAL_FIRE_CONTINUATION_VIEW =
  "preparedStructuralFireContinuation" as const;
export const PREPARED_STRUCTURAL_FIRE_RESULT_VIEW =
  "preparedStructuralFireResult" as const;
const CONSUMED_VIEW_PREFIX = "preparedStructuralFireConsumed:";

export interface PreparedStructuralFireContinuationInput {
  readonly rootJobId: string;
  readonly batchIndex: number;
  readonly tokenHash: string;
  readonly chainHash: string;
}

export interface PreparedStructuralFireAdoptionReceipt {
  readonly objectId: string;
  readonly rootJobId: string;
  readonly resultingObjectRevision: number;
  readonly resultingEditRevision: number;
  readonly resultingContentHash: string;
  readonly resultingEvidenceHash: string;
  readonly resultHash: string;
  readonly receiptHash: string;
}

export type DecodedPreparedStructuralFireInput =
  | Readonly<{
      readonly kind: "Seed";
      readonly object: StructuralObject;
      readonly command: StructuralDestructionCommand;
    }>
  | Readonly<{
      readonly kind: "Command";
      readonly command: StructuralDestructionCommand;
    }>
  | Readonly<{
      readonly kind: "AdoptedCommand";
      readonly adoption: PreparedStructuralFireAdoptionReceipt;
      readonly command: StructuralDestructionCommand;
    }>
  | Readonly<{
      readonly kind: "Continuation";
      readonly facts: PreparedStructuralFireContinuationInput;
    }>;

export interface DecodedPreparedStructuralFireWorkerOutput {
  readonly consumedInput: TransferableBufferBundle;
  readonly resultBundle: TransferableBufferBundle;
  readonly resultBytes: Uint8Array;
}

export interface PreparedStructuralFireResultDeltaReceipt {
  readonly status: "Applied" | "NoChange";
  readonly sourceObjectId: string;
  readonly sourceObjectRevision: number;
  readonly sourceEditRevision: number;
  readonly sourceContentHash: string;
  readonly resultingObjectRevision: number;
  readonly resultingEditRevision: number;
  readonly resultingContentHash: string;
  readonly resultingEvidenceHash: string;
  readonly changedBrickCount: number;
  readonly resultHash: string;
}

const PREPARED_STRUCTURAL_FIRE_DELTA_SCHEMA_VERSION =
  "prepared-structural-fire-delta-v1" as const;

const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });

const textBuffer = (value: string): ArrayBuffer => {
  const bytes = encoder.encode(value);
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
};

const exactUint8View = (
  name: string,
  bufferIndex: number,
  byteLength: number
): TypedArrayViewDescriptor => Object.freeze({
  name,
  bufferIndex,
  kind: "Uint8Array" as const,
  byteOffset: 0,
  elementCount: byteLength
});

const inputBundle = (
  revision: number,
  entries: readonly Readonly<{ readonly name: string; readonly buffer: ArrayBuffer }>[]
): TransferableBufferBundle => {
  const buffers = Object.freeze(entries.map((entry) => entry.buffer));
  const views = Object.freeze(entries.map((entry, index) =>
    exactUint8View(entry.name, index, entry.buffer.byteLength)));
  const byteLength = buffers.reduce((sum, buffer) => sum + buffer.byteLength, 0);
  return validateTransferableBundle(Object.freeze({
    ownership: "SenderToWorker" as const,
    revision: contentRevision(revision),
    byteLength: byteCount(byteLength),
    buffers,
    views,
    contentHash: fnv1aBytes(buffers)
  }));
};

export const encodePreparedStructuralFireSeedInput = (
  revision: number,
  object: StructuralObject,
  command: StructuralDestructionCommand
): TransferableBufferBundle => inputBundle(revision, [
  Object.freeze({
    name: PREPARED_STRUCTURAL_FIRE_SEED_VIEW,
    buffer: textBuffer(encodeStructuralObject(object))
  }),
  Object.freeze({
    name: PREPARED_STRUCTURAL_FIRE_COMMAND_VIEW,
    buffer: textBuffer(serializeStructuralCommand(command))
  })
]);

export const encodePreparedStructuralFireCommandInput = (
  revision: number,
  command: StructuralDestructionCommand
): TransferableBufferBundle => inputBundle(revision, [Object.freeze({
  name: PREPARED_STRUCTURAL_FIRE_COMMAND_VIEW,
  buffer: textBuffer(serializeStructuralCommand(command))
})]);

export const encodePreparedStructuralFireAdoptedCommandInput = (
  revision: number,
  adoption: Readonly<PreparedStructuralFireAdoptionReceipt>,
  command: StructuralDestructionCommand
): TransferableBufferBundle => inputBundle(revision, [
  Object.freeze({
    name: PREPARED_STRUCTURAL_FIRE_ADOPTION_VIEW,
    buffer: textBuffer(canonicalAdaptiveJson(adoption))
  }),
  Object.freeze({
    name: PREPARED_STRUCTURAL_FIRE_COMMAND_VIEW,
    buffer: textBuffer(serializeStructuralCommand(command))
  })
]);

export const encodePreparedStructuralFireContinuationInput = (
  revision: number,
  facts: Readonly<PreparedStructuralFireContinuationInput>
): TransferableBufferBundle => inputBundle(revision, [Object.freeze({
  name: PREPARED_STRUCTURAL_FIRE_CONTINUATION_VIEW,
  buffer: textBuffer(JSON.stringify({
    rootJobId: facts.rootJobId,
    batchIndex: facts.batchIndex,
    tokenHash: facts.tokenHash,
    chainHash: facts.chainHash
  }))
})]);

const decodedText = (buffer: ArrayBuffer): string => decoder.decode(new Uint8Array(buffer));

const parseContinuation = (value: string): PreparedStructuralFireContinuationInput => {
  const parsed: unknown = JSON.parse(value);
  if (typeof parsed !== "object" || parsed === null) {
    throw new RangeError("Prepared Structural Fire continuation must be an object.");
  }
  const record = parsed as Readonly<Record<string, unknown>>;
  if (typeof record.rootJobId !== "string"
    || typeof record.batchIndex !== "number"
    || !Number.isSafeInteger(record.batchIndex)
    || record.batchIndex < 1
    || typeof record.tokenHash !== "string"
    || typeof record.chainHash !== "string") {
    throw new RangeError("Prepared Structural Fire continuation facts are invalid.");
  }
  return Object.freeze({
    rootJobId: record.rootJobId,
    batchIndex: record.batchIndex,
    tokenHash: record.tokenHash,
    chainHash: record.chainHash
  });
};

const recordValue = (value: unknown, path: string): Readonly<Record<string, unknown>> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new RangeError(`${path} must be an object.`);
  }
  return value as Readonly<Record<string, unknown>>;
};

const parseAdoption = (value: string): PreparedStructuralFireAdoptionReceipt => {
  const record = recordValue(JSON.parse(value) as unknown, "adoption");
  if (canonicalAdaptiveJson(record) !== value
    || typeof record.objectId !== "string"
    || typeof record.rootJobId !== "string"
    || typeof record.resultingObjectRevision !== "number"
    || !Number.isSafeInteger(record.resultingObjectRevision)
    || record.resultingObjectRevision < 0
    || typeof record.resultingEditRevision !== "number"
    || !Number.isSafeInteger(record.resultingEditRevision)
    || record.resultingEditRevision < 0
    || typeof record.resultingContentHash !== "string"
    || typeof record.resultingEvidenceHash !== "string"
    || typeof record.resultHash !== "string"
    || typeof record.receiptHash !== "string") {
    throw new RangeError("Prepared Structural Fire adoption receipt is invalid.");
  }
  return Object.freeze({
    objectId: record.objectId,
    rootJobId: record.rootJobId,
    resultingObjectRevision: record.resultingObjectRevision,
    resultingEditRevision: record.resultingEditRevision,
    resultingContentHash: record.resultingContentHash,
    resultingEvidenceHash: record.resultingEvidenceHash,
    resultHash: record.resultHash,
    receiptHash: record.receiptHash
  });
};

const stringArray = (value: unknown, path: string): readonly string[] => {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    throw new RangeError(`${path} must be a string array.`);
  }
  return Object.freeze([...value] as string[]);
};

export const validatePreparedStructuralFireResultDeltaReceipt = (
  job: Readonly<PreparedStructuralFireJob>,
  bytes: Uint8Array
): PreparedStructuralFireResultDeltaReceipt => {
  const serialized = decoder.decode(bytes);
  const delta = recordValue(JSON.parse(serialized) as unknown, "delta");
  if (canonicalAdaptiveJson(delta) !== serialized) {
    throw new RangeError("Prepared Structural Fire delta must be canonical JSON.");
  }
  if (delta.schemaVersion !== PREPARED_STRUCTURAL_FIRE_DELTA_SCHEMA_VERSION) {
    throw new RangeError("Prepared Structural Fire delta schema is invalid.");
  }
  const source = recordValue(delta.source, "delta.source");
  if (source.objectId !== job.objectId
    || source.objectRevision !== job.expectedObjectRevision
    || source.editRevision !== job.expectedEditRevision
    || source.contentHash !== job.contentHash) {
    throw new RangeError("Prepared Structural Fire delta source receipt is stale.");
  }
  const result = recordValue(delta.result, "delta.result");
  const object = recordValue(result.object, "delta.result.object");
  const changedBrickKeys = stringArray(
    result.changedBrickKeys,
    "delta.result.changedBrickKeys"
  );
  if ((result.status !== "Applied" && result.status !== "NoChange")
    || typeof object.objectRevision !== "number"
    || typeof object.editRevision !== "number"
    || typeof object.contentHash !== "string"
    || typeof object.evidenceHash !== "string"
    || typeof result.resultHash !== "string"
    || !Array.isArray(object.changedBricks)) {
    throw new RangeError("Prepared Structural Fire delta result receipt is invalid.");
  }
  const orderedKeys = [...changedBrickKeys].sort();
  if (new Set(changedBrickKeys).size !== changedBrickKeys.length
    || orderedKeys.some((key, index) => key !== changedBrickKeys[index])) {
    throw new RangeError("Prepared Structural Fire delta changed keys are noncanonical.");
  }
  const changedKeySet = new Set(changedBrickKeys);
  const seenChangedBricks = new Set<string>();
  for (const entry of object.changedBricks) {
    const brick = recordValue(entry, "delta.result.object.changedBricks");
    if (typeof brick.key !== "string"
      || !changedKeySet.has(brick.key)
      || seenChangedBricks.has(brick.key)) {
      throw new RangeError("Prepared Structural Fire delta changed brick receipt is invalid.");
    }
    seenChangedBricks.add(brick.key);
  }
  if (result.status === "NoChange"
    && (changedBrickKeys.length !== 0 || object.changedBricks.length !== 0)) {
    throw new RangeError("Prepared Structural Fire NoChange delta cannot contain changed bricks.");
  }
  return Object.freeze({
    status: result.status,
    sourceObjectId: source.objectId as string,
    sourceObjectRevision: source.objectRevision as number,
    sourceEditRevision: source.editRevision as number,
    sourceContentHash: source.contentHash as string,
    resultingObjectRevision: object.objectRevision,
    resultingEditRevision: object.editRevision,
    resultingContentHash: object.contentHash,
    resultingEvidenceHash: object.evidenceHash,
    changedBrickCount: changedBrickKeys.length,
    resultHash: result.resultHash
  });
};

export const encodePreparedStructuralFireResultDelta = (
  source: StructuralObject,
  result: StructuralAcceptedCommandResult
): Uint8Array => {
  if (result.object.objectId !== source.objectId
    || result.object.objectRevision !== source.objectRevision + 1
    || (result.status === "Applied"
      && (result.object.editRevision !== source.editRevision + 1
        || result.object.contentHash === source.contentHash))
    || (result.status === "NoChange"
      && (result.object.editRevision !== source.editRevision
        || result.object.contentHash !== source.contentHash
        || result.changedBrickKeys.length !== 0
        || result.changedVoxelCount !== 0))) {
    throw new RangeError("Prepared Structural Fire delta requires one accepted authority revision.");
  }
  const projection = recordValue(
    JSON.parse(encodeStructuralResult(result)) as unknown,
    "result"
  );
  const projectedObject = recordValue(projection.object, "result.object");
  const changedKeys = new Set(stringArray(projection.changedBrickKeys, "result.changedBrickKeys"));
  const projectedBricks = Array.isArray(projectedObject.bricks)
    ? projectedObject.bricks
    : [];
  const changedBricks = projectedBricks.filter((entry) => {
    const brick = recordValue(entry, "result.object.bricks");
    return typeof brick.key === "string" && changedKeys.has(brick.key);
  });
  const delta = Object.freeze({
    schemaVersion: PREPARED_STRUCTURAL_FIRE_DELTA_SCHEMA_VERSION,
    source: Object.freeze({
      objectId: source.objectId,
      objectRevision: source.objectRevision,
      editRevision: source.editRevision,
      contentHash: source.contentHash
    }),
    result: Object.freeze({
      schemaVersion: projection.schemaVersion,
      status: projection.status,
      commandId: projection.commandId,
      object: Object.freeze({
        objectRevision: projectedObject.objectRevision,
        editRevision: projectedObject.editRevision,
        contentHash: projectedObject.contentHash,
        commandEvidence: projectedObject.commandEvidence,
        evidenceHash: projectedObject.evidenceHash,
        changedBricks: Object.freeze(changedBricks)
      }),
      changedBrickKeys: projection.changedBrickKeys,
      selectedVoxelCount: projection.selectedVoxelCount,
      changedVoxelCount: projection.changedVoxelCount,
      invalidations: projection.invalidations,
      resultHash: projection.resultHash
    })
  });
  return encoder.encode(canonicalAdaptiveJson(delta));
};

export const decodePreparedStructuralFireResultDelta = (
  source: StructuralObject,
  bytes: Uint8Array
): StructuralAcceptedCommandResult => {
  const serialized = decoder.decode(bytes);
  const delta = recordValue(JSON.parse(serialized) as unknown, "delta");
  if (canonicalAdaptiveJson(delta) !== serialized) {
    throw new RangeError("Prepared Structural Fire delta must be canonical JSON.");
  }
  if (delta.schemaVersion !== PREPARED_STRUCTURAL_FIRE_DELTA_SCHEMA_VERSION) {
    throw new RangeError("Prepared Structural Fire delta schema is invalid.");
  }
  const sourceReceipt = recordValue(delta.source, "delta.source");
  if (sourceReceipt.objectId !== source.objectId
    || sourceReceipt.objectRevision !== source.objectRevision
    || sourceReceipt.editRevision !== source.editRevision
    || sourceReceipt.contentHash !== source.contentHash) {
    throw new RangeError("Prepared Structural Fire delta source is stale.");
  }
  const projectedSource = recordValue(
    JSON.parse(encodeStructuralObject(source)) as unknown,
    "source"
  );
  const projectedResult = recordValue(delta.result, "delta.result");
  const projectedDeltaObject = recordValue(
    projectedResult.object,
    "delta.result.object"
  );
  const changedKeys = stringArray(
    projectedResult.changedBrickKeys,
    "delta.result.changedBrickKeys"
  );
  const changedKeySet = new Set(changedKeys);
  const sourceBricks = Array.isArray(projectedSource.bricks)
    ? projectedSource.bricks
    : [];
  const bricksByKey = new Map<string, unknown>();
  for (const entry of sourceBricks) {
    const brick = recordValue(entry, "source.bricks");
    if (typeof brick.key !== "string") {
      throw new RangeError("Prepared Structural Fire source brick key is invalid.");
    }
    bricksByKey.set(brick.key, entry);
  }
  for (const key of changedKeys) bricksByKey.delete(key);
  const changedBricks = Array.isArray(projectedDeltaObject.changedBricks)
    ? projectedDeltaObject.changedBricks
    : [];
  for (const entry of changedBricks) {
    const brick = recordValue(entry, "delta.result.object.changedBricks");
    if (typeof brick.key !== "string" || !changedKeySet.has(brick.key)) {
      throw new RangeError("Prepared Structural Fire delta brick is not declared changed.");
    }
    bricksByKey.set(brick.key, entry);
  }
  const objectProjection = Object.freeze({
    ...projectedSource,
    bricks: Object.freeze([...bricksByKey.entries()]
      .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
      .map(([, brick]) => brick)),
    objectRevision: projectedDeltaObject.objectRevision,
    editRevision: projectedDeltaObject.editRevision,
    contentHash: projectedDeltaObject.contentHash,
    commandEvidence: projectedDeltaObject.commandEvidence,
    evidenceHash: projectedDeltaObject.evidenceHash
  });
  const resultProjection = Object.freeze({
    ...projectedResult,
    object: objectProjection
  });
  const result = decodeStructuralResult(canonicalAdaptiveJson(resultProjection));
  if (result.status === "Rejected") {
    throw new RangeError("Prepared Structural Fire delta did not reconstruct an accepted result.");
  }
  for (const key of result.changedBrickKeys.map(serializeAdaptiveKey)) {
    if (!changedKeySet.has(key)) {
      throw new RangeError("Prepared Structural Fire delta changed-key receipt is invalid.");
    }
  }
  return result;
};

export const decodePreparedStructuralFireInput = (
  job: Readonly<PreparedStructuralFireJob>,
  source: TransferableBufferBundle
): DecodedPreparedStructuralFireInput => {
  const bundle = validatePreparedStructuralFireInput(job, source);
  const names = bundle.views.map((view) => view.name);
  const exactViews = bundle.views.every((view, index) =>
    view.bufferIndex === index
    && view.kind === "Uint8Array"
    && view.byteOffset === 0
    && view.elementCount === bundle.buffers[index]?.byteLength);
  if (!exactViews) throw new RangeError("Prepared Structural Fire input views are not exact.");
  if (names.length === 2
    && names[0] === PREPARED_STRUCTURAL_FIRE_SEED_VIEW
    && names[1] === PREPARED_STRUCTURAL_FIRE_COMMAND_VIEW) {
    const object = decodeStructuralObject(decodedText(bundle.buffers[0]));
    const command = validateStructuralDestructionCommand(
      JSON.parse(decodedText(bundle.buffers[1])) as unknown
    );
    if (object.objectId !== job.objectId
      || object.objectRevision !== job.expectedObjectRevision
      || object.editRevision !== job.expectedEditRevision
      || object.contentHash !== job.contentHash) {
      throw new RangeError("Prepared Structural Fire seed identity does not match its job.");
    }
    return Object.freeze({ kind: "Seed", object, command });
  }
  if (names.length === 1 && names[0] === PREPARED_STRUCTURAL_FIRE_COMMAND_VIEW) {
    return Object.freeze({
      kind: "Command",
      command: validateStructuralDestructionCommand(
        JSON.parse(decodedText(bundle.buffers[0])) as unknown
      )
    });
  }
  if (names.length === 2
    && names[0] === PREPARED_STRUCTURAL_FIRE_ADOPTION_VIEW
    && names[1] === PREPARED_STRUCTURAL_FIRE_COMMAND_VIEW) {
    return Object.freeze({
      kind: "AdoptedCommand",
      adoption: parseAdoption(decodedText(bundle.buffers[0])),
      command: validateStructuralDestructionCommand(
        JSON.parse(decodedText(bundle.buffers[1])) as unknown
      )
    });
  }
  if (names.length === 1 && names[0] === PREPARED_STRUCTURAL_FIRE_CONTINUATION_VIEW) {
    return Object.freeze({
      kind: "Continuation",
      facts: parseContinuation(decodedText(bundle.buffers[0]))
    });
  }
  throw new RangeError("Prepared Structural Fire input layout is invalid.");
};

export const preparedStructuralFirePayloadDescriptor = (
  bundleValue: TransferableBufferBundle
): PreparedStructuralFireJob["payload"] => {
  const bundle = validateTransferableBundle(bundleValue);
  return Object.freeze({
    ownership: "CallerToSchedulerToWorker" as const,
    layoutVersion: "prepared-structural-fire-input-v1" as const,
    byteLength: bundle.byteLength,
    bufferCount: bundle.buffers.length,
    contentHash: bundle.contentHash ?? fnv1aBytes(bundle.buffers),
    inputCommitmentHash: preparedStructuralFireInputCommitmentHash(bundle)
  });
};

export const encodePreparedStructuralFireWorkerOutput = (
  consumedValue: TransferableBufferBundle,
  resultValue: TransferableBufferBundle
): TransferableBufferBundle => {
  const consumed = validateTransferableBundle(consumedValue);
  const result = validateTransferableBundle(resultValue);
  if (result.ownership !== "WorkerToConsumer"
    || result.buffers.length > 1
    || result.views.length !== result.buffers.length
    || (result.views.length === 1
      && (result.views[0].name !== PREPARED_STRUCTURAL_FIRE_RESULT_VIEW
        || result.views[0].bufferIndex !== 0
        || result.views[0].kind !== "Uint8Array"
        || result.views[0].byteOffset !== 0
        || result.views[0].elementCount !== result.buffers[0].byteLength))) {
    throw new RangeError("Prepared Structural Fire logical result bundle is invalid.");
  }
  const buffers = Object.freeze([...consumed.buffers, ...result.buffers]);
  const views = Object.freeze([
    ...consumed.views.map((view) => Object.freeze({
      ...view,
      name: `${CONSUMED_VIEW_PREFIX}${view.name}`
    })),
    ...result.views.map((view) => Object.freeze({
      ...view,
      bufferIndex: view.bufferIndex + consumed.buffers.length
    }))
  ]);
  return validateTransferableBundle(Object.freeze({
    ownership: "WorkerToConsumer" as const,
    revision: result.revision,
    byteLength: byteCount(buffers.reduce((sum, buffer) => sum + buffer.byteLength, 0)),
    buffers,
    views,
    contentHash: fnv1aBytes(buffers)
  }));
};

export const createPreparedStructuralFireResultBundle = (
  resultRevision: number,
  resultBytesValue: Uint8Array
): TransferableBufferBundle => {
  const resultBuffer = new ArrayBuffer(resultBytesValue.byteLength);
  new Uint8Array(resultBuffer).set(resultBytesValue);
  const buffers = resultBuffer.byteLength === 0
    ? Object.freeze([] as ArrayBuffer[])
    : Object.freeze([resultBuffer]);
  const views = resultBuffer.byteLength === 0
    ? Object.freeze([] as TypedArrayViewDescriptor[])
    : Object.freeze([exactUint8View(
        PREPARED_STRUCTURAL_FIRE_RESULT_VIEW,
        0,
        resultBuffer.byteLength
      )]);
  return validateTransferableBundle(Object.freeze({
    ownership: "WorkerToConsumer" as const,
    revision: contentRevision(resultRevision),
    byteLength: byteCount(resultBuffer.byteLength),
    buffers,
    views,
    contentHash: fnv1aBytes(buffers)
  }));
};

export const decodePreparedStructuralFireWorkerOutput = (
  job: Readonly<PreparedStructuralFireJob>,
  source: TransferableBufferBundle
): DecodedPreparedStructuralFireWorkerOutput => {
  const bundle = validateTransferableBundle(source);
  const inputBufferCount = job.payload.bufferCount;
  if ((bundle.buffers.length !== inputBufferCount
      && bundle.buffers.length !== inputBufferCount + 1)
    || bundle.views.length < job.payload.bufferCount) {
    throw new RangeError("Prepared Structural Fire worker output layout is incomplete.");
  }
  const consumedBuffers = Object.freeze(bundle.buffers.slice(0, inputBufferCount));
  const consumedViews = Object.freeze(bundle.views.slice(0, job.payload.bufferCount).map((view) => {
    if (!view.name.startsWith(CONSUMED_VIEW_PREFIX)) {
      throw new RangeError("Prepared Structural Fire consumed-input view is invalid.");
    }
    return Object.freeze({
      ...view,
      name: view.name.slice(CONSUMED_VIEW_PREFIX.length)
    });
  }));
  const consumedInput = validateTransferableBundle(Object.freeze({
    ownership: "SenderToWorker" as const,
    revision: contentRevision(job.expectedEditRevision),
    byteLength: byteCount(consumedBuffers.reduce((sum, buffer) => sum + buffer.byteLength, 0)),
    buffers: consumedBuffers,
    views: consumedViews,
    contentHash: fnv1aBytes(consumedBuffers)
  }));
  validatePreparedStructuralFireInput(job, consumedInput);
  const resultBuffer = bundle.buffers[inputBufferCount];
  const resultView = bundle.views[job.payload.bufferCount];
  if ((resultBuffer === undefined) !== (resultView === undefined)
    || (resultBuffer !== undefined
      && (resultView?.name !== PREPARED_STRUCTURAL_FIRE_RESULT_VIEW
        || resultView.bufferIndex !== inputBufferCount
        || resultView.kind !== "Uint8Array"
        || resultView.byteOffset !== 0
        || resultView.elementCount !== resultBuffer.byteLength
        || bundle.views.length !== job.payload.bufferCount + 1))) {
    throw new RangeError("Prepared Structural Fire result view is invalid.");
  }
  const resultBytes = resultBuffer === undefined
    ? new Uint8Array(0)
    : new Uint8Array(resultBuffer);
  const resultBundle = createPreparedStructuralFireResultBundle(
    bundle.revision,
    resultBytes
  );
  return Object.freeze({
    consumedInput,
    resultBundle,
    resultBytes
  });
};

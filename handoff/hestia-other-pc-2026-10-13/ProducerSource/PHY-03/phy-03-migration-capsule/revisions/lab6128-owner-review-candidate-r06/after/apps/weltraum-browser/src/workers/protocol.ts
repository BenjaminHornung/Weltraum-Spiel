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
import {
  HESTIA_EDIT_REVISION_V1,
  HESTIA_GENERATOR_VERSION_V1,
  HESTIA_PRESET_ID,
  HESTIA_SOURCE_REVISION_V1,
  assertHestiaGenerationInput,
  type HestiaGenerationInput,
} from "../world-generation/hestia";
import {
  HESTIA_MATERIAL_REGISTRY_VERSION_V1,
  VOXEL_BRICK_APRON_WIDTH,
  VOXEL_BRICK_CELL_DIMENSIONS,
  VOXEL_BRICK_INDEX_ORDER,
  VOXEL_BRICK_LAYOUT_VERSION,
  VOXEL_BRICK_SAMPLE_COUNT,
  VOXEL_BRICK_SAMPLE_DIMENSIONS,
  VOXEL_BRICK_SCHEMA_VERSION,
  VOXEL_CHANNEL_BYTES,
  VOXEL_DENSITY_BYTES,
  VOXEL_MATERIAL_BYTES,
  VOXEL_MESH_ALGORITHM_VERSION,
  VOXEL_MESH_SCHEMA_VERSION,
  calculateVoxelMeshRepresentationKey,
  editRevision,
  generatorVersion,
  isStrictVoxelInteger,
  materialRegistryVersion,
  sourceRevision,
  surfaceFrameId,
  validateVoxelBrick,
  validateVoxelMeshProduct,
  voxelBodyId,
  voxelContentHash,
  voxelMeshRepresentationKey,
  voxelRegionId,
  type VoxelBrick,
  type VoxelCoordinate,
  type VoxelMaterialId,
  type VoxelMaterialKey,
  type VoxelMeshBounds,
  type VoxelMeshMaterialRange,
  type VoxelMeshProduct,
} from "../voxel";

export const JOB_PRIORITIES = ["Urgent", "High", "Normal"] as const;
export type JobPriority = (typeof JOB_PRIORITIES)[number];
export type TransferOwnership = "SenderToWorker" | "WorkerToConsumer";
export const GENERATE_HESTIA_VOXEL_BRICK_MESH_JOB_KIND = "GenerateHestiaVoxelBrickMesh" as const;
export const HESTIA_VOXEL_INPUT_LAYOUT_VERSION = "hestia-voxel-brick-input-v1" as const;
export const HESTIA_VOXEL_OUTPUT_LAYOUT_VERSION = "hestia-voxel-brick-mesh-transfer-v1" as const;
export const MAX_HESTIA_VOXEL_WORKER_OUTPUT_BYTES = 16 * 1024 * 1024;

export const validateHestiaVoxelWorkerOutputByteLength = (value: number): ByteCount => {
  const outputBytes = byteCount(value, "Hestia output byte length");
  if (outputBytes > MAX_HESTIA_VOXEL_WORKER_OUTPUT_BYTES) {
    throw new RangeError("Hestia output exceeds the 16 MiB chunk budget.");
  }
  return outputBytes;
};
export const MAX_HESTIA_GENERATION_COLUMNS_PER_SLICE = VOXEL_BRICK_SAMPLE_DIMENSIONS.x;
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

export type HestiaVoxelInputMode = "Generate" | "CachedCanonicalBrick";

export interface GenerateHestiaVoxelBrickMeshPayload extends HestiaGenerationInput {
  readonly presetId: typeof HESTIA_PRESET_ID;
  readonly inputMode: HestiaVoxelInputMode;
  readonly generatorVersion: typeof HESTIA_GENERATOR_VERSION_V1;
  readonly materialRegistryVersion: typeof HESTIA_MATERIAL_REGISTRY_VERSION_V1;
  readonly sourceRevision: typeof HESTIA_SOURCE_REVISION_V1;
  readonly editRevision: typeof HESTIA_EDIT_REVISION_V1;
  readonly meshAlgorithmVersion: typeof VOXEL_MESH_ALGORITHM_VERSION;
  readonly outputRevision: ContentRevision;
  readonly generationColumnsPerSlice: number;
  readonly cachedBrickContentHash?: VoxelBrick["contentHash"];
}

export interface HestiaVoxelBrickMeshResultDetails {
  readonly kind: typeof GENERATE_HESTIA_VOXEL_BRICK_MESH_JOB_KIND;
  readonly layoutVersion: typeof HESTIA_VOXEL_OUTPUT_LAYOUT_VERSION;
  readonly presetId: typeof HESTIA_PRESET_ID;
  readonly inputMode: HestiaVoxelInputMode;
  readonly rootSeed: string;
  readonly bodyId: VoxelBrick["bodyId"];
  readonly surfaceFrameId: VoxelBrick["surfaceFrameId"];
  readonly regionId: VoxelBrick["regionId"];
  readonly brickCoordinate: Readonly<VoxelCoordinate>;
  readonly voxelSizeMeters: HestiaGenerationInput["voxelSizeMeters"];
  readonly generatorVersion: VoxelBrick["generatorVersion"];
  readonly materialRegistryVersion: VoxelBrick["materialRegistryVersion"];
  readonly sourceRevision: VoxelBrick["sourceRevision"];
  readonly editRevision: VoxelBrick["editRevision"];
  readonly meshAlgorithmVersion: VoxelMeshProduct["algorithmVersion"];
  readonly representationKey: VoxelMeshProduct["representationKey"];
  readonly brickContentHash: VoxelBrick["contentHash"];
  readonly meshContentHash: VoxelMeshProduct["contentHash"];
  readonly indexKind: "Uint16Array" | "Uint32Array";
  readonly materialRanges: readonly VoxelMeshMaterialRange[];
  readonly bounds: VoxelMeshBounds;
  readonly generationMilliseconds: number;
  readonly meshingMilliseconds: number;
}

export interface WorkerJobRequest<Payload = unknown> {
  readonly jobId: WorkerJobId;
  readonly jobKind: WorkerJobKind;
  readonly targetKey: WorkerTargetKey;
  readonly planningEpoch: PlanningEpoch;
  readonly workerEpoch: WorkerEpoch;
  readonly inputRevision: ContentRevision;
  readonly sourceInputDigest?: string;
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
  readonly sourceInputDigest?: string;
  readonly outputRevision: ContentRevision;
  readonly algorithmVersion: AlgorithmVersion;
  readonly outputBytes: ByteCount;
  readonly contentHash?: string;
  readonly details?: HestiaVoxelBrickMeshResultDetails;
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
  ...(source.sourceInputDigest === undefined ? {} : { sourceInputDigest: stableAsciiId<string>(source.sourceInputDigest, "sourceInputDigest", 128) }),
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
    const byteOffset = view.byteOffset;
    const elementCount = view.elementCount;
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
  const xorMask = record.xorMask;
  const chunkBytes = record.chunkBytes;
  const outputRevision = record.outputRevision;
  if (typeof xorMask !== "number" || !Number.isInteger(xorMask) || xorMask < 0 || xorMask > 255) throw new RangeError("xorMask must be an unsigned byte.");
  if (typeof chunkBytes !== "number" || !Number.isSafeInteger(chunkBytes) || chunkBytes <= 0) throw new RangeError("chunkBytes must be a positive safe integer.");
  if (typeof outputRevision !== "number") throw new RangeError("outputRevision must be a non-negative safe integer.");
  return Object.freeze({ xorMask, chunkBytes, outputRevision: contentRevision(outputRevision, "outputRevision") });
};

const requireRecord = (value: unknown, name: string): Record<string, unknown> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new RangeError(`${name} must be an object.`);
  return value as Record<string, unknown>;
};

const parseCoordinate = (value: unknown, name: string): Readonly<VoxelCoordinate> => {
  const record = requireRecord(value, name);
  for (const axis of ["x", "y", "z"] as const) {
    if (!isStrictVoxelInteger(record[axis])) throw new RangeError(`${name}.${axis} must be a safe integer.`);
  }
  return Object.freeze({ x: record.x as number, y: record.y as number, z: record.z as number });
};

export const validateHestiaVoxelBrickMeshPayload = (value: unknown): GenerateHestiaVoxelBrickMeshPayload => {
  const record = requireRecord(value, "GenerateHestiaVoxelBrickMesh payload");
  const input: HestiaGenerationInput = Object.freeze({
    rootSeed: record.rootSeed as string,
    bodyId: voxelBodyId(record.bodyId),
    surfaceFrameId: surfaceFrameId(record.surfaceFrameId),
    regionId: voxelRegionId(record.regionId),
    brickCoordinate: parseCoordinate(record.brickCoordinate, "brickCoordinate"),
    voxelSizeMeters: record.voxelSizeMeters as HestiaGenerationInput["voxelSizeMeters"],
  });
  assertHestiaGenerationInput(input);
  if (record.presetId !== HESTIA_PRESET_ID) throw new RangeError(`presetId must equal ${HESTIA_PRESET_ID}.`);
  if (record.inputMode !== "Generate" && record.inputMode !== "CachedCanonicalBrick") throw new RangeError("inputMode is invalid.");
  if (record.generatorVersion !== HESTIA_GENERATOR_VERSION_V1) throw new RangeError("generatorVersion is invalid.");
  if (record.materialRegistryVersion !== HESTIA_MATERIAL_REGISTRY_VERSION_V1) throw new RangeError("materialRegistryVersion is invalid.");
  if (record.sourceRevision !== HESTIA_SOURCE_REVISION_V1) throw new RangeError("sourceRevision is invalid.");
  if (record.editRevision !== HESTIA_EDIT_REVISION_V1) throw new RangeError("editRevision is invalid.");
  if (record.meshAlgorithmVersion !== VOXEL_MESH_ALGORITHM_VERSION) throw new RangeError("meshAlgorithmVersion is invalid.");
  if (typeof record.outputRevision !== "number") throw new RangeError("outputRevision is invalid.");
  if (!Number.isSafeInteger(record.generationColumnsPerSlice)
    || (record.generationColumnsPerSlice as number) <= 0
    || (record.generationColumnsPerSlice as number) > MAX_HESTIA_GENERATION_COLUMNS_PER_SLICE) {
    throw new RangeError(`generationColumnsPerSlice must be from 1 through ${MAX_HESTIA_GENERATION_COLUMNS_PER_SLICE}.`);
  }
  const cachedBrickContentHash = record.cachedBrickContentHash === undefined
    ? undefined
    : voxelContentHash(record.cachedBrickContentHash);
  if (record.inputMode === "CachedCanonicalBrick" && cachedBrickContentHash === undefined) {
    throw new RangeError("cachedBrickContentHash is required for cached canonical input.");
  }
  if (record.inputMode === "Generate" && cachedBrickContentHash !== undefined) {
    throw new RangeError("generated input cannot declare cachedBrickContentHash.");
  }
  return Object.freeze({
    ...input,
    presetId: HESTIA_PRESET_ID,
    inputMode: record.inputMode,
    generatorVersion: generatorVersion(record.generatorVersion) as typeof HESTIA_GENERATOR_VERSION_V1,
    materialRegistryVersion: materialRegistryVersion(record.materialRegistryVersion) as typeof HESTIA_MATERIAL_REGISTRY_VERSION_V1,
    sourceRevision: sourceRevision(record.sourceRevision) as typeof HESTIA_SOURCE_REVISION_V1,
    editRevision: editRevision(record.editRevision) as typeof HESTIA_EDIT_REVISION_V1,
    meshAlgorithmVersion: VOXEL_MESH_ALGORITHM_VERSION,
    outputRevision: contentRevision(record.outputRevision, "outputRevision"),
    generationColumnsPerSlice: record.generationColumnsPerSlice as number,
    ...(cachedBrickContentHash === undefined ? {} : { cachedBrickContentHash }),
  });
};

const exactView = (
  bundle: TransferableBufferBundle,
  index: number,
  name: string,
  kind: TypedArrayKind,
  elementCount: number,
): void => {
  const view = bundle.views[index];
  const buffer = bundle.buffers[index];
  if (view === undefined || buffer === undefined
    || view.name !== name || view.bufferIndex !== index || view.kind !== kind
    || view.byteOffset !== 0 || view.elementCount !== elementCount
    || elementCount * BYTES_PER_ELEMENT[kind] !== buffer.byteLength) {
    throw new RangeError(`${name} must be a separate exact ${kind} buffer.`);
  }
};

const transferredBrick = (
  payload: GenerateHestiaVoxelBrickMeshPayload,
  densityBuffer: Float32Array,
  materialBuffer: Uint8Array,
  contentHash: VoxelBrick["contentHash"],
): VoxelBrick => Object.freeze({
  schemaVersion: VOXEL_BRICK_SCHEMA_VERSION,
  layoutVersion: VOXEL_BRICK_LAYOUT_VERSION,
  indexOrder: VOXEL_BRICK_INDEX_ORDER,
  bodyId: payload.bodyId,
  surfaceFrameId: payload.surfaceFrameId,
  regionId: payload.regionId,
  brickCoordinate: payload.brickCoordinate,
  voxelSizeMeters: payload.voxelSizeMeters,
  cellDimensions: VOXEL_BRICK_CELL_DIMENSIONS,
  sampleDimensions: VOXEL_BRICK_SAMPLE_DIMENSIONS,
  apronWidth: VOXEL_BRICK_APRON_WIDTH,
  generatorVersion: payload.generatorVersion,
  materialRegistryVersion: payload.materialRegistryVersion,
  sourceRevision: payload.sourceRevision,
  editRevision: payload.editRevision,
  densityBuffer,
  materialBuffer,
  contentHash,
});

export interface ValidatedHestiaVoxelInput {
  readonly bundle: TransferableBufferBundle;
  readonly brick?: VoxelBrick;
}

export const validateHestiaVoxelInputBundle = (
  payloadValue: unknown,
  bundleValue: TransferableBufferBundle,
): ValidatedHestiaVoxelInput => {
  const payload = validateHestiaVoxelBrickMeshPayload(payloadValue);
  const bundle = validateTransferableBundle(bundleValue);
  if (bundle.ownership !== "SenderToWorker") throw new RangeError("Hestia input ownership must be SenderToWorker.");
  if (bundle.contentHash !== undefined && bundle.contentHash !== fnv1aBytes(bundle.buffers)) {
    throw new RangeError("Hestia input transfer hash is invalid.");
  }
  if (payload.inputMode === "Generate") {
    if (bundle.byteLength !== 0 || bundle.buffers.length !== 0 || bundle.views.length !== 0) {
      throw new RangeError("Generated Hestia input must use an empty transfer bundle.");
    }
    return Object.freeze({ bundle });
  }
  if (bundle.byteLength !== VOXEL_CHANNEL_BYTES || bundle.buffers.length !== 2 || bundle.views.length !== 2) {
    throw new RangeError("Cached Hestia input must contain exactly the canonical density and material buffers.");
  }
  exactView(bundle, 0, "density", "Float32Array", VOXEL_BRICK_SAMPLE_COUNT);
  exactView(bundle, 1, "material", "Uint8Array", VOXEL_BRICK_SAMPLE_COUNT);
  const brick = transferredBrick(
    payload,
    new Float32Array(bundle.buffers[0]),
    new Uint8Array(bundle.buffers[1]),
    payload.cachedBrickContentHash!,
  );
  const validation = validateVoxelBrick(brick);
  if (!validation.valid) throw new RangeError(`Cached Hestia VoxelBrick is invalid: ${validation.issues[0]?.message ?? "unknown error"}.`);
  return Object.freeze({ bundle, brick });
};

const parseFiniteDuration = (value: unknown, name: string): number => {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) throw new RangeError(`${name} must be finite and non-negative.`);
  return value;
};

const parseMaterialRanges = (value: unknown): readonly VoxelMeshMaterialRange[] => {
  if (!Array.isArray(value)) throw new RangeError("materialRanges must be an array.");
  return Object.freeze(value.map((entry, index) => {
    const record = requireRecord(entry, `materialRanges[${index}]`);
    if (!isStrictVoxelInteger(record.materialId) || !isStrictVoxelInteger(record.startIndex) || !isStrictVoxelInteger(record.indexCount)) {
      throw new RangeError(`materialRanges[${index}] has invalid integers.`);
    }
    if (typeof record.materialKey !== "string") throw new RangeError(`materialRanges[${index}].materialKey is invalid.`);
    return Object.freeze({
      materialId: record.materialId as VoxelMaterialId,
      materialKey: record.materialKey as VoxelMaterialKey,
      startIndex: record.startIndex as number,
      indexCount: record.indexCount as number,
    });
  }));
};

const parseBounds = (value: unknown): VoxelMeshBounds => {
  const record = requireRecord(value, "bounds");
  const coordinate = (candidate: unknown, name: string): Readonly<VoxelCoordinate> => {
    const values = requireRecord(candidate, name);
    for (const axis of ["x", "y", "z"] as const) {
      if (typeof values[axis] !== "number" || !Number.isFinite(values[axis])) throw new RangeError(`${name}.${axis} must be finite.`);
    }
    return Object.freeze({ x: values.x as number, y: values.y as number, z: values.z as number });
  };
  return Object.freeze({ min: coordinate(record.min, "bounds.min"), max: coordinate(record.max, "bounds.max") });
};

export const validateHestiaVoxelBrickMeshResultDetails = (value: unknown): HestiaVoxelBrickMeshResultDetails => {
  const record = requireRecord(value, "Hestia worker result details");
  if (record.kind !== GENERATE_HESTIA_VOXEL_BRICK_MESH_JOB_KIND) throw new RangeError("Hestia result kind is invalid.");
  if (record.layoutVersion !== HESTIA_VOXEL_OUTPUT_LAYOUT_VERSION) throw new RangeError("Hestia result layoutVersion is invalid.");
  if (record.presetId !== HESTIA_PRESET_ID) throw new RangeError("Hestia result presetId is invalid.");
  if (record.inputMode !== "Generate" && record.inputMode !== "CachedCanonicalBrick") throw new RangeError("Hestia result inputMode is invalid.");
  if (record.generatorVersion !== HESTIA_GENERATOR_VERSION_V1
    || record.materialRegistryVersion !== HESTIA_MATERIAL_REGISTRY_VERSION_V1
    || record.sourceRevision !== HESTIA_SOURCE_REVISION_V1
    || record.editRevision !== HESTIA_EDIT_REVISION_V1
    || record.meshAlgorithmVersion !== VOXEL_MESH_ALGORITHM_VERSION) {
    throw new RangeError("Hestia result version or revision is invalid.");
  }
  if (record.indexKind !== "Uint16Array" && record.indexKind !== "Uint32Array") throw new RangeError("Hestia result indexKind is invalid.");
  const input: HestiaGenerationInput = Object.freeze({
    rootSeed: record.rootSeed as string,
    bodyId: voxelBodyId(record.bodyId),
    surfaceFrameId: surfaceFrameId(record.surfaceFrameId),
    regionId: voxelRegionId(record.regionId),
    brickCoordinate: parseCoordinate(record.brickCoordinate, "brickCoordinate"),
    voxelSizeMeters: record.voxelSizeMeters as HestiaGenerationInput["voxelSizeMeters"],
  });
  assertHestiaGenerationInput(input);
  return Object.freeze({
    kind: GENERATE_HESTIA_VOXEL_BRICK_MESH_JOB_KIND,
    layoutVersion: HESTIA_VOXEL_OUTPUT_LAYOUT_VERSION,
    presetId: HESTIA_PRESET_ID,
    inputMode: record.inputMode,
    ...input,
    generatorVersion: generatorVersion(record.generatorVersion),
    materialRegistryVersion: materialRegistryVersion(record.materialRegistryVersion),
    sourceRevision: sourceRevision(record.sourceRevision),
    editRevision: editRevision(record.editRevision),
    meshAlgorithmVersion: VOXEL_MESH_ALGORITHM_VERSION,
    representationKey: voxelMeshRepresentationKey(record.representationKey),
    brickContentHash: voxelContentHash(record.brickContentHash),
    meshContentHash: voxelContentHash(record.meshContentHash),
    indexKind: record.indexKind,
    materialRanges: parseMaterialRanges(record.materialRanges),
    bounds: parseBounds(record.bounds),
    generationMilliseconds: parseFiniteDuration(record.generationMilliseconds, "generationMilliseconds"),
    meshingMilliseconds: parseFiniteDuration(record.meshingMilliseconds, "meshingMilliseconds"),
  });
};

export interface ValidatedHestiaVoxelWorkerOutput {
  readonly bundle: TransferableBufferBundle;
  readonly details: HestiaVoxelBrickMeshResultDetails;
  readonly brick: VoxelBrick;
  readonly mesh: VoxelMeshProduct;
}

export const validateHestiaVoxelWorkerOutput = (
  payloadValue: unknown,
  result: WorkerJobResult,
  bundleValue: TransferableBufferBundle,
): ValidatedHestiaVoxelWorkerOutput => {
  const payload = validateHestiaVoxelBrickMeshPayload(payloadValue);
  const details = validateHestiaVoxelBrickMeshResultDetails(result.details);
  const bundle = validateTransferableBundle(bundleValue);
  if (Number(result.inputRevision) !== Number(payload.sourceRevision) || result.outputRevision !== payload.outputRevision) {
    throw new RangeError("Hestia result revisions do not match the request payload.");
  }
  if (result.outputBytes !== bundle.byteLength) throw new RangeError("Hestia result byte length does not match its transfer bundle.");
  if (bundle.ownership !== "WorkerToConsumer") throw new RangeError("Hestia output ownership must be WorkerToConsumer.");
  validateHestiaVoxelWorkerOutputByteLength(bundle.byteLength);
  if (bundle.buffers.length !== 5 || bundle.views.length !== 5) throw new RangeError("Hestia output must contain exactly five separate buffers and views.");
  for (const buffer of bundle.buffers) {
    if (buffer.byteLength > MAX_HESTIA_VOXEL_WORKER_OUTPUT_BYTES) throw new RangeError("Hestia output contains an oversized transferable buffer.");
  }
  exactView(bundle, 0, "density", "Float32Array", VOXEL_BRICK_SAMPLE_COUNT);
  exactView(bundle, 1, "material", "Uint8Array", VOXEL_BRICK_SAMPLE_COUNT);
  const positionsCount = bundle.views[2]?.elementCount ?? -1;
  const normalsCount = bundle.views[3]?.elementCount ?? -1;
  const indexCount = bundle.views[4]?.elementCount ?? -1;
  exactView(bundle, 2, "positions", "Float32Array", positionsCount);
  exactView(bundle, 3, "normals", "Float32Array", normalsCount);
  exactView(bundle, 4, "indices", details.indexKind, indexCount);
  if (positionsCount < 0 || positionsCount % 3 !== 0 || normalsCount !== positionsCount || indexCount !== positionsCount / 3) {
    throw new RangeError("Hestia mesh transfer channel counts are inconsistent.");
  }
  const transferHash = fnv1aBytes(bundle.buffers);
  if (bundle.contentHash !== transferHash || result.contentHash !== transferHash) throw new RangeError("Hestia output transfer hash is invalid.");
  const identityMatches = details.presetId === payload.presetId
    && details.inputMode === payload.inputMode
    && details.rootSeed === payload.rootSeed
    && details.bodyId === payload.bodyId
    && details.surfaceFrameId === payload.surfaceFrameId
    && details.regionId === payload.regionId
    && details.brickCoordinate.x === payload.brickCoordinate.x
    && details.brickCoordinate.y === payload.brickCoordinate.y
    && details.brickCoordinate.z === payload.brickCoordinate.z
    && details.voxelSizeMeters === payload.voxelSizeMeters
    && details.generatorVersion === payload.generatorVersion
    && details.materialRegistryVersion === payload.materialRegistryVersion
    && details.sourceRevision === payload.sourceRevision
    && details.editRevision === payload.editRevision
    && details.meshAlgorithmVersion === payload.meshAlgorithmVersion;
  if (!identityMatches) throw new RangeError("Hestia output identity does not match the request.");
  if (payload.inputMode === "CachedCanonicalBrick" && details.brickContentHash !== payload.cachedBrickContentHash) {
    throw new RangeError("Hestia cached output brick content hash does not match the requested cached brick.");
  }
  const brick = transferredBrick(
    payload,
    new Float32Array(bundle.buffers[0]),
    new Uint8Array(bundle.buffers[1]),
    details.brickContentHash,
  );
  const brickValidation = validateVoxelBrick(brick);
  if (!brickValidation.valid) throw new RangeError(`Hestia output brick is invalid: ${brickValidation.issues[0]?.message ?? "unknown error"}.`);
  if (details.representationKey !== calculateVoxelMeshRepresentationKey(brick, details.meshAlgorithmVersion)) {
    throw new RangeError("Hestia representation key is invalid.");
  }
  const indices = details.indexKind === "Uint16Array" ? new Uint16Array(bundle.buffers[4]) : new Uint32Array(bundle.buffers[4]);
  const mesh: VoxelMeshProduct = Object.freeze({
    schemaVersion: VOXEL_MESH_SCHEMA_VERSION,
    representationKey: details.representationKey,
    sourceRevision: details.sourceRevision,
    artifactRevision: details.editRevision,
    algorithmVersion: details.meshAlgorithmVersion,
    frameId: details.surfaceFrameId,
    materialRegistryVersion: details.materialRegistryVersion,
    positions: new Float32Array(bundle.buffers[2]),
    normals: new Float32Array(bundle.buffers[3]),
    indices,
    materialRanges: details.materialRanges,
    bounds: details.bounds,
    contentHash: details.meshContentHash,
  });
  const origin = Object.freeze({
    x: Math.fround(payload.brickCoordinate.x * VOXEL_BRICK_CELL_DIMENSIONS.x * payload.voxelSizeMeters),
    y: Math.fround(payload.brickCoordinate.y * VOXEL_BRICK_CELL_DIMENSIONS.y * payload.voxelSizeMeters),
    z: Math.fround(payload.brickCoordinate.z * VOXEL_BRICK_CELL_DIMENSIONS.z * payload.voxelSizeMeters),
  });
  const meshValidation = validateVoxelMeshProduct(mesh, undefined, {
    expectedEmptyOrigin: origin,
    expectedRepresentationKey: details.representationKey,
    expectedSourceRevision: details.sourceRevision,
    expectedArtifactRevision: details.editRevision,
    expectedAlgorithmVersion: details.meshAlgorithmVersion,
    expectedFrameId: details.surfaceFrameId,
    expectedMaterialRegistryVersion: details.materialRegistryVersion,
  });
  if (!meshValidation.valid) throw new RangeError(`Hestia output mesh is invalid: ${meshValidation.issues[0]?.message ?? "unknown error"}.`);
  return Object.freeze({ bundle, details, brick, mesh });
};

export const expectedHestiaVoxelInputBytes = (payload: GenerateHestiaVoxelBrickMeshPayload): ByteCount =>
  byteCount(payload.inputMode === "Generate" ? 0 : VOXEL_DENSITY_BYTES + VOXEL_MATERIAL_BYTES, "expectedInputBytes");

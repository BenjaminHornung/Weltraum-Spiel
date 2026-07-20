import { createHestiaGenerationKey } from "../world-generation/hestia";
import {
  fnv1aBytes,
  validateHestiaVoxelBrickMeshPayload,
  validateHestiaVoxelInputBundle,
  validateHestiaVoxelWorkerOutput,
  type GenerateHestiaVoxelBrickMeshPayload,
  type TransferableBufferBundle,
} from "../workers/protocol";
import { isWorkerPoolAcceptedCompletedTerminal, type WorkerJobTerminal } from "../workers/workerPool";
import { byteCount, type AlgorithmVersion, type ContentRevision } from "../workers/ids";
import { VOXEL_BRICK_SAMPLE_COUNT, VOXEL_CHANNEL_BYTES, VOXEL_DENSITY_BYTES } from "../voxel";
import { computeContentHash } from "./canonical";
import { createContentKey, type ContentKey } from "./contentKey";
import { MemoryContentCache } from "./memoryContentCache";

export const HESTIA_VOXEL_CACHE_LAYOUT = "hestia-canonical-density-material-v1" as const;

const cacheIdentityHash = (payload: GenerateHestiaVoxelBrickMeshPayload): string => {
  const canonical = JSON.stringify({
    generation: createHestiaGenerationKey(payload),
    generatorVersion: payload.generatorVersion,
    materialRegistryVersion: payload.materialRegistryVersion,
    sourceRevision: payload.sourceRevision,
    editRevision: payload.editRevision,
  });
  const bytes = new TextEncoder().encode(canonical);
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  return computeContentHash(buffer);
};

export const createHestiaVoxelCacheKey = (
  payloadValue: unknown,
  algorithm: AlgorithmVersion,
): ContentKey => {
  const payload = validateHestiaVoxelBrickMeshPayload(payloadValue);
  return createContentKey({
    namespace: "voxel.brick",
    contentId: `hestia:${cacheIdentityHash(payload)}`,
    inputRevision: payload.sourceRevision,
    algorithmVersion: algorithm,
    outputRevision: payload.editRevision,
  });
};

const packCanonicalChannels = (density: Float32Array, material: Uint8Array): ArrayBuffer => {
  const packed = new ArrayBuffer(VOXEL_CHANNEL_BYTES);
  const view = new DataView(packed);
  for (let index = 0; index < density.length; index += 1) {
    view.setFloat32(index * Float32Array.BYTES_PER_ELEMENT, density[index], true);
  }
  new Uint8Array(packed, VOXEL_DENSITY_BYTES, material.length).set(material);
  return packed;
};

export const admitHestiaVoxelWorkerOutputToCache = (
  cache: MemoryContentCache,
  payloadValue: unknown,
  terminal: WorkerJobTerminal,
): ContentKey => {
  if (!isWorkerPoolAcceptedCompletedTerminal(terminal)) {
    throw new RangeError("Only a result accepted by the WorkerPool result gate may enter the Hestia cache.");
  }
  const payload = validateHestiaVoxelBrickMeshPayload(payloadValue);
  const validated = validateHestiaVoxelWorkerOutput(payload, terminal.result, terminal.output);
  const key = createHestiaVoxelCacheKey(payload, terminal.result.algorithmVersion);
  const packed = packCanonicalChannels(validated.brick.densityBuffer, validated.brick.materialBuffer);
  cache.put({
    key,
    buffer: packed,
    byteLength: packed.byteLength,
    contentHash: computeContentHash(packed),
    layout: HESTIA_VOXEL_CACHE_LAYOUT,
  });
  return key;
};

export const createCachedHestiaVoxelInputBundle = (
  cache: MemoryContentCache,
  key: ContentKey,
  payloadValue: unknown,
  revision: ContentRevision,
): TransferableBufferBundle | undefined => {
  const payload = validateHestiaVoxelBrickMeshPayload(payloadValue);
  if (payload.inputMode !== "CachedCanonicalBrick") throw new RangeError("Cached Hestia input requires CachedCanonicalBrick mode.");
  const lease = cache.get(key);
  if (lease === undefined) return undefined;
  try {
    if (lease.layout !== HESTIA_VOXEL_CACHE_LAYOUT || lease.byteLength !== VOXEL_CHANNEL_BYTES) {
      throw new RangeError("Cached Hestia channels have an invalid layout or byte length.");
    }
    const densityBuffer = new ArrayBuffer(VOXEL_DENSITY_BYTES);
    const density = new Float32Array(densityBuffer);
    const view = new DataView(lease.buffer);
    for (let index = 0; index < density.length; index += 1) {
      density[index] = view.getFloat32(index * Float32Array.BYTES_PER_ELEMENT, true);
    }
    const materialBuffer = new ArrayBuffer(VOXEL_BRICK_SAMPLE_COUNT);
    new Uint8Array(materialBuffer).set(new Uint8Array(lease.buffer, VOXEL_DENSITY_BYTES, VOXEL_BRICK_SAMPLE_COUNT));
    const buffers = Object.freeze([densityBuffer, materialBuffer]);
    const bundle: TransferableBufferBundle = Object.freeze({
      ownership: "SenderToWorker",
      revision,
      byteLength: byteCount(VOXEL_CHANNEL_BYTES, "cachedVoxelInputBytes"),
      buffers,
      views: Object.freeze([
        Object.freeze({ name: "density", bufferIndex: 0, kind: "Float32Array" as const, byteOffset: 0, elementCount: VOXEL_BRICK_SAMPLE_COUNT }),
        Object.freeze({ name: "material", bufferIndex: 1, kind: "Uint8Array" as const, byteOffset: 0, elementCount: VOXEL_BRICK_SAMPLE_COUNT }),
      ]),
      contentHash: fnv1aBytes(buffers),
    });
    return validateHestiaVoxelInputBundle(payload, bundle).bundle;
  } finally {
    lease.release();
  }
};

import { CHUNK_CELL_COUNT, HALO_CELL_COUNT, isWorldChunk } from "../domain/constants";
import { chunkKey } from "../domain/coordinates";
import type { GreedyChunkMesh, MeshMaterialRange } from "../domain/mesher";
import type { ChunkCoord, GeneratedChunk } from "../domain/types";

export type VoxelV2WorkerOperation = "Generate" | "Mesh";

interface WorkerRequestBase {
  readonly type: "RunVoxelV2Job";
  readonly jobId: number;
  readonly key: string;
  readonly coord: ChunkCoord;
  readonly requestedRevision: number;
}

export interface GenerateWorkerRequest extends WorkerRequestBase {
  readonly operation: "Generate";
  readonly seed: string;
  readonly worldVersion: string;
}

export interface MeshWorkerRequest extends WorkerRequestBase {
  readonly operation: "Mesh";
  readonly chunkAuthorityRevision: number;
  readonly cells: Uint8Array;
}

export type VoxelV2WorkerRequest = GenerateWorkerRequest | MeshWorkerRequest;

interface WorkerCompletedBase {
  readonly type: "VoxelV2JobCompleted";
  readonly jobId: number;
  readonly key: string;
  readonly coord: ChunkCoord;
  readonly requestedRevision: number;
  readonly workerDurationMs: number;
  readonly outputBytes: number;
}

export interface GenerateWorkerCompleted extends WorkerCompletedBase {
  readonly operation: "Generate";
  readonly generated: GeneratedChunk;
}

export interface MeshWorkerCompleted extends WorkerCompletedBase {
  readonly operation: "Mesh";
  readonly mesh: GreedyChunkMesh;
}

export interface VoxelV2WorkerFailed {
  readonly type: "VoxelV2JobFailed";
  readonly jobId: number;
  readonly operation: VoxelV2WorkerOperation;
  readonly key: string;
  readonly coord: ChunkCoord;
  readonly requestedRevision: number;
  readonly message: string;
}

export type VoxelV2WorkerCompleted = GenerateWorkerCompleted | MeshWorkerCompleted;
export type VoxelV2WorkerResponse = VoxelV2WorkerCompleted | VoxelV2WorkerFailed;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const validCoord = (value: unknown): value is ChunkCoord => {
  if (!isRecord(value)) return false;
  const { x, y, z } = value;
  return Number.isInteger(x) && Number.isInteger(y) && Number.isInteger(z)
    && isWorldChunk(x as number, y as number, z as number);
};

const validBase = (value: Record<string, unknown>): boolean =>
  value.type === "RunVoxelV2Job"
  && Number.isSafeInteger(value.jobId) && (value.jobId as number) > 0
  && typeof value.key === "string"
  && validCoord(value.coord)
  && value.key === chunkKey(value.coord)
  && Number.isSafeInteger(value.requestedRevision) && (value.requestedRevision as number) >= 0;

export const assertVoxelV2WorkerRequest = (value: unknown): VoxelV2WorkerRequest => {
  if (!isRecord(value) || !validBase(value)) throw new Error("Invalid V2 worker request metadata.");
  if (value.operation === "Generate") {
    if (typeof value.seed !== "string" || value.seed.trim().length === 0
      || typeof value.worldVersion !== "string" || value.worldVersion.trim().length === 0) {
      throw new Error("Invalid V2 generation request.");
    }
    return value as unknown as GenerateWorkerRequest;
  }
  if (value.operation === "Mesh") {
    if (!Number.isSafeInteger(value.chunkAuthorityRevision) || (value.chunkAuthorityRevision as number) < 0
      || !(value.cells instanceof Uint8Array) || value.cells.length !== HALO_CELL_COUNT
      || !(value.cells.buffer instanceof ArrayBuffer)
      || value.cells.byteOffset !== 0
      || value.cells.byteLength !== value.cells.buffer.byteLength) {
      throw new Error("Invalid V2 meshing request.");
    }
    return value as unknown as MeshWorkerRequest;
  }
  throw new Error("Unknown V2 worker operation.");
};

const validCompletedBase = (value: Record<string, unknown>): boolean =>
  value.type === "VoxelV2JobCompleted"
  && Number.isSafeInteger(value.jobId) && (value.jobId as number) > 0
  && typeof value.key === "string"
  && validCoord(value.coord)
  && value.key === chunkKey(value.coord)
  && Number.isSafeInteger(value.requestedRevision) && (value.requestedRevision as number) >= 0
  && Number.isFinite(value.workerDurationMs) && (value.workerDurationMs as number) >= 0
  && Number.isSafeInteger(value.outputBytes) && (value.outputBytes as number) >= 0;

const validRanges = (value: unknown, indexLength: number): value is readonly MeshMaterialRange[] => {
  if (!Array.isArray(value)) return false;
  let nextIndex = 0;
  for (const range of value) {
    if (!isRecord(range)
      || !Number.isInteger(range.materialId) || (range.materialId as number) <= 0
      || (range.materialId as number) >= 12
      || !Number.isSafeInteger(range.indexStart) || range.indexStart !== nextIndex
      || !Number.isSafeInteger(range.indexCount) || (range.indexCount as number) <= 0
      || (range.indexCount as number) % 3 !== 0) return false;
    nextIndex += range.indexCount as number;
  }
  return nextIndex === indexLength;
};

const validMesh = (value: unknown, key: string, requestedRevision: number, outputBytes: number): value is GreedyChunkMesh => {
  if (!isRecord(value) || value.key !== key || !validCoord(value.coord) || chunkKey(value.coord) !== key
    || value.requestedRevision !== requestedRevision
    || !Number.isSafeInteger(value.chunkAuthorityRevision) || (value.chunkAuthorityRevision as number) < 0
    || !(value.positions instanceof Float32Array) || value.positions.length % 3 !== 0
    || !(value.normals instanceof Float32Array) || value.normals.length !== value.positions.length
    || !(value.indices instanceof Uint32Array) || value.indices.length % 3 !== 0
    || !(value.materialIds instanceof Uint8Array) || value.materialIds.length !== value.positions.length / 3
    || !(value.ao instanceof Uint8Array) || value.ao.length !== value.positions.length / 3
    || !Number.isSafeInteger(value.quadCount) || (value.quadCount as number) < 0
    || !Number.isSafeInteger(value.triangleCount) || value.triangleCount !== value.indices.length / 3
    || !Number.isSafeInteger(value.vertexCount) || value.vertexCount !== value.positions.length / 3
    || !Number.isSafeInteger(value.byteLength) || value.byteLength !== outputBytes
    || !validRanges(value.materialRanges, value.indices.length)) return false;
  const actualBytes = value.positions.byteLength + value.normals.byteLength + value.indices.byteLength
    + value.materialIds.byteLength + value.ao.byteLength;
  if (actualBytes !== outputBytes) return false;
  const quadCount = value.quadCount as number;
  if (quadCount * 6 !== value.indices.length || quadCount * 4 !== value.positions.length / 3) return false;
  for (let index = 0; index < value.positions.length; index += 1) {
    if (!Number.isFinite(value.positions[index]!)) return false;
  }
  for (const material of value.materialIds) {
    if (material <= 0 || material >= 12) return false;
  }
  for (const valueOfAo of value.ao) {
    if (valueOfAo > 3) return false;
  }
  for (let index = 0; index < value.normals.length; index += 3) {
    const x = value.normals[index]!;
    const y = value.normals[index + 1]!;
    const z = value.normals[index + 2]!;
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)
      || Math.abs(x) + Math.abs(y) + Math.abs(z) !== 1
      || (x !== 0 && x !== 1 && x !== -1)
      || (y !== 0 && y !== 1 && y !== -1)
      || (z !== 0 && z !== 1 && z !== -1)) return false;
  }
  for (const index of value.indices) if (index >= value.vertexCount) return false;
  return true;
};

export const assertVoxelV2WorkerResponse = (value: unknown): VoxelV2WorkerResponse => {
  if (!isRecord(value)) throw new Error("Invalid V2 worker response.");
  if (value.type === "VoxelV2JobFailed") {
    if (!Number.isSafeInteger(value.jobId) || (value.jobId as number) <= 0
      || (value.operation !== "Generate" && value.operation !== "Mesh")
      || typeof value.key !== "string" || !validCoord(value.coord) || value.key !== chunkKey(value.coord)
      || !Number.isSafeInteger(value.requestedRevision) || (value.requestedRevision as number) < 0
      || typeof value.message !== "string" || value.message.length === 0) {
      throw new Error("Invalid V2 worker failure response.");
    }
    return value as unknown as VoxelV2WorkerFailed;
  }
  if (!validCompletedBase(value)) throw new Error("Invalid V2 worker completion metadata.");
  if (value.operation === "Generate") {
    const generated = value.generated;
    if (!isRecord(generated) || !validCoord(generated.coord) || chunkKey(generated.coord) !== value.key
      || !Number.isSafeInteger(generated.sourceRevision) || (generated.sourceRevision as number) < 0
      || !(generated.cells instanceof Uint8Array) || generated.cells.length !== CHUNK_CELL_COUNT
      || generated.cells.byteLength !== value.outputBytes) {
      throw new Error("Invalid V2 worker generation output.");
    }
    return value as unknown as GenerateWorkerCompleted;
  }
  if (value.operation === "Mesh" && validMesh(value.mesh, value.key as string, value.requestedRevision as number, value.outputBytes as number)) {
    return value as unknown as MeshWorkerCompleted;
  }
  throw new Error("Invalid V2 worker completion output.");
};

export const workerRequestTransferList = (request: VoxelV2WorkerRequest): Transferable[] =>
  request.operation === "Mesh" ? [request.cells.buffer as ArrayBuffer] : [];

export const workerResponseTransferList = (response: VoxelV2WorkerResponse): Transferable[] => {
  if (response.type === "VoxelV2JobFailed") return [];
  if (response.operation === "Generate") return [response.generated.cells.buffer as ArrayBuffer];
  return [
    response.mesh.positions.buffer as ArrayBuffer,
    response.mesh.normals.buffer as ArrayBuffer,
    response.mesh.indices.buffer as ArrayBuffer,
    response.mesh.materialIds.buffer as ArrayBuffer,
    response.mesh.ao.buffer as ArrayBuffer
  ];
};

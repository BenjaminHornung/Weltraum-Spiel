import { generateHestiaChunk } from "../domain/generator";
import { meshGreedyChunk } from "../domain/mesher";
import type { HaloSnapshot } from "../domain/types";
import {
  assertVoxelV2WorkerRequest,
  type VoxelV2WorkerRequest,
  type VoxelV2WorkerResponse
} from "./protocol";

export const executeVoxelV2WorkerRequest = (
  value: unknown,
  now: () => number = () => performance.now()
): VoxelV2WorkerResponse => {
  const request: VoxelV2WorkerRequest = assertVoxelV2WorkerRequest(value);
  const startedAt = now();
  try {
    if (request.operation === "Generate") {
      const generated = generateHestiaChunk({
        coord: request.coord,
        seed: request.seed,
        worldVersion: request.worldVersion
      });
      return {
        type: "VoxelV2JobCompleted",
        operation: "Generate",
        jobId: request.jobId,
        key: request.key,
        coord: { ...request.coord },
        requestedRevision: request.requestedRevision,
        workerDurationMs: Math.max(0, now() - startedAt),
        outputBytes: generated.cells.byteLength,
        generated
      };
    }

    const snapshot: HaloSnapshot = {
      key: request.key,
      coord: { ...request.coord },
      requestedRevision: request.requestedRevision,
      chunkAuthorityRevision: request.chunkAuthorityRevision,
      cells: request.cells
    };
    const mesh = meshGreedyChunk(snapshot);
    return {
      type: "VoxelV2JobCompleted",
      operation: "Mesh",
      jobId: request.jobId,
      key: request.key,
      coord: { ...request.coord },
      requestedRevision: request.requestedRevision,
      workerDurationMs: Math.max(0, now() - startedAt),
      outputBytes: mesh.byteLength,
      mesh
    };
  } catch (error) {
    return {
      type: "VoxelV2JobFailed",
      operation: request.operation,
      jobId: request.jobId,
      key: request.key,
      coord: { ...request.coord },
      requestedRevision: request.requestedRevision,
      message: error instanceof Error ? error.message : "V2 worker job failed."
    };
  }
};

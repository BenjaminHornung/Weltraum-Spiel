import { describe, expect, it } from "vitest";
import type { GreedyChunkMesh } from "../../src/voxel-v2/domain/mesher";
import { VoxelMaterial } from "../../src/voxel-v2/domain/palette";
import {
  combineVoxelV2Region,
  shouldRenderVoxelV2NearRegion,
  shouldAdoptVoxelV2Chunk,
  voxelV2RegionKey
} from "../../src/voxel-v2/render-three/voxelV2Renderer";

const mesh = (
  key: string,
  coord: GreedyChunkMesh["coord"],
  materialId: number,
  ao: readonly [number, number, number],
  requestedRevision = 1,
  chunkAuthorityRevision = requestedRevision,
  empty = false
): GreedyChunkMesh => ({
  key,
  coord,
  requestedRevision,
  chunkAuthorityRevision,
  positions: empty ? new Float32Array() : new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
  normals: empty ? new Float32Array() : new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
  indices: empty ? new Uint32Array() : new Uint32Array([0, 1, 2]),
  materialIds: empty ? new Uint8Array() : new Uint8Array([materialId, materialId, materialId]),
  ao: empty ? new Uint8Array() : new Uint8Array(ao),
  materialRanges: empty ? [] : [{ materialId, indexStart: 0, indexCount: 3 }],
  quadCount: empty ? 0 : 1,
  triangleCount: empty ? 0 : 1,
  vertexCount: empty ? 0 : 3,
  byteLength: 0
});

describe("Voxel V2 bounded region batches", () => {
  it("uses mathematical floor for negative region coordinates", () => {
    expect(voxelV2RegionKey({ x: -1, y: 0, z: -2 })).toBe("-1,0,-1");
    expect(voxelV2RegionKey({ x: -2, y: 3, z: -3 })).toBe("-1,1,-2");
    expect(voxelV2RegionKey({ x: 1, y: 1, z: 1 })).toBe("0,0,0");
  });

  it("combines local vertices with bounded chunk offsets and rebases indices", () => {
    const first = mesh("0,0,0", { x: 0, y: 0, z: 0 }, VoxelMaterial.Sand, [3, 2, 1]);
    const second = mesh("1,0,0", { x: 1, y: 0, z: 0 }, VoxelMaterial.WetBoundary, [0, 1, 2]);
    const combined = combineVoxelV2Region([second, first]);

    expect(combined.regionKey).toBe("0,0,0");
    expect(combined.origin).toEqual({ x: 0, y: 0, z: 0 });
    expect(Array.from(combined.positions)).toEqual([
      0, 0, 0, 1, 0, 0, 0, 1, 0,
      8, 0, 0, 9, 0, 0, 8, 1, 0
    ]);
    expect(Array.from(combined.indices)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(Array.from(combined.materialIds)).toEqual([
      VoxelMaterial.Sand, VoxelMaterial.Sand, VoxelMaterial.Sand,
      VoxelMaterial.WetBoundary, VoxelMaterial.WetBoundary, VoxelMaterial.WetBoundary
    ]);
    expect(Array.from(combined.ao)).toEqual([3, 2, 1, 0, 1, 2]);
    expect(Array.from(combined.tint)).toEqual([
      149, 130, 66, 149, 130, 66, 149, 130, 66,
      17, 54, 48, 17, 54, 48, 17, 54, 48
    ]);
    expect(combined.roughness[0]).toBeCloseTo(0.96);
    expect(combined.roughness[3]).toBeCloseTo(0.7);
    expect(Array.from(combined.wetness)).toEqual([0, 0, 0, 1, 1, 1]);
    expect(combined.vertexCount).toBe(6);
    expect(combined.triangleCount).toBe(2);
  });

  it("orders adoption by authority first and requested revision second", () => {
    const current = { authorityRevision: 4, requestedRevision: 8 };

    expect(shouldAdoptVoxelV2Chunk(undefined, mesh("candidate", { x: 0, y: 0, z: 0 }, VoxelMaterial.Sand, [0, 0, 0], 1, 1))).toBe(true);
    expect(shouldAdoptVoxelV2Chunk(current, mesh("candidate", { x: 0, y: 0, z: 0 }, VoxelMaterial.Sand, [0, 0, 0], 7, 4))).toBe(false);
    expect(shouldAdoptVoxelV2Chunk(current, mesh("candidate", { x: 0, y: 0, z: 0 }, VoxelMaterial.Sand, [0, 0, 0], 8, 3))).toBe(false);
    expect(shouldAdoptVoxelV2Chunk(current, mesh("candidate", { x: 0, y: 0, z: 0 }, VoxelMaterial.Sand, [0, 0, 0], 8, 4))).toBe(true);
    expect(shouldAdoptVoxelV2Chunk(current, mesh("candidate", { x: 0, y: 0, z: 0 }, VoxelMaterial.Sand, [0, 0, 0], 7, 5))).toBe(true);
  });

  it("keeps an accepted empty mesh revision as a non-visible watermark", () => {
    const empty = mesh("candidate", { x: 0, y: 0, z: 0 }, VoxelMaterial.Sand, [0, 0, 0], 9, 9, true);
    let watermark: { readonly authorityRevision: number; readonly requestedRevision: number } | undefined;
    const adopt = (candidate: GreedyChunkMesh): boolean => {
      if (!shouldAdoptVoxelV2Chunk(watermark, candidate)) return false;
      watermark = {
        authorityRevision: candidate.chunkAuthorityRevision,
        requestedRevision: candidate.requestedRevision
      };
      return true;
    };

    expect(empty.vertexCount).toBe(0);
    expect(adopt(empty)).toBe(true);
    expect(adopt(mesh("candidate", { x: 0, y: 0, z: 0 }, VoxelMaterial.Sand, [0, 0, 0], 8, 8))).toBe(false);
    expect(adopt(mesh("candidate", { x: 0, y: 0, z: 0 }, VoxelMaterial.Sand, [0, 0, 0], 9, 9))).toBe(true);
  });

  it("keeps an empty region batch empty", () => {
    const combined = combineVoxelV2Region([]);

    expect(combined.positions).toHaveLength(0);
    expect(combined.indices).toHaveLength(0);
    expect(combined.vertexCount).toBe(0);
    expect(combined.triangleCount).toBe(0);
  });

  it("keeps projection-overlap terrain visible when the player moves away", () => {
    expect(shouldRenderVoxelV2NearRegion(24, 0, 2, 64, 0)).toBe(true);
    expect(shouldRenderVoxelV2NearRegion(40, 0, 2, 64, 0)).toBe(false);
  });
});

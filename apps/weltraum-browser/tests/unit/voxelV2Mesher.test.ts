import { describe, expect, it } from "vitest";
import { HALO_CELL_COUNT, HALO_EDGE } from "../../src/voxel-v2/domain/constants";
import { meshGreedyChunk } from "../../src/voxel-v2/domain/mesher";
import { VoxelMaterial } from "../../src/voxel-v2/domain/palette";
import type { CellCoord, HaloSnapshot } from "../../src/voxel-v2/domain/types";

const haloIndex = (cell: CellCoord): number =>
  (cell.x + 1) + HALO_EDGE * ((cell.z + 1) + HALO_EDGE * (cell.y + 1));

const haloSnapshot = (
  entries: readonly { readonly cell: CellCoord; readonly material: number }[],
  requestedRevision = 0
): HaloSnapshot => {
  const cells = new Uint8Array(HALO_CELL_COUNT);
  for (const entry of entries) cells[haloIndex(entry.cell)] = entry.material;
  return {
    key: "0,0,0",
    coord: { x: 0, y: 0, z: 0 },
    requestedRevision,
    chunkAuthorityRevision: requestedRevision,
    cells
  };
};

const normalVertexCount = (normals: Float32Array, x: number, y: number, z: number): number => {
  let count = 0;
  for (let index = 0; index < normals.length; index += 3) {
    if (normals[index] === x && normals[index + 1] === y && normals[index + 2] === z) count += 1;
  }
  return count;
};

describe("Voxel V2 greedy mesher", () => {
  it("emits only six exterior quads for two adjacent same-material cells", () => {
    const mesh = meshGreedyChunk(haloSnapshot([
      { cell: { x: 4, y: 5, z: 6 }, material: VoxelMaterial.LightRock },
      { cell: { x: 5, y: 5, z: 6 }, material: VoxelMaterial.LightRock }
    ]));
    expect(mesh).toMatchObject({ quadCount: 6, triangleCount: 12, vertexCount: 24 });
    expect(mesh.indices).toHaveLength(36);
    expect(mesh.materialRanges).toEqual([{ materialId: VoxelMaterial.LightRock, indexStart: 0, indexCount: 36 }]);
  });

  it("retains material boundaries while omitting the internal shared face", () => {
    const mesh = meshGreedyChunk(haloSnapshot([
      { cell: { x: 4, y: 5, z: 6 }, material: VoxelMaterial.LightRock },
      { cell: { x: 5, y: 5, z: 6 }, material: VoxelMaterial.DarkWetRock }
    ]));
    expect(mesh.quadCount).toBe(10);
    expect(mesh.triangleCount).toBe(20);
    expect(mesh.materialRanges.map((range) => range.materialId)).toEqual([
      VoxelMaterial.LightRock,
      VoxelMaterial.DarkWetRock
    ]);
    expect(mesh.materialRanges.reduce((sum, range) => sum + range.indexCount, 0)).toBe(mesh.indices.length);
  });

  it("uses the authoritative halo to suppress a chunk-seam face", () => {
    const withoutNeighbour = meshGreedyChunk(haloSnapshot([
      { cell: { x: 31, y: 7, z: 8 }, material: VoxelMaterial.Wood }
    ]));
    const withNeighbour = meshGreedyChunk(haloSnapshot([
      { cell: { x: 31, y: 7, z: 8 }, material: VoxelMaterial.Wood },
      { cell: { x: 32, y: 7, z: 8 }, material: VoxelMaterial.Wood }
    ]));
    expect(withoutNeighbour.quadCount).toBe(6);
    expect(withNeighbour.quadCount).toBe(5);
    expect(normalVertexCount(withoutNeighbour.normals, 1, 0, 0)).toBe(4);
    expect(normalVertexCount(withNeighbour.normals, 1, 0, 0)).toBe(0);
  });

  it("emits block-corner AO and keeps it in the mesh compatibility data", () => {
    const mesh = meshGreedyChunk(haloSnapshot([
      { cell: { x: 5, y: 31, z: 5 }, material: VoxelMaterial.MossGrass },
      { cell: { x: 4, y: 32, z: 5 }, material: VoxelMaterial.DarkWetRock },
      { cell: { x: 5, y: 32, z: 4 }, material: VoxelMaterial.DarkWetRock },
      { cell: { x: 4, y: 32, z: 4 }, material: VoxelMaterial.DarkWetRock }
    ]));
    const topAo: number[] = [];
    for (let vertex = 0; vertex < mesh.vertexCount; vertex += 1) {
      if (mesh.normals[vertex * 3] === 0 && mesh.normals[vertex * 3 + 1] === 1 && mesh.normals[vertex * 3 + 2] === 0) {
        topAo.push(mesh.ao[vertex]!);
      }
    }
    expect(topAo).toHaveLength(4);
    expect(topAo).toContain(0);
    expect(topAo.every((value) => value >= 0 && value <= 3)).toBe(true);
  });

  it("produces byte-identical typed output for byte-identical halo input", () => {
    const input = haloSnapshot([
      { cell: { x: 0, y: 0, z: 0 }, material: VoxelMaterial.Sand },
      { cell: { x: 1, y: 0, z: 0 }, material: VoxelMaterial.Sand },
      { cell: { x: 1, y: 1, z: 0 }, material: VoxelMaterial.FloraCoral }
    ], 7);
    const first = meshGreedyChunk(input);
    const second = meshGreedyChunk({ ...input, coord: { ...input.coord }, cells: input.cells.slice() });
    expect(first.positions).toEqual(second.positions);
    expect(first.normals).toEqual(second.normals);
    expect(first.indices).toEqual(second.indices);
    expect(first.materialIds).toEqual(second.materialIds);
    expect(first.ao).toEqual(second.ao);
    expect(first.materialRanges).toEqual(second.materialRanges);
    expect(first.byteLength).toBe(second.byteLength);
  });

  it("fails closed for a missing or inconsistent halo", () => {
    const valid = haloSnapshot([]);
    expect(() => meshGreedyChunk({ ...valid, key: "1,0,0" })).toThrow("halo key");
    expect(() => meshGreedyChunk({ ...valid, cells: new Uint8Array(1) })).toThrow("complete copied 34-cubed halo");
  });
});

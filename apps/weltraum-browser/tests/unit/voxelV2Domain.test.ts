import { describe, expect, it } from "vitest";
import { VoxelAuthority } from "../../src/voxel-v2/domain/authority";
import { isAuthorityAabbFree, resolveAuthorityAabbMovement } from "../../src/voxel-v2/domain/collision";
import { CHUNK_CELL_COUNT, CHUNK_EDGE, VOXEL_SIZE_METERS } from "../../src/voxel-v2/domain/constants";
import { contentSignature } from "../../src/voxel-v2/domain/contentSignature";
import {
  chunkKey,
  chunkLocalToGlobal,
  enumerateWorldChunks,
  globalToChunkLocal,
  localCellFromIndex,
  localCellIndex,
  parseChunkKey
} from "../../src/voxel-v2/domain/coordinates";
import { raycastAuthority } from "../../src/voxel-v2/domain/dda";
import { generateHestiaChunk, suggestedSpawnCell } from "../../src/voxel-v2/domain/generator";
import { HESTIA_V2_PALETTE, VoxelMaterial, validatePalette } from "../../src/voxel-v2/domain/palette";
import type { CellCoord, ChunkCoord, GeneratedChunk } from "../../src/voxel-v2/domain/types";

const generatedChunk = (
  coord: ChunkCoord,
  entries: readonly { readonly local: CellCoord; readonly material: number }[]
): GeneratedChunk => {
  const cells = new Uint8Array(CHUNK_CELL_COUNT);
  for (const entry of entries) cells[localCellIndex(entry.local)] = entry.material;
  return { coord, sourceRevision: 1, cells };
};

describe("Voxel V2 coordinates and palette", () => {
  it.each([-33, -32, -1, 0, 31, 32, 33])("round-trips signed global cell %i", (coordinate) => {
    const global = { x: coordinate, y: coordinate + 64, z: -coordinate };
    const mapped = globalToChunkLocal(global);
    expect(mapped.local.x).toBeGreaterThanOrEqual(0);
    expect(mapped.local.x).toBeLessThan(CHUNK_EDGE);
    expect(mapped.local.y).toBeGreaterThanOrEqual(0);
    expect(mapped.local.y).toBeLessThan(CHUNK_EDGE);
    expect(mapped.local.z).toBeGreaterThanOrEqual(0);
    expect(mapped.local.z).toBeLessThan(CHUNK_EDGE);
    expect(chunkLocalToGlobal(mapped.chunk, mapped.local)).toEqual(global);
  });

  it("uses mathematical floor mapping for negative boundaries", () => {
    expect(globalToChunkLocal({ x: -1, y: 0, z: -33 })).toEqual({
      chunk: { x: -1, y: 0, z: -2 },
      local: { x: 31, y: 0, z: 31 }
    });
    expect(parseChunkKey(chunkKey({ x: -4, y: 3, z: 0 }))).toEqual({ x: -4, y: 3, z: 0 });
    expect(() => parseChunkKey("1,2")).toThrow("Invalid V2 chunk key");
  });

  it("round-trips every local index and enumerates the bounded 8x4x8 world", () => {
    for (const index of [0, 1, 31, 32, 1023, 1024, CHUNK_CELL_COUNT - 1]) {
      expect(localCellIndex(localCellFromIndex(index))).toBe(index);
    }
    const chunks = enumerateWorldChunks();
    expect(chunks).toHaveLength(256);
    expect(chunks[0]).toEqual({ x: -4, y: 0, z: -4 });
    expect(chunks.at(-1)).toEqual({ x: 3, y: 3, z: 3 });
  });

  it("pins the complete immutable palette with Air at zero", () => {
    expect(() => validatePalette()).not.toThrow();
    expect(HESTIA_V2_PALETTE).toHaveLength(12);
    expect(HESTIA_V2_PALETTE[0]).toMatchObject({ id: 0, name: "Air", physicalClass: "air", destructible: false });
    expect(new Set(HESTIA_V2_PALETTE.map((record) => record.id)).size).toBe(12);
    expect(HESTIA_V2_PALETTE.filter((record) => record.physicalClass === "flora")).toHaveLength(3);
    expect(Object.isFrozen(HESTIA_V2_PALETTE)).toBe(true);
    expect(HESTIA_V2_PALETTE.every(Object.isFrozen)).toBe(true);
  });

  it("hashes raw bytes deterministically and distinctly", () => {
    const bytes = Uint8Array.of(0, 1, 2, 255);
    expect(contentSignature(bytes)).toBe(contentSignature(bytes.slice()));
    expect(contentSignature(bytes)).toMatch(/^fnv1a64:[0-9a-f]{16}$/);
    expect(contentSignature(bytes)).not.toBe(contentSignature(Uint8Array.of(0, 1, 3, 255)));
  });
});

describe("Voxel V2 deterministic world", () => {
  it("generates byte-identical chunks for the same seed and different content for another seed", () => {
    const coord = { x: 0, y: 0, z: 0 };
    const first = generateHestiaChunk({ coord, seed: "alpha" });
    const second = generateHestiaChunk({ coord, seed: "alpha" });
    const changed = generateHestiaChunk({ coord, seed: "bravo" });
    expect(first.sourceRevision).toBe(second.sourceRevision);
    expect(first.cells).toEqual(second.cells);
    expect(contentSignature(first.cells)).toBe(contentSignature(second.cells));
    expect(contentSignature(changed.cells)).not.toBe(contentSignature(first.cells));
    expect(first.cells.some((material) => material !== VoxelMaterial.Air)).toBe(true);
  });

  it("provides a dry occupied-supported spawn with an intentional clearing", () => {
    const authority = new VoxelAuthority();
    const spawn = suggestedSpawnCell();
    const mapped = globalToChunkLocal(spawn);
    for (let y = 0; y <= Math.min(3, mapped.chunk.y + 1); y += 1) {
      authority.adoptGeneratedChunk(generateHestiaChunk({ coord: { x: mapped.chunk.x, y, z: mapped.chunk.z } }));
    }
    expect(authority.getCell(spawn)).toBe(VoxelMaterial.Air);
    expect(authority.getCell({ ...spawn, y: spawn.y - 1 })).not.toBe(VoxelMaterial.Air);
    expect(spawn.y * VOXEL_SIZE_METERS).toBeGreaterThan(3.5);
  });
});

describe("Voxel V2 authority and edits", () => {
  it("owns copied chunk cells and returns copied snapshots", () => {
    const authority = new VoxelAuthority("copy-test");
    const generated = generatedChunk({ x: 0, y: 0, z: 0 }, [
      { local: { x: 1, y: 2, z: 3 }, material: VoxelMaterial.LightRock }
    ]);
    const metadata = authority.adoptGeneratedChunk(generated);
    expect(metadata?.nonAirCells).toBe(1);
    generated.cells.fill(VoxelMaterial.Air);
    expect(authority.getCell({ x: 1, y: 2, z: 3 })).toBe(VoxelMaterial.LightRock);
    const snapshot = authority.snapshotChunk({ x: 0, y: 0, z: 0 });
    snapshot.cells.fill(VoxelMaterial.Air);
    expect(authority.getCell({ x: 1, y: 2, z: 3 })).toBe(VoxelMaterial.LightRock);
  });

  it("enforces edit ID, contiguous sequence and compare-and-swap revision", () => {
    const authority = new VoxelAuthority("ordering-test");
    authority.adoptGeneratedChunk(generatedChunk({ x: 0, y: 0, z: 0 }, [
      { local: { x: 1, y: 1, z: 1 }, material: VoxelMaterial.LightRock },
      { local: { x: 2, y: 1, z: 1 }, material: VoxelMaterial.Wood }
    ]));
    const first = authority.applySubtractSphere({
      editId: "edit-1", sequence: 1, expectedWorldRevision: 0, center: { x: 1, y: 1, z: 1 }, radiusCells: 0
    });
    expect(first).toMatchObject({ status: "Accepted", worldRevision: 1, changedCells: 1 });
    expect(authority.applySubtractSphere({
      editId: "edit-1", sequence: 1, expectedWorldRevision: 0, center: { x: 1, y: 1, z: 1 }, radiusCells: 0
    }).status).toBe("Duplicate");
    expect(authority.applySubtractSphere({
      editId: "edit-3", sequence: 3, expectedWorldRevision: 1, center: { x: 2, y: 1, z: 1 }, radiusCells: 0
    }).status).toBe("OutOfOrder");
    expect(authority.applySubtractSphere({
      editId: "edit-2-stale", sequence: 2, expectedWorldRevision: 0, center: { x: 2, y: 1, z: 1 }, radiusCells: 0
    }).status).toBe("Stale");
    expect(authority.applySubtractSphere({
      editId: "edit-2", sequence: 2, expectedWorldRevision: 1, center: { x: 2, y: 1, z: 1 }, radiusCells: 0
    })).toMatchObject({ status: "Accepted", worldRevision: 2, changedCells: 1 });
    expect(authority.applySubtractSphere({
      editId: "edit-3", sequence: 3, expectedWorldRevision: 2, center: { x: 9, y: 9, z: 9 }, radiusCells: 0
    })).toMatchObject({ status: "NoChange", worldRevision: 2, changedCells: 0 });
    expect(authority.lastEditSequence).toBe(3);
  });

  it("subtracts the quantized sphere boundary and reports exact dirty/remesh chunks", () => {
    const authority = new VoxelAuthority("sphere-test");
    const entries: { local: CellCoord; material: number }[] = [];
    for (let z = 14; z <= 16; z += 1) {
      for (let y = 14; y <= 16; y += 1) {
        for (let x = 30; x <= 31; x += 1) entries.push({ local: { x, y, z }, material: VoxelMaterial.DarkWetRock });
      }
    }
    authority.adoptGeneratedChunk(generatedChunk({ x: 0, y: 0, z: 0 }, entries));
    authority.adoptGeneratedChunk(generatedChunk({ x: 1, y: 0, z: 0 }, [
      { local: { x: 0, y: 15, z: 15 }, material: VoxelMaterial.LightRock }
    ]));
    const result = authority.applySubtractSphere({
      editId: "boundary-cut", sequence: 1, expectedWorldRevision: 0, center: { x: 31, y: 15, z: 15 }, radiusCells: 1
    });
    expect(result.status).toBe("Accepted");
    expect(result.changedCells).toBe(7);
    expect(result.changedChunks.map((chunk) => chunk.key)).toEqual(["0,0,0", "1,0,0"]);
    expect(result.remeshChunkKeys).toContain("0,0,0");
    expect(result.remeshChunkKeys).toContain("1,0,0");
    expect(result.changedChunks[0]?.dirtyLocalAabb.max.x).toBe(31);
    expect(authority.getCell({ x: 30, y: 14, z: 15 })).toBe(VoxelMaterial.DarkWetRock);
    expect(authority.getCell({ x: 31, y: 14, z: 15 })).toBe(VoxelMaterial.Air);
    expect(authority.getCell({ x: 32, y: 15, z: 15 })).toBe(VoxelMaterial.Air);
  });

  it("copies a complete neighbour halo without exposing authority cells", () => {
    const authority = new VoxelAuthority("halo-test");
    authority.adoptGeneratedChunk(generatedChunk({ x: 0, y: 0, z: 0 }, [
      { local: { x: 31, y: 2, z: 4 }, material: VoxelMaterial.LightRock }
    ]));
    authority.adoptGeneratedChunk(generatedChunk({ x: 1, y: 0, z: 0 }, [
      { local: { x: 0, y: 2, z: 4 }, material: VoxelMaterial.Wood }
    ]));
    const halo = authority.createHaloSnapshot({ x: 0, y: 0, z: 0 });
    const haloIndex = (x: number, y: number, z: number): number => (x + 1) + 34 * ((z + 1) + 34 * (y + 1));
    expect(halo.cells[haloIndex(31, 2, 4)]).toBe(VoxelMaterial.LightRock);
    expect(halo.cells[haloIndex(32, 2, 4)]).toBe(VoxelMaterial.Wood);
    halo.cells.fill(VoxelMaterial.Air);
    expect(authority.getCell({ x: 32, y: 2, z: 4 })).toBe(VoxelMaterial.Wood);
  });
});

describe("Voxel V2 DDA and authority collision", () => {
  it("reports first DDA hit, miss and range limit", () => {
    const authority = new VoxelAuthority("dda-test");
    authority.adoptGeneratedChunk(generatedChunk({ x: 0, y: 0, z: 0 }, [
      { local: { x: 0, y: 4, z: 0 }, material: VoxelMaterial.Wood }
    ]));
    const origin = { x: -1, y: 1.125, z: 0.125 };
    expect(raycastAuthority(authority, origin, { x: 1, y: 0, z: 0 }, 0.9)).toBeNull();
    expect(raycastAuthority(authority, origin, { x: -1, y: 0, z: 0 }, 3)).toBeNull();
    expect(raycastAuthority(authority, origin, { x: 1, y: 0, z: 0 }, 2)).toMatchObject({
      cell: { x: 0, y: 4, z: 0 },
      material: VoxelMaterial.Wood,
      normal: { x: -1, y: 0, z: 0 },
      distanceMeters: 1
    });
  });

  it("changes collision from authority occupancy without any renderer mesh", () => {
    const authority = new VoxelAuthority("collision-test");
    const floor: { local: CellCoord; material: number }[] = [];
    for (let z = 0; z < CHUNK_EDGE; z += 1) {
      for (let x = 0; x < CHUNK_EDGE; x += 1) floor.push({ local: { x, y: 0, z }, material: VoxelMaterial.LightRock });
    }
    authority.adoptGeneratedChunk(generatedChunk({ x: 0, y: 0, z: 0 }, floor));
    const dimensions = { halfWidth: 0.1, height: 1.75 };
    const standing = { x: 2.125, y: 0.25, z: 2.125 };
    const resting = resolveAuthorityAabbMovement(authority, standing, { x: 0, y: -0.1, z: 0 }, dimensions, 0);
    expect(resting.blockedY).toBe(true);
    expect(resting.grounded).toBe(true);
    expect(isAuthorityAabbFree(authority, { ...standing, y: 0 }, dimensions)).toBe(false);

    const edit = authority.applySubtractSphere({
      editId: "floor-cut", sequence: 1, expectedWorldRevision: 0, center: { x: 8, y: 0, z: 8 }, radiusCells: 2
    });
    expect(edit.status).toBe("Accepted");
    expect(isAuthorityAabbFree(authority, { ...standing, y: 0 }, dimensions)).toBe(true);
    const falling = resolveAuthorityAabbMovement(authority, standing, { x: 0, y: -0.1, z: 0 }, dimensions, 0);
    expect(falling.blockedY).toBe(false);
    expect(falling.position.y).toBeCloseTo(0.15, 6);
  });
});

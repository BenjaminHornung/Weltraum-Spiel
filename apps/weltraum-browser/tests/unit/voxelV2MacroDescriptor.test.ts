import { describe, expect, it } from "vitest";
import { CHUNK_EDGE, SEA_LEVEL_CELL, VOXEL_SIZE_METERS } from "../../src/voxel-v2/domain/constants";
import { localCellFromIndex } from "../../src/voxel-v2/domain/coordinates";
import { createMacroWorldDescriptor, sampleMacroWorld } from "../../src/voxel-v2/domain/macroDescriptor";
import { generateHestiaChunk, treeAnchorsForChunk } from "../../src/voxel-v2/domain/generator";
import { VoxelMaterial } from "../../src/voxel-v2/domain/palette";
import type { CellCoord, MacroTreeArchetype } from "../../src/voxel-v2/domain/types";

const descriptor = createMacroWorldDescriptor("macro-test", "macro-v1");

describe("Voxel V2 macro descriptor", () => {
  it("is frozen, pure and byte-stable for equal seed/version/coordinates", () => {
    const first = createMacroWorldDescriptor("macro-test", "macro-v1");
    const second = createMacroWorldDescriptor("macro-test", "macro-v1");
    const firstSample = sampleMacroWorld(first, 12.5, -8.75);
    const secondSample = sampleMacroWorld(second, 12.5, -8.75);

    expect(firstSample).toEqual(secondSample);
    expect(JSON.stringify(firstSample)).toBe(JSON.stringify(secondSample));
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(firstSample)).toBe(true);
    expect(Object.isFrozen(firstSample.flowDirection)).toBe(true);
    expect(Object.isFrozen(firstSample.anchor)).toBe(true);
    expect(() => sampleMacroWorld(first, Number.NaN, 0)).toThrow("finite");
  });

  it("changes valid macro content with the seed and preserves the descriptor sample seam", () => {
    const changed = createMacroWorldDescriptor("macro-other", "macro-v1");
    const sample = sampleMacroWorld(descriptor, 6.125, 11.625);

    expect(sampleMacroWorld(changed, 12.5, -8.75)).not.toEqual(sampleMacroWorld(descriptor, 12.5, -8.75));
    expect(sample.anchor.key).toBe("0:0");
    expect(sample.anchor.recommendedTreeArchetype).toBe(sampleMacroWorld(descriptor, 8, 8).anchor.recommendedTreeArchetype);
  });

  it("provides irregular coast, channels, drainage and a dry spawn clearing", () => {
    const coastlineTransitions: number[] = [];
    let channelCount = 0;
    for (let z = -40; z <= 40; z += 2) {
      let previousWater: boolean | undefined;
      let transitions = 0;
      for (let x = -64; x <= 64; x += 2) {
        const sample = sampleMacroWorld(descriptor, x, z);
        if (sample.isChannel) {
          channelCount += 1;
          expect(sample.isWater).toBe(true);
          expect(sample.flowDirection.x).toBeLessThan(0);
        }
        if (previousWater !== undefined && previousWater !== sample.isWater) transitions += 1;
        previousWater = sample.isWater;
      }
      coastlineTransitions.push(transitions);
    }

    const spawn = sampleMacroWorld(descriptor, (34.5) * VOXEL_SIZE_METERS, (56.5) * VOXEL_SIZE_METERS);
    expect(channelCount).toBeGreaterThan(10);
    expect(new Set(coastlineTransitions).size).toBeGreaterThan(1);
    expect(spawn.isWater).toBe(false);
    expect(spawn.spawnClearing).toBe(true);
    expect(spawn.surfaceLevelCells).toBeGreaterThan(SEA_LEVEL_CELL);
  });
});

describe("Voxel V2 Near composition", () => {
  const regionChunks = (): Map<string, number> => {
    const cells = new Map<string, number>();
    for (let chunkY = 0; chunkY <= 3; chunkY += 1) {
      for (let chunkZ = -3; chunkZ <= 2; chunkZ += 1) {
        for (let chunkX = -3; chunkX <= 2; chunkX += 1) {
          const chunk = generateHestiaChunk({ coord: { x: chunkX, y: chunkY, z: chunkZ }, seed: "macro-test", worldVersion: "macro-v1" });
          for (let index = 0; index < chunk.cells.length; index += 1) {
            const local = localCellFromIndex(index);
            const global = {
              x: chunkX * CHUNK_EDGE + local.x,
              y: chunkY * CHUNK_EDGE + local.y,
              z: chunkZ * CHUNK_EDGE + local.z
            };
            if (chunk.cells[index] !== VoxelMaterial.Air) cells.set(`${global.x}:${global.y}:${global.z}`, chunk.cells[index] ?? VoxelMaterial.Air);
          }
        }
      }
    }
    return cells;
  };

  it("reuses descriptor anchors and archetypes across overlapping Near chunks", () => {
    const descriptorForTrees = createMacroWorldDescriptor("seed-8", "macro-v1");
    const anchors = [-4, -3, -2, -1, 0, 1, 2, 3].flatMap((chunkZ) => [-4, -3, -2, -1, 0, 1, 2, 3].flatMap((chunkX) =>
      treeAnchorsForChunk(descriptorForTrees, { x: chunkX, y: 0, z: chunkZ })));
    const archetypes = new Set<MacroTreeArchetype>(anchors.map((anchor) => anchor.archetype));
    expect(archetypes).toEqual(new Set(["umbrella", "buttress-root", "coast-savanna", "mangrove"]));
    expect(anchors.some((anchor) => anchor.base.x < 0 && anchor.base.z < 0)).toBe(true);

    const byBase = new Map<string, (typeof anchors)[number]>();
    for (const anchor of anchors) {
      const sample = sampleMacroWorld(
        descriptorForTrees,
        (anchor.base.x + 0.5) * VOXEL_SIZE_METERS,
        (anchor.base.z + 0.5) * VOXEL_SIZE_METERS
      );
      expect(Math.floor(sample.anchor.x / VOXEL_SIZE_METERS)).toBe(anchor.base.x);
      expect(Math.floor(sample.anchor.z / VOXEL_SIZE_METERS)).toBe(anchor.base.z);
      expect(anchor.archetype).toBe(sample.anchor.recommendedTreeArchetype);
      expect(sample.isWater).toBe(false);

      const key = `${anchor.base.x}:${anchor.base.z}`;
      const existing = byBase.get(key);
      if (existing) expect(anchor).toEqual(existing);
      else byBase.set(key, anchor);
    }
  });

  it("keeps every vegetation component face-connected to terrain across chunk seams", () => {
    const cells = regionChunks();
    const descriptorForRegion = createMacroWorldDescriptor("macro-test", "macro-v1");
    const vegetation: ReadonlySet<number> = new Set([
      VoxelMaterial.Wood,
      VoxelMaterial.Leaves,
      VoxelMaterial.FloraCoral,
      VoxelMaterial.FloraAzure,
      VoxelMaterial.FloraGold
    ]);
    let vegetationCount = 0;
    let treeCount = 0;
    const innerMin = -2 * CHUNK_EDGE;
    const innerMax = 2 * CHUNK_EDGE - 1;
    const neighbours = (cell: CellCoord): readonly CellCoord[] => [
      { x: cell.x - 1, y: cell.y, z: cell.z },
      { x: cell.x + 1, y: cell.y, z: cell.z },
      { x: cell.x, y: cell.y, z: cell.z - 1 },
      { x: cell.x, y: cell.y, z: cell.z + 1 },
      { x: cell.x, y: cell.y - 1, z: cell.z },
      { x: cell.x, y: cell.y + 1, z: cell.z }
    ];
    const componentSeen = new Set<string>();
    for (const [key, material] of cells) {
      if (!vegetation.has(material)) continue;
      vegetationCount += 1;
      const [x, y, z] = key.split(":").map(Number);
      const cell = { x, y, z };
      if (material === VoxelMaterial.Wood || material === VoxelMaterial.Leaves) treeCount += 1;
      if (x < innerMin || x > innerMax || z < innerMin || z > innerMax || componentSeen.has(key)) continue;

      const queue = [cell];
      componentSeen.add(key);
      let hasTerrainSupport = false;
      while (queue.length > 0) {
        const current = queue.pop() as CellCoord;
        const below = cells.get(`${current.x}:${current.y - 1}:${current.z}`) ?? VoxelMaterial.Air;
        if (below !== VoxelMaterial.Air && !vegetation.has(below)) hasTerrainSupport = true;
        for (const neighbour of neighbours(current)) {
          const neighbourKey = `${neighbour.x}:${neighbour.y}:${neighbour.z}`;
          const neighbourMaterial = cells.get(neighbourKey) ?? VoxelMaterial.Air;
          if (vegetation.has(neighbourMaterial) && !componentSeen.has(neighbourKey)) {
            componentSeen.add(neighbourKey);
            queue.push(neighbour);
          }
        }
      }
      expect(hasTerrainSupport, `unsupported vegetation component from ${key}`).toBe(true);
    }
    expect(treeCount).toBeGreaterThan(20);
    expect(vegetationCount).toBeGreaterThan(treeCount);

    for (const [key, material] of cells) {
      if (material === VoxelMaterial.Air) continue;
      const [x, , z] = key.split(":").map(Number);
      if (vegetation.has(material)) {
        const sample = sampleMacroWorld(descriptorForRegion, (x + 0.5) * VOXEL_SIZE_METERS, (z + 0.5) * VOXEL_SIZE_METERS);
        expect(sample.isWater).toBe(false);
        expect(Math.hypot(x - 34, z - 56)).toBeGreaterThanOrEqual(24);
      }
    }
  });

  it("continues flora stems through the y=63/64 chunk seam", () => {
    const flora = new Set<number>([VoxelMaterial.FloraCoral, VoxelMaterial.FloraAzure, VoxelMaterial.FloraGold]);
    const crossingColumns = (seed: string, worldVersion: string): ReadonlySet<string> => {
      const lower = generateHestiaChunk({ coord: { x: -1, y: 1, z: -4 }, seed, worldVersion });
      const upper = generateHestiaChunk({ coord: { x: -1, y: 2, z: -4 }, seed, worldVersion });
      const cellAt = (chunk: typeof lower, x: number, y: number, z: number): number => {
        const local = { x: x - chunk.coord.x * CHUNK_EDGE, y: y - chunk.coord.y * CHUNK_EDGE, z: z - chunk.coord.z * CHUNK_EDGE };
        return chunk.cells[local.x + CHUNK_EDGE * (local.z + CHUNK_EDGE * local.y)] ?? VoxelMaterial.Air;
      };
      const crossings = new Set<string>();
      for (let z = -128; z < -96; z += 1) {
        for (let x = -32; x < 0; x += 1) {
          if (flora.has(cellAt(lower, x, 63, z)) && flora.has(cellAt(upper, x, 64, z))) crossings.add(`${x}:${z}`);
        }
      }
      return crossings;
    };
    expect(crossingColumns("hestia-coast-river-v2-01", "hestia-voxel-v2-spike-v1").has("-18:-122")).toBe(true);
  });
});

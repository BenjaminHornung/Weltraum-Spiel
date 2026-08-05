import {
  CHUNK_CELL_COUNT,
  CHUNK_EDGE,
  DEFAULT_WORLD_SEED,
  SEA_LEVEL_CELL,
  VOXEL_SIZE_METERS,
  WORLD_MAX_CELL_Y,
  WORLD_VERSION,
  isWorldChunk
} from "./constants";
import { chunkLocalToGlobal, localCellIndex } from "./coordinates";
import { VoxelMaterial } from "./palette";
import type { CellCoord, ChunkCoord, GeneratedChunk } from "./types";

export interface GenerateChunkInput {
  readonly coord: ChunkCoord;
  readonly seed?: string;
  readonly worldVersion?: string;
}

interface SurfaceProfile {
  readonly topY: number;
  readonly waterChannel: boolean;
  readonly beach: boolean;
  readonly wet: boolean;
}

const SPAWN_X_CELL = 34;
const SPAWN_Z_CELL = 56;
const TREE_SPACING_CELLS = 24;
const TREE_CANOPY_RADIUS_CELLS = 7;

const hashString32 = (value: string): number => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
};

const mix32 = (seed: number, x: number, z: number, salt: number): number => {
  let hash = seed ^ Math.imul(x, 0x9e3779b1) ^ Math.imul(z, 0x85ebca77) ^ salt;
  hash = Math.imul(hash ^ (hash >>> 16), 0x7feb352d);
  hash = Math.imul(hash ^ (hash >>> 15), 0x846ca68b);
  return (hash ^ (hash >>> 16)) >>> 0;
};

const cellMeters = (cell: number): number => (cell + 0.5) * VOXEL_SIZE_METERS;

const coastX = (zMeters: number, phase: number): number =>
  -18.5 + Math.sin(zMeters * 0.13 + phase) * 2.2 + Math.sin(zMeters * 0.045 - phase) * 1.4;

const riverZ = (xMeters: number, phase: number): number =>
  -4 + Math.sin((xMeters + 16) * 0.08 + phase * 0.35) * 4;

const islandDome = (x: number, z: number, centerX: number, centerZ: number, radius: number): number => {
  const distance = Math.hypot(x - centerX, z - centerZ);
  return Math.max(0, 1 - distance / radius);
};

const surfaceProfile = (cellX: number, cellZ: number, seedHash: number): SurfaceProfile => {
  const x = cellMeters(cellX);
  const z = cellMeters(cellZ);
  const phase = (seedHash % 6283) / 1000;
  const shoreline = coastX(z, phase);
  const inlandMeters = x - shoreline;
  const mainland = inlandMeters >= 0;
  const island = Math.max(
    islandDome(x, z, -25, -17, 6.5),
    islandDome(x, z, -26, 9, 4.5),
    islandDome(x, z, -20, 23, 5.5)
  );

  const lagoon = ((x + 11) / 7.5) ** 2 + ((z + 5) / 5.2) ** 2 < 1;
  const riverDistance = Math.abs(z - riverZ(x, phase));
  const riverWidth = 1.25 + Math.max(0, 1 - (x + 18) / 55) * 0.9;
  const river = mainland && riverDistance < riverWidth;
  const waterChannel = lagoon || river;

  if (!mainland && island === 0) {
    const seabed = SEA_LEVEL_CELL - 7 + Math.round(Math.sin(z * 0.11 + phase) * 1.5);
    return { topY: Math.max(4, seabed), waterChannel: false, beach: true, wet: true };
  }

  if (!mainland) {
    const topY = SEA_LEVEL_CELL + 1 + Math.round(island * 17 + Math.sin((x - z) * 0.2 + phase) * 2);
    return { topY, waterChannel: false, beach: topY <= SEA_LEVEL_CELL + 3, wet: topY <= SEA_LEVEL_CELL + 2 };
  }

  const rise = Math.max(0, inlandMeters) * 0.58;
  const broadValley = Math.max(0, 10 - riverDistance * 0.7);
  const macro = Math.sin(z * 0.105 + phase) * 5 + Math.sin((x + z) * 0.07 - phase) * 3;
  const cliffTerrace = x > 8 && riverDistance > 8 ? 7 + Math.floor((x - 8) / 8) * 3 : 0;
  const rawLand = SEA_LEVEL_CELL + 4 + rise + macro + cliffTerrace - broadValley;
  let topY = Math.round(rawLand / 3) * 3;

  if (lagoon) topY = SEA_LEVEL_CELL - 2;
  else if (river) topY = SEA_LEVEL_CELL - 2;
  else if (riverDistance < riverWidth + 3.5) {
    const bankBlend = (riverDistance - riverWidth) / 3.5;
    topY = Math.round((SEA_LEVEL_CELL - 1) * (1 - bankBlend) + topY * bankBlend);
  }

  const coastBand = inlandMeters < 3.5;
  if (coastBand && !waterChannel) topY = Math.min(topY, SEA_LEVEL_CELL + 3 + Math.max(0, Math.floor(inlandMeters)));

  return {
    topY: Math.max(3, Math.min(WORLD_MAX_CELL_Y - 28, topY)),
    waterChannel,
    beach: coastBand || topY <= SEA_LEVEL_CELL + 2,
    wet: waterChannel || topY <= SEA_LEVEL_CELL + 1 || riverDistance < riverWidth + 1
  };
};

const terrainMaterial = (profile: SurfaceProfile, y: number): number => {
  const depth = profile.topY - y;
  if (depth === 0) {
    if (profile.waterChannel || profile.wet) return VoxelMaterial.WetBoundary;
    return profile.beach ? VoxelMaterial.Sand : VoxelMaterial.MossGrass;
  }
  if (depth <= 3) {
    if (profile.beach) return VoxelMaterial.Sand;
    if (profile.wet) return VoxelMaterial.DarkWetRock;
    return VoxelMaterial.Soil;
  }
  const lightStratum = Math.floor(y / 4) % 3 !== 1;
  return profile.wet || !lightStratum ? VoxelMaterial.DarkWetRock : VoxelMaterial.LightRock;
};

const insideSpawnClearing = (cellX: number, cellZ: number): boolean =>
  Math.hypot(cellX - SPAWN_X_CELL, cellZ - SPAWN_Z_CELL) < 24;

const writeGlobalCell = (
  cells: Uint8Array,
  chunk: ChunkCoord,
  global: CellCoord,
  material: number,
  onlyIfAir: boolean
): void => {
  const local = {
    x: global.x - chunk.x * CHUNK_EDGE,
    y: global.y - chunk.y * CHUNK_EDGE,
    z: global.z - chunk.z * CHUNK_EDGE
  };
  if (
    local.x < 0 || local.x >= CHUNK_EDGE
    || local.y < 0 || local.y >= CHUNK_EDGE
    || local.z < 0 || local.z >= CHUNK_EDGE
  ) return;
  const index = localCellIndex(local);
  if (!onlyIfAir || cells[index] === VoxelMaterial.Air) cells[index] = material;
};

const addTrees = (cells: Uint8Array, coord: ChunkCoord, seedHash: number): void => {
  const minX = coord.x * CHUNK_EDGE - TREE_CANOPY_RADIUS_CELLS;
  const maxX = (coord.x + 1) * CHUNK_EDGE - 1 + TREE_CANOPY_RADIUS_CELLS;
  const minZ = coord.z * CHUNK_EDGE - TREE_CANOPY_RADIUS_CELLS;
  const maxZ = (coord.z + 1) * CHUNK_EDGE - 1 + TREE_CANOPY_RADIUS_CELLS;
  const minGridX = Math.floor(minX / TREE_SPACING_CELLS);
  const maxGridX = Math.floor(maxX / TREE_SPACING_CELLS);
  const minGridZ = Math.floor(minZ / TREE_SPACING_CELLS);
  const maxGridZ = Math.floor(maxZ / TREE_SPACING_CELLS);

  for (let gridZ = minGridZ; gridZ <= maxGridZ; gridZ += 1) {
    for (let gridX = minGridX; gridX <= maxGridX; gridX += 1) {
      const placement = mix32(seedHash, gridX, gridZ, 0x4d3a2f11);
      if (placement % 100 >= 62) continue;
      const centerX = gridX * TREE_SPACING_CELLS + 12 + ((placement >>> 8) % 9) - 4;
      const centerZ = gridZ * TREE_SPACING_CELLS + 12 + ((placement >>> 16) % 9) - 4;
      if (insideSpawnClearing(centerX, centerZ)) continue;
      const profile = surfaceProfile(centerX, centerZ, seedHash);
      if (profile.waterChannel || profile.topY <= SEA_LEVEL_CELL + 3) continue;
      const slope = Math.max(
        Math.abs(surfaceProfile(centerX + 2, centerZ, seedHash).topY - profile.topY),
        Math.abs(surfaceProfile(centerX, centerZ + 2, seedHash).topY - profile.topY)
      );
      if (slope > 4) continue;

      const trunkHeight = 14 + ((placement >>> 24) % 9);
      for (let y = profile.topY + 1; y <= profile.topY + trunkHeight; y += 1) {
        const thick = y < profile.topY + 5 ? 1 : 0;
        for (let dz = -thick; dz <= thick; dz += 1) {
          for (let dx = -thick; dx <= thick; dx += 1) {
            if (Math.abs(dx) + Math.abs(dz) > thick + 1) continue;
            writeGlobalCell(cells, coord, { x: centerX + dx, y, z: centerZ + dz }, VoxelMaterial.Wood, false);
          }
        }
      }

      const canopyCenterY = profile.topY + trunkHeight - 1;
      const canopyRadius = 5 + ((placement >>> 20) % 3);
      for (let dy = -4; dy <= 5; dy += 1) {
        for (let dz = -canopyRadius; dz <= canopyRadius; dz += 1) {
          for (let dx = -canopyRadius; dx <= canopyRadius; dx += 1) {
            const shape = (dx * dx + dz * dz) / (canopyRadius * canopyRadius) + (dy * dy) / 25;
            const ragged = mix32(placement, centerX + dx, centerZ + dz, dy) % 7;
            if (shape > 1 || (shape > 0.72 && ragged === 0)) continue;
            writeGlobalCell(
              cells,
              coord,
              { x: centerX + dx, y: canopyCenterY + dy, z: centerZ + dz },
              VoxelMaterial.Leaves,
              true
            );
          }
        }
      }
    }
  }
};

const addFlora = (cells: Uint8Array, coord: ChunkCoord, seedHash: number): void => {
  for (let localZ = 0; localZ < CHUNK_EDGE; localZ += 1) {
    for (let localX = 0; localX < CHUNK_EDGE; localX += 1) {
      const globalX = coord.x * CHUNK_EDGE + localX;
      const globalZ = coord.z * CHUNK_EDGE + localZ;
      const accent = mix32(seedHash, globalX, globalZ, 0x1f6c3d95);
      if (accent % 37 !== 0 || insideSpawnClearing(globalX, globalZ)) continue;
      const profile = surfaceProfile(globalX, globalZ, seedHash);
      if (profile.waterChannel || profile.topY <= SEA_LEVEL_CELL + 2) continue;
      const material = VoxelMaterial.FloraCoral + ((accent >>> 8) % 3);
      const height = 1 + ((accent >>> 12) % 3);
      for (let offset = 1; offset <= height; offset += 1) {
        writeGlobalCell(cells, coord, { x: globalX, y: profile.topY + offset, z: globalZ }, material, true);
      }
    }
  }
};

export const suggestedSpawnCell = (seed = DEFAULT_WORLD_SEED): CellCoord => ({
  x: SPAWN_X_CELL,
  y: surfaceProfile(SPAWN_X_CELL, SPAWN_Z_CELL, hashString32(`${WORLD_VERSION}:${seed}`)).topY + 1,
  z: SPAWN_Z_CELL
});

export const generateHestiaChunk = (input: GenerateChunkInput): GeneratedChunk => {
  if (!isWorldChunk(input.coord.x, input.coord.y, input.coord.z)) throw new Error("V2 generation chunk is outside the bounded world.");
  const seed = input.seed ?? DEFAULT_WORLD_SEED;
  const worldVersion = input.worldVersion ?? WORLD_VERSION;
  if (seed.trim().length === 0 || worldVersion.trim().length === 0) throw new Error("V2 seed and world version are required.");
  const seedHash = hashString32(`${worldVersion}:${seed}`);
  const cells = new Uint8Array(CHUNK_CELL_COUNT);

  for (let localY = 0; localY < CHUNK_EDGE; localY += 1) {
    for (let localZ = 0; localZ < CHUNK_EDGE; localZ += 1) {
      for (let localX = 0; localX < CHUNK_EDGE; localX += 1) {
        const global = chunkLocalToGlobal(input.coord, { x: localX, y: localY, z: localZ });
        const profile = surfaceProfile(global.x, global.z, seedHash);
        if (global.y <= profile.topY) cells[localCellIndex({ x: localX, y: localY, z: localZ })] = terrainMaterial(profile, global.y);
      }
    }
  }

  addTrees(cells, input.coord, seedHash);
  addFlora(cells, input.coord, seedHash);

  return { coord: { ...input.coord }, sourceRevision: seedHash, cells };
};

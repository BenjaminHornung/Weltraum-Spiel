import {
  CHUNK_EDGE,
  WORLD_MAX_CHUNK_X,
  WORLD_MAX_CHUNK_Y,
  WORLD_MAX_CHUNK_Z,
  WORLD_MIN_CHUNK_X,
  WORLD_MIN_CHUNK_Y,
  WORLD_MIN_CHUNK_Z,
  isWorldChunk
} from "./constants";
import type { CellCoord, ChunkCoord, LocalCellCoord } from "./types";

export const floorDiv = (value: number, divisor: number): number => Math.floor(value / divisor);

export const positiveModulo = (value: number, divisor: number): number => {
  const remainder = value % divisor;
  return remainder < 0 ? remainder + divisor : remainder;
};

export const chunkKey = (coord: ChunkCoord): string => `${coord.x},${coord.y},${coord.z}`;

export const parseChunkKey = (key: string): ChunkCoord => {
  const match = /^(-?\d+),(-?\d+),(-?\d+)$/.exec(key);
  if (!match) throw new Error(`Invalid V2 chunk key: ${key}`);
  const coord = { x: Number(match[1]), y: Number(match[2]), z: Number(match[3]) };
  if (!Number.isSafeInteger(coord.x) || !Number.isSafeInteger(coord.y) || !Number.isSafeInteger(coord.z)) {
    throw new Error(`Invalid V2 chunk key: ${key}`);
  }
  return coord;
};

export interface ChunkLocalCell {
  readonly chunk: ChunkCoord;
  readonly local: LocalCellCoord;
}

export const globalToChunkLocal = (cell: CellCoord): ChunkLocalCell => ({
  chunk: {
    x: floorDiv(cell.x, CHUNK_EDGE),
    y: floorDiv(cell.y, CHUNK_EDGE),
    z: floorDiv(cell.z, CHUNK_EDGE)
  },
  local: {
    x: positiveModulo(cell.x, CHUNK_EDGE),
    y: positiveModulo(cell.y, CHUNK_EDGE),
    z: positiveModulo(cell.z, CHUNK_EDGE)
  }
});

export const chunkLocalToGlobal = (chunk: ChunkCoord, local: LocalCellCoord): CellCoord => {
  if (
    !Number.isInteger(local.x) || !Number.isInteger(local.y) || !Number.isInteger(local.z)
    || local.x < 0 || local.x >= CHUNK_EDGE
    || local.y < 0 || local.y >= CHUNK_EDGE
    || local.z < 0 || local.z >= CHUNK_EDGE
  ) {
    throw new Error("V2 local cell coordinate is outside its chunk.");
  }
  return {
    x: chunk.x * CHUNK_EDGE + local.x,
    y: chunk.y * CHUNK_EDGE + local.y,
    z: chunk.z * CHUNK_EDGE + local.z
  };
};

export const localCellIndex = (local: LocalCellCoord): number => {
  if (
    !Number.isInteger(local.x) || !Number.isInteger(local.y) || !Number.isInteger(local.z)
    || local.x < 0 || local.x >= CHUNK_EDGE
    || local.y < 0 || local.y >= CHUNK_EDGE
    || local.z < 0 || local.z >= CHUNK_EDGE
  ) {
    throw new Error("V2 local cell coordinate is outside its chunk.");
  }
  return local.x + CHUNK_EDGE * (local.z + CHUNK_EDGE * local.y);
};

export const localCellFromIndex = (index: number): LocalCellCoord => {
  if (!Number.isInteger(index) || index < 0 || index >= CHUNK_EDGE ** 3) {
    throw new Error("V2 local cell index is outside its chunk.");
  }
  const y = Math.floor(index / (CHUNK_EDGE * CHUNK_EDGE));
  const withinLayer = index - y * CHUNK_EDGE * CHUNK_EDGE;
  const z = Math.floor(withinLayer / CHUNK_EDGE);
  return { x: withinLayer - z * CHUNK_EDGE, y, z };
};

export const enumerateWorldChunks = (): readonly ChunkCoord[] => {
  const result: ChunkCoord[] = [];
  for (let y = WORLD_MIN_CHUNK_Y; y <= WORLD_MAX_CHUNK_Y; y += 1) {
    for (let z = WORLD_MIN_CHUNK_Z; z <= WORLD_MAX_CHUNK_Z; z += 1) {
      for (let x = WORLD_MIN_CHUNK_X; x <= WORLD_MAX_CHUNK_X; x += 1) result.push({ x, y, z });
    }
  }
  return result;
};

export const faceNeighbourCoords = (coord: ChunkCoord): readonly ChunkCoord[] => [
  { x: coord.x - 1, y: coord.y, z: coord.z },
  { x: coord.x + 1, y: coord.y, z: coord.z },
  { x: coord.x, y: coord.y - 1, z: coord.z },
  { x: coord.x, y: coord.y + 1, z: coord.z },
  { x: coord.x, y: coord.y, z: coord.z - 1 },
  { x: coord.x, y: coord.y, z: coord.z + 1 }
].filter((candidate) => isWorldChunk(candidate.x, candidate.y, candidate.z));

export const VOXEL_SIZE_METERS = 0.25;
export const CHUNK_EDGE = 32;
export const CHUNK_CELL_COUNT = CHUNK_EDGE ** 3;
export const HALO_EDGE = CHUNK_EDGE + 2;
export const HALO_CELL_COUNT = HALO_EDGE ** 3;

export const WORLD_MIN_CELL_X = -128;
export const WORLD_MAX_CELL_X = 127;
export const WORLD_MIN_CELL_Y = 0;
export const WORLD_MAX_CELL_Y = 127;
export const WORLD_MIN_CELL_Z = -128;
export const WORLD_MAX_CELL_Z = 127;

export const WORLD_MIN_CHUNK_X = -4;
export const WORLD_MAX_CHUNK_X = 3;
export const WORLD_MIN_CHUNK_Y = 0;
export const WORLD_MAX_CHUNK_Y = 3;
export const WORLD_MIN_CHUNK_Z = -4;
export const WORLD_MAX_CHUNK_Z = 3;

export const SEA_LEVEL_CELL = 14;
export const SEA_LEVEL_METERS = SEA_LEVEL_CELL * VOXEL_SIZE_METERS;
export const WORLD_VERSION = "hestia-voxel-v2-spike-v1";
export const DEFAULT_WORLD_SEED = "hestia-coast-river-v2-01";

export const isWorldCell = (x: number, y: number, z: number): boolean =>
  x >= WORLD_MIN_CELL_X && x <= WORLD_MAX_CELL_X
  && y >= WORLD_MIN_CELL_Y && y <= WORLD_MAX_CELL_Y
  && z >= WORLD_MIN_CELL_Z && z <= WORLD_MAX_CELL_Z;

export const isWorldChunk = (x: number, y: number, z: number): boolean =>
  x >= WORLD_MIN_CHUNK_X && x <= WORLD_MAX_CHUNK_X
  && y >= WORLD_MIN_CHUNK_Y && y <= WORLD_MAX_CHUNK_Y
  && z >= WORLD_MIN_CHUNK_Z && z <= WORLD_MAX_CHUNK_Z;

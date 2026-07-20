import { isStrictVoxelInteger } from "./ids";
import { VoxelContractError, voxelIssue, type VoxelCoordinate, type VoxelDimensions } from "./types";

export const VOXEL_BRICK_CELL_DIMENSIONS: VoxelDimensions = Object.freeze({ x: 32, y: 64, z: 32 });
export const VOXEL_BRICK_APRON_WIDTH = 1 as const;
export const VOXEL_BRICK_SAMPLE_DIMENSIONS: VoxelDimensions = Object.freeze({ x: 35, y: 67, z: 35 });

export const VOXEL_BRICK_CELL_COUNT = 32 * 64 * 32;
export const VOXEL_BRICK_SAMPLE_COUNT = 35 * 67 * 35;
export const VOXEL_DENSITY_BYTES = VOXEL_BRICK_SAMPLE_COUNT * Float32Array.BYTES_PER_ELEMENT;
export const VOXEL_MATERIAL_BYTES = VOXEL_BRICK_SAMPLE_COUNT * Uint8Array.BYTES_PER_ELEMENT;
export const VOXEL_CHANNEL_BYTES = VOXEL_DENSITY_BYTES + VOXEL_MATERIAL_BYTES;

export interface VoxelChannels {
  readonly densityBuffer: Float32Array;
  readonly materialBuffer: Uint8Array;
}

const failCoordinate = (path: string, message: string): never => {
  throw new VoxelContractError("Voxel sample coordinate is invalid", [voxelIssue("InvalidCoordinate", path, message)]);
};

const requireDimensions = (dimensions: VoxelDimensions): void => {
  for (const axis of ["x", "y", "z"] as const) {
    if (!isStrictVoxelInteger(dimensions[axis]) || dimensions[axis] <= 0) {
      throw new VoxelContractError("Voxel dimensions are invalid", [
        voxelIssue("InvalidDimensions", `dimensions.${axis}`, "must be a positive safe integer")
      ]);
    }
  }
};

/** Canonical X-fastest index: x + sizeX * (y + sizeY * z). */
export const xFastestIndex = (coordinate: VoxelCoordinate, dimensions: VoxelDimensions): number => {
  requireDimensions(dimensions);
  for (const axis of ["x", "y", "z"] as const) {
    const value = coordinate[axis];
    if (!isStrictVoxelInteger(value) || value < 0 || value >= dimensions[axis]) {
      return failCoordinate(`coordinate.${axis}`, `must be an integer from 0 through ${dimensions[axis] - 1}`);
    }
  }
  return coordinate.x + dimensions.x * (coordinate.y + dimensions.y * coordinate.z);
};

export const voxelSampleIndex = (coordinate: VoxelCoordinate): number =>
  xFastestIndex(coordinate, VOXEL_BRICK_SAMPLE_DIMENSIONS);

export const voxelSampleCoordinate = (index: number): VoxelCoordinate => {
  if (!isStrictVoxelInteger(index) || index < 0 || index >= VOXEL_BRICK_SAMPLE_COUNT) {
    return failCoordinate("index", `must be an integer from 0 through ${VOXEL_BRICK_SAMPLE_COUNT - 1}`);
  }
  const plane = VOXEL_BRICK_SAMPLE_DIMENSIONS.x * VOXEL_BRICK_SAMPLE_DIMENSIONS.y;
  const z = Math.floor(index / plane);
  const planeIndex = index - z * plane;
  const y = Math.floor(planeIndex / VOXEL_BRICK_SAMPLE_DIMENSIONS.x);
  const x = planeIndex - y * VOXEL_BRICK_SAMPLE_DIMENSIONS.x;
  return Object.freeze({ x, y, z });
};

export const allocateVoxelChannels = (): VoxelChannels => Object.freeze({
  densityBuffer: new Float32Array(VOXEL_BRICK_SAMPLE_COUNT),
  materialBuffer: new Uint8Array(VOXEL_BRICK_SAMPLE_COUNT)
});

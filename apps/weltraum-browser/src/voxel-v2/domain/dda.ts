import { VOXEL_SIZE_METERS } from "./constants";
import { VoxelMaterial } from "./palette";
import type { VoxelAuthority } from "./authority";
import type { CellCoord, Vec3 } from "./types";

export interface DdaHit {
  readonly cell: CellCoord;
  readonly material: number;
  readonly normal: CellCoord;
  readonly distanceMeters: number;
  readonly positionMeters: Vec3;
}

const finiteVec3 = (value: Vec3): boolean =>
  Number.isFinite(value.x) && Number.isFinite(value.y) && Number.isFinite(value.z);

export const raycastAuthority = (
  authority: VoxelAuthority,
  originMeters: Vec3,
  direction: Vec3,
  maxDistanceMeters: number
): DdaHit | null => {
  if (!finiteVec3(originMeters) || !finiteVec3(direction)) throw new Error("V2 DDA requires finite vectors.");
  if (!Number.isFinite(maxDistanceMeters) || maxDistanceMeters < 0) throw new Error("V2 DDA range must be non-negative.");
  const length = Math.hypot(direction.x, direction.y, direction.z);
  if (length <= Number.EPSILON) throw new Error("V2 DDA direction must be non-zero.");
  const ray = { x: direction.x / length, y: direction.y / length, z: direction.z / length };
  const cell = {
    x: Math.floor(originMeters.x / VOXEL_SIZE_METERS),
    y: Math.floor(originMeters.y / VOXEL_SIZE_METERS),
    z: Math.floor(originMeters.z / VOXEL_SIZE_METERS)
  };
  const step = { x: Math.sign(ray.x), y: Math.sign(ray.y), z: Math.sign(ray.z) };
  const tDelta = {
    x: step.x === 0 ? Number.POSITIVE_INFINITY : VOXEL_SIZE_METERS / Math.abs(ray.x),
    y: step.y === 0 ? Number.POSITIVE_INFINITY : VOXEL_SIZE_METERS / Math.abs(ray.y),
    z: step.z === 0 ? Number.POSITIVE_INFINITY : VOXEL_SIZE_METERS / Math.abs(ray.z)
  };
  const nextBoundary = (coordinate: number, stepDirection: number): number =>
    (stepDirection > 0 ? coordinate + 1 : coordinate) * VOXEL_SIZE_METERS;
  const tMax = {
    x: step.x === 0 ? Number.POSITIVE_INFINITY : (nextBoundary(cell.x, step.x) - originMeters.x) / ray.x,
    y: step.y === 0 ? Number.POSITIVE_INFINITY : (nextBoundary(cell.y, step.y) - originMeters.y) / ray.y,
    z: step.z === 0 ? Number.POSITIVE_INFINITY : (nextBoundary(cell.z, step.z) - originMeters.z) / ray.z
  };

  let distanceMeters = 0;
  let normal: CellCoord = { x: 0, y: 0, z: 0 };
  while (distanceMeters <= maxDistanceMeters) {
    const material = authority.getCell(cell);
    if (material !== VoxelMaterial.Air) {
      return {
        cell: { ...cell },
        material,
        normal,
        distanceMeters,
        positionMeters: {
          x: originMeters.x + ray.x * distanceMeters,
          y: originMeters.y + ray.y * distanceMeters,
          z: originMeters.z + ray.z * distanceMeters
        }
      };
    }

    const next = Math.min(tMax.x, tMax.y, tMax.z);
    if (!Number.isFinite(next) || next > maxDistanceMeters) return null;
    const epsilon = 1e-10;
    if (Math.abs(tMax.x - next) <= epsilon) {
      cell.x += step.x;
      tMax.x += tDelta.x;
      normal = { x: -step.x, y: 0, z: 0 };
    }
    if (Math.abs(tMax.y - next) <= epsilon) {
      cell.y += step.y;
      tMax.y += tDelta.y;
      if (normal.x === 0) normal = { x: 0, y: -step.y, z: 0 };
    }
    if (Math.abs(tMax.z - next) <= epsilon) {
      cell.z += step.z;
      tMax.z += tDelta.z;
      if (normal.x === 0 && normal.y === 0) normal = { x: 0, y: 0, z: -step.z };
    }
    distanceMeters = Math.max(0, next);
  }
  return null;
};

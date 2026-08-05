import {
  VOXEL_SIZE_METERS,
  WORLD_MAX_CELL_X,
  WORLD_MAX_CELL_Y,
  WORLD_MAX_CELL_Z,
  WORLD_MIN_CELL_X,
  WORLD_MIN_CELL_Y,
  WORLD_MIN_CELL_Z
} from "./constants";
import { paletteRecord } from "./palette";
import type { VoxelAuthority } from "./authority";
import type { Vec3 } from "./types";

export interface PlayerAabbDimensions {
  readonly halfWidth: number;
  readonly height: number;
}

export interface CollisionResult {
  readonly position: Vec3;
  readonly blockedX: boolean;
  readonly blockedY: boolean;
  readonly blockedZ: boolean;
  readonly grounded: boolean;
}

export const DEFAULT_PLAYER_AABB: PlayerAabbDimensions = Object.freeze({ halfWidth: 0.34, height: 1.75 });

const isSolid = (material: number): boolean => {
  const physicalClass = paletteRecord(material).physicalClass;
  return physicalClass !== "air" && physicalClass !== "flora";
};

const validateVec3 = (value: Vec3): void => {
  if (!Number.isFinite(value.x) || !Number.isFinite(value.y) || !Number.isFinite(value.z)) {
    throw new Error("V2 collision requires finite vectors.");
  }
};

export const isAuthorityAabbFree = (
  authority: VoxelAuthority,
  feetPosition: Vec3,
  dimensions: PlayerAabbDimensions = DEFAULT_PLAYER_AABB
): boolean => {
  validateVec3(feetPosition);
  if (
    !Number.isFinite(dimensions.halfWidth) || dimensions.halfWidth <= 0
    || !Number.isFinite(dimensions.height) || dimensions.height <= 0
  ) throw new Error("V2 player AABB dimensions must be positive.");
  const epsilon = 1e-7;
  const minX = Math.floor((feetPosition.x - dimensions.halfWidth) / VOXEL_SIZE_METERS);
  const maxX = Math.floor((feetPosition.x + dimensions.halfWidth - epsilon) / VOXEL_SIZE_METERS);
  const minY = Math.floor(feetPosition.y / VOXEL_SIZE_METERS);
  const maxY = Math.floor((feetPosition.y + dimensions.height - epsilon) / VOXEL_SIZE_METERS);
  const minZ = Math.floor((feetPosition.z - dimensions.halfWidth) / VOXEL_SIZE_METERS);
  const maxZ = Math.floor((feetPosition.z + dimensions.halfWidth - epsilon) / VOXEL_SIZE_METERS);
  if (
    minX < WORLD_MIN_CELL_X || maxX > WORLD_MAX_CELL_X
    || minY < WORLD_MIN_CELL_Y || maxY > WORLD_MAX_CELL_Y
    || minZ < WORLD_MIN_CELL_Z || maxZ > WORLD_MAX_CELL_Z
  ) return false;
  for (let y = minY; y <= maxY; y += 1) {
    for (let z = minZ; z <= maxZ; z += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        if (isSolid(authority.getCell({ x, y, z }))) return false;
      }
    }
  }
  return true;
};

const groundedAt = (authority: VoxelAuthority, position: Vec3, dimensions: PlayerAabbDimensions): boolean =>
  !isAuthorityAabbFree(authority, { ...position, y: position.y - 0.03 }, dimensions);

export const resolveAuthorityAabbMovement = (
  authority: VoxelAuthority,
  startFeetPosition: Vec3,
  displacementMeters: Vec3,
  dimensions: PlayerAabbDimensions = DEFAULT_PLAYER_AABB,
  stepHeightMeters = 0.5
): CollisionResult => {
  validateVec3(startFeetPosition);
  validateVec3(displacementMeters);
  if (!isAuthorityAabbFree(authority, startFeetPosition, dimensions)) throw new Error("V2 player starts inside solid authority occupancy.");
  if (!Number.isFinite(stepHeightMeters) || stepHeightMeters < 0 || stepHeightMeters > 0.5) {
    throw new Error("V2 step height must be between zero and 0.5 metres.");
  }
  const maxDisplacement = Math.max(
    Math.abs(displacementMeters.x),
    Math.abs(displacementMeters.y),
    Math.abs(displacementMeters.z)
  );
  const steps = Math.max(1, Math.ceil(maxDisplacement / (VOXEL_SIZE_METERS * 0.45)));
  const delta = {
    x: displacementMeters.x / steps,
    y: displacementMeters.y / steps,
    z: displacementMeters.z / steps
  };
  let position = { ...startFeetPosition };
  let blockedX = false;
  let blockedY = false;
  let blockedZ = false;

  const tryHorizontal = (axis: "x" | "z", amount: number): boolean => {
    if (amount === 0) return true;
    const candidate = { ...position, [axis]: position[axis] + amount };
    if (isAuthorityAabbFree(authority, candidate, dimensions)) {
      position = candidate;
      return true;
    }
    if (stepHeightMeters === 0 || !groundedAt(authority, position, dimensions)) return false;
    let stepped = { ...position, y: position.y + stepHeightMeters };
    if (!isAuthorityAabbFree(authority, stepped, dimensions)) return false;
    stepped = { ...stepped, [axis]: stepped[axis] + amount };
    if (!isAuthorityAabbFree(authority, stepped, dimensions)) return false;
    const drop = VOXEL_SIZE_METERS * 0.25;
    while (stepped.y - drop >= position.y) {
      const lowered = { ...stepped, y: stepped.y - drop };
      if (!isAuthorityAabbFree(authority, lowered, dimensions)) break;
      stepped = lowered;
    }
    position = stepped;
    return true;
  };

  for (let index = 0; index < steps; index += 1) {
    if (!tryHorizontal("x", delta.x)) blockedX = true;
    if (!tryHorizontal("z", delta.z)) blockedZ = true;
    if (delta.y !== 0) {
      const candidate = { ...position, y: position.y + delta.y };
      if (isAuthorityAabbFree(authority, candidate, dimensions)) position = candidate;
      else blockedY = true;
    }
  }

  return { position, blockedX, blockedY, blockedZ, grounded: groundedAt(authority, position, dimensions) };
};

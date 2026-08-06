import type { Vec3 } from "../domain/types";

/** Renderer-neutral candidate framing for the fixed V2 visual evidence views. */
export interface VoxelV2CameraPreset {
  readonly label: string;
  readonly position: Vec3;
  readonly target: Vec3;
  /** Vertical field of view in degrees. */
  readonly fov: number;
  readonly near: number;
  readonly far: number;
}

export const VOXEL_V2_CAMERA_PRESET_KEYS = Object.freeze([
  "coastal-valley",
  "archipelago-mountain",
  "wetland-roots",
  "first-person-spawn"
] as const);

export type VoxelV2CameraPresetKey = typeof VOXEL_V2_CAMERA_PRESET_KEYS[number];

/**
 * Candidate framing only; the repository owner approves visual composition at
 * the later screenshot gate. Positions deliberately keep near, mid and far
 * terrain in view instead of treating the world edge as the subject.
 */
export const VOXEL_V2_CAMERA_PRESETS: Readonly<Record<VoxelV2CameraPresetKey, VoxelV2CameraPreset>> = Object.freeze({
  "coastal-valley": Object.freeze({
    label: "Coastal Valley",
    position: Object.freeze({ x: -42, y: 26, z: 50 }),
    target: Object.freeze({ x: 4, y: 8, z: 2 }),
    fov: 58,
    near: 0.05,
    far: 320
  }),
  "archipelago-mountain": Object.freeze({
    label: "Archipelago / Mountain",
    position: Object.freeze({ x: 72, y: 42, z: -42 }),
    target: Object.freeze({ x: 38, y: 8, z: -14 }),
    fov: 55,
    near: 0.05,
    far: 320
  }),
  "wetland-roots": Object.freeze({
    label: "Wetland / Roots",
    position: Object.freeze({ x: -44, y: 22, z: -38 }),
    target: Object.freeze({ x: -8, y: 5, z: -6 }),
    fov: 52,
    near: 0.05,
    far: 220
  }),
  "first-person-spawn": Object.freeze({
    label: "First-Person Spawn",
    position: Object.freeze({ x: 8.625, y: 5.52, z: 14.125 }),
    target: Object.freeze({ x: 8.625, y: 5.3, z: 1.5 }),
    fov: 62,
    near: 0.05,
    far: 180
  })
});

export const getVoxelV2CameraPreset = (key: VoxelV2CameraPresetKey): VoxelV2CameraPreset => {
  if (!Object.hasOwn(VOXEL_V2_CAMERA_PRESETS, key)) {
    throw new Error(`Unknown Voxel V2 camera preset: ${key}`);
  }
  return VOXEL_V2_CAMERA_PRESETS[key];
};

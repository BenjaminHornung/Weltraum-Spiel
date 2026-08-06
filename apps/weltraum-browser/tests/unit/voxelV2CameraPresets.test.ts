import { describe, expect, it } from "vitest";
import {
  getVoxelV2CameraPreset,
  VOXEL_V2_CAMERA_PRESETS,
  VOXEL_V2_CAMERA_PRESET_KEYS,
  type VoxelV2CameraPresetKey
} from "../../src/voxel-v2/render-three/voxelV2CameraPresets";

describe("Voxel V2 camera presets", () => {
  it("contains exactly the four canonical views with frozen deterministic data", () => {
    expect(VOXEL_V2_CAMERA_PRESET_KEYS).toEqual([
      "coastal-valley",
      "archipelago-mountain",
      "wetland-roots",
      "first-person-spawn"
    ]);
    expect(Object.isFrozen(VOXEL_V2_CAMERA_PRESET_KEYS)).toBe(true);
    expect(Object.keys(VOXEL_V2_CAMERA_PRESETS)).toEqual([...VOXEL_V2_CAMERA_PRESET_KEYS]);
    expect(Object.isFrozen(VOXEL_V2_CAMERA_PRESETS)).toBe(true);

    for (const key of VOXEL_V2_CAMERA_PRESET_KEYS) {
      const preset = getVoxelV2CameraPreset(key);
      expect(Object.isFrozen(preset)).toBe(true);
      expect(Object.isFrozen(preset.position)).toBe(true);
      expect(Object.isFrozen(preset.target)).toBe(true);
      expect(getVoxelV2CameraPreset(key)).toBe(preset);
      expect(getVoxelV2CameraPreset(key)).toEqual(preset);
    }
  });

  it("uses distinct positions and targets with finite positive camera settings", () => {
    const presets = VOXEL_V2_CAMERA_PRESET_KEYS.map(getVoxelV2CameraPreset);
    const positions = new Set(presets.map(({ position }) => JSON.stringify(position)));
    const targets = new Set(presets.map(({ target }) => JSON.stringify(target)));

    expect(positions.size).toBe(VOXEL_V2_CAMERA_PRESET_KEYS.length);
    expect(targets.size).toBe(VOXEL_V2_CAMERA_PRESET_KEYS.length);
    for (const preset of presets) {
      for (const value of Object.values(preset.position)) expect(Number.isFinite(value)).toBe(true);
      for (const value of Object.values(preset.target)) expect(Number.isFinite(value)).toBe(true);
      expect(Number.isFinite(preset.fov)).toBe(true);
      expect(preset.fov).toBeGreaterThan(0);
      expect(preset.near).toBeGreaterThan(0);
      expect(preset.far).toBeGreaterThan(preset.near);
    }
  });

  it("rejects unknown keys without rewriting them", () => {
    expect(() => getVoxelV2CameraPreset("unknown" as VoxelV2CameraPresetKey)).toThrow("Unknown Voxel V2 camera preset");
    expect(() => getVoxelV2CameraPreset("__proto__" as VoxelV2CameraPresetKey)).toThrow("Unknown Voxel V2 camera preset");
  });
});

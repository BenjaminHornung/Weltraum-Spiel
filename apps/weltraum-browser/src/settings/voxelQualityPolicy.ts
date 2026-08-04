import {
  createVoxelQualityPolicy as createRepresentationVoxelQualityPolicy,
  type VoxelQualityPolicy
} from "../voxel/representation";
import type { GraphicsSettingsV2 } from "./types";

export type { VoxelQualityPolicy } from "../voxel/representation";

export function createVoxelQualityPolicy(settings: GraphicsSettingsV2): VoxelQualityPolicy {
  return createRepresentationVoxelQualityPolicy(settings.voxel);
}

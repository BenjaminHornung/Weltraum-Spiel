import { surfaceFrameId, voxelBodyId, voxelRegionId } from "../voxel";
import {
  HESTIA_GENERATOR_VERSION_V1,
  HESTIA_SOURCE_REVISION_V1
} from "../world-generation/hestia";
import {
  HESTIA_GENERATOR_VERSION_COAST_LUSH_V1
} from "../world-generation/hestia";
import {
  SURFACE_REGION_VOXEL_SCHEMA_VERSION,
  type SurfaceRegionVoxelAuthorityInput
} from "./voxel-edit";
import type { HestiaSurfaceWorldFacts } from "./world";

export const HESTIA_SURFACE_PLAY_FRAME_ORIGIN_METERS = Object.freeze({ x: 0, y: 0, z: 0 });

const residentBrickCoordinates = Object.freeze(
  [-4, -3, -2, -1].flatMap((z) => [2, 3, 4, 5].map((x) => Object.freeze({ x, y: 0, z })))
);

export const HESTIA_SURFACE_PLAY_V1_CONFIG: Readonly<SurfaceRegionVoxelAuthorityInput> = Object.freeze({
  schemaVersion: SURFACE_REGION_VOXEL_SCHEMA_VERSION,
  bodyId: voxelBodyId("planet.hestia"),
  surfaceFrameId: surfaceFrameId("frame:surface_hestia_surface_play_v1"),
  regionId: voxelRegionId("region:hestia.surface-play.v1"),
  generatorVersion: HESTIA_GENERATOR_VERSION_V1,
  seed: "hestia-surface-play-v1",
  voxelSizeMeters: 0.5,
  sourceRevision: HESTIA_SOURCE_REVISION_V1,
  brickBounds: Object.freeze({
    minInclusive: Object.freeze({ x: 2, y: 0, z: -4 }),
    maxExclusive: Object.freeze({ x: 6, y: 1, z: 0 })
  }),
  residentBrickCoordinates,
  maxSubtractRadiusMeters: 2,
  maxChangedSamplesPerEdit: 20_000
});

export const HESTIA_SURFACE_PLAY_COAST_LUSH_CONFIG: Readonly<SurfaceRegionVoxelAuthorityInput> = Object.freeze({
  ...HESTIA_SURFACE_PLAY_V1_CONFIG,
  surfaceFrameId: surfaceFrameId("frame:surface_hestia_surface_play_coast_lush_v1"),
  regionId: voxelRegionId("region:hestia.surface-play.coast-lush.v1"),
  generatorVersion: HESTIA_GENERATOR_VERSION_COAST_LUSH_V1,
  seed: "hestia-surface-play-coast-lush-v1",
  sourceRevision: HESTIA_SOURCE_REVISION_V1
});

export const createHestiaSurfacePlayAuthorityInput = (
  world: Readonly<HestiaSurfaceWorldFacts>,
  config: Readonly<SurfaceRegionVoxelAuthorityInput> = HESTIA_SURFACE_PLAY_V1_CONFIG
): Readonly<SurfaceRegionVoxelAuthorityInput> => {
  if (
    world.identity.bodyId !== config.bodyId
    || world.identity.regionId !== config.regionId
    || world.identity.surfaceFrameId !== config.surfaceFrameId
    || world.identity.regionRevision !== 0
  ) throw new TypeError("Selected Hestia Surface World identity does not match the configured authority source.");
  return Object.freeze({
    ...config,
    brickBounds: world.brickBounds,
    residentBrickCoordinates: world.residentBrickCoordinates
  });
};

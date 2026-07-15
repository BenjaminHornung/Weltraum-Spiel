import type { VoxelMaterialId } from "../../voxel";
import { HESTIA_MATERIAL_IDS, HESTIA_SEA_LEVEL_METERS } from "./preset";

export interface HestiaMaterialSample {
  readonly yMeters: number;
  readonly density: number;
  readonly surfaceHeight: number;
  readonly rockBreakup: number;
  readonly wetDepression: number;
  /** Separate biological fBm remapped to [0, 1]. */
  readonly biological: number;
}

const requireFiniteSample = (sample: HestiaMaterialSample): void => {
  for (const key of ["yMeters", "density", "surfaceHeight", "rockBreakup", "wetDepression", "biological"] as const) {
    if (!Number.isFinite(sample[key])) throw new RangeError(`${key} must be finite`);
  }
};

/** Normative V1 priority classifier. Every finite sample receives exactly one approved material ID. */
export const classifyHestiaMaterial = (sample: HestiaMaterialSample): VoxelMaterialId => {
  requireFiniteSample(sample);
  if (Math.abs(sample.yMeters - HESTIA_SEA_LEVEL_METERS) <= 0.75 && Math.abs(sample.density) <= 1.5) {
    return HESTIA_MATERIAL_IDS.ShallowWaterBoundary;
  }
  if (sample.surfaceHeight - sample.yMeters > 2.25 || Math.abs(sample.rockBreakup) >= 0.72) {
    return HESTIA_MATERIAL_IDS.SolidRock;
  }
  if (sample.wetDepression >= 0.58 || sample.surfaceHeight <= HESTIA_SEA_LEVEL_METERS + 1) {
    return HESTIA_MATERIAL_IDS.WetSoil;
  }
  if (Math.abs(sample.density) <= 1.25 && sample.biological >= 0.58) {
    return HESTIA_MATERIAL_IDS.DenseBiologicalSurface;
  }
  return HESTIA_MATERIAL_IDS.MossCover;
};

import { SURFACE_VOXEL_EDIT_QUANTUM_METERS } from "./voxel-edit";

export const quantizeSurfaceHitCoordinateMeters = (valueMeters: number): number => {
  if (!Number.isFinite(valueMeters)) {
    throw new RangeError("Surface hit coordinate must be finite.");
  }

  const scaled = valueMeters / SURFACE_VOXEL_EDIT_QUANTUM_METERS;
  const lower = Math.floor(scaled);
  const fraction = scaled - lower;
  const rounded = fraction < 0.5
    ? lower
    : fraction > 0.5
      ? lower + 1
      : lower % 2 === 0
        ? lower
        : lower + 1;
  const quantized = rounded * SURFACE_VOXEL_EDIT_QUANTUM_METERS;
  return quantized === 0 ? 0 : quantized;
};

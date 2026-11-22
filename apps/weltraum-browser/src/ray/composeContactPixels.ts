import type { ThreeSubmittedFrameMetadata } from "../render/three/backend/threeRenderBackend";
import type { CpuContactPass, Ray } from "./cpuContactPass";

/** Borrowed readbacks of the same linear HDR raster tile. The host owns the targets and final tone map.
 * Radiance buffers use RGBA strides. Indirect light already includes mandatory block AO. */
export interface LinearContactTile {
  readonly frame: ThreeSubmittedFrameMetadata;
  readonly width: number;
  readonly height: number;
  readonly raster: Float32Array;
  readonly direct: Float32Array;
  readonly indirect: Float32Array;
  readonly emissive: Float32Array;
}

export interface SurfaceContactRay {
  readonly pixel: number;
  readonly role: "opaque" | "foliage" | "water" | "background";
  readonly ray: Ray;
}

/** RT03-06 composeLinear / compose.wgsl. A short contact affects indirect light only.
 * Unresolved pixels retain the exact raster bytes. A withdrawn frame discards the entire staged tile. */
export function composeContactPixels(
  pass: CpuContactPass, tile: LinearContactTile, surfaces: readonly SurfaceContactRay[]
): Float32Array {
  const { frame, width, height, raster, direct, indirect, emissive } = tile;
  if (!pass.canPublish(frame)) return raster;
  const pixels = width * height;
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1 ||
      !Number.isSafeInteger(pixels * 4) ||
      [raster, direct, indirect, emissive].some(buffer => !(buffer instanceof Float32Array) || buffer.length !== pixels * 4)) {
    throw new RangeError("Invalid linear contact tile");
  }
  const seen = new Set<number>();
  let composed: Float32Array | undefined;
  for (const { pixel, role, ray } of surfaces) {
    if (!Number.isSafeInteger(pixel) || pixel < 0 || pixel >= pixels || seen.has(pixel)) {
      throw new RangeError("Invalid or duplicate contact pixel");
    }
    seen.add(pixel);
    if (role !== "opaque") continue;
    const sample = pass.sample(frame, ray);
    if (sample.kind === "RasterFallback") {
      if (sample.reason === "Unknown" || sample.reason === "BudgetExceeded") continue;
      return raster;
    }
    if (!sample.occluded) continue;
    const offset = pixel * 4;
    for (let channel = 0; channel < 3; channel++) {
      const i = offset + channel;
      if (![direct[i], indirect[i], emissive[i]].every(value => Number.isFinite(value) && value >= 0)) {
        throw new RangeError("Invalid linear radiance");
      }
    }
    composed ??= raster.slice();
    for (let channel = 0; channel < 3; channel++) {
      const i = offset + channel;
      const value = Math.fround(direct[i] + emissive[i]);
      if (!Number.isFinite(value)) throw new RangeError("Unrepresentable contact radiance");
      composed[i] = value;
    }
  }
  return composed && pass.canPublish(frame) ? composed : raster;
}

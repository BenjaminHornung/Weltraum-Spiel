import { SEA_LEVEL_METERS } from "../domain/constants";
import type { MacroWorldDescriptor } from "../domain/macroDescriptor";
import { sampleMacroWorld } from "../domain/macroDescriptor";
import type { MacroWorldSample } from "../domain/types";

export type VoxelV2RadialProjectionKind = "terrain" | "water";

export interface VoxelV2RadialProjectionOptions {
  readonly kind?: VoxelV2RadialProjectionKind;
  readonly centerX?: number;
  readonly centerZ?: number;
  readonly innerRadiusMeters?: number;
  readonly radiusMeters?: number;
  readonly radialSegments?: number;
  readonly rings?: number;
  readonly surfaceOffsetMeters?: number;
}

export interface VoxelV2RadialProjection {
  readonly kind: VoxelV2RadialProjectionKind;
  readonly centerX: number;
  readonly centerZ: number;
  readonly innerRadiusMeters: number;
  readonly radiusMeters: number;
  readonly radialSegments: number;
  readonly rings: number;
  readonly positions: Float32Array;
  readonly indices: Uint32Array;
  readonly colors: Uint8Array;
  readonly waterMask: Uint8Array;
  readonly waterVertexCount: number;
  readonly channelVertexCount: number;
}

const DEFAULT_RADIUS_METERS = 460;
const DEFAULT_RADIAL_SEGMENTS = 96;
const DEFAULT_RINGS = 18;

const clampByte = (value: number): number => Math.max(0, Math.min(255, Math.round(value)));

const colorFor = (sample: MacroWorldSample, kind: VoxelV2RadialProjectionKind): readonly [number, number, number] => {
  if (kind === "water") {
    const depth = Math.max(0, Math.min(1, sample.waterDepthMeters / 2.4));
    const base: readonly [number, number, number] = sample.isChannel
      ? [42, 178, 180]
      : sample.isShore
        ? [77, 194, 182]
        : sample.biome === "lagoon"
          ? [30, 154, 177]
          : [17, 104, 151];
    return [
      clampByte(base[0] + (1 - depth) * 18),
      clampByte(base[1] + (1 - depth) * 24),
      clampByte(base[2] + (1 - depth) * 22)
    ];
  }

  if (sample.isWater) return sample.isChannel ? [38, 135, 143] : [16, 83, 123];

  const base: readonly [number, number, number] = sample.terrainFamily === "rock" || sample.biome === "massif"
    ? [153, 145, 122]
    : sample.terrainFamily === "wet-rock"
      ? [74, 112, 92]
      : sample.biome === "wetland"
        ? [61, 126, 78]
        : sample.biome === "forest"
          ? [64, 133, 65]
          : sample.biome === "valley"
            ? [108, 151, 72]
            : sample.isShore
              ? [178, 166, 111]
              : sample.terrainFamily === "soil"
                ? [119, 103, 65]
                : [82, 132, 66];
  const tint = (sample.strataIndex - 1.5) * 4 + sample.curvature * 7 - sample.moisture * 3;
  return [clampByte(base[0] + tint), clampByte(base[1] + tint), clampByte(base[2] + tint * 0.7)];
};

const heightFor = (
  sample: MacroWorldSample,
  xMeters: number,
  zMeters: number,
  kind: VoxelV2RadialProjectionKind,
  surfaceOffsetMeters: number
): number => {
  if (kind === "water") {
    const wave = Math.sin(xMeters * 0.071 + zMeters * 0.037) * 0.026
      + Math.cos(xMeters * 0.043 - zMeters * 0.061) * 0.018
      + (sample.isChannel ? 0.012 : 0);
    return SEA_LEVEL_METERS + 0.045 + wave + surfaceOffsetMeters;
  }
  return sample.isWater
    ? SEA_LEVEL_METERS - Math.min(sample.waterDepthMeters, 2) * 0.08 + surfaceOffsetMeters
    : sample.surfaceHeightMeters + surfaceOffsetMeters;
};

const validateOptions = (options: Required<Pick<VoxelV2RadialProjectionOptions, "centerX" | "centerZ" | "innerRadiusMeters" | "radiusMeters" | "radialSegments" | "rings" | "surfaceOffsetMeters">>): void => {
  if (![options.centerX, options.centerZ, options.innerRadiusMeters, options.radiusMeters, options.surfaceOffsetMeters].every(Number.isFinite)) {
    throw new RangeError("Voxel V2 radial projection coordinates, radii and surface offset must be finite.");
  }
  if (options.radiusMeters <= 0) {
    throw new RangeError("Voxel V2 radial projection requires a positive radius, at least 8 segments and one ring.");
  }
  if (options.innerRadiusMeters < 0) throw new RangeError("Voxel V2 radial projection requires a non-negative inner radius.");
  if (options.innerRadiusMeters >= options.radiusMeters) {
    throw new RangeError("Voxel V2 radial projection requires an inner radius smaller than the outer radius.");
  }
  if (!Number.isInteger(options.radialSegments) || options.radialSegments < 8
    || !Number.isInteger(options.rings) || options.rings < 1) {
    throw new RangeError("Voxel V2 radial projection requires a positive radius, at least 8 segments and one ring.");
  }
};

export const createVoxelV2RadialProjection = (
  descriptor: MacroWorldDescriptor,
  options: VoxelV2RadialProjectionOptions = {}
): VoxelV2RadialProjection => {
  const resolved = {
    kind: options.kind ?? "terrain",
    centerX: options.centerX ?? 0,
    centerZ: options.centerZ ?? 0,
    innerRadiusMeters: options.innerRadiusMeters ?? 0,
    radiusMeters: options.radiusMeters ?? DEFAULT_RADIUS_METERS,
    radialSegments: options.radialSegments ?? DEFAULT_RADIAL_SEGMENTS,
    rings: options.rings ?? DEFAULT_RINGS,
    surfaceOffsetMeters: options.surfaceOffsetMeters ?? 0
  } as const;
  validateOptions(resolved);

  const hasCenter = resolved.innerRadiusMeters === 0;
  const ringCount = hasCenter ? resolved.rings : resolved.rings + 1;
  const firstRingStart = hasCenter ? 1 : 0;
  const positions = new Float32Array((firstRingStart + ringCount * resolved.radialSegments) * 3);
  const colors = new Uint8Array(positions.length);
  const waterMask = new Uint8Array(positions.length / 3);
  const indices: number[] = [];
  let waterVertexCount = 0;
  let channelVertexCount = 0;

  const writeVertex = (vertexIndex: number, radius: number, angle: number): void => {
    const xMeters = resolved.centerX + Math.cos(angle) * radius;
    const zMeters = resolved.centerZ + Math.sin(angle) * radius;
    const sample = sampleMacroWorld(descriptor, xMeters, zMeters);
    const positionIndex = vertexIndex * 3;
    positions[positionIndex] = xMeters;
    positions[positionIndex + 1] = heightFor(sample, xMeters, zMeters, resolved.kind, resolved.surfaceOffsetMeters);
    positions[positionIndex + 2] = zMeters;
    const color = colorFor(sample, resolved.kind);
    colors[positionIndex] = color[0];
    colors[positionIndex + 1] = color[1];
    colors[positionIndex + 2] = color[2];
    waterMask[vertexIndex] = sample.isWater ? 1 : 0;
    if (sample.isWater) waterVertexCount += 1;
    if (sample.isChannel) channelVertexCount += 1;
  };

  if (hasCenter) writeVertex(0, 0, 0);
  for (let ring = 0; ring < ringCount; ring += 1) {
    const radius = hasCenter
      ? resolved.radiusMeters * (ring + 1) / resolved.rings
      : resolved.innerRadiusMeters + (resolved.radiusMeters - resolved.innerRadiusMeters) * ring / resolved.rings;
    for (let segment = 0; segment < resolved.radialSegments; segment += 1) {
      writeVertex(firstRingStart + ring * resolved.radialSegments + segment, radius, segment / resolved.radialSegments * Math.PI * 2);
    }
  }

  const addTriangle = (first: number, second: number, third: number): void => {
    if (resolved.kind === "water" && (waterMask[first] === 0 || waterMask[second] === 0 || waterMask[third] === 0)) return;
    const firstOffset = first * 3;
    const secondOffset = second * 3;
    const thirdOffset = third * 3;
    const firstToSecondX = positions[secondOffset]! - positions[firstOffset]!;
    const firstToSecondZ = positions[secondOffset + 2]! - positions[firstOffset + 2]!;
    const firstToThirdX = positions[thirdOffset]! - positions[firstOffset]!;
    const firstToThirdZ = positions[thirdOffset + 2]! - positions[firstOffset + 2]!;
    const upFacing = firstToSecondZ * firstToThirdX - firstToSecondX * firstToThirdZ >= 0;
    indices.push(first, ...(upFacing ? [second, third] : [third, second]));
  };

  if (hasCenter) {
    for (let segment = 0; segment < resolved.radialSegments; segment += 1) {
      const current = firstRingStart + segment;
      const next = firstRingStart + (segment + 1) % resolved.radialSegments;
      addTriangle(0, next, current);
    }
  }

  for (let ring = 1; ring < ringCount; ring += 1) {
    const previousStart = firstRingStart + (ring - 1) * resolved.radialSegments;
    const currentStart = firstRingStart + ring * resolved.radialSegments;
    for (let segment = 0; segment < resolved.radialSegments; segment += 1) {
      const nextSegment = (segment + 1) % resolved.radialSegments;
      const previous = previousStart + segment;
      const previousNext = previousStart + nextSegment;
      const current = currentStart + segment;
      const currentNext = currentStart + nextSegment;
      addTriangle(previous, previousNext, current);
      addTriangle(previousNext, currentNext, current);
    }
  }

  return Object.freeze({
    kind: resolved.kind,
    centerX: resolved.centerX,
    centerZ: resolved.centerZ,
    innerRadiusMeters: resolved.innerRadiusMeters,
    radiusMeters: resolved.radiusMeters,
    radialSegments: resolved.radialSegments,
    rings: resolved.rings,
    positions,
    indices: new Uint32Array(indices),
    colors,
    waterMask,
    waterVertexCount,
    channelVertexCount
  });
};

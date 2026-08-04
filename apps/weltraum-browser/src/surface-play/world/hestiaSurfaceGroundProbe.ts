import type { Vec3 } from "../../core/vector";
import {
  createHestiaFieldContext,
  sampleHestiaDensityFields,
  sampleHestiaGroundSurface,
  sampleHestiaSurfaceFields,
  type HestiaFieldContext,
  type HestiaFieldIdentityInput,
  type HestiaSurfaceFields
} from "../../world-generation/hestia";
import type { SurfaceCapsule } from "../contracts";
import type { HestiaSurfaceGroundProbe, HestiaSurfaceGroundSample } from "./hestiaSurfaceWorld";

export interface HestiaSourceGroundProbeInput {
  readonly fieldIdentity: HestiaFieldIdentityInput;
  readonly capsule: SurfaceCapsule;
  readonly collisionSkinMeters: number;
}

const freezeVector = (value: Vec3): Vec3 => Object.freeze({ x: value.x, y: value.y, z: value.z });

const densityAt = (context: HestiaFieldContext, point: Vec3): number =>
  sampleHestiaDensityFields(
    context,
    point.x,
    point.y,
    point.z,
    sampleHestiaSurfaceFields(context, point.x, point.z)
  ).density;

const normalFromDensity = (
  point: Vec3,
  epsilonMeters: number,
  sampleDensity: (point: Vec3) => number
): Vec3 | null => {
  const components = (["x", "y", "z"] as const).map((axis) => {
    const negative = { ...point, [axis]: point[axis] - epsilonMeters };
    const positive = { ...point, [axis]: point[axis] + epsilonMeters };
    return sampleDensity(positive) - sampleDensity(negative);
  });
  const length = Math.hypot(components[0], components[1], components[2]);
  return Number.isFinite(length) && length > 1e-12
    ? freezeVector({ x: components[0] / length, y: components[1] / length, z: components[2] / length })
    : null;
};

const normalAt = (
  context: HestiaFieldContext,
  point: Vec3,
  epsilonMeters: number
): Vec3 | null => normalFromDensity(point, epsilonMeters, (sample) => densityAt(context, sample));

export const sampleHestiaSourceGroundGeometry = (
  context: HestiaFieldContext,
  xMeters: number,
  zMeters: number,
  gradientEpsilonMeters: number
): Readonly<Omit<HestiaSurfaceGroundSample, "capsuleClear">> | null => {
  if (![xMeters, zMeters, gradientEpsilonMeters].every(Number.isFinite) || gradientEpsilonMeters <= 0) return null;
  const ground = sampleHestiaGroundSurface(context, xMeters, zMeters);
  const point = freezeVector({ x: xMeters, y: ground.heightMeters, z: zMeters });
  const normal = normalAt(context, point, gradientEpsilonMeters);
  return normal === null ? null : Object.freeze({ heightMeters: ground.heightMeters, normal });
};

export const enumerateHestiaCapsuleClearanceSamplePoints = (input: Readonly<{
  xMeters: number;
  groundHeightMeters: number;
  zMeters: number;
  capsule: SurfaceCapsule;
  collisionSkinMeters: number;
  sampleSpacingMeters: number;
}>): readonly Vec3[] => {
  const { capsule } = input;
  if (![input.xMeters, input.groundHeightMeters, input.zMeters].every(Number.isFinite)) {
    throw new TypeError("Capsule clearance position must be finite.");
  }
  if (!(capsule.radiusMeters > 0) || capsule.heightMeters < capsule.radiusMeters * 2) {
    throw new TypeError("Capsule clearance geometry is invalid.");
  }
  if (!(input.collisionSkinMeters > 0) || input.collisionSkinMeters >= capsule.radiusMeters) {
    throw new TypeError("collisionSkinMeters must be positive and smaller than the capsule radius.");
  }
  if (!(input.sampleSpacingMeters > 0) || !Number.isFinite(input.sampleSpacingMeters)) {
    throw new TypeError("sampleSpacingMeters must be positive and finite.");
  }

  const points: Vec3[] = [];
  const seen = new Set<string>();
  const addPoint = (x: number, y: number, z: number): void => {
    const key = `${x.toFixed(12)}:${y.toFixed(12)}:${z.toFixed(12)}`;
    if (seen.has(key)) return;
    seen.add(key);
    points.push(freezeVector({ x, y, z }));
  };

  const ringRadius = capsule.radiusMeters - input.collisionSkinMeters;
  const ringSampleCount = Math.max(8, Math.ceil(2 * Math.PI * ringRadius / input.sampleSpacingMeters));
  const localRingHeights = [
    capsule.radiusMeters,
    capsule.heightMeters / 2,
    capsule.heightMeters - capsule.radiusMeters
  ];
  addPoint(input.xMeters, input.groundHeightMeters + input.collisionSkinMeters, input.zMeters);
  for (const localY of localRingHeights) {
    const y = input.groundHeightMeters + localY;
    addPoint(input.xMeters, y, input.zMeters);
    for (let ringIndex = 0; ringIndex < ringSampleCount; ringIndex += 1) {
      const angle = ringIndex * 2 * Math.PI / ringSampleCount;
      addPoint(
        input.xMeters + Math.cos(angle) * ringRadius,
        y,
        input.zMeters + Math.sin(angle) * ringRadius
      );
    }
  }
  addPoint(
    input.xMeters,
    input.groundHeightMeters + capsule.heightMeters - input.collisionSkinMeters,
    input.zMeters
  );
  points.sort((left, right) => left.y - right.y || left.z - right.z || left.x - right.x);
  return Object.freeze(points);
};

export const createHestiaSourceGroundProbe = (
  input: Readonly<HestiaSourceGroundProbeInput>
): Readonly<HestiaSurfaceGroundProbe> => {
  const context = createHestiaFieldContext(input.fieldIdentity);
  const epsilonMeters = input.fieldIdentity.voxelSizeMeters / 2;
  const cache = new Map<string, Readonly<HestiaSurfaceGroundSample> | null>();
  const surfaceCache = new Map<string, Readonly<HestiaSurfaceFields>>();
  const surfaceAt = (xMeters: number, zMeters: number): Readonly<HestiaSurfaceFields> => {
    const key = `${xMeters}:${zMeters}`;
    const cached = surfaceCache.get(key);
    if (cached !== undefined) return cached;
    const fields = Object.freeze(sampleHestiaSurfaceFields(context, xMeters, zMeters));
    surfaceCache.set(key, fields);
    return fields;
  };
  const cachedDensityAt = (point: Vec3): number => sampleHestiaDensityFields(
    context,
    point.x,
    point.y,
    point.z,
    surfaceAt(point.x, point.z)
  ).density;
  const sampleGround = (xMeters: number, zMeters: number): Readonly<HestiaSurfaceGroundSample> | null => {
    if (!Number.isFinite(xMeters) || !Number.isFinite(zMeters)) return null;
    const cacheKey = `${xMeters}:${zMeters}`;
    if (cache.has(cacheKey)) return cache.get(cacheKey) ?? null;
    const ground = sampleHestiaGroundSurface(context, xMeters, zMeters, surfaceAt(xMeters, zMeters));
    const normal = normalFromDensity(
      freezeVector({ x: xMeters, y: ground.heightMeters, z: zMeters }),
      epsilonMeters,
      cachedDensityAt
    );
    if (normal === null) {
      cache.set(cacheKey, null);
      return null;
    }
    const clearancePoints = enumerateHestiaCapsuleClearanceSamplePoints({
      xMeters,
      groundHeightMeters: ground.heightMeters,
      zMeters,
      capsule: input.capsule,
      collisionSkinMeters: input.collisionSkinMeters,
      sampleSpacingMeters: epsilonMeters
    });
    const sample = Object.freeze({
      heightMeters: ground.heightMeters,
      normal,
      capsuleClear: clearancePoints.every((sample) => cachedDensityAt(sample) >= -input.collisionSkinMeters)
    });
    cache.set(cacheKey, sample);
    return sample;
  };
  return Object.freeze({ sampleGround });
};

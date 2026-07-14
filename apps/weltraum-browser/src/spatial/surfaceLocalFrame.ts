import { createCelestialBodyId, type CelestialBodyId } from "../celestial/ids";
import type { CelestialBodyDefinition } from "../celestial/types";
import type { UniverseTime } from "../persistence/time";
import { canonicalizeSpatialValue, createSpatialSignature } from "./canonical";
import { failSpatial } from "./errors";
import { composeFrameState, createFrameTransformAtTime } from "./frameGraph";
import { createBodyFixedFrameId, parseFrameId, type FrameId } from "./ids";
import {
  createQuaternionFromBasis,
  crossSpatialVectors,
  dotSpatialVectors,
  scaleSpatialVector,
  spatialVector3,
  spatialVectorMagnitude
} from "./quaternion";
import {
  SPATIAL_BASIS_TOLERANCE,
  type FrameStateAtTime,
  type FrameTransformAtTime,
  type SpatialVector3
} from "./types";

const HALF_PI = Math.PI / 2;
const TWO_PI = 2 * Math.PI;

export interface SurfaceAnchorInput {
  readonly bodyId: CelestialBodyId | string;
  readonly latitudeRadians: number;
  readonly longitudeRadians: number;
  readonly altitudeMeters: number;
}

export interface SurfaceAnchor {
  readonly bodyId: CelestialBodyId;
  readonly latitudeRadians: number;
  readonly longitudeRadians: number;
  readonly altitudeMeters: number;
}

export interface SurfaceLocalFrameDefinitionInput {
  readonly frameId: FrameId | string;
  readonly parentFrameId?: FrameId | string;
  readonly anchor: SurfaceAnchorInput;
}

export interface SurfaceLocalFrameDefinition {
  readonly frameId: FrameId;
  readonly parentFrameId: FrameId;
  readonly kind: "SurfaceLocal";
  readonly anchor: SurfaceAnchor;
  readonly signature: string;
}

export interface SurfaceLocalFrameState extends FrameStateAtTime {
  readonly definition: SurfaceLocalFrameDefinition;
  readonly bodyFixedPositionMeters: SpatialVector3;
  readonly eastBodyFixed: SpatialVector3;
  readonly upBodyFixed: SpatialVector3;
  readonly southBodyFixed: SpatialVector3;
  readonly northBodyFixed: SpatialVector3;
}

const finite = (value: unknown, path: string): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return failSpatial("NONFINITE_VALUE", path, "Surface anchor values must be finite.");
  }
  return Object.is(value, -0) ? 0 : value;
};

const canonicalLongitude = (longitude: number): number => {
  const wrapped = ((longitude + Math.PI) % TWO_PI + TWO_PI) % TWO_PI - Math.PI;
  return Object.is(wrapped, -0) ? 0 : wrapped;
};

export const createSurfaceAnchor = (input: SurfaceAnchorInput): SurfaceAnchor => {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return failSpatial("INVALID_INPUT", "/anchor", "Surface anchor must be an object.");
  }
  const latitudeRadians = finite(input.latitudeRadians, "/anchor/latitudeRadians");
  const longitudeRadians = finite(input.longitudeRadians, "/anchor/longitudeRadians");
  const altitudeMeters = finite(input.altitudeMeters, "/anchor/altitudeMeters");
  if (latitudeRadians < -HALF_PI || latitudeRadians > HALF_PI) {
    return failSpatial("INVALID_SURFACE_ANCHOR", "/anchor/latitudeRadians", "Latitude must be within [-pi/2, pi/2].");
  }
  return Object.freeze({
    bodyId: createCelestialBodyId(input.bodyId, "/anchor/bodyId"),
    latitudeRadians,
    longitudeRadians: canonicalLongitude(longitudeRadians),
    altitudeMeters
  });
};

export const createSurfaceLocalFrameDefinition = (
  input: SurfaceLocalFrameDefinitionInput
): SurfaceLocalFrameDefinition => {
  const anchor = createSurfaceAnchor(input.anchor);
  const frameId = parseFrameId(input.frameId, "/frameId");
  const parentFrameId = parseFrameId(input.parentFrameId ?? createBodyFixedFrameId(anchor.bodyId), "/parentFrameId");
  const canonical = { frameId, parentFrameId, kind: "SurfaceLocal" as const, anchor };
  return canonicalizeSpatialValue<SurfaceLocalFrameDefinition>({
    ...canonical,
    signature: createSpatialSignature(canonical)
  }) as SurfaceLocalFrameDefinition;
};

export interface SurfaceBasis {
  readonly east: SpatialVector3;
  readonly up: SpatialVector3;
  readonly south: SpatialVector3;
  readonly north: SpatialVector3;
}

export const computeSurfaceBasis = (anchor: SurfaceAnchorInput): SurfaceBasis => {
  const parsed = createSurfaceAnchor(anchor);
  const cosLatitude = Math.cos(parsed.latitudeRadians);
  const sinLatitude = Math.sin(parsed.latitudeRadians);
  const cosLongitude = Math.cos(parsed.longitudeRadians);
  const sinLongitude = Math.sin(parsed.longitudeRadians);
  const up = spatialVector3(cosLatitude * cosLongitude, cosLatitude * sinLongitude, sinLatitude);
  const east = spatialVector3(-sinLongitude, cosLongitude, 0);
  const north = spatialVector3(
    -sinLatitude * cosLongitude,
    -sinLatitude * sinLongitude,
    cosLatitude
  );
  const south = scaleSpatialVector(north, -1);
  const axes = [east, up, south];
  for (const axis of axes) {
    if (Math.abs(spatialVectorMagnitude(axis) - 1) > SPATIAL_BASIS_TOLERANCE) {
      return failSpatial("INVALID_SURFACE_ANCHOR", "/anchor", "Surface basis axis is not normalized.");
    }
  }
  if (
    Math.abs(dotSpatialVectors(east, up)) > SPATIAL_BASIS_TOLERANCE ||
    Math.abs(dotSpatialVectors(up, south)) > SPATIAL_BASIS_TOLERANCE ||
    Math.abs(dotSpatialVectors(south, east)) > SPATIAL_BASIS_TOLERANCE
  ) {
    return failSpatial("INVALID_SURFACE_ANCHOR", "/anchor", "Surface basis is not orthogonal.");
  }
  return Object.freeze({ east, up, south, north });
};

const assertCrossIdentity = (left: SpatialVector3, right: SpatialVector3, expected: SpatialVector3): void => {
  const actual = crossSpatialVectors(left, right);
  const error = spatialVectorMagnitude(spatialVector3(actual.x - expected.x, actual.y - expected.y, actual.z - expected.z));
  if (error > SPATIAL_BASIS_TOLERANCE) {
    failSpatial("INVALID_SURFACE_ANCHOR", "/anchor", "Surface basis violates the EUS handedness contract.");
  }
};

export const createSurfaceLocalFrameTransform = (
  definition: SurfaceLocalFrameDefinition,
  body: CelestialBodyDefinition,
  time: UniverseTime
): FrameTransformAtTime => {
  if (body.bodyId !== definition.anchor.bodyId) {
    return failSpatial("FRAME_MISMATCH", "/body/bodyId", "Surface anchor and body definition must match.");
  }
  const surfaceRadius = body.radiusMeters + definition.anchor.altitudeMeters;
  if (!Number.isFinite(surfaceRadius) || surfaceRadius <= 0) {
    return failSpatial("INVALID_SURFACE_ANCHOR", "/anchor/altitudeMeters", "Body radius plus altitude must be positive.");
  }
  const basis = computeSurfaceBasis(definition.anchor);
  assertCrossIdentity(basis.east, basis.up, basis.south);
  assertCrossIdentity(basis.up, basis.south, basis.east);
  assertCrossIdentity(basis.south, basis.east, basis.up);
  return createFrameTransformAtTime({
    frameId: definition.frameId,
    parentFrameId: definition.parentFrameId,
    time,
    translationMeters: scaleSpatialVector(basis.up, surfaceRadius),
    orientation: createQuaternionFromBasis(basis.east, basis.up, basis.south),
    originVelocityMetersPerSecond: spatialVector3(),
    angularVelocityRadiansPerSecond: spatialVector3()
  });
};

export const createSurfaceLocalFrameState = (
  definition: SurfaceLocalFrameDefinition,
  body: CelestialBodyDefinition,
  bodyFixedState: FrameStateAtTime,
  time: UniverseTime
): SurfaceLocalFrameState => {
  if (bodyFixedState.frameId !== definition.parentFrameId) {
    return failSpatial("FRAME_MISMATCH", "/bodyFixedState/frameId", "Surface frame parent must be the supplied BodyFixed frame.");
  }
  const transform = createSurfaceLocalFrameTransform(definition, body, time);
  const composed = composeFrameState(bodyFixedState, transform);
  const basis = computeSurfaceBasis(definition.anchor);
  return Object.freeze({
    ...composed,
    definition,
    bodyFixedPositionMeters: transform.translationMeters,
    eastBodyFixed: basis.east,
    upBodyFixed: basis.up,
    southBodyFixed: basis.south,
    northBodyFixed: basis.north
  });
};

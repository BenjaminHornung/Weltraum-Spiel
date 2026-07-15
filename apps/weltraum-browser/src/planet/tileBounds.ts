import type { Vec3 } from "../core/vector";
import { planetFaceUvToDirection } from "./cubeSphere";
import { createPlanetTileKey, planetTileCenterDirection, planetTileFaceUvBounds } from "./tileAddress";
import type { PlanetTileKey } from "./types";

/** Covers accumulated unit-vector round-off while remaining scale-independent. */
export const PLANET_TILE_ANGULAR_TOLERANCE_RADIANS = 64 * Number.EPSILON;
/** Minimum linear padding for a computed sphere, in authoritative body-space metres. */
export const PLANET_BOUNDING_SPHERE_MIN_TOLERANCE_METERS = 1e-9;
/** Relative linear padding for large body radii. */
export const PLANET_BOUNDING_SPHERE_RELATIVE_TOLERANCE = 64 * Number.EPSILON;

export type PlanetTileBoundsErrorCode =
  | "INVALID_BODY_RADIUS"
  | "INVALID_HEIGHT_RANGE"
  | "INVALID_BOUNDING_SPHERE"
  | "NON_FINITE_BOUND";

export class PlanetTileBoundsError extends Error {
  public constructor(
    public readonly code: PlanetTileBoundsErrorCode,
    message: string
  ) {
    super(message);
    this.name = "PlanetTileBoundsError";
  }
}

export interface PlanetBoundingSphere {
  readonly center: Vec3;
  readonly radiusMeters: number;
}

export interface PlanetTileBounds {
  readonly key: PlanetTileKey;
  readonly capAxis: Vec3;
  readonly angularExtentRadians: number;
  readonly minRadiusMeters: number;
  readonly maxRadiusMeters: number;
  readonly boundingSphere: PlanetBoundingSphere;
}

export interface CreatePlanetTileBoundsInput {
  readonly key: PlanetTileKey;
  readonly bodyRadiusMeters: number;
  readonly minHeightMeters: number;
  readonly maxHeightMeters: number;
}

const dot = (left: Vec3, right: Vec3): number =>
  left.x * right.x + left.y * right.y + left.z * right.z;

const crossMagnitude = (left: Vec3, right: Vec3): number => Math.hypot(
  left.y * right.z - left.z * right.y,
  left.z * right.x - left.x * right.z,
  left.x * right.y - left.y * right.x
);

const freezeVec3 = (value: Vec3): Vec3 => Object.freeze({ x: value.x, y: value.y, z: value.z });

const assertFiniteVec3 = (value: Vec3, label: string): void => {
  if (
    value === null ||
    typeof value !== "object" ||
    !Number.isFinite(value.x) ||
    !Number.isFinite(value.y) ||
    !Number.isFinite(value.z)
  ) {
    throw new PlanetTileBoundsError("INVALID_BOUNDING_SPHERE", `${label} must contain finite components.`);
  }
};

export const assertPlanetBoundingSphere = (sphere: PlanetBoundingSphere): void => {
  if (sphere === null || typeof sphere !== "object") {
    throw new PlanetTileBoundsError("INVALID_BOUNDING_SPHERE", "A planet bounding sphere is required.");
  }
  assertFiniteVec3(sphere.center, "Bounding-sphere center");
  if (!Number.isFinite(sphere.radiusMeters) || sphere.radiusMeters < 0) {
    throw new PlanetTileBoundsError(
      "INVALID_BOUNDING_SPHERE",
      "Bounding-sphere radius must be a finite non-negative number."
    );
  }
};

const radialDistanceFromAxisCenter = (
  radiusMeters: number,
  axisCenterRadiusMeters: number,
  angularExtentRadians: number
): number => Math.hypot(
  radiusMeters * Math.sin(angularExtentRadians),
  radiusMeters * Math.cos(angularExtentRadians) - axisCenterRadiusMeters
);

export const createPlanetTileBounds = (input: CreatePlanetTileBoundsInput): PlanetTileBounds => {
  if (input === null || typeof input !== "object") {
    throw new PlanetTileBoundsError("INVALID_BODY_RADIUS", "Planet tile bound input is required.");
  }
  const key = createPlanetTileKey(input.key);
  if (!Number.isFinite(input.bodyRadiusMeters) || input.bodyRadiusMeters <= 0) {
    throw new PlanetTileBoundsError("INVALID_BODY_RADIUS", "Body radius must be a finite positive number.");
  }
  if (
    !Number.isFinite(input.minHeightMeters) ||
    !Number.isFinite(input.maxHeightMeters) ||
    input.minHeightMeters > input.maxHeightMeters
  ) {
    throw new PlanetTileBoundsError(
      "INVALID_HEIGHT_RANGE",
      "Minimum and maximum heights must be finite and ordered."
    );
  }

  const minRadiusMeters = input.bodyRadiusMeters + input.minHeightMeters;
  const maxRadiusMeters = input.bodyRadiusMeters + input.maxHeightMeters;
  if (
    !Number.isFinite(minRadiusMeters) ||
    !Number.isFinite(maxRadiusMeters) ||
    minRadiusMeters <= 0 ||
    maxRadiusMeters < minRadiusMeters
  ) {
    throw new PlanetTileBoundsError(
      "INVALID_HEIGHT_RANGE",
      "Height range must produce finite positive radial extrema."
    );
  }

  const capAxis = planetTileCenterDirection(key);
  const uvBounds = planetTileFaceUvBounds(key);
  const corners = [
    [uvBounds.minU, uvBounds.minV],
    [uvBounds.maxU, uvBounds.minV],
    [uvBounds.minU, uvBounds.maxV],
    [uvBounds.maxU, uvBounds.maxV]
  ] as const;
  let maximumCornerAngle = 0;
  for (const [u, v] of corners) {
    const cornerDirection = planetFaceUvToDirection({ face: key.face, u, v });
    const angle = Math.atan2(crossMagnitude(capAxis, cornerDirection), dot(capAxis, cornerDirection));
    if (!Number.isFinite(angle)) {
      throw new PlanetTileBoundsError("NON_FINITE_BOUND", "Tile corner angle was non-finite.");
    }
    maximumCornerAngle = Math.max(maximumCornerAngle, angle);
  }
  const angularExtentRadians = maximumCornerAngle + PLANET_TILE_ANGULAR_TOLERANCE_RADIANS;

  const axisCenterRadiusMeters = minRadiusMeters + (maxRadiusMeters - minRadiusMeters) / 2;
  const sphereCenter = {
    x: capAxis.x * axisCenterRadiusMeters,
    y: capAxis.y * axisCenterRadiusMeters,
    z: capAxis.z * axisCenterRadiusMeters
  };
  const unpaddedRadius = Math.max(
    radialDistanceFromAxisCenter(minRadiusMeters, axisCenterRadiusMeters, angularExtentRadians),
    radialDistanceFromAxisCenter(maxRadiusMeters, axisCenterRadiusMeters, angularExtentRadians)
  );
  const linearTolerance = Math.max(
    PLANET_BOUNDING_SPHERE_MIN_TOLERANCE_METERS,
    maxRadiusMeters * PLANET_BOUNDING_SPHERE_RELATIVE_TOLERANCE
  );
  const sphereRadiusMeters = unpaddedRadius + linearTolerance;

  if (
    !Number.isFinite(angularExtentRadians) ||
    !Number.isFinite(axisCenterRadiusMeters) ||
    !Number.isFinite(sphereCenter.x) ||
    !Number.isFinite(sphereCenter.y) ||
    !Number.isFinite(sphereCenter.z) ||
    !Number.isFinite(sphereRadiusMeters)
  ) {
    throw new PlanetTileBoundsError("NON_FINITE_BOUND", "Tile bound calculation produced a non-finite value.");
  }

  return Object.freeze({
    key,
    capAxis: freezeVec3(capAxis),
    angularExtentRadians,
    minRadiusMeters,
    maxRadiusMeters,
    boundingSphere: Object.freeze({ center: freezeVec3(sphereCenter), radiusMeters: sphereRadiusMeters })
  });
};

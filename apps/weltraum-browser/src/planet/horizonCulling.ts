import { cross, dot, magnitude, scale, type Vec3 } from "../core/vector";

/** Angular slack used to retain horizon tangencies and near-tangency round-off. */
export const PLANET_HORIZON_DEFAULT_TOLERANCE_RADIANS = 1e-10;
export const PLANET_HORIZON_UNIT_VECTOR_TOLERANCE = 1e-12;

export type PlanetHorizonCullingErrorCode =
  | "INVALID_CAMERA_POSITION"
  | "INVALID_OCCLUDER"
  | "INVALID_TILE_CAP"
  | "INVALID_HORIZON_TOLERANCE"
  | "NON_FINITE_HORIZON_RESULT";

export class PlanetHorizonCullingError extends Error {
  public constructor(
    public readonly code: PlanetHorizonCullingErrorCode,
    message: string
  ) {
    super(message);
    this.name = "PlanetHorizonCullingError";
  }
}

export interface PlanetHorizonTileCap {
  readonly capAxis: Vec3;
  readonly angularExtentRadians: number;
  readonly maxRadiusMeters: number;
}

export interface PlanetHorizonCullingInput {
  readonly cameraPosition: Vec3;
  readonly bodyRadiusMeters: number;
  readonly conservativeHeightMarginMeters: number;
  readonly tileCap: PlanetHorizonTileCap;
  readonly angularToleranceRadians?: number;
}

export type PlanetHorizonCullingReason =
  | "indeterminate-camera-inside-body"
  | "indeterminate-insufficient-height-margin"
  | "retained-front-visible"
  | "retained-horizon-tangent-or-uncertain"
  | "culled-proven-behind-horizon";

export interface PlanetHorizonCullingResult {
  readonly culled: boolean;
  readonly reason: PlanetHorizonCullingReason;
  readonly cameraDistanceMeters: number;
  /** Physical radius that is guaranteed to be opaque. */
  readonly occluderRadiusMeters: number;
  readonly cameraToTileAxisAngleRadians: number;
  readonly nearestTileAngleRadians: number;
  /** Complete conservative center-angle threshold, including the tile's outer radius. */
  readonly horizonAngleRadians: number;
}

const stableTangentAngleRadians = (
  occluderRadiusMeters: number,
  radialDistanceMeters: number
): number => {
  const radiusRatio = occluderRadiusMeters / radialDistanceMeters;
  const tangentRatioSquared =
    ((radialDistanceMeters - occluderRadiusMeters) / radialDistanceMeters) *
    (1 + radiusRatio);
  return Math.atan2(
    Math.sqrt(Math.max(0, tangentRatioSquared)),
    radiusRatio
  );
};

const retainedIndeterminateResult = (
  reason: "indeterminate-camera-inside-body" | "indeterminate-insufficient-height-margin",
  cameraDistanceMeters: number,
  occluderRadiusMeters: number
): PlanetHorizonCullingResult => Object.freeze({
  culled: false,
  reason,
  cameraDistanceMeters,
  occluderRadiusMeters,
  cameraToTileAxisAngleRadians: 0,
  nearestTileAngleRadians: 0,
  horizonAngleRadians: 0
});

export const cullPlanetTileCapByHorizon = (
  input: PlanetHorizonCullingInput
): PlanetHorizonCullingResult => {
  if (input === null || typeof input !== "object") {
    throw new PlanetHorizonCullingError("INVALID_OCCLUDER", "Horizon-culling input is required.");
  }
  if (
    input.cameraPosition === null ||
    typeof input.cameraPosition !== "object" ||
    !Number.isFinite(input.cameraPosition.x) ||
    !Number.isFinite(input.cameraPosition.y) ||
    !Number.isFinite(input.cameraPosition.z)
  ) {
    throw new PlanetHorizonCullingError("INVALID_CAMERA_POSITION", "Camera position must contain finite components.");
  }
  if (
    !Number.isFinite(input.bodyRadiusMeters) ||
    input.bodyRadiusMeters <= 0 ||
    !Number.isFinite(input.conservativeHeightMarginMeters) ||
    input.conservativeHeightMarginMeters < 0
  ) {
    throw new PlanetHorizonCullingError(
      "INVALID_OCCLUDER",
      "Body radius must be positive and height margin must be a finite non-negative number."
    );
  }
  const tileCap = input.tileCap;
  if (
    tileCap === null ||
    typeof tileCap !== "object" ||
    tileCap.capAxis === null ||
    typeof tileCap.capAxis !== "object" ||
    !Number.isFinite(tileCap.capAxis.x) ||
    !Number.isFinite(tileCap.capAxis.y) ||
    !Number.isFinite(tileCap.capAxis.z) ||
    !Number.isFinite(tileCap.angularExtentRadians) ||
    tileCap.angularExtentRadians < 0 ||
    tileCap.angularExtentRadians > Math.PI ||
    !Number.isFinite(tileCap.maxRadiusMeters) ||
    tileCap.maxRadiusMeters <= 0
  ) {
    throw new PlanetHorizonCullingError("INVALID_TILE_CAP", "Tile cap must contain finite radial and angular values.");
  }
  const capAxisLength = magnitude(tileCap.capAxis);
  if (!Number.isFinite(capAxisLength) || Math.abs(capAxisLength - 1) > PLANET_HORIZON_UNIT_VECTOR_TOLERANCE) {
    throw new PlanetHorizonCullingError("INVALID_TILE_CAP", "Tile cap axis must be normalized.");
  }
  const angularToleranceRadians = input.angularToleranceRadians ?? PLANET_HORIZON_DEFAULT_TOLERANCE_RADIANS;
  if (!Number.isFinite(angularToleranceRadians) || angularToleranceRadians < 0) {
    throw new PlanetHorizonCullingError(
      "INVALID_HORIZON_TOLERANCE",
      "Horizon tolerance must be a finite non-negative angle."
    );
  }

  const occluderRadiusMeters = input.bodyRadiusMeters;
  const declaredEnvelopeRadiusMeters = input.bodyRadiusMeters + input.conservativeHeightMarginMeters;
  const cameraDistanceMeters = magnitude(input.cameraPosition);
  if (!Number.isFinite(declaredEnvelopeRadiusMeters) || !Number.isFinite(cameraDistanceMeters)) {
    throw new PlanetHorizonCullingError(
      "NON_FINITE_HORIZON_RESULT",
      "Horizon-culling radial calculation produced a non-finite value."
    );
  }
  if (cameraDistanceMeters <= occluderRadiusMeters) {
    return retainedIndeterminateResult(
      "indeterminate-camera-inside-body",
      cameraDistanceMeters,
      occluderRadiusMeters
    );
  }
  if (tileCap.maxRadiusMeters > declaredEnvelopeRadiusMeters) {
    return retainedIndeterminateResult(
      "indeterminate-insufficient-height-margin",
      cameraDistanceMeters,
      occluderRadiusMeters
    );
  }

  const cameraAxis = scale(input.cameraPosition, 1 / cameraDistanceMeters);
  const cameraToTileAxisAngleRadians = Math.atan2(
    magnitude(cross(cameraAxis, tileCap.capAxis)),
    dot(cameraAxis, tileCap.capAxis)
  );
  const outerTileRadiusMeters = Math.max(occluderRadiusMeters, tileCap.maxRadiusMeters);
  const horizonAngleRadians =
    stableTangentAngleRadians(occluderRadiusMeters, cameraDistanceMeters) +
    stableTangentAngleRadians(occluderRadiusMeters, outerTileRadiusMeters);
  const nearestTileAngleRadians = Math.max(
    0,
    cameraToTileAxisAngleRadians - tileCap.angularExtentRadians
  );
  if (
    !Number.isFinite(cameraToTileAxisAngleRadians) ||
    !Number.isFinite(horizonAngleRadians) ||
    !Number.isFinite(nearestTileAngleRadians)
  ) {
    throw new PlanetHorizonCullingError(
      "NON_FINITE_HORIZON_RESULT",
      "Horizon-culling angular calculation produced a non-finite value."
    );
  }

  const culled = nearestTileAngleRadians > horizonAngleRadians + angularToleranceRadians;
  const clearlyFront = nearestTileAngleRadians < horizonAngleRadians - angularToleranceRadians;
  return Object.freeze({
    culled,
    reason: culled
      ? "culled-proven-behind-horizon"
      : clearlyFront
        ? "retained-front-visible"
        : "retained-horizon-tangent-or-uncertain",
    cameraDistanceMeters,
    occluderRadiusMeters,
    cameraToTileAxisAngleRadians,
    nearestTileAngleRadians,
    horizonAngleRadians
  });
};

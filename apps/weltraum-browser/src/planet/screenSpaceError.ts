import type { Vec3 } from "../core/vector";
import { tilesPerPlanetFace } from "./tileAddress";
import { assertPlanetBoundingSphere, type PlanetBoundingSphere } from "./tileBounds";

export type PlanetScreenSpaceErrorCode =
  | "INVALID_CAMERA_POSITION"
  | "INVALID_GEOMETRIC_ERROR"
  | "INVALID_PROJECTION"
  | "INVALID_SPLIT_THRESHOLD"
  | "NON_FINITE_SSE";

export class PlanetScreenSpaceError extends Error {
  public constructor(
    public readonly code: PlanetScreenSpaceErrorCode,
    message: string
  ) {
    super(message);
    this.name = "PlanetScreenSpaceError";
  }
}

export type PlanetSseReason = "split-threshold-exceeded" | "at-or-below-split-threshold";

export interface PlanetScreenSpaceErrorInput {
  readonly geometricErrorMeters: number;
  readonly viewportHeightPixels: number;
  readonly verticalFovRadians: number;
  readonly cameraPosition: Vec3;
  readonly boundingSphere: PlanetBoundingSphere;
  readonly nearClampMeters: number;
  readonly splitThresholdPixels: number;
}

export interface PlanetScreenSpaceErrorResult {
  readonly ssePixels: number;
  readonly distanceToBoundMeters: number;
  readonly effectiveDistanceMeters: number;
  readonly projectionScalePixels: number;
  readonly shouldSplit: boolean;
  readonly reason: PlanetSseReason;
}

const assertFiniteCameraPosition = (cameraPosition: Vec3): void => {
  if (
    cameraPosition === null ||
    typeof cameraPosition !== "object" ||
    !Number.isFinite(cameraPosition.x) ||
    !Number.isFinite(cameraPosition.y) ||
    !Number.isFinite(cameraPosition.z)
  ) {
    throw new PlanetScreenSpaceError("INVALID_CAMERA_POSITION", "Camera position must contain finite components.");
  }
};

export const planetGeometricErrorAtLevel = (rootErrorMeters: number, level: number): number => {
  if (!Number.isFinite(rootErrorMeters) || rootErrorMeters < 0) {
    throw new PlanetScreenSpaceError(
      "INVALID_GEOMETRIC_ERROR",
      "Root geometric error must be a finite non-negative number."
    );
  }
  tilesPerPlanetFace(level);
  return rootErrorMeters * 2 ** -level;
};

export const calculatePlanetScreenSpaceError = (
  input: PlanetScreenSpaceErrorInput
): PlanetScreenSpaceErrorResult => {
  if (input === null || typeof input !== "object") {
    throw new PlanetScreenSpaceError("INVALID_PROJECTION", "Screen-space-error input is required.");
  }
  assertFiniteCameraPosition(input.cameraPosition);
  assertPlanetBoundingSphere(input.boundingSphere);
  if (!Number.isFinite(input.geometricErrorMeters) || input.geometricErrorMeters < 0) {
    throw new PlanetScreenSpaceError(
      "INVALID_GEOMETRIC_ERROR",
      "Geometric error must be a finite non-negative number."
    );
  }
  if (
    !Number.isFinite(input.viewportHeightPixels) ||
    input.viewportHeightPixels <= 0 ||
    !Number.isFinite(input.verticalFovRadians) ||
    input.verticalFovRadians <= 0 ||
    input.verticalFovRadians >= Math.PI ||
    !Number.isFinite(input.nearClampMeters) ||
    input.nearClampMeters <= 0
  ) {
    throw new PlanetScreenSpaceError(
      "INVALID_PROJECTION",
      "Viewport height and near clamp must be positive and vertical FOV must be in (0, pi)."
    );
  }
  if (!Number.isFinite(input.splitThresholdPixels) || input.splitThresholdPixels < 0) {
    throw new PlanetScreenSpaceError(
      "INVALID_SPLIT_THRESHOLD",
      "Split threshold must be a finite non-negative number."
    );
  }

  const centerDistance = Math.hypot(
    input.cameraPosition.x - input.boundingSphere.center.x,
    input.cameraPosition.y - input.boundingSphere.center.y,
    input.cameraPosition.z - input.boundingSphere.center.z
  );
  const distanceToBoundMeters = Math.max(0, centerDistance - input.boundingSphere.radiusMeters);
  const effectiveDistanceMeters = Math.max(distanceToBoundMeters, input.nearClampMeters);
  const projectionScalePixels = input.viewportHeightPixels / (2 * Math.tan(input.verticalFovRadians / 2));
  const ssePixels = (input.geometricErrorMeters / effectiveDistanceMeters) * projectionScalePixels;
  if (
    !Number.isFinite(centerDistance) ||
    !Number.isFinite(distanceToBoundMeters) ||
    !Number.isFinite(effectiveDistanceMeters) ||
    !Number.isFinite(projectionScalePixels) ||
    !Number.isFinite(ssePixels)
  ) {
    throw new PlanetScreenSpaceError("NON_FINITE_SSE", "Screen-space-error calculation produced a non-finite value.");
  }

  const shouldSplit = ssePixels > input.splitThresholdPixels;
  return Object.freeze({
    ssePixels,
    distanceToBoundMeters,
    effectiveDistanceMeters,
    projectionScalePixels,
    shouldSplit,
    reason: shouldSplit ? "split-threshold-exceeded" : "at-or-below-split-threshold"
  });
};

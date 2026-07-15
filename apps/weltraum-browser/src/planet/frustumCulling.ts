import type { Vec3 } from "../core/vector";
import { assertPlanetBoundingSphere, type PlanetBoundingSphere } from "./tileBounds";

/** One micrometre of body-space slack keeps numerical tangencies retained. */
export const PLANET_FRUSTUM_DEFAULT_TOLERANCE_METERS = 1e-6;
export const PLANET_FRUSTUM_PLANE_NORMAL_TOLERANCE = 1e-12;

export type PlanetFrustumCullingErrorCode =
  | "INVALID_FRUSTUM"
  | "INVALID_FRUSTUM_PLANE"
  | "INVALID_FRUSTUM_TOLERANCE"
  | "NON_FINITE_FRUSTUM_DISTANCE";

export class PlanetFrustumCullingError extends Error {
  public constructor(
    public readonly code: PlanetFrustumCullingErrorCode,
    message: string
  ) {
    super(message);
    this.name = "PlanetFrustumCullingError";
  }
}

export interface PlanetFrustumPlane {
  readonly normal: Vec3;
  readonly constantMeters: number;
}

export type PlanetFrustumCullingReason = "culled-fully-outside-plane" | "retained-intersecting-or-inside";

export interface PlanetFrustumCullingResult {
  readonly culled: boolean;
  readonly reason: PlanetFrustumCullingReason;
  readonly decisivePlaneIndex: number | null;
  readonly signedCenterDistanceMeters: number;
}

const validatePlane = (plane: PlanetFrustumPlane, index: number): number => {
  if (
    plane === null ||
    typeof plane !== "object" ||
    plane.normal === null ||
    typeof plane.normal !== "object" ||
    !Number.isFinite(plane.normal.x) ||
    !Number.isFinite(plane.normal.y) ||
    !Number.isFinite(plane.normal.z) ||
    !Number.isFinite(plane.constantMeters)
  ) {
    throw new PlanetFrustumCullingError(
      "INVALID_FRUSTUM_PLANE",
      `Frustum plane ${index} must contain finite plain-data values.`
    );
  }
  const normalLength = Math.hypot(plane.normal.x, plane.normal.y, plane.normal.z);
  if (!Number.isFinite(normalLength) || Math.abs(normalLength - 1) > PLANET_FRUSTUM_PLANE_NORMAL_TOLERANCE) {
    throw new PlanetFrustumCullingError(
      "INVALID_FRUSTUM_PLANE",
      `Frustum plane ${index} normal must be normalized.`
    );
  }
  return normalLength;
};

export const cullPlanetBoundingSphereByFrustum = (
  boundingSphere: PlanetBoundingSphere,
  planes: readonly PlanetFrustumPlane[],
  toleranceMeters = PLANET_FRUSTUM_DEFAULT_TOLERANCE_METERS
): PlanetFrustumCullingResult => {
  assertPlanetBoundingSphere(boundingSphere);
  if (!Array.isArray(planes) || planes.length === 0) {
    throw new PlanetFrustumCullingError("INVALID_FRUSTUM", "Frustum must contain at least one normalized plane.");
  }
  if (!Number.isFinite(toleranceMeters) || toleranceMeters < 0) {
    throw new PlanetFrustumCullingError(
      "INVALID_FRUSTUM_TOLERANCE",
      "Frustum tolerance must be a finite non-negative number."
    );
  }

  const planeNormalLengths: number[] = [];
  for (let index = 0; index < planes.length; index += 1) {
    planeNormalLengths.push(validatePlane(planes[index], index));
  }

  let nearestSignedDistance = Number.POSITIVE_INFINITY;
  for (let index = 0; index < planes.length; index += 1) {
    const plane = planes[index];
    const signedCenterDistanceMeters =
      (plane.normal.x * boundingSphere.center.x +
        plane.normal.y * boundingSphere.center.y +
        plane.normal.z * boundingSphere.center.z +
        plane.constantMeters) /
      planeNormalLengths[index];
    if (!Number.isFinite(signedCenterDistanceMeters)) {
      throw new PlanetFrustumCullingError(
        "NON_FINITE_FRUSTUM_DISTANCE",
        `Frustum plane ${index} produced a non-finite signed distance.`
      );
    }
    nearestSignedDistance = Math.min(nearestSignedDistance, signedCenterDistanceMeters);
    if (signedCenterDistanceMeters < -boundingSphere.radiusMeters - toleranceMeters) {
      return Object.freeze({
        culled: true,
        reason: "culled-fully-outside-plane",
        decisivePlaneIndex: index,
        signedCenterDistanceMeters
      });
    }
  }

  return Object.freeze({
    culled: false,
    reason: "retained-intersecting-or-inside",
    decisivePlaneIndex: null,
    signedCenterDistanceMeters: nearestSignedDistance
  });
};

import { rotateVectorByQuaternion } from "../../flight/flightController";
import type { Quaternion } from "../../core/types";
import { vec3 } from "../../core/vector";
import type { WorldCoordinate } from "../../world/frames";
import type { NavigationMapOrbit, NavigationMapViewportState } from "./contracts";

export interface NavigationMapPoint {
  readonly x: number;
  readonly y: number;
}

export interface NavigationMapOrientation {
  readonly requestedOrbit: NavigationMapOrbit;
  readonly effectiveOrbit: NavigationMapOrbit;
  readonly headingDegrees: number;
  readonly worldRotationDegrees: number;
  readonly shipMarkerRotationDegrees: number;
}

const DEGENERATE_FORWARD_EPSILON = 1e-8;

const normalizedDegrees = (degrees: number): number => {
  const normalized = degrees % 360;
  return Object.is(normalized, -0) ? 0 : normalized;
};

export const navigationMapHeadingDegrees = (orientation: Quaternion): number | null => {
  if (![orientation.x, orientation.y, orientation.z, orientation.w].every(Number.isFinite)) {
    throw new Error("Ship orientation must be finite");
  }
  const forward = rotateVectorByQuaternion(orientation, vec3(1, 0, 0));
  if (Math.hypot(forward.x, forward.z) <= DEGENERATE_FORWARD_EPSILON) {
    return null;
  }
  return normalizedDegrees(Math.atan2(forward.z, forward.x) * 180 / Math.PI);
};

export const navigationMapOrientation = (
  orientation: Quaternion,
  requestedOrbit: NavigationMapOrbit
): NavigationMapOrientation => {
  const heading = navigationMapHeadingDegrees(orientation);
  if (heading === null) {
    return Object.freeze({
      requestedOrbit,
      effectiveOrbit: "north-up" as const,
      headingDegrees: 0,
      worldRotationDegrees: 0,
      shipMarkerRotationDegrees: 90
    });
  }
  const rotation = normalizedDegrees(90 - heading);
  return Object.freeze({
    requestedOrbit,
    effectiveOrbit: requestedOrbit,
    headingDegrees: heading,
    worldRotationDegrees: requestedOrbit === "ship-up" ? rotation : 0,
    shipMarkerRotationDegrees: requestedOrbit === "ship-up" ? 0 : rotation
  });
};

export const rotateNavigationMapPoint = (
  point: NavigationMapPoint,
  center: NavigationMapPoint,
  clockwiseDegrees: number
): NavigationMapPoint => {
  if (![point.x, point.y, center.x, center.y, clockwiseDegrees].every(Number.isFinite)) {
    throw new Error("Navigation map rotation values must be finite");
  }
  if (clockwiseDegrees === 0) {
    return { ...point };
  }
  const radians = -clockwiseDegrees * Math.PI / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  const x = point.x - center.x;
  const y = point.y - center.y;
  return {
    x: center.x + x * cosine - y * sine,
    y: center.y + x * sine + y * cosine
  };
};

export const projectNavigationMapPosition = (
  position: WorldCoordinate,
  viewport: NavigationMapViewportState,
  viewportSize: { readonly width: number; readonly height: number },
  worldRotationDegrees = 0
): NavigationMapPoint => {
  if (position.kind !== "WorldCoordinate" || position.frame.type !== "AbsoluteSystem") {
    throw new Error("Navigation map projection requires an absolute WorldCoordinate");
  }
  if (![viewportSize.width, viewportSize.height].every((value) => Number.isFinite(value) && value > 0)) {
    throw new Error("Navigation map viewport dimensions must be finite and positive");
  }
  if (!Number.isFinite(viewport.metersPerPixel) || viewport.metersPerPixel <= 0) {
    throw new Error("Navigation map metersPerPixel must be finite and positive");
  }

  const relative = {
    x: position.value.x - viewport.centerAbsoluteX,
    y: -(position.value.z - viewport.centerAbsoluteZ)
  };
  const rotated = rotateNavigationMapPoint(relative, { x: 0, y: 0 }, worldRotationDegrees);
  return Object.freeze({
    x: viewportSize.width / 2 + rotated.x / viewport.metersPerPixel,
    y: viewportSize.height / 2 + rotated.y / viewport.metersPerPixel
  });
};

import { cross, finiteNumber, identifier, magnitude, normalizeZero, positiveFiniteNumber, revision, vector3 } from "./internal";
import {
  SURFACE_ANCHOR_SCHEMA,
  SURFACE_BODY_SHAPE_SCHEMA,
  SURFACE_LOCAL_FRAME_SCHEMA_VERSION,
  SurfaceLocalFrameError,
  type SurfaceAnchor,
  type SurfaceBodyShape,
  type SurfaceFrameBasis,
  type SurfaceGeodeticCoordinates,
  type SurfaceVector3
} from "./types";

export const GEODETIC_INVERSE_MAX_ITERATIONS = 16 as const;
export const GEODETIC_INVERSE_ANGULAR_TOLERANCE_RADIANS = 1e-13 as const;
export const GEODETIC_INVERSE_CARTESIAN_RESIDUAL_TOLERANCE_METERS = 1e-7 as const;

const HALF_PI = Math.PI / 2;
const TWO_PI = Math.PI * 2;

export interface CreateSurfaceBodyShapeInput {
  readonly bodyId: string;
  readonly bodyFixedFrameId: string;
  readonly revision: number;
  readonly semiMajorAxisMeters: number;
  readonly semiMinorAxisMeters: number;
}

export interface CreateSurfaceAnchorInput {
  readonly bodyId: string;
  readonly bodyFixedFrameId: string;
  readonly anchorId: string;
  readonly revision: number;
  readonly shape: SurfaceBodyShape;
  readonly latitudeRadians: number;
  readonly longitudeRadians: number;
  readonly ellipsoidalHeightMeters: number;
}

export const canonicalLongitudeRadians = (longitudeRadians: number): number => {
  const longitude = finiteNumber(longitudeRadians, "Longitude");
  const wrapped = ((longitude + Math.PI) % TWO_PI + TWO_PI) % TWO_PI - Math.PI;
  return normalizeZero(wrapped >= Math.PI ? -Math.PI : wrapped);
};

const checkedLatitude = (latitudeRadians: number): number => {
  const latitude = finiteNumber(latitudeRadians, "Latitude");
  if (latitude < -HALF_PI || latitude > HALF_PI) {
    throw new SurfaceLocalFrameError("InvalidAnchor", "Latitude must be within [-pi/2, pi/2].");
  }
  return latitude;
};

export const createSurfaceBodyShape = (input: CreateSurfaceBodyShapeInput): SurfaceBodyShape => {
  const semiMajorAxisMeters = positiveFiniteNumber(input.semiMajorAxisMeters, "Semi-major axis");
  const semiMinorAxisMeters = positiveFiniteNumber(input.semiMinorAxisMeters, "Semi-minor axis");
  if (semiMinorAxisMeters > semiMajorAxisMeters) {
    throw new SurfaceLocalFrameError("InvalidShape", "Surface body shape must be spherical or oblate, not prolate.");
  }
  const ratio = semiMinorAxisMeters / semiMajorAxisMeters;
  const firstEccentricitySquared = finiteNumber(1 - ratio * ratio, "First eccentricity squared");
  return Object.freeze({
    schema: SURFACE_BODY_SHAPE_SCHEMA,
    schemaVersion: SURFACE_LOCAL_FRAME_SCHEMA_VERSION,
    kind: semiMajorAxisMeters === semiMinorAxisMeters ? "Sphere" : "OblateEllipsoid",
    bodyId: identifier(input.bodyId, "Body ID"),
    bodyFixedFrameId: identifier(input.bodyFixedFrameId, "Body-fixed frame ID"),
    revision: revision(input.revision, "Body shape revision"),
    semiMajorAxisMeters,
    semiMinorAxisMeters,
    firstEccentricitySquared
  });
};

const assertShape = (shape: SurfaceBodyShape): void => {
  if (shape === null || typeof shape !== "object") {
    throw new SurfaceLocalFrameError("InvalidShape", "Surface body shape is required.");
  }
  const recreated = createSurfaceBodyShape(shape);
  if (
    shape.schema !== recreated.schema ||
    shape.schemaVersion !== recreated.schemaVersion ||
    shape.kind !== recreated.kind ||
    shape.firstEccentricitySquared !== recreated.firstEccentricitySquared
  ) {
    throw new SurfaceLocalFrameError("InvalidShape", "Surface body shape fields are inconsistent.");
  }
};

const canonicalGeodetic = (
  shape: SurfaceBodyShape,
  coordinates: SurfaceGeodeticCoordinates
): SurfaceGeodeticCoordinates => {
  const latitudeRadians = checkedLatitude(coordinates.latitudeRadians);
  const canonicalLongitude = canonicalLongitudeRadians(coordinates.longitudeRadians);
  const longitudeRadians = Math.abs(latitudeRadians) === HALF_PI ? 0 : canonicalLongitude;
  const ellipsoidalHeightMeters = finiteNumber(coordinates.ellipsoidalHeightMeters, "Ellipsoidal height");
  const minimumNormalRadiusOfCurvatureMeters = finiteNumber(
    shape.semiMinorAxisMeters * shape.semiMinorAxisMeters / shape.semiMajorAxisMeters,
    "Minimum normal radius of curvature"
  );
  if (ellipsoidalHeightMeters <= -minimumNormalRadiusOfCurvatureMeters) {
    throw new SurfaceLocalFrameError(
      "InvalidGeodeticHeight",
      `Ellipsoidal height must be strictly greater than ${String(-minimumNormalRadiusOfCurvatureMeters)} meters.`
    );
  }
  return Object.freeze({
    latitudeRadians: normalizeZero(latitudeRadians),
    longitudeRadians,
    ellipsoidalHeightMeters
  });
};

export const geodeticToBodyFixed = (
  shape: SurfaceBodyShape,
  coordinates: SurfaceGeodeticCoordinates
): SurfaceVector3 => {
  assertShape(shape);
  const geodetic = canonicalGeodetic(shape, coordinates);
  const { latitudeRadians: latitude, longitudeRadians: longitude, ellipsoidalHeightMeters: height } = geodetic;
  const sinLatitude = Math.sin(latitude);
  const cosLatitude = Math.abs(latitude) === HALF_PI ? 0 : Math.cos(latitude);
  const denominator = Math.sqrt(1 - shape.firstEccentricitySquared * sinLatitude * sinLatitude);
  const primeVerticalRadius = finiteNumber(shape.semiMajorAxisMeters / denominator, "Prime-vertical radius");
  const horizontalRadius = finiteNumber((primeVerticalRadius + height) * cosLatitude, "Horizontal geodetic radius");
  const x = horizontalRadius === 0 ? 0 : horizontalRadius * Math.cos(longitude);
  const y = horizontalRadius === 0 ? 0 : horizontalRadius * Math.sin(longitude);
  const z = (primeVerticalRadius * (1 - shape.firstEccentricitySquared) + height) * sinLatitude;
  return vector3({ x, y, z }, "Body-fixed position");
};

export const bodyFixedToGeodetic = (
  shape: SurfaceBodyShape,
  positionBodyFixedMeters: SurfaceVector3
): SurfaceGeodeticCoordinates => {
  assertShape(shape);
  const position = vector3(positionBodyFixedMeters, "Body-fixed position");
  const horizontal = finiteNumber(Math.hypot(position.x, position.y), "Horizontal body-fixed radius");
  if (horizontal === 0 && position.z === 0) {
    throw new SurfaceLocalFrameError("UndefinedCenter", "Geodetic coordinates are undefined at the body center.");
  }
  if (horizontal === 0) {
    return canonicalGeodetic(shape, {
      latitudeRadians: position.z > 0 ? HALF_PI : -HALF_PI,
      longitudeRadians: 0,
      ellipsoidalHeightMeters: finiteNumber(Math.abs(position.z) - shape.semiMinorAxisMeters, "Polar ellipsoidal height")
    });
  }

  const longitudeRadians = canonicalLongitudeRadians(Math.atan2(position.y, position.x));
  if (shape.firstEccentricitySquared === 0) {
    const radius = finiteNumber(Math.hypot(horizontal, position.z), "Spherical radius");
    return canonicalGeodetic(shape, {
      latitudeRadians: normalizeZero(Math.atan2(position.z, horizontal)),
      longitudeRadians,
      ellipsoidalHeightMeters: finiteNumber(radius - shape.semiMajorAxisMeters, "Spherical height")
    });
  }

  let latitude = Math.atan2(position.z, horizontal * (1 - shape.firstEccentricitySquared));
  let converged = false;
  for (let iteration = 0; iteration < GEODETIC_INVERSE_MAX_ITERATIONS; iteration += 1) {
    const sinLatitude = Math.sin(latitude);
    const primeVerticalRadius = shape.semiMajorAxisMeters /
      Math.sqrt(1 - shape.firstEccentricitySquared * sinLatitude * sinLatitude);
    const nextLatitude = Math.atan2(
      position.z + shape.firstEccentricitySquared * primeVerticalRadius * sinLatitude,
      horizontal
    );
    if (!Number.isFinite(nextLatitude)) {
      break;
    }
    const delta = Math.abs(nextLatitude - latitude);
    latitude = nextLatitude;
    if (delta <= GEODETIC_INVERSE_ANGULAR_TOLERANCE_RADIANS) {
      converged = true;
      break;
    }
  }
  if (!converged) {
    throw new SurfaceLocalFrameError("GeodeticNonConvergence", "Inverse geodetic conversion did not converge within 16 iterations.");
  }

  const sinLatitude = Math.sin(latitude);
  const cosLatitude = Math.cos(latitude);
  const primeVerticalRadius = shape.semiMajorAxisMeters /
    Math.sqrt(1 - shape.firstEccentricitySquared * sinLatitude * sinLatitude);
  const height = Math.abs(cosLatitude) >= Math.abs(sinLatitude)
    ? horizontal / cosLatitude - primeVerticalRadius
    : position.z / sinLatitude - primeVerticalRadius * (1 - shape.firstEccentricitySquared);
  const geodetic = canonicalGeodetic(shape, {
    latitudeRadians: latitude,
    longitudeRadians,
    ellipsoidalHeightMeters: height
  });
  const reconstructed = geodeticToBodyFixed(shape, geodetic);
  const residual = Math.hypot(
    reconstructed.x - position.x,
    reconstructed.y - position.y,
    reconstructed.z - position.z
  );
  const residualTolerance = Math.max(
    GEODETIC_INVERSE_CARTESIAN_RESIDUAL_TOLERANCE_METERS,
    shape.semiMajorAxisMeters * Number.EPSILON * 8
  );
  if (!Number.isFinite(residual) || residual > residualTolerance) {
    throw new SurfaceLocalFrameError(
      "GeodeticNonConvergence",
      `Inverse geodetic residual ${String(residual)} exceeded tolerance ${String(residualTolerance)}.`
    );
  }
  return geodetic;
};

const basisFor = (geodetic: SurfaceGeodeticCoordinates): SurfaceFrameBasis => {
  const latitude = geodetic.latitudeRadians;
  const longitude = geodetic.longitudeRadians;
  const sinLongitude = Math.sin(longitude);
  const cosLongitude = Math.cos(longitude);
  const sinLatitude = Math.sin(latitude);
  const cosLatitude = Math.abs(latitude) === HALF_PI ? 0 : Math.cos(latitude);
  const east = vector3({ x: -sinLongitude, y: cosLongitude, z: 0 }, "East basis");
  const up = vector3(
    { x: cosLatitude * cosLongitude, y: cosLatitude * sinLongitude, z: sinLatitude },
    "Up basis"
  );
  const south = cross(east, up);
  return Object.freeze({ east, up, south });
};

export const createSurfaceAnchor = (input: CreateSurfaceAnchorInput): SurfaceAnchor => {
  assertShape(input.shape);
  const bodyId = identifier(input.bodyId, "Anchor body ID");
  const bodyFixedFrameId = identifier(input.bodyFixedFrameId, "Anchor body-fixed frame ID");
  if (bodyId !== input.shape.bodyId || bodyFixedFrameId !== input.shape.bodyFixedFrameId) {
    throw new SurfaceLocalFrameError("AuthorityMismatch", "Anchor authority must match the body shape authority.");
  }
  const geodetic = canonicalGeodetic(input.shape, input);
  const bodyFixedPositionMeters = geodeticToBodyFixed(input.shape, geodetic);
  if (magnitude(bodyFixedPositionMeters) === 0) {
    throw new SurfaceLocalFrameError("UndefinedCenter", "A surface anchor cannot be located at the body center.");
  }
  return Object.freeze({
    schema: SURFACE_ANCHOR_SCHEMA,
    schemaVersion: SURFACE_LOCAL_FRAME_SCHEMA_VERSION,
    bodyId,
    bodyFixedFrameId,
    anchorId: identifier(input.anchorId, "Anchor ID"),
    revision: revision(input.revision, "Anchor revision"),
    geodetic,
    bodyFixedPositionMeters,
    basis: basisFor(geodetic)
  });
};

export const validateSurfaceBodyShape = assertShape;

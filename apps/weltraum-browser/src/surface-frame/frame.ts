import {
  add,
  cloneCanonicalValue,
  dot,
  finiteNumber,
  identifier,
  quaternion,
  revision,
  subtract,
  vector3
} from "./internal";
import { createSurfaceAnchor, createSurfaceBodyShape, validateSurfaceBodyShape } from "./geodetic";
import {
  SURFACE_LOCAL_FRAME_SCHEMA,
  SURFACE_LOCAL_FRAME_SCHEMA_VERSION,
  SurfaceLocalFrameError,
  type SurfaceAnchor,
  type SurfaceBodyShape,
  type SurfaceCanonicalValue,
  type SurfaceFrameBasis,
  type SurfaceLocalFrame,
  type SurfaceQuaternion,
  type SurfaceVector3
} from "./types";

export interface CreateSurfaceLocalFrameInput {
  readonly bodyId: string;
  readonly bodyFixedFrameId: string;
  readonly surfaceFrameId: string;
  readonly revision: number;
  readonly shape: SurfaceBodyShape;
  readonly anchor: SurfaceAnchor;
  readonly authorityContext?: SurfaceCanonicalValue;
}

const basisQuaternion = (basis: SurfaceFrameBasis): SurfaceQuaternion => {
  const m00 = basis.east.x;
  const m01 = basis.up.x;
  const m02 = basis.south.x;
  const m10 = basis.east.y;
  const m11 = basis.up.y;
  const m12 = basis.south.y;
  const m20 = basis.east.z;
  const m21 = basis.up.z;
  const m22 = basis.south.z;
  const trace = m00 + m11 + m22;
  let raw: SurfaceQuaternion;
  if (trace > 0) {
    const scale = Math.sqrt(trace + 1) * 2;
    raw = { x: (m21 - m12) / scale, y: (m02 - m20) / scale, z: (m10 - m01) / scale, w: scale / 4 };
  } else if (m00 > m11 && m00 > m22) {
    const scale = Math.sqrt(1 + m00 - m11 - m22) * 2;
    raw = { x: scale / 4, y: (m01 + m10) / scale, z: (m02 + m20) / scale, w: (m21 - m12) / scale };
  } else if (m11 > m22) {
    const scale = Math.sqrt(1 + m11 - m00 - m22) * 2;
    raw = { x: (m01 + m10) / scale, y: scale / 4, z: (m12 + m21) / scale, w: (m02 - m20) / scale };
  } else {
    const scale = Math.sqrt(1 + m22 - m00 - m11) * 2;
    raw = { x: (m02 + m20) / scale, y: (m12 + m21) / scale, z: scale / 4, w: (m10 - m01) / scale };
  }
  return quaternion(raw, "Surface frame orientation", false);
};

const nearlyEqual = (left: number, right: number, tolerance: number): boolean => Math.abs(left - right) <= tolerance;

const assertAnchor = (anchor: SurfaceAnchor, shape: SurfaceBodyShape): void => {
  if (
    anchor === null ||
    typeof anchor !== "object" ||
    anchor.geodetic === null ||
    typeof anchor.geodetic !== "object" ||
    anchor.basis === null ||
    typeof anchor.basis !== "object"
  ) {
    throw new SurfaceLocalFrameError("InvalidAnchor", "Surface anchor is required.");
  }
  const recreated = createSurfaceAnchor({
    bodyId: anchor.bodyId,
    bodyFixedFrameId: anchor.bodyFixedFrameId,
    anchorId: anchor.anchorId,
    revision: anchor.revision,
    shape,
    latitudeRadians: anchor.geodetic.latitudeRadians,
    longitudeRadians: anchor.geodetic.longitudeRadians,
    ellipsoidalHeightMeters: anchor.geodetic.ellipsoidalHeightMeters
  });
  const vectors: readonly [SurfaceVector3, SurfaceVector3][] = [
    [anchor.bodyFixedPositionMeters, recreated.bodyFixedPositionMeters],
    [anchor.basis.east, recreated.basis.east],
    [anchor.basis.up, recreated.basis.up],
    [anchor.basis.south, recreated.basis.south]
  ];
  if (
    anchor.schema !== recreated.schema ||
    anchor.schemaVersion !== recreated.schemaVersion ||
    vectors.some(([actual, expected]) =>
      actual === undefined ||
      !nearlyEqual(actual.x, expected.x, 1e-12) ||
      !nearlyEqual(actual.y, expected.y, 1e-12) ||
      !nearlyEqual(actual.z, expected.z, 1e-12)
    )
  ) {
    throw new SurfaceLocalFrameError("InvalidAnchor", "Surface anchor fields are inconsistent.");
  }
};

export const createSurfaceLocalFrame = (input: CreateSurfaceLocalFrameInput): SurfaceLocalFrame => {
  validateSurfaceBodyShape(input.shape);
  assertAnchor(input.anchor, input.shape);
  const bodyId = identifier(input.bodyId, "Frame body ID");
  const bodyFixedFrameId = identifier(input.bodyFixedFrameId, "Frame body-fixed frame ID");
  if (
    bodyId !== input.shape.bodyId ||
    bodyFixedFrameId !== input.shape.bodyFixedFrameId ||
    bodyId !== input.anchor.bodyId ||
    bodyFixedFrameId !== input.anchor.bodyFixedFrameId
  ) {
    throw new SurfaceLocalFrameError("AuthorityMismatch", "Frame, shape, and anchor authority must match.");
  }
  const shape = createSurfaceBodyShape(input.shape);
  const surfaceAnchor = createSurfaceAnchor({
    bodyId: input.anchor.bodyId,
    bodyFixedFrameId: input.anchor.bodyFixedFrameId,
    anchorId: input.anchor.anchorId,
    revision: input.anchor.revision,
    shape,
    latitudeRadians: input.anchor.geodetic.latitudeRadians,
    longitudeRadians: input.anchor.geodetic.longitudeRadians,
    ellipsoidalHeightMeters: input.anchor.geodetic.ellipsoidalHeightMeters
  });
  const result: SurfaceLocalFrame = {
    schema: SURFACE_LOCAL_FRAME_SCHEMA,
    schemaVersion: SURFACE_LOCAL_FRAME_SCHEMA_VERSION,
    bodyId,
    bodyFixedFrameId,
    surfaceFrameId: identifier(input.surfaceFrameId, "Surface frame ID"),
    revision: revision(input.revision, "Surface frame revision"),
    shape,
    anchor: surfaceAnchor,
    orientationLocalToBodyFixed: basisQuaternion(surfaceAnchor.basis),
    ...(input.authorityContext === undefined
      ? {}
      : { authorityContext: cloneCanonicalValue(input.authorityContext, "Frame authority context") })
  };
  return Object.freeze(result);
};

export const validateSurfaceLocalFrame = (frame: SurfaceLocalFrame): void => {
  if (
    frame === null ||
    typeof frame !== "object" ||
    frame.orientationLocalToBodyFixed === null ||
    typeof frame.orientationLocalToBodyFixed !== "object"
  ) {
    throw new SurfaceLocalFrameError("AuthorityMismatch", "Surface local frame is required.");
  }
  const recreated = createSurfaceLocalFrame(frame);
  const actual = frame.orientationLocalToBodyFixed;
  const expected = recreated.orientationLocalToBodyFixed;
  if (
    frame.schema !== recreated.schema ||
    frame.schemaVersion !== recreated.schemaVersion ||
    !nearlyEqual(actual.x, expected.x, 1e-12) ||
    !nearlyEqual(actual.y, expected.y, 1e-12) ||
    !nearlyEqual(actual.z, expected.z, 1e-12) ||
    !nearlyEqual(actual.w, expected.w, 1e-12)
  ) {
    throw new SurfaceLocalFrameError("AuthorityMismatch", "Surface local frame fields are inconsistent.");
  }
};

export const bodyFixedToSurfaceLocal = (
  positionBodyFixedMeters: SurfaceVector3,
  frame: SurfaceLocalFrame
): SurfaceVector3 => {
  validateSurfaceLocalFrame(frame);
  const offset = subtract(vector3(positionBodyFixedMeters, "Body-fixed position"), frame.anchor.bodyFixedPositionMeters);
  return vector3(
    {
      x: dot(offset, frame.anchor.basis.east),
      y: dot(offset, frame.anchor.basis.up),
      z: dot(offset, frame.anchor.basis.south)
    },
    "Surface-local position"
  );
};

export const surfaceLocalToBodyFixed = (
  positionLocalMeters: SurfaceVector3,
  frame: SurfaceLocalFrame
): SurfaceVector3 => {
  validateSurfaceLocalFrame(frame);
  const local = vector3(positionLocalMeters, "Surface-local position");
  const basis = frame.anchor.basis;
  return add(
    frame.anchor.bodyFixedPositionMeters,
    vector3(
      {
        x: basis.east.x * local.x + basis.up.x * local.y + basis.south.x * local.z,
        y: basis.east.y * local.x + basis.up.y * local.y + basis.south.y * local.z,
        z: basis.east.z * local.x + basis.up.z * local.y + basis.south.z * local.z
      },
      "Body-fixed position offset"
    )
  );
};

export const transformDirectionBodyFixedToLocal = (
  directionBodyFixed: SurfaceVector3,
  frame: SurfaceLocalFrame
): SurfaceVector3 => {
  validateSurfaceLocalFrame(frame);
  const direction = vector3(directionBodyFixed, "Body-fixed direction");
  return vector3(
    {
      x: dot(direction, frame.anchor.basis.east),
      y: dot(direction, frame.anchor.basis.up),
      z: dot(direction, frame.anchor.basis.south)
    },
    "Surface-local direction"
  );
};

export const transformDirectionLocalToBodyFixed = (
  directionLocal: SurfaceVector3,
  frame: SurfaceLocalFrame
): SurfaceVector3 => {
  validateSurfaceLocalFrame(frame);
  const direction = vector3(directionLocal, "Surface-local direction");
  const basis = frame.anchor.basis;
  return vector3(
    {
      x: basis.east.x * direction.x + basis.up.x * direction.y + basis.south.x * direction.z,
      y: basis.east.y * direction.x + basis.up.y * direction.y + basis.south.y * direction.z,
      z: basis.east.z * direction.x + basis.up.z * direction.y + basis.south.z * direction.z
    },
    "Body-fixed direction"
  );
};

export const surfaceFrameOrientationLocalToBodyFixed = basisQuaternion;

export const assertFiniteRotationDeterminant = (basis: SurfaceFrameBasis): number => {
  const determinant = finiteNumber(dot(basis.east, {
    x: basis.up.y * basis.south.z - basis.up.z * basis.south.y,
    y: basis.up.z * basis.south.x - basis.up.x * basis.south.z,
    z: basis.up.x * basis.south.y - basis.up.y * basis.south.x
  }), "Surface frame determinant");
  return determinant;
};

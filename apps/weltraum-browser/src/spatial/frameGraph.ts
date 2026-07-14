import type { UniverseTime } from "../persistence/time";
import { failSpatial } from "./errors";
import { assertSameUniverseTime, cloneUniverseTime } from "./frameValidation";
import { parseFrameId, type FrameId } from "./ids";
import {
  addSpatialVectors,
  createSpatialQuaternion,
  createSpatialVector3,
  crossSpatialVectors,
  IDENTITY_SPATIAL_QUATERNION,
  multiplySpatialQuaternions,
  rotateSpatialVector,
  spatialVector3,
  ZERO_SPATIAL_VECTOR
} from "./quaternion";
import type { FrameStateAtTime, FrameTransformAtTime } from "./types";

export interface FrameTransformInput {
  readonly frameId: FrameId | string;
  readonly parentFrameId: FrameId | string;
  readonly time: UniverseTime;
  readonly translationMeters: unknown;
  readonly orientation: unknown;
  readonly originVelocityMetersPerSecond: unknown;
  readonly angularVelocityRadiansPerSecond: unknown;
}

export interface FrameStateInput {
  readonly frameId: FrameId | string;
  readonly systemFrameId: FrameId | string;
  readonly time: UniverseTime;
  readonly originPositionMeters: unknown;
  readonly orientation: unknown;
  readonly originVelocityMetersPerSecond: unknown;
  readonly angularVelocityRadiansPerSecond: unknown;
}

export const createFrameTransformAtTime = (input: FrameTransformInput): FrameTransformAtTime => {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return failSpatial("INVALID_INPUT", "", "Frame transform must be an object.");
  }
  const frameId = parseFrameId(input.frameId, "/frameId");
  const parentFrameId = parseFrameId(input.parentFrameId, "/parentFrameId");
  if (frameId === parentFrameId) {
    return failSpatial("FRAME_MISMATCH", "/parentFrameId", "A frame cannot be its own parent.");
  }
  return Object.freeze({
    frameId,
    parentFrameId,
    time: cloneUniverseTime(input.time),
    translationMeters: createSpatialVector3(input.translationMeters, "/translationMeters"),
    orientation: createSpatialQuaternion(input.orientation, "/orientation"),
    originVelocityMetersPerSecond: createSpatialVector3(
      input.originVelocityMetersPerSecond,
      "/originVelocityMetersPerSecond"
    ),
    angularVelocityRadiansPerSecond: createSpatialVector3(
      input.angularVelocityRadiansPerSecond,
      "/angularVelocityRadiansPerSecond"
    )
  });
};

export const createFrameStateAtTime = (input: FrameStateInput): FrameStateAtTime =>
  Object.freeze({
    frameId: parseFrameId(input.frameId, "/frameId"),
    systemFrameId: parseFrameId(input.systemFrameId, "/systemFrameId"),
    time: cloneUniverseTime(input.time),
    originPositionMeters: createSpatialVector3(input.originPositionMeters, "/originPositionMeters"),
    orientation: createSpatialQuaternion(input.orientation, "/orientation"),
    originVelocityMetersPerSecond: createSpatialVector3(
      input.originVelocityMetersPerSecond,
      "/originVelocityMetersPerSecond"
    ),
    angularVelocityRadiansPerSecond: createSpatialVector3(
      input.angularVelocityRadiansPerSecond,
      "/angularVelocityRadiansPerSecond"
    )
  });

export const createSystemInertialFrameState = (frameId: FrameId | string, time: UniverseTime): FrameStateAtTime => {
  const parsedFrameId = parseFrameId(frameId, "/frameId");
  return createFrameStateAtTime({
    frameId: parsedFrameId,
    systemFrameId: parsedFrameId,
    time,
    originPositionMeters: ZERO_SPATIAL_VECTOR,
    orientation: IDENTITY_SPATIAL_QUATERNION,
    originVelocityMetersPerSecond: ZERO_SPATIAL_VECTOR,
    angularVelocityRadiansPerSecond: ZERO_SPATIAL_VECTOR
  });
};

export const composeFrameState = (
  parent: FrameStateAtTime,
  relative: FrameTransformAtTime
): FrameStateAtTime => {
  assertSameUniverseTime(parent.time, relative.time);
  if (relative.parentFrameId !== parent.frameId) {
    return failSpatial("FRAME_MISMATCH", "/parentFrameId", "Relative transform does not belong to the parent frame.");
  }
  const translatedInSystem = rotateSpatialVector(parent.orientation, relative.translationMeters);
  const relativeVelocityInSystem = rotateSpatialVector(parent.orientation, relative.originVelocityMetersPerSecond);
  const parentRotationVelocity = crossSpatialVectors(parent.angularVelocityRadiansPerSecond, translatedInSystem);
  return createFrameStateAtTime({
    frameId: relative.frameId,
    systemFrameId: parent.systemFrameId,
    time: parent.time,
    originPositionMeters: addSpatialVectors(parent.originPositionMeters, translatedInSystem),
    orientation: multiplySpatialQuaternions(parent.orientation, relative.orientation),
    originVelocityMetersPerSecond: addSpatialVectors(
      parent.originVelocityMetersPerSecond,
      addSpatialVectors(parentRotationVelocity, relativeVelocityInSystem)
    ),
    angularVelocityRadiansPerSecond: addSpatialVectors(
      parent.angularVelocityRadiansPerSecond,
      rotateSpatialVector(parent.orientation, relative.angularVelocityRadiansPerSecond)
    )
  });
};

export const identityFrameTransform = (
  frameId: FrameId | string,
  parentFrameId: FrameId | string,
  time: UniverseTime
): FrameTransformAtTime =>
  createFrameTransformAtTime({
    frameId,
    parentFrameId,
    time,
    translationMeters: spatialVector3(),
    orientation: IDENTITY_SPATIAL_QUATERNION,
    originVelocityMetersPerSecond: spatialVector3(),
    angularVelocityRadiansPerSecond: spatialVector3()
  });

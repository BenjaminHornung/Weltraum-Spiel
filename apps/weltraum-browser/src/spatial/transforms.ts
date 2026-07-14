import { failSpatial } from "./errors";
import { assertSameUniverseTime } from "./frameValidation";
import {
  addSpatialVectors,
  conjugateSpatialQuaternion,
  createSpatialQuaternion,
  createSpatialVector3,
  crossSpatialVectors,
  multiplySpatialQuaternions,
  rotateSpatialVector,
  subtractSpatialVectors
} from "./quaternion";
import type {
  FrameStateAtTime,
  SpatialAngularVelocity,
  SpatialKinematicState,
  SpatialPose,
  SpatialQuaternion,
  SpatialVector3,
  SpatialVelocity
} from "./types";

const assertCompatibleFrames = (source: FrameStateAtTime, target: FrameStateAtTime): void => {
  assertSameUniverseTime(source.time, target.time);
  if (source.systemFrameId !== target.systemFrameId) {
    failSpatial("FRAME_MISMATCH", "/systemFrameId", "Frames must share the same SystemInertial root.");
  }
};

export const createSpatialPose = (value: SpatialPose): SpatialPose =>
  Object.freeze({
    positionMeters: createSpatialVector3(value.positionMeters, "/positionMeters"),
    orientation: createSpatialQuaternion(value.orientation, "/orientation")
  });

export const createSpatialKinematicState = (value: SpatialKinematicState): SpatialKinematicState =>
  Object.freeze({
    positionMeters: createSpatialVector3(value.positionMeters, "/positionMeters"),
    orientation: createSpatialQuaternion(value.orientation, "/orientation"),
    velocityMetersPerSecond: createSpatialVector3(value.velocityMetersPerSecond, "/velocityMetersPerSecond"),
    angularVelocityRadiansPerSecond: createSpatialVector3(
      value.angularVelocityRadiansPerSecond,
      "/angularVelocityRadiansPerSecond"
    )
  });

export const positionToSystemInertial = (positionMeters: SpatialVector3, frame: FrameStateAtTime): SpatialVector3 =>
  addSpatialVectors(
    frame.originPositionMeters,
    rotateSpatialVector(frame.orientation, createSpatialVector3(positionMeters, "/positionMeters"))
  );

export const positionFromSystemInertial = (
  absolutePositionMeters: SpatialVector3,
  frame: FrameStateAtTime
): SpatialVector3 =>
  rotateSpatialVector(
    conjugateSpatialQuaternion(frame.orientation),
    subtractSpatialVectors(createSpatialVector3(absolutePositionMeters, "/absolutePositionMeters"), frame.originPositionMeters)
  );

export const directionToSystemInertial = (direction: SpatialVector3, frame: FrameStateAtTime): SpatialVector3 =>
  rotateSpatialVector(frame.orientation, createSpatialVector3(direction, "/direction"));

export const directionFromSystemInertial = (
  absoluteDirection: SpatialVector3,
  frame: FrameStateAtTime
): SpatialVector3 =>
  rotateSpatialVector(conjugateSpatialQuaternion(frame.orientation), createSpatialVector3(absoluteDirection, "/absoluteDirection"));

export const orientationToSystemInertial = (
  orientation: SpatialQuaternion,
  frame: FrameStateAtTime
): SpatialQuaternion => multiplySpatialQuaternions(frame.orientation, createSpatialQuaternion(orientation, "/orientation"));

export const orientationFromSystemInertial = (
  absoluteOrientation: SpatialQuaternion,
  frame: FrameStateAtTime
): SpatialQuaternion =>
  multiplySpatialQuaternions(
    conjugateSpatialQuaternion(frame.orientation),
    createSpatialQuaternion(absoluteOrientation, "/absoluteOrientation")
  );

export const velocityToSystemInertial = (
  velocityMetersPerSecond: SpatialVelocity,
  positionMeters: SpatialVector3,
  frame: FrameStateAtTime
): SpatialVelocity => {
  const radiusInSystem = rotateSpatialVector(frame.orientation, createSpatialVector3(positionMeters, "/positionMeters"));
  return addSpatialVectors(
    frame.originVelocityMetersPerSecond,
    addSpatialVectors(
      crossSpatialVectors(frame.angularVelocityRadiansPerSecond, radiusInSystem),
      rotateSpatialVector(frame.orientation, createSpatialVector3(velocityMetersPerSecond, "/velocityMetersPerSecond"))
    )
  );
};

export const velocityFromSystemInertial = (
  absoluteVelocityMetersPerSecond: SpatialVelocity,
  absolutePositionMeters: SpatialVector3,
  frame: FrameStateAtTime
): SpatialVelocity => {
  const radiusInSystem = subtractSpatialVectors(
    createSpatialVector3(absolutePositionMeters, "/absolutePositionMeters"),
    frame.originPositionMeters
  );
  const residual = subtractSpatialVectors(
    subtractSpatialVectors(
      createSpatialVector3(absoluteVelocityMetersPerSecond, "/absoluteVelocityMetersPerSecond"),
      frame.originVelocityMetersPerSecond
    ),
    crossSpatialVectors(frame.angularVelocityRadiansPerSecond, radiusInSystem)
  );
  return rotateSpatialVector(conjugateSpatialQuaternion(frame.orientation), residual);
};

export const angularVelocityToSystemInertial = (
  angularVelocityRadiansPerSecond: SpatialAngularVelocity,
  frame: FrameStateAtTime
): SpatialAngularVelocity =>
  addSpatialVectors(
    frame.angularVelocityRadiansPerSecond,
    rotateSpatialVector(frame.orientation, createSpatialVector3(angularVelocityRadiansPerSecond, "/angularVelocityRadiansPerSecond"))
  );

export const angularVelocityFromSystemInertial = (
  absoluteAngularVelocityRadiansPerSecond: SpatialAngularVelocity,
  frame: FrameStateAtTime
): SpatialAngularVelocity =>
  rotateSpatialVector(
    conjugateSpatialQuaternion(frame.orientation),
    subtractSpatialVectors(
      createSpatialVector3(absoluteAngularVelocityRadiansPerSecond, "/absoluteAngularVelocityRadiansPerSecond"),
      frame.angularVelocityRadiansPerSecond
    )
  );

export const transformPosition = (
  positionMeters: SpatialVector3,
  source: FrameStateAtTime,
  target: FrameStateAtTime
): SpatialVector3 => {
  assertCompatibleFrames(source, target);
  return positionFromSystemInertial(positionToSystemInertial(positionMeters, source), target);
};

export const transformDirection = (
  direction: SpatialVector3,
  source: FrameStateAtTime,
  target: FrameStateAtTime
): SpatialVector3 => {
  assertCompatibleFrames(source, target);
  return directionFromSystemInertial(directionToSystemInertial(direction, source), target);
};

export const transformOrientation = (
  orientation: SpatialQuaternion,
  source: FrameStateAtTime,
  target: FrameStateAtTime
): SpatialQuaternion => {
  assertCompatibleFrames(source, target);
  return orientationFromSystemInertial(orientationToSystemInertial(orientation, source), target);
};

export const transformLinearVelocity = (
  velocityMetersPerSecond: SpatialVelocity,
  positionMeters: SpatialVector3,
  source: FrameStateAtTime,
  target: FrameStateAtTime
): SpatialVelocity => {
  assertCompatibleFrames(source, target);
  const absolutePosition = positionToSystemInertial(positionMeters, source);
  return velocityFromSystemInertial(
    velocityToSystemInertial(velocityMetersPerSecond, positionMeters, source),
    absolutePosition,
    target
  );
};

export const transformAngularVelocity = (
  angularVelocityRadiansPerSecond: SpatialAngularVelocity,
  source: FrameStateAtTime,
  target: FrameStateAtTime
): SpatialAngularVelocity => {
  assertCompatibleFrames(source, target);
  return angularVelocityFromSystemInertial(angularVelocityToSystemInertial(angularVelocityRadiansPerSecond, source), target);
};

export const transformPose = (pose: SpatialPose, source: FrameStateAtTime, target: FrameStateAtTime): SpatialPose => {
  const parsed = createSpatialPose(pose);
  return Object.freeze({
    positionMeters: transformPosition(parsed.positionMeters, source, target),
    orientation: transformOrientation(parsed.orientation, source, target)
  });
};

export const transformKinematicState = (
  state: SpatialKinematicState,
  source: FrameStateAtTime,
  target: FrameStateAtTime
): SpatialKinematicState => {
  const parsed = createSpatialKinematicState(state);
  return Object.freeze({
    positionMeters: transformPosition(parsed.positionMeters, source, target),
    velocityMetersPerSecond: transformLinearVelocity(parsed.velocityMetersPerSecond, parsed.positionMeters, source, target),
    orientation: transformOrientation(parsed.orientation, source, target),
    angularVelocityRadiansPerSecond: transformAngularVelocity(parsed.angularVelocityRadiansPerSecond, source, target)
  });
};

export const transformPositionBetweenFrames = transformPosition;
export const transformVelocityBetweenFrames = transformLinearVelocity;
export const transformOrientationBetweenFrames = transformOrientation;
export const transformAngularVelocityBetweenFrames = transformAngularVelocity;

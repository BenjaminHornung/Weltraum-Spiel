import type { CelestialBodyDefinition, CelestialRuntimeState, RotationDefinition } from "../celestial/types";
import { createCelestialBodyId } from "../celestial/ids";
import { validateUniverseTime, type UniverseTime } from "../persistence/time";
import { failSpatial } from "./errors";
import { createFrameStateAtTime, createFrameTransformAtTime, composeFrameState } from "./frameGraph";
import {
  createBodyFixedFrameId,
  createBodyInertialFrameId,
  parseFrameId,
  type FrameId
} from "./ids";
import {
  createQuaternionFromAxisAngle,
  addSpatialVectors,
  createSpatialVector3,
  IDENTITY_SPATIAL_QUATERNION,
  multiplySpatialQuaternions,
  rotateSpatialVector,
  scaleSpatialVector,
  spatialVector3,
  spatialVectorMagnitude,
  subtractSpatialVectors,
  ZERO_SPATIAL_VECTOR
} from "./quaternion";
import {
  SPATIAL_POSITION_ABSOLUTE_TOLERANCE_METERS,
  SPATIAL_RELATIVE_TOLERANCE,
  SPATIAL_VELOCITY_ABSOLUTE_TOLERANCE_METERS_PER_SECOND,
  type FrameStateAtTime,
  type FrameTransformAtTime,
  type SpatialQuaternion,
  type SpatialVector3
} from "./types";

const TWO_PI = 2 * Math.PI;
const DEGREES_TO_RADIANS = Math.PI / 180;

const assertBodyRuntimeAtTime = (
  body: CelestialBodyDefinition,
  runtimeState: CelestialRuntimeState,
  time: UniverseTime
): void => {
  const bodyId = createCelestialBodyId(body.bodyId, "/body/bodyId");
  const runtimeBodyId = createCelestialBodyId(runtimeState.bodyId, "/runtimeState/bodyId");
  if (bodyId !== runtimeBodyId) {
    failSpatial("FRAME_MISMATCH", "/runtimeState/bodyId", "Body definition and runtime state must identify the same body.");
  }
  const validatedTime = validateUniverseTime(time, "/time");
  if (runtimeState.requestedTimeSeconds !== validatedTime.epochSeconds) {
    failSpatial("TIME_MISMATCH", "/runtimeState/requestedTimeSeconds", "Celestial runtime state must match Universe time exactly.");
  }
};

export interface BodyInertialFrameStateInput {
  readonly body: CelestialBodyDefinition;
  readonly runtimeState: CelestialRuntimeState;
  readonly time: UniverseTime;
  readonly systemFrameId: FrameId | string;
  readonly frameId?: FrameId | string;
}

export const createBodyInertialFrameState = (input: BodyInertialFrameStateInput): FrameStateAtTime => {
  assertBodyRuntimeAtTime(input.body, input.runtimeState, input.time);
  return createFrameStateAtTime({
    frameId: input.frameId ?? createBodyInertialFrameId(input.body.bodyId),
    systemFrameId: input.systemFrameId,
    time: input.time,
    originPositionMeters: createSpatialVector3(input.runtimeState.absoluteState.positionMeters, "/runtimeState/absoluteState/positionMeters"),
    orientation: IDENTITY_SPATIAL_QUATERNION,
    originVelocityMetersPerSecond: createSpatialVector3(
      input.runtimeState.absoluteState.velocityMetersPerSecond,
      "/runtimeState/absoluteState/velocityMetersPerSecond"
    ),
    angularVelocityRadiansPerSecond: ZERO_SPATIAL_VECTOR
  });
};

export interface BodyInertialFrameTransformInput extends BodyInertialFrameStateInput {
  readonly parentFrameId: FrameId | string;
  readonly parentRuntimeState?: CelestialRuntimeState;
}

const assertRuntimeHierarchyVector = (
  parentValue: SpatialVector3,
  relativeValue: SpatialVector3,
  absoluteValue: SpatialVector3,
  absoluteTolerance: number,
  path: string
): void => {
  const composed = addSpatialVectors(parentValue, relativeValue);
  const error = spatialVectorMagnitude(subtractSpatialVectors(composed, absoluteValue));
  const scale = Math.max(spatialVectorMagnitude(composed), spatialVectorMagnitude(absoluteValue));
  if (!Number.isFinite(error) || error > absoluteTolerance + SPATIAL_RELATIVE_TOLERANCE * scale) {
    failSpatial("FRAME_MISMATCH", path, "Parent absolute plus child-relative state must match child absolute state.");
  }
};

const assertParentRuntimeHierarchy = (
  input: BodyInertialFrameTransformInput,
  relativeState: NonNullable<CelestialRuntimeState["parentRelativeState"]>
): void => {
  const parentRuntimeState = input.parentRuntimeState ?? failSpatial(
    "FRAME_MISMATCH",
    "/parentRuntimeState",
    "A child body transform requires its parent runtime state."
  );
  const time = validateUniverseTime(input.time, "/time");
  if (parentRuntimeState.requestedTimeSeconds !== time.epochSeconds) {
    failSpatial("TIME_MISMATCH", "/parentRuntimeState/requestedTimeSeconds", "Parent runtime state must match Universe time exactly.");
  }
  const parentBodyId = createCelestialBodyId(parentRuntimeState.bodyId, "/parentRuntimeState/bodyId");
  if (input.body.parentBodyId !== parentBodyId || relativeState.frame.referenceBodyId !== parentBodyId) {
    failSpatial("FRAME_MISMATCH", "/runtimeState/parentRelativeState/frame/referenceBodyId", "Child relative state must reference its declared parent runtime body.");
  }
  if (
    parentRuntimeState.absoluteState.frame.referenceBodyId !== input.runtimeState.absoluteState.frame.referenceBodyId ||
    parentRuntimeState.absoluteState.frame.kind !== "AbsoluteSystem" ||
    input.runtimeState.absoluteState.frame.kind !== "AbsoluteSystem"
  ) {
    failSpatial("FRAME_MISMATCH", "/parentRuntimeState/absoluteState/frame", "Parent and child absolute states must share the same absolute reference frame.");
  }
  assertRuntimeHierarchyVector(
    createSpatialVector3(parentRuntimeState.absoluteState.positionMeters),
    createSpatialVector3(relativeState.positionMeters),
    createSpatialVector3(input.runtimeState.absoluteState.positionMeters),
    SPATIAL_POSITION_ABSOLUTE_TOLERANCE_METERS,
    "/runtimeState/absoluteState/positionMeters"
  );
  assertRuntimeHierarchyVector(
    createSpatialVector3(parentRuntimeState.absoluteState.velocityMetersPerSecond),
    createSpatialVector3(relativeState.velocityMetersPerSecond),
    createSpatialVector3(input.runtimeState.absoluteState.velocityMetersPerSecond),
    SPATIAL_VELOCITY_ABSOLUTE_TOLERANCE_METERS_PER_SECOND,
    "/runtimeState/absoluteState/velocityMetersPerSecond"
  );
};

export const createBodyInertialFrameTransform = (input: BodyInertialFrameTransformInput): FrameTransformAtTime => {
  assertBodyRuntimeAtTime(input.body, input.runtimeState, input.time);
  const isRootBody = input.body.parentBodyId === null && input.body.orbit === null;
  const isChildBody = input.body.parentBodyId !== null && input.body.orbit !== null;
  if (!isRootBody && !isChildBody) {
    failSpatial("FRAME_MISMATCH", "/body", "Body parent and orbit hierarchy must consistently describe a root or child.");
  }
  const parsedParentFrameId = parseFrameId(input.parentFrameId, "/parentFrameId");
  if (isRootBody) {
    if (parsedParentFrameId !== parseFrameId(input.systemFrameId, "/systemFrameId")) {
      failSpatial("FRAME_MISMATCH", "/parentFrameId", "Root body transform must be parented by the SystemInertial frame.");
    }
  } else if (
    parsedParentFrameId !== createBodyInertialFrameId(input.body.orbit!.parentBodyId)
  ) {
    failSpatial("FRAME_MISMATCH", "/parentFrameId", "Child body transform must be parented by its orbit parent's BodyInertial frame.");
  }
  if (isRootBody && input.runtimeState.parentRelativeState !== null) {
    failSpatial("FRAME_MISMATCH", "/runtimeState/parentRelativeState", "Root body runtime state cannot be parent-relative.");
  }
  if (isChildBody && input.runtimeState.parentRelativeState === null) {
    failSpatial("FRAME_MISMATCH", "/runtimeState/parentRelativeState", "Child body runtime state requires a parent-relative state.");
  }
  if (input.runtimeState.parentRelativeState !== null) {
    assertParentRuntimeHierarchy(input, input.runtimeState.parentRelativeState);
  }
  const state = input.runtimeState.parentRelativeState ?? input.runtimeState.absoluteState;
  return createFrameTransformAtTime({
    frameId: input.frameId ?? createBodyInertialFrameId(input.body.bodyId),
    parentFrameId: input.parentFrameId,
    time: input.time,
    translationMeters: state.positionMeters,
    orientation: IDENTITY_SPATIAL_QUATERNION,
    originVelocityMetersPerSecond: state.velocityMetersPerSecond,
    angularVelocityRadiansPerSecond: ZERO_SPATIAL_VECTOR
  });
};

export interface BodyRotationState {
  readonly orientation: SpatialQuaternion;
  readonly angularVelocityRadiansPerSecond: SpatialVector3;
  readonly spinAngleRadians: number;
  readonly signedRotationRateRadiansPerSecond: number;
}

const euclideanModulo = (value: number, modulus: number): number => ((value % modulus) + modulus) % modulus;

export const computeBodyRotationState = (
  rotation: RotationDefinition,
  time: UniverseTime,
  rotationEpoch: UniverseTime
): BodyRotationState => {
  const current = validateUniverseTime(time, "/time");
  const epoch = validateUniverseTime(rotationEpoch, "/rotationEpoch");
  if (!Number.isFinite(rotation.rotationPeriodSeconds) || rotation.rotationPeriodSeconds <= 0) {
    return failSpatial("INVALID_ROTATION", "/rotation/rotationPeriodSeconds", "Rotation period must be finite and positive.");
  }
  if (!Number.isFinite(rotation.axialTiltDegrees) || !Number.isFinite(rotation.primeMeridianAtEpochDegrees)) {
    return failSpatial("INVALID_ROTATION", "/rotation", "Rotation angles must be finite.");
  }
  const signedRate = (rotation.retrograde ? -1 : 1) * (TWO_PI / rotation.rotationPeriodSeconds);
  const elapsedSeconds = current.epochSeconds - epoch.epochSeconds;
  const rawSpin = rotation.primeMeridianAtEpochDegrees * DEGREES_TO_RADIANS + signedRate * elapsedSeconds;
  if (!Number.isFinite(rawSpin)) {
    return failSpatial("NONFINITE_VALUE", "/time", "Rotation phase overflowed finite numeric range.");
  }
  const spinAngleRadians = euclideanModulo(rawSpin, TWO_PI);
  const tilt = createQuaternionFromAxisAngle(spatialVector3(1, 0, 0), rotation.axialTiltDegrees * DEGREES_TO_RADIANS);
  const spin = createQuaternionFromAxisAngle(spatialVector3(0, 0, 1), spinAngleRadians);
  const orientation = multiplySpatialQuaternions(tilt, spin);
  const tiltedPole = rotateSpatialVector(tilt, spatialVector3(0, 0, 1));
  return Object.freeze({
    orientation,
    angularVelocityRadiansPerSecond: scaleSpatialVector(tiltedPole, signedRate),
    spinAngleRadians: Object.is(spinAngleRadians, -0) ? 0 : spinAngleRadians,
    signedRotationRateRadiansPerSecond: signedRate
  });
};

export interface BodyFixedFrameInput {
  readonly body: CelestialBodyDefinition;
  readonly runtimeState: CelestialRuntimeState;
  readonly time: UniverseTime;
  readonly rotationEpoch: UniverseTime;
  readonly bodyInertialFrameId?: FrameId | string;
  readonly bodyFixedFrameId?: FrameId | string;
}

export const createBodyFixedFrameTransform = (input: BodyFixedFrameInput): FrameTransformAtTime => {
  assertBodyRuntimeAtTime(input.body, input.runtimeState, input.time);
  if (input.body.rotation === null) {
    return failSpatial("INVALID_ROTATION", "/body/rotation", "BodyFixed V1 requires an explicit body rotation definition.");
  }
  const rotationState = computeBodyRotationState(input.body.rotation, input.time, input.rotationEpoch);
  return createFrameTransformAtTime({
    frameId: input.bodyFixedFrameId ?? createBodyFixedFrameId(input.body.bodyId),
    parentFrameId: input.bodyInertialFrameId ?? createBodyInertialFrameId(input.body.bodyId),
    time: input.time,
    translationMeters: ZERO_SPATIAL_VECTOR,
    orientation: rotationState.orientation,
    originVelocityMetersPerSecond: ZERO_SPATIAL_VECTOR,
    angularVelocityRadiansPerSecond: rotationState.angularVelocityRadiansPerSecond
  });
};

export const createBodyFixedFrameState = (
  bodyInertialState: FrameStateAtTime,
  input: BodyFixedFrameInput
): FrameStateAtTime => {
  const expectedInertialId = parseFrameId(
    input.bodyInertialFrameId ?? createBodyInertialFrameId(input.body.bodyId),
    "/bodyInertialFrameId"
  );
  if (bodyInertialState.frameId !== expectedInertialId) {
    return failSpatial("FRAME_MISMATCH", "/bodyInertialState/frameId", "Body inertial state has the wrong frame ID.");
  }
  return composeFrameState(bodyInertialState, createBodyFixedFrameTransform(input));
};

import { UNIVERSE_TICKS_PER_SECOND, validateUniverseTime } from "../persistence/time";
import { assertSameUniverseTime, cloneUniverseTime } from "../spatial/frameValidation";
import { parseFrameId } from "../spatial/ids";
import {
  addSpatialVectors,
  createSpatialVector3,
  scaleSpatialVector
} from "../spatial/quaternion";
import {
  positionFromSystemInertial,
  positionToSystemInertial,
  velocityFromSystemInertial,
  velocityToSystemInertial
} from "../spatial/transforms";
import {
  createPhysicsSpaceSignature,
  serializeCanonicalPhysicsSpaceValue
} from "./canonical";
import { failPhysicsSpace } from "./errors";
import { queryGravityField } from "./gravityField";
import { parsePhysicsProbeId } from "./ids";
import type {
  PhysicsProbeState,
  PhysicsProbeStateInput,
  PhysicsStepInput,
  PhysicsStepResult
} from "./types";

const FRAME_DERIVED_STEP_TOLERANCE_SECONDS =
  1 / (UNIVERSE_TICKS_PER_SECOND * 1_000_000);

export const createPhysicsProbeState = (input: PhysicsProbeStateInput): PhysicsProbeState => {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return failPhysicsSpace("INVALID_INPUT", "", "Physics probe state input must be an object.");
  }
  return Object.freeze({
    probeId: parsePhysicsProbeId(input.probeId, "/probeId"),
    frameId: parseFrameId(input.frameId, "/frameId"),
    time: cloneUniverseTime(input.time),
    positionMeters: createSpatialVector3(input.positionMeters, "/positionMeters"),
    velocityMetersPerSecond: createSpatialVector3(input.velocityMetersPerSecond, "/velocityMetersPerSecond")
  });
};

const validateFixedStep = (input: PhysicsStepInput, state: PhysicsProbeState): number => {
  const dt = input.deltaTimeSeconds;
  if (typeof dt !== "number" || !Number.isFinite(dt) || dt <= 0) {
    return failPhysicsSpace("INVALID_TIME_STEP", "/deltaTimeSeconds", "Physics step dt must be finite and positive.");
  }
  assertSameUniverseTime(state.time, input.startFrameState.time, "/startFrameState/time");
  assertSameUniverseTime(state.time, input.gravityField.time, "/gravityField/time");
  const endTime = validateUniverseTime(input.endFrameState.time, "/endFrameState/time");
  const deltaTicks = endTime.tick - state.time.tick;
  if (!Number.isSafeInteger(deltaTicks) || deltaTicks <= 0) {
    return failPhysicsSpace(
      "INVALID_TIME_STEP",
      "/endFrameState/time/tick",
      "Physics step must advance a positive safe-integer number of Universe ticks."
    );
  }
  const expectedSeconds = deltaTicks / UNIVERSE_TICKS_PER_SECOND;
  const frameDerivedSeconds = endTime.epochSeconds - state.time.epochSeconds;
  const matchesFrameDerivedSeconds =
    Object.is(dt, frameDerivedSeconds) &&
    Math.abs(frameDerivedSeconds - expectedSeconds) <= FRAME_DERIVED_STEP_TOLERANCE_SECONDS;
  if (!Object.is(dt, expectedSeconds) && !matchesFrameDerivedSeconds) {
    return failPhysicsSpace(
      "INVALID_TIME_STEP",
      "/deltaTimeSeconds",
      "Physics step dt must match the canonical 120 Hz Universe tick span."
    );
  }
  return expectedSeconds;
};

export const stepPhysicsProbe = (input: PhysicsStepInput): PhysicsStepResult => {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return failPhysicsSpace("INVALID_INPUT", "", "Physics step input must be an object.");
  }
  const state = createPhysicsProbeState(input.state);
  const dt = validateFixedStep(input, state);
  if (state.frameId !== input.startFrameState.frameId) {
    return failPhysicsSpace("FRAME_MISMATCH", "/startFrameState/frameId", "Probe state must use the supplied start frame.");
  }
  if (
    input.startFrameState.systemFrameId !== input.gravityField.systemFrameId ||
    input.endFrameState.systemFrameId !== input.gravityField.systemFrameId
  ) {
    return failPhysicsSpace(
      "FRAME_MISMATCH",
      "/gravityField/systemFrameId",
      "Probe step frames and gravity field must share one SystemInertial root."
    );
  }

  const absolutePosition = positionToSystemInertial(state.positionMeters, input.startFrameState);
  const absoluteVelocity = velocityToSystemInertial(
    state.velocityMetersPerSecond,
    state.positionMeters,
    input.startFrameState
  );
  const gravity = queryGravityField({
    field: input.gravityField,
    positionMeters: absolutePosition,
    positionFrameState: input.gravityField.systemFrameState,
    outputFrameState: input.gravityField.systemFrameState
  });
  const nextAbsoluteVelocity = addSpatialVectors(
    absoluteVelocity,
    scaleSpatialVector(gravity.systemAccelerationMetersPerSecondSquared, dt)
  );
  const nextAbsolutePosition = addSpatialVectors(
    absolutePosition,
    scaleSpatialVector(nextAbsoluteVelocity, dt)
  );
  const nextState = createPhysicsProbeState({
    probeId: state.probeId,
    frameId: input.endFrameState.frameId,
    time: input.endFrameState.time,
    positionMeters: positionFromSystemInertial(nextAbsolutePosition, input.endFrameState),
    velocityMetersPerSecond: velocityFromSystemInertial(
      nextAbsoluteVelocity,
      nextAbsolutePosition,
      input.endFrameState
    )
  });
  const canonicalValue = {
    state: nextState,
    accelerationSystemMetersPerSecondSquared: gravity.systemAccelerationMetersPerSecondSquared,
    absolutePositionMeters: nextAbsolutePosition,
    absoluteVelocityMetersPerSecond: nextAbsoluteVelocity
  };
  return Object.freeze({
    ...canonicalValue,
    canonicalJson: serializeCanonicalPhysicsSpaceValue(canonicalValue),
    signature: createPhysicsSpaceSignature(canonicalValue)
  });
};

export const integratePhysicsProbeStep = stepPhysicsProbe;

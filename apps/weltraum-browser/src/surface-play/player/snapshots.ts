import { clamp, type Vec3 } from "../../core/vector";
import {
  createSurfacePlayerPresentationSnapshot as createContractPresentationSnapshot,
  createSurfacePlayerSnapshot,
  type SurfacePlayerPresentationSnapshot,
  type SurfacePlayerSnapshot
} from "../contracts";
import type { SurfaceFixedStepRuntime } from "./fixedStep";
import type { SurfaceLocomotionConfig, SurfaceLocomotionState } from "./locomotion";

export interface SurfaceFirstPersonViewSnapshot {
  readonly eyePositionMeters: Vec3;
  readonly forward: Vec3;
  readonly right: Vec3;
  readonly up: Vec3;
  readonly surfaceUp: Readonly<{ readonly x: 0; readonly y: 1; readonly z: 0 }>;
  readonly yawRadians: number;
  readonly pitchRadians: number;
  readonly rollRadians: 0;
  readonly headBobOffsetMeters: 0;
}

const shortestAngleDelta = (from: number, to: number): number =>
  Math.atan2(Math.sin(to - from), Math.cos(to - from));

const interpolate = (from: number, to: number, alpha: number): number => from + (to - from) * alpha;

const interpolateState = (
  runtime: Readonly<SurfaceFixedStepRuntime>
): Pick<SurfaceLocomotionState, "positionMeters" | "yawRadians" | "pitchRadians"> => {
  const alpha = clamp(runtime.interpolationAlpha, 0, 1);
  return {
    positionMeters: {
      x: interpolate(runtime.previousState.positionMeters.x, runtime.currentState.positionMeters.x, alpha),
      y: interpolate(runtime.previousState.positionMeters.y, runtime.currentState.positionMeters.y, alpha),
      z: interpolate(runtime.previousState.positionMeters.z, runtime.currentState.positionMeters.z, alpha)
    },
    yawRadians: runtime.previousState.yawRadians
      + shortestAngleDelta(runtime.previousState.yawRadians, runtime.currentState.yawRadians) * alpha,
    pitchRadians: interpolate(runtime.previousState.pitchRadians, runtime.currentState.pitchRadians, alpha)
  };
};

export const createSurfacePlayerContractSnapshot = (
  state: Readonly<SurfaceLocomotionState>
): Readonly<SurfacePlayerSnapshot> => createSurfacePlayerSnapshot({
  playerId: state.playerId,
  surfaceFrameId: state.surfaceFrameId,
  positionMeters: state.positionMeters,
  velocityMetersPerSecond: state.velocityMetersPerSecond,
  yawRadians: state.yawRadians,
  pitchRadians: state.pitchRadians,
  grounded: state.grounded,
  movementMode: state.movementMode,
  capsule: state.capsule,
  simulationTick: state.simulationTick
});

export const createSurfacePlayerPresentationSnapshot = (
  runtime: Readonly<SurfaceFixedStepRuntime>
): Readonly<SurfacePlayerPresentationSnapshot> => {
  const interpolated = interpolateState(runtime);
  return createContractPresentationSnapshot({
    playerId: runtime.currentState.playerId,
    surfaceFrameId: runtime.currentState.surfaceFrameId,
    positionMeters: interpolated.positionMeters,
    yawRadians: interpolated.yawRadians,
    pitchRadians: interpolated.pitchRadians,
    movementMode: runtime.currentState.movementMode
  });
};

export const createSurfaceFirstPersonViewSnapshot = (
  state: Readonly<SurfaceLocomotionState>,
  config: Readonly<SurfaceLocomotionConfig>
): Readonly<SurfaceFirstPersonViewSnapshot> => {
  const pitchRadians = clamp(state.pitchRadians, -config.maximumPitchRadians, config.maximumPitchRadians);
  const cosPitch = Math.cos(pitchRadians);
  const sinPitch = Math.sin(pitchRadians);
  const sinYaw = Math.sin(state.yawRadians);
  const cosYaw = Math.cos(state.yawRadians);
  const eyeOffsetFromCapsuleCenter = config.headHeightMeters - state.capsule.heightMeters * 0.5;
  return Object.freeze({
    eyePositionMeters: Object.freeze({
      x: state.positionMeters.x,
      y: state.positionMeters.y + eyeOffsetFromCapsuleCenter,
      z: state.positionMeters.z
    }),
    forward: Object.freeze({ x: sinYaw * cosPitch, y: sinPitch, z: cosYaw * cosPitch }),
    right: Object.freeze({ x: -cosYaw, y: 0, z: sinYaw }),
    up: Object.freeze({ x: -sinYaw * sinPitch, y: cosPitch, z: -cosYaw * sinPitch }),
    surfaceUp: Object.freeze({ x: 0 as const, y: 1 as const, z: 0 as const }),
    yawRadians: state.yawRadians,
    pitchRadians,
    rollRadians: 0,
    headBobOffsetMeters: 0
  });
};

import { add, clamp, dot, magnitude, normalize, scale, sub, vec3, type Vec3 } from "../../core/vector";
import {
  createSurfacePlayerSnapshot,
  type SurfaceAuthorityBindingInput,
  type SurfaceCapsule,
  type SurfaceCollisionQueryPort,
  type SurfaceCollisionRejection,
  type SurfaceMovementMode,
  type SurfacePlayerCommand,
  type SurfacePlayerSnapshotInput
} from "../contracts";
import { resolveSurfaceCapsuleMotion, type SurfaceCapsuleMotionConfig } from "../collision";

export interface SurfaceLocomotionCapabilities {
  readonly maximumAirJumps: 0;
  readonly wallRunEnabled: false;
}

export interface SurfaceLocomotionConfig extends SurfaceCapsuleMotionConfig {
  readonly presetId: "hestia.surface-locomotion.agile-grounded.v1";
  readonly fixedDeltaSeconds: number;
  readonly gravityMetersPerSecondSquared: number;
  readonly walkSpeedMetersPerSecond: number;
  readonly sprintSpeedMetersPerSecond: number;
  readonly jumpApexMeters: number;
  readonly jumpSpeedMetersPerSecond: number;
  readonly groundAccelerationMetersPerSecondSquared: number;
  readonly groundDecelerationMetersPerSecondSquared: number;
  readonly airAccelerationMetersPerSecondSquared: number;
  readonly maximumAirControlSpeedMetersPerSecond: number;
  readonly capsule: Readonly<SurfaceCapsule>;
  readonly headHeightMeters: number;
  readonly maximumPitchRadians: number;
  readonly mouseSensitivityRadiansPerPixel: number;
  readonly headBobAmplitudeMeters: 0;
  readonly capabilities: Readonly<SurfaceLocomotionCapabilities>;
}

export interface SurfaceLocomotionState {
  readonly playerId: string;
  readonly surfaceFrameId: string;
  readonly positionMeters: Vec3;
  readonly velocityMetersPerSecond: Vec3;
  readonly yawRadians: number;
  readonly pitchRadians: number;
  readonly grounded: boolean;
  readonly groundNormal: Vec3;
  readonly movementMode: SurfaceMovementMode;
  readonly capsule: Readonly<SurfaceCapsule>;
  readonly simulationTick: number;
  readonly jumpHeld: boolean;
}

export interface SurfaceLocomotionStateInput extends SurfacePlayerSnapshotInput {
  readonly groundNormal?: Vec3;
  readonly jumpHeld?: boolean;
}

export type SurfaceLocomotionContext = Omit<SurfaceAuthorityBindingInput, "simulationTick">;

export interface SurfaceLocomotionRejection {
  readonly code: "CommandPlayerMismatch" | "CommandFrameMismatch" | "CommandTickMismatch" | "CollisionRejected";
  readonly message: string;
  readonly collisionRejection?: SurfaceCollisionRejection;
}

export type SurfaceLocomotionStepResult =
  | Readonly<{ readonly status: "Advanced"; readonly state: Readonly<SurfaceLocomotionState> }>
  | Readonly<{
    readonly status: "Rejected";
    readonly state: Readonly<SurfaceLocomotionState>;
    readonly rejection: Readonly<SurfaceLocomotionRejection>;
  }>;

export interface SurfaceRecoveryTarget {
  readonly positionMeters: Vec3;
  readonly yawRadians: number;
  readonly pitchRadians: number;
}

const UP = vec3(0, 1, 0);

const freezeVector = (value: Vec3): Vec3 => Object.freeze({ x: value.x, y: value.y, z: value.z });

const freezeState = (state: SurfaceLocomotionState): Readonly<SurfaceLocomotionState> =>
  Object.freeze({
    ...state,
    positionMeters: freezeVector(state.positionMeters),
    velocityMetersPerSecond: freezeVector(state.velocityMetersPerSecond),
    groundNormal: freezeVector(state.groundNormal),
    capsule: Object.freeze({ ...state.capsule })
  });

const finiteVector = (value: Vec3, name: string): Vec3 => {
  if (![value.x, value.y, value.z].every(Number.isFinite)) throw new Error(`${name} must be finite.`);
  return value;
};

const moveTowards = (current: Vec3, target: Vec3, maximumDelta: number): Vec3 => {
  const delta = sub(target, current);
  const distance = magnitude(delta);
  return distance <= maximumDelta || distance <= 1e-9
    ? target
    : add(current, scale(delta, maximumDelta / distance));
};

const movementAxes = (yawRadians: number, forwardAxis: number, rightAxis: number): Vec3 => {
  const forward = vec3(Math.sin(yawRadians), 0, Math.cos(yawRadians));
  const right = vec3(Math.cos(yawRadians), 0, -Math.sin(yawRadians));
  const requested = add(scale(forward, forwardAxis), scale(right, rightAxis));
  const length = magnitude(requested);
  return length > 1 ? scale(requested, 1 / length) : requested;
};

const tangentDirection = (direction: Vec3, normal: Vec3): Vec3 => {
  const projected = sub(direction, scale(normal, dot(direction, normal)));
  return normalize(projected);
};

const reject = (
  state: Readonly<SurfaceLocomotionState>,
  code: SurfaceLocomotionRejection["code"],
  message: string,
  collisionRejection?: SurfaceCollisionRejection
): SurfaceLocomotionStepResult => ({
  status: "Rejected",
  state,
  rejection: Object.freeze({ code, message, ...(collisionRejection === undefined ? {} : { collisionRejection }) })
});

export const createHestiaAgileGroundedLocomotionPresetV1 = (): Readonly<SurfaceLocomotionConfig> => {
  const gravityMetersPerSecondSquared = 11.78;
  const jumpApexMeters = 1.15;
  return Object.freeze({
    presetId: "hestia.surface-locomotion.agile-grounded.v1",
    fixedDeltaSeconds: 1 / 60,
    gravityMetersPerSecondSquared,
    walkSpeedMetersPerSecond: 5,
    sprintSpeedMetersPerSecond: 8,
    jumpApexMeters,
    jumpSpeedMetersPerSecond: Math.sqrt(2 * gravityMetersPerSecondSquared * jumpApexMeters),
    groundAccelerationMetersPerSecondSquared: 28,
    groundDecelerationMetersPerSecondSquared: 34,
    airAccelerationMetersPerSecondSquared: 7,
    maximumAirControlSpeedMetersPerSecond: 5,
    capsule: Object.freeze({ radiusMeters: 0.35, heightMeters: 1.8 }),
    headHeightMeters: 1.62,
    maximumPitchRadians: 85 * Math.PI / 180,
    mouseSensitivityRadiansPerPixel: 0.0025,
    headBobAmplitudeMeters: 0,
    maximumSlopeRadians: 50 * Math.PI / 180,
    stepHeightMeters: 0.4,
    collisionSkinMeters: 0.02,
    groundProbeDistanceMeters: 0.08,
    maximumSlideIterations: 4,
    capabilities: Object.freeze({ maximumAirJumps: 0, wallRunEnabled: false })
  });
};

export const createSurfaceLocomotionState = (
  input: SurfaceLocomotionStateInput
): Readonly<SurfaceLocomotionState> => {
  const snapshot = createSurfacePlayerSnapshot(input);
  const groundNormal = finiteVector(input.groundNormal ?? UP, "groundNormal");
  if (snapshot.grounded && magnitude(groundNormal) <= 1e-9) throw new Error("Grounded state requires a ground normal.");
  return freezeState({
    ...snapshot,
    positionMeters: snapshot.positionMeters,
    velocityMetersPerSecond: snapshot.velocityMetersPerSecond,
    groundNormal: snapshot.grounded ? normalize(groundNormal) : UP,
    jumpHeld: input.jumpHeld ?? false
  });
};

export const stepSurfaceLocomotion = (
  state: Readonly<SurfaceLocomotionState>,
  command: Readonly<SurfacePlayerCommand>,
  context: Readonly<SurfaceLocomotionContext>,
  collisionPort: SurfaceCollisionQueryPort,
  config: Readonly<SurfaceLocomotionConfig>
): SurfaceLocomotionStepResult => {
  if (command.playerId !== state.playerId) {
    return reject(state, "CommandPlayerMismatch", "Command player does not match locomotion state.");
  }
  if (command.surfaceFrameId !== state.surfaceFrameId || context.surfaceFrameId !== state.surfaceFrameId) {
    return reject(state, "CommandFrameMismatch", "Command or authority frame does not match locomotion state.");
  }
  if (command.simulationTick !== state.simulationTick + 1) {
    return reject(state, "CommandTickMismatch", "Command must advance locomotion by exactly one simulation tick.");
  }

  const yawRadians = state.yawRadians + command.lookDeltaRadians.yaw;
  const pitchRadians = clamp(
    state.pitchRadians + command.lookDeltaRadians.pitch,
    -config.maximumPitchRadians,
    config.maximumPitchRadians
  );
  const requestedDirection = movementAxes(
    yawRadians,
    command.moveAxes.forward,
    command.moveAxes.right
  );
  let velocity = state.velocityMetersPerSecond;
  const hasMovement = magnitude(requestedDirection) > 1e-9;

  if (state.grounded) {
    const speed = command.sprint ? config.sprintSpeedMetersPerSecond : config.walkSpeedMetersPerSecond;
    const targetVelocity = hasMovement
      ? scale(tangentDirection(requestedDirection, state.groundNormal), speed)
      : vec3();
    const acceleration = hasMovement
      ? config.groundAccelerationMetersPerSecondSquared
      : config.groundDecelerationMetersPerSecondSquared;
    velocity = moveTowards(velocity, targetVelocity, acceleration * config.fixedDeltaSeconds);
  } else if (hasMovement) {
    const direction = normalize(requestedDirection);
    const speedAlongDirection = dot(velocity, direction);
    const availableSpeed = config.maximumAirControlSpeedMetersPerSecond - speedAlongDirection;
    if (availableSpeed > 0) {
      velocity = add(
        velocity,
        scale(
          direction,
          Math.min(availableSpeed, config.airAccelerationMetersPerSecondSquared * config.fixedDeltaSeconds)
        )
      );
    }
  }

  const jumpStarted = state.grounded && command.jump && !state.jumpHeld;
  if (jumpStarted) velocity = vec3(velocity.x, config.jumpSpeedMetersPerSecond, velocity.z);
  velocity = add(velocity, vec3(0, -config.gravityMetersPerSecondSquared * config.fixedDeltaSeconds, 0));

  const binding: SurfaceAuthorityBindingInput = {
    ...context,
    simulationTick: command.simulationTick
  };
  const motion = resolveSurfaceCapsuleMotion(
    collisionPort,
    {
      binding,
      queryIdPrefix: `locomotion:${command.simulationTick}`,
      capsule: state.capsule,
      positionMeters: state.positionMeters,
      velocityMetersPerSecond: velocity,
      displacementMeters: scale(velocity, config.fixedDeltaSeconds),
      wasGrounded: state.grounded && !jumpStarted
    },
    config
  );
  if (motion.status === "Rejected") {
    return reject(
      state,
      "CollisionRejected",
      "Collision authority rejected the locomotion step.",
      motion.rejection
    );
  }

  const movementMode: SurfaceMovementMode = motion.grounded
    ? command.sprint && hasMovement ? "Sprint" : "Walk"
    : "Airborne";
  return {
    status: "Advanced",
    state: freezeState({
      ...state,
      positionMeters: motion.positionMeters,
      velocityMetersPerSecond: motion.velocityMetersPerSecond,
      yawRadians,
      pitchRadians,
      grounded: motion.grounded,
      groundNormal: motion.groundNormal,
      movementMode,
      simulationTick: command.simulationTick,
      jumpHeld: command.jump
    })
  };
};

export const recoverSurfaceLocomotion = (
  state: Readonly<SurfaceLocomotionState>,
  target: Readonly<SurfaceRecoveryTarget>,
  config: Readonly<SurfaceLocomotionConfig>
): Readonly<SurfaceLocomotionState> => {
  finiteVector(target.positionMeters, "recovery.positionMeters");
  if (!Number.isFinite(target.yawRadians) || !Number.isFinite(target.pitchRadians)) {
    throw new Error("Recovery orientation must be finite.");
  }
  return freezeState({
    ...state,
    positionMeters: target.positionMeters,
    velocityMetersPerSecond: vec3(),
    yawRadians: target.yawRadians,
    pitchRadians: clamp(target.pitchRadians, -config.maximumPitchRadians, config.maximumPitchRadians),
    grounded: false,
    groundNormal: UP,
    movementMode: "Recovery",
    jumpHeld: false
  });
};

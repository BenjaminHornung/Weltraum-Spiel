import {
  DEFAULT_PLAYER_AABB,
  isAuthorityAabbFree,
  resolveAuthorityAabbMovement,
  type PlayerAabbDimensions
} from "../domain/collision";
import type { VoxelAuthority } from "../domain/authority";
import type { Vec3 } from "../domain/types";
import type { VoxelV2InputState, VoxelV2PlayerSnapshot } from "./ports";

export interface VoxelV2Ray {
  readonly origin: Vec3;
  readonly direction: Vec3;
}

const FIXED_STEP_SECONDS = 1 / 60;
const GRAVITY_METERS_PER_SECOND = 18;
const JUMP_METERS_PER_SECOND = 6.2;
const WALK_METERS_PER_SECOND = 4.5;
const SPRINT_METERS_PER_SECOND = 7;
const MAX_STEPS_PER_FRAME = 8;
const EYE_HEIGHT_METERS = 1.52;

const length = (value: Vec3): number => Math.hypot(value.x, value.y, value.z);

const normalized = (value: Vec3): Vec3 => {
  const magnitude = length(value);
  return magnitude > 1e-9 ? { x: value.x / magnitude, y: value.y / magnitude, z: value.z / magnitude } : { x: 0, y: 0, z: -1 };
};

export class VoxelV2PlayerController {
  public readonly dimensions: PlayerAabbDimensions = DEFAULT_PLAYER_AABB;
  private position: Vec3;
  private yaw = 0;
  private pitch = -0.32;
  private velocityY = 0;
  private grounded = false;
  private accumulatorSeconds = 0;
  private stepsLastFrame = 0;
  private input: VoxelV2InputState = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    sprint: false,
    jumpQueued: false
  };

  public constructor(private readonly authority: VoxelAuthority, startPosition: Vec3) {
    if (!isAuthorityAabbFree(authority, startPosition, this.dimensions)) {
      throw new Error("V2 player spawn intersects authoritative occupancy.");
    }
    this.position = { ...startPosition };
    this.grounded = !isAuthorityAabbFree(authority, { ...startPosition, y: startPosition.y - 0.03 }, this.dimensions);
  }

  public setInput(input: VoxelV2InputState): void {
    this.input = { ...input, jumpQueued: this.input.jumpQueued || input.jumpQueued };
  }

  public rotate(deltaX: number, deltaY: number): void {
    if (!Number.isFinite(deltaX) || !Number.isFinite(deltaY)) return;
    this.yaw -= deltaX * 0.0022;
    this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch - deltaY * 0.0022));
  }

  public advanceFrame(deltaSeconds: number): VoxelV2PlayerSnapshot {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds < 0) throw new Error("V2 player frame delta must be finite and non-negative.");
    this.accumulatorSeconds += deltaSeconds;
    let steps = 0;
    while (this.accumulatorSeconds >= FIXED_STEP_SECONDS && steps < MAX_STEPS_PER_FRAME) {
      this.advanceFixedStep();
      this.accumulatorSeconds -= FIXED_STEP_SECONDS;
      steps += 1;
    }
    this.stepsLastFrame = steps;
    return this.snapshot();
  }

  public snapshot(): VoxelV2PlayerSnapshot {
    return Object.freeze({
      position: Object.freeze({ ...this.position }),
      yaw: this.yaw,
      pitch: this.pitch,
      velocityY: this.velocityY,
      grounded: this.grounded,
      stepsLastFrame: this.stepsLastFrame,
      accumulatorSeconds: this.accumulatorSeconds
    });
  }

  public viewRay(): VoxelV2Ray {
    const horizontal = Math.cos(this.pitch);
    return {
      origin: {
        x: this.position.x,
        y: this.position.y + EYE_HEIGHT_METERS,
        z: this.position.z
      },
      direction: normalized({
        x: Math.sin(this.yaw) * horizontal,
        y: Math.sin(this.pitch),
        z: -Math.cos(this.yaw) * horizontal
      })
    };
  }

  public viewAngles(): { readonly yaw: number; readonly pitch: number } {
    return { yaw: this.yaw, pitch: this.pitch };
  }

  private advanceFixedStep(): void {
    const input = this.input;
    const forwardAxis = (input.forward ? 1 : 0) - (input.backward ? 1 : 0);
    const strafeAxis = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    const inputLength = Math.hypot(forwardAxis, strafeAxis);
    const scale = inputLength > 1 ? 1 / inputLength : 1;
    const speed = input.sprint ? SPRINT_METERS_PER_SECOND : WALK_METERS_PER_SECOND;
    const forward = { x: Math.sin(this.yaw), z: -Math.cos(this.yaw) };
    const right = { x: Math.cos(this.yaw), z: Math.sin(this.yaw) };
    const horizontalDisplacement = {
      x: (forward.x * forwardAxis + right.x * strafeAxis) * scale * speed * FIXED_STEP_SECONDS,
      z: (forward.z * forwardAxis + right.z * strafeAxis) * scale * speed * FIXED_STEP_SECONDS
    };

    if (this.grounded && input.jumpQueued) {
      this.velocityY = JUMP_METERS_PER_SECOND;
      this.grounded = false;
    } else {
      this.velocityY -= GRAVITY_METERS_PER_SECOND * FIXED_STEP_SECONDS;
    }
    this.input = { ...input, jumpQueued: false };
    const displacement: Vec3 = {
      x: horizontalDisplacement.x,
      y: this.velocityY * FIXED_STEP_SECONDS,
      z: horizontalDisplacement.z
    };
    const result = resolveAuthorityAabbMovement(this.authority, this.position, displacement, this.dimensions, 0.5);
    this.position = result.position;
    if (result.blockedY) this.velocityY = 0;
    this.grounded = result.grounded || (result.blockedY && displacement.y <= 0);
  }
}

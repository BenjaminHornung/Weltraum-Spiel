import type { GreedyChunkMesh } from "../domain/mesher";
import type { CollisionResult, PlayerAabbDimensions } from "../domain/collision";
import type { Vec3 } from "../domain/types";

export interface VoxelV2RenderStats {
  readonly visibleChunks: number;
  readonly vertices: number;
  readonly triangles: number;
  readonly drawCalls: number;
}

export interface VoxelV2RendererPort {
  adoptMesh(mesh: GreedyChunkMesh): boolean;
  removeMesh(key: string): void;
  setView(view: "player" | "coast" | "river"): void;
  setPlayerPose(position: Vec3, yaw: number, pitch: number): void;
  setHitMarker(position: Vec3 | null, accepted: boolean): void;
  render(): void;
  stats(): VoxelV2RenderStats;
  dispose(): void;
}

export interface VoxelV2InputState {
  readonly forward: boolean;
  readonly backward: boolean;
  readonly left: boolean;
  readonly right: boolean;
  readonly sprint: boolean;
  readonly jumpQueued: boolean;
}

export interface VoxelV2PlayerSnapshot {
  readonly position: Vec3;
  readonly yaw: number;
  readonly pitch: number;
  readonly velocityY: number;
  readonly grounded: boolean;
  readonly stepsLastFrame: number;
  readonly accumulatorSeconds: number;
}

export interface VoxelV2CollisionPort {
  readonly dimensions: PlayerAabbDimensions;
  move(displacement: Vec3): CollisionResult;
}

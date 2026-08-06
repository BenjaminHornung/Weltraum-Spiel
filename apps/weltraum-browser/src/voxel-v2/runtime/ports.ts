import type { GreedyChunkMesh } from "../domain/mesher";
import type { MacroWorldDescriptor } from "../domain/macroDescriptor";
import type { CollisionResult, PlayerAabbDimensions } from "../domain/collision";
import type { EditChunkChange, Vec3 } from "../domain/types";

export interface VoxelV2RenderStats {
  /** Non-empty adopted Near chunks; this is resident count, not frustum visibility. */
  readonly visibleChunks: number;
  /** Logical resident geometry totals, including inactive helper geometry and active instances; drawCalls is the most recent render. */
  readonly vertices: number;
  readonly triangles: number;
  readonly drawCalls: number;
}

export interface VoxelV2RendererPort {
  setWorldDescriptor(descriptor: MacroWorldDescriptor): void;
  invalidateVegetation(changes: readonly EditChunkChange[]): void;
  adoptMesh(mesh: GreedyChunkMesh): boolean;
  removeMesh(key: string): void;
  setView(view: "player" | "coast" | "archipelago" | "river"): void;
  setPlayerPose(position: Vec3, yaw: number, pitch: number): void;
  setHitMarker(position: Vec3 | null, accepted: boolean): void;
  render(deltaSeconds: number): void;
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

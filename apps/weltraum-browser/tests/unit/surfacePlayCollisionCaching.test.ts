import { describe, expect, it, vi } from "vitest";

const collisionBuilds = vi.hoisted(() => ({
  terrain: 0,
  shore: 0,
  attachedTree: 0
}));

vi.mock("../../src/surface-play/surfacePlayCollision", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/surface-play/surfacePlayCollision")>();
  return {
    ...actual,
    createSurfaceVoxelCollisionDelegate: (
      ...args: Parameters<typeof actual.createSurfaceVoxelCollisionDelegate>
    ) => {
      collisionBuilds.terrain += 1;
      return actual.createSurfaceVoxelCollisionDelegate(...args);
    },
    createShoreBoundSurfaceCollisionDelegate: (
      ...args: Parameters<typeof actual.createShoreBoundSurfaceCollisionDelegate>
    ) => {
      collisionBuilds.shore += 1;
      return actual.createShoreBoundSurfaceCollisionDelegate(...args);
    }
  };
});

vi.mock("../../src/surface-play/vegetation/surfaceTreeCollisionDelegate", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/surface-play/vegetation/surfaceTreeCollisionDelegate")>();
  return {
    ...actual,
    createAttachedSurfaceTreeCollisionDelegate: (
      ...args: Parameters<typeof actual.createAttachedSurfaceTreeCollisionDelegate>
    ) => {
      collisionBuilds.attachedTree += 1;
      return actual.createAttachedSurfaceTreeCollisionDelegate(...args);
    }
  };
});

import { createSurfacePlayerCommand } from "../../src/surface-play/contracts";
import {
  resolveHestiaSurfacePlaySpawn,
  resolveHestiaSurfacePlayWorld,
  revalidateHestiaSurfacePlayWorld
} from "../../src/surface-play/surfacePlayBootstrap";
import {
  createHestiaAgileGroundedLocomotionPresetV1,
  type SurfaceLocomotionState
} from "../../src/surface-play/player";
import { createHestiaSurfacePlayAuthorityInput } from "../../src/surface-play/surfacePlayConfig";
import { createSurfacePlayRuntime } from "../../src/surface-play/surfacePlayRuntime";
import { createSurfaceRegionVoxelAuthority } from "../../src/surface-play/voxel-edit";

describe("Surface Play collision source caching", () => {
  it("keeps static Terrain, Shore and attached-Tree delegates stable for 600 unchanged ticks", () => {
    const sourceWorld = resolveHestiaSurfacePlayWorld();
    const authority = createSurfaceRegionVoxelAuthority(createHestiaSurfacePlayAuthorityInput(sourceWorld));
    const adopted = revalidateHestiaSurfacePlayWorld(authority, sourceWorld);
    if (adopted.status === "Rejected") throw new Error(adopted.failure.message);
    const initialPlayerState = resolveHestiaSurfacePlaySpawn(authority, adopted.world);
    collisionBuilds.terrain = 0;
    collisionBuilds.shore = 0;
    collisionBuilds.attachedTree = 0;

    const runtime = createSurfacePlayRuntime({
      routeId: "surface-play-collision-cache-unit",
      initialPlayerState,
      authority,
      world: adopted.world
    });
    expect(collisionBuilds).toEqual({ terrain: 1, shore: 1, attachedTree: 1 });

    const fixedDeltaSeconds = createHestiaAgileGroundedLocomotionPresetV1().fixedDeltaSeconds;
    for (let index = 0; index < 600; index += 1) {
      const advanced = runtime.advance(
        fixedDeltaSeconds,
        (simulationTick, state: Readonly<SurfaceLocomotionState>) => createSurfacePlayerCommand({
          playerId: state.playerId,
          surfaceFrameId: state.surfaceFrameId,
          simulationTick,
          moveAxes: { forward: 0, right: 0 },
          lookDeltaRadians: { yaw: 0, pitch: 0 },
          sprint: false,
          crouch: null,
          jump: false,
          fire: false,
          pointerLockIntent: "Unchanged",
          reset: "None"
        })
      );
      expect(advanced.status).toBe("Advanced");
      expect(advanced.steps).toBe(1);
    }

    expect(collisionBuilds).toEqual({ terrain: 1, shore: 1, attachedTree: 1 });
    const snapshot = runtime.read();
    expect(snapshot.player.simulationTick).toBe(600);
    expect(snapshot.authorityState.regionRevision).toBe(authority.state.regionRevision);
    expect(snapshot.appliedVoxelTransitions).toEqual([]);
    expect(snapshot.latestVoxelTransition).toBeNull();
    expect(snapshot.world).toBe(adopted.world);
  }, 180_000);
});

import { describe, expect, it } from "vitest";
import { createSurfacePlayerCommand } from "../../src/surface-play/contracts";
import {
  createHestiaAgileGroundedLocomotionPresetV1,
  createSurfaceLocomotionState
} from "../../src/surface-play/player";
import {
  resolveHestiaSurfacePlayWorld,
  revalidateHestiaSurfacePlayWorld
} from "../../src/surface-play/surfacePlayBootstrap";
import { createHestiaSurfacePlayAuthorityInput } from "../../src/surface-play/surfacePlayConfig";
import { createSurfacePlayRuntime } from "../../src/surface-play/surfacePlayRuntime";
import { createSurfaceRegionVoxelAuthority } from "../../src/surface-play/voxel-edit";

describe("Surface Play post-edit crater locomotion", () => {
  it("walks into an accepted crater, falls, lands, jumps, and exits through authority collision", () => {
    const sourceWorld = resolveHestiaSurfacePlayWorld();
    const authority = createSurfaceRegionVoxelAuthority(createHestiaSurfacePlayAuthorityInput(sourceWorld));
    const adopted = revalidateHestiaSurfacePlayWorld(authority, sourceWorld);
    if (adopted.status === "Rejected") throw new Error(adopted.failure.message);
    const locomotion = createHestiaAgileGroundedLocomotionPresetV1();
    const cutCell = adopted.world.traversalDomain.cells.find((cell) =>
      cell.centerMeters.x === 80 && cell.centerMeters.z === -24
    );
    const startCell = adopted.world.traversalDomain.cells.find((cell) =>
      cell.centerMeters.x === 78.5 && cell.centerMeters.z === -24
    );
    if (cutCell === undefined || startCell === undefined) {
      throw new Error("Expected deterministic crater and approach cells.");
    }
    const startPositionMeters = {
      x: startCell.centerMeters.x,
      y: startCell.groundHeightMeters + locomotion.capsule.heightMeters / 2,
      z: startCell.centerMeters.z
    };
    const eyeHeightMeters = startPositionMeters.y
      + locomotion.headHeightMeters
      - locomotion.capsule.heightMeters / 2;
    const pitchRadians = Math.atan2(
      cutCell.groundHeightMeters - eyeHeightMeters,
      cutCell.centerMeters.x - startCell.centerMeters.x
    );
    const player = createSurfaceLocomotionState({
      playerId: "surface-player:post-edit-crater",
      surfaceFrameId: authority.state.surfaceFrameId,
      positionMeters: startPositionMeters,
      velocityMetersPerSecond: { x: 0, y: 0, z: 0 },
      yawRadians: Math.PI / 2,
      pitchRadians,
      grounded: true,
      groundNormal: startCell.groundNormal,
      movementMode: "Walk",
      capsule: locomotion.capsule,
      simulationTick: 0,
      jumpHeld: false,
      supportState: "SupportedResting"
    });
    const runtime = createSurfacePlayRuntime({
      routeId: "surface-play-post-edit-crater",
      initialPlayerState: player,
      authority,
      world: adopted.world
    });
    const advance = (
      moveForward: number,
      jump = false,
      fire = false
    ) => runtime.advance(locomotion.fixedDeltaSeconds, (simulationTick, state) =>
      createSurfacePlayerCommand({
        playerId: state.playerId,
        surfaceFrameId: state.surfaceFrameId,
        simulationTick,
        moveAxes: { forward: moveForward, right: 0 },
        lookDeltaRadians: { yaw: 0, pitch: 0 },
        sprint: false,
        crouch: null,
        jump,
        fire,
        pointerLockIntent: "Unchanged",
        reset: "None"
      })
    );

    const cut = advance(0, false, true);
    expect(cut.rejections).toEqual([]);
    expect(cut.snapshot.combat.latestFireResult).toMatchObject({
      status: "Accepted",
      hit: "Terrain"
    });
    expect(cut.snapshot.latestVoxelTransition?.result.status).toBe("Applied");
    expect(cut.snapshot.latestVoxelTransition?.intent.centerGlobalQuantum).toMatchObject({
      x: 80 / 0.125,
      z: -24 / 0.125
    });
    const adoptedHash = cut.snapshot.authorityState.currentRegionContentHash;
    expect(cut.snapshot.authorityState.regionRevision).toBe(1);
    expect(cut.snapshot.world?.identity.regionRevision).toBe(1);
    expect(cut.snapshot.presentation.terrain.regionRevision).toBe(1);

    let maximumZeroProgressStreak = 0;
    let zeroProgressStreak = 0;
    let firstAirborneTick: number | null = null;
    let firstAirborneX: number | null = null;
    for (let step = 0; step < 60; step += 1) {
      const before = runtime.read().player;
      const moved = advance(1);
      expect(moved.rejections).toEqual([]);
      const after = moved.snapshot.player;
      const horizontalProgress = Math.hypot(
        after.positionMeters.x - before.positionMeters.x,
        after.positionMeters.z - before.positionMeters.z
      );
      zeroProgressStreak = horizontalProgress <= 1e-4 ? zeroProgressStreak + 1 : 0;
      maximumZeroProgressStreak = Math.max(maximumZeroProgressStreak, zeroProgressStreak);
      if (!after.grounded && firstAirborneTick === null) {
        firstAirborneTick = after.simulationTick;
        firstAirborneX = after.positionMeters.x;
      }
      if (
        firstAirborneTick !== null
        && after.positionMeters.x - startPositionMeters.x >= 1.2
      ) break;
    }
    const afterApproach = runtime.read().player;
    expect(firstAirborneTick, JSON.stringify(afterApproach)).not.toBeNull();
    expect(firstAirborneX, JSON.stringify(afterApproach)).not.toBeNull();
    expect(afterApproach.positionMeters.x - startPositionMeters.x).toBeGreaterThanOrEqual(1.2);
    expect(maximumZeroProgressStreak).toBeLessThanOrEqual(4);

    let descentTick: number | null = afterApproach.velocityMetersPerSecond.y < -1
      ? afterApproach.simulationTick
      : null;
    for (let step = 0; step < 12 && descentTick === null; step += 1) {
      const descended = advance(0);
      expect(descended.rejections).toEqual([]);
      if (descended.snapshot.player.velocityMetersPerSecond.y < -1) {
        descentTick = descended.snapshot.player.simulationTick;
      }
    }
    expect(descentTick, JSON.stringify(runtime.read().player)).not.toBeNull();
    expect((descentTick ?? Number.POSITIVE_INFINITY) - (firstAirborneTick ?? 0))
      .toBeLessThanOrEqual(12);

    let landedTick: number | null = null;
    for (let step = 0; step < 45; step += 1) {
      const descended = advance(0);
      expect(descended.rejections).toEqual([]);
      if (descended.snapshot.player.grounded) {
        landedTick = descended.snapshot.player.simulationTick;
        break;
      }
    }
    expect(landedTick, JSON.stringify(runtime.read().player)).not.toBeNull();
    expect(runtime.read().player.grounded).toBe(true);

    const jumped = advance(0, true);
    expect(jumped.rejections).toEqual([]);
    expect(jumped.snapshot.player.grounded).toBe(false);
    expect(jumped.snapshot.player.velocityMetersPerSecond.y).toBeGreaterThan(4.9);

    let exitTick: number | null = null;
    for (let step = 0; step < 120; step += 1) {
      const moved = advance(1);
      expect(moved.rejections).toEqual([]);
      if (moved.snapshot.player.positionMeters.x > 81.2 && moved.snapshot.player.grounded) {
        exitTick = moved.snapshot.player.simulationTick;
        break;
      }
    }
    expect(exitTick, JSON.stringify(runtime.read().player)).not.toBeNull();
    const beforeContinuedMovement = runtime.read().player.positionMeters.x;
    for (let step = 0; step < 6; step += 1) {
      expect(advance(1).rejections).toEqual([]);
    }
    const final = runtime.read();
    expect(final.player.positionMeters.x).toBeGreaterThan(beforeContinuedMovement + 0.05);
    expect(final.authorityState.regionRevision).toBe(1);
    expect(final.authorityState.currentRegionContentHash).toBe(adoptedHash);
    expect(final.world?.identity.regionRevision).toBe(1);
    expect(final.presentation.terrain.regionRevision).toBe(1);
  }, 60_000);
});

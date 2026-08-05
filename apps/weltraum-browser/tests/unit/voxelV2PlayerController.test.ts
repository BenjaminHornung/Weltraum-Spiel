import { describe, expect, it } from "vitest";
import { VoxelAuthority } from "../../src/voxel-v2/domain/authority";
import { CHUNK_CELL_COUNT, CHUNK_EDGE } from "../../src/voxel-v2/domain/constants";
import { localCellIndex } from "../../src/voxel-v2/domain/coordinates";
import { VoxelMaterial } from "../../src/voxel-v2/domain/palette";
import { VoxelV2PlayerController } from "../../src/voxel-v2/runtime/playerController";

const floorAuthority = (): VoxelAuthority => {
  const authority = new VoxelAuthority("controller-test");
  const cells = new Uint8Array(CHUNK_CELL_COUNT);
  for (let z = 0; z < CHUNK_EDGE; z += 1) {
    for (let x = 0; x < CHUNK_EDGE; x += 1) cells[localCellIndex({ x, y: 0, z })] = VoxelMaterial.LightRock;
  }
  authority.adoptGeneratedChunk({ coord: { x: 0, y: 0, z: 0 }, sourceRevision: 1, cells });
  return authority;
};

describe("Voxel V2 player controller", () => {
  it("moves from real input against authority occupancy and remains grounded", () => {
    const controller = new VoxelV2PlayerController(floorAuthority(), { x: 4.125, y: 0.25, z: 4.125 });
    controller.setInput({ forward: true, backward: false, left: false, right: false, sprint: false, jumpQueued: false });
    const before = controller.snapshot();
    controller.advanceFrame(0.2);
    const after = controller.snapshot();
    expect(after.position.z).toBeLessThan(before.position.z);
    expect(after.position.y).toBeCloseTo(0.25, 6);
    expect(after.grounded).toBe(true);
    expect(after.stepsLastFrame).toBeGreaterThan(0);
  });

  it("retains fixed-step remainder and only launches on a grounded jump", () => {
    const controller = new VoxelV2PlayerController(floorAuthority(), { x: 4.125, y: 0.25, z: 4.125 });
    controller.setInput({ forward: false, backward: false, left: false, right: false, sprint: false, jumpQueued: true });
    const afterJump = controller.advanceFrame(1 / 60);
    expect(afterJump.position.y).toBeGreaterThan(0.25);
    expect(afterJump.grounded).toBe(false);
    expect(afterJump.accumulatorSeconds).toBe(0);
    controller.setInput({ forward: false, backward: false, left: false, right: false, sprint: false, jumpQueued: true });
    const partial = controller.advanceFrame(1 / 120);
    expect(partial.accumulatorSeconds).toBeCloseTo(1 / 120, 8);

    const highRefresh = new VoxelV2PlayerController(floorAuthority(), { x: 4.125, y: 0.25, z: 4.125 });
    highRefresh.setInput({ forward: false, backward: false, left: false, right: false, sprint: false, jumpQueued: true });
    highRefresh.advanceFrame(1 / 120);
    highRefresh.setInput({ forward: false, backward: false, left: false, right: false, sprint: false, jumpQueued: false });
    expect(highRefresh.advanceFrame(1 / 120).position.y).toBeGreaterThan(0.25);
  });
});

import { createHash } from "node:crypto";
import { beforeAll, expect, it } from "vitest";
import { R, initializeHvpRapier } from "../../src/hestia-prototype/physics/rapierPort";
import { createHvpLocomotion } from "../../src/hestia-prototype/player/locomotion";

beforeAll(initializeHvpRapier);

// Use P1_QUERY_BASELINE=1 when running this same test against the unmodified R05 adapter.
it("walks the same flat scene with camera clearance and counts predicate scans", () => {
  const expectedScans = process.env.P1_QUERY_BASELINE === "1" ? 480 : 0;
  const world = new R.World({ x: 0, y: -9.81, z: 0 });
  try {
    world.timestep = 1 / 60;
    world.createCollider(R.ColliderDesc.cuboid(50, 0.5, 50).setTranslation(0, -0.5, 0));
    for (let i = 0; i < 87; i++) {
      world.createCollider(R.ColliderDesc.ball(0.3).setTranslation(50 + i, 0, 0));
    }
    const player = createHvpLocomotion(world, { x: 0, y: 0.92, z: 0 }, 9.81, () => true);
    let scans = 0;
    const each = world.colliders.forEach.bind(world.colliders);
    world.colliders.forEach = callback => {
      scans++;
      each(callback);
    };
    const trace: number[] = [];
    let cameraAndLocomotionMs = 0;
    let worldStepMs = 0;
    try {
      player.setEnabled(true);
      player.setInput({ x: 0, z: -1, sprint: false, jump: false });
      for (let tick = 0; tick < 300; tick++) {
        if (tick === 60) { scans = 0; }
        const start = performance.now();
        player.setCameraOffset({ x: 0, y: 0.6, z: 3.2 });
        player.step();
        const afterPlayer = performance.now();
        world.step();
        const afterWorld = performance.now();
        if (tick >= 60) {
          cameraAndLocomotionMs += afterPlayer - start;
          worldStepMs += afterWorld - afterPlayer;
        }
        const state = player.read();
        trace.push(state.position.x, state.position.y, state.position.z, state.cameraFraction, Number(state.grounded));
      }
      const traceSha256 = createHash("sha256").update(JSON.stringify(trace)).digest("hex");
      console.log("P1_QUERY_AB", JSON.stringify({
        colliders: world.colliders.len(), warmupTicks: 60, measuredTicks: 240, scans,
        cameraAndLocomotionMs, worldStepMs, traceSha256
      }));
      expect(world.colliders.len()).toBe(89);
      expect(player.read().position.z).toBeCloseTo(-15, 1);
      expect(player.read().grounded).toBe(true);
      expect(scans).toBe(expectedScans);
      expect(traceSha256).toBe("e0450cc52da575c85287d3c3f6f665f83d6dbb19d8ce8253bbd61f3fe6ba6c0e");
    } finally { player.dispose(); }
  } finally { world.free(); }
});

import { beforeAll, expect, it } from "vitest";
import { writeFileSync } from "node:fs";
import * as R from "../src/rapier021Candidate";
import { createHvpLocomotion } from "../snapshot/c/src/hestia-prototype/player/locomotion";
beforeAll(() => R.init());

it("measures a bounded single-parameter native clearance probe against unchanged walking and foot bounds", () => {
  const rows = [];
  for (const normalNudgeFactor of [0, .0001, .0005, .001, .002, .005, .01]) {
    for (const diagonal of [false, true]) {
      const world = new R.World({ x: 0, y: -9.81, z: 0 }); world.timestep = 1 / 60;
      const create = world.createCharacterController.bind(world);
      world.createCharacterController = offset => { const controller = create(offset); controller.setNormalNudgeFactor(normalNudgeFactor); return controller; };
      world.createCollider(R.ColliderDesc.cuboid(10, .5, 10).setTranslation(0, -.5, 0));
      const player = createHvpLocomotion(world, { x: 0, y: .92, z: 0 }, 9.81, () => true);
      try {
        player.setEnabled(true);
        for (let tick = 0; tick < 10; tick++) { player.step(); world.step(); }
        player.setInput({ x: diagonal ? 1 : 0, z: -1, sprint: false, jump: false });
        for (let tick = 0; tick < 60; tick++) { player.step(); world.step(); }
        const read = player.read(), distance = Math.hypot(read.position.x, read.position.z), feet = read.position.y - .9;
        expect([distance, feet].every(Number.isFinite)).toBe(true);
        rows.push({ normalNudgeFactor, diagonal, diagnosticOnly: true, distance, feet, grounded: read.grounded,
          originalWalkingOracle: Math.abs(distance - 3) < .005 && feet >= 0 && feet <= .02 && read.grounded ? "PASS" : "FAIL" });
      } finally { player.dispose(); world.free(); }
    }
  }
  const label = process.env.PHY_RUN_LABEL;
  if (!label || !/^[a-z0-9-]{1,64}$/.test(label)) { throw new Error("Bound run label required"); }
  writeFileSync(`results/kcc-nudge-${label}.json`, JSON.stringify({ profile: R.PHY01_SOLVER_PROFILE, rows }, null, 2) + "\n", { flag: "wx" });
});

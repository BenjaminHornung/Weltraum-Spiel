import { beforeAll, expect, it } from "vitest";
import { writeFileSync } from "node:fs";
import * as R from "../src/rapier021Candidate";
import { createHvpLocomotion } from "../snapshot/c/src/hestia-prototype/player/locomotion";
beforeAll(() => R.init());
type Collision = Pick<R.CharacterCollision, "toi" | "normal1" | "normal2" | "witness1" | "witness2"
  | "translationDeltaApplied" | "translationDeltaRemaining">;
type Row = { diagonal: boolean; tick: number; position: R.Vector; desired: R.Vector; movement: R.Vector;
  grounded: boolean; hits: Collision[] };
it("preserves ground clearance and full walking distance in every straight and diagonal frame", () => {
  const rows: Row[] = [];
  for (const diagonal of [false, true]) {
    const world = new R.World({ x: 0, y: -9.81, z: 0 }); world.timestep = 1 / 60;
    let tick = 0;
    const create = world.createCharacterController.bind(world);
    world.createCharacterController = offset => {
      const controller = create(offset), compute = controller.computeColliderMovement.bind(controller);
      controller.computeColliderMovement = (...args) => {
        const position = args[0].translation(), desired = { ...args[1] };
        compute(...args);
        const movement = { ...controller.computedMovement() }, hits = [];
        if (tick >= 10) {
          const feet = position.y + movement.y - .9;
          expect(feet).toBeGreaterThanOrEqual(0); expect(feet).toBeLessThanOrEqual(.02);
          expect(controller.computedGrounded()).toBe(true);
          for (let index = 0; index < controller.numComputedCollisions(); index++) {
            const hit = controller.computedCollision(index);
            if (hit) { hits.push({ toi: hit.toi, normal1: { ...hit.normal1 }, normal2: { ...hit.normal2 },
              witness1: { ...hit.witness1 }, witness2: { ...hit.witness2 },
              translationDeltaApplied: { ...hit.translationDeltaApplied }, translationDeltaRemaining: { ...hit.translationDeltaRemaining } }); }
          }
          rows.push({ diagonal, tick, position, desired, movement, grounded: controller.computedGrounded(), hits });
        }
      };
      return controller;
    };
    world.createCollider(R.ColliderDesc.cuboid(10, .5, 10).setTranslation(0, -.5, 0));
    const player = createHvpLocomotion(world, { x: 0, y: .92, z: 0 }, 9.81, () => true);
    try {
      player.setEnabled(true);
      for (tick = 0; tick < 70; tick++) {
        if (tick === 10) { player.setInput({ x: diagonal ? 1 : 0, z: -1, sprint: false, jump: false }); }
        player.step(); world.step();
      }
      expect(Math.hypot(player.read().position.x, player.read().position.z)).toBeCloseTo(3, 2);
    } finally { player.dispose(); world.free(); }
  }
  const label = process.env.PHY_RUN_LABEL;
  if (!label || !/^[a-z0-9-]{1,64}$/.test(label)) { throw new Error("Bound run label required"); }
  writeFileSync(`results/kcc-collisions-${label}.json`, JSON.stringify({ diagnosticOnly: false, rows }, null, 2) + "\n", { flag: "wx" });
});

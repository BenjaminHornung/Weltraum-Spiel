import { beforeAll, expect, it } from "vitest";
import { writeFileSync } from "node:fs";
import * as R from "../src/rapier021Candidate";
import { createHvpLocomotion } from "../snapshot/c/src/hestia-prototype/player/locomotion";
beforeAll(() => R.init());

it("diagnoses the real commanded and integrated walking poses with one canSleep parameter", () => {
  const rows = [];
  for (const canSleep of [true, false]) {
    const world = new R.World({ x: 0, y: -9.81, z: 0 }); world.timestep = 1 / 60;
    const create = world.createRigidBody.bind(world);
    world.createRigidBody = description => create(description.setCanSleep(canSleep));
    world.createCollider(R.ColliderDesc.cuboid(10, .5, 10).setTranslation(0, -.5, 0));
    const player = createHvpLocomotion(world, { x: 0, y: .92, z: 0 }, 9.81, () => true);
    const body = world.bodies.getAll()[0]!;
    const frames = [];
    try {
      player.setEnabled(true);
      for (let tick = 0; tick < 70; tick++) {
        if (tick === 10) { player.setInput({ x: 0, z: -1, sprint: false, jump: false }); }
        const before = { p: body.translation(), sleeping: body.isSleeping() };
        player.step();
        const commanded = { p: body.nextTranslation(), sleeping: body.isSleeping() };
        world.step();
        const after = { p: body.translation(), sleeping: body.isSleeping(), v: body.linvel() };
        frames.push({ tick, before, commanded, after, integratedZ: after.p.z - before.p.z });
        expect([after.p.x, after.p.y, after.p.z].every(Number.isFinite)).toBe(true);
      }
      rows.push({ canSleep, diagnosticOnly: true, distance: Math.abs(player.read().position.z), frames });
    } finally { player.dispose(); world.free(); }
  }
  const label = process.env.PHY_RUN_LABEL;
  if (!label || !/^[a-z0-9-]{1,64}$/.test(label)) { throw new Error("Bound run label required"); }
  writeFileSync(`results/walking-diagnostic-${label}.json`, JSON.stringify({ profile: R.PHY01_SOLVER_PROFILE, rows }, null, 2) + "\n", { flag: "wx" });
});

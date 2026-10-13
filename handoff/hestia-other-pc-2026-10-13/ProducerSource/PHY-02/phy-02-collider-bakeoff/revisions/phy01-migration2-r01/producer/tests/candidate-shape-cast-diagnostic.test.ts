import { beforeAll, expect, it } from "vitest";
import { writeFileSync } from "node:fs";
import * as R from "../src/rapier021Candidate";
beforeAll(() => R.init());
it("finds the exact positive-margin initial contact that previously tunneled through the floor", () => {
  const world = new R.World({ x: 0, y: 0, z: 0 });
  const position = { x: 1.0253043174743652, y: .901016354560852, z: -1.0253043174743652 };
  const delta = { x: .035355339059327376, y: -.002725, z: -.035355339059327376 };
  const length = Math.hypot(delta.x, delta.y, delta.z), direction = { x: delta.x / length, y: delta.y / length, z: delta.z / length };
  const rotation = { x: 0, y: 0, z: 0, w: 1 }, zero = { x: 0, y: 0, z: 0 };
  const floor = world.createCollider(R.ColliderDesc.cuboid(10, .5, 10).setTranslation(0, -.5, 0));
  const capsule = new R.Capsule(.6, .3), rows = [];
  try {
    world.updateSceneQueries();
    const contact = floor.contactShape(capsule, position, rotation, .01);
    expect(contact).not.toBeNull();
    for (const targetDistance of [0, .01]) {
      for (const stopAtPenetration of [false, true]) {
        const direct = floor.castShape(zero, capsule, position, rotation, direction, targetDistance, length, stopAtPenetration);
        const hit = world.castShape(position, rotation, direction, capsule, targetDistance, length, stopAtPenetration);
        expect(direct).not.toBeNull(); expect(hit).not.toBeNull();
        if (targetDistance > 0) { expect(direct!.time_of_impact).toBe(0); expect(hit!.time_of_impact).toBe(0); }
        rows.push({ targetDistance, stopAtPenetration,
          direct: direct ? { toi: direct.time_of_impact, normal1: { ...direct.normal1 }, witness1: { ...direct.witness1 } } : null,
          world: hit ? { toi: hit.time_of_impact, normal1: { ...hit.normal1 }, witness1: { ...hit.witness1 } } : null });
      }
    }
    const label = process.env.PHY_RUN_LABEL;
    if (!label || !/^[a-z0-9-]{1,64}$/.test(label)) { throw new Error("Bound run label required"); }
    const away = { x: direction.x, y: -direction.y, z: direction.z };
    expect(world.castShape(position, rotation, away, capsule, .01, length, false)).toBeNull();
    expect(world.castShape(position, rotation, away, capsule, .01, length, true)?.time_of_impact).toBe(0);
    writeFileSync(`results/shape-cast-${label}.json`, JSON.stringify({ diagnosticOnly: false, position, delta, direction, length,
      contact: contact ? { distance: contact.distance, normal1: { ...contact.normal1 }, normal2: { ...contact.normal2 } } : null,
      rows }, null, 2) + "\n", { flag: "wx" });
  } finally { world.free(); }
});
